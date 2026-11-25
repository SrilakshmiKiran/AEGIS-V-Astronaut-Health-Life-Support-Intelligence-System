"""AEGIS Life-Safety Sentinel Python engine: 8-channel ECLSS monitoring, check-in watch & escalation."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from .contracts import EclssSnapshot, ONBOARD_MEDICAL_EQUIPMENT


def evaluate_environment_life_safety(
    eclss: EclssSnapshot,
    solar_storm_active: bool = False,
) -> Dict[str, Any]:
    findings: List[Dict[str, str]] = []

    def add(fid: str, label: str, val_text: str, severity: str, msg: str) -> None:
        findings.append(
            {
                "id": fid,
                "parameterLabel": label,
                "currentText": val_text,
                "severity": severity,
                "sourceMode": eclss.env_data_source,
                "message": msg,
            }
        )

    # 1. Cabin Total Pressure
    kpa = eclss.cabin_pressure_kpa
    kpa_sev = "URGENT" if kpa < 94.0 else ("ADVISORY" if kpa < 98.5 or kpa > 103.5 else "NOMINAL")
    add("ENV-PRESSURE", "Cabin Total Pressure", f"{kpa:.1f} kPa", kpa_sev, "Cabin pressure check")

    # 2. Cabin Pressure-Loss Rate
    rate = eclss.cabin_pressure_rate_kpa_hr
    rate_sev = "URGENT" if rate <= -0.5 else ("ADVISORY" if rate <= -0.15 else "NOMINAL")
    add("ENV-PRESSURE-RATE", "Cabin Pressure-Loss Rate", f"{rate:+.2f} kPa/hr", rate_sev, "Leak rate monitor")

    # 3. Oxygen Partial Pressure
    ppo2 = eclss.pp_o2_mmhg
    ppo2_sev = "URGENT" if ppo2 < 142 or ppo2 > 178 else ("ADVISORY" if ppo2 < 148 or ppo2 > 172 else "NOMINAL")
    add("ENV-PPO2", "Oxygen Partial Pressure (ppO2)", f"{ppo2:.1f} mmHg", ppo2_sev, "ppO2 target 148-172 mmHg")

    # 4. Oxygen Supply Reserve
    o2_sev = "URGENT" if eclss.o2_supply_pct < 35 else ("ADVISORY" if eclss.o2_supply_pct < 60 else "NOMINAL")
    add("ENV-O2-SUPPLY", "Oxygen Supply Reserve", f"{eclss.o2_supply_pct:.0f}% reserve", o2_sev, "O2 tank status")

    # 5. Smoke / Fire Detector
    smoke_map = {"ALARM": "URGENT", "SENSOR_FAULT": "FAULT", "ADVISORY": "ADVISORY", "CLEAR": "NOMINAL"}
    add("ENV-SMOKE-FIRE", "Smoke / Fire Detector Status", eclss.smoke_fire_status, smoke_map.get(eclss.smoke_fire_status, "ADVISORY"), "Optical & thermal detector")

    # 6. Atmospheric Contaminants
    contam_sev = (
        "URGENT"
        if eclss.contaminant_status == "CRITICAL_TOXIC" or eclss.trace_co_ppm >= 9.0
        else (
            "FAULT"
            if eclss.contaminant_status == "SENSOR_FAULT"
            else ("ADVISORY" if eclss.contaminant_status == "ELEVATED_TRACE" or eclss.trace_co_ppm >= 5.0 else "NOMINAL")
        )
    )
    add("ENV-CONTAMINANTS", "Atmospheric Contaminants & Trace CO", f"{eclss.contaminant_status} · CO {eclss.trace_co_ppm:.1f} ppm", contam_sev, "Trace contaminant control")

    # 7. Ventilation
    vent_sev = "FAULT" if eclss.ventilation_status == "FAN_FAULT" else ("ADVISORY" if eclss.ventilation_status in ("REDUCED_FLOW", "BYPASS_ACTIVE") else "NOMINAL")
    add("ENV-VENTILATION", "Ventilation System Status", eclss.ventilation_status, vent_sev, "Cabin airflow status")

    # 8. Life-Support Equipment Health
    sys_sev = "URGENT" if eclss.life_support_health_status == "FAULT_DETECTED" else ("FAULT" if eclss.life_support_health_status == "OFFLINE_UNVERIFIED" else ("ADVISORY" if eclss.life_support_health_status == "DEGRADED_ADVISORY" else "NOMINAL"))
    add("ENV-SYSTEM-HEALTH", "Life-Support Equipment Health", f"{eclss.life_support_health_status} · Scrubber {eclss.scrubber_bed_pct}%", sys_sev, "ECLSS subsystem health")

    levels = [f["severity"] for f in findings]
    overall = "URGENT" if ("URGENT" in levels or solar_storm_active) else ("FAULT" if "FAULT" in levels else ("ADVISORY" if "ADVISORY" in levels else "NOMINAL"))
    return {
        "overallLevel": overall,
        "findings": findings,
        "solarStormActive": solar_storm_active,
        "evaluatedAtIso": datetime.now(timezone.utc).isoformat(),
    }


def evaluate_checkin_schedule(
    last_checkin_iso: str,
    now_iso: str,
    interval_minutes: int = 720,
    grace_minutes: int = 60,
) -> Dict[str, Any]:
    last_dt = datetime.fromisoformat(last_checkin_iso.replace("Z", "+00:00"))
    now_dt = datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
    elapsed_min = max(0.0, (now_dt - last_dt).total_seconds() / 60.0)
    if elapsed_min >= interval_minutes + grace_minutes:
        status = "MISSED_OVERDUE"
        headline = f"Scheduled check-in OVERDUE by {int(elapsed_min - interval_minutes)} min"
    elif elapsed_min >= interval_minutes:
        status = "REMINDER_DUE"
        headline = "Scheduled crew check-in DUE now"
    else:
        status = "ON_SCHEDULE"
        headline = f"Check-in on schedule ({int(interval_minutes - elapsed_min)} min remaining)"
    return {
        "statusCode": status,
        "headline": headline,
        "elapsedMinutes": round(elapsed_min, 1),
    }


def filter_emergency_resources(search_term: str = "", available_only: bool = False) -> List[Dict[str, Any]]:
    q = search_term.strip().lower()
    results: List[Dict[str, Any]] = []
    for item in ONBOARD_MEDICAL_EQUIPMENT:
        if available_only and item["operationalStatus"] == "UNAVAILABLE":
            continue
        if q and q not in item["name"].lower() and q not in item["location"].lower() and q not in item["category"].lower():
            continue
        results.append(item)
    return results
