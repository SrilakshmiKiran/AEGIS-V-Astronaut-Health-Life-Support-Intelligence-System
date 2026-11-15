import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_18_PARAMETERS,
  BaselineComparison,
  BaselineProfile,
  ParameterName,
  ParameterTelemetryStatus,
  TelemetryLatestResponse,
  TelemetryObservation,
} from "../types/aegisContracts";
import {
  DEFAULT_CONTINUITY_STATE,
  ONBOARD_MEDICAL_EQUIPMENT,
} from "../types/continuityContracts";
import { DEFAULT_LIFE_SAFETY_CONFIG } from "../types/lifeSafetyContracts";
import { MedicalHelpDemoSceneId } from "../types/medicalGuidanceContracts";
import {
  DEFAULT_ECLSS,
  OpsRecordDoc,
  SEEDED_CREW_ROSTER,
} from "../types/opsContracts";
import {
  CURATED_NASA_CSA_RESOURCES,
  SEEDED_BASELINE_PROFILE,
} from "../mocks/cloudPreviewFixtures";
import {
  compareToBaseline,
  evaluateParameterTelemetryStatus,
  resolveEquipmentInventory,
} from "./aegisPureEngine";
import { evaluateEnvironmentLifeSafety } from "./lifeSafetyEngine";
import {
  APPROVED_GUIDANCE_PROTOCOLS,
  GUIDANCE_CATEGORIES,
  RED_FLAG_SIGNS,
} from "./approvedMedicalLibrary";
import {
  DEFAULT_SCREEN_INPUT,
  buildConsultationItemFromGuidanceIncident,
  buildGuidanceDemoScene,
  buildMedicalGuidanceHandoffMarkdown,
  buildPersonalizedGuidanceContext,
  createMedicalGuidanceIncident,
  evaluateEmergencyScreening,
  evaluateGuidanceResponderOverdue,
  findMedicalEquipmentWithAlternatives,
  recordConditionTrackingUpdate,
  resolveProtocolForIntake,
  searchGuidanceLibrary,
  serializeGuidanceIncidentToOpsRecord,
  extractGuidanceIncidentsFromOpsRecords,
  transitionMedicalGuidanceIncident,
} from "./medicalGuidanceEngine";

function buildTestLatest(options?: {
  staleHr?: boolean;
  highCo2?: boolean;
  lowSpo2?: boolean;
}): TelemetryLatestResponse {
  const baseline: BaselineProfile = SEEDED_BASELINE_PROFILE;
  const nowIso = "2026-11-15T10:00:00Z";
  const oldIso = "2026-11-14T15:00:00Z";

  const observations: TelemetryObservation[] = ALL_18_PARAMETERS.map((param, idx) => {
    const metric = baseline.metrics[param];
    const isStale = Boolean(options?.staleHr && param === "heart_rate_bpm");
    let value = metric.mean;
    if (options?.highCo2 && param === "cabin_co2_mmhg") value = 5.1;
    if (options?.lowSpo2 && param === "spo2_pct") value = 91.5;

    return {
      observation_id: `OBS_TEST_${idx}`,
      astronaut_id: baseline.astronaut_id,
      timestamp: isStale ? oldIso : nowIso,
      parameter: param,
      value,
      unit: metric.unit,
      source_type: "SIMULATED",
      device_hmac_verified: true,
      info_label: "MEASURED",
      quality_status: isStale ? "STALE" : "VALID",
      is_quarantined: false,
    };
  });

  const latest_by_parameter = {} as Record<ParameterName, TelemetryObservation>;
  const baseline_comparisons = {} as Record<ParameterName, BaselineComparison>;
  const status_by_parameter = {} as Record<ParameterName, ParameterTelemetryStatus>;

  for (const obs of observations) {
    latest_by_parameter[obs.parameter] = obs;
    status_by_parameter[obs.parameter] = evaluateParameterTelemetryStatus(
      observations,
      obs.parameter,
      baseline,
      nowIso
    );
    baseline_comparisons[obs.parameter] = compareToBaseline(obs, baseline);
  }

  return {
    astronaut_id: baseline.astronaut_id,
    as_of_timestamp: nowIso,
    stream_reference_timestamp: nowIso,
    latest_by_parameter,
    baseline_comparisons,
    status_by_parameter,
    quality_counts: {
      VALID: observations.filter((o) => o.quality_status === "VALID").length,
      ESTIMATED: 0,
      MISSING: 0,
      STALE: observations.filter((o) => o.quality_status === "STALE").length,
      IMPOSSIBLE: 0,
      CORRUPTED: 0,
    },
    quarantined_recent: [],
  };
}

describe("AEGIS-V Emergency Medical Guidance & First-Response Engine", () => {
  it("1. Covers all 22 non-diagnostic navigation categories and 10 red-flag signs", () => {
    assert.equal(GUIDANCE_CATEGORIES.length, 22);
    assert.equal(
      GUIDANCE_CATEGORIES.filter((c) => c.group === "INJURIES").length,
      8
    );
    assert.equal(
      GUIDANCE_CATEGORIES.filter((c) => c.group === "SUDDEN_HEALTH").length,
      8
    );
    assert.equal(
      GUIDANCE_CATEGORIES.filter((c) => c.group === "SPACEFLIGHT").length,
      6
    );
    assert.equal(RED_FLAG_SIGNS.length, 10);

    // Every single one of the 22 categories resolves to a verified 5-step protocol with source & version
    for (const cat of GUIDANCE_CATEGORIES) {
      const intake = {
        ...DEFAULT_SCREEN_INPUT,
        selectedCategories: [cat.id],
      };
      const screening = evaluateEmergencyScreening(intake);
      const res = resolveProtocolForIntake(
        intake,
        screening,
        DEFAULT_CONTINUITY_STATE,
        "CREW_MEMBER"
      );
      assert.equal(res.found, true, `Category ${cat.id} must map to an approved protocol`);
      assert.ok(res.protocol);
      assert.equal(res.protocol.steps.length, 5);
      assert.equal(res.protocol.steps[0].heading, "STEP 1 — DO THIS NOW");
      assert.equal(res.protocol.steps[1].heading, "STEP 2 — NEXT ACTION");
      assert.equal(res.protocol.steps[2].heading, "STEP 3 — CHECK");
      assert.equal(res.protocol.steps[3].heading, "STEP 4 — GET HELP");
      assert.equal(res.protocol.steps[4].heading, "STEP 5 — CONTINUE MONITORING");
      assert.ok(res.protocol.source.length > 5);
      assert.ok(res.protocol.version.length > 3);
    }
  });

  it("2. Emergency screening detects red flags & urgent bypass immediately without diagnosing", () => {
    const bleedingScreen = evaluateEmergencyScreening({
      ...DEFAULT_SCREEN_INPUT,
      severeBleeding: "YES",
    });
    assert.equal(bleedingScreen.isEmergency, true);
    assert.equal(bleedingScreen.bypassToUrgent, true);
    assert.equal(bleedingScreen.priorityLevel, "URGENT_RED_FLAG");
    assert.equal(bleedingScreen.recommendedProtocolId, "PROTO-URGENT-SEVERE-BLEEDING");
    assert.ok(bleedingScreen.nonDiagnosticNotice.includes("does NOT establish a medical diagnosis"));

    const unsureBreathing = evaluateEmergencyScreening({
      ...DEFAULT_SCREEN_INPUT,
      breathingNormal: "UNSURE",
    });
    assert.equal(unsureBreathing.isEmergency, true);
    assert.ok(unsureBreathing.matchedRedFlags.includes("ABNORMAL_ABSENT_BREATHING"));

    const minorCut = evaluateEmergencyScreening({
      ...DEFAULT_SCREEN_INPUT,
      selectedCategories: ["CUTS_WOUNDS"],
      whatHappened: "Small 1 cm scrape on finger",
    });
    assert.equal(minorCut.isEmergency, false);
    assert.equal(minorCut.priorityLevel, "STANDARD_FIRST_RESPONSE");
  });

  it("3. Refuses to fabricate procedures or dosages when no approved procedure matches", () => {
    const unlistedRes = resolveProtocolForIntake(
      {
        ...DEFAULT_SCREEN_INPUT,
        selectedCategories: ["UNLISTED_COMPLEX_CONCERN"],
        whatHappened: "Unusual systemic symptom not listed",
      },
      evaluateEmergencyScreening(DEFAULT_SCREEN_INPUT),
      DEFAULT_CONTINUITY_STATE,
      "CREW_MEMBER"
    );
    assert.equal(unlistedRes.found, false);
    assert.equal(unlistedRes.protocol, null);
    assert.ok(unlistedRes.noProcedureMessage?.includes("No approved onboard procedure"));
    assert.ok(unlistedRes.unapprovedWarning?.includes("never fabricate"));

    const nonsenseRes = resolveProtocolForIntake(
      {
        ...DEFAULT_SCREEN_INPUT,
        whatHappened: "quantum zyxwvut unknown request",
      },
      evaluateEmergencyScreening(DEFAULT_SCREEN_INPUT),
      DEFAULT_CONTINUITY_STATE,
      "CREW_MEMBER"
    );
    assert.equal(nonsenseRes.found, false);
    assert.equal(nonsenseRes.protocol, null);
  });

  it("4. Offline search library returns categories, protocols, and curated references without internet", () => {
    const eyeSearch = searchGuidanceLibrary("eyewash", "ALL", CURATED_NASA_CSA_RESOURCES);
    assert.ok(eyeSearch.categories.some((c) => c.id === "EYE_INJURIES"));
    assert.ok(eyeSearch.protocols.some((p) => p.protocolId === "PROTO-URGENT-EYE-INJURY"));

    const spaceSearch = searchGuidanceLibrary("", "SPACEFLIGHT", CURATED_NASA_CSA_RESOURCES);
    assert.equal(spaceSearch.categories.length, 6);
  });

  it("5. Personalized context separates measured vs user-reported vs unavailable/unknown data and never assumes missing telemetry is healthy", () => {
    const latest = buildTestLatest({ staleHr: true, highCo2: true });
    const envAssessment = evaluateEnvironmentLifeSafety(DEFAULT_ECLSS, latest, false);
    const resolvedEquipment = resolveEquipmentInventory(
      ONBOARD_MEDICAL_EQUIPMENT,
      DEFAULT_CONTINUITY_STATE
    );

    const ctx = buildPersonalizedGuidanceContext({
      subjectCrewId: "AST-01-COMMANDER",
      intake: {
        ...DEFAULT_SCREEN_INPUT,
        whatHappened: "Dizziness near Node-2",
        selectedCategories: ["DIZZINESS_FAINTING"],
      },
      baseline: SEEDED_BASELINE_PROFILE,
      latest,
      envAssessment,
      incidents: [],
      lifeSafetyEvents: [],
      subjectiveHistory: [],
      resolvedEquipment,
      crewRoster: SEEDED_CREW_ROSTER,
      continuityState: DEFAULT_CONTINUITY_STATE,
      lifeSafetyConfig: DEFAULT_LIFE_SAFETY_CONFIG,
      earthWanConnected: false,
      browserOnline: false,
      viewerRole: "CREW_MEMBER",
    });

    const hrItem = ctx.measuredVitals.find((m) => m.parameter === "heart_rate_bpm");
    assert.ok(hrItem);
    assert.equal(hrItem.freshness, "STALE");
    assert.ok(
      ctx.unavailableOrUnknownInfo.some((u) => u.includes("Heart Rate") && u.includes("STALE"))
    );
    assert.ok(
      ctx.unavailableOrUnknownInfo.some((u) => u.includes("Personal medication allergies"))
    );
    assert.ok(ctx.earthCommsStatus.statusLabel.includes("OFFLINE"));
  });

  it("6. Equipment finder exposes location, status, and documented alternatives (including missing/limited items)", () => {
    const resolvedEquipment = resolveEquipmentInventory(
      ONBOARD_MEDICAL_EQUIPMENT,
      DEFAULT_CONTINUITY_STATE
    );
    const burnProto = APPROVED_GUIDANCE_PROTOCOLS.find(
      (p) => p.protocolId === "PROTO-URGENT-BURNS"
    );
    assert.ok(burnProto);
    const matches = findMedicalEquipmentWithAlternatives(
      ["EQ-BURN-DRESSING-13", "EQ-CAPNOGRAPHY-06", "EQ-NONEXISTENT-99"],
      resolvedEquipment,
      burnProto
    );
    const burnDressing = matches.find((m) => m.equipmentId === "EQ-BURN-DRESSING-13");
    assert.equal(burnDressing?.availability, "LIMITED");
    assert.ok(burnDressing?.storageLocation.includes("Med Bay Drawer M1"));
    assert.ok(burnDressing?.documentedAlternative.includes("non-stick gauze"));

    const capno = matches.find((m) => m.equipmentId === "EQ-CAPNOGRAPHY-06");
    assert.equal(capno?.availability, "MISSING");

    const ghost = matches.find((m) => m.equipmentId === "EQ-NONEXISTENT-99");
    assert.equal(ghost?.availability, "MISSING");
    assert.ok(ghost?.requiresVerificationNote?.includes("never assume availability"));
  });

  it("7. Responder lifecycle escalates on timeout, detects worsening condition without claiming causality, and never silently closes", () => {
    const latest = buildTestLatest({ lowSpo2: true });
    const intake = {
      ...DEFAULT_SCREEN_INPUT,
      whatHappened: "Severe bleeding on forearm",
      severeBleeding: "YES" as const,
      selectedCategories: ["BLEEDING" as const],
    };
    const screening = evaluateEmergencyScreening(intake);
    const resolution = resolveProtocolForIntake(
      intake,
      screening,
      DEFAULT_CONTINUITY_STATE,
      "CREW_MEMBER"
    );
    const created = createMedicalGuidanceIncident({
      nowIso: "2026-11-15T10:00:00Z",
      missionName: "Lunar Gateway Prototype",
      intake,
      screening,
      resolution,
      reporterName: "Cmdr. Elena Vance",
      reporterRole: "CREW_MEMBER",
      crewRoster: SEEDED_CREW_ROSTER,
      continuityState: DEFAULT_CONTINUITY_STATE,
      lifeSafetyConfig: { ...DEFAULT_LIFE_SAFETY_CONFIG, ackTimeoutMinutes: 10 },
      earthWanConnected: false,
      browserOnline: false,
    });
    assert.equal(created.state, "RESPONDER_NOTIFIED");
    assert.equal(created.syncStatus, "QUEUED_OFFLINE");

    const overdue = evaluateGuidanceResponderOverdue(created, "2026-11-15T10:15:00Z");
    assert.equal(overdue.isOverdue, true);
    assert.equal(overdue.overdueMinutes, 5);

    const escalated = transitionMedicalGuidanceIncident(
      created,
      { type: "ESCALATE_TO_BACKUP", reason: "Primary responder overdue" },
      {
        actorName: "Cmdr. Elena Vance",
        actorRole: "CREW_MEMBER",
        nowIso: "2026-11-15T10:15:00Z",
        browserOnline: false,
      }
    );
    assert.equal(escalated.state, "ESCALATED");
    assert.equal(escalated.escalatedToBackup, true);

    const worsened = recordConditionTrackingUpdate({
      incident: created,
      nowIso: "2026-11-15T10:05:00Z",
      actorName: "Cmdr. Elena Vance",
      actorRole: "CREW_MEMBER",
      symptoms: "Dizziness increasing",
      painLevel0to10: 8,
      responsiveness: "ALERT",
      manualVitalsNote: "",
      changeDirection: "WORSENING",
      actionsPerformed: "Maintained pressure dressing",
      equipmentUsed: ["EQ-TRAUMA-KIT-10"],
      latest,
      baseline: SEEDED_BASELINE_PROFILE,
      browserOnline: false,
    });
    assert.equal(worsened.state, "ESCALATED");
    assert.equal(worsened.conditionChecks[0].escalationWarningTriggered, true);
    assert.ok(
      worsened.conditionChecks[0].nonCausalNote.includes("does NOT prove an intervention caused")
    );

    assert.throws(() =>
      transitionMedicalGuidanceIncident(
        worsened,
        { type: "CLOSE_EXPLICIT", closureNotes: "   " },
        {
          actorName: "Cmdr. Elena Vance",
          actorRole: "CREW_MEMBER",
          nowIso: "2026-11-15T10:20:00Z",
          browserOnline: true,
        }
      )
    );
  });

  it("8. Serialization obeys Firestore rules (<= 30 payload keys), round-trips offline, and supports all 6 demo scenes", () => {
    const latest = buildTestLatest();
    const envAssessment = evaluateEnvironmentLifeSafety(DEFAULT_ECLSS, latest, false);
    const resolvedEquipment = resolveEquipmentInventory(
      ONBOARD_MEDICAL_EQUIPMENT,
      DEFAULT_CONTINUITY_STATE
    );

    const sceneIds: MedicalHelpDemoSceneId[] = [
      "SCENE_A_MINOR_CUT",
      "SCENE_B_SEVERE_BLEEDING",
      "SCENE_C_DIZZINESS_ILLNESS",
      "SCENE_D_CMO_UNAVAILABLE",
      "SCENE_E_EARTH_UNAVAILABLE",
      "SCENE_F_CONDITION_WORSENS",
    ];

    for (const sc of sceneIds) {
      const demo = buildGuidanceDemoScene({
        sceneId: sc,
        nowIso: "2026-11-15T10:00:00Z",
        missionName: "Lunar Gateway Prototype",
        crewRoster: SEEDED_CREW_ROSTER,
        continuityState: DEFAULT_CONTINUITY_STATE,
        lifeSafetyConfig: DEFAULT_LIFE_SAFETY_CONFIG,
        latest,
        baseline: SEEDED_BASELINE_PROFILE,
        earthWanConnected: true,
        browserOnline: true,
      });

      const opsRec: OpsRecordDoc = serializeGuidanceIncidentToOpsRecord(
        demo.incident,
        "uid_test"
      );
      assert.ok(Object.keys(opsRec.payload).length <= 30);

      const roundTrip = extractGuidanceIncidentsFromOpsRecords([opsRec]);
      assert.equal(roundTrip.length, 1);
      assert.equal(roundTrip[0].incidentId, demo.incident.incidentId);

      const ctx = buildPersonalizedGuidanceContext({
        subjectCrewId: demo.incident.subjectCrewId,
        intake: demo.intake,
        baseline: SEEDED_BASELINE_PROFILE,
        latest,
        envAssessment,
        incidents: [],
        lifeSafetyEvents: [],
        subjectiveHistory: [],
        resolvedEquipment,
        crewRoster: SEEDED_CREW_ROSTER,
        continuityState: demo.continuityOverride || DEFAULT_CONTINUITY_STATE,
        lifeSafetyConfig: DEFAULT_LIFE_SAFETY_CONFIG,
        earthWanConnected: demo.earthWanOverride ?? true,
        browserOnline: true,
        viewerRole: "CREW_MEMBER",
      });
      const md = buildMedicalGuidanceHandoffMarkdown(demo.incident, ctx);
      assert.ok(md.includes(demo.incident.incidentId));

      const pkg = buildConsultationItemFromGuidanceIncident(
        demo.incident,
        ctx,
        SEEDED_BASELINE_PROFILE,
        demo.earthWanOverride ?? true
      );
      assert.ok(pkg.payload.markdown_report.length <= 16000);
      assert.ok(pkg.payload.flight_surgeon_questions.length <= 12);

      if (sc === "SCENE_B_SEVERE_BLEEDING") {
        assert.equal(demo.incident.priorityLevel, "URGENT_RED_FLAG");
        assert.equal(demo.incident.protocolId, "PROTO-URGENT-SEVERE-BLEEDING");
      }
      if (sc === "SCENE_D_CMO_UNAVAILABLE") {
        assert.equal(ctx.responderContext.cmoAvailable, false);
        assert.ok(demo.incident.unansweredCmoQuestions.length >= 1);
      }
      if (sc === "SCENE_E_EARTH_UNAVAILABLE") {
        assert.equal(demo.incident.earthCommsAtCreation, "UNAVAILABLE");
        assert.equal(demo.incident.earthConsultationStatus, "QUEUED_OFFLINE");
      }
      if (sc === "SCENE_F_CONDITION_WORSENS") {
        assert.equal(demo.incident.state, "ESCALATED");
      }
    }
  });
});
