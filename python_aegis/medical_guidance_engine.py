"""AEGIS-V Emergency Medical Guidance & First-Response Assistant in Python (non-diagnostic)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from .contracts import (
    GUIDANCE_CATEGORIES,
    MedicalGuidanceScreenInput,
    ONBOARD_MEDICAL_EQUIPMENT,
    RED_FLAG_SIGNS,
)

SAFE_PROTOCOLS: Dict[str, Dict[str, Any]] = {
    "PROTO-URGENT-AIRWAY-UNRESPONSIVE": {
        "protocolId": "PROTO-URGENT-AIRWAY-UNRESPONSIVE",
        "title": "Urgent Airway, Breathing & Unresponsive Crew Support",
        "urgency": "URGENT",
        "cmoRequired": False,
        "equipmentIds": ["EQ-PULSE-OX-01", "EQ-PBA-O2-01"],
        "steps": [
            "Ensure scene safety (check for smoke, toxic fumes, or cabin leak before approaching).",
            "Tap shoulders and shout clearly; check normal breathing for up to 10 seconds.",
            "Trigger Crew Emergency Escalation immediately and prepare rescue breathing / O2 mask.",
        ],
    },
    "PROTO-URGENT-BLEEDING": {
        "protocolId": "PROTO-URGENT-BLEEDING",
        "title": "Direct Pressure & Severe Bleeding Control",
        "urgency": "URGENT",
        "cmoRequired": False,
        "equipmentIds": ["EQ-TRAUMA-BLEED-01"],
        "steps": [
            "Open Trauma Pack (Crew Health Bay Drawer B1) and apply firm continuous direct pressure with sterile gauze.",
            "Do not remove soaked gauze; add fresh layers on top and secure firmly with elastic wrap.",
            "Monitor consciousness and pulse oximeter readings while escalating to responder / Earth Flight Surgeon.",
        ],
    },
    "PROTO-MINOR-CUT-CLEANING": {
        "protocolId": "PROTO-MINOR-CUT-CLEANING",
        "title": "Minor Wound Cleaning & Microgravity Containment Dressing",
        "urgency": "ROUTINE",
        "cmoRequired": False,
        "equipmentIds": ["EQ-TRAUMA-BLEED-01"],
        "steps": [
            "Wash hands or put on sterile nitrile gloves; capture any floating droplets with gauze.",
            "Irrigate wound gently with sterile saline wipe and apply clean adhesive dressing.",
            "Log wound check in Daily Check-In and inspect in 12 hours for redness or warmth.",
        ],
    },
    "PROTO-DIZZINESS-CO2-HYDRATION": {
        "protocolId": "PROTO-DIZZINESS-CO2-HYDRATION",
        "title": "Seated Rest, CO2 Verification & Oral Hydration Check",
        "urgency": "ELEVATED",
        "cmoRequired": False,
        "equipmentIds": ["EQ-PULSE-OX-01", "EQ-CDRA-BYPASS-KIT"],
        "steps": [
            "Rest in seated/stabilized restraint and attach pulse oximeter (target normal SpO2 >= 95%).",
            "Inspect Node 3 cabin CO2 monitor and verify intermodule ventilation airflow.",
            "Sip 250 mL oral hydration if alert and monitor for worsening headache or neurological red flags.",
        ],
    },
}


def evaluate_emergency_screening(intake: MedicalGuidanceScreenInput) -> Dict[str, Any]:
    reasons: List[str] = []
    if intake.urgent_bypass_triggered:
        reasons.append("Urgent Emergency action triggered by crew operator.")
    if intake.conscious in ("NO", "UNSURE"):
        reasons.append("Consciousness is absent or unsure.")
    if intake.breathing_normally in ("NO", "UNSURE"):
        reasons.append("Breathing is abnormal or unsure.")
    if intake.severe_bleeding == "YES":
        reasons.append("Severe bleeding reported.")
    if intake.selected_red_flags:
        reasons.append(f"{len(intake.selected_red_flags)} red-flag sign(s) selected.")

    is_emergency = len(reasons) > 0
    return {
        "isEmergency": is_emergency,
        "priorityLevel": "URGENT_RED_FLAG" if is_emergency else "STANDARD_GUIDANCE",
        "escalationRequired": is_emergency,
        "reasons": reasons,
        "nonDiagnosticNotice": "Decision-support guidance only — does not diagnose conditions or prescribe controlled drugs.",
    }


def resolve_protocol_for_intake(intake: MedicalGuidanceScreenInput) -> Dict[str, Any]:
    screening = evaluate_emergency_screening(intake)
    cats = set(intake.selected_categories)
    flags = set(intake.selected_red_flags)

    if intake.conscious in ("NO", "UNSURE") or "UNCONSCIOUS_UNRESPONSIVE" in flags:
        proto = SAFE_PROTOCOLS["PROTO-URGENT-AIRWAY-UNRESPONSIVE"]
    elif intake.severe_bleeding == "YES" or "BLEEDING" in cats or "SEVERE_UNCONTROLLED_BLEEDING" in flags:
        proto = SAFE_PROTOCOLS["PROTO-URGENT-BLEEDING"]
    elif "CUTS_WOUNDS" in cats or "BRUISES" in cats:
        proto = SAFE_PROTOCOLS["PROTO-MINOR-CUT-CLEANING"]
    elif "DIZZINESS_FAINTING" in cats or "SEVERE_HEADACHE" in cats or "TOXIC_ATMOSPHERE" in cats:
        proto = SAFE_PROTOCOLS["PROTO-DIZZINESS-CO2-HYDRATION"]
    elif screening["isEmergency"]:
        proto = SAFE_PROTOCOLS["PROTO-URGENT-AIRWAY-UNRESPONSIVE"]
    else:
        return {
            "matched": False,
            "protocol": None,
            "refusalNotice": "No matching verified onboard protocol found for unverified input; refusing to fabricate medical steps or drug dosages. Escalate to CMO or Earth Flight Surgeon.",
            "screening": screening,
        }

    return {
        "matched": True,
        "protocol": proto,
        "refusalNotice": None,
        "screening": screening,
        "createdAtIso": datetime.now(timezone.utc).isoformat(),
    }


def search_guidance_library(query: str = "") -> Dict[str, Any]:
    q = query.strip().lower()
    matched_cats = [
        c
        for c in GUIDANCE_CATEGORIES
        if not q or q in c["label"].lower() or any(q in kw for kw in c["keywords"])
    ]
    matched_protocols = [
        p
        for p in SAFE_PROTOCOLS.values()
        if not q or q in p["title"].lower() or any(q in step.lower() for step in p["steps"])
    ]
    return {
        "categories": matched_cats,
        "protocols": matched_protocols,
        "redFlagsCount": len(RED_FLAG_SIGNS),
        "equipment": ONBOARD_MEDICAL_EQUIPMENT,
    }
