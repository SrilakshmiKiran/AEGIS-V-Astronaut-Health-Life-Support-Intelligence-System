export const SCHEMA_VERSION = "2.2-CANONICAL-HRP-EXPANDED";

export const PROTOTYPE_DISCLAIMER =
  "Prototype demo logic — not a validated clinical threshold or medical diagnosis.";

export type InformationLabel = "MEASURED" | "COMPUTED" | "AI_ASSISTED";

export type DataSourceType =
  | "SIMULATED"
  | "VERIFIED_DEVICE"
  | "MANUAL_ENTRY"
  | "IMPORTED_RECORD";

export type CalibrationStatus =
  | "PROTOTYPE_SYNTHETIC_DEMO_NOT_CLINICALLY_VALIDATED"
  | "VERIFIED_DEVICE_PERSONAL_BASELINE_NON_DIAGNOSTIC";

export type ThresholdAuthority = "PROTOTYPE_DEMO_RULE_NOT_CLINICAL_STANDARD";

export type ActorRole =
  | "CREW_MEDICAL_OFFICER"
  | "CREW_MEMBER"
  | "MISSION_OBSERVER";

export type QualityStatus =
  | "VALID"
  | "ESTIMATED"
  | "MISSING"
  | "STALE"
  | "IMPOSSIBLE"
  | "CORRUPTED";

export type IncidentState =
  | "DETECTED"
  | "REVIEWED"
  | "ACKNOWLEDGED"
  | "RESPONSE_RECORDED"
  | "MONITORING"
  | "CLOSED_RETAINED";

export type SyncStatus = "LOCAL_ONLY" | "PENDING" | "SYNCED" | "ERROR";

export type PostActionDirection =
  | "IMPROVING"
  | "STABLE"
  | "WORSENING"
  | "INSUFFICIENT_DATA";

export type DemoSceneId =
  | "SCENE_1_NORMAL"
  | "SCENE_2_GRADUAL_ANOMALY"
  | "SCENE_3_EXPLAIN"
  | "SCENE_4_EARTH_UNAVAILABLE"
  | "SCENE_5_RESPONSE_FOLLOWUP"
  | "SCENE_6_CONNECTIVITY_RESTORED"
  | "SCENE_7_CONTINUITY_CMO_UNAVAILABLE";

export type RuleId =
  | "RULE-CARDIO-TREND-01"
  | "RULE-HYPOXIA-CO2-MULTI-02"
  | "RULE-RAD-EXPOSURE-03"
  | "RULE-DATA-QUALITY-04"
  | "RULE-ARCHER-SLEEP-FATIGUE-05"
  | "RULE-FLUID-EYE-SANS-06"
  | "RULE-NUTRITION-HYDRATION-07";

export type ParameterName =
  | "heart_rate_bpm"
  | "spo2_pct"
  | "systolic_bp_mmhg"
  | "diastolic_bp_mmhg"
  | "skin_temp_c"
  | "respiration_rpm"
  | "radiation_msv_hr"
  | "cabin_co2_mmhg"
  | "sleep_duration_hrs"
  | "sleep_quality_score"
  | "exercise_completion_pct"
  | "fatigue_score"
  | "visual_symptom_severity"
  | "intraocular_pressure_mmhg"
  | "thigh_cuff_adherence_pct"
  | "caloric_intake_kcal"
  | "hydration_ml"
  | "appetite_score";

export interface VerifiedHardwareDevice {
  device_id: string;
  device_model: string;
  manufacturer: string;
  supported_parameters: ParameterName[];
  sampling_rate_hz: number;
  hmac_secret_env_var: string;
  is_active: boolean;
}

export interface TelemetryObservation {
  observation_id: string;
  astronaut_id: string;
  timestamp: string;
  parameter: ParameterName;
  value: number | null;
  unit: string;
  source_type: DataSourceType;
  device_id?: string | null;
  device_hmac_verified: boolean;
  info_label: InformationLabel;
  quality_status: QualityStatus;
  quality_notes?: string | null;
  reference_target?: number | null;
  context_metadata?: Record<string, unknown> | null;
  is_quarantined: boolean;
}

export interface BaselineMetric {
  mean: number;
  std: number;
  p05: number;
  p95: number;
  sample_count: number;
  unit: string;
  authorized_target?: number | null;
}

export interface BaselineProfile {
  astronaut_id: string;
  full_name: string;
  mission_role: string;
  window_label: string;
  window_start: string;
  window_end: string;
  calibration_status: CalibrationStatus;
  prototype_disclaimer: string;
  metrics: Record<ParameterName, BaselineMetric>;
  info_label: InformationLabel;
}

export interface BaselineComparison {
  parameter: ParameterName;
  unit: string;
  baseline_window_label: string;
  baseline_mean: number;
  baseline_std: number;
  baseline_p05: number;
  baseline_p95: number;
  authorized_target?: number | null;
  current_value: number;
  absolute_delta: number;
  percent_delta: number;
  z_score: number;
  outside_p05_p95_band: boolean;
  comparison_text: string;
  info_label: "COMPUTED";
}

export interface DeterministicFinding {
  rule_id: RuleId;
  rule_name: string;
  threshold_authority: ThresholdAuthority;
  prototype_disclaimer: string;
  severity: "HIGH" | "MODERATE" | "ADVISORY";
  triggered: boolean;
  time_window_start: string;
  time_window_end: string;
  contributing_observation_ids: string[];
  measured_summary: Record<string, unknown>[];
  baseline_comparison: Record<ParameterName, BaselineComparison>;
  data_quality_flags: Record<string, unknown>;
  uncertainty_statement: string;
  topic_tags: string[];
  info_label: "COMPUTED";
}

export interface KnowledgeResource {
  resource_id: string;
  title: string;
  publisher: string;
  source_url: string;
  publication_date: string;
  topic_tags: string[];
  summary: string;
  evidence_note: string;
  review_status: string;
  category?: string;
}

export interface AlertExplanation {
  rule_id: RuleId;
  threshold_authority: ThresholdAuthority;
  prototype_disclaimer: string;
  evidence_block: TelemetryObservation[];
  comparison_block: Record<string, BaselineComparison>;
  context_block: Record<string, unknown>;
  reasoning_block: Record<string, unknown>;
  data_quality_block: Record<string, unknown>;
  uncertainty_block: string;
  references_block: KnowledgeResource[];
  ai_narrative_summary: {
    text: string;
    mode: "TEMPLATE_OFFLINE" | "OPTIONAL_LOCAL_LLM";
    info_label: "AI_ASSISTED";
    disclaimer: string;
  };
}

export interface AuditLogEntry {
  log_id: string;
  incident_id: string;
  timestamp: string;
  from_state: string;
  to_state: string;
  actor_id: string;
  actor_role: ActorRole;
  notes?: string | null;
  prev_hash: string;
  entry_hash: string;
}

export interface PostResponseTrend {
  parameter: ParameterName;
  unit: string;
  pre_action_mean: number;
  post_action_mean: number;
  post_action_latest: number;
  absolute_change: number;
  percent_change: number;
  post_action_slope_per_min: number;
  within_p05_p95_band: boolean;
  direction: PostActionDirection;
  summary_text: string;
  non_causal_disclaimer: string;
  info_label: "COMPUTED";
}

export interface IncidentRecord {
  incident_id: string;
  astronaut_id: string;
  created_at: string;
  updated_at: string;
  state: IncidentState;
  severity: string;
  title: string;
  rule_id: RuleId;
  threshold_authority: ThresholdAuthority;
  evidence_observation_ids: string[];
  baseline_comparison: Record<string, BaselineComparison>;
  data_quality_summary: Record<string, unknown>;
  uncertainty_note: string;
  explanation: AlertExplanation;
  cited_resource_ids: string[];
  acknowledged_by?: string | null;
  acknowledged_role?: ActorRole | null;
  acknowledged_at?: string | null;
  authorized_action?: string | null;
  procedure_reference?: string | null;
  action_recorded_at?: string | null;
  post_action_comparisons: Record<string, PostResponseTrend>;
  post_action_direction?: PostActionDirection | null;
  sync_status: SyncStatus;
  audit_log: AuditLogEntry[];
  replay_timeline: Record<string, unknown>[];
}

export type FreshnessStatus = "CURRENT" | "AGING" | "STALE" | "UNAVAILABLE";

export interface ParameterTelemetryStatus {
  parameter: ParameterName;
  unit: string;
  liveValue: number | null;
  lastValidValue: number | null;
  latestRawObservation: TelemetryObservation | null;
  lastValidObservation: TelemetryObservation | null;
  previousValidObservation: TelemetryObservation | null;
  lastObservationTimeIso: string | null;
  lastValidTimeIso: string | null;
  freshness: FreshnessStatus;
  freshnessLabel: string;
  ageMinutes: number | null;
  isStaleOrUnavailable: boolean;
  deltaSincePrevValid: number | null;
  deltaSummary: string;
  dataSufficiencyNote: string | null;
}

export type SubjectiveCheckinStatus =
  | "FEEL_NORMAL"
  | "SOMETHING_DIFFERENT"
  | "WORSE_THAN_USUAL"
  | "NEED_ASSISTANCE";

export const SUBJECTIVE_CHECKIN_LABELS: Record<SubjectiveCheckinStatus, string> = {
  FEEL_NORMAL: "I feel normal.",
  SOMETHING_DIFFERENT: "Something feels different.",
  WORSE_THAN_USUAL: "I feel worse than usual.",
  NEED_ASSISTANCE: "I need assistance.",
};

export interface SubjectiveCheckinEntry {
  recordId: string;
  crewId: string;
  statusCode: SubjectiveCheckinStatus;
  statusLabel: string;
  note: string | null;
  noteRedacted: boolean;
  submittedAtIso: string;
  submittedByRole: ActorRole;
  sourceLabel: "CREW_SUBJECTIVE_SELF_REPORT";
}

export interface InterruptedTaskSummary {
  kind: "INCIDENT_CHECKLIST" | "GUIDED_PROCEDURE";
  taskId: string;
  incidentId?: string;
  title: string;
  completedStepsCount: number;
  totalSteps: number;
  currentStepNumber: number;
  outstandingStepsCount: number;
  completedStepLabels: string[];
  outstandingStepLabels: string[];
  lastUpdatedIso: string;
  targetPage: "alerts-response" | "continuity";
}

export interface IncidentChecklistProgress {
  incidentId: string;
  completedSteps: string[];
  currentStepIndex: number;
  elapsedSec: number;
  totalSteps: number;
  updatedAtIso: string;
}

export interface ShiftHandoverSummaryData {
  astronautStatusHeadline: string;
  astronautStatusDetail: string;
  latestSubjectiveCheckin: SubjectiveCheckinEntry | null;
  activeIncidents: Array<{
    incidentId: string;
    title: string;
    severity: string;
    state: IncidentState;
    updatedAtIso: string;
  }>;
  recentSignificantChanges: Array<{
    parameter: ParameterName;
    label: string;
    latestValueText: string;
    deltaText: string;
    outsideBaseline: boolean;
    freshness: FreshnessStatus;
  }>;
  actionsRecorded: Array<{
    timestampIso: string;
    label: string;
    detail: string;
  }>;
  outstandingTasks: InterruptedTaskSummary[];
  routineRemainingTitles: string[];
  unresolvedDataQualityIssues: string[];
  informationGaps: string[];
  lastUpdateIso: string | null;
}

export interface TelemetryLatestResponse {
  astronaut_id: string;
  as_of_timestamp: string;
  stream_reference_timestamp?: string;
  latest_by_parameter: Record<ParameterName, TelemetryObservation>;
  baseline_comparisons: Record<ParameterName, BaselineComparison>;
  status_by_parameter?: Record<ParameterName, ParameterTelemetryStatus>;
  quality_counts: Record<QualityStatus, number>;
  quarantined_recent: TelemetryObservation[];
}

export interface TelemetryHistoryResponse {
  parameter: ParameterName;
  unit: string;
  baseline_metric: BaselineMetric;
  observations: TelemetryObservation[];
}

export interface SimulatorStatusResponse {
  active_scene: DemoSceneId;
  earth_wan_connected: boolean;
  optional_llm_enabled: boolean;
  data_source_mode: DataSourceType;
  total_observations: number;
  quarantined_observations: number;
}

export interface SystemHealthResponse {
  onboard_node_status: string;
  earth_wan_connected: boolean;
  active_scene: DemoSceneId;
  optional_llm_enabled: boolean;
  wal_mode_active: boolean;
  audit_chain_valid: boolean;
  db_counts: Record<string, number>;
  schema_version: string;
}

export interface ConsultationQueueItem {
  package_id: string;
  incident_id: string;
  created_at: string;
  sync_status: SyncStatus;
  last_attempt_at?: string | null;
  error_message?: string | null;
  payload: {
    prototype_notice: string;
    schema_version: string;
    generated_at: string;
    astronaut_profile: {
      astronaut_id: string;
      full_name: string;
      mission: string;
      role: string;
    };
    baseline_profile: BaselineProfile;
    incident_summary: {
      incident_id: string;
      title: string;
      rule_id: RuleId;
      severity: string;
      state: IncidentState;
      created_at: string;
      updated_at: string;
      authorized_action?: string | null;
      procedure_reference?: string | null;
      post_action_direction?: PostActionDirection | null;
    };
    contributing_observations: TelemetryObservation[];
    data_quality_summary: Record<string, unknown>;
    explanation: AlertExplanation;
    post_action_comparisons: Record<string, PostResponseTrend>;
    audit_log: AuditLogEntry[];
    flight_surgeon_questions: string[];
    markdown_report: string;
  };
}

export interface NutritionCatalogueItem {
  meal_id: string;
  name: string;
  caloric_intake_kcal: number;
  hydration_ml: number;
  category: string;
}

export const AUTHORIZED_PROTOTYPE_PROCEDURES: Record<string, string> = {
  "PROC-ENV-CO2-01":
    "Cabin CO2 Scrubber Bypass Check & Seated Crew Rest Monitoring [Simulated Prototype Procedure — Not Clinical Protocol]",
  "PROC-CARDIO-REST-02":
    "Scheduled Exertion Pause, Oral Hydration & 15-Min Repeat Bio-Monitor Check [Simulated Prototype Procedure — Not Clinical Protocol]",
  "PROC-RAD-SHELTER-03":
    "Storm Shelter Dosimetry Verification & Habitat Shielding Check [Simulated Prototype Procedure — Not Clinical Protocol]",
  "PROC-HRP-WELLNESS-04":
    "Crew Schedule Workload Adjustment, Thigh-Cuff Protocol Review & Nutrition/Hydration Target Check [Simulated Prototype Procedure — Not Clinical Protocol]",
};

export const PARAMETER_METADATA: Record<
  ParameterName,
  {
    label: string;
    shortLabel: string;
    unit: string;
    category: "CORE_VITAL" | "CORE_ENV" | "HRP_SLEEP" | "HRP_FLUID" | "HRP_NUTRITION";
    decimals: number;
  }
> = {
  heart_rate_bpm: {
    label: "Heart Rate",
    shortLabel: "HR",
    unit: "bpm",
    category: "CORE_VITAL",
    decimals: 1,
  },
  spo2_pct: {
    label: "Blood Oxygen (SpO2)",
    shortLabel: "SpO2",
    unit: "%",
    category: "CORE_VITAL",
    decimals: 1,
  },
  systolic_bp_mmhg: {
    label: "Systolic Blood Pressure",
    shortLabel: "Sys BP",
    unit: "mmHg",
    category: "CORE_VITAL",
    decimals: 0,
  },
  diastolic_bp_mmhg: {
    label: "Diastolic Blood Pressure",
    shortLabel: "Dia BP",
    unit: "mmHg",
    category: "CORE_VITAL",
    decimals: 0,
  },
  skin_temp_c: {
    label: "Skin Temperature",
    shortLabel: "Skin Temp",
    unit: "degC",
    category: "CORE_VITAL",
    decimals: 2,
  },
  respiration_rpm: {
    label: "Respiration Rate",
    shortLabel: "Resp Rate",
    unit: "rpm",
    category: "CORE_VITAL",
    decimals: 1,
  },
  radiation_msv_hr: {
    label: "Radiation Level",
    shortLabel: "Radiation",
    unit: "mSv/hr",
    category: "CORE_ENV",
    decimals: 3,
  },
  cabin_co2_mmhg: {
    label: "Cabin CO2 Level",
    shortLabel: "Cabin CO2",
    unit: "mmHg",
    category: "CORE_ENV",
    decimals: 2,
  },
  sleep_duration_hrs: {
    label: "Sleep Duration",
    shortLabel: "Sleep",
    unit: "hrs",
    category: "HRP_SLEEP",
    decimals: 1,
  },
  sleep_quality_score: {
    label: "Sleep Quality Score",
    shortLabel: "Sleep Qual",
    unit: "score_1_10",
    category: "HRP_SLEEP",
    decimals: 1,
  },
  exercise_completion_pct: {
    label: "Exercise Completion",
    shortLabel: "Exercise",
    unit: "%",
    category: "HRP_SLEEP",
    decimals: 0,
  },
  fatigue_score: {
    label: "Fatigue Score",
    shortLabel: "Fatigue",
    unit: "score_1_10",
    category: "HRP_SLEEP",
    decimals: 1,
  },
  visual_symptom_severity: {
    label: "Visual Symptom Severity",
    shortLabel: "Visual Symp",
    unit: "score_0_10",
    category: "HRP_FLUID",
    decimals: 1,
  },
  intraocular_pressure_mmhg: {
    label: "Intraocular Pressure (IOP)",
    shortLabel: "IOP",
    unit: "mmHg",
    category: "HRP_FLUID",
    decimals: 1,
  },
  thigh_cuff_adherence_pct: {
    label: "Thigh Cuff Adherence",
    shortLabel: "Thigh Cuff",
    unit: "%",
    category: "HRP_FLUID",
    decimals: 0,
  },
  caloric_intake_kcal: {
    label: "Caloric Intake",
    shortLabel: "Calories",
    unit: "kcal",
    category: "HRP_NUTRITION",
    decimals: 0,
  },
  hydration_ml: {
    label: "Hydration Intake",
    shortLabel: "Hydration",
    unit: "mL",
    category: "HRP_NUTRITION",
    decimals: 0,
  },
  appetite_score: {
    label: "Appetite Score",
    shortLabel: "Appetite",
    unit: "score_1_10",
    category: "HRP_NUTRITION",
    decimals: 1,
  },
};

export const CORE_8_PARAMETERS: ParameterName[] = [
  "heart_rate_bpm",
  "spo2_pct",
  "systolic_bp_mmhg",
  "diastolic_bp_mmhg",
  "skin_temp_c",
  "respiration_rpm",
  "radiation_msv_hr",
  "cabin_co2_mmhg",
];

export const ALL_18_PARAMETERS: ParameterName[] = [
  ...CORE_8_PARAMETERS,
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

export const EMERGENCY_CHECKLIST_STEPS: string[] = [
  "Verify sensor fit and cross-check SpO2 with second finger clip",
  "Inspect CDRA / CO2 scrubber fan differential pressure",
  "Direct crew member to seated rest and hydrate 250 mL",
  "Prepare Ground Flight Surgeon consultation packet if unrecovered in 15 min",
];

export type NavigationTabId =
  | "overview"
  | "live-monitor"
  | "health-intelligence"
  | "incident-detail"
  | "library"
  | "radiation"
  | "consultation"
  | "history-settings";
