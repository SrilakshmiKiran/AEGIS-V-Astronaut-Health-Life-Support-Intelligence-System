import {
  ALL_18_PARAMETERS,
  AlertExplanation,
  AuditLogEntry,
  BaselineComparison,
  BaselineProfile,
  ConsultationQueueItem,
  DemoSceneId,
  DeterministicFinding,
  IncidentRecord,
  IncidentState,
  KnowledgeResource,
  NutritionCatalogueItem,
  ParameterName,
  PostResponseTrend,
  PROTOTYPE_DISCLAIMER,
  RuleId,
  SCHEMA_VERSION,
  SyncStatus,
  TelemetryObservation,
  VerifiedHardwareDevice,
} from "../types/aegisContracts";
import { EarthHandoffPackageData } from "../types/continuityContracts";
import {
  compareToBaseline,
  computeAuditEntryHash,
  deriveOverallPostActionDirection,
  evaluatePostResponseTrend,
  isObservationDegraded,
  retrieveRelevantResources,
} from "../utils/aegisPureEngine";

export const SEEDED_BASELINE_PROFILE: BaselineProfile = {
  astronaut_id: "AST-01-COMMANDER",
  full_name: "Cdr. Elena Vance",
  mission_role: "Flight Engineer — Lunar Gateway Prototype",
  window_label: "14-Day Prototype Baseline (2026-10-30 to 2026-11-12) [SIMULATED]",
  window_start: "2026-10-30T00:00:00Z",
  window_end: "2026-11-12T23:59:59Z",
  calibration_status: "PROTOTYPE_SYNTHETIC_DEMO_NOT_CLINICALLY_VALIDATED",
  prototype_disclaimer: PROTOTYPE_DISCLAIMER,
  info_label: "COMPUTED",
  metrics: {
    heart_rate_bpm: { mean: 68.0, std: 4.5, p05: 60.6, p95: 75.4, sample_count: 336, unit: "bpm" },
    spo2_pct: { mean: 98.2, std: 0.6, p05: 97.2, p95: 99.2, sample_count: 336, unit: "%" },
    systolic_bp_mmhg: { mean: 118.0, std: 5.0, p05: 109.8, p95: 126.2, sample_count: 336, unit: "mmHg" },
    diastolic_bp_mmhg: { mean: 76.0, std: 4.0, p05: 69.4, p95: 82.6, sample_count: 336, unit: "mmHg" },
    skin_temp_c: { mean: 36.6, std: 0.25, p05: 36.2, p95: 37.0, sample_count: 336, unit: "degC" },
    respiration_rpm: { mean: 14.0, std: 1.5, p05: 11.5, p95: 16.5, sample_count: 336, unit: "rpm" },
    radiation_msv_hr: { mean: 0.02, std: 0.005, p05: 0.012, p95: 0.028, sample_count: 336, unit: "mSv/hr" },
    cabin_co2_mmhg: { mean: 2.8, std: 0.3, p05: 2.3, p95: 3.3, sample_count: 336, unit: "mmHg" },
    sleep_duration_hrs: {
      mean: 7.5,
      std: 0.4,
      p05: 6.8,
      p95: 8.2,
      sample_count: 14,
      unit: "hrs",
      authorized_target: 7.5,
    },
    sleep_quality_score: {
      mean: 8.0,
      std: 0.7,
      p05: 6.8,
      p95: 9.2,
      sample_count: 14,
      unit: "score_1_10",
    },
    exercise_completion_pct: {
      mean: 96.0,
      std: 5.0,
      p05: 85.0,
      p95: 100.0,
      sample_count: 14,
      unit: "%",
      authorized_target: 100.0,
    },
    fatigue_score: {
      mean: 2.5,
      std: 0.6,
      p05: 1.5,
      p95: 3.5,
      sample_count: 14,
      unit: "score_1_10",
    },
    visual_symptom_severity: {
      mean: 0.0,
      std: 0.2,
      p05: 0.0,
      p95: 0.5,
      sample_count: 14,
      unit: "score_0_10",
    },
    intraocular_pressure_mmhg: {
      mean: 14.5,
      std: 1.0,
      p05: 12.8,
      p95: 16.2,
      sample_count: 14,
      unit: "mmHg",
    },
    thigh_cuff_adherence_pct: {
      mean: 100.0,
      std: 2.0,
      p05: 95.0,
      p95: 100.0,
      sample_count: 14,
      unit: "%",
      authorized_target: 100.0,
    },
    caloric_intake_kcal: {
      mean: 2780.0,
      std: 120.0,
      p05: 2580.0,
      p95: 2980.0,
      sample_count: 14,
      unit: "kcal",
      authorized_target: 2800.0,
    },
    hydration_ml: {
      mean: 2480.0,
      std: 140.0,
      p05: 2250.0,
      p95: 2710.0,
      sample_count: 14,
      unit: "mL",
      authorized_target: 2500.0,
    },
    appetite_score: {
      mean: 8.2,
      std: 0.6,
      p05: 7.2,
      p95: 9.2,
      sample_count: 14,
      unit: "score_1_10",
    },
  },
};

export const SEEDED_HARDWARE_REGISTRY: VerifiedHardwareDevice[] = [
  {
    device_id: "CSA-BIOMONITOR-HEXOSKIN-01",
    device_model: "CSA Bio-Monitor Wearable Smart Shirt",
    manufacturer: "Canadian Space Agency / Carré Technologies",
    supported_parameters: [
      "heart_rate_bpm",
      "spo2_pct",
      "systolic_bp_mmhg",
      "diastolic_bp_mmhg",
      "skin_temp_c",
      "respiration_rpm",
    ],
    sampling_rate_hz: 1.0,
    hmac_secret_env_var: "AEGIS_DEVICE_HMAC_SECRET",
    is_active: true,
  },
];

export const CURATED_NASA_CSA_RESOURCES: KnowledgeResource[] = [
  {
    resource_id: "NASA-HAZARDS-01",
    title: "5 Hazards of Human Spaceflight",
    publisher: "NASA Human Research Program",
    source_url: "https://www.nasa.gov/hrp/5-hazards-of-human-spaceflight/",
    publication_date: "2019-11-18",
    topic_tags: ["radiation", "isolation", "gravity", "environment", "general_hazards"],
    category: "Spaceflight hazards",
    summary:
      "Overview of the five primary spaceflight hazards (space radiation, isolation and confinement, distance from Earth, gravity fields, and hostile/closed environments) studied by NASA HRP to protect crew health on deep-space missions.",
    evidence_note:
      "Introductory framing of spaceflight hazards; provides general spaceflight research context and does not establish an individual astronaut diagnosis or validated clinical alert threshold.",
    review_status: "Reviewed",
  },
  {
    resource_id: "NASA-RISKS-02",
    title: "Risks of Human Spaceflight",
    publisher: "NASA Human Research Program",
    source_url: "https://www.nasa.gov/hrp/risks/",
    publication_date: "Not stated",
    topic_tags: ["cardiovascular", "bone_muscle", "vision", "general_hazards"],
    category: "Cardiovascular and physiological risks",
    summary:
      "Comprehensive characterization of physiological and psychological risks during extended microgravity and deep-space missions, including aerobic deconditioning, orthostatic intolerance, and neuro-ocular shifts.",
    evidence_note:
      "Background on physiological risks during space missions; date not stated on hub page. Does not establish an individual diagnosis or clinical threshold.",
    review_status: "Reviewed",
  },
  {
    resource_id: "NASA-HRP-03",
    title: "Ongoing HRP Research in Space",
    publisher: "NASA Human Research Program",
    source_url: "https://www.nasa.gov/hrp/ongoing-hrp-research/",
    publication_date: "2026-08-18",
    topic_tags: ["cardiovascular", "behavioural", "sleep", "countermeasures"],
    category: "Space research experiments",
    summary:
      "Active NASA Human Research Program investigations aboard orbital and cislunar analog platforms evaluating integrated countermeasures, crew autonomy, and physiological telemetry baselines.",
    evidence_note:
      "Active NASA HRP investigations; general research context, not a medical protocol or diagnostic standard.",
    review_status: "Reviewed",
  },
  {
    resource_id: "CSA-RAD-04",
    title: "Monitoring radiation for astronaut health",
    publisher: "Canadian Space Agency (CSA)",
    source_url:
      "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp",
    publication_date: "2026-02-26",
    topic_tags: ["radiation", "dosimetry", "environment"],
    category: "Radiation monitoring",
    summary:
      "Details Canadian Space Agency operational radiation dosimetry instruments and real-time environmental monitoring strategies used to track crew ionizing radiation exposure in orbit and lunar transit.",
    evidence_note:
      "CSA dosimetry context; supports environmental radiation monitoring awareness without predicting unvalidated biological dose effects.",
    review_status: "Reviewed",
  },
  {
    resource_id: "CSA-SCI-05",
    title: "Canadian science on the International Space Station: Why do we conduct science experiments in space?",
    publisher: "Canadian Space Agency (CSA)",
    source_url: "https://www.asc-csa.gc.ca/eng/iss/science/",
    publication_date: "2025-10-28",
    topic_tags: ["research_context", "microgravity", "physiology"],
    category: "Space research experiments",
    summary:
      "Explains the scientific methodology behind microgravity life-science investigations, wearable bio-monitoring experiments (such as Bio-Monitor), and longitudinal baseline tracking.",
    evidence_note:
      "Background on ISS/space science methodology; not a clinical monitoring threshold or treatment directive.",
    review_status: "Reviewed",
  },
  {
    resource_id: "NASA-ARCHER-06",
    title: "ARCHeR: Astronaut Well-Being, Activity and Sleep Patterns",
    publisher: "NASA Human Research Program",
    source_url: "https://www.nasa.gov/reference/archer/",
    publication_date: "2026-03-17",
    topic_tags: ["sleep", "behavioural", "fatigue", "activity"],
    category: "Sleep and astronaut well-being",
    summary:
      "Studies how long-duration isolation, operational schedule density, and habitat lighting affect astronaut sleep duration, actigraphy patterns, exercise adherence, and cognitive fatigue.",
    evidence_note:
      "Studies deep-space sleep, activity, and well-being; supports operational workload review flags rather than psychiatric or sleep disorder diagnosis.",
    review_status: "Reviewed",
  },
  {
    resource_id: "NASA-FLUID-SANS-07",
    title: "Thigh Cuff & Fluid Redistribution Countermeasures for SANS",
    publisher: "NASA Human Research Program",
    source_url: "https://www.nasa.gov/reference/thigh-cuff/",
    publication_date: "2025-06-04",
    topic_tags: ["vision", "fluid_shift", "countermeasures", "cardiovascular"],
    category: "Fluid shift and eye health",
    summary:
      "Investigates cephalad fluid shifts in microgravity associated with Spaceflight-Associated Neuro-ocular Syndrome (SANS) and evaluates lower-extremity venoconstrictive thigh cuffs as a mechanical countermeasure.",
    evidence_note:
      "Cephalad fluid shift & thigh-cuff research; never infer intracranial pressure (ICP) or diagnose eye disease from symptoms or tonometry alone.",
    review_status: "Reviewed",
  },
  {
    resource_id: "NASA-FOOD-PHYS-08",
    title: "Food and Nutrition in Spaceflight (OCHMO-TB-013 & ISS Food Physiology)",
    publisher: "NASA OCHMO / Human Research Program",
    source_url:
      "https://www.nasa.gov/wp-content/uploads/2023/03/food-and-nutrition-technical-brief-ochmo.pdf",
    publication_date: "2023-03-15",
    topic_tags: ["nutrition", "hydration", "fatigue", "countermeasures"],
    category: "Nutrition and hydration",
    summary:
      "Technical brief outlining spaceflight caloric requirements, fluid hydration targets, menu fatigue, and physiological interactions between nutritional intake, immune status, and crew performance.",
    evidence_note:
      "Spaceflight nutrition & hydration context; provides dietary reference context, not a clinical metabolic diagnosis.",
    review_status: "Reviewed",
  },
];

export const NUTRITION_CATALOGUE: NutritionCatalogueItem[] = [
  {
    meal_id: "MEAL-ISS-STD-01",
    name: "Standard Ration Pack A (Thermostabilized Entree + Tortilla + Beverage)",
    caloric_intake_kcal: 2820,
    hydration_ml: 2520,
    category: "Nominal Daily Ration",
  },
  {
    meal_id: "MEAL-ISS-RED-02",
    name: "Reduced Appetite / EVA Prep Light Pack (Rehydratable Soup + Electrolyte Pouch)",
    caloric_intake_kcal: 1950,
    hydration_ml: 1750,
    category: "Sub-Target Ration",
  },
  {
    meal_id: "MEAL-ISS-REC-03",
    name: "High-Hydration Recovery Ration (Protein Pack + 2x Isotonic Rehydration)",
    caloric_intake_kcal: 2910,
    hydration_ml: 2680,
    category: "Recovery Ration",
  },
];

export interface PrototypeRuleSpec {
  rule_id: RuleId;
  rule_name: string;
  severity: "HIGH" | "MODERATE" | "ADVISORY";
  category: string;
  deterministic_formula: string;
  parameters: ParameterName[];
}

export const CONFIGURED_PROTOTYPE_RULES: PrototypeRuleSpec[] = [
  {
    rule_id: "RULE-CARDIO-TREND-01",
    rule_name: "Sustained Heart Rate Elevation Above Personal Baseline [Prototype Rule]",
    severity: "MODERATE",
    category: "Core Vital",
    deterministic_formula:
      ">= 3 consecutive VALID heart_rate_bpm readings over >= 15 min exceed baseline_p95 (75.4 bpm) AND min(mean + 3*std, 95.0 bpm) with positive linear slope.",
    parameters: ["heart_rate_bpm"],
  },
  {
    rule_id: "RULE-HYPOXIA-CO2-MULTI-02",
    rule_name: "Multi-Parameter Cardiorespiratory & Cabin CO2 Shift [Prototype Rule]",
    severity: "HIGH",
    category: "Multi-Parameter Vital + Habitat",
    deterministic_formula:
      "VALID spo2_pct < 94.5% (below baseline_p05 97.2%) AND (respiration_rpm > 19.0 rpm OR cabin_co2_mmhg > 4.5 mmHg) within 30-min window.",
    parameters: ["spo2_pct", "respiration_rpm", "cabin_co2_mmhg", "heart_rate_bpm"],
  },
  {
    rule_id: "RULE-RAD-EXPOSURE-03",
    rule_name: "Elevated Radiation Rate Context Alert [Prototype Rule]",
    severity: "HIGH",
    category: "Habitat Environment",
    deterministic_formula:
      "VALID radiation_msv_hr > 0.10 mSv/hr (exceeding personal habitat baseline_p95 of 0.028 mSv/hr).",
    parameters: ["radiation_msv_hr"],
  },
  {
    rule_id: "RULE-DATA-QUALITY-04",
    rule_name: "Degraded Telemetry Confidence / Stale, Missing, or Quarantined Feed [Prototype Rule]",
    severity: "ADVISORY",
    category: "Data Quality & Integrity Gate",
    deterministic_formula:
      ">= 2 observations in active batch flagged STALE (>15 min old), MISSING, IMPOSSIBLE, CORRUPTED, or failed HMAC hardware attestation.",
    parameters: ["heart_rate_bpm", "respiration_rpm"],
  },
  {
    rule_id: "RULE-ARCHER-SLEEP-FATIGUE-05",
    rule_name: "ARCheR Combined-Signal Sleep, Fatigue & Activity Deterioration Pattern [Prototype Rule]",
    severity: "MODERATE",
    category: "NASA HRP — Sleep & Well-Being",
    deterministic_formula:
      "Last >= 3 consecutive sleep_duration_hrs < baseline_p05 (6.8 hrs) AND fatigue_score > baseline_p95 (3.5) AND exercise_completion_pct < baseline_p05 (85.0%).",
    parameters: ["sleep_duration_hrs", "fatigue_score", "exercise_completion_pct"],
  },
  {
    rule_id: "RULE-FLUID-EYE-SANS-06",
    rule_name: "Fluid-Shift & Eye Health Persistent Symptom & Baseline Deviation Flag [Prototype Rule]",
    severity: "MODERATE",
    category: "NASA HRP — Fluid-Shift & SANS",
    deterministic_formula:
      "visual_symptom_severity > 0 on >= 2 consecutive check-ins AND CMO-recorded intraocular_pressure_mmhg outside [p05: 12.8, p95: 16.2 mmHg].",
    parameters: ["visual_symptom_severity", "intraocular_pressure_mmhg", "thigh_cuff_adherence_pct"],
  },
  {
    rule_id: "RULE-NUTRITION-HYDRATION-07",
    rule_name: "Low Energy/Hydration Intake, Reduced Appetite & Fatigue Pattern [Prototype Rule]",
    severity: "ADVISORY",
    category: "NASA HRP — Nutrition & Hydration",
    deterministic_formula:
      "caloric_intake_kcal (<2800 kcal target) or hydration_ml (<2500 mL target) for >= 2 consecutive days WITH appetite_score < 6.0 AND fatigue_score > 4.0.",
    parameters: ["caloric_intake_kcal", "hydration_ml", "appetite_score", "fatigue_score"],
  },
];

// Helper to create time-series observations for Scene 1 (Nominal) vs Scene 2+ (Anomaly + Follow-up)
export function buildSceneObservations(scene: DemoSceneId): TelemetryObservation[] {
  const obs: TelemetryObservation[] = [];
  const baseTime = new Date("2026-11-14T12:00:00Z").getTime();

  // 8 time steps over 40 minutes for core 8 parameters
  const nominalSeries: Record<ParameterName, number[]> = {
    heart_rate_bpm: [67, 68, 69, 68, 67, 69, 68, 68.5],
    spo2_pct: [98.4, 98.2, 98.3, 98.1, 98.2, 98.4, 98.3, 98.2],
    systolic_bp_mmhg: [117, 118, 119, 118, 117, 118, 119, 118],
    diastolic_bp_mmhg: [75, 76, 76, 77, 76, 75, 76, 76],
    skin_temp_c: [36.55, 36.6, 36.62, 36.58, 36.6, 36.61, 36.59, 36.6],
    respiration_rpm: [13.8, 14.0, 14.2, 13.9, 14.1, 14.0, 13.9, 14.1],
    radiation_msv_hr: [0.019, 0.02, 0.021, 0.02, 0.019, 0.021, 0.02, 0.02],
    cabin_co2_mmhg: [2.75, 2.8, 2.82, 2.79, 2.81, 2.8, 2.83, 2.8],
    sleep_duration_hrs: [7.6, 7.5, 7.4],
    sleep_quality_score: [8.2, 8.0, 8.1],
    exercise_completion_pct: [98, 96, 97],
    fatigue_score: [2.2, 2.4, 2.3],
    visual_symptom_severity: [0.0, 0.0, 0.0],
    intraocular_pressure_mmhg: [14.4, 14.5, 14.5],
    thigh_cuff_adherence_pct: [100, 100, 100],
    caloric_intake_kcal: [2810, 2790, 2820],
    hydration_ml: [2510, 2490, 2520],
    appetite_score: [8.4, 8.2, 8.3],
  };

  const anomalySeries: Record<ParameterName, number[]> = {
    heart_rate_bpm: [74, 81, 88, 94, 99, 104, 106, 108],
    spo2_pct: [97.8, 97.1, 96.2, 95.4, 94.3, 93.4, 92.8, 92.4],
    systolic_bp_mmhg: [119, 121, 124, 126, 128, 130, 131, 132],
    diastolic_bp_mmhg: [77, 78, 79, 80, 82, 83, 84, 84],
    skin_temp_c: [36.62, 36.68, 36.74, 36.8, 36.85, 36.9, 36.94, 36.98],
    respiration_rpm: [15.0, 16.2, 17.5, 18.8, 19.6, 20.5, 21.4, 22.0],
    radiation_msv_hr: [0.02, 0.021, 0.022, 0.021, 0.023, 0.022, 0.024, 0.023],
    cabin_co2_mmhg: [3.1, 3.4, 3.8, 4.2, 4.6, 4.9, 5.2, 5.4],
    sleep_duration_hrs: [5.8, 5.5, 5.2],
    sleep_quality_score: [6.4, 5.8, 5.2],
    exercise_completion_pct: [75, 70, 65],
    fatigue_score: [6.2, 7.0, 7.8],
    visual_symptom_severity: [0.0, 2.0, 3.0],
    intraocular_pressure_mmhg: [14.6, 17.5, 18.2],
    thigh_cuff_adherence_pct: [95, 85, 80],
    caloric_intake_kcal: [2750, 2050, 1950],
    hydration_ml: [2450, 1850, 1750],
    appetite_score: [8.0, 5.5, 5.0],
  };

  const followupAppend: Partial<Record<ParameterName, number[]>> = {
    heart_rate_bpm: [102, 96, 91, 87, 84, 82],
    spo2_pct: [93.4, 94.2, 95.1, 95.8, 96.4, 96.8],
    systolic_bp_mmhg: [129, 126, 124, 122, 121, 120],
    diastolic_bp_mmhg: [83, 81, 80, 79, 78, 78],
    skin_temp_c: [36.92, 36.85, 36.79, 36.74, 36.7, 36.68],
    respiration_rpm: [20.5, 19.2, 18.0, 17.1, 16.2, 15.5],
    radiation_msv_hr: [0.022, 0.021, 0.021, 0.02, 0.02, 0.02],
    cabin_co2_mmhg: [4.8, 4.3, 3.9, 3.5, 3.3, 3.1],
  };

  const isNormal = scene === "SCENE_1_NORMAL";
  const isFollowup =
    scene === "SCENE_5_RESPONSE_FOLLOWUP" || scene === "SCENE_6_CONNECTIVITY_RESTORED";

  const activeSeries = isNormal ? nominalSeries : anomalySeries;

  const coreParams: ParameterName[] = [
    "heart_rate_bpm",
    "spo2_pct",
    "systolic_bp_mmhg",
    "diastolic_bp_mmhg",
    "skin_temp_c",
    "respiration_rpm",
    "radiation_msv_hr",
    "cabin_co2_mmhg",
  ];

  coreParams.forEach((param) => {
    const unit = SEEDED_BASELINE_PROFILE.metrics[param].unit;
    const values = [...activeSeries[param]];
    if (isFollowup && followupAppend[param]) {
      values.push(...(followupAppend[param] as number[]));
    }
    values.forEach((val, idx) => {
      const ts = new Date(baseTime + idx * 5 * 60000).toISOString();
      obs.push({
        observation_id: `OBS-${param.toUpperCase().slice(0, 6)}-${String(idx + 1).padStart(2, "0")}`,
        astronaut_id: "AST-01-COMMANDER",
        timestamp: ts,
        parameter: param,
        value: val,
        unit,
        source_type: "SIMULATED",
        device_id: "SIM-ENGINE-01",
        device_hmac_verified: false,
        info_label: "MEASURED",
        quality_status: "VALID",
        quality_notes: "Nominal telemetry frame",
        reference_target: SEEDED_BASELINE_PROFILE.metrics[param].authorized_target ?? null,
        context_metadata: { phase: idx >= 8 ? "POST_RESPONSE_FOLLOWUP" : "CONTINUOUS_MONITOR" },
        is_quarantined: false,
      });
    });
  });

  // Add 3 days of HRP check-ins (T-48h, T-24h, T-0h)
  const hrpParams: ParameterName[] = [
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
  ];
  const dayOffsets = [-48 * 3600000, -24 * 3600000, 0];

  hrpParams.forEach((param) => {
    const unit = SEEDED_BASELINE_PROFILE.metrics[param].unit;
    const values = activeSeries[param];
    values.forEach((val, idx) => {
      const ts = new Date(baseTime + dayOffsets[idx]).toISOString();
      const isEstimatedMeal = param === "caloric_intake_kcal";
      obs.push({
        observation_id: `OBS-HRP-${param.slice(0, 6).toUpperCase()}-D${idx + 1}`,
        astronaut_id: "AST-01-COMMANDER",
        timestamp: ts,
        parameter: param,
        value: val,
        unit,
        source_type: param === "intraocular_pressure_mmhg" ? "MANUAL_ENTRY" : "SIMULATED",
        device_id:
          param === "intraocular_pressure_mmhg"
            ? "CLINICAL-TONOMETER-01"
            : isEstimatedMeal
            ? "CREW-MANUAL-LOG"
            : "SIM-ENGINE-01",
        device_hmac_verified: false,
        info_label: "MEASURED",
        quality_status: isEstimatedMeal ? "ESTIMATED" : "VALID",
        quality_notes: isEstimatedMeal
          ? "Estimated from Spaceflight Food Catalogue ration selection"
          : "Daily HRP crew check-in record",
        reference_target: SEEDED_BASELINE_PROFILE.metrics[param].authorized_target ?? null,
        context_metadata: { day_index: `T-${(2 - idx) * 24}h` },
        is_quarantined: false,
      });
    });
  });

  // In Scene 2+, add the 1 STALE reading and 1 IMPOSSIBLE reading (-10 bpm, quarantined)
  if (!isNormal) {
    obs.push({
      observation_id: "OBS-QUAL-STALE-01",
      astronaut_id: "AST-01-COMMANDER",
      timestamp: new Date(baseTime - 25 * 60000).toISOString(),
      parameter: "skin_temp_c",
      value: 36.64,
      unit: "degC",
      source_type: "SIMULATED",
      device_id: "SIM-ENGINE-01",
      device_hmac_verified: false,
      info_label: "MEASURED",
      quality_status: "STALE",
      quality_notes: "Packet timestamp >15 minutes behind telemetry ingestion window (25 min old)",
      reference_target: null,
      context_metadata: { gate_reason: "STALE_TIMESTAMP_25M" },
      is_quarantined: false,
    });

    obs.push({
      observation_id: "OBS-QUAL-IMPOSSIBLE-01",
      astronaut_id: "AST-01-COMMANDER",
      timestamp: new Date(baseTime + 35 * 60000).toISOString(),
      parameter: "heart_rate_bpm",
      value: -10.0,
      unit: "bpm",
      source_type: "SIMULATED",
      device_id: "SIM-ENGINE-01",
      device_hmac_verified: false,
      info_label: "MEASURED",
      quality_status: "IMPOSSIBLE",
      quality_notes:
        "Rejected by Stage 2 Validation Gate: negative heart rate (-10.0 bpm) outside physiological bounds [25–240 bpm]. Quarantined from baseline & rule math.",
      reference_target: null,
      context_metadata: { gate_reason: "PHYSIOLOGICAL_BOUNDS_VIOLATION" },
      is_quarantined: true,
    });
  }

  return obs;
}

export function buildDemoIncidents(
  scene: DemoSceneId,
  observations: TelemetryObservation[],
  optionalLlmEnabled: boolean
): IncidentRecord[] {
  if (scene === "SCENE_1_NORMAL") {
    return [];
  }

  const stateByScene: Record<DemoSceneId, IncidentState> = {
    SCENE_1_NORMAL: "DETECTED",
    SCENE_2_GRADUAL_ANOMALY: "DETECTED",
    SCENE_3_EXPLAIN: "REVIEWED",
    SCENE_4_EARTH_UNAVAILABLE: "REVIEWED",
    SCENE_5_RESPONSE_FOLLOWUP: "MONITORING",
    SCENE_6_CONNECTIVITY_RESTORED: "CLOSED_RETAINED",
    SCENE_7_CONTINUITY_CMO_UNAVAILABLE: "REVIEWED",
  };

  const currentState = stateByScene[scene];

  const getLatestValid = (p: ParameterName): TelemetryObservation => {
    const preOnly = observations.filter(
      (o) =>
        o.parameter === p &&
        !o.is_quarantined &&
        o.quality_status !== "STALE" &&
        o.context_metadata?.phase !== "POST_RESPONSE_FOLLOWUP"
    );
    return preOnly[preOnly.length - 1];
  };

  const hrObs = getLatestValid("heart_rate_bpm");
  const spo2Obs = getLatestValid("spo2_pct");
  const respObs = getLatestValid("respiration_rpm");
  const co2Obs = getLatestValid("cabin_co2_mmhg");

  const evidenceObs = [spo2Obs, co2Obs, respObs, hrObs].filter(Boolean);
  const comparisons: Record<string, BaselineComparison> = {};
  evidenceObs.forEach((o) => {
    comparisons[o.parameter] = compareToBaseline(o, SEEDED_BASELINE_PROFILE);
  });

  const matchedRefs = CURATED_NASA_CSA_RESOURCES.filter((r) =>
    ["NASA-HAZARDS-01", "NASA-RISKS-02", "NASA-ARCHER-06", "NASA-FLUID-SANS-07"].includes(
      r.resource_id
    )
  );

  const explanation: AlertExplanation = {
    rule_id: "RULE-HYPOXIA-CO2-MULTI-02",
    threshold_authority: "PROTOTYPE_DEMO_RULE_NOT_CLINICAL_STANDARD",
    prototype_disclaimer: PROTOTYPE_DISCLAIMER,
    evidence_block: evidenceObs,
    comparison_block: comparisons,
    context_block: {
      info_label: "MEASURED",
      cabin_co2_mmhg: co2Obs?.value ?? 5.4,
      radiation_msv_hr: getLatestValid("radiation_msv_hr")?.value ?? 0.023,
      concurrent_hrp_checkins: {
        sleep_duration_hrs_3d: [5.8, 5.5, 5.2],
        fatigue_score_latest: 7.8,
        visual_symptom_severity_latest: 3.0,
        intraocular_pressure_mmhg_latest: 18.2,
        caloric_intake_kcal_latest: 1950,
        hydration_ml_latest: 1750,
      },
      operational_schedule_note:
        "Habitat Node-2 carbon dioxide scrubber maintenance window active; 3-day crew sleep restriction and elevated fatigue logged in ARCheR check-in.",
    },
    reasoning_block: {
      info_label: "COMPUTED",
      rule_id: "RULE-HYPOXIA-CO2-MULTI-02",
      co_triggered_rules: [
        "RULE-CARDIO-TREND-01",
        "RULE-DATA-QUALITY-04",
        "RULE-ARCHER-SLEEP-FATIGUE-05",
        "RULE-FLUID-EYE-SANS-06",
        "RULE-NUTRITION-HYDRATION-07",
      ],
      formula_evaluated:
        "spo2_pct (92.4%) < 94.5% [p05: 97.2%] AND cabin_co2_mmhg (5.4 mmHg) > 4.5 mmHg [p95: 3.3 mmHg] AND respiration_rpm (22.0 rpm) > 19.0 rpm [p95: 16.5 rpm] over 45-minute window.",
      threshold_authority: "PROTOTYPE_DEMO_RULE_NOT_CLINICAL_STANDARD",
      prototype_disclaimer: PROTOTYPE_DISCLAIMER,
    },
    data_quality_block: {
      info_label: "COMPUTED",
      valid_evaluated_count: observations.filter((o) => o.quality_status === "VALID").length,
      estimated_evaluated_count: observations.filter((o) => o.quality_status === "ESTIMATED").length,
      stale_flagged_count: 1,
      impossible_quarantined_count: 1,
      quarantined_observation_ids: ["OBS-QUAL-IMPOSSIBLE-01"],
      stale_observation_ids: ["OBS-QUAL-STALE-01"],
      gate_summary:
        "1 impossible reading (heart_rate_bpm = -10.0 bpm) was quarantined by Stage 2 Validator and excluded from baseline/rule math; 1 stale reading (25 min old) was flagged.",
    },
    uncertainty_block:
      "Wearable pulse oximetry (SpO2) and ambient habitat CO2 telemetry cannot establish arterial blood gas values, carboxyhemoglobin levels, or intracranial pressure, and cannot exclude optical motion artifact. Human Flight Surgeon review and portable blood/gas verification are required.",
    references_block: matchedRefs,
    ai_narrative_summary: {
      text: optionalLlmEnabled
        ? "[Optional Local LLM Narrative Summary]: Over the past 45 minutes, simulated telemetry for Cdr. Elena Vance recorded a concurrent decline in SpO2 to 92.4% (vs. 98.2% personal baseline) alongside elevated cabin CO2 (5.4 mmHg) and respiration rate (22.0 rpm), with heart rate rising to 108.0 bpm. Multi-day HRP logs also note 3 days of reduced sleep (5.2 hrs) and elevated fatigue (7.8/10). Consider reviewing PROC-ENV-CO2-01 (scrubber bypass check and seated rest) per mission protocol."
        : "Deterministic Offline Template Summary: Multi-parameter shift detected under RULE-HYPOXIA-CO2-MULTI-02. SpO2 decreased to 92.4% (-5.8% below 14-day personal mean of 98.2%) while ambient Cabin CO2 reached 5.4 mmHg (+2.6 mmHg above baseline) and Heart Rate rose to 108.0 bpm (+40.0 bpm above baseline). Concurrent HRP check-in flags indicate 3-day sleep deficit and sub-target hydration. Review authorized prototype procedure PROC-ENV-CO2-01.",
      mode: optionalLlmEnabled ? "OPTIONAL_LOCAL_LLM" : "TEMPLATE_OFFLINE",
      info_label: "AI_ASSISTED",
      disclaimer:
        "AI-Assisted / Template Summary — Derived from deterministic rule output and NASA/CSA context; never a medical diagnosis or prescription.",
    },
  };

  // Post-action comparisons for Scene 5 & 6
  const postComparisons: Record<string, PostResponseTrend> = {};
  const isPostAction =
    scene === "SCENE_5_RESPONSE_FOLLOWUP" || scene === "SCENE_6_CONNECTIVITY_RESTORED";

  if (isPostAction) {
    (["heart_rate_bpm", "spo2_pct", "respiration_rpm", "cabin_co2_mmhg"] as ParameterName[]).forEach(
      (param) => {
        const pre = observations.filter(
          (o) =>
            o.parameter === param &&
            !o.is_quarantined &&
            o.context_metadata?.phase !== "POST_RESPONSE_FOLLOWUP"
        );
        const post = observations.filter(
          (o) =>
            o.parameter === param &&
            !o.is_quarantined &&
            o.context_metadata?.phase === "POST_RESPONSE_FOLLOWUP"
        );
        postComparisons[param] = evaluatePostResponseTrend(
          pre,
          post,
          param,
          SEEDED_BASELINE_PROFILE
        );
      }
    );
  }

  const auditLog: AuditLogEntry[] = [];
  const pushAudit = (entry: Omit<AuditLogEntry, "prev_hash" | "entry_hash">) => {
    const prevHash =
      auditLog.length > 0 ? auditLog[auditLog.length - 1].entry_hash : "0".repeat(64);
    const unsigned = { ...entry, prev_hash: prevHash };
    auditLog.push({
      ...unsigned,
      entry_hash: computeAuditEntryHash(unsigned),
    });
  };

  pushAudit({
    log_id: "AUD-001",
    incident_id: "INC-DEMO-001",
    timestamp: "2026-11-14T12:35:00Z",
    from_state: "NONE",
    to_state: "DETECTED",
    actor_id: "AEGIS-AUTONOMOUS-RULE-ENGINE",
    actor_role: "CREW_MEDICAL_OFFICER",
    notes: "Deterministic trigger: RULE-HYPOXIA-CO2-MULTI-02 + 4 co-triggered HRP/Quality rules.",
  });

  if (scene !== "SCENE_2_GRADUAL_ANOMALY") {
    pushAudit({
      log_id: "AUD-002",
      incident_id: "INC-DEMO-001",
      timestamp: "2026-11-14T12:38:00Z",
      from_state: "DETECTED",
      to_state: "REVIEWED",
      actor_id: "CMO-DR-PATEL",
      actor_role: "CREW_MEDICAL_OFFICER",
      notes: "Reviewed 7-part evidence explanation and baseline deviations.",
    });
  }

  const derivedDirection = isPostAction
    ? deriveOverallPostActionDirection(postComparisons)
    : null;

  if (isPostAction) {
    pushAudit({
      log_id: "AUD-003",
      incident_id: "INC-DEMO-001",
      timestamp: "2026-11-14T12:41:00Z",
      from_state: "REVIEWED",
      to_state: "ACKNOWLEDGED",
      actor_id: "CMO-DR-PATEL",
      actor_role: "CREW_MEDICAL_OFFICER",
      notes: "CMO PIN-authenticated acknowledgment recorded during offline operations.",
    });
    pushAudit({
      log_id: "AUD-004",
      incident_id: "INC-DEMO-001",
      timestamp: "2026-11-14T12:42:00Z",
      from_state: "ACKNOWLEDGED",
      to_state: "RESPONSE_RECORDED",
      actor_id: "CMO-DR-PATEL",
      actor_role: "CREW_MEDICAL_OFFICER",
      notes:
        "Recorded procedure PROC-ENV-CO2-01: Executed cabin CO2 scrubber bypass check and placed crew member on seated rest monitoring.",
    });
    pushAudit({
      log_id: "AUD-005",
      incident_id: "INC-DEMO-001",
      timestamp: "2026-11-14T12:43:00Z",
      from_state: "RESPONSE_RECORDED",
      to_state: "MONITORING",
      actor_id: "CMO-DR-PATEL",
      actor_role: "CREW_MEDICAL_OFFICER",
      notes: `Post-response trend evaluation active (direction: ${derivedDirection ?? "INSUFFICIENT_DATA"}).`,
    });
  }

  if (scene === "SCENE_6_CONNECTIVITY_RESTORED") {
    pushAudit({
      log_id: "AUD-006",
      incident_id: "INC-DEMO-001",
      timestamp: "2026-11-14T13:10:00Z",
      from_state: "MONITORING",
      to_state: "CLOSED_RETAINED",
      actor_id: "CMO-DR-PATEL",
      actor_role: "CREW_MEDICAL_OFFICER",
      notes:
        "Post-action recovery trend verified; incident closed and retained in persistent workspace archive.",
    });
  }

  const replayTimeline: Record<string, unknown>[] = [
    {
      step: 1,
      timestamp: "2026-11-14T12:00:00Z",
      event_type: "MEASURED_OBSERVATION_WINDOW",
      label: "MEASURED",
      title: "45-Minute Cardiorespiratory & Cabin CO2 Drift Observed",
      detail:
        "SpO2 drifted 97.8% → 92.4%, Cabin CO2 rose 3.1 → 5.4 mmHg, Heart Rate rose 74 → 108 bpm alongside 3-day HRP sleep/fatigue shift.",
    },
    {
      step: 2,
      timestamp: "2026-11-14T12:35:00Z",
      event_type: "DATA_QUALITY_QUARANTINE",
      label: "COMPUTED",
      title: "Stage 2 Data-Quality Gate Quarantined Impossible Reading",
      detail:
        "Rejected heart_rate_bpm = -10.0 bpm (OBS-QUAL-IMPOSSIBLE-01) and flagged 1 stale skin_temp_c reading (25 min old).",
    },
    {
      step: 3,
      timestamp: "2026-11-14T12:35:05Z",
      event_type: "INCIDENT_STATE_DETECTED",
      label: "COMPUTED",
      state: "DETECTED",
      title: "Incident INC-DEMO-001 Triggered (RULE-HYPOXIA-CO2-MULTI-02)",
      detail:
        "Deterministic multi-parameter rule triggered with HIGH severity; 7-part evidence explanation compiled.",
    },
  ];

  if (scene !== "SCENE_2_GRADUAL_ANOMALY") {
    replayTimeline.push({
      step: 4,
      timestamp: "2026-11-14T12:38:00Z",
      event_type: "INCIDENT_STATE_REVIEWED",
      label: "COMPUTED",
      state: "REVIEWED",
      title: "Evidence & NASA/CSA Research Context Reviewed (CMO-DR-PATEL)",
      detail:
        "Transitioned DETECTED → REVIEWED; verified baseline deviations and linked NASA HRP / CSA references.",
    });
  }

  if (
    scene === "SCENE_4_EARTH_UNAVAILABLE" ||
    scene === "SCENE_7_CONTINUITY_CMO_UNAVAILABLE" ||
    isPostAction
  ) {
    replayTimeline.push({
      step: 5,
      timestamp: "2026-11-14T12:39:30Z",
      event_type: "AUTONOMOUS_OFFLINE_CONTINUITY",
      label: "MEASURED",
      title: "Earth Deep-Space WAN Link Severed — Local Autonomous Continuity",
      detail:
        "Earth connectivity lost; local telemetry ingestion and incident history remained accessible onboard.",
    });
  }

  if (scene === "SCENE_7_CONTINUITY_CMO_UNAVAILABLE") {
    replayTimeline.push({
      step: 6,
      timestamp: "2026-11-14T12:40:00Z",
      event_type: "CONTINUITY_CMO_UNAVAILABLE",
      label: "COMPUTED",
      title: "CMO Unavailable — Continuity Mode Activated by Replacement Crew",
      detail:
        "Designated CMO marked unavailable; Cdr. Elena Vance (CREW_MEMBER) opened simplified Continuity workflow with CMO-gated clinical actions locked.",
    });
  }

  if (isPostAction) {
    replayTimeline.push(
      {
        step: 6,
        timestamp: "2026-11-14T12:41:00Z",
        event_type: "INCIDENT_STATE_ACKNOWLEDGED",
        label: "COMPUTED",
        state: "ACKNOWLEDGED",
        title: "CMO PIN-Authenticated Acknowledgment (CMO-DR-PATEL)",
        detail: "Transitioned REVIEWED → ACKNOWLEDGED with verified CMO role and PIN.",
      },
      {
        step: 7,
        timestamp: "2026-11-14T12:42:00Z",
        event_type: "INCIDENT_STATE_RESPONSE_RECORDED",
        label: "COMPUTED",
        state: "RESPONSE_RECORDED",
        title: "Authorized Prototype Procedure Recorded (PROC-ENV-CO2-01)",
        detail:
          "Executed cabin CO2 scrubber bypass check and placed crew member on seated rest monitoring. Automatic hot SQLite snapshot created.",
      },
      {
        step: 8,
        timestamp: "2026-11-14T12:43:00Z",
        event_type: "INCIDENT_STATE_MONITORING",
        label: "COMPUTED",
        state: "MONITORING",
        title: "Post-Response Follow-Up Evaluated as IMPROVING",
        detail:
          "Heart rate decreased 102 → 82 bpm, SpO2 recovered 93.4% → 96.8%, Cabin CO2 dropped 4.8 → 3.1 mmHg.",
      }
    );
  }

  if (scene === "SCENE_6_CONNECTIVITY_RESTORED") {
    replayTimeline.push({
      step: 9,
      timestamp: "2026-11-14T13:10:00Z",
      event_type: "INCIDENT_STATE_CLOSED_RETAINED",
      label: "COMPUTED",
      state: "CLOSED_RETAINED",
      title: "Incident Closed & Retained; Consultation Package Synced to Earth",
      detail:
        "Transitioned MONITORING → CLOSED_RETAINED; Earth WAN restored and PKG-DEMO-001 synced (PENDING → SYNCED) without deleting local SQLite records.",
    });
  }

  const syncStatus: SyncStatus =
    scene === "SCENE_6_CONNECTIVITY_RESTORED"
      ? "SYNCED"
      : isPostAction ||
        scene === "SCENE_4_EARTH_UNAVAILABLE" ||
        scene === "SCENE_7_CONTINUITY_CMO_UNAVAILABLE"
      ? "PENDING"
      : "LOCAL_ONLY";

  return [
    {
      incident_id: "INC-DEMO-001",
      astronaut_id: "AST-01-COMMANDER",
      created_at: "2026-11-14T12:35:00Z",
      updated_at: auditLog[auditLog.length - 1].timestamp,
      state: currentState,
      severity: "HIGH",
      title: "Multi-Parameter Cardiorespiratory & Cabin CO2 Shift + Multi-Day HRP Fatigue Pattern",
      rule_id: "RULE-HYPOXIA-CO2-MULTI-02",
      threshold_authority: "PROTOTYPE_DEMO_RULE_NOT_CLINICAL_STANDARD",
      evidence_observation_ids: evidenceObs.map((o) => o.observation_id),
      baseline_comparison: comparisons,
      data_quality_summary: explanation.data_quality_block,
      uncertainty_note: explanation.uncertainty_block,
      explanation,
      cited_resource_ids: matchedRefs.map((r) => r.resource_id),
      acknowledged_by: isPostAction ? "CMO-DR-PATEL" : null,
      acknowledged_role: isPostAction ? "CREW_MEDICAL_OFFICER" : null,
      acknowledged_at: isPostAction ? "2026-11-14T12:41:00Z" : null,
      authorized_action: isPostAction
        ? "Executed cabin CO2 scrubber bypass check and placed crew member on seated rest monitoring"
        : null,
      procedure_reference: isPostAction ? "PROC-ENV-CO2-01" : null,
      action_recorded_at: isPostAction ? "2026-11-14T12:42:00Z" : null,
      post_action_comparisons: postComparisons,
      post_action_direction: derivedDirection,
      sync_status: syncStatus,
      audit_log: auditLog,
      replay_timeline: replayTimeline,
    },
  ];
}

export function buildIncidentFromFinding(
  finding: DeterministicFinding,
  observations: TelemetryObservation[],
  baseline: BaselineProfile,
  optionalLlmEnabled: boolean,
  earthWanConnected = true
): IncidentRecord {
  const nowIso = new Date().toISOString();
  const shortSuffix = finding.rule_id.replace(/[^A-Z0-9]/g, "").slice(-6);
  const incidentId = `INC_${shortSuffix}_${Date.now().toString().slice(-5)}`;

  const evidenceObs = observations.filter((o) =>
    finding.contributing_observation_ids.includes(o.observation_id)
  );
  const latestOf = (param: ParameterName): TelemetryObservation | undefined => {
    const list = observations.filter((o) => o.parameter === param && !isObservationDegraded(o));
    return list[list.length - 1];
  };

  const matchedRefs = retrieveRelevantResources(
    CURATED_NASA_CSA_RESOURCES,
    finding.topic_tags
  ).slice(0, 4);
  const fallbackRefs =
    matchedRefs.length > 0 ? matchedRefs : CURATED_NASA_CSA_RESOURCES.slice(0, 2);

  const compTextList = Object.values(finding.baseline_comparison).map(
    (c) => `${c.parameter}: ${c.comparison_text}`
  );

  const formulaText =
    compTextList.length > 0
      ? `${finding.rule_id} evaluated [${compTextList.join(" | ")}]`
      : `${finding.rule_id}: ${finding.rule_name} (${finding.contributing_observation_ids.length} flagged observations)`;

  const explanation: AlertExplanation = {
    rule_id: finding.rule_id,
    threshold_authority: finding.threshold_authority,
    prototype_disclaimer: PROTOTYPE_DISCLAIMER,
    evidence_block: evidenceObs,
    comparison_block: finding.baseline_comparison,
    context_block: {
      info_label: "MEASURED",
      cabin_co2_mmhg: latestOf("cabin_co2_mmhg")?.value ?? null,
      radiation_msv_hr: latestOf("radiation_msv_hr")?.value ?? null,
      concurrent_hrp_checkins: {
        sleep_duration_hrs_latest: latestOf("sleep_duration_hrs")?.value ?? null,
        fatigue_score_latest: latestOf("fatigue_score")?.value ?? null,
        visual_symptom_severity_latest: latestOf("visual_symptom_severity")?.value ?? null,
        intraocular_pressure_mmhg_latest: latestOf("intraocular_pressure_mmhg")?.value ?? null,
        caloric_intake_kcal_latest: latestOf("caloric_intake_kcal")?.value ?? null,
        hydration_ml_latest: latestOf("hydration_ml")?.value ?? null,
      },
      operational_schedule_note: `Triggered from live telemetry & crew check-in window (${finding.time_window_start.slice(
        11,
        16
      )}–${finding.time_window_end.slice(11, 16)} UTC) for ${baseline.full_name}.`,
    },
    reasoning_block: {
      info_label: "COMPUTED",
      rule_id: finding.rule_id,
      co_triggered_rules: [],
      formula_evaluated: formulaText,
      threshold_authority: finding.threshold_authority,
      prototype_disclaimer: PROTOTYPE_DISCLAIMER,
    },
    data_quality_block: (() => {
      const dq = finding.data_quality_flags;
      const quarantinedIds = Array.isArray(dq.quarantined_ids)
        ? (dq.quarantined_ids as string[])
        : [];
      const estimatedCount = observations.filter((o) => o.quality_status === "ESTIMATED").length;
      return {
        info_label: "COMPUTED",
        valid_evaluated_count: observations.filter((o) => o.quality_status === "VALID").length,
        estimated_count: estimatedCount,
        estimated_evaluated_count: estimatedCount,
        stale_flagged_count: Number(dq.stale_count ?? 0),
        impossible_quarantined_count:
          Number(dq.impossible_count ?? 0) + Number(dq.corrupted_count ?? 0),
        quarantined_observation_ids: quarantinedIds,
        stale_observation_ids: observations
          .filter((o) => o.quality_status === "STALE")
          .map((o) => o.observation_id),
        gate_summary: `${quarantinedIds.length} degraded/quarantined reading(s) excluded from baseline calculations during Stage 2 Validation.`,
      };
    })(),
    uncertainty_block: finding.uncertainty_statement,
    references_block: fallbackRefs,
    ai_narrative_summary: {
      text: `${
        optionalLlmEnabled
          ? "[Optional Local LLM Template]"
          : "Deterministic Offline Template Summary"
      }: Rule ${finding.rule_id} (${finding.rule_name}) triggered for ${baseline.full_name} across ${
        evidenceObs.length
      } contributing observation(s). ${
        compTextList[0] ? `Primary comparison — ${compTextList[0]}. ` : ""
      }Human Crew Medical Officer review is required before approving an operational response.`,
      mode: optionalLlmEnabled ? "OPTIONAL_LOCAL_LLM" : "TEMPLATE_OFFLINE",
      info_label: "AI_ASSISTED",
      disclaimer:
        "AI-Assisted / Template Summary — Derived from deterministic rule output and NASA/CSA context; never a medical diagnosis or prescription.",
    },
  };

  const baseAudit = {
    log_id: "AUD-001",
    incident_id: incidentId,
    timestamp: nowIso,
    from_state: "NONE" as const,
    to_state: "DETECTED" as const,
    actor_id: "AEGIS-AUTONOMOUS-RULE-ENGINE",
    actor_role: "CREW_MEDICAL_OFFICER" as const,
    notes: `Deterministic rule trigger: ${finding.rule_id} (${finding.severity}).`,
    prev_hash: "0".repeat(64),
  };

  const auditEntry: AuditLogEntry = {
    ...baseAudit,
    entry_hash: computeAuditEntryHash(baseAudit),
  };

  return {
    incident_id: incidentId,
    astronaut_id: baseline.astronaut_id,
    created_at: nowIso,
    updated_at: nowIso,
    state: "DETECTED",
    severity: finding.severity,
    title: finding.rule_name,
    rule_id: finding.rule_id,
    threshold_authority: finding.threshold_authority,
    evidence_observation_ids: finding.contributing_observation_ids,
    baseline_comparison: finding.baseline_comparison,
    data_quality_summary: explanation.data_quality_block,
    uncertainty_note: explanation.uncertainty_block,
    explanation,
    cited_resource_ids: fallbackRefs.map((r) => r.resource_id),
    acknowledged_by: null,
    acknowledged_role: null,
    acknowledged_at: null,
    authorized_action: null,
    procedure_reference: null,
    action_recorded_at: null,
    post_action_comparisons: {},
    post_action_direction: null,
    sync_status: earthWanConnected ? "LOCAL_ONLY" : "PENDING",
    audit_log: [auditEntry],
    replay_timeline: [
      {
        step: 1,
        timestamp: nowIso,
        event_type: "INCIDENT_STATE_DETECTED",
        label: "COMPUTED",
        state: "DETECTED",
        title: `Incident ${incidentId} Triggered (${finding.rule_id})`,
        detail: `${finding.rule_name} detected from ${evidenceObs.length} valid observation(s).`,
      },
    ],
  };
}

export function buildConsultationQueueItem(
  incident: IncidentRecord,
  syncStatus: SyncStatus
): ConsultationQueueItem {
  const questions = [
    "1. Given the 45-minute cabin CO2 excursion (peak 5.4 mmHg) with concurrent SpO2 dip to 92.4% and subsequent post-scrubber recovery toward baseline (SpO2 96.8%, HR 82 bpm), do you recommend additional portable capnography or arterial blood gas spot-checking?",
    "2. Cdr. Vance has logged 3 consecutive days of sleep duration below her personal P05 band (5.8h, 5.5h, 5.2h vs. 7.5h target) with elevated fatigue (7.8/10); should non-critical payload maintenance tasks be deferred for a 24-hour circadian recovery window?",
    "3. Mild visual symptoms (3/10) and CMO tonometry IOP of 18.2 mmHg (vs. 14.5 mmHg baseline) were logged under RULE-FLUID-EYE-SANS-06; please advise on optical coherence tomography (OCT) scheduling and thigh-cuff protocol timing.",
  ];

  const markdownReport = `# AEGIS-V EARTH CONSULTATION PACKAGE (${incident.incident_id})
> **PROTOTYPE SAFETY NOTICE:** HACKATHON PROTOTYPE — DEMO THRESHOLDS & SIMULATED TELEMETRY UNLESS HMAC-VERIFIED.
> ${PROTOTYPE_DISCLAIMER}
> **Schema Version:** \`${SCHEMA_VERSION}\`

## 1. Astronaut & Mission Profile
- **Astronaut:** ${SEEDED_BASELINE_PROFILE.full_name} (\`${SEEDED_BASELINE_PROFILE.astronaut_id}\`)
- **Role / Mission:** ${SEEDED_BASELINE_PROFILE.mission_role}
- **Baseline Reference Window:** ${SEEDED_BASELINE_PROFILE.window_label}
- **Calibration Status:** \`${SEEDED_BASELINE_PROFILE.calibration_status}\`

## 2. Incident Summary
- **Incident ID:** \`${incident.incident_id}\`
- **Title:** ${incident.title}
- **Primary Rule Triggered:** \`${incident.rule_id}\` (Severity: \`${incident.severity}\`)
- **Lifecycle State:** \`${incident.state}\`
- **Sync Status:** \`${syncStatus}\`
- **Acknowledged By:** ${incident.acknowledged_by ?? "Pending acknowledgment"} (${incident.acknowledged_role ?? "N/A"})
- **Recorded Procedure:** ${incident.procedure_reference ?? "None recorded"} — ${incident.authorized_action ?? "N/A"}
- **Post-Action Direction:** \`${incident.post_action_direction ?? "INSUFFICIENT_DATA"}\`

## 3. Personal Baseline Comparison (COMPUTED)
${Object.values(incident.baseline_comparison)
  .map(
    (c) =>
      `- **${c.parameter}**: Current \`${c.current_value} ${c.unit}\` | Personal Baseline Mean \`${c.baseline_mean} ${c.unit}\` [P05–P95: \`${c.baseline_p05}–${c.baseline_p95}\`] | Delta: \`${c.absolute_delta >= 0 ? "+" : ""}${c.absolute_delta} ${c.unit}\` (\`z = ${c.z_score}σ\`)`
  )
  .join("\n")}

## 4. Before / After Post-Response Trend (COMPUTED)
${
  Object.values(incident.post_action_comparisons).length > 0
    ? Object.values(incident.post_action_comparisons)
        .map(
          (t) =>
            `- **${t.parameter}**: ${t.summary_text}\n  *Disclaimer: ${t.non_causal_disclaimer}*`
        )
        .join("\n")
    : "- No post-response trend recorded yet."
}

## 5. Data Quality & Uncertainty Statement
- **Uncertainty:** ${incident.uncertainty_note}
- **Data Quality Gate:** 1 impossible reading (\`-10.0 bpm\`) quarantined; 1 stale reading (\`25 min old\`) flagged.

## 6. Flight Surgeon Consultation Questions
${questions.join("\n")}

## 7. Cited NASA / CSA Research References
${incident.explanation.references_block
  .map(
    (r) =>
      `- **${r.title}** (${r.publisher}, ${r.publication_date}) — ${r.source_url}\n  *Scope Note:* ${r.evidence_note}`
  )
  .join("\n")}
`;

  return {
    package_id: `PKG-${incident.incident_id}`,
    incident_id: incident.incident_id,
    created_at: incident.updated_at,
    sync_status: syncStatus,
    last_attempt_at: syncStatus === "SYNCED" ? "2026-11-14T13:11:00Z" : "2026-11-14T12:45:00Z",
    error_message:
      syncStatus === "PENDING"
        ? "Awaiting Earth Deep-Space WAN link availability (local SQLite copy preserved)."
        : null,
    payload: {
      prototype_notice:
        "HACKATHON PROTOTYPE — DEMO THRESHOLDS & SIMULATED TELEMETRY UNLESS HMAC-VERIFIED",
      schema_version: SCHEMA_VERSION,
      generated_at: incident.updated_at,
      astronaut_profile: {
        astronaut_id: SEEDED_BASELINE_PROFILE.astronaut_id,
        full_name: SEEDED_BASELINE_PROFILE.full_name,
        mission: "Lunar Gateway Prototype",
        role: "Flight Engineer",
      },
      baseline_profile: SEEDED_BASELINE_PROFILE,
      incident_summary: {
        incident_id: incident.incident_id,
        title: incident.title,
        rule_id: incident.rule_id,
        severity: incident.severity,
        state: incident.state,
        created_at: incident.created_at,
        updated_at: incident.updated_at,
        authorized_action: incident.authorized_action,
        procedure_reference: incident.procedure_reference,
        post_action_direction: incident.post_action_direction,
      },
      contributing_observations: incident.explanation.evidence_block,
      data_quality_summary: incident.data_quality_summary,
      explanation: incident.explanation,
      post_action_comparisons: incident.post_action_comparisons,
      audit_log: incident.audit_log,
      flight_surgeon_questions: questions,
      markdown_report: markdownReport,
    },
  };
}

export function buildEarthHandoffConsultationItem(
  handoff: EarthHandoffPackageData,
  incident: IncidentRecord | undefined,
  syncStatus: SyncStatus
): ConsultationQueueItem {
  const baseIncident = incident || buildDemoIncidents("SCENE_1_NORMAL", [], false)[0];
  return {
    package_id: handoff.packageId,
    incident_id: handoff.incidentId,
    created_at: handoff.generatedAtIso,
    sync_status: syncStatus,
    last_attempt_at: syncStatus === "SYNCED" ? handoff.generatedAtIso : null,
    error_message:
      syncStatus === "PENDING"
        ? "Continuity Earth Handoff Package saved locally (PENDING until Earth link is restored)."
        : null,
    payload: {
      prototype_notice:
        "AEGIS-V EARTH HANDOFF PACKAGE (CONTINUITY MODE) — PROTOTYPE DECISION SUPPORT",
      schema_version: SCHEMA_VERSION,
      generated_at: handoff.generatedAtIso,
      astronaut_profile: {
        astronaut_id: handoff.astronautId,
        full_name: handoff.astronautName,
        mission: handoff.missionName,
        role: `${handoff.preparedByCrewId} (${handoff.preparedByRole})`,
      },
      baseline_profile: SEEDED_BASELINE_PROFILE,
      incident_summary: {
        incident_id: handoff.incidentId,
        title: `Earth Handoff Package — ${handoff.incidentTitle}`,
        rule_id: baseIncident?.rule_id || "RULE-HYPOXIA-CO2-MULTI-02",
        severity: baseIncident?.severity || "MODERATE",
        state: baseIncident?.state || "REVIEWED",
        created_at: baseIncident?.created_at || handoff.generatedAtIso,
        updated_at: handoff.generatedAtIso,
        authorized_action: handoff.crewRecordedActions[0] || "Continuity observation logged",
        procedure_reference:
          handoff.proceduresAccessed.map((p) => p.procedureId).join(", ") || "CONTINUITY-HANDOFF",
        post_action_direction: baseIncident?.post_action_direction ?? null,
      },
      contributing_observations: baseIncident?.explanation?.evidence_block || [],
      data_quality_summary: {
        continuityModeActive: handoff.continuityModeActive,
        cmoAvailabilityAtGeneration: handoff.cmoAvailabilityAtGeneration,
        earthCommsAtGeneration: handoff.earthCommsAtGeneration,
        warnings: handoff.dataQualityWarnings,
        availableResources: handoff.availableResourcesSummary,
        missingResources: handoff.missingResourcesSummary,
      },
      explanation: baseIncident?.explanation || {
        rule_id: "RULE-HYPOXIA-CO2-MULTI-02",
        threshold_authority: "PROTOTYPE_DEMO_RULE_NOT_CLINICAL_STANDARD",
        prototype_disclaimer: PROTOTYPE_DISCLAIMER,
        evidence_block: [],
        comparison_block: {},
        context_block: {},
        reasoning_block: {},
        data_quality_block: {},
        uncertainty_block: handoff.uncertaintyStatements.join(" "),
        references_block: [],
        ai_narrative_summary: {
          text: handoff.crewRecordedActions.join(" | "),
          mode: "TEMPLATE_OFFLINE",
          info_label: "AI_ASSISTED",
          disclaimer: PROTOTYPE_DISCLAIMER,
        },
      },
      post_action_comparisons: baseIncident?.post_action_comparisons || {},
      audit_log: baseIncident?.audit_log || [],
      flight_surgeon_questions: handoff.unansweredQuestions.slice(0, 12),
      markdown_report: handoff.markdownDocument.slice(0, 15900),
    },
  };
}

