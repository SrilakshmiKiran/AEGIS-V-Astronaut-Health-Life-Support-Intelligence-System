import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_18_PARAMETERS,
  BaselineComparison,
  BaselineProfile,
  PARAMETER_METADATA,
  ParameterName,
  ParameterTelemetryStatus,
  TelemetryLatestResponse,
  TelemetryObservation,
} from "../types/aegisContracts";
import {
  DEFAULT_CONTINUITY_STATE,
  ONBOARD_MEDICAL_EQUIPMENT,
} from "../types/continuityContracts";
import {
  DEFAULT_LIFE_SAFETY_CONFIG,
  LifeSafetyConfig,
} from "../types/lifeSafetyContracts";
import {
  DEFAULT_ECLSS,
  EclssSnapshot,
  OpsRecordDoc,
  SEEDED_CREW_ROSTER,
} from "../types/opsContracts";
import { SEEDED_BASELINE_PROFILE } from "../mocks/cloudPreviewFixtures";
import {
  compareToBaseline,
  evaluateParameterTelemetryStatus,
  resolveEquipmentInventory,
} from "./aegisPureEngine";
import {
  applyLifeSafetyTransition,
  buildEmergencyConsolidatedSummary,
  createEmergencyLifeSafetyEvent,
  evaluateCheckinScheduleStatus,
  evaluateEnvironmentLifeSafety,
  exportLifeSafetyEventMarkdown,
  extractLifeSafetyConfigFromOpsRecords,
  extractLifeSafetyEventsFromOpsRecords,
  filterEmergencyResources,
  isLifeSafetyAckOverdue,
  serializeLifeSafetyConfigToOpsRecord,
  serializeLifeSafetyEventToOpsRecord,
} from "./lifeSafetyEngine";

function buildMockLatestResponse(options?: {
  staleHr?: boolean;
  highCo2?: boolean;
}): TelemetryLatestResponse {
  const baseline: BaselineProfile = SEEDED_BASELINE_PROFILE;
  const nowIso = "2026-11-15T10:00:00Z";
  const oldIso = "2026-11-14T18:00:00Z";

  const observations: TelemetryObservation[] = ALL_18_PARAMETERS.map((param, idx) => {
    const metric = baseline.metrics[param];
    const isStaleHr = options?.staleHr && param === "heart_rate_bpm";
    const value =
      options?.highCo2 && param === "cabin_co2_mmhg" ? 4.8 : metric.mean;
    return {
      observation_id: `OBS_TEST_${idx}`,
      astronaut_id: baseline.astronaut_id,
      timestamp: isStaleHr ? oldIso : nowIso,
      parameter: param,
      value,
      unit: metric.unit,
      source_type: "SIMULATED",
      device_hmac_verified: false,
      info_label: "MEASURED",
      quality_status: isStaleHr ? "STALE" : "VALID",
      is_quarantined: false,
    };
  });

  const latestByParam = {} as Record<ParameterName, TelemetryObservation>;
  const baselineComps = {} as Record<ParameterName, BaselineComparison>;
  const statusByParam = {} as Record<ParameterName, ParameterTelemetryStatus>;

  for (const param of ALL_18_PARAMETERS) {
    const obs = observations.find((o) => o.parameter === param)!;
    latestByParam[param] = obs;
    baselineComps[param] = compareToBaseline(obs, baseline);
    statusByParam[param] = evaluateParameterTelemetryStatus(
      observations,
      param,
      baseline,
      nowIso
    );
  }

  return {
    astronaut_id: baseline.astronaut_id,
    as_of_timestamp: nowIso,
    stream_reference_timestamp: nowIso,
    latest_by_parameter: latestByParam,
    baseline_comparisons: baselineComps,
    status_by_parameter: statusByParam,
    quality_counts: {
      VALID: options?.staleHr ? 17 : 18,
      ESTIMATED: 0,
      MISSING: 0,
      STALE: options?.staleHr ? 1 : 0,
      IMPOSSIBLE: 0,
      CORRUPTED: 0,
    },
    quarantined_recent: options?.staleHr ? [latestByParam.heart_rate_bpm] : [],
  };
}

describe("AEGIS Life-Safety Sentinel Engine", () => {
  it("1. Emergency request creation captures identity, valid observations, quality warnings, and Earth-link state", () => {
    const latest = buildMockLatestResponse({ staleHr: true });
    const envAssessment = evaluateEnvironmentLifeSafety(DEFAULT_ECLSS, latest, false);
    const ev = createEmergencyLifeSafetyEvent({
      nowIso: "2026-11-15T10:05:00Z",
      astronautId: "AST-01-COMMANDER",
      astronautName: "Cmdr. Elena Vance",
      activeCrewId: "AST-01-COMMANDER",
      actorName: "Cmdr. Elena Vance",
      actorRole: "CREW_MEMBER",
      category: "HEALTH_CONCERN",
      notes: "Persistent vertigo near airlock bulkhead",
      latest,
      eclss: DEFAULT_ECLSS,
      envAssessment,
      config: DEFAULT_LIFE_SAFETY_CONFIG,
      crewRoster: SEEDED_CREW_ROSTER,
      continuityState: DEFAULT_CONTINUITY_STATE,
      earthWanConnected: false,
      browserOnline: false,
    });

    assert.equal(ev.astronautId, "AST-01-COMMANDER");
    assert.equal(ev.state, "PRIMARY_NOTIFIED");
    assert.equal(ev.earthCommsAtTrigger, "UNAVAILABLE");
    assert.equal(ev.browserOnlineAtTrigger, false);
    assert.equal(ev.syncStatus, "QUEUED_OFFLINE");
    assert.equal(ev.timeline.length, 2);
    assert.ok(
      !ev.contributingObservations.some(
        (o) => o.parameter === PARAMETER_METADATA.heart_rate_bpm.label
      ),
      "Stale heart rate must not be placed into live contributing observations"
    );
    assert.ok(
      ev.dataQualityWarnings.some((w) => w.includes("Heart Rate")),
      "Stale channel must surface in data-quality warnings"
    );
  });

  it("2. Missed crew check-in evaluation transitions ON_SCHEDULE -> REMINDER_DUE -> MISSED_OVERDUE and escalates ack timeouts", () => {
    const cfg: LifeSafetyConfig = {
      ...DEFAULT_LIFE_SAFETY_CONFIG,
      checkinIntervalHours: 8,
      gracePeriodMinutes: 15,
      ackTimeoutMinutes: 10,
      lastCheckinAtIso: "2026-11-15T00:00:00Z",
    };

    const onSchedule = evaluateCheckinScheduleStatus(cfg, "2026-11-15T07:30:00Z");
    assert.equal(onSchedule.statusCode, "ON_SCHEDULE");
    assert.ok(onSchedule.safetyNotice.includes("Never infer unconsciousness"));

    const reminderDue = evaluateCheckinScheduleStatus(cfg, "2026-11-15T08:05:00Z");
    assert.equal(reminderDue.statusCode, "REMINDER_DUE");

    const overdue = evaluateCheckinScheduleStatus(cfg, "2026-11-15T08:25:00Z");
    assert.equal(overdue.statusCode, "MISSED_OVERDUE");
    assert.equal(overdue.minutesOverdue, 10);

    // Create missed check-in welfare event and confirm ack escalation triggers after 10 min
    const latest = buildMockLatestResponse();
    const envAssessment = evaluateEnvironmentLifeSafety(DEFAULT_ECLSS, latest, false);
    const welfareEv = createEmergencyLifeSafetyEvent({
      nowIso: "2026-11-15T08:25:00Z",
      astronautId: "AST-01-COMMANDER",
      astronautName: "Cmdr. Elena Vance",
      activeCrewId: "AST-01-COMMANDER",
      actorName: "Dr. Aris Chen",
      actorRole: "CREW_MEDICAL_OFFICER",
      category: "MISSED_CHECKIN",
      notes: "",
      latest,
      eclss: DEFAULT_ECLSS,
      envAssessment,
      config: cfg,
      crewRoster: SEEDED_CREW_ROSTER,
      continuityState: DEFAULT_CONTINUITY_STATE,
      earthWanConnected: true,
      browserOnline: true,
    });

    assert.equal(isLifeSafetyAckOverdue(welfareEv, "2026-11-15T08:30:00Z"), false);
    assert.equal(isLifeSafetyAckOverdue(welfareEv, "2026-11-15T08:36:00Z"), true);
  });

  it("3. Escalation lifecycle enforces responder permissions, backup escalation, follow-up, and explicit-only closure", () => {
    const latest = buildMockLatestResponse();
    const envAssessment = evaluateEnvironmentLifeSafety(DEFAULT_ECLSS, latest, false);
    const baseEv = createEmergencyLifeSafetyEvent({
      nowIso: "2026-11-15T10:00:00Z",
      astronautId: "AST-01-COMMANDER",
      astronautName: "Cmdr. Elena Vance",
      activeCrewId: "AST-01-COMMANDER",
      actorName: "Cmdr. Elena Vance",
      actorRole: "CREW_MEMBER",
      category: "ENVIRONMENTAL_HAZARD",
      notes: "Pressure drop check",
      latest,
      eclss: DEFAULT_ECLSS,
      envAssessment,
      config: DEFAULT_LIFE_SAFETY_CONFIG,
      crewRoster: SEEDED_CREW_ROSTER,
      continuityState: DEFAULT_CONTINUITY_STATE,
      earthWanConnected: true,
      browserOnline: true,
    });

    assert.throws(() =>
      applyLifeSafetyTransition(
        baseEv,
        { type: "ACKNOWLEDGE_PRIMARY" },
        {
          actorName: "Ground Observer",
          actorRole: "MISSION_OBSERVER",
          nowIso: "2026-11-15T10:02:00Z",
          earthWanConnected: true,
          browserOnline: true,
        }
      )
    );

    const escalated = applyLifeSafetyTransition(
      baseEv,
      { type: "ESCALATE_BACKUP", reason: "Primary ack overdue" },
      {
        actorName: "Cmdr. Elena Vance",
        actorRole: "CREW_MEMBER",
        nowIso: "2026-11-15T10:12:00Z",
        earthWanConnected: false,
        browserOnline: true,
      }
    );
    assert.equal(escalated.state, "OVERDUE_ESCALATED");
    assert.ok(escalated.backupNotifiedAtIso);

    const acked = applyLifeSafetyTransition(
      escalated,
      { type: "ACKNOWLEDGE_BACKUP", note: "Cmdr responding with leak kit" },
      {
        actorName: "Cmdr. Elena Vance",
        actorRole: "CREW_MEMBER",
        nowIso: "2026-11-15T10:14:00Z",
        earthWanConnected: false,
        browserOnline: true,
      }
    );
    assert.equal(acked.state, "ACKNOWLEDGED");
    assert.equal(acked.backupAckBy, "Cmdr. Elena Vance");

    const responded = applyLifeSafetyTransition(
      acked,
      {
        type: "RECORD_RESPONSE",
        procedureRef: "PROC-ENV-CO2-01",
        actionNote: "Checked Node-2 seal and CDRA fan",
      },
      {
        actorName: "Cmdr. Elena Vance",
        actorRole: "CREW_MEMBER",
        nowIso: "2026-11-15T10:18:00Z",
        earthWanConnected: false,
        browserOnline: true,
      }
    );
    assert.equal(responded.state, "RESPONSE_RECORDED");

    const followedUp = applyLifeSafetyTransition(
      responded,
      { type: "ADD_FOLLOWUP", followUpNote: "Cabin pressure steady at 101.2 kPa" },
      {
        actorName: "Cmdr. Elena Vance",
        actorRole: "CREW_MEMBER",
        nowIso: "2026-11-15T10:30:00Z",
        earthWanConnected: true,
        browserOnline: true,
      }
    );
    assert.equal(followedUp.state, "MONITORING");

    const resolved = applyLifeSafetyTransition(
      followedUp,
      { type: "RESOLVE_RETAIN", resolutionNote: "Seal verified nominal by human check" },
      {
        actorName: "Dr. Aris Chen",
        actorRole: "CREW_MEDICAL_OFFICER",
        nowIso: "2026-11-15T10:40:00Z",
        earthWanConnected: true,
        browserOnline: true,
      }
    );
    assert.equal(resolved.state, "RESOLVED_RETAINED");
    assert.equal(resolved.timeline.length, 7);

    const md = exportLifeSafetyEventMarkdown(resolved);
    assert.ok(md.includes("PROC-ENV-CO2-01"));
    assert.ok(md.includes("Chronological Event Timeline"));
  });

  it("4. Offline event recording and reconnection merge respect Firestore key caps and retain latest state", () => {
    const latest = buildMockLatestResponse();
    const envAssessment = evaluateEnvironmentLifeSafety(DEFAULT_ECLSS, latest, false);
    const offlineEvent = createEmergencyLifeSafetyEvent({
      nowIso: "2026-11-15T11:00:00Z",
      astronautId: "AST-01-COMMANDER",
      astronautName: "Cmdr. Elena Vance",
      activeCrewId: "AST-01-COMMANDER",
      actorName: "Cmdr. Elena Vance",
      actorRole: "CREW_MEMBER",
      category: "COMMUNICATION_LOSS",
      notes: "Created while browser offline",
      latest,
      eclss: DEFAULT_ECLSS,
      envAssessment,
      config: DEFAULT_LIFE_SAFETY_CONFIG,
      crewRoster: SEEDED_CREW_ROSTER,
      continuityState: DEFAULT_CONTINUITY_STATE,
      earthWanConnected: false,
      browserOnline: false,
    });

    const oldRec: OpsRecordDoc = serializeLifeSafetyEventToOpsRecord(offlineEvent, "uid-1");
    assert.ok(Object.keys(oldRec.payload).length <= 30, "Must satisfy firestore.rules <= 30 keys");

    const updatedOffline = applyLifeSafetyTransition(
      offlineEvent,
      { type: "ACKNOWLEDGE_PRIMARY", note: "Ack while still offline" },
      {
        actorName: "Dr. Aris Chen",
        actorRole: "CREW_MEDICAL_OFFICER",
        nowIso: "2026-11-15T11:03:00Z",
        earthWanConnected: false,
        browserOnline: false,
      }
    );
    const newerRec: OpsRecordDoc = serializeLifeSafetyEventToOpsRecord(updatedOffline, "uid-1");

    // Simulate reconnect merge with older cloud copy + newer queued offline record
    const merged = extractLifeSafetyEventsFromOpsRecords([oldRec, newerRec]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].state, "ACKNOWLEDGED");
    assert.equal(merged[0].timeline.length, 3);

    // Config serialization & round-trip check
    const cfgRec = serializeLifeSafetyConfigToOpsRecord(
      { ...DEFAULT_LIFE_SAFETY_CONFIG, checkinIntervalHours: 4 },
      "AST-01-COMMANDER",
      "uid-1"
    );
    assert.ok(Object.keys(cfgRec.payload).length <= 30);
    const extractedCfg = extractLifeSafetyConfigFromOpsRecords([cfgRec]);
    assert.equal(extractedCfg.checkinIntervalHours, 4);
  });

  it("5. Environmental assessment monitors all 8 life-safety parameters & distinguishes data provenance", () => {
    const latest = buildMockLatestResponse({ staleHr: false, highCo2: true });
    const hazardEclss: EclssSnapshot = {
      ...DEFAULT_ECLSS,
      cabinPressureRateKpaHr: -0.65,
      smokeFireStatus: "ALARM",
      ventilationStatus: "FAN_FAULT",
      envDataSource: "IMPORTED_RECORD",
    };

    const assessment = evaluateEnvironmentLifeSafety(hazardEclss, latest, false);
    assert.equal(assessment.overallLevel, "URGENT");
    assert.ok(assessment.dataSourceBanner.includes("IMPORTED HABITAT RECORD"));
    assert.ok(assessment.findings.some((f) => f.id === "ENV-PRESSURE-RATE" && f.severity === "URGENT"));
    assert.ok(assessment.findings.some((f) => f.id === "ENV-SMOKE-FIRE" && f.severity === "URGENT"));
    assert.ok(assessment.findings.some((f) => f.id === "ENV-VENTILATION" && f.severity === "FAULT"));
  });

  it("6. Emergency resource locator filters by search term, availability, and surfaces maintenance/expiry info", () => {
    const resolved = resolveEquipmentInventory(
      ONBOARD_MEDICAL_EQUIPMENT,
      DEFAULT_CONTINUITY_STATE
    );
    const oxygenMatches = filterEmergencyResources(resolved, "breathing", "ALL");
    assert.equal(oxygenMatches.length, 1);
    assert.equal(oxygenMatches[0].equipmentId, "EQ-O2-PBA-07");
    assert.ok(oxygenMatches[0].maintenanceOrExpiryInfo?.includes("Hydrostatic"));

    const availableOnly = filterEmergencyResources(resolved, "", "AVAILABLE_ONLY");
    assert.ok(availableOnly.every((e) => e.availability === "AVAILABLE"));
    assert.ok(!availableOnly.some((e) => e.equipmentId === "EQ-CAPNOGRAPHY-06"));
  });

  it("7. Consolidated 7-question emergency dashboard summary answers all critical triage questions", () => {
    const latest = buildMockLatestResponse({ staleHr: true });
    const envAssessment = evaluateEnvironmentLifeSafety(DEFAULT_ECLSS, latest, false);
    const checkinEval = evaluateCheckinScheduleStatus(
      DEFAULT_LIFE_SAFETY_CONFIG,
      "2026-11-15T09:00:00Z"
    );
    const resolved = resolveEquipmentInventory(
      ONBOARD_MEDICAL_EQUIPMENT,
      DEFAULT_CONTINUITY_STATE
    );
    const ev = createEmergencyLifeSafetyEvent({
      nowIso: "2026-11-15T10:00:00Z",
      astronautId: "AST-01-COMMANDER",
      astronautName: "Cmdr. Elena Vance",
      activeCrewId: "AST-01-COMMANDER",
      actorName: "Cmdr. Elena Vance",
      actorRole: "CREW_MEMBER",
      category: "ENVIRONMENTAL_HAZARD",
      notes: "CO2 advisory in Node-2",
      latest,
      eclss: DEFAULT_ECLSS,
      envAssessment,
      config: DEFAULT_LIFE_SAFETY_CONFIG,
      crewRoster: SEEDED_CREW_ROSTER,
      continuityState: DEFAULT_CONTINUITY_STATE,
      earthWanConnected: false,
      browserOnline: true,
    });

    const summary = buildEmergencyConsolidatedSummary({
      activeEvent: ev,
      latest,
      envAssessment,
      checkinEval,
      incidents: [],
      resolvedEquipment: resolved,
      earthWanConnected: false,
      browserOnline: true,
      offlineQueueCount: 0,
    });

    assert.ok(summary.whatIsHappening.includes("Priority Environmental Life-Safety Alert"));
    assert.equal(summary.threatTypeLabel, "Environmental / Habitat Hazard");
    assert.ok(summary.trustworthyObservations.length >= 16);
    assert.ok(summary.untrustworthyOrMissingObservations.some((x) => x.includes("HR")));
    assert.ok(summary.acknowledgementStatus.includes("awaiting acknowledgement"));
    assert.ok(summary.relevantResourcesCount >= 6);
    assert.ok(summary.unresolvedItems.some((u) => u.includes("Earth communication")));
    assert.ok(summary.earthCommsSummary.includes("UNAVAILABLE"));
  });
});
