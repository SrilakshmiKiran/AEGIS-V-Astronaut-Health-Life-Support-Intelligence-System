"""Canonical data contracts, parameter baselines, crew capabilities, and medical guidance catalog in Python."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional

ActorRole = Literal["CREW_MEDICAL_OFFICER", "CREW_MEMBER", "MISSION_OBSERVER"]
QualityStatus = Literal["VALID", "ESTIMATED", "MISSING", "STALE", "IMPOSSIBLE", "CORRUPTED"]
DataSourceType = Literal["SIMULATED", "VERIFIED_DEVICE", "MANUAL_ENTRY", "IMPORTED_RECORD"]
IncidentState = Literal[
    "DETECTED",
    "REVIEWED",
    "ACKNOWLEDGED",
    "RESPONSE_RECORDED",
    "MONITORING",
    "CLOSED_RETAINED",
]
FreshnessStatus = Literal["CURRENT", "AGING", "STALE", "UNAVAILABLE"]

CORE_8_PARAMETERS: List[str] = [
    "heart_rate_bpm",
    "spo2_pct",
    "systolic_bp_mmhg",
    "diastolic_bp_mmhg",
    "skin_temp_c",
    "respiration_rpm",
    "radiation_msv_hr",
    "cabin_co2_mmhg",
]

ALL_18_PARAMETERS: List[str] = CORE_8_PARAMETERS + [
    "sleep_duration_hrs",
    "sleep_quality_score",
    "exercise_completion_pct",
    "fatigue_score",
    "visual_symptom_severity",
    "intraocular_pressure_mmhg",
    "thigh_cuff_adherence_pct",
    "caloric_intake_kcal",
    "hydration_ml",
    "appetite_score",
]

PARAMETER_METADATA: Dict[str, Dict[str, Any]] = {
    "heart_rate_bpm": {"label": "Heart Rate", "shortLabel": "HR", "unit": "bpm", "category": "CORE_VITAL", "decimals": 1},
    "spo2_pct": {"label": "Blood Oxygen (SpO2)", "shortLabel": "SpO2", "unit": "%", "category": "CORE_VITAL", "decimals": 1},
    "systolic_bp_mmhg": {"label": "Systolic Blood Pressure", "shortLabel": "Sys BP", "unit": "mmHg", "category": "CORE_VITAL", "decimals": 0},
    "diastolic_bp_mmhg": {"label": "Diastolic Blood Pressure", "shortLabel": "Dia BP", "unit": "mmHg", "category": "CORE_VITAL", "decimals": 0},
    "skin_temp_c": {"label": "Skin Temperature", "shortLabel": "Skin Temp", "unit": "degC", "category": "CORE_VITAL", "decimals": 2},
    "respiration_rpm": {"label": "Respiration Rate", "shortLabel": "Resp Rate", "unit": "rpm", "category": "CORE_VITAL", "decimals": 1},
    "radiation_msv_hr": {"label": "Radiation Level", "shortLabel": "Radiation", "unit": "mSv/hr", "category": "CORE_ENV", "decimals": 3},
    "cabin_co2_mmhg": {"label": "Cabin CO2 Level", "shortLabel": "Cabin CO2", "unit": "mmHg", "category": "CORE_ENV", "decimals": 2},
    "sleep_duration_hrs": {"label": "Sleep Duration", "shortLabel": "Sleep", "unit": "hrs", "category": "HRP_SLEEP", "decimals": 1},
    "sleep_quality_score": {"label": "Sleep Quality Score", "shortLabel": "Sleep Qual", "unit": "score_1_10", "category": "HRP_SLEEP", "decimals": 1},
    "exercise_completion_pct": {"label": "Exercise Completion", "shortLabel": "Exercise", "unit": "%", "category": "HRP_SLEEP", "decimals": 0},
    "fatigue_score": {"label": "Fatigue Score", "shortLabel": "Fatigue", "unit": "score_1_10", "category": "HRP_SLEEP", "decimals": 1},
    "visual_symptom_severity": {"label": "Visual Symptom Severity", "shortLabel": "Visual Symp", "unit": "score_0_10", "category": "HRP_FLUID", "decimals": 1},
    "intraocular_pressure_mmhg": {"label": "Intraocular Pressure (IOP)", "shortLabel": "IOP", "unit": "mmHg", "category": "HRP_FLUID", "decimals": 1},
    "thigh_cuff_adherence_pct": {"label": "Thigh Cuff Adherence", "shortLabel": "Thigh Cuff", "unit": "%", "category": "HRP_FLUID", "decimals": 0},
    "caloric_intake_kcal": {"label": "Caloric Intake", "shortLabel": "Calories", "unit": "kcal", "category": "HRP_NUTRITION", "decimals": 0},
    "hydration_ml": {"label": "Hydration Intake", "shortLabel": "Hydration", "unit": "mL", "category": "HRP_NUTRITION", "decimals": 0},
    "appetite_score": {"label": "Appetite Score", "shortLabel": "Appetite", "unit": "score_1_10", "category": "HRP_NUTRITION", "decimals": 1},
}

DEFAULT_BASELINE_METRICS: Dict[str, Dict[str, Any]] = {
    "heart_rate_bpm": {"mean": 68.0, "std": 4.5, "p05": 60.6, "p95": 75.4, "sample_count": 336, "unit": "bpm", "authorized_target": None},
    "spo2_pct": {"mean": 97.8, "std": 0.8, "p05": 96.2, "p95": 99.1, "sample_count": 336, "unit": "%", "authorized_target": None},
    "systolic_bp_mmhg": {"mean": 116.0, "std": 5.0, "p05": 107.8, "p95": 124.2, "sample_count": 168, "unit": "mmHg", "authorized_target": None},
    "diastolic_bp_mmhg": {"mean": 74.0, "std": 4.0, "p05": 67.4, "p95": 80.6, "sample_count": 168, "unit": "mmHg", "authorized_target": None},
    "skin_temp_c": {"mean": 34.4, "std": 0.4, "p05": 33.7, "p95": 35.1, "sample_count": 336, "unit": "degC", "authorized_target": None},
    "respiration_rpm": {"mean": 15.0, "std": 1.6, "p05": 12.4, "p95": 17.6, "sample_count": 336, "unit": "rpm", "authorized_target": None},
    "radiation_msv_hr": {"mean": 0.018, "std": 0.005, "p05": 0.010, "p95": 0.028, "sample_count": 336, "unit": "mSv/hr", "authorized_target": None},
    "cabin_co2_mmhg": {"mean": 2.4, "std": 0.35, "p05": 1.8, "p95": 3.0, "sample_count": 336, "unit": "mmHg", "authorized_target": None},
    "sleep_duration_hrs": {"mean": 7.1, "std": 0.5, "p05": 6.3, "p95": 7.9, "sample_count": 14, "unit": "hrs", "authorized_target": 7.5},
    "sleep_quality_score": {"mean": 7.6, "std": 0.8, "p05": 6.2, "p95": 9.0, "sample_count": 14, "unit": "score_1_10", "authorized_target": 8.0},
    "exercise_completion_pct": {"mean": 92.0, "std": 6.0, "p05": 82.0, "p95": 100.0, "sample_count": 14, "unit": "%", "authorized_target": 90.0},
    "fatigue_score": {"mean": 3.1, "std": 0.9, "p05": 1.6, "p95": 4.6, "sample_count": 14, "unit": "score_1_10", "authorized_target": 3.0},
    "visual_symptom_severity": {"mean": 0.8, "std": 0.6, "p05": 0.0, "p95": 1.9, "sample_count": 14, "unit": "score_0_10", "authorized_target": 0.0},
    "intraocular_pressure_mmhg": {"mean": 14.5, "std": 1.0, "p05": 12.8, "p95": 16.2, "sample_count": 14, "unit": "mmHg", "authorized_target": 15.0},
    "thigh_cuff_adherence_pct": {"mean": 94.0, "std": 5.0, "p05": 85.0, "p95": 100.0, "sample_count": 14, "unit": "%", "authorized_target": 90.0},
    "caloric_intake_kcal": {"mean": 2550.0, "std": 160.0, "p05": 2280.0, "p95": 2820.0, "sample_count": 14, "unit": "kcal", "authorized_target": 2600.0},
    "hydration_ml": {"mean": 2450.0, "std": 210.0, "p05": 2100.0, "p95": 2800.0, "sample_count": 14, "unit": "mL", "authorized_target": 2500.0},
    "appetite_score": {"mean": 7.8, "std": 0.8, "p05": 6.4, "p95": 9.1, "sample_count": 14, "unit": "score_1_10", "authorized_target": 8.0},
}

AUTHORIZED_PROTOTYPE_PROCEDURES: Dict[str, str] = {
    "PROC-ENV-CO2-01": "Cabin CO2 Scrubber Bypass Check & Seated Crew Rest Monitoring",
    "PROC-CARDIO-REST-02": "Scheduled Exertion Pause, Oral Hydration & 15-Min Repeat Bio-Monitor Check",
    "PROC-RAD-SHELTER-03": "Storm Shelter Dosimetry Verification & Habitat Shielding Check",
    "PROC-HRP-WELLNESS-04": "Crew Schedule Workload Adjustment, Thigh-Cuff Protocol Review & Nutrition/Hydration Check",
}

SUBJECTIVE_CHECKIN_LABELS: Dict[str, str] = {
    "FEEL_NORMAL": "I feel normal.",
    "SOMETHING_DIFFERENT": "Something feels different.",
    "WORSE_THAN_USUAL": "I feel worse than usual.",
    "NEED_ASSISTANCE": "I need assistance.",
}

CREW_ROSTER: List[Dict[str, Any]] = [
    {"crewId": "AST-01-COMMANDER", "name": "Cdr. Elena Vance", "role": "Commander", "medicalTier": "CREW_FIRST_RESPONDER"},
    {"crewId": "AST-02-FE-PILOT", "name": "Dr. Aris Chen", "role": "Crew Medical Officer", "medicalTier": "CMO_QUALIFIED"},
    {"crewId": "AST-03-SPECIALIST", "name": "Lt. Mateo Silva", "role": "EVA & Habitat Specialist", "medicalTier": "NON_MEDICAL_SPECIALIST"},
    {"crewId": "AST-04-SCIENTIST", "name": "Dr. Priya Nair", "role": "Payload & Bio Specialist", "medicalTier": "CREW_FIRST_RESPONDER"},
]

ONBOARD_MEDICAL_EQUIPMENT: List[Dict[str, Any]] = [
    {"equipmentId": "EQ-PULSE-OX-01", "name": "Wearable Bio-Harness & Dual Finger Pulse Oximeter", "category": "RESPIRATORY_MEDICAL", "operationalStatus": "OPERATIONAL", "location": "US Lab Medical Locker A2"},
    {"equipmentId": "EQ-CDRA-BYPASS-KIT", "name": "Portable CO2 Monitor & CDRA Fan Airflow Gauge", "category": "ENVIRONMENTAL", "operationalStatus": "OPERATIONAL", "location": "Node 3 ECLSS Bay"},
    {"equipmentId": "EQ-PBA-O2-01", "name": "Portable Breathing Apparatus (PBA) & Oxygen Mask", "category": "FIRE_PRESSURE", "operationalStatus": "OPERATIONAL", "location": "Airlock Hatch Locker 1"},
    {"equipmentId": "EQ-TRAUMA-BLEED-01", "name": "Orbital Trauma, Dressing & Hemorrhage Control Pack", "category": "RESPIRATORY_MEDICAL", "operationalStatus": "OPERATIONAL", "location": "Crew Health Bay Drawer B1"},
    {"equipmentId": "EQ-ULTRASOUND-01", "name": "Handheld Crew Ultrasound & Tonometry Kit", "category": "DIAGNOSTIC", "operationalStatus": "LIMITED", "location": "US Lab Rack 4"},
    {"equipmentId": "EQ-CAPNOGRAPHY-01", "name": "End-Tidal CO2 Capnography Sensor Module", "category": "DIAGNOSTIC", "operationalStatus": "UNAVAILABLE", "location": "Unavailable — calibration expired"},
]

GUIDANCE_CATEGORIES: List[Dict[str, Any]] = [
    # 8 Injuries
    {"id": "CUTS_WOUNDS", "group": "INJURIES", "label": "Cuts and wounds", "keywords": ["cut", "wound", "scrape", "laceration", "gauze"]},
    {"id": "BLEEDING", "group": "INJURIES", "label": "Bleeding", "keywords": ["bleeding", "blood", "hemorrhage", "pressure", "gash"], "red_flag_eligible": True},
    {"id": "BURNS", "group": "INJURIES", "label": "Burns", "keywords": ["burn", "scald", "thermal", "hydrogel"], "red_flag_eligible": True},
    {"id": "BRUISES", "group": "INJURIES", "label": "Bruises", "keywords": ["bruise", "contusion", "impact", "swelling"]},
    {"id": "SUSPECTED_FRACTURES", "group": "INJURIES", "label": "Suspected fractures", "keywords": ["fracture", "broken", "bone", "splint"], "red_flag_eligible": True},
    {"id": "SPRAINS", "group": "INJURIES", "label": "Sprains", "keywords": ["sprain", "strain", "joint", "ankle", "wrist"]},
    {"id": "EYE_INJURIES", "group": "INJURIES", "label": "Eye injuries", "keywords": ["eye", "debris", "eyewash", "vision"], "red_flag_eligible": True},
    {"id": "HEAD_INJURIES", "group": "INJURIES", "label": "Head injuries", "keywords": ["head", "concussion", "bump", "confused"], "red_flag_eligible": True},
    # 8 Sudden health problems
    {"id": "BREATHING_DIFFICULTIES", "group": "SUDDEN_HEALTH", "label": "Breathing difficulties", "keywords": ["breathing", "breath", "spo2", "oxygen", "choking"], "red_flag_eligible": True},
    {"id": "CHEST_DISCOMFORT", "group": "SUDDEN_HEALTH", "label": "Chest discomfort", "keywords": ["chest", "heart", "pressure", "tightness"], "red_flag_eligible": True},
    {"id": "DIZZINESS_FAINTING", "group": "SUDDEN_HEALTH", "label": "Dizziness or fainting", "keywords": ["dizzy", "faint", "vertigo", "lightheaded"], "red_flag_eligible": True},
    {"id": "SEVERE_HEADACHE", "group": "SUDDEN_HEALTH", "label": "Severe headache", "keywords": ["headache", "migraine", "co2"], "red_flag_eligible": True},
    {"id": "NAUSEA_VOMITING", "group": "SUDDEN_HEALTH", "label": "Nausea and vomiting", "keywords": ["nausea", "vomit", "emesis"]},
    {"id": "ABDOMINAL_PAIN", "group": "SUDDEN_HEALTH", "label": "Abdominal pain", "keywords": ["abdomen", "stomach", "belly", "cramp"], "red_flag_eligible": True},
    {"id": "ALLERGIC_REACTIONS", "group": "SUDDEN_HEALTH", "label": "Allergic reactions", "keywords": ["allergy", "hive", "swelling", "throat"], "red_flag_eligible": True},
    {"id": "FEVER_INFECTION", "group": "SUDDEN_HEALTH", "label": "Fever or suspected infection", "keywords": ["fever", "infection", "temp", "chills"]},
    # 6 Spaceflight-specific concerns
    {"id": "SPACE_MOTION_SICKNESS", "group": "SPACEFLIGHT", "label": "Space motion sickness", "keywords": ["motion", "vestibular", "floating", "spin"]},
    {"id": "FLUID_SHIFTS_VISUAL", "group": "SPACEFLIGHT", "label": "Fluid shifts and visual symptoms", "keywords": ["fluid", "sans", "iop", "blurred"]},
    {"id": "DECOMPRESSION_CONCERNS", "group": "SPACEFLIGHT", "label": "Decompression-related concerns", "keywords": ["decompression", "dcs", "eva", "pressure"], "red_flag_eligible": True},
    {"id": "RADIATION_EXPOSURE", "group": "SPACEFLIGHT", "label": "Radiation exposure concerns", "keywords": ["radiation", "solar", "dosimeter", "shelter"]},
    {"id": "TOXIC_ATMOSPHERE", "group": "SPACEFLIGHT", "label": "Possible toxic atmosphere exposure", "keywords": ["toxic", "smoke", "fire", "co2", "ammonia"], "red_flag_eligible": True},
    {"id": "HEAT_COLD_EMERGENCIES", "group": "SPACEFLIGHT", "label": "Heat or cold-related emergencies", "keywords": ["heat", "cold", "thermal", "overheat", "hypothermia"], "red_flag_eligible": True},
]

RED_FLAG_SIGNS: List[Dict[str, str]] = [
    {"id": "UNCONSCIOUS_UNRESPONSIVE", "label": "Unconsciousness or unresponsiveness"},
    {"id": "ABNORMAL_ABSENT_BREATHING", "label": "Abnormal or absent breathing"},
    {"id": "SEVERE_UNCONTROLLED_BLEEDING", "label": "Severe or uncontrolled bleeding"},
    {"id": "CHEST_PAIN_PRESSURE", "label": "Chest pain or pressure"},
    {"id": "NEURO_STROKE_SIGNS", "label": "Confusion, slurred speech, or sudden weakness"},
    {"id": "SEVERE_ALLERGIC_SWELLING", "label": "Face, lip, or throat swelling"},
    {"id": "HEAD_NECK_SPINE_TRAUMA", "label": "Severe head, neck, or spine injury"},
    {"id": "TOXIC_EXPOSURE_DEPRESSURIZATION", "label": "Toxic smoke/gas or cabin depressurization"},
    {"id": "DCS_POST_EVA_NEURO", "label": "Post-EVA neurological or joint bends symptoms"},
    {"id": "PROGRESSIVELY_WORSENING", "label": "Symptoms rapidly getting worse"},
]


@dataclass
class TelemetryObservation:
    observation_id: str
    astronaut_id: str
    timestamp: str
    parameter: str
    value: Optional[float]
    unit: str
    source_type: DataSourceType = "SIMULATED"
    device_id: Optional[str] = None
    device_hmac_verified: bool = True
    info_label: str = "MEASURED"
    quality_status: QualityStatus = "VALID"
    quality_notes: str = ""
    reference_target: Optional[float] = None
    is_quarantined: bool = False


@dataclass
class AuditLogEntry:
    log_id: str
    incident_id: str
    timestamp: str
    from_state: str
    to_state: str
    actor_id: str
    actor_role: ActorRole
    notes: str
    prev_hash: str
    entry_hash: str = ""


@dataclass
class EclssSnapshot:
    cabin_pressure_kpa: float = 101.3
    cabin_pressure_rate_kpa_hr: float = 0.0
    pp_o2_mmhg: float = 159.0
    o2_supply_pct: float = 92.0
    smoke_fire_status: str = "CLEAR"
    contaminant_status: str = "NOMINAL"
    trace_co_ppm: float = 1.2
    ventilation_status: str = "NOMINAL_FLOW"
    life_support_health_status: str = "OPERATIONAL"
    scrubber_bed_pct: int = 88
    env_data_source: DataSourceType = "SIMULATED"


@dataclass
class MedicalGuidanceScreenInput:
    what_happened: str = ""
    who_needs_help: Literal["ME", "ANOTHER_CREW_MEMBER"] = "ME"
    subject_crew_id: str = "AST-01-COMMANDER"
    conscious: Literal["YES", "NO", "UNSURE"] = "YES"
    breathing_normally: Literal["YES", "NO", "UNSURE"] = "YES"
    severe_bleeding: Literal["YES", "NO", "UNSURE"] = "NO"
    when_began: str = "Just now (< 10 min)"
    selected_categories: List[str] = field(default_factory=list)
    selected_red_flags: List[str] = field(default_factory=list)
    urgent_bypass_triggered: bool = False
