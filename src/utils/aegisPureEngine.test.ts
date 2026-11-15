import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEarthHandoffPackage,
  buildShiftHandoverSummary,
  canConfirmEquipmentInventory,
  canSubmitSubjectiveCheckin,
  canViewPrivateCrewNotes,
  compareToBaseline,
  computeAuditEntryHash,
  deriveOverallPostActionDirection,
  evaluateMissionSupportStatus,
  evaluateParameterTelemetryStatus,
  evaluatePostResponseTrend,
  evaluateTelemetryWindow,
  extractIncidentChecklistProgressMap,
  extractInterruptedTasks,
  extractSubjectiveCheckinHistory,
  filterGuidedProcedures,
  formatMissionTimeUtc,
  isObservationDegraded,
  isProcedureAuthorized,
  matchResourcesForIncident,
  resolveEquipmentInventory,
  retrieveRelevantResources,
  sha256Hex,
  validateRoleAndPin,
  verifyAuditChain,
} from "./aegisPureEngine";
import {
  ALL_18_PARAMETERS,
  AuditLogEntry,
  BaselineComparison,
  BaselineProfile,
  EMERGENCY_CHECKLIST_STEPS,
  IncidentRecord,
  KnowledgeResource,
  ParameterName,
  ParameterTelemetryStatus,
  SCHEMA_VERSION,
  TelemetryObservation,
} from "../types/aegisContracts";
import {
  DEFAULT_CONTINUITY_STATE,
  GUIDED_PROCEDURES,
  ONBOARD_MEDICAL_EQUIPMENT,
  SCENE_7_CONTINUITY_INITIAL_STATE,
  SIMULATED_CREW_CAPABILITIES,
} from "../types/continuityContracts";
import {
  DEFAULT_OPS_STATE,
  OpsRecordDoc,
  RoutineGamificationState,
  SEEDED_CREW_ROSTER,
} from "../types/opsContracts";

const mockBaseline: BaselineProfile = {
  astronaut_id: "AST-01-COMMANDER",
  full_name: "Cdr. Elena Vance",
  mission_role: "Flight Engineer — Lunar Gateway Prototype",
  window_label: "14-Day Prototype Baseline (2026-10-30 to 2026-11-12) [SIMULATED]",
  window_start: "2026-10-30T00:00:00Z",
  window_end: "2026-11-12T23:59:59Z",
  calibration_status: "PROTOTYPE_SYNTHETIC_DEMO_NOT_CLINICALLY_VALIDATED",
  prototype_disclaimer:
    "Prototype demo logic — not a validated clinical threshold or medical diagnosis.",
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
    sleep_duration_hrs: { mean: 7.5, std: 0.4, p05: 6.8, p95: 8.2, sample_count: 14, unit: "hrs", authorized_target: 7.5 },
    sleep_quality_score: { mean: 8.0, std: 0.7, p05: 6.8, p95: 9.2, sample_count: 14, unit: "score_1_10" },
    exercise_completion_pct: { mean: 96.0, std: 5.0, p05: 85.0, p95: 100.0, sample_count: 14, unit: "%", authorized_target: 100.0 },
    fatigue_score: { mean: 2.5, std: 0.6, p05: 1.5, p95: 3.5, sample_count: 14, unit: "score_1_10" },
    visual_symptom_severity: { mean: 0.0, std: 0.2, p05: 0.0, p95: 0.5, sample_count: 14, unit: "score_0_10" },
    intraocular_pressure_mmhg: { mean: 14.5, std: 1.0, p05: 12.8, p95: 16.2, sample_count: 14, unit: "mmHg" },
    thigh_cuff_adherence_pct: { mean: 100.0, std: 2.0, p05: 95.0, p95: 100.0, sample_count: 14, unit: "%", authorized_target: 100.0 },
    caloric_intake_kcal: { mean: 2780.0, std: 120.0, p05: 2580.0, p95: 2980.0, sample_count: 14, unit: "kcal", authorized_target: 2800.0 },
    hydration_ml: { mean: 2480.0, std: 140.0, p05: 2250.0, p95: 2710.0, sample_count: 14, unit: "mL", authorized_target: 2500.0 },
    appetite_score: { mean: 8.2, std: 0.6, p05: 7.2, p95: 9.2, sample_count: 14, unit: "score_1_10" },
  },
};

function makeObs(
  id: string,
  parameter: ParameterName,
  value: number | null,
  timestamp: string,
  extra: Partial<TelemetryObservation> = {}
): TelemetryObservation {
  return {
    observation_id: id,
    astronaut_id: "AST-01-COMMANDER",
    timestamp,
    parameter,
    value,
    unit: mockBaseline.metrics[parameter].unit,
    source_type: "SIMULATED",
    device_hmac_verified: false,
    info_label: "MEASURED",
    quality_status: "VALID",
    is_quarantined: false,
    ...extra,
  };
}

test("canonical schema version matches 2.2-CANONICAL-HRP-EXPANDED", () => {
  assert.equal(SCHEMA_VERSION, "2.2-CANONICAL-HRP-EXPANDED");
});

test("compareToBaseline detects excursion outside p05-p95 band and computes z-score", () => {
  const hrObs = makeObs("OBS-1", "heart_rate_bpm", 102.0, "2026-11-14T10:00:00Z");
  const comp = compareToBaseline(hrObs, mockBaseline);
  assert.equal(comp.outside_p05_p95_band, true);
  assert.equal(comp.absolute_delta, 34.0);
  assert.equal(comp.info_label, "COMPUTED");
  assert.ok(comp.z_score > 7.0);
});

test("evaluatePostResponseTrend classifies IMPROVING, WORSENING, STABLE, INSUFFICIENT_DATA accurately even when unsorted", () => {
  const preObs = [
    makeObs("PRE-2", "heart_rate_bpm", 108, "2026-11-14T10:05:00Z"),
    makeObs("PRE-1", "heart_rate_bpm", 104, "2026-11-14T10:00:00Z"),
  ];
  const improvingPost = [
    makeObs("POST-2", "heart_rate_bpm", 82, "2026-11-14T10:25:00Z"),
    makeObs("POST-1", "heart_rate_bpm", 92, "2026-11-14T10:15:00Z"),
  ];
  const worseningPost = [
    makeObs("POST-3", "heart_rate_bpm", 110, "2026-11-14T10:15:00Z"),
    makeObs("POST-4", "heart_rate_bpm", 118, "2026-11-14T10:25:00Z"),
  ];
  const stablePost = [
    makeObs("POST-5", "heart_rate_bpm", 106, "2026-11-14T10:15:00Z"),
    makeObs("POST-6", "heart_rate_bpm", 106.5, "2026-11-14T10:25:00Z"),
  ];

  const trendImp = evaluatePostResponseTrend(preObs, improvingPost, "heart_rate_bpm", mockBaseline);
  assert.equal(trendImp.direction, "IMPROVING");
  assert.equal(trendImp.within_p05_p95_band, false);
  assert.ok(trendImp.post_action_slope_per_min < 0);
  assert.ok(trendImp.non_causal_disclaimer.includes("does not claim causation"));

  const trendWorse = evaluatePostResponseTrend(preObs, worseningPost, "heart_rate_bpm", mockBaseline);
  assert.equal(trendWorse.direction, "WORSENING");
  assert.ok(trendWorse.summary_text.includes("moved further"));
  assert.equal(trendWorse.summary_text.includes("moved closer"), false);

  const trendStable = evaluatePostResponseTrend(preObs, stablePost, "heart_rate_bpm", mockBaseline);
  assert.equal(trendStable.direction, "STABLE");
  assert.ok(trendStable.summary_text.includes("remained near pre-action level"));

  const trendInsuff = evaluatePostResponseTrend(
    preObs,
    [improvingPost[0]],
    "heart_rate_bpm",
    mockBaseline
  );
  assert.equal(trendInsuff.direction, "INSUFFICIENT_DATA");

  assert.equal(deriveOverallPostActionDirection({ heart_rate_bpm: trendWorse, spo2_pct: trendImp }), "WORSENING");
  assert.equal(deriveOverallPostActionDirection({ heart_rate_bpm: trendImp, spo2_pct: trendStable }), "IMPROVING");
  assert.equal(deriveOverallPostActionDirection({ heart_rate_bpm: trendStable }), "STABLE");
  assert.equal(deriveOverallPostActionDirection({ heart_rate_bpm: trendInsuff }), "INSUFFICIENT_DATA");
});

test("RULE-CARDIO-TREND-01 requires >=3 consecutive VALID high readings spanning >=15 min with positive slope", () => {
  // Positive case: 3 readings over 20 minutes rising 98 -> 104 -> 110
  const positive = evaluateTelemetryWindow(
    [
      makeObs("HR-1", "heart_rate_bpm", 98, "2026-11-14T10:00:00Z"),
      makeObs("HR-2", "heart_rate_bpm", 104, "2026-11-14T10:10:00Z"),
      makeObs("HR-3", "heart_rate_bpm", 110, "2026-11-14T10:20:00Z"),
    ],
    mockBaseline
  );
  assert.ok(positive.some((f) => f.rule_id === "RULE-CARDIO-TREND-01"));

  // Negative case 1: span < 15 minutes (10 minutes total)
  const shortSpan = evaluateTelemetryWindow(
    [
      makeObs("HR-1", "heart_rate_bpm", 98, "2026-11-14T10:00:00Z"),
      makeObs("HR-2", "heart_rate_bpm", 104, "2026-11-14T10:05:00Z"),
      makeObs("HR-3", "heart_rate_bpm", 110, "2026-11-14T10:10:00Z"),
    ],
    mockBaseline
  );
  assert.equal(shortSpan.some((f) => f.rule_id === "RULE-CARDIO-TREND-01"), false);

  // Negative case 2: negative slope (recovering 110 -> 104 -> 98)
  const falling = evaluateTelemetryWindow(
    [
      makeObs("HR-1", "heart_rate_bpm", 110, "2026-11-14T10:00:00Z"),
      makeObs("HR-2", "heart_rate_bpm", 104, "2026-11-14T10:10:00Z"),
      makeObs("HR-3", "heart_rate_bpm", 98, "2026-11-14T10:20:00Z"),
    ],
    mockBaseline
  );
  assert.equal(falling.some((f) => f.rule_id === "RULE-CARDIO-TREND-01"), false);
});

test("RULE-HYPOXIA-CO2-MULTI-02 requires shared 30-min window and triggers DATA-QUALITY-04 for degraded telemetry", () => {
  const sameWindowObs: TelemetryObservation[] = [
    makeObs("O-1", "spo2_pct", 92.4, "2026-11-14T10:00:00Z"),
    makeObs("O-2", "cabin_co2_mmhg", 5.4, "2026-11-14T10:15:00Z"),
    makeObs("O-3", "respiration_rpm", 15.0, "2026-11-14T09:30:00Z", {
      quality_status: "STALE",
    }),
    makeObs("O-4", "heart_rate_bpm", -10.0, "2026-11-14T10:00:00Z", {
      quality_status: "IMPOSSIBLE",
      is_quarantined: true,
    }),
  ];

  const findings = evaluateTelemetryWindow(sameWindowObs, mockBaseline);
  const ruleIds = findings.map((f) => f.rule_id);
  assert.ok(ruleIds.includes("RULE-HYPOXIA-CO2-MULTI-02"));
  assert.ok(ruleIds.includes("RULE-DATA-QUALITY-04"));

  // Negative case: SpO2 low at 10:00 and CO2 high 4 hours later (>30 min window)
  const separateWindowObs = [
    makeObs("O-1", "spo2_pct", 92.4, "2026-11-14T10:00:00Z"),
    makeObs("O-2", "cabin_co2_mmhg", 5.4, "2026-11-14T14:00:00Z"),
  ];
  const sepFindings = evaluateTelemetryWindow(separateWindowObs, mockBaseline);
  assert.equal(sepFindings.some((f) => f.rule_id === "RULE-HYPOXIA-CO2-MULTI-02"), false);
});

test("RULE-RAD-EXPOSURE-03 and unsigned VERIFIED_DEVICE quarantine check", () => {
  const unsigned = makeObs("U-1", "heart_rate_bpm", 78, "2026-11-14T10:00:00Z", {
    source_type: "VERIFIED_DEVICE",
    device_hmac_verified: false,
  });
  assert.equal(isObservationDegraded(unsigned), true);

  const findings = evaluateTelemetryWindow(
    [
      makeObs("RAD-1", "radiation_msv_hr", 0.18, "2026-11-14T10:00:00Z"),
      unsigned,
      makeObs("STALE-1", "skin_temp_c", 36.6, "2026-11-14T09:00:00Z", {
        quality_status: "STALE",
      }),
    ],
    mockBaseline
  );
  assert.ok(findings.some((f) => f.rule_id === "RULE-RAD-EXPOSURE-03"));
  assert.ok(findings.some((f) => f.rule_id === "RULE-DATA-QUALITY-04"));
});

test("RULE-ARCHER-SLEEP-FATIGUE-05 requires >=24h span across 3 sleep logs plus high fatigue and low exercise", () => {
  const multiDay = evaluateTelemetryWindow(
    [
      makeObs("SL-1", "sleep_duration_hrs", 5.8, "2026-11-12T08:00:00Z"),
      makeObs("SL-2", "sleep_duration_hrs", 5.5, "2026-11-13T08:00:00Z"),
      makeObs("SL-3", "sleep_duration_hrs", 5.2, "2026-11-14T08:00:00Z"),
      makeObs("FAT-1", "fatigue_score", 7.8, "2026-11-14T08:00:00Z"),
      makeObs("EX-1", "exercise_completion_pct", 65.0, "2026-11-14T08:00:00Z"),
    ],
    mockBaseline
  );
  assert.ok(multiDay.some((f) => f.rule_id === "RULE-ARCHER-SLEEP-FATIGUE-05"));

  const sameHour = evaluateTelemetryWindow(
    [
      makeObs("SL-1", "sleep_duration_hrs", 5.8, "2026-11-14T08:00:00Z"),
      makeObs("SL-2", "sleep_duration_hrs", 5.5, "2026-11-14T08:05:00Z"),
      makeObs("SL-3", "sleep_duration_hrs", 5.2, "2026-11-14T08:10:00Z"),
      makeObs("FAT-1", "fatigue_score", 7.8, "2026-11-14T08:10:00Z"),
      makeObs("EX-1", "exercise_completion_pct", 65.0, "2026-11-14T08:10:00Z"),
    ],
    mockBaseline
  );
  assert.equal(sameHour.some((f) => f.rule_id === "RULE-ARCHER-SLEEP-FATIGUE-05"), false);
});

test("RULE-FLUID-EYE-SANS-06 and RULE-NUTRITION-HYDRATION-07 trigger with numeric summaries", () => {
  const findings = evaluateTelemetryWindow(
    [
      makeObs("VIS-1", "visual_symptom_severity", 2.0, "2026-11-13T08:00:00Z"),
      makeObs("VIS-2", "visual_symptom_severity", 3.0, "2026-11-14T08:00:00Z"),
      makeObs("IOP-1", "intraocular_pressure_mmhg", 18.2, "2026-11-14T08:00:00Z"),
      makeObs("CAL-1", "caloric_intake_kcal", 2100, "2026-11-13T18:00:00Z", {
        quality_status: "ESTIMATED",
      }),
      makeObs("CAL-2", "caloric_intake_kcal", 1950, "2026-11-14T12:00:00Z", {
        quality_status: "ESTIMATED",
      }),
      makeObs("HYD-1", "hydration_ml", 1800, "2026-11-13T18:00:00Z"),
      makeObs("HYD-2", "hydration_ml", 1750, "2026-11-14T12:00:00Z"),
      makeObs("APP-1", "appetite_score", 4.5, "2026-11-14T12:00:00Z"),
      makeObs("FAT-1", "fatigue_score", 7.5, "2026-11-14T12:00:00Z"),
    ],
    mockBaseline
  );
  assert.ok(findings.some((f) => f.rule_id === "RULE-FLUID-EYE-SANS-06"));
  assert.ok(findings.some((f) => f.rule_id === "RULE-NUTRITION-HYDRATION-07"));
});

test("sha256Hex, computeAuditEntryHash, and verifyAuditChain detect tampering", () => {
  assert.equal(
    sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );

  const genesis = "0".repeat(64);
  const base1 = {
    log_id: "AUD-001",
    incident_id: "INC-1",
    timestamp: "2026-11-14T12:00:00Z",
    from_state: "NONE" as const,
    to_state: "DETECTED" as const,
    actor_id: "ENGINE",
    actor_role: "CREW_MEDICAL_OFFICER" as const,
    notes: "Detected",
    prev_hash: genesis,
  };
  const h1 = computeAuditEntryHash(base1);
  const e1: AuditLogEntry = { ...base1, entry_hash: h1 };

  const base2 = {
    log_id: "AUD-002",
    incident_id: "INC-1",
    timestamp: "2026-11-14T12:05:00Z",
    from_state: "DETECTED" as const,
    to_state: "REVIEWED" as const,
    actor_id: "CMO-DR-PATEL",
    actor_role: "CREW_MEDICAL_OFFICER" as const,
    notes: "Reviewed",
    prev_hash: h1,
  };
  const h2 = computeAuditEntryHash(base2);
  const e2: AuditLogEntry = { ...base2, entry_hash: h2 };

  assert.equal(verifyAuditChain([e1, e2]).valid, true);
  assert.equal(verifyAuditChain([e1, { ...e2, notes: "Tampered" }]).valid, false);
  assert.equal(verifyAuditChain([e1, { ...e2, notes: "Tampered" }]).brokenAtLogId, "AUD-002");
});

test("validateRoleAndPin enforces fail-closed RBAC and PIN 2026", () => {
  assert.equal(validateRoleAndPin(null, "", ["CREW_MEDICAL_OFFICER"], true).status, 401);
  assert.equal(
    validateRoleAndPin("MISSION_OBSERVER", "2026", ["CREW_MEDICAL_OFFICER"], true).status,
    403
  );
  assert.equal(
    validateRoleAndPin("CREW_MEDICAL_OFFICER", "9999", ["CREW_MEDICAL_OFFICER"], true).status,
    403
  );
  assert.equal(
    validateRoleAndPin("CREW_MEDICAL_OFFICER", "2026", ["CREW_MEDICAL_OFFICER"], true).status,
    200
  );
});

test("retrieveRelevantResources filters by topic tag and search query", () => {
  const sampleResources: KnowledgeResource[] = [
    {
      resource_id: "CSA-RAD-04",
      title: "Monitoring radiation for astronaut health",
      publisher: "Canadian Space Agency (CSA)",
      source_url: "https://www.asc-csa.gc.ca/",
      publication_date: "2026-02-26",
      topic_tags: ["radiation", "dosimetry"],
      summary: "CSA dosimetry context.",
      evidence_note: "General context.",
      review_status: "Reviewed",
    },
  ];
  assert.equal(retrieveRelevantResources(sampleResources, ["radiation"]).length, 1);
  assert.equal(retrieveRelevantResources(sampleResources, ["nutrition"]).length, 0);
});

test("isProcedureAuthorized locks CMO procedures when CMO unavailable or operator is non-CMO", () => {
  const cmoProc = GUIDED_PROCEDURES.find((p) => p.procedureId === "PROC-CMO-CLINICAL-05")!;
  const crewProc = GUIDED_PROCEDURES.find((p) => p.procedureId === "PROC-ENV-CO2-01")!;

  assert.equal(isProcedureAuthorized(crewProc, "CREW_MEMBER", false).allowed, true);
  assert.equal(isProcedureAuthorized(crewProc, "MISSION_OBSERVER", false).allowed, false);

  assert.equal(isProcedureAuthorized(cmoProc, "CREW_MEMBER", true).allowed, false);
  assert.equal(isProcedureAuthorized(cmoProc, "CREW_MEDICAL_OFFICER", false).allowed, false);
  assert.equal(isProcedureAuthorized(cmoProc, "CREW_MEDICAL_OFFICER", true).allowed, true);
});

test("filterGuidedProcedures supports offline keyword search and authorization filters", () => {
  const authOnly = filterGuidedProcedures(
    GUIDED_PROCEDURES,
    "",
    "AUTHORIZED_ONLY",
    "CREW_MEMBER",
    false
  );
  assert.equal(authOnly.some((p) => p.requiresCmo), false);
  assert.equal(authOnly.length, 4);

  const co2Search = filterGuidedProcedures(GUIDED_PROCEDURES, "scrubber", "ALL", "CREW_MEMBER", false);
  assert.equal(co2Search.length, 1);
  assert.equal(co2Search[0].procedureId, "PROC-ENV-CO2-01");
});

test("matchResourcesForIncident surfaces available and missing/unavailable equipment and Med Kit consumables", () => {
  const mockMedRecords: OpsRecordDoc[] = [
    {
      ownerId: "u1",
      recordId: "MED_ARTIFICIAL_TEARS",
      recordType: "MED_LOG",
      crewId: "AST-01-COMMANDER",
      title: "Preservative-Free Ocular Drops",
      status: "STOCKED",
      timestampIso: "2026-11-14T10:00:00Z",
      payload: { stockQty: 24, unit: "vials", expiresOn: "2027-06" },
    },
    {
      ownerId: "u1",
      recordId: "MED_MODAFINIL",
      recordType: "MED_LOG",
      crewId: "AST-01-COMMANDER",
      title: "Modafinil 100mg (CMO Controlled)",
      status: "LOW_STOCK",
      timestampIso: "2026-11-14T10:00:00Z",
      payload: { stockQty: 8, unit: "tabs", expiresOn: "2026-11" },
    },
  ];
  const mockIncident = {
    incident_id: "INC-1",
    rule_id: "RULE-HYPOXIA-CO2-MULTI-02",
  } as IncidentRecord;

  const match = matchResourcesForIncident(
    mockIncident,
    ONBOARD_MEDICAL_EQUIPMENT,
    {},
    mockMedRecords,
    GUIDED_PROCEDURES
  );
  assert.ok(match.availableEquipment.some((e) => e.equipmentId === "EQ-OXIMETER-02"));
  assert.ok(match.unavailableOrLimitedEquipment.some((e) => e.equipmentId === "EQ-CAPNOGRAPHY-06"));
  assert.ok(match.availableConsumables.some((m) => m.recordId === "MED_MODAFINIL" && m.cmoControlled));
});

test("evaluateMissionSupportStatus and buildEarthHandoffPackage surface explicit gaps without fake readiness scores", () => {
  const status = evaluateMissionSupportStatus({
    earthWanConnected: false,
    browserOnline: true,
    cmoAvailable: false,
    continuityActive: true,
    operatorRole: "CREW_MEMBER",
    replacementOperatorName: "Cdr. Elena Vance",
    crewRoster: SEEDED_CREW_ROSTER,
    crewCapabilities: SIMULATED_CREW_CAPABILITIES,
    crewAvailabilityOverrides: { "AST-02-FE-PILOT": "UNAVAILABLE" },
    equipmentList: ONBOARD_MEDICAL_EQUIPMENT,
    equipmentOverrides: {},
    procedures: GUIDED_PROCEDURES,
    offlineResourcesCount: 8,
    medRecords: [],
  });
  assert.equal(status.earthCommsStatus, "UNAVAILABLE");
  assert.equal(status.cmoStatus, "UNAVAILABLE");
  assert.equal(status.lockedProcedureCount, 1);
  assert.ok(status.unavailableOrMissingItems.some((item) => item.includes("Capnography")));
  assert.ok(status.uncertaintiesAndGaps.length >= 2);

  const handoff = buildEarthHandoffPackage({
    incident: undefined,
    baseline: mockBaseline,
    observations: [makeObs("OBS-1", "spo2_pct", 92.4, "2026-11-14T12:00:00Z")],
    opsState: { ownerId: "u1", ...DEFAULT_OPS_STATE },
    continuityState: SCENE_7_CONTINUITY_INITIAL_STATE,
    operatorRole: "CREW_MEMBER",
    crewRoster: SEEDED_CREW_ROSTER,
    checklistLogs: [],
    medRecords: [],
    equipmentList: ONBOARD_MEDICAL_EQUIPMENT,
    procedures: GUIDED_PROCEDURES,
    earthWanConnected: false,
    missionName: "Lunar Gateway Prototype",
  });
  assert.ok(handoff.markdownDocument.includes("AEGIS-V EARTH HANDOFF PACKAGE"));
  assert.equal(handoff.earthCommsAtGeneration, "UNAVAILABLE");
  assert.equal(handoff.cmoAvailabilityAtGeneration, "UNAVAILABLE");
  assert.ok(handoff.proceduresAccessed.some((p) => p.procedureId === "PROC-ENV-CO2-01"));
});

test("evaluateParameterTelemetryStatus enforces freshness gates, never shows stale/rejected as live, and computes deltas & insufficiency notes", () => {
  assert.equal(formatMissionTimeUtc("2026-11-14T12:05:30Z"), "2026-11-14 12:05 UTC");
  assert.equal(formatMissionTimeUtc(null), "Not recorded");

  const refNow = "2026-11-14T12:00:00Z";

  // 1. CURRENT (10m old) with 2 valid readings -> computes delta
  const hrCurrent = evaluateParameterTelemetryStatus(
    [
      makeObs("H1", "heart_rate_bpm", 68, "2026-11-14T11:40:00Z"),
      makeObs("H2", "heart_rate_bpm", 74, "2026-11-14T11:50:00Z"),
    ],
    "heart_rate_bpm",
    mockBaseline,
    refNow
  );
  assert.equal(hrCurrent.freshness, "CURRENT");
  assert.equal(hrCurrent.isStaleOrUnavailable, false);
  assert.equal(hrCurrent.liveValue, 74);
  assert.equal(hrCurrent.deltaSincePrevValid, 6);
  assert.equal(hrCurrent.dataSufficiencyNote, null);

  // 2. AGING (30m old) with 1 valid reading -> insufficient history note
  const spo2Aging = evaluateParameterTelemetryStatus(
    [makeObs("S1", "spo2_pct", 98.1, "2026-11-14T11:30:00Z")],
    "spo2_pct",
    mockBaseline,
    refNow
  );
  assert.equal(spo2Aging.freshness, "AGING");
  assert.equal(spo2Aging.isStaleOrUnavailable, false);
  assert.equal(spo2Aging.liveValue, 98.1);
  assert.ok(spo2Aging.dataSufficiencyNote?.includes("< 2") === false);
  assert.ok(spo2Aging.dataSufficiencyNote?.includes("Insufficient history"));

  // 3. STALE due to age (>60m) -> liveValue MUST be null, lastValidValue preserved
  const co2AgedStale = evaluateParameterTelemetryStatus(
    [makeObs("C1", "cabin_co2_mmhg", 3.1, "2026-11-14T10:15:00Z")],
    "cabin_co2_mmhg",
    mockBaseline,
    refNow
  );
  assert.equal(co2AgedStale.freshness, "STALE");
  assert.equal(co2AgedStale.isStaleOrUnavailable, true);
  assert.equal(co2AgedStale.liveValue, null);
  assert.equal(co2AgedStale.lastValidValue, 3.1);

  // 4. STALE due to newer degraded/rejected packet -> liveValue MUST be null, lastValidValue preserved
  const newerRejected = evaluateParameterTelemetryStatus(
    [
      makeObs("R1", "skin_temp_c", 36.5, "2026-11-14T11:45:00Z"),
      makeObs("R2", "skin_temp_c", 36.7, "2026-11-14T11:55:00Z"),
      makeObs("R3", "skin_temp_c", 99.0, "2026-11-14T11:59:00Z", {
        quality_status: "IMPOSSIBLE",
        is_quarantined: true,
      }),
    ],
    "skin_temp_c",
    mockBaseline,
    refNow
  );
  assert.equal(newerRejected.freshness, "STALE");
  assert.equal(newerRejected.isStaleOrUnavailable, true);
  assert.equal(newerRejected.liveValue, null);
  assert.equal(newerRejected.lastValidValue, 36.7);
  assert.equal(newerRejected.lastObservationTimeIso, "2026-11-14T11:59:00Z");
  assert.equal(newerRejected.lastValidTimeIso, "2026-11-14T11:55:00Z");
  assert.equal(newerRejected.deltaSincePrevValid, 0.2);

  // 5. UNAVAILABLE when no observations exist
  const unavail = evaluateParameterTelemetryStatus([], "respiration_rpm", mockBaseline, refNow);
  assert.equal(unavail.freshness, "UNAVAILABLE");
  assert.equal(unavail.liveValue, null);
  assert.equal(unavail.lastValidValue, null);
  assert.ok(unavail.dataSufficiencyNote?.includes("Insufficient data"));
});

test("Subjective crew check-in enforces RBAC write permissions and note privacy", () => {
  assert.equal(canSubmitSubjectiveCheckin("CREW_MEMBER"), true);
  assert.equal(canSubmitSubjectiveCheckin("CREW_MEDICAL_OFFICER"), true);
  assert.equal(canSubmitSubjectiveCheckin("MISSION_OBSERVER"), false);
  assert.equal(canViewPrivateCrewNotes("MISSION_OBSERVER"), false);
  assert.equal(canConfirmEquipmentInventory("MISSION_OBSERVER"), false);
  assert.equal(canConfirmEquipmentInventory("CREW_MEMBER"), true);

  const records: OpsRecordDoc[] = [
    {
      ownerId: "u1",
      recordId: "SUBJ_1",
      recordType: "BIO_EXTENDED",
      crewId: "AST-01-COMMANDER",
      title: "Subjective Check-In: Something feels different.",
      status: "SOMETHING_DIFFERENT",
      timestampIso: "2026-11-14T11:45:00Z",
      payload: {
        kind: "SUBJECTIVE_CHECKIN",
        statusCode: "SOMETHING_DIFFERENT",
        statusLabel: "Something feels different.",
        note: "Mild temple pressure after EVA.",
        submittedByRole: "CREW_MEMBER",
      },
    },
  ];

  const crewView = extractSubjectiveCheckinHistory(records, "CREW_MEMBER");
  assert.equal(crewView.length, 1);
  assert.equal(crewView[0].sourceLabel, "CREW_SUBJECTIVE_SELF_REPORT");
  assert.equal(crewView[0].noteRedacted, false);
  assert.equal(crewView[0].note, "Mild temple pressure after EVA.");

  const observerView = extractSubjectiveCheckinHistory(records, "MISSION_OBSERVER");
  assert.equal(observerView[0].noteRedacted, true);
  assert.ok(observerView[0].note?.includes("restricted"));
});

test("Task resumption, equipment confirmation overrides, and shift handover summary aggregate accurately", () => {
  const obsList: TelemetryObservation[] = [
    makeObs("O-HR1", "heart_rate_bpm", 70, "2026-11-14T11:40:00Z"),
    makeObs("O-HR2", "heart_rate_bpm", 86, "2026-11-14T11:55:00Z"),
    makeObs("O-CO2-1", "cabin_co2_mmhg", 3.0, "2026-11-14T11:40:00Z"),
    makeObs("O-CO2-2", "cabin_co2_mmhg", 5.2, "2026-11-14T11:55:00Z"),
  ];

  const statusMap = {} as Record<ParameterName, ParameterTelemetryStatus>;
  const compMap = {} as Record<ParameterName, BaselineComparison>;
  for (const p of ALL_18_PARAMETERS) {
    statusMap[p] = evaluateParameterTelemetryStatus(
      obsList,
      p,
      mockBaseline,
      "2026-11-14T12:00:00Z"
    );
    const lv = statusMap[p].lastValidObservation;
    if (lv) compMap[p] = compareToBaseline(lv, mockBaseline);
  }

  const openInc = {
    incident_id: "INC-900",
    astronaut_id: "AST-01-COMMANDER",
    rule_id: "RULE-HYPOXIA-CO2-MULTI-02",
    severity: "MEDIUM",
    state: "DETECTED",
    title: "Elevated Cabin CO2",
    created_at: "2026-11-14T11:50:00Z",
    updated_at: "2026-11-14T11:56:00Z",
    authorized_action: "Started CDRA bypass inspection",
    procedure_reference: "PROC-ENV-CO2-01",
    action_recorded_at: "2026-11-14T11:57:00Z",
  } as IncidentRecord;

  const opsRecords: OpsRecordDoc[] = [
    {
      ownerId: "u1",
      recordId: "INC_PROGRESS_INC-900",
      recordType: "CHECKLIST_LOG",
      crewId: "AST-01-COMMANDER",
      title: "Incident Checklist Progress: INC-900",
      status: "IN_PROGRESS",
      timestampIso: "2026-11-14T11:58:00Z",
      payload: {
        kind: "INCIDENT_CHECKLIST_PROGRESS",
        incidentId: "INC-900",
        completedSteps: [EMERGENCY_CHECKLIST_STEPS[0], EMERGENCY_CHECKLIST_STEPS[1]],
        currentStepIndex: 2,
        elapsedSec: 120,
        totalSteps: EMERGENCY_CHECKLIST_STEPS.length,
        updatedAtIso: "2026-11-14T11:58:00Z",
      },
    },
    {
      ownerId: "u1",
      recordId: "SUBJ_2",
      recordType: "BIO_EXTENDED",
      crewId: "AST-01-COMMANDER",
      title: "Subjective Check-In",
      status: "WORSE_THAN_USUAL",
      timestampIso: "2026-11-14T11:59:00Z",
      payload: {
        kind: "SUBJECTIVE_CHECKIN",
        statusCode: "WORSE_THAN_USUAL",
        statusLabel: "I feel worse than usual.",
        note: "Light headache in Node 2.",
        submittedByRole: "CREW_MEMBER",
      },
    },
  ];

  const continuity = {
    ...DEFAULT_CONTINUITY_STATE,
    cmoAvailable: false,
    activeProcedureId: "PROC-ENV-CO2-01",
    procedureStepsDone: { "PROC-ENV-CO2-01": [1] },
    procedureCurrentStep: { "PROC-ENV-CO2-01": 1 },
    equipmentConfirmations: {
      "EQ-OXIMETER-02": {
        confirmedAtIso: "2026-11-14T11:52:00Z",
        confirmedBy: "Cdr. Elena Vance",
      },
    },
    updatedAtIso: "2026-11-14T11:58:30Z",
  };

  const progressMap = extractIncidentChecklistProgressMap(
    opsRecords,
    EMERGENCY_CHECKLIST_STEPS.length
  );
  assert.equal(progressMap["INC-900"].completedSteps.length, 2);
  assert.equal(progressMap["INC-900"].currentStepIndex, 2);

  const interrupted = extractInterruptedTasks({
    incidents: [openInc],
    opsRecords,
    continuityState: continuity,
    emergencyChecklistSteps: EMERGENCY_CHECKLIST_STEPS,
    procedures: GUIDED_PROCEDURES,
  });
  assert.equal(interrupted.length, 2);
  assert.equal(interrupted[0].kind, "GUIDED_PROCEDURE");
  assert.equal(interrupted[0].currentStepNumber, 2);
  assert.equal(interrupted[1].kind, "INCIDENT_CHECKLIST");
  assert.equal(interrupted[1].completedStepsCount, 2);
  assert.equal(interrupted[1].outstandingStepsCount, 2);

  const resolvedEq = resolveEquipmentInventory(ONBOARD_MEDICAL_EQUIPMENT, continuity);
  const ox = resolvedEq.find((e) => e.equipmentId === "EQ-OXIMETER-02")!;
  const cap = resolvedEq.find((e) => e.equipmentId === "EQ-CAPNOGRAPHY-06")!;
  assert.equal(ox.isSimulatedConfirmation, false);
  assert.equal(ox.confirmedBy, "Cdr. Elena Vance");
  assert.equal(ox.availability, "AVAILABLE");
  assert.equal(cap.isSimulatedConfirmation, true);
  assert.equal(cap.availability, "MISSING");

  const mockRoutine: RoutineGamificationState = {
    environmentMode: "ISS_LEO",
    completedDateUtc: "2026-11-14",
    completedTaskIds: ["TASK_MORNING_CHECKIN"],
    streakDays: 3,
    readinessPoints: 60,
    earnedBadges: [],
    onboardingCompleted: true,
  };

  const handover = buildShiftHandoverSummary({
    baseline: mockBaseline,
    observations: obsList,
    statusByParameter: statusMap,
    baselineComparisons: compMap,
    incidents: [openInc],
    opsRecords,
    opsState: { ownerId: "u1", ...DEFAULT_OPS_STATE },
    routineState: mockRoutine,
    continuityState: continuity,
    equipmentList: ONBOARD_MEDICAL_EQUIPMENT,
    procedures: GUIDED_PROCEDURES,
    emergencyChecklistSteps: EMERGENCY_CHECKLIST_STEPS,
    viewerRole: "CREW_MEMBER",
    quarantinedRecent: [],
  });
  assert.equal(handover.activeIncidents.length, 1);
  assert.equal(handover.latestSubjectiveCheckin?.statusCode, "WORSE_THAN_USUAL");
  assert.equal(handover.outstandingTasks.length, 2);
  assert.ok(handover.recentSignificantChanges.some((c) => c.parameter === "cabin_co2_mmhg"));
  assert.ok(handover.actionsRecorded.some((a) => a.detail.includes("CDRA bypass")));
  assert.ok(handover.unresolvedDataQualityIssues.length >= 1);
  assert.ok(handover.informationGaps.some((g) => g.includes("CMO unavailable")));
  assert.equal(handover.lastUpdateIso, "2026-11-14T11:59:00.000Z");
});


