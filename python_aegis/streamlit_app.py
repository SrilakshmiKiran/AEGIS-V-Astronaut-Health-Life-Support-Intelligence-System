"""AEGIS-V Python Edition — Streamlit Card-First Mission Health Dashboard.

Run locally after installing `python_aegis/requirements.txt`:
    streamlit run python_aegis/streamlit_app.py --server.port 8501
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

import streamlit as st

from python_aegis import PROTOTYPE_DISCLAIMER, SCHEMA_VERSION
from python_aegis.aegis_engine import (
    build_earth_handoff_package,
    evaluate_deterministic_rules,
    evaluate_parameter_telemetry_status,
    is_procedure_authorized,
    validate_role_and_pin,
)
from python_aegis.contracts import (
    ALL_18_PARAMETERS,
    AUTHORIZED_PROTOTYPE_PROCEDURES,
    CREW_ROSTER,
    DEFAULT_BASELINE_METRICS,
    EclssSnapshot,
    GUIDANCE_CATEGORIES,
    MedicalGuidanceScreenInput,
    ONBOARD_MEDICAL_EQUIPMENT,
    PARAMETER_METADATA,
    RED_FLAG_SIGNS,
    SUBJECTIVE_CHECKIN_LABELS,
    TelemetryObservation,
)
from python_aegis.firebase_store import AegisFirestoreStore
from python_aegis.life_safety_engine import (
    evaluate_checkin_schedule,
    evaluate_environment_life_safety,
    filter_emergency_resources,
)
from python_aegis.medical_guidance_engine import (
    resolve_protocol_for_intake,
    search_guidance_library,
)

st.set_page_config(
    page_title="AEGIS-V Python Edition — Crew Health & Life Safety",
    page_icon="🛰️",
    layout="wide",
)


def _seed_observations(now: datetime, scenario: str = "NOMINAL") -> List[TelemetryObservation]:
    obs: List[TelemetryObservation] = []
    for param in ALL_18_PARAMETERS:
        base = DEFAULT_BASELINE_METRICS[param]
        val = float(base["mean"])
        quality = "VALID"
        if scenario == "CO2_HYPOXIA":
            if param == "cabin_co2_mmhg":
                val = 4.6
            elif param == "spo2_pct":
                val = 93.4
            elif param == "heart_rate_bpm":
                val = 92.0
        elif scenario == "DATA_CORRUPTION":
            if param == "spo2_pct":
                quality = "CORRUPTED"
                val = 140.0
        obs.append(
            TelemetryObservation(
                observation_id=f"OBS-{param}",
                astronaut_id="AST-01-COMMANDER",
                timestamp=(now - timedelta(minutes=2)).isoformat(),
                parameter=param,
                value=val,
                unit=str(base["unit"]),
                source_type="SIMULATED",
                quality_status=quality,  # type: ignore[arg-type]
                is_quarantined=(quality != "VALID"),
            )
        )
    return obs


if "active_page" not in st.session_state:
    st.session_state.active_page = "HOME"
if "scenario" not in st.session_state:
    st.session_state.scenario = "NOMINAL"
if "cmo_available" not in st.session_state:
    st.session_state.cmo_available = True
if "earth_comms" not in st.session_state:
    st.session_state.earth_comms = True
if "operator_role" not in st.session_state:
    st.session_state.operator_role = "CREW_MEMBER"

store = AegisFirestoreStore()
now = datetime.now(timezone.utc)
observations = _seed_observations(now, st.session_state.scenario)

with st.sidebar:
    st.title("🛰️ AEGIS-V Python")
    st.caption(f"Schema {SCHEMA_VERSION}")
    page_choice = st.radio(
        "Mission Workspace",
        [
            "HOME",
            "MEDICAL_HELP",
            "LIFE_SAFETY",
            "CONTINUITY_MODE",
            "LIVE_VITALS",
            "SHIFT_HANDOVER",
        ],
        index=[
            "HOME",
            "MEDICAL_HELP",
            "LIFE_SAFETY",
            "CONTINUITY_MODE",
            "LIVE_VITALS",
            "SHIFT_HANDOVER",
        ].index(st.session_state.active_page),
    )
    st.session_state.active_page = page_choice
    st.divider()
    st.session_state.scenario = st.selectbox(
        "Simulation Scenario",
        ["NOMINAL", "CO2_HYPOXIA", "DATA_CORRUPTION"],
    )
    st.session_state.earth_comms = st.toggle("Earth WAN Link Online", value=st.session_state.earth_comms)
    st.session_state.cmo_available = st.toggle("Crew Medical Officer Available", value=st.session_state.cmo_available)
    st.session_state.operator_role = st.selectbox(
        "Active Operator Role",
        ["CREW_MEMBER", "CREW_MEDICAL_OFFICER", "MISSION_OBSERVER"],
    )
    st.caption(PROTOTYPE_DISCLAIMER)


if st.session_state.active_page == "HOME":
    st.header("AEGIS-V Crew Autonomy & Life-Safety Hub (Python)")
    st.info("Simple card-first navigation: pick any operational card below to open its focused workspace.")
    c1, c2, c3 = st.columns(3)
    with c1:
        st.subheader("🚑 I Need Medical Help")
        st.write("Rapid red-flag screening, 22 condition categories, equipment locator & step-by-step guidance.")
        if st.button("Open Medical Help", use_container_width=True):
            st.session_state.active_page = "MEDICAL_HELP"
            st.rerun()
    with c2:
        st.subheader("🛡️ Life-Safety Sentinel")
        st.write("8-channel cabin ECLSS monitor, missed check-in supervision & priority emergency alert.")
        if st.button("Open Life-Safety", use_container_width=True):
            st.session_state.active_page = "LIFE_SAFETY"
            st.rerun()
    with c3:
        st.subheader("🧭 Continuity Mode")
        st.write("CMO-unavailable non-medical view, crew capability board & RBAC procedure locks.")
        if st.button("Open Continuity Mode", use_container_width=True):
            st.session_state.active_page = "CONTINUITY_MODE"
            st.rerun()

    c4, c5, c6 = st.columns(3)
    with c4:
        st.subheader("📈 Live Vitals & 18 Metrics")
        st.write("Personal 14-day P05-P95 baselines, staleness & quarantine integrity verification.")
        if st.button("Open Live Vitals", use_container_width=True):
            st.session_state.active_page = "LIVE_VITALS"
            st.rerun()
    with c5:
        st.subheader("📋 Shift Handover & Self-Check")
        st.write("Subjective crew check-in, handover summary & Earth handoff Markdown export.")
        if st.button("Open Shift Handover", use_container_width=True):
            st.session_state.active_page = "SHIFT_HANDOVER"
            st.rerun()
    with c6:
        st.subheader("⚡ Active Deterministic Alerts")
        rules = evaluate_deterministic_rules(observations)
        st.metric("Triggered Rules", len(rules))
        for r in rules:
            st.warning(f"{r['rule_id']}: {r['rule_name']} ({r['severity']})")

elif st.session_state.active_page == "MEDICAL_HELP":
    st.header("🚑 Emergency Medical Guidance & First-Response Assistant")
    col_a, col_b = st.columns([2, 1])
    with col_a:
        who = st.radio("Who needs help?", ["ME", "ANOTHER_CREW_MEMBER"], horizontal=True)
        conscious = st.radio("Is the person conscious?", ["YES", "NO", "UNSURE"], horizontal=True)
        breathing = st.radio("Breathing normally?", ["YES", "NO", "UNSURE"], horizontal=True)
        bleeding = st.radio("Severe bleeding?", ["NO", "YES", "UNSURE"], horizontal=True)
        cat_labels = {c["label"]: c["id"] for c in GUIDANCE_CATEGORIES}
        picked_labels = st.multiselect("Symptoms or injuries present", list(cat_labels.keys()))
        flag_labels = {f["label"]: f["id"] for f in RED_FLAG_SIGNS}
        picked_flags = st.multiselect("Red-flag warning signs", list(flag_labels.keys()))
        urgent_btn = st.button("🚨 URGENT EMERGENCY ESCALATION", type="primary")

        intake = MedicalGuidanceScreenInput(
            who_needs_help=who,  # type: ignore[arg-type]
            conscious=conscious,  # type: ignore[arg-type]
            breathing_normally=breathing,  # type: ignore[arg-type]
            severe_bleeding=bleeding,  # type: ignore[arg-type]
            selected_categories=[cat_labels[x] for x in picked_labels],
            selected_red_flags=[flag_labels[x] for x in picked_flags],
            urgent_bypass_triggered=urgent_btn,
        )
        res = resolve_protocol_for_intake(intake)
        if res["screening"]["isEmergency"]:
            st.error("URGENT PRIORITY: " + " | ".join(res["screening"]["reasons"]))
        if res["matched"] and res["protocol"]:
            proto = res["protocol"]
            st.subheader(proto["title"])
            for idx, step in enumerate(proto["steps"], start=1):
                st.write(f"{idx}. {step}")
        else:
            st.warning(res["refusalNotice"])

    with col_b:
        st.subheader("Onboard Equipment Locator")
        q = st.text_input("Search medical kit or bay")
        for eq in search_guidance_library(q)["equipment"]:
            st.write(f"**{eq['name']}** — `{eq['operationalStatus']}` ({eq['location']})")

elif st.session_state.active_page == "LIFE_SAFETY":
    st.header("🛡️ AEGIS Life-Safety Sentinel (8-Channel ECLSS)")
    col1, col2, col3, col4 = st.columns(4)
    kpa = col1.number_input("Cabin Pressure (kPa)", value=101.3, step=0.5)
    rate = col2.number_input("Pressure Rate (kPa/hr)", value=0.0, step=0.1)
    ppo2 = col3.number_input("ppO2 (mmHg)", value=159.0, step=1.0)
    co_ppm = col4.number_input("Trace CO (ppm)", value=1.2, step=0.5)
    snap = EclssSnapshot(
        cabin_pressure_kpa=float(kpa),
        cabin_pressure_rate_kpa_hr=float(rate),
        pp_o2_mmhg=float(ppo2),
        trace_co_ppm=float(co_ppm),
    )
    eval_res = evaluate_environment_life_safety(snap)
    st.metric("Overall Habitat Status", eval_res["overallLevel"])
    for f in eval_res["findings"]:
        st.write(f"- **{f['parameterLabel']}**: {f['currentText']} (`{f['severity']}` · {f['sourceMode']})")

    st.subheader("Crew Check-In Watch & Resource Filter")
    elapsed_hrs = st.slider("Hours since last crew check-in", 0, 24, 6)
    chk = evaluate_checkin_schedule((now - timedelta(hours=elapsed_hrs)).isoformat(), now.isoformat())
    st.write(f"**{chk['statusCode']}** — {chk['headline']}")
    for r in filter_emergency_resources(available_only=True):
        st.write(f"• {r['name']} @ {r['location']}")

elif st.session_state.active_page == "CONTINUITY_MODE":
    st.header("🧭 Continuity Mode — Earth-Independent Crew Support")
    st.write("Crew Capability Roster:")
    st.table(CREW_ROSTER)

    pin = st.text_input("CMO Authorization PIN (Prototype: 2026)", type="password")
    req_cmo = st.checkbox("Simulate CMO-Restricted Procedure", value=True)
    ok, msg = validate_role_and_pin(st.session_state.operator_role, required_cmo=req_cmo, auth_pin=pin)
    proc_check = is_procedure_authorized(
        "PROC-ENV-CO2-01",
        requires_cmo=req_cmo,
        operator_role=st.session_state.operator_role,
        cmo_available=st.session_state.cmo_available,
    )
    if ok and proc_check["allowed"]:
        st.success(f"{msg} | {proc_check['reason']}")
    else:
        st.warning(f"{msg} | {proc_check['reason']}")

    st.subheader("Approved Onboard Procedures")
    for pid, desc in AUTHORIZED_PROTOTYPE_PROCEDURES.items():
        st.write(f"- `{pid}`: {desc}")

elif st.session_state.active_page == "LIVE_VITALS":
    st.header("📈 18-Parameter Personal Baseline & Quarantine Telemetry")
    rows = [
        {
            "Parameter": PARAMETER_METADATA[p]["label"],
            "Freshness": s["freshness"],
            "Live Value": s["liveValue"],
            "Last Valid": s["lastValidValue"],
            "Unit": s["unit"],
            "Quarantined/Unavailable": s["isStaleOrUnavailable"],
        }
        for p in ALL_18_PARAMETERS
        for s in [evaluate_parameter_telemetry_status(observations, p, reference_iso=now.isoformat())]
    ]
    st.dataframe(rows, use_container_width=True)

elif st.session_state.active_page == "SHIFT_HANDOVER":
    st.header("📋 Subjective Self-Check & Earth Handoff Export")
    feeling = st.radio("How do you feel?", list(SUBJECTIVE_CHECKIN_LABELS.values()))
    note = st.text_input("Optional crew note (never fabricated as sensor telemetry)")
    if st.button("Save Check-In Record"):
        mode = store.save_ops_record(
            "demo-astronaut",
            f"CHECKIN-{int(now.timestamp())}",
            {"feeling": feeling, "note": note, "timestamp": now.isoformat()},
        )
        st.success(f"Saved check-in ({mode})")

    pkg = build_earth_handoff_package(
        astronaut_id="AST-01-COMMANDER",
        astronaut_name="Cdr. Elena Vance",
        mission_name="Artemis Transit Sim",
        observations=observations,
        earth_comms_available=st.session_state.earth_comms,
        cmo_available=st.session_state.cmo_available,
        operator_role=st.session_state.operator_role,
    )
    st.markdown(pkg["markdownDocument"])
