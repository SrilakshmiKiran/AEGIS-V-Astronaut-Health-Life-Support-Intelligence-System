export type ActivityMode =
  | "RESTING"
  | "SLEEPING"
  | "EXERCISE_ARED"
  | "EVA"
  | "DOCKING";

export type LightDelayMode = "LEO_0S" | "LUNAR_3S" | "MARS_14M";

export type OpsRecordType =
  | "CREW_PROFILE"
  | "MED_LOG"
  | "EVA_SESSION"
  | "PVT_COGNITIVE"
  | "CONSULT_MSG"
  | "CHECKLIST_LOG"
  | "VOICE_MEMO"
  | "BIO_EXTENDED"
  | "GAMIFICATION_ROUTINE";

export type MissionEnvironmentId =
  | "ISS_LEO"
  | "TRANSIT_SPACECRAFT"
  | "LUNAR_BASE"
  | "MARS_ROVER";

export type BodyRegionId =
  | "brain"
  | "eyes"
  | "heart"
  | "lungs"
  | "bones_muscle"
  | "kidneys_fluids"
  | "skin_immune";

export interface DiagnosticScanEntry {
  scanId: string;
  ownerId: string;
  crewId: string;
  bodyRegion: BodyRegionId;
  modality: "CAMERA_PHOTO" | "OCULAR_SCAN" | "ULTRASOUND" | "SKIN_CHECK";
  caption: string;
  mimeType: string;
  sizeBytes: number;
  createdAtIso: string;
}

export interface ExtendedBioSummary {
  bloodGlucoseMgDl: number;
  coreTempC: number;
  notes: string;
  recordedAtIso: string;
}

export interface RoutineGamificationState {
  environmentMode: MissionEnvironmentId;
  completedDateUtc: string;
  completedTaskIds: string[];
  streakDays: number;
  readinessPoints: number;
  earnedBadges: string[];
  onboardingCompleted: boolean;
}

export interface VoiceMemoEntry {
  memoId: string;
  ownerId: string;
  crewId: string;
  observationGroup: "SLEEP_ENERGY" | "EYE_FLUID" | "FOOD_HYDRATION" | "GENERAL_CHECKIN";
  parameterLabel: string;
  durationSec: number;
  mimeType: string;
  sizeBytes: number;
  note: string;
  createdAtIso: string;
}

export type EnvDataSourceMode =
  | "SIMULATED"
  | "IMPORTED_RECORD"
  | "MANUAL_ENTRY"
  | "VERIFIED_DEVICE";

export type EnvSmokeFireStatus = "CLEAR" | "ADVISORY" | "ALARM" | "SENSOR_FAULT";
export type EnvContaminantStatus =
  | "NOMINAL"
  | "ELEVATED_TRACE"
  | "CRITICAL_TOXIC"
  | "SENSOR_FAULT";
export type EnvVentilationStatus =
  | "NOMINAL_FLOW"
  | "REDUCED_FLOW"
  | "BYPASS_ACTIVE"
  | "FAN_FAULT";
export type EnvSystemHealthStatus =
  | "OPERATIONAL"
  | "DEGRADED_ADVISORY"
  | "FAULT_DETECTED"
  | "OFFLINE_UNVERIFIED";

export interface EclssSnapshot {
  ppO2MmHg: number;
  cabinPressureKpa: number;
  traceCoPpm: number;
  cabinTempC: number;
  relativeHumidityPct: number;
  potableWaterPpm: number;
  scrubberBedPct: number;
  cabinPressureRateKpaHr?: number;
  o2SupplyPct?: number;
  smokeFireStatus?: EnvSmokeFireStatus;
  contaminantStatus?: EnvContaminantStatus;
  ventilationStatus?: EnvVentilationStatus;
  lifeSupportHealthStatus?: EnvSystemHealthStatus;
  envDataSource?: EnvDataSourceMode;
  envSourceLabel?: string;
  envLastUpdatedIso?: string;
}

export interface OpsStateDoc {
  ownerId: string;
  activityMode: ActivityMode;
  activeCrewId: string;
  lightDelayMode: LightDelayMode;
  cumulativeRadiationMsv: number;
  solarStormActive: boolean;
  eclss: EclssSnapshot;
}

export interface OpsRecordDoc {
  ownerId: string;
  recordId: string;
  recordType: OpsRecordType;
  crewId: string;
  title: string;
  status: string;
  timestampIso: string;
  payload: Record<string, unknown>;
}

export interface CrewRosterMember {
  crewId: string;
  name: string;
  role: string;
  age: number;
  restingHrMean: number;
  statusNote: string;
  activeAlertCount: number;
}

export interface MedKitItem {
  itemId: string;
  name: string;
  category: "COUNTERMEASURE" | "MEDICATION" | "DIAGNOSTIC";
  dosageOrSchedule: string;
  stockQty: number;
  unit: string;
  expiresOn: string;
  lastTakenIso?: string;
}

export interface EvaSessionSummary {
  suitId: string;
  preBreatheTargetMin: number;
  preBreatheCompletedMin: number;
  suitPressureKpa: number;
  suitPpO2MmHg: number;
  suitCo2MmHg: number;
  batteryPct: number;
  sublimatorWaterPct: number;
  leakCheckPassed: boolean;
  dcsSymptomGrade: "NONE" | "MILD_JOINT" | "MODERATE_EVAL";
  notes: string;
}

export interface PvtResultSummary {
  meanRtMs: number;
  fastestRtMs: number;
  lapsesCount: number;
  trialsCount: number;
  moodScore: number;
  stressScore: number;
  orbitalCycleNote: string;
  journalNote: string;
}

export const ACTIVITY_MODE_META: Record<
  ActivityMode,
  {
    label: string;
    hrUpperToleranceBpm: number;
    spo2FloorPct: number;
    clinicalNote: string;
  }
> = {
  RESTING: {
    label: "Resting / Cabin Work",
    hrUpperToleranceBpm: 92,
    spo2FloorPct: 95.5,
    clinicalNote: "Standard resting personal baseline applies across all 18 channels.",
  },
  SLEEPING: {
    label: "Crew Sleep Period",
    hrUpperToleranceBpm: 76,
    spo2FloorPct: 95.0,
    clinicalNote: "Lower nocturnal heart rate expected; respiratory dips monitored closely.",
  },
  EXERCISE_ARED: {
    label: "ARED / Treadmill Exercise",
    hrUpperToleranceBpm: 162,
    spo2FloorPct: 93.5,
    clinicalNote:
      "Elevated heart rate (up to 162 bpm) and breathing rate are expected during countermeasure workout.",
  },
  EVA: {
    label: "EVA Spacewalk",
    hrUpperToleranceBpm: 152,
    spo2FloorPct: 94.0,
    clinicalNote:
      "Suit metabolic load elevates heart rate and respiration; monitor suit ppO2 and CO2 scrubber.",
  },
  DOCKING: {
    label: "Rendezvous & Docking Ops",
    hrUpperToleranceBpm: 118,
    spo2FloorPct: 95.0,
    clinicalNote: "Acute workload spikes normal; watch cognitive alertness and CO2 stability.",
  },
};

export const LIGHT_DELAY_META: Record<
  LightDelayMode,
  { label: string; oneWaySec: number; roundTripText: string }
> = {
  LEO_0S: {
    label: "Low Earth Orbit (ISS)",
    oneWaySec: 0,
    roundTripText: "Near real-time (< 1 sec)",
  },
  LUNAR_3S: {
    label: "Lunar Gateway / Orbit",
    oneWaySec: 1.5,
    roundTripText: "~3 sec round-trip",
  },
  MARS_14M: {
    label: "Mars Transit",
    oneWaySec: 860,
    roundTripText: "14m 20s one-way (async only)",
  },
};

export const DEFAULT_ECLSS: EclssSnapshot = {
  ppO2MmHg: 160.4,
  cabinPressureKpa: 101.2,
  traceCoPpm: 1.8,
  cabinTempC: 22.4,
  relativeHumidityPct: 46.0,
  potableWaterPpm: 0.4,
  scrubberBedPct: 84,
  cabinPressureRateKpaHr: 0.0,
  o2SupplyPct: 92,
  smokeFireStatus: "CLEAR",
  contaminantStatus: "NOMINAL",
  ventilationStatus: "NOMINAL_FLOW",
  lifeSupportHealthStatus: "OPERATIONAL",
  envDataSource: "SIMULATED",
  envSourceLabel: "Synthetic ECLSS Demo Stream (no spacecraft bus attached)",
  envLastUpdatedIso: "2026-11-15T00:00:00Z",
};

export const DEFAULT_OPS_STATE: Omit<OpsStateDoc, "ownerId"> = {
  activityMode: "RESTING",
  activeCrewId: "AST-01-COMMANDER",
  lightDelayMode: "LUNAR_3S",
  cumulativeRadiationMsv: 84.6,
  solarStormActive: false,
  eclss: DEFAULT_ECLSS,
};

export const SEEDED_CREW_ROSTER: CrewRosterMember[] = [
  {
    crewId: "AST-01-COMMANDER",
    name: "Cmdr. Elena Vance",
    role: "Mission Commander",
    age: 41,
    restingHrMean: 66,
    statusNote: "Primary baseline loaded",
    activeAlertCount: 1,
  },
  {
    crewId: "AST-02-FE-PILOT",
    name: "Dr. Aris Chen",
    role: "Flight Engineer & CMO",
    age: 38,
    restingHrMean: 61,
    statusNote: "ARED schedule current",
    activeAlertCount: 0,
  },
  {
    crewId: "AST-03-SPECIALIST",
    name: "Maya Lindqvist",
    role: "Payload & EVA Specialist",
    age: 35,
    restingHrMean: 64,
    statusNote: "EVA Suit EMU-204 assigned",
    activeAlertCount: 0,
  },
  {
    crewId: "AST-04-SCIENTIST",
    name: "Dr. Samira Patel",
    role: "Bioastronautics Lead",
    age: 39,
    restingHrMean: 69,
    statusNote: "Ocular ultrasound scheduled",
    activeAlertCount: 0,
  },
];

export const SEEDED_MED_KIT_ITEMS: MedKitItem[] = [
  {
    itemId: "MED_VIT_D3",
    name: "Vitamin D3 1000 IU",
    category: "COUNTERMEASURE",
    dosageOrSchedule: "1 capsule daily (bone & immune support)",
    stockQty: 142,
    unit: "caps",
    expiresOn: "2027-08",
  },
  {
    itemId: "MED_THIGH_CUFF",
    name: "Braslet-M Thigh Occlusion Cuffs",
    category: "COUNTERMEASURE",
    dosageOrSchedule: "Daily 4 hrs fluid-shift countermeasure",
    stockQty: 4,
    unit: "sets",
    expiresOn: "2028-11",
  },
  {
    itemId: "MED_ARTIFICIAL_TEARS",
    name: "Preservative-Free Ocular Drops",
    category: "MEDICATION",
    dosageOrSchedule: "1–2 drops PRN dry cabin eye irritation",
    stockQty: 18,
    unit: "vials",
    expiresOn: "2026-12",
  },
  {
    itemId: "MED_IBUPROFEN",
    name: "Ibuprofen 400 mg",
    category: "MEDICATION",
    dosageOrSchedule: "Max 1200 mg / 24h (post-EVA or CO2 headache)",
    stockQty: 48,
    unit: "tabs",
    expiresOn: "2027-04",
  },
  {
    itemId: "MED_MODAFINIL",
    name: "Modafinil 100 mg (CMO Controlled)",
    category: "MEDICATION",
    dosageOrSchedule: "Circadian shift / emergency fatigue only",
    stockQty: 12,
    unit: "tabs",
    expiresOn: "2027-09",
  },
  {
    itemId: "MED_POTASSIUM_CITRATE",
    name: "Potassium Citrate 20 mEq",
    category: "COUNTERMEASURE",
    dosageOrSchedule: "Daily renal stone prophylaxis",
    stockQty: 86,
    unit: "tabs",
    expiresOn: "2027-06",
  },
];

export const DIAGNOSTIC_PRESET_CAPTURES: Array<{
  id: string;
  label: string;
  summary: string;
  svgPreviewKind: "FUNDOSCOPE" | "ECG" | "ULTRASOUND";
}> = [
  {
    id: "CAP_FUNDOSCOPE_OD",
    label: "Fundoscope Photo — Right Eye (SANS Check)",
    summary: "Optic disc margin trace · mild Grade-1 choroidal fold review requested.",
    svgPreviewKind: "FUNDOSCOPE",
  },
  {
    id: "CAP_ECG_LEAD_II",
    label: "12-Sec Lead II ECG Strip (Bio-Monitor)",
    summary: "Sinus rhythm 78 bpm · normal PR/QRS intervals captured during CO2 drift.",
    svgPreviewKind: "ECG",
  },
  {
    id: "CAP_OPTIC_SHEATH_US",
    label: "Ocular Ultrasound — ONSD Measurement",
    summary: "Optic nerve sheath diameter 5.4 mm measured 3 mm posterior to globe.",
    svgPreviewKind: "ULTRASOUND",
  },
];

export const EXTENDED_BIO_BANDS = {
  bloodGlucoseMgDl: {
    label: "Blood Sugar (Glucose)",
    unit: "mg/dL",
    mean: 92,
    p05: 70,
    p95: 115,
    criticalLow: 60,
    criticalHigh: 160,
  },
  coreTempC: {
    label: "Core Body Temperature",
    unit: "°C",
    mean: 36.8,
    p05: 36.3,
    p95: 37.4,
    criticalLow: 35.5,
    criticalHigh: 38.0,
  },
} as const;

export const MISSION_ENVIRONMENT_META: Record<
  MissionEnvironmentId,
  {
    label: string;
    shortLabel: string;
    gravityLabel: string;
    radiationContext: string;
    earthDelayLabel: string;
    primaryFocus: string;
    recommendedCountermeasure: string;
    suggestedLightDelay: LightDelayMode;
  }
> = {
  ISS_LEO: {
    label: "Space Station (LEO Microgravity · 0g)",
    shortLabel: "Space Station · 0g",
    gravityLabel: "0g Microgravity",
    radiationContext: "Partially shielded by Earth's magnetosphere (~0.02 mSv/hr)",
    earthDelayLabel: "Near real-time (< 1 sec)",
    primaryFocus: "Headward fluid shift (SANS), bone/muscle unloading, cabin CO2 buildup.",
    recommendedCountermeasure: "2 hrs daily ARED + treadmill, thigh cuffs, CO2 scrubber watch.",
    suggestedLightDelay: "LEO_0S",
  },
  TRANSIT_SPACECRAFT: {
    label: "Deep-Space Transit Craft (0g · High Radiation)",
    shortLabel: "Transit Craft · 0g",
    gravityLabel: "0g Microgravity",
    radiationContext: "Outside magnetosphere — Galactic Cosmic Rays & Solar Particle Events",
    earthDelayLabel: "3s to 14m async link",
    primaryFocus: "Autonomous triage, cumulative radiation dose budget, isolation & sleep drift.",
    recommendedCountermeasure: "Storm shelter drill readiness, PVT alertness checks, Vitamin D3.",
    suggestedLightDelay: "LUNAR_3S",
  },
  LUNAR_BASE: {
    label: "Lunar Surface Base (0.16g · Lunar Dust)",
    shortLabel: "Lunar Base · 0.16g",
    gravityLabel: "0.16g Lunar Gravity",
    radiationContext: "Exposed surface radiation; regolith shielding required",
    earthDelayLabel: "~3 sec round-trip",
    primaryFocus: "Lunar regolith airway irritation, EVA suit pre-breathe, partial-gravity load.",
    recommendedCountermeasure: "Airlock dust mitigation, 45m O2 pre-breathe, hydration 2500 mL/day.",
    suggestedLightDelay: "LUNAR_3S",
  },
  MARS_ROVER: {
    label: "Mars Rover / Surface Base (0.38g · 14m Delay)",
    shortLabel: "Mars Surface · 0.38g",
    gravityLabel: "0.38g Mars Gravity",
    radiationContext: "Thin CO2 atmosphere — sustained particle dose & dust storms",
    earthDelayLabel: "14m 20s one-way (async only)",
    primaryFocus: "Crew medical self-reliance, behavioral cohesion, post-transit orthostatic recovery.",
    recommendedCountermeasure: "Onboard AI triage summary, daily voice/mood log, potassium citrate.",
    suggestedLightDelay: "MARS_14M",
  },
};

export type HazardId =
  | "RADIATION"
  | "ISOLATION"
  | "DISTANCE"
  | "GRAVITY"
  | "CLOSED_ENV";

export interface NasaHazardInfo {
  id: HazardId;
  title: string;
  shortTitle: string;
  plainSummary: string;
  keyHealthEffects: string[];
  monitoredIndicators: string[];
  affectedBodyRegions: BodyRegionId[];
  targetPage: PageId;
  actionLabel: string;
}

import type { PageId } from "./navigation";
import type { ParameterName } from "./aegisContracts";

export const NASA_FIVE_HAZARDS: NasaHazardInfo[] = [
  {
    id: "RADIATION",
    title: "Space Radiation",
    shortTitle: "Radiation",
    plainSummary:
      "Without Earth's thick atmosphere and magnetic field, crews absorb galactic cosmic rays and sudden solar particle bursts.",
    keyHealthEffects: [
      "Higher long-term cancer and cardiovascular tissue risk",
      "Immune suppression and oxidative skin/cellular stress",
      "Potential acute radiation sickness during unshielded solar storms",
    ],
    monitoredIndicators: ["Radiation Rate (mSv/hr)", "Cumulative Dose (mSv / 600 mSv limit)", "Skin & Immune Scans"],
    affectedBodyRegions: ["skin_immune", "heart", "brain"],
    targetPage: "cabin-radiation",
    actionLabel: "Open Radiation & Storm Shelter",
  },
  {
    id: "ISOLATION",
    title: "Isolation & Confinement",
    shortTitle: "Isolation",
    plainSummary:
      "Living in a small module for months with 16 sunrises/sunsets a day disrupts sleep, circadian rhythm, and mood.",
    keyHealthEffects: [
      "Sleep fragmentation and shortened restorative rest",
      "Slower reaction times and behavioral fatigue",
      "Decreased appetite and metabolic energy shifts",
    ],
    monitoredIndicators: ["PVT Reaction Time (ms)", "Sleep Duration & Quality", "Mood & Voice Memos"],
    affectedBodyRegions: ["brain"],
    targetPage: "cognitive-readiness",
    actionLabel: "Open Cognitive & Mood Check",
  },
  {
    id: "DISTANCE",
    title: "Distance from Earth",
    shortTitle: "Distance",
    plainSummary:
      "On Mars missions, a single message takes up to 22 minutes one-way and emergency return is impossible; crews must self-assess.",
    keyHealthEffects: [
      "No real-time ground flight surgeon guidance during urgent events",
      "Fixed medical kit stock and expiring pharmaceuticals",
      "Need for clear autonomous self-diagnosis tools",
    ],
    monitoredIndicators: ["Offline Local Queue", "Med Kit Stock & Expiry", "Onboard AI Triage & Reports"],
    affectedBodyRegions: ["heart", "brain", "lungs"],
    targetPage: "reports-library",
    actionLabel: "Open Autonomous Triage & Reports",
  },
  {
    id: "GRAVITY",
    title: "Altered Gravity Fields",
    shortTitle: "Gravity",
    plainSummary:
      "Weightlessness (0g) shifts blood upward into the chest and head while unloading bones, muscles, and balance sensors.",
    keyHealthEffects: [
      "Spaceflight Associated Neuro-ocular Syndrome (SANS) & elevated eye pressure",
      "1–1.5% bone mineral loss per month and muscle deconditioning",
      "Calcium release increasing kidney stone risk & blood sugar insulin shift",
    ],
    monitoredIndicators: ["Eye Pressure (IOP) & Ocular Scan", "Exercise ARED % & Thigh Cuffs", "Blood Sugar (mg/dL) & Hydration"],
    affectedBodyRegions: ["eyes", "bones_muscle", "kidneys_fluids", "heart"],
    targetPage: "daily-checkin",
    actionLabel: "Open Daily Check-In & Scans",
  },
  {
    id: "CLOSED_ENV",
    title: "Hostile Closed Environments",
    shortTitle: "Closed Cabin",
    plainSummary:
      "Every breath of air and drop of water is recycled inside a sealed pressure vessel where CO2 pockets or microbes can build up.",
    keyHealthEffects: [
      "CO2-induced headaches, elevated breathing rate, and blood oxygen drops",
      "Fever or elevated core body temperature from cabin pathogens",
      "Dust or trace contaminant airway irritation (e.g., lunar regolith)",
    ],
    monitoredIndicators: ["Cabin CO2 (mmHg) & SpO2 %", "Respiration & Heart Rate", "Core Body Temp (°C)"],
    affectedBodyRegions: ["lungs", "skin_immune", "brain"],
    targetPage: "cabin-radiation",
    actionLabel: "Inspect Cabin ECLSS Air",
  },
];

export interface BodySystemAtlasEntry {
  regionId: BodyRegionId;
  name: string;
  shortLabel: string;
  spaceCondition: string;
  whyExamNeeded: string;
  hazardsInvolved: string[];
  linkedParameters: ParameterName[];
  usesBloodSugar?: boolean;
  usesCoreTemp?: boolean;
  usesRadiation?: boolean;
  whenToEscalate: string;
  preventiveAction: string;
  recommendedPage: PageId;
  recommendedActionLabel: string;
}

export const BODY_SYSTEM_ATLAS: BodySystemAtlasEntry[] = [
  {
    regionId: "brain",
    name: "Brain, Sleep & Neurovestibular",
    shortLabel: "Brain & Sleep",
    spaceCondition: "Circadian drift, CO2 headaches, balance adaptation",
    whyExamNeeded:
      "Without a 24-hour Earth sunrise cycle and with cabin CO2 fluctuations, reaction speed and judgment can degrade silently before a crew member notices.",
    hazardsInvolved: ["Isolation & Confinement", "Hostile Closed Environments", "Distance from Earth"],
    linkedParameters: ["sleep_duration_hrs", "sleep_quality_score", "fatigue_score", "cabin_co2_mmhg"],
    whenToEscalate:
      "Sleep drops below 5.5 hrs for 3+ nights, PVT reaction lapses > 2, or persistent headache with elevated cabin CO2.",
    preventiveAction:
      "Run a 5-trial PVT reaction check, review cabin ventilation near sleep quarters, and record a daily voice mood check-in.",
    recommendedPage: "cognitive-readiness",
    recommendedActionLabel: "Run PVT Alertness Check",
  },
  {
    regionId: "eyes",
    name: "Eyes & Optic Nerve (SANS)",
    shortLabel: "Eyes (SANS)",
    spaceCondition: "Upward fluid shift pressing on back of eyes",
    whyExamNeeded:
      "In microgravity, ~2 liters of body fluid shifts toward the head, which can flatten the eyeball, swell the optic disc, and cause lasting vision changes.",
    hazardsInvolved: ["Altered Gravity Fields"],
    linkedParameters: ["visual_symptom_severity", "intraocular_pressure_mmhg", "thigh_cuff_adherence_pct"],
    whenToEscalate:
      "Blurred near vision, new floaters/flashes, visual score >= 3, or IOP rising outside 12.8–16.2 mmHg.",
    preventiveAction:
      "Log daily visual symptoms, wear Braslet-M thigh occlusion cuffs on schedule, and capture a fundoscope/ocular ultrasound scan.",
    recommendedPage: "daily-checkin",
    recommendedActionLabel: "Log Eye Check & Scan",
  },
  {
    regionId: "heart",
    name: "Heart & Cardiovascular System",
    shortLabel: "Heart & BP",
    spaceCondition: "Cardiac unloading & orthostatic intolerance risk",
    whyExamNeeded:
      "The heart works less hard against gravity in space, shrinking slightly over long missions and raising fainting risk when landing on the Moon or Mars.",
    hazardsInvolved: ["Altered Gravity Fields", "Space Radiation"],
    linkedParameters: ["heart_rate_bpm", "systolic_bp_mmhg", "diastolic_bp_mmhg"],
    whenToEscalate:
      "Resting heart rate > 95 bpm sustained, systolic BP outside 105–135 mmHg, dizziness, or chest discomfort.",
    preventiveAction:
      "Check activity context (Resting vs. ARED Exercise), hydrate 2,500 mL/day, and attach a 12-sec ECG strip for Flight Surgeon review.",
    recommendedPage: "live-vitals",
    recommendedActionLabel: "Inspect Live Heart Charts",
  },
  {
    regionId: "lungs",
    name: "Lungs & Respiratory Exchange",
    shortLabel: "Lungs & Air",
    spaceCondition: "CO2 accumulation & lunar/cabin dust sensitivity",
    whyExamNeeded:
      "Because warm exhaled CO2 does not rise by convection in microgravity, pockets can form around crew heads unless airflow fans and CDRA scrubbers run cleanly.",
    hazardsInvolved: ["Hostile Closed Environments", "Distance from Earth"],
    linkedParameters: ["spo2_pct", "respiration_rpm", "cabin_co2_mmhg"],
    whenToEscalate:
      "SpO2 drops below 95% at rest, respiration > 18 rpm, or cabin CO2 exceeds 4.0 mmHg.",
    preventiveAction:
      "Verify ECLSS ppO2 and CO2 scrubber capacity, check EVA suit scrubbers before airlock exit, and pause heavy exertion.",
    recommendedPage: "cabin-radiation",
    recommendedActionLabel: "Check Cabin Air & ECLSS",
  },
  {
    regionId: "bones_muscle",
    name: "Bones, Muscle & Metabolic Fuel",
    shortLabel: "Bones & Fuel",
    spaceCondition: "Weightless bone loss & altered glucose sensitivity",
    whyExamNeeded:
      "Astronauts lose ~1% of bone density per month without resistive loading, while reduced muscle glucose uptake can cause blood sugar drift.",
    hazardsInvolved: ["Altered Gravity Fields", "Isolation & Confinement"],
    linkedParameters: ["exercise_completion_pct", "caloric_intake_kcal", "appetite_score"],
    usesBloodSugar: true,
    whenToEscalate:
      "Blood sugar outside 70–115 mg/dL fasting, exercise adherence < 75% for a week, or persistent caloric deficit.",
    preventiveAction:
      "Complete daily ARED resistive + treadmill protocol, log Vitamin D3 1000 IU in Med Kit, and track blood sugar (mg/dL).",
    recommendedPage: "med-kit",
    recommendedActionLabel: "Log Vitamin D3 & Countermeasures",
  },
  {
    regionId: "kidneys_fluids",
    name: "Kidneys & Hydration Balance",
    shortLabel: "Kidneys & Fluids",
    spaceCondition: "Calcium excretion & plasma volume reduction",
    whyExamNeeded:
      "Bone breakdown releases calcium into urine just as plasma volume shrinks by ~15% in orbit, sharply increasing painful kidney stone risk.",
    hazardsInvolved: ["Altered Gravity Fields", "Hostile Closed Environments"],
    linkedParameters: ["hydration_ml", "thigh_cuff_adherence_pct"],
    whenToEscalate:
      "Hydration < 1,800 mL/day, flank discomfort, or reduced urine output.",
    preventiveAction:
      "Target 2,400–2,600 mL potable water daily and take Potassium Citrate 20 mEq prophylaxis as scheduled.",
    recommendedPage: "daily-checkin",
    recommendedActionLabel: "Update Hydration Log",
  },
  {
    regionId: "skin_immune",
    name: "Skin, Fever & Immune Defense",
    shortLabel: "Skin & Immune",
    spaceCondition: "Immune reactivation, cabin rashes & radiation dose",
    whyExamNeeded:
      "Microgravity stress and radiation alter white blood cell response; latent viruses or minor skin abrasions heal more slowly in closed habitats.",
    hazardsInvolved: ["Space Radiation", "Hostile Closed Environments", "Isolation & Confinement"],
    linkedParameters: ["skin_temp_c", "radiation_msv_hr"],
    usesCoreTemp: true,
    usesRadiation: true,
    whenToEscalate:
      "Core body temperature >= 37.8 °C, spreading skin rash, or solar particle storm radiation spike.",
    preventiveAction:
      "Log Core Body Temperature (°C), capture a camera photo of any skin rash for tele-dermatology, and monitor cumulative mSv dose.",
    recommendedPage: "daily-checkin",
    recommendedActionLabel: "Log Core Temp & Skin Photo",
  },
];

export interface MissionRoutineTask {
  taskId: string;
  windowLabel: string;
  title: string;
  points: number;
  targetPage: PageId;
}

export const MISSION_ROUTINE_TASKS: MissionRoutineTask[] = [
  {
    taskId: "TASK_HYDRATION_GLUCOSE",
    windowLabel: "07:00 UTC",
    title: "Morning Hydration & Blood Sugar Check",
    points: 20,
    targetPage: "daily-checkin",
  },
  {
    taskId: "TASK_ARED_VITD",
    windowLabel: "11:30 UTC",
    title: "ARED Exercise & Vitamin D3 Countermeasure",
    points: 20,
    targetPage: "med-kit",
  },
  {
    taskId: "TASK_SANS_CABIN",
    windowLabel: "15:00 UTC",
    title: "Eye Pressure (SANS) & Cabin CO2 Review",
    points: 20,
    targetPage: "body-map",
  },
  {
    taskId: "TASK_PVT_ALERT",
    windowLabel: "18:30 UTC",
    title: "5-Trial Cognitive Reaction (PVT) & Mood",
    points: 20,
    targetPage: "cognitive-readiness",
  },
  {
    taskId: "TASK_TEMP_VOICE",
    windowLabel: "21:00 UTC",
    title: "Evening Core Temp, Sleep & Voice Memo",
    points: 20,
    targetPage: "daily-checkin",
  },
];

export const COUNTERMEASURE_BADGES: Array<{
  badgeId: string;
  label: string;
  requirement: string;
}> = [
  {
    badgeId: "DAILY_CADENCE",
    label: "Daily Health Steward",
    requirement: "Complete 3+ mission routine tasks in a day",
  },
  {
    badgeId: "BIO_COMPLETE",
    label: "Full Bio & Scan Check",
    requirement: "Log Blood Sugar, Core Temp, or Diagnostic Scan",
  },
  {
    badgeId: "OCULAR_WATCH",
    label: "SANS Eye Protector",
    requirement: "Record eye comfort & body-system inspection",
  },
  {
    badgeId: "MIND_STEADY",
    label: "Circadian Steady",
    requirement: "Complete a Cognitive PVT reaction test",
  },
  {
    badgeId: "MISSION_STREAK_3",
    label: "3-Day Habit Streak",
    requirement: "Maintain 3+ consecutive days of health check-ins",
  },
  {
    badgeId: "MISSION_READY_100",
    label: "100% Routine Complete",
    requirement: "Finish all 5 daily mission routine prompts",
  },
];

