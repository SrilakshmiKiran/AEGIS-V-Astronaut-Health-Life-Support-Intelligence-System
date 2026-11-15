import {
  ALL_18_PARAMETERS,
  ActorRole,
  BaselineProfile,
  ConsultationQueueItem,
  IncidentRecord,
  KnowledgeResource,
  PARAMETER_METADATA,
  ParameterName,
  PROTOTYPE_DISCLAIMER,
  SCHEMA_VERSION,
  SubjectiveCheckinEntry,
  TelemetryLatestResponse,
} from "../types/aegisContracts";
import {
  ContinuityPersistedState,
  SIMULATED_CREW_CAPABILITIES,
} from "../types/continuityContracts";
import {
  EnvironmentSafetyAssessment,
  LifeSafetyConfig,
  LifeSafetyEvent,
} from "../types/lifeSafetyContracts";
import {
  ApprovedGuidanceProtocol,
  ConditionChangeDirection,
  ConditionCheckEntry,
  EquipmentFinderMatch,
  GuidanceCategoryGroup,
  GuidanceCategoryId,
  GuidanceCategoryMeta,
  GuidanceIncidentRecord,
  GuidanceTimelineEntry,
  MEDICAL_GUIDANCE_PROTOTYPE_SAFETY_NOTICE,
  MeasuredVitalContextItem,
  MedicalGuidanceLifecycleState,
  MedicalGuidanceScreenInput,
  MedicalHelpDemoSceneId,
  PersonalizedGuidanceContext,
  ProtocolResolutionResult,
  RedFlagSignId,
  ScreeningEvaluationResult,
} from "../types/medicalGuidanceContracts";
import { CrewRosterMember, OpsRecordDoc } from "../types/opsContracts";
import { ResolvedEquipmentItem } from "./aegisPureEngine";
import {
  APPROVED_GUIDANCE_PROTOCOLS,
  GUIDANCE_CATEGORIES,
  RED_FLAG_SIGNS,
} from "./approvedMedicalLibrary";

export const DEFAULT_SCREEN_INPUT: MedicalGuidanceScreenInput = {
  whatHappened: "",
  whoNeedsHelp: "ME",
  subjectCrewId: "AST-01-COMMANDER",
  conscious: "YES",
  breathingNormal: "YES",
  severeBleeding: "NO",
  whenBegan: "Just now (< 10 min)",
  selectedCategories: [],
  selectedRedFlags: [],
  urgentBypassTriggered: false,
  notes: "",
};

const RED_FLAG_KEYWORDS: Array<{ id: RedFlagSignId; terms: string[] }> = [
  {
    id: "UNCONSCIOUS_UNRESPONSIVE",
    terms: ["unconscious", "unresponsive", "passed out", "not waking", "collapsed"],
  },
  {
    id: "ABNORMAL_ABSENT_BREATHING",
    terms: ["not breathing", "cant breathe", "can't breathe", "gasping", "choking", "stopped breathing"],
  },
  {
    id: "SEVERE_UNCONTROLLED_BLEEDING",
    terms: ["severe bleeding", "heavy bleeding", "spurting", "uncontrolled bleeding", "gushing"],
  },
  {
    id: "SEVERE_CHEST_PAIN",
    terms: ["severe chest pain", "crushing chest", "chest pain", "chest pressure"],
  },
  {
    id: "SUDDEN_NEURO_CHANGES",
    terms: ["slurred speech", "confusion", "one-sided weakness", "facial droop", "seizure", "neurological"],
  },
  {
    id: "SEVERE_ALLERGIC_REACTION",
    terms: ["throat swelling", "anaphylaxis", "lips swelling", "severe allergic", "cant swallow"],
  },
  {
    id: "SERIOUS_BURNS",
    terms: ["serious burn", "severe burn", "electrical burn", "chemical burn", "large burn"],
  },
  {
    id: "SUSPECTED_FRACTURE_MAJOR_TRAUMA",
    terms: ["fracture", "broken bone", "deformed limb", "major trauma", "bone sticking"],
  },
  {
    id: "SEVERE_EYE_INJURY",
    terms: ["severe eye", "chemical in eye", "penetrating eye", "sudden vision loss"],
  },
  {
    id: "SUDDEN_DETERIORATION",
    terms: ["getting rapidly worse", "sudden deterioration", "worsening rapidly"],
  },
];

const URGENT_PRIORITY_PROTOCOL_ORDER: Array<{
  flag: RedFlagSignId;
  protocolId: string;
}> = [
  { flag: "UNCONSCIOUS_UNRESPONSIVE", protocolId: "PROTO-URGENT-AIRWAY-UNRESPONSIVE" },
  { flag: "ABNORMAL_ABSENT_BREATHING", protocolId: "PROTO-URGENT-BREATHING-TOXIC" },
  { flag: "SEVERE_UNCONTROLLED_BLEEDING", protocolId: "PROTO-URGENT-SEVERE-BLEEDING" },
  { flag: "SEVERE_CHEST_PAIN", protocolId: "PROTO-URGENT-CHEST-DISCOMFORT" },
  { flag: "SEVERE_ALLERGIC_REACTION", protocolId: "PROTO-URGENT-ALLERGIC-REACTION" },
  { flag: "SERIOUS_BURNS", protocolId: "PROTO-URGENT-BURNS" },
  { flag: "SEVERE_EYE_INJURY", protocolId: "PROTO-URGENT-EYE-INJURY" },
  { flag: "SUDDEN_NEURO_CHANGES", protocolId: "PROTO-URGENT-HEAD-NEURO" },
  { flag: "SUSPECTED_FRACTURE_MAJOR_TRAUMA", protocolId: "PROTO-URGENT-FRACTURE-TRAUMA" },
  { flag: "SUDDEN_DETERIORATION", protocolId: "PROTO-URGENT-AIRWAY-UNRESPONSIVE" },
];

export function evaluateEmergencyScreening(
  input: MedicalGuidanceScreenInput
): ScreeningEvaluationResult {
  const matchedSet = new Set<RedFlagSignId>(input.selectedRedFlags);
  const reasons: string[] = [];

  if (input.conscious === "NO" || input.conscious === "UNSURE") {
    matchedSet.add("UNCONSCIOUS_UNRESPONSIVE");
    reasons.push(
      input.conscious === "NO"
        ? "Person is reported NOT conscious."
        : "Consciousness is reported UNSURE — treated with urgent caution."
    );
  }
  if (input.breathingNormal === "NO" || input.breathingNormal === "UNSURE") {
    matchedSet.add("ABNORMAL_ABSENT_BREATHING");
    reasons.push(
      input.breathingNormal === "NO"
        ? "Breathing is reported NOT normal."
        : "Normal breathing is UNSURE — treated with urgent caution."
    );
  }
  if (input.severeBleeding === "YES" || input.severeBleeding === "UNSURE") {
    matchedSet.add("SEVERE_UNCONTROLLED_BLEEDING");
    reasons.push(
      input.severeBleeding === "YES"
        ? "Severe bleeding is reported YES."
        : "Severe bleeding is UNSURE — treated with urgent caution."
    );
  }

  const combinedText = `${input.whatHappened} ${input.notes}`.toLowerCase();
  for (const kw of RED_FLAG_KEYWORDS) {
    if (kw.terms.some((t) => combinedText.includes(t))) {
      matchedSet.add(kw.id);
    }
  }

  if (input.selectedCategories.includes("CHEST_DISCOMFORT")) {
    matchedSet.add("SEVERE_CHEST_PAIN");
  }
  if (input.selectedCategories.includes("BREATHING_DIFFICULTIES")) {
    matchedSet.add("ABNORMAL_ABSENT_BREATHING");
  }

  const matchedRedFlags = Array.from(matchedSet);
  for (const rfId of matchedRedFlags) {
    const meta = RED_FLAG_SIGNS.find((r) => r.id === rfId);
    if (meta && !reasons.some((r) => r.includes(meta.urgentWarningText))) {
      reasons.push(meta.urgentWarningText);
    }
  }

  if (input.urgentBypassTriggered && reasons.length === 0) {
    reasons.push("URGENT EMERGENCY button activated directly by crew member.");
  }

  const isEmergency = input.urgentBypassTriggered || matchedRedFlags.length > 0;

  let recommendedProtocolId: string | null = null;
  for (const entry of URGENT_PRIORITY_PROTOCOL_ORDER) {
    if (matchedSet.has(entry.flag)) {
      recommendedProtocolId = entry.protocolId;
      break;
    }
  }
  if (!recommendedProtocolId && input.urgentBypassTriggered) {
    recommendedProtocolId = "PROTO-URGENT-AIRWAY-UNRESPONSIVE";
  }

  const hasUrgentCategory = input.selectedCategories.some((cat) =>
    ["BLEEDING", "BURNS", "EYE_INJURIES", "HEAD_INJURIES", "SUSPECTED_FRACTURES", "ALLERGIC_REACTIONS", "DECOMPRESSION_CONCERNS", "TOXIC_ATMOSPHERE"].includes(
      cat
    )
  );

  const priorityLevel: ScreeningEvaluationResult["priorityLevel"] = isEmergency
    ? "URGENT_RED_FLAG"
    : hasUrgentCategory
    ? "PRIORITY_GUIDANCE"
    : "STANDARD_FIRST_RESPONSE";

  const warningHeadline = isEmergency
    ? "URGENT WARNING: Red-flag signs detected — this may be an emergency. Follow immediate first-response steps and alert human responder now."
    : hasUrgentCategory
    ? "Priority first-response guidance active — monitor closely and notify Crew Medical Officer / Flight Surgeon."
    : "First-response guidance ready — non-diagnostic crew decision support.";

  return {
    isEmergency,
    bypassToUrgent: isEmergency,
    priorityLevel,
    matchedRedFlags,
    warningHeadline,
    warningReasons: reasons,
    recommendedProtocolId,
    nonDiagnosticNotice:
      "Screening checks warning signs only; it does NOT establish a medical diagnosis.",
  };
}

export function searchGuidanceLibrary(
  rawQuery: string,
  groupFilter?: GuidanceCategoryGroup | "ALL",
  resources: KnowledgeResource[] = []
): {
  categories: GuidanceCategoryMeta[];
  protocols: ApprovedGuidanceProtocol[];
  resources: KnowledgeResource[];
} {
  const q = rawQuery.trim().toLowerCase();
  const categories = GUIDANCE_CATEGORIES.filter((cat) => {
    if (groupFilter && groupFilter !== "ALL" && cat.group !== groupFilter) {
      return false;
    }
    if (!q) return true;
    return (
      cat.label.toLowerCase().includes(q) ||
      cat.shortDesc.toLowerCase().includes(q) ||
      cat.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });

  const matchedCatIds = new Set(categories.map((c) => c.id));
  const protocols = APPROVED_GUIDANCE_PROTOCOLS.filter((proto) => {
    if (groupFilter && groupFilter !== "ALL") {
      const hasGroupCat = proto.categoryIds.some((cid) =>
        GUIDANCE_CATEGORIES.some((gc) => gc.id === cid && gc.group === groupFilter)
      );
      if (!hasGroupCat) return false;
    }
    if (!q) return true;
    return (
      proto.title.toLowerCase().includes(q) ||
      proto.searchKeywords.some((k) => k.toLowerCase().includes(q)) ||
      proto.categoryIds.some((cid) => matchedCatIds.has(cid))
    );
  });

  const matchedResources = resources.filter((res) => {
    if (!q) return true;
    return (
      res.title.toLowerCase().includes(q) ||
      res.summary.toLowerCase().includes(q) ||
      res.topic_tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return { categories, protocols, resources: matchedResources };
}

export function resolveProtocolForIntake(
  input: MedicalGuidanceScreenInput,
  screening: ScreeningEvaluationResult,
  continuityState: ContinuityPersistedState,
  operatorRole: ActorRole
): ProtocolResolutionResult {
  if (input.selectedCategories.includes("UNLISTED_COMPLEX_CONCERN")) {
    return {
      found: false,
      protocol: null,
      roleRestrictedNotice: null,
      noProcedureMessage:
        "No approved onboard procedure matches this unlisted or complex concern. Do not invent treatment steps or medication dosages — escalate directly to the Crew Medical Officer or Earth Flight Surgeon.",
      unapprovedWarning:
        "Safety boundary: AEGIS-V will never fabricate unapproved medical procedures or drug dosages.",
    };
  }

  let matched: ApprovedGuidanceProtocol | null = null;

  if (screening.recommendedProtocolId) {
    matched =
      APPROVED_GUIDANCE_PROTOCOLS.find(
        (p) => p.protocolId === screening.recommendedProtocolId
      ) || null;
  }

  if (!matched && input.selectedCategories.length > 0) {
    for (const catId of input.selectedCategories) {
      const found = APPROVED_GUIDANCE_PROTOCOLS.find((p) =>
        p.categoryIds.includes(catId)
      );
      if (found) {
        matched = found;
        break;
      }
    }
  }

  if (!matched && input.whatHappened.trim().length > 0) {
    const q = input.whatHappened.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter((t) => t.length >= 3);
    matched =
      APPROVED_GUIDANCE_PROTOCOLS.find((p) =>
        p.searchKeywords.some((kw) => q.includes(kw) || tokens.some((tok) => kw.includes(tok)))
      ) || null;
  }

  if (!matched) {
    return {
      found: false,
      protocol: null,
      roleRestrictedNotice: null,
      noProcedureMessage:
        "No approved onboard procedure matches your description yet. Select one of the 22 approved categories or contact the Crew Medical Officer / Earth Flight Surgeon directly.",
      unapprovedWarning:
        "Unmatched request safety rule: AEGIS-V does not generate unverified medical instructions or dosages.",
    };
  }

  const cmoUnavailable = !continuityState.cmoAvailable || operatorRole !== "CREW_MEDICAL_OFFICER";
  let roleRestrictedNotice: string | null = null;
  if (matched.requiresCmoForAdvanced && cmoUnavailable) {
    roleRestrictedNotice =
      matched.cmoRestrictedNote ||
      "Continuity role notice: Non-CMO operators may execute stabilization steps only; controlled medications and advanced interventions remain locked for CMO / Earth Flight Surgeon authorization.";
  }

  return {
    found: true,
    protocol: matched,
    roleRestrictedNotice,
    noProcedureMessage: null,
    unapprovedWarning: null,
  };
}

export function findMedicalEquipmentWithAlternatives(
  equipmentIds: string[],
  resolvedEquipment: ResolvedEquipmentItem[],
  protocol?: ApprovedGuidanceProtocol | null
): EquipmentFinderMatch[] {
  const uniqueIds = Array.from(new Set(equipmentIds));
  return uniqueIds.map((eqId) => {
    const found = resolvedEquipment.find((e) => e.equipmentId === eqId);
    const documentedAlt =
      protocol?.equipmentAlternatives[eqId] ||
      "No substitute documented in prototype pack — notify CMO / Flight Surgeon before substituting hardware.";

    if (!found) {
      return {
        equipmentId: eqId,
        name: `Unmanifested Item (${eqId})`,
        storageLocation: "Not recorded in onboard inventory",
        availability: "MISSING",
        operationalStatusLabel: "NOT MANIFESTED / MISSING",
        inspectionAndExpiry: "No onboard inspection record available",
        documentedAlternative: documentedAlt,
        lastConfirmedText: "Unconfirmed",
        requiresVerificationNote:
          "Equipment item is not listed in onboard manifest — never assume availability.",
      };
    }

    const availability =
      found.effectiveStatus === "OPERATIONAL"
        ? "AVAILABLE"
        : found.effectiveStatus === "LIMITED"
        ? "LIMITED"
        : "MISSING";

    const requiresVerificationNote =
      availability === "MISSING"
        ? "Item marked UNAVAILABLE/MISSING — use documented alternative or escalate."
        : availability === "LIMITED"
        ? `Limited operational status: ${found.notes}`
        : null;

    return {
      equipmentId: found.equipmentId,
      name: found.name,
      storageLocation: found.location,
      availability,
      operationalStatusLabel: found.effectiveStatus,
      inspectionAndExpiry: found.maintenanceOrExpiryInfo || found.notes,
      documentedAlternative: documentedAlt,
      lastConfirmedText: found.lastConfirmedAtIso
        ? `Confirmed ${found.lastConfirmedAtIso.slice(0, 16).replace("T", " ")}Z by ${
            found.confirmedBy || "Shift Baseline"
          }`
        : found.confirmationSourceNote,
      requiresVerificationNote,
    };
  });
}

export function buildPersonalizedGuidanceContext(params: {
  subjectCrewId: string;
  intake: MedicalGuidanceScreenInput;
  baseline: BaselineProfile;
  latest: TelemetryLatestResponse;
  envAssessment: EnvironmentSafetyAssessment;
  incidents: IncidentRecord[];
  lifeSafetyEvents: LifeSafetyEvent[];
  subjectiveHistory: SubjectiveCheckinEntry[];
  resolvedEquipment: ResolvedEquipmentItem[];
  crewRoster: CrewRosterMember[];
  continuityState: ContinuityPersistedState;
  lifeSafetyConfig: LifeSafetyConfig;
  earthWanConnected: boolean;
  browserOnline: boolean;
  viewerRole: ActorRole;
}): PersonalizedGuidanceContext {
  const {
    subjectCrewId,
    intake,
    baseline,
    latest,
    envAssessment,
    incidents,
    lifeSafetyEvents,
    subjectiveHistory,
    resolvedEquipment,
    crewRoster,
    continuityState,
    lifeSafetyConfig,
    earthWanConnected,
    browserOnline,
    viewerRole,
  } = params;

  const subjectMember = crewRoster.find((c) => c.crewId === subjectCrewId);
  const subjectCrewName = subjectMember?.name || baseline.full_name || subjectCrewId;

  const priorityParams: ParameterName[] = [
    "heart_rate_bpm",
    "spo2_pct",
    "systolic_bp_mmhg",
    "diastolic_bp_mmhg",
    "respiration_rpm",
    "skin_temp_c",
    "cabin_co2_mmhg",
    "radiation_msv_hr",
    "hydration_ml",
    "visual_symptom_severity",
  ];

  const measuredVitals: MeasuredVitalContextItem[] = [];
  const unavailableOrUnknownInfo: string[] = [];

  for (const param of priorityParams) {
    const status = latest.status_by_parameter?.[param];
    const comp = latest.baseline_comparisons[param];
    const meta = PARAMETER_METADATA[param];
    const band = baseline.metrics[param];

    if (!status || status.isStaleOrUnavailable || status.lastValidValue === null) {
      unavailableOrUnknownInfo.push(
        `${meta.label}: ${status?.freshness || "UNAVAILABLE"} (${
          status?.dataSufficiencyNote || "No recent valid reading — do NOT assume normal"
        })`
      );
      measuredVitals.push({
        parameter: param,
        label: meta.label,
        valueText:
          status?.lastValidValue !== null && status?.lastValidValue !== undefined
            ? `Last valid ${status.lastValidValue.toFixed(meta.decimals)} ${meta.unit} (${status.freshness})`
            : "UNAVAILABLE",
        baselineBandText: band ? `${band.p05}–${band.p95} ${meta.unit}` : "No baseline",
        deviationText: status?.freshnessLabel || "Unavailable / Stale",
        outsideBaseline: false,
        freshness: status?.freshness || "UNAVAILABLE",
        lastValidTimeIso: status?.lastValidTimeIso || null,
      });
    } else {
      const val = status.liveValue ?? status.lastValidValue;
      measuredVitals.push({
        parameter: param,
        label: meta.label,
        valueText: `${val.toFixed(meta.decimals)} ${meta.unit}`,
        baselineBandText: band ? `${band.p05}–${band.p95} ${meta.unit}` : "No baseline",
        deviationText: comp
          ? `${comp.absolute_delta >= 0 ? "+" : ""}${comp.absolute_delta.toFixed(meta.decimals)} ${meta.unit} (${comp.z_score.toFixed(1)}σ)`
          : "Within window",
        outsideBaseline: Boolean(comp?.outside_p05_p95_band),
        freshness: status.freshness,
        lastValidTimeIso: status.lastValidTimeIso,
      });
    }
  }

  const measuredEnvironmentWarnings = envAssessment.findings
    .filter((f) => f.severity !== "NOMINAL")
    .map((f) => `${f.parameterLabel}: ${f.currentText} (${f.severity}) — ${f.message}`);

  const latestSelfCheckin =
    subjectiveHistory.find((s) => s.crewId === subjectCrewId) || subjectiveHistory[0] || null;

  const canViewSensitiveSelfNote =
    viewerRole === "CREW_MEDICAL_OFFICER" || viewerRole === "CREW_MEMBER";

  unavailableOrUnknownInfo.push(
    "Personal medication allergies & chronic prescription list: Not stored in prototype workspace (unknown — confirm verbally with crew member or Flight Surgeon before any medication)."
  );

  const activeIncidentsSummary = [
    ...incidents
      .filter((i) => i.state !== "CLOSED_RETAINED")
      .map((i) => ({
        incidentId: i.incident_id,
        title: i.title,
        severity: i.severity,
        state: i.state,
      })),
    ...lifeSafetyEvents
      .filter((e) => e.state !== "RESOLVED_RETAINED")
      .map((e) => ({
        incidentId: e.eventId,
        title: e.title,
        severity: e.severity,
        state: e.state,
      })),
  ];

  const availableEquipmentCount = resolvedEquipment.filter(
    (e) => e.effectiveStatus === "OPERATIONAL"
  ).length;
  const missingOrLimitedEquipment = resolvedEquipment
    .filter((e) => e.effectiveStatus !== "OPERATIONAL")
    .map((e) => `${e.name} (${e.effectiveStatus}: ${e.location})`);

  const cmoCrewId = "AST-02-FE-PILOT";
  const cmoAvailable =
    continuityState.cmoAvailable &&
    (continuityState.crewAvailabilityOverrides[cmoCrewId] || "AVAILABLE") === "AVAILABLE";

  const primaryId = cmoAvailable
    ? lifeSafetyConfig.primaryResponderCrewId
    : continuityState.replacementOperatorCrewId || lifeSafetyConfig.backupResponderCrewId;
  const backupId =
    lifeSafetyConfig.backupResponderCrewId === primaryId
      ? "AST-04-SCIENTIST"
      : lifeSafetyConfig.backupResponderCrewId;

  const primaryResponderName =
    crewRoster.find((c) => c.crewId === primaryId)?.name || primaryId;
  const backupResponderName =
    crewRoster.find((c) => c.crewId === backupId)?.name || backupId;

  const trainedCrewResponders = crewRoster.map((member) => {
    const cap = SIMULATED_CREW_CAPABILITIES[member.crewId];
    const avail =
      member.crewId === cmoCrewId && !continuityState.cmoAvailable
        ? "UNAVAILABLE"
        : continuityState.crewAvailabilityOverrides[member.crewId] ||
          cap?.defaultAvailability ||
          "AVAILABLE";
    return {
      crewId: member.crewId,
      name: member.name,
      medicalTier: cap?.medicalTier || "CREW_FIRST_RESPONDER",
      availability: avail,
      recordedTraining: cap?.recordedTraining || ["Basic crew orientation (unverified)"],
      permittedScopeNotice:
        cap?.restrictedTasks[0] || "First-response stabilization only; no diagnostic authority.",
    };
  });

  const statusLabel = !browserOnline
    ? "BROWSER OFFLINE — Onboard offline library & IndexedDB queue active"
    : !earthWanConnected
    ? "EARTH COMMS UNAVAILABLE — Deep-space autonomy active; handoffs queued locally"
    : "EARTH COMMS AVAILABLE — Telemetry & consultation queue reachable";

  return {
    subjectCrewId,
    subjectCrewName,
    measuredVitals,
    measuredEnvironmentWarnings,
    userReportedSummary: {
      latestSelfCheckin: latestSelfCheckin
        ? `${latestSelfCheckin.statusLabel}${
            canViewSensitiveSelfNote && latestSelfCheckin.note
              ? ` — "${latestSelfCheckin.note}"`
              : latestSelfCheckin.noteRedacted
              ? " (note redacted for Mission Observer)"
              : ""
          }`
        : null,
      latestSelfCheckinTimeIso: latestSelfCheckin?.submittedAtIso || null,
      reportedSymptoms:
        intake.selectedCategories
          .map((id) => GUIDANCE_CATEGORIES.find((c) => c.id === id)?.label || id)
          .join(", ") || intake.whatHappened || "Not yet specified",
      allergiesAndMedsStatus:
        "Unknown / not recorded in prototype profile — confirm directly before any medication.",
      noteFromIntake: intake.notes || intake.whatHappened || "None recorded",
    },
    unavailableOrUnknownInfo,
    activeIncidentsSummary,
    availableEquipmentCount,
    missingOrLimitedEquipment,
    responderContext: {
      cmoAvailable,
      cmoStatusReason: continuityState.cmoStatusReason,
      continuityActive: continuityState.continuityActive || !cmoAvailable,
      primaryResponderName,
      backupResponderName,
      trainedCrewResponders,
    },
    earthCommsStatus: {
      earthWanConnected,
      browserOnline,
      statusLabel,
    },
  };
}

export function createMedicalGuidanceIncident(params: {
  nowIso: string;
  missionName: string;
  intake: MedicalGuidanceScreenInput;
  screening: ScreeningEvaluationResult;
  resolution: ProtocolResolutionResult;
  reporterName: string;
  reporterRole: ActorRole;
  crewRoster: CrewRosterMember[];
  continuityState: ContinuityPersistedState;
  lifeSafetyConfig: LifeSafetyConfig;
  earthWanConnected: boolean;
  browserOnline: boolean;
}): GuidanceIncidentRecord {
  const {
    nowIso,
    missionName,
    intake,
    screening,
    resolution,
    reporterName,
    reporterRole,
    crewRoster,
    continuityState,
    lifeSafetyConfig,
    earthWanConnected,
    browserOnline,
  } = params;

  const subjectName =
    crewRoster.find((c) => c.crewId === intake.subjectCrewId)?.name ||
    intake.subjectCrewId;

  const cmoAvailable = continuityState.cmoAvailable;
  const primaryResponderId = cmoAvailable
    ? lifeSafetyConfig.primaryResponderCrewId
    : continuityState.replacementOperatorCrewId || "AST-01-COMMANDER";
  const backupResponderId =
    lifeSafetyConfig.backupResponderCrewId === primaryResponderId
      ? "AST-04-SCIENTIST"
      : lifeSafetyConfig.backupResponderCrewId;

  const primaryResponderName =
    crewRoster.find((c) => c.crewId === primaryResponderId)?.name ||
    primaryResponderId;
  const backupResponderName =
    crewRoster.find((c) => c.crewId === backupResponderId)?.name ||
    backupResponderId;

  const ackWindowMin = Math.max(5, lifeSafetyConfig.ackTimeoutMinutes || 15);
  const ackDueAtIso = new Date(
    new Date(nowIso).getTime() + ackWindowMin * 60000
  ).toISOString();

  const initialState: MedicalGuidanceLifecycleState =
    screening.isEmergency
      ? "RESPONDER_NOTIFIED"
      : resolution.found
      ? "GUIDANCE_PROVIDED"
      : "SCREENED";

  const unansweredCmoQuestions: string[] = [];
  if (!cmoAvailable) {
    unansweredCmoQuestions.push(
      `CMO unavailable (${continuityState.cmoStatusReason}): confirm definitive clinical assessment and any restricted medication decisions upon return.`
    );
  }
  if (!resolution.found) {
    unansweredCmoQuestions.push(
      "No approved onboard procedure matched intake — request direct CMO or Earth Flight Surgeon guidance."
    );
  }
  if (screening.isEmergency) {
    unansweredCmoQuestions.push(
      "Red-flag warning signs detected during rapid screening — verify evacuation/monitoring posture with Flight Surgeon."
    );
  }

  const unresolvedRisks: string[] = [];
  if (screening.isEmergency) {
    unresolvedRisks.push("Active red-flag emergency warning; requires human responder confirmation and follow-up.");
  }
  if (!earthWanConnected || !browserOnline) {
    unresolvedRisks.push("Earth communication unavailable at onset — guidance & escalation running locally.");
  }
  if (resolution.roleRestrictedNotice) {
    unresolvedRisks.push(resolution.roleRestrictedNotice);
  }

  const incidentId = `MEDHELP_${nowIso.replace(/[-:TZ.]/g, "").slice(0, 14)}_${Math.random()
    .toString(36)
    .slice(2, 5)
    .toUpperCase()}`;

  const timeline: GuidanceTimelineEntry[] = [
    {
      timestampIso: nowIso,
      actorName: reporterName,
      actorRole: reporterRole,
      fromState: "NEW",
      toState: "REPORTED",
      actionType: "INTAKE_REPORTED",
      summary: `Help requested for ${subjectName} (${intake.whoNeedsHelp}): ${
        intake.whatHappened || intake.selectedCategories.join(", ") || "Urgent assistance"
      }.`,
    },
    {
      timestampIso: nowIso,
      actorName: "AEGIS-V Screening",
      actorRole: reporterRole,
      fromState: "REPORTED" as const,
      toState: "SCREENED" as const,
      actionType: "SCREENING_COMPLETE",
      summary: screening.warningHeadline,
    },
  ];

  if (resolution.found && resolution.protocol) {
    timeline.push({
      timestampIso: nowIso,
      actorName: "AEGIS-V Protocol Library",
      actorRole: reporterRole,
      fromState: "SCREENED",
      toState: "GUIDANCE_PROVIDED",
      actionType: "PROTOCOL_DISPLAYED",
      summary: `Displayed verified protocol ${resolution.protocol.protocolId} (${resolution.protocol.version}): ${resolution.protocol.title}.`,
    });
  }

  if (initialState === "RESPONDER_NOTIFIED") {
    timeline.push({
      timestampIso: nowIso,
      actorName: reporterName,
      actorRole: reporterRole,
      fromState: resolution.found ? "GUIDANCE_PROVIDED" : "SCREENED",
      toState: "RESPONDER_NOTIFIED",
      actionType: "RESPONDER_NOTIFIED",
      summary: `Urgent notification raised to primary responder ${primaryResponderName} (ack due in ${ackWindowMin} min; backup: ${backupResponderName}).`,
    });
  }

  return {
    incidentId,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
    missionName,
    subjectCrewId: intake.subjectCrewId,
    subjectCrewName: subjectName,
    reporterName,
    reporterRole,
    state: initialState,
    priorityLevel: screening.priorityLevel,
    screeningInput: intake,
    screeningResult: screening,
    protocolId: resolution.protocol?.protocolId || null,
    protocolTitle: resolution.protocol?.title || null,
    protocolSource: resolution.protocol?.source || null,
    protocolVersion: resolution.protocol?.version || null,
    noApprovedProcedureNotice: resolution.noProcedureMessage,
    currentStepNumber: 1,
    completedStepNumbers: [],
    primaryResponderId,
    primaryResponderName,
    backupResponderId,
    backupResponderName,
    responderNotifiedAtIso: initialState === "RESPONDER_NOTIFIED" ? nowIso : null,
    ackDueAtIso: initialState === "RESPONDER_NOTIFIED" ? ackDueAtIso : null,
    acknowledgedAtIso: null,
    acknowledgedBy: null,
    escalatedToBackup: false,
    escalationHistory: [],
    outstandingActions: [
      ...(resolution.protocol
        ? [`Complete 5-step guidance (${resolution.protocol.title})`]
        : ["Contact CMO / Earth Flight Surgeon (no matching onboard procedure)"]),
      "Record responder acknowledgment & follow-up condition check",
    ],
    unansweredCmoQuestions,
    unresolvedRisks,
    earthCommsAtCreation: earthWanConnected && browserOnline ? "AVAILABLE" : "UNAVAILABLE",
    earthConsultationStatus: earthWanConnected && browserOnline ? "NOT_QUEUED" : "QUEUED_OFFLINE",
    conditionChecks: [],
    equipmentUsedIds: [],
    timeline,
    syncStatus: browserOnline ? "SYNCED_CLOUD" : "QUEUED_OFFLINE",
    closedAtIso: null,
    closureNotes: null,
  };
}

export function evaluateGuidanceResponderOverdue(
  incident: GuidanceIncidentRecord,
  nowIso: string
): { isOverdue: boolean; overdueMinutes: number } {
  if (
    incident.state !== "RESPONDER_NOTIFIED" ||
    incident.acknowledgedAtIso ||
    !incident.ackDueAtIso
  ) {
    return { isOverdue: false, overdueMinutes: 0 };
  }
  const nowMs = new Date(nowIso).getTime();
  const dueMs = new Date(incident.ackDueAtIso).getTime();
  if (Number.isNaN(nowMs) || Number.isNaN(dueMs) || nowMs <= dueMs) {
    return { isOverdue: false, overdueMinutes: 0 };
  }
  return {
    isOverdue: true,
    overdueMinutes: Math.max(1, Math.round((nowMs - dueMs) / 60000)),
  };
}

export function transitionMedicalGuidanceIncident(
  incident: GuidanceIncidentRecord,
  action:
    | { type: "NOTIFY_RESPONDER"; ackWindowMinutes?: number }
    | { type: "ACKNOWLEDGE_RESPONDER"; note?: string }
    | { type: "ESCALATE_TO_BACKUP"; reason: string }
    | { type: "RECORD_RESPONSE"; summary: string; stepNumber?: number }
    | { type: "ENTER_MONITORING"; note?: string }
    | { type: "CLOSE_EXPLICIT"; closureNotes: string; cmoQuestionAnswer?: string },
  actor: { actorName: string; actorRole: ActorRole; nowIso: string; browserOnline: boolean }
): GuidanceIncidentRecord {
  const { actorName, actorRole, nowIso, browserOnline } = actor;
  const prevState = incident.state;
  let nextState: MedicalGuidanceLifecycleState = prevState;
  let summary = "";
  const updated: GuidanceIncidentRecord = {
    ...incident,
    updatedAtIso: nowIso,
    syncStatus: browserOnline ? "SYNCED_CLOUD" : "QUEUED_OFFLINE",
    timeline: [...incident.timeline],
    escalationHistory: [...incident.escalationHistory],
    outstandingActions: [...incident.outstandingActions],
  };

  if (action.type === "NOTIFY_RESPONDER") {
    const mins = Math.max(5, action.ackWindowMinutes || 15);
    nextState = "RESPONDER_NOTIFIED";
    updated.responderNotifiedAtIso = nowIso;
    updated.ackDueAtIso = new Date(new Date(nowIso).getTime() + mins * 60000).toISOString();
    summary = `Responder notified (${updated.primaryResponderName}); acknowledgment expected within ${mins} min.`;
  } else if (action.type === "ACKNOWLEDGE_RESPONDER") {
    nextState = "ACKNOWLEDGED";
    updated.acknowledgedAtIso = nowIso;
    updated.acknowledgedBy = actorName;
    summary = `Acknowledged by ${actorName}${action.note ? `: ${action.note}` : "."}`;
  } else if (action.type === "ESCALATE_TO_BACKUP") {
    nextState = "ESCALATED";
    updated.priorityLevel = "URGENT_RED_FLAG";
    updated.escalatedToBackup = true;
    updated.escalationHistory.push({
      timestampIso: nowIso,
      reason: action.reason,
      target: updated.backupResponderName,
    });
    summary = `Escalated to backup responder ${updated.backupResponderName}: ${action.reason}`;
  } else if (action.type === "RECORD_RESPONSE") {
    nextState = "RESPONSE_RECORDED";
    updated.outstandingActions = updated.outstandingActions.filter(
      (a) => !a.startsWith("Complete 5-step")
    );
    summary = `Response action recorded by ${actorName}: ${action.summary}`;
  } else if (action.type === "ENTER_MONITORING") {
    nextState = "MONITORING";
    summary = `Incident moved to ongoing monitoring${action.note ? `: ${action.note}` : "."}`;
  } else if (action.type === "CLOSE_EXPLICIT") {
    if (!action.closureNotes.trim()) {
      throw new Error("Explicit human closure requires documented closure notes.");
    }
    if (actorRole === "MISSION_OBSERVER") {
      throw new Error("Mission Observer role cannot close medical guidance incidents.");
    }
    nextState = "CLOSED";
    updated.closedAtIso = nowIso;
    updated.closureNotes = action.closureNotes.trim();
    updated.outstandingActions = [];
    summary = `Incident explicitly closed by ${actorName} (${actorRole}): ${updated.closureNotes}`;
  }

  updated.state = nextState;
  updated.timeline.push({
    timestampIso: nowIso,
    actorName,
    actorRole,
    fromState: prevState,
    toState: nextState,
    actionType: action.type,
    summary,
  });

  return updated;
}

export function recordConditionTrackingUpdate(params: {
  incident: GuidanceIncidentRecord;
  nowIso: string;
  actorName: string;
  actorRole: ActorRole;
  symptoms: string;
  painLevel0to10: number | null;
  responsiveness: ConditionCheckEntry["responsiveness"];
  manualVitalsNote: string;
  changeDirection: ConditionChangeDirection;
  actionsPerformed: string;
  equipmentUsed: string[];
  latest: TelemetryLatestResponse;
  baseline: BaselineProfile;
  browserOnline: boolean;
}): GuidanceIncidentRecord {
  const {
    incident,
    nowIso,
    actorName,
    actorRole,
    symptoms,
    painLevel0to10,
    responsiveness,
    manualVitalsNote,
    changeDirection,
    actionsPerformed,
    equipmentUsed,
    latest,
    baseline,
    browserOnline,
  } = params;

  const vitalKeys: ParameterName[] = [
    "heart_rate_bpm",
    "spo2_pct",
    "systolic_bp_mmhg",
    "respiration_rpm",
    "skin_temp_c",
  ];
  const vitalReadingsSummary: string[] = [];
  const baselineDeviationNotes: string[] = [];
  let vitalsShowUrgentWorsening = false;

  for (const key of vitalKeys) {
    const status = latest.status_by_parameter?.[key];
    const comp = latest.baseline_comparisons[key];
    const meta = PARAMETER_METADATA[key];
    const band = baseline.metrics[key];
    if (!status || status.isStaleOrUnavailable || status.liveValue === null) {
      vitalReadingsSummary.push(
        `${meta.shortLabel}: ${status?.freshness || "UNAVAILABLE"} (not live)`
      );
      continue;
    }
    const v = status.liveValue;
    vitalReadingsSummary.push(`${meta.shortLabel}: ${v.toFixed(meta.decimals)} ${meta.unit} (VALID)`);
    if (comp?.outside_p05_p95_band && band) {
      baselineDeviationNotes.push(
        `${meta.label} (${v.toFixed(meta.decimals)} ${meta.unit}) outside 14-day P05–P95 (${band.p05}–${band.p95}).`
      );
    }
    if ((key === "spo2_pct" && v < 93) || (key === "heart_rate_bpm" && v > 120)) {
      vitalsShowUrgentWorsening = true;
    }
  }

  const prevCheck = incident.conditionChecks[incident.conditionChecks.length - 1];
  const painIncreasedSignificantly =
    painLevel0to10 !== null &&
    (painLevel0to10 >= 8 ||
      (prevCheck?.painLevel0to10 !== null &&
        prevCheck?.painLevel0to10 !== undefined &&
        painLevel0to10 - prevCheck.painLevel0to10 >= 3));

  const responsivenessDegraded =
    responsiveness === "DROWSY_CONFUSED" || responsiveness === "UNRESPONSIVE";

  const escalationWarningTriggered =
    changeDirection === "WORSENING" ||
    painIncreasedSignificantly ||
    responsivenessDegraded ||
    vitalsShowUrgentWorsening;

  const escalationReasons: string[] = [];
  if (changeDirection === "WORSENING") {
    escalationReasons.push("Crew logged condition change as WORSENING.");
  }
  if (painIncreasedSignificantly) {
    escalationReasons.push(`Pain score reported at ${painLevel0to10}/10.`);
  }
  if (responsivenessDegraded) {
    escalationReasons.push(`Responsiveness reported as ${responsiveness.replace(/_/g, " ")}.`);
  }
  if (vitalsShowUrgentWorsening) {
    escalationReasons.push("Valid measured vitals crossed urgent watch range (SpO2 < 93% or HR > 120 bpm).");
  }

  const escalationReason =
    escalationReasons.length > 0 ? escalationReasons.join(" ") : null;

  const entry: ConditionCheckEntry = {
    entryId: `CHK_${nowIso.replace(/[-:TZ.]/g, "").slice(0, 14)}_${incident.conditionChecks.length + 1}`,
    timestampIso: nowIso,
    actorName,
    symptoms: symptoms.trim() || "Condition follow-up check logged",
    painLevel0to10,
    responsiveness,
    vitalReadingsSummary,
    manualVitalsNote: manualVitalsNote.trim(),
    baselineDeviationNotes,
    changeDirection,
    actionsPerformed: actionsPerformed.trim() || "Continued observation",
    equipmentUsed,
    escalationWarningTriggered,
    escalationReason,
    nonCausalNote:
      "Observation correlation note: Subsequent vital or symptom improvement is recorded chronologically and does NOT prove an intervention caused recovery.",
  };

  const prevState = incident.state;
  const nextState: MedicalGuidanceLifecycleState = escalationWarningTriggered
    ? "ESCALATED"
    : prevState === "REPORTED" || prevState === "SCREENED" || prevState === "GUIDANCE_PROVIDED"
    ? "MONITORING"
    : prevState;

  const mergedEquipment = Array.from(new Set([...incident.equipmentUsedIds, ...equipmentUsed]));

  const updated: GuidanceIncidentRecord = {
    ...incident,
    updatedAtIso: nowIso,
    state: nextState,
    priorityLevel: escalationWarningTriggered ? "URGENT_RED_FLAG" : incident.priorityLevel,
    conditionChecks: [...incident.conditionChecks, entry],
    equipmentUsedIds: mergedEquipment,
    syncStatus: browserOnline ? "SYNCED_CLOUD" : "QUEUED_OFFLINE",
    escalationHistory: escalationWarningTriggered
      ? [
          ...incident.escalationHistory,
          {
            timestampIso: nowIso,
            reason: escalationReason || "Condition worsening logged",
            target: `${incident.primaryResponderName} / ${incident.backupResponderName}`,
          },
        ]
      : incident.escalationHistory,
    unresolvedRisks: escalationWarningTriggered
      ? Array.from(
          new Set([
            ...incident.unresolvedRisks,
            `Worsening condition flagged at ${nowIso}: ${escalationReason}`,
          ])
        )
      : incident.unresolvedRisks,
    timeline: [
      ...incident.timeline,
      {
        timestampIso: nowIso,
        actorName,
        actorRole,
        fromState: prevState,
        toState: nextState,
        actionType: escalationWarningTriggered
          ? "CONDITION_WORSENED_ESCALATED"
          : "CONDITION_CHECK_RECORDED",
        summary: escalationWarningTriggered
          ? `ESCALATION RAISED: ${escalationReason}`
          : `Condition check logged (${changeDirection}, pain ${
              painLevel0to10 ?? "N/A"
            }/10, ${responsiveness}).`,
      },
    ],
  };

  return updated;
}

export function buildMedicalGuidanceHandoffMarkdown(
  incident: GuidanceIncidentRecord,
  context: PersonalizedGuidanceContext
): string {
  const lines: string[] = [
    `# AEGIS-V EMERGENCY MEDICAL GUIDANCE & EARTH HANDOFF (${incident.incidentId})`,
    `> **SAFETY NOTICE:** ${MEDICAL_GUIDANCE_PROTOTYPE_SAFETY_NOTICE}`,
    `> **Schema Version:** \`${SCHEMA_VERSION}\``,
    "",
    "## 1. Incident & Escalation Summary",
    `- **Subject Astronaut:** ${incident.subjectCrewName} (\`${incident.subjectCrewId}\`)`,
    `- **Reported By:** ${incident.reporterName} (\`${incident.reporterRole}\`)`,
    `- **Lifecycle State:** \`${incident.state}\` · **Priority:** \`${incident.priorityLevel}\``,
    `- **Created At:** ${incident.createdAtIso} · **Updated At:** ${incident.updatedAtIso}`,
    `- **Earth Comms at Creation:** \`${incident.earthCommsAtCreation}\` · **Consultation Status:** \`${incident.earthConsultationStatus}\``,
    `- **Primary Responder:** ${incident.primaryResponderName} (Ack: ${
      incident.acknowledgedAtIso || "Pending"
    })`,
    `- **Backup Responder:** ${incident.backupResponderName} (Escalated: ${
      incident.escalatedToBackup ? "YES" : "NO"
    })`,
    "",
    "## 2. Initial Problem & Rapid Screening",
    `- **What Happened:** ${incident.screeningInput.whatHappened || "Not specified"}`,
    `- **Who Needs Help:** ${incident.screeningInput.whoNeedsHelp} · **When It Began:** ${incident.screeningInput.whenBegan}`,
    `- **Conscious:** ${incident.screeningInput.conscious} · **Breathing Normal:** ${incident.screeningInput.breathingNormal} · **Severe Bleeding:** ${incident.screeningInput.severeBleeding}`,
    `- **Urgent Screening Warning:** ${incident.screeningResult.warningHeadline}`,
    `- **Verified Procedure Shown:** ${
      incident.protocolTitle
        ? `${incident.protocolTitle} (${incident.protocolId}, ${incident.protocolVersion}, Source: ${incident.protocolSource})`
        : incident.noApprovedProcedureNotice || "None"
    }`,
    "",
    "## 3. Measured Telemetry vs. User-Reported Context vs. Unknown Info",
    "### Measured Parameters",
    ...context.measuredVitals
      .slice(0, 8)
      .map(
        (m) =>
          `- **${m.label}**: ${m.valueText} | Personal P05–P95: ${m.baselineBandText} | ${m.deviationText}`
      ),
    "",
    "### User-Reported Context",
    `- **Reported Symptoms:** ${context.userReportedSummary.reportedSymptoms}`,
    `- **Latest Subjective Check-In:** ${
      context.userReportedSummary.latestSelfCheckin || "None recorded"
    }`,
    `- **Allergies / Medications:** ${context.userReportedSummary.allergiesAndMedsStatus}`,
    "",
    "### Unavailable / Unknown Information (Never Assumed Normal)",
    ...(context.unavailableOrUnknownInfo.length > 0
      ? context.unavailableOrUnknownInfo.map((u) => `- ${u}`)
      : ["- None"]),
    "",
    "## 4. Condition Tracking & Actions Performed",
    ...(incident.conditionChecks.length > 0
      ? incident.conditionChecks.map(
          (c) =>
            `- **${c.timestampIso}** (${c.actorName}): Direction=\`${c.changeDirection}\`, Pain=${
              c.painLevel0to10 ?? "N/A"
            }/10, Resp=${c.responsiveness}, Actions="${c.actionsPerformed}"${
              c.escalationWarningTriggered ? ` [ESCALATED: ${c.escalationReason}]` : ""
            }`
        )
      : ["- No post-intake condition checks logged yet."]),
    "",
    "## 5. Unanswered Questions for CMO / Earth Flight Surgeon",
    ...(incident.unansweredCmoQuestions.length > 0
      ? incident.unansweredCmoQuestions.map((q, idx) => `${idx + 1}. ${q}`)
      : ["1. Confirm follow-up plan and duty clearance."]),
    "",
    "## 6. Chronological Event Log",
    ...incident.timeline.map(
      (t) => `- ${t.timestampIso} [${t.fromState} → ${t.toState}] ${t.actorName}: ${t.summary}`
    ),
  ];

  return lines.join("\n").slice(0, 15900);
}

export function buildConsultationItemFromGuidanceIncident(
  incident: GuidanceIncidentRecord,
  context: PersonalizedGuidanceContext,
  baseline: BaselineProfile,
  earthAvailableNow: boolean
): ConsultationQueueItem {
  const markdown = buildMedicalGuidanceHandoffMarkdown(incident, context);
  const packageId = `MEDHELP_PKG_${incident.incidentId.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 90)}`;
  const syncStatus = earthAvailableNow ? "SYNCED" : "PENDING";
  const questions =
    incident.unansweredCmoQuestions.length > 0
      ? incident.unansweredCmoQuestions.slice(0, 12)
      : [
          `Review onboard first-response incident ${incident.incidentId} (${incident.subjectCrewName}) and advise definitive care / duty clearance.`,
        ];

  return {
    package_id: packageId,
    incident_id: incident.incidentId.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 120),
    created_at: incident.updatedAtIso,
    sync_status: syncStatus,
    last_attempt_at: earthAvailableNow ? incident.updatedAtIso : null,
    error_message: earthAvailableNow
      ? null
      : "Earth communication unavailable — queued locally for Flight Surgeon review.",
    payload: {
      prototype_notice: PROTOTYPE_DISCLAIMER,
      schema_version: SCHEMA_VERSION,
      generated_at: incident.updatedAtIso,
      astronaut_profile: {
        astronaut_id: incident.subjectCrewId,
        full_name: incident.subjectCrewName,
        mission: incident.missionName,
        role: incident.reporterRole,
      },
      baseline_profile: baseline,
      incident_summary: {
        incident_id: incident.incidentId,
        title: `Medical Help: ${incident.protocolTitle || incident.screeningInput.whatHappened || incident.incidentId}`.slice(
          0,
          180
        ),
        rule_id: "RULE-DATA-QUALITY-04",
        severity: incident.priorityLevel === "URGENT_RED_FLAG" ? "HIGH" : "MODERATE",
        state: incident.state === "CLOSED" ? "CLOSED_RETAINED" : "MONITORING",
        created_at: incident.createdAtIso,
        updated_at: incident.updatedAtIso,
        authorized_action: incident.protocolTitle || "First-response stabilization logged",
        procedure_reference: incident.protocolId || "NO_ONBOARD_PROTOCOL",
        post_action_direction: null,
      },
      contributing_observations: [],
      data_quality_summary: {
        unavailableOrUnknownCount: context.unavailableOrUnknownInfo.length,
        cmoAvailable: context.responderContext.cmoAvailable,
        earthCommsStatus: context.earthCommsStatus.statusLabel,
      },
      explanation: {
        rule_id: "RULE-DATA-QUALITY-04",
        threshold_authority: "PROTOTYPE_DEMO_RULE_NOT_CLINICAL_STANDARD",
        prototype_disclaimer: PROTOTYPE_DISCLAIMER,
        evidence_block: [],
        comparison_block: {},
        context_block: {
          screeningPriority: incident.priorityLevel,
          state: incident.state,
        },
        reasoning_block: {
          summary: incident.screeningResult.warningHeadline,
        },
        data_quality_block: {
          unavailableInfo: context.unavailableOrUnknownInfo,
        },
        uncertainty_block: MEDICAL_GUIDANCE_PROTOTYPE_SAFETY_NOTICE,
        references_block: [],
        ai_narrative_summary: {
          text: incident.screeningResult.warningHeadline,
          mode: "TEMPLATE_OFFLINE",
          info_label: "AI_ASSISTED",
          disclaimer: PROTOTYPE_DISCLAIMER,
        },
      },
      post_action_comparisons: {},
      audit_log: [],
      flight_surgeon_questions: questions,
      markdown_report: markdown,
    },
  };
}

export function serializeGuidanceIncidentToOpsRecord(
  incident: GuidanceIncidentRecord,
  ownerId: string
): Omit<OpsRecordDoc, "ownerId"> & { ownerId: string } {
  const cleanId = `MEDG_${incident.incidentId.replace(/[^a-zA-Z0-9_\-]/g, "_")}`.slice(0, 120);
  const titleText = `Medical Help: ${
    incident.protocolTitle || incident.screeningInput.whatHappened || incident.subjectCrewName
  }`.slice(0, 195);

  return {
    ownerId,
    recordId: cleanId,
    recordType: "CHECKLIST_LOG",
    crewId: incident.subjectCrewId.slice(0, 64),
    title: titleText,
    status: incident.state.slice(0, 64),
    timestampIso: incident.updatedAtIso.slice(0, 64),
    payload: {
      kind: "MEDICAL_GUIDANCE_INCIDENT",
      incidentId: incident.incidentId,
      priorityLevel: incident.priorityLevel,
      incident,
    },
  };
}

export function extractGuidanceIncidentsFromOpsRecords(
  records: OpsRecordDoc[]
): GuidanceIncidentRecord[] {
  const list: GuidanceIncidentRecord[] = [];
  for (const rec of records) {
    if (rec.payload?.kind !== "MEDICAL_GUIDANCE_INCIDENT") continue;
    const raw = rec.payload.incident as GuidanceIncidentRecord | undefined;
    if (!raw || !raw.incidentId) continue;
    list.push(raw);
  }
  return list.sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
}

export function buildGuidanceDemoScene(params: {
  sceneId: MedicalHelpDemoSceneId;
  nowIso: string;
  missionName: string;
  crewRoster: CrewRosterMember[];
  continuityState: ContinuityPersistedState;
  lifeSafetyConfig: LifeSafetyConfig;
  latest: TelemetryLatestResponse;
  baseline: BaselineProfile;
  earthWanConnected: boolean;
  browserOnline: boolean;
}): {
  intake: MedicalGuidanceScreenInput;
  incident: GuidanceIncidentRecord;
  continuityOverride?: ContinuityPersistedState;
  earthWanOverride?: boolean;
  sceneBanner: string;
} {
  const {
    sceneId,
    nowIso,
    missionName,
    crewRoster,
    continuityState,
    lifeSafetyConfig,
    latest,
    baseline,
    earthWanConnected,
    browserOnline,
  } = params;

  if (sceneId === "SCENE_A_MINOR_CUT") {
    const intake: MedicalGuidanceScreenInput = {
      whatHappened: "Minor scrape and small 1.5 cm cut on left forearm against storage rack latch",
      whoNeedsHelp: "ME",
      subjectCrewId: "AST-01-COMMANDER",
      conscious: "YES",
      breathingNormal: "YES",
      severeBleeding: "NO",
      whenBegan: "5 minutes ago",
      selectedCategories: ["CUTS_WOUNDS"],
      selectedRedFlags: [],
      urgentBypassTriggered: false,
      notes: "Light oozing stopped easily with sterile pad; full finger sensation normal.",
    };
    const screening = evaluateEmergencyScreening(intake);
    const resolution = resolveProtocolForIntake(intake, screening, continuityState, "CREW_MEMBER");
    const incident = createMedicalGuidanceIncident({
      nowIso,
      missionName,
      intake,
      screening,
      resolution,
      reporterName: "Cmdr. Elena Vance",
      reporterRole: "CREW_MEMBER",
      crewRoster,
      continuityState,
      lifeSafetyConfig,
      earthWanConnected,
      browserOnline,
    });
    return {
      intake,
      incident,
      sceneBanner: "SCENE A — Minor Injury: Small cut handled with standard 5-step first-aid care & documentation.",
    };
  }

  if (sceneId === "SCENE_B_SEVERE_BLEEDING") {
    const intake: MedicalGuidanceScreenInput = {
      whatHappened: "Deep laceration on right forearm with heavy active bleeding during cargo tether adjustment",
      whoNeedsHelp: "ANOTHER_CREW",
      subjectCrewId: "AST-03-SPECIALIST",
      conscious: "YES",
      breathingNormal: "YES",
      severeBleeding: "YES",
      whenBegan: "2 minutes ago",
      selectedCategories: ["BLEEDING"],
      selectedRedFlags: ["SEVERE_UNCONTROLLED_BLEEDING"],
      urgentBypassTriggered: true,
      notes: "Active bright bleeding soaking gauze — immediate direct pressure required.",
    };
    const screening = evaluateEmergencyScreening(intake);
    const resolution = resolveProtocolForIntake(intake, screening, continuityState, "CREW_MEMBER");
    const incident = createMedicalGuidanceIncident({
      nowIso,
      missionName,
      intake,
      screening,
      resolution,
      reporterName: "Cmdr. Elena Vance",
      reporterRole: "CREW_MEMBER",
      crewRoster,
      continuityState,
      lifeSafetyConfig,
      earthWanConnected,
      browserOnline,
    });
    return {
      intake,
      incident,
      sceneBanner:
        "SCENE B — Serious Injury: Red-flag bleeding detected — bypassed questionnaires directly to urgent pressure control & responder escalation.",
    };
  }

  if (sceneId === "SCENE_C_DIZZINESS_ILLNESS") {
    const intake: MedicalGuidanceScreenInput = {
      whatHappened: "Sudden dizziness, lightheadedness, and mild visual blurriness while working near Node-2 rack",
      whoNeedsHelp: "ME",
      subjectCrewId: "AST-01-COMMANDER",
      conscious: "YES",
      breathingNormal: "YES",
      severeBleeding: "NO",
      whenBegan: "15 minutes ago",
      selectedCategories: ["DIZZINESS_FAINTING", "FLUID_SHIFTS_VISUAL"],
      selectedRedFlags: [],
      urgentBypassTriggered: false,
      notes: "Checking personal telemetry, cabin CO2, and baseline deviations without diagnosing.",
    };
    const screening = evaluateEmergencyScreening(intake);
    const resolution = resolveProtocolForIntake(intake, screening, continuityState, "CREW_MEMBER");
    const incident = createMedicalGuidanceIncident({
      nowIso,
      missionName,
      intake,
      screening,
      resolution,
      reporterName: "Cmdr. Elena Vance",
      reporterRole: "CREW_MEMBER",
      crewRoster,
      continuityState,
      lifeSafetyConfig,
      earthWanConnected,
      browserOnline,
    });
    return {
      intake,
      incident,
      sceneBanner:
        "SCENE C — Sudden Illness: Non-diagnostic guidance integrating measured SpO2/CO2/HR deviations & CMO check.",
    };
  }

  if (sceneId === "SCENE_D_CMO_UNAVAILABLE") {
    const cmoDownContinuity: ContinuityPersistedState = {
      ...continuityState,
      continuityActive: true,
      cmoAvailable: false,
      cmoStatusReason:
        "Simulated Scene D: Designated CMO (Dr. Aris Chen) incapacitated / unavailable in isolation berth.",
      replacementOperatorCrewId: "AST-01-COMMANDER",
      crewAvailabilityOverrides: {
        ...continuityState.crewAvailabilityOverrides,
        "AST-02-FE-PILOT": "UNAVAILABLE",
      },
      updatedAtIso: nowIso,
    };
    const intake: MedicalGuidanceScreenInput = {
      whatHappened: "Suspected wrist fracture and swelling after restraint slip while CMO is unavailable",
      whoNeedsHelp: "ANOTHER_CREW",
      subjectCrewId: "AST-04-SCIENTIST",
      conscious: "YES",
      breathingNormal: "YES",
      severeBleeding: "NO",
      whenBegan: "10 minutes ago",
      selectedCategories: ["SUSPECTED_FRACTURES"],
      selectedRedFlags: ["SUSPECTED_FRACTURE_MAJOR_TRAUMA"],
      urgentBypassTriggered: false,
      notes: "Operating via Continuity Mode with non-CMO first responder (Cmdr. Elena Vance); CMO-gated meds locked.",
    };
    const screening = evaluateEmergencyScreening(intake);
    const resolution = resolveProtocolForIntake(intake, screening, cmoDownContinuity, "CREW_MEMBER");
    const incident = createMedicalGuidanceIncident({
      nowIso,
      missionName,
      intake,
      screening,
      resolution,
      reporterName: "Cmdr. Elena Vance",
      reporterRole: "CREW_MEMBER",
      crewRoster,
      continuityState: cmoDownContinuity,
      lifeSafetyConfig,
      earthWanConnected,
      browserOnline,
    });
    return {
      intake,
      incident,
      continuityOverride: cmoDownContinuity,
      sceneBanner:
        "SCENE D — CMO Unavailable: Continuity Mode active, training-scoped stabilization steps unlocked, CMO-restricted drugs remain locked.",
    };
  }

  if (sceneId === "SCENE_E_EARTH_UNAVAILABLE") {
    const intake: MedicalGuidanceScreenInput = {
      whatHappened: "Particulate debris splash in left eye during filter swap while Earth communication link is unavailable",
      whoNeedsHelp: "ME",
      subjectCrewId: "AST-03-SPECIALIST",
      conscious: "YES",
      breathingNormal: "YES",
      severeBleeding: "NO",
      whenBegan: "4 minutes ago",
      selectedCategories: ["EYE_INJURIES"],
      selectedRedFlags: ["SEVERE_EYE_INJURY"],
      urgentBypassTriggered: true,
      notes: "Earth link offline — operating offline guidance library and queuing Flight Surgeon handoff locally.",
    };
    const screening = evaluateEmergencyScreening(intake);
    const resolution = resolveProtocolForIntake(intake, screening, continuityState, "CREW_MEMBER");
    const incident = createMedicalGuidanceIncident({
      nowIso,
      missionName,
      intake,
      screening,
      resolution,
      reporterName: "Maya Lindqvist",
      reporterRole: "CREW_MEMBER",
      crewRoster,
      continuityState,
      lifeSafetyConfig,
      earthWanConnected: false,
      browserOnline,
    });
    return {
      intake,
      incident,
      earthWanOverride: false,
      sceneBanner:
        "SCENE E — Earth Unavailable: Offline procedure search, equipment finder, local logging & queued Earth handoff active.",
    };
  }

  // SCENE_F_CONDITION_WORSENS
  const intake: MedicalGuidanceScreenInput = {
    whatHappened: "Thermal burn to left forearm that initially seemed mild but pain & breathing irritation are now worsening",
    whoNeedsHelp: "ANOTHER_CREW",
    subjectCrewId: "AST-03-SPECIALIST",
    conscious: "YES",
    breathingNormal: "UNSURE",
    severeBleeding: "NO",
    whenBegan: "35 minutes ago",
    selectedCategories: ["BURNS"],
    selectedRedFlags: ["SERIOUS_BURNS", "SUDDEN_DETERIORATION"],
    urgentBypassTriggered: true,
    notes: "Follow-up check shows rising pain and new hoarseness — escalating priority immediately.",
  };
  const screening = evaluateEmergencyScreening(intake);
  const resolution = resolveProtocolForIntake(intake, screening, continuityState, "CREW_MEMBER");
  const baseIncident = createMedicalGuidanceIncident({
    nowIso: new Date(new Date(nowIso).getTime() - 20 * 60000).toISOString(),
    missionName,
    intake,
    screening,
    resolution,
    reporterName: "Cmdr. Elena Vance",
    reporterRole: "CREW_MEMBER",
    crewRoster,
    continuityState,
    lifeSafetyConfig,
    earthWanConnected,
    browserOnline,
  });
  const worsenedIncident = recordConditionTrackingUpdate({
    incident: baseIncident,
    nowIso,
    actorName: "Cmdr. Elena Vance",
    actorRole: "CREW_MEMBER",
    symptoms: "Burn pain escalated from 4/10 to 8/10 with new mild throat irritation",
    painLevel0to10: 8,
    responsiveness: "ALERT",
    manualVitalsNote: "Pain rising; inspecting airway/voice closely.",
    changeDirection: "WORSENING",
    actionsPerformed: "Applied sterile hydrogel sheet; summoned backup responder & Flight Surgeon.",
    equipmentUsed: ["EQ-BURN-DRESSING-13", "EQ-OXIMETER-02"],
    latest,
    baseline,
    browserOnline,
  });

  return {
    intake,
    incident: worsenedIncident,
    sceneBanner:
      "SCENE F — Condition Worsens: Deterioration logged in Condition Tracking — escalation priority raised automatically.",
  };
}
