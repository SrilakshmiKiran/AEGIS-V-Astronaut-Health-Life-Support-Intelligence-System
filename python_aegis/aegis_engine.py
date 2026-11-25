"""Core AEGIS-V deterministic telemetry, baseline comparison, rule, RBAC, and Continuity Mode engine."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from . import PROTOTYPE_DISCLAIMER
from .contracts import (
    ALL_18_PARAMETERS,
    AUTHORIZED_PROTOTYPE_PROCEDURES,
    ActorRole,
    AuditLogEntry,
    CREW_ROSTER,
    DEFAULT_BASELINE_METRICS,
    ONBOARD_MEDICAL_EQUIPMENT,
    PARAMETER_METADATA,
    TelemetryObservation,
)

CMO_AUTH_PIN = "2026"


def sha256_hex(message: str) -> str:
    return hashlib.sha256(message.encode("utf-8")).hexdigest()


def compute_audit_entry_hash(entry: AuditLogEntry) -> str:
    canonical = json.dumps(
        {
            "log_id": entry.log_id,
            "incident_id": entry.incident_id,
            "timestamp": entry.timestamp,
            "from_state": entry.from_state,
            "to_state": entry.to_state,
            "actor_id": entry.actor_id,
            "actor_role": entry.actor_role,
            "notes": entry.notes or "",
            "prev_hash": entry.prev_hash,
        },
        separators=(",", ":"),
    )
    return sha256_hex(canonical)


def verify_audit_chain(entries: List[AuditLogEntry]) -> Dict[str, Any]:
    if not entries:
        return {"valid": True, "checkedCount": 0}
    for i, entry in enumerate(entries):
        if i > 0 and entry.prev_hash != entries[i - 1].entry_hash:
            return {"valid": False, "brokenAtLogId": entry.log_id, "checkedCount": i + 1}
        expected = compute_audit_entry_hash(entry)
        if entry.entry_hash != expected:
            return {"valid": False, "brokenAtLogId": entry.log_id, "checkedCount": i + 1}
    return {"valid": True, "checkedCount": len(entries)}


def is_observation_degraded(obs: TelemetryObservation) -> bool:
    if obs.is_quarantined:
        return True
    if obs.quality_status in ("STALE", "MISSING", "IMPOSSIBLE", "CORRUPTED"):
        return True
    if obs.source_type == "VERIFIED_DEVICE" and not obs.device_hmac_verified:
        return True
    return obs.value is None


def compare_to_baseline(
    obs: TelemetryObservation,
    baseline_metrics: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    metrics = baseline_metrics or DEFAULT_BASELINE_METRICS
    metric = metrics[obs.parameter]
    current_val = obs.value if obs.value is not None else float(metric["mean"])
    mean = float(metric["mean"])
    std = max(float(metric["std"]), 1e-3)
    p05 = float(metric["p05"])
    p95 = float(metric["p95"])

    abs_delta = round(current_val - mean, 4)
    pct_delta = round(((current_val - mean) / max(abs(mean), 1e-6)) * 100.0, 2)
    z_score = round((current_val - mean) / std, 2)
    outside = current_val < p05 or current_val > p95

    return {
        "parameter": obs.parameter,
        "unit": metric["unit"],
        "current_value": current_val,
        "baseline_mean": mean,
        "baseline_p05": p05,
        "baseline_p95": p95,
        "absolute_delta": abs_delta,
        "percent_delta": pct_delta,
        "z_score": z_score,
        "outside_p05_p95_band": outside,
        "info_label": "COMPUTED",
    }


def _parse_iso(ts: str) -> datetime:
    cleaned = ts.replace("Z", "+00:00")
    dt = datetime.fromisoformat(cleaned)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def evaluate_parameter_telemetry_status(
    observations: List[TelemetryObservation],
    parameter: str,
    reference_iso: Optional[str] = None,
    stale_after_minutes: float = 30.0,
) -> Dict[str, Any]:
    meta = PARAMETER_METADATA[parameter]
    ref_dt = _parse_iso(reference_iso) if reference_iso else datetime.now(timezone.utc)

    param_obs = sorted(
        [o for o in observations if o.parameter == parameter],
        key=lambda o: _parse_iso(o.timestamp),
    )
    latest_raw = param_obs[-1] if param_obs else None
    valid_obs = [o for o in param_obs if not is_observation_degraded(o)]
    last_valid = valid_obs[-1] if valid_obs else None
    prev_valid = valid_obs[-2] if len(valid_obs) >= 2 else None

    age_minutes: Optional[float] = None
    if last_valid:
        age_minutes = round((ref_dt - _parse_iso(last_valid.timestamp)).total_seconds() / 60.0, 1)

    if not last_valid or (latest_raw and is_observation_degraded(latest_raw)):
        freshness = "UNAVAILABLE" if not last_valid else "STALE"
        live_value = None
    elif age_minutes is not None and age_minutes > stale_after_minutes:
        freshness = "STALE"
        live_value = None
    elif age_minutes is not None and age_minutes > stale_after_minutes * 0.5:
        freshness = "AGING"
        live_value = last_valid.value
    else:
        freshness = "CURRENT"
        live_value = last_valid.value

    delta = (
        round(last_valid.value - prev_valid.value, 2)
        if last_valid and prev_valid and last_valid.value is not None and prev_valid.value is not None
        else None
    )

    return {
        "parameter": parameter,
        "unit": meta["unit"],
        "liveValue": live_value,
        "lastValidValue": last_valid.value if last_valid else None,
        "lastObservationTimeIso": latest_raw.timestamp if latest_raw else None,
        "lastValidTimeIso": last_valid.timestamp if last_valid else None,
        "freshness": freshness,
        "ageMinutes": age_minutes,
        "isStaleOrUnavailable": freshness in ("STALE", "UNAVAILABLE"),
        "deltaSincePrevValid": delta,
    }


def evaluate_deterministic_rules(
    observations: List[TelemetryObservation],
    baseline_metrics: Optional[Dict[str, Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Run AEGIS-V deterministic alert rules without fabricating missing values."""
    metrics = baseline_metrics or DEFAULT_BASELINE_METRICS
    findings: List[Dict[str, Any]] = []

    quarantined = [o for o in observations if is_observation_degraded(o)]
    if quarantined:
        findings.append(
            {
                "rule_id": "RULE-DATA-QUALITY-04",
                "rule_name": "Telemetry Quality & Quarantine Alert",
                "severity": "ADVISORY",
                "triggered": True,
                "quarantined_count": len(quarantined),
                "prototype_disclaimer": PROTOTYPE_DISCLAIMER,
            }
        )

    valid_by_param: Dict[str, List[TelemetryObservation]] = {}
    for o in observations:
        if not is_observation_degraded(o):
            valid_by_param.setdefault(o.parameter, []).append(o)

    latest_co2 = valid_by_param.get("cabin_co2_mmhg", [])[-1] if valid_by_param.get("cabin_co2_mmhg") else None
    latest_spo2 = valid_by_param.get("spo2_pct", [])[-1] if valid_by_param.get("spo2_pct") else None
    if latest_co2 and latest_spo2:
        co2_comp = compare_to_baseline(latest_co2, metrics)
        spo2_comp = compare_to_baseline(latest_spo2, metrics)
        if co2_comp["outside_p05_p95_band"] and spo2_comp["outside_p05_p95_band"]:
            findings.append(
                {
                    "rule_id": "RULE-HYPOXIA-CO2-MULTI-02",
                    "rule_name": "Elevated Cabin CO2 with Reduced SpO2",
                    "severity": "HIGH",
                    "triggered": True,
                    "co2_mmhg": latest_co2.value,
                    "spo2_pct": latest_spo2.value,
                    "prototype_disclaimer": PROTOTYPE_DISCLAIMER,
                }
            )

    latest_rad = valid_by_param.get("radiation_msv_hr", [])[-1] if valid_by_param.get("radiation_msv_hr") else None
    if latest_rad and (latest_rad.value or 0.0) > float(metrics["radiation_msv_hr"]["p95"]):
        findings.append(
            {
                "rule_id": "RULE-RAD-EXPOSURE-03",
                "rule_name": "Ambient Radiation Above Personal 14-Day P95",
                "severity": "MODERATE",
                "triggered": True,
                "radiation_msv_hr": latest_rad.value,
                "prototype_disclaimer": PROTOTYPE_DISCLAIMER,
            }
        )

    latest_hr = valid_by_param.get("heart_rate_bpm", [])[-1] if valid_by_param.get("heart_rate_bpm") else None
    if latest_hr and compare_to_baseline(latest_hr, metrics)["outside_p05_p95_band"]:
        findings.append(
            {
                "rule_id": "RULE-CARDIO-TREND-01",
                "rule_name": "Heart Rate Outside Personal 14-Day P05-P95 Band",
                "severity": "MODERATE",
                "triggered": True,
                "heart_rate_bpm": latest_hr.value,
                "prototype_disclaimer": PROTOTYPE_DISCLAIMER,
            }
        )

    return findings


def validate_role_and_pin(
    operator_role: ActorRole,
    required_cmo: bool = False,
    auth_pin: Optional[str] = None,
) -> Tuple[bool, str]:
    """Fail-closed RBAC verification matching AEGIS-V security rules."""
    if operator_role == "MISSION_OBSERVER":
        return False, "Mission Observer is read-only and cannot modify clinical or incident state."
    if required_cmo:
        if operator_role != "CREW_MEDICAL_OFFICER":
            return False, "Action requires CREW_MEDICAL_OFFICER authority."
        if (auth_pin or "").strip() != CMO_AUTH_PIN:
            return False, "Valid CMO PIN authorization is required."
    return True, "Authorized."


def is_procedure_authorized(
    procedure_id: str,
    requires_cmo: bool,
    operator_role: ActorRole,
    cmo_available: bool,
) -> Dict[str, Any]:
    if requires_cmo and (not cmo_available or operator_role != "CREW_MEDICAL_OFFICER"):
        return {
            "allowed": False,
            "reason": "CMO-restricted step locked while CMO is unavailable or operator is non-CMO.",
        }
    if operator_role == "MISSION_OBSERVER":
        return {"allowed": False, "reason": "Mission Observer role is read-only."}
    return {"allowed": True, "reason": f"Procedure {procedure_id} authorized for crew Continuity."}


def build_earth_handoff_package(
    astronaut_id: str,
    astronaut_name: str,
    mission_name: str,
    observations: List[TelemetryObservation],
    earth_comms_available: bool,
    cmo_available: bool,
    operator_role: ActorRole,
    incident_title: str = "Active Crew Health Review",
) -> Dict[str, Any]:
    findings = evaluate_deterministic_rules(observations)
    missing_equip = [e["name"] for e in ONBOARD_MEDICAL_EQUIPMENT if e["operationalStatus"] == "UNAVAILABLE"]
    pkg_id = f"HANDOFF_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    md_lines = [
        f"# AEGIS-V Earth Handoff Package ({pkg_id})",
        f"- **Mission**: {mission_name}",
        f"- **Crew Member**: {astronaut_name} (`{astronaut_id}`)",
        f"- **Earth Comms**: {'AVAILABLE' if earth_comms_available else 'UNAVAILABLE (OFFLINE BUFFER)'}",
        f"- **CMO Status**: {'AVAILABLE' if cmo_available else 'UNAVAILABLE (CONTINUITY MODE)'}",
        f"- **Prepared By Role**: {operator_role}",
        f"- **Incident**: {incident_title}",
        f"- **Triggered Rules**: {', '.join(f['rule_id'] for f in findings) or 'None'}",
        f"- **Unavailable Equipment Gaps**: {', '.join(missing_equip) or 'None'}",
        "",
        f"> {PROTOTYPE_DISCLAIMER}",
    ]
    return {
        "packageId": pkg_id,
        "generatedAtIso": datetime.now(timezone.utc).isoformat(),
        "astronautId": astronaut_id,
        "findings": findings,
        "missingResources": missing_equip,
        "crewCount": len(CREW_ROSTER),
        "trackedParametersCount": len(ALL_18_PARAMETERS),
        "authorizedProceduresCount": len(AUTHORIZED_PROTOTYPE_PROCEDURES),
        "markdownDocument": "\n".join(md_lines),
    }
