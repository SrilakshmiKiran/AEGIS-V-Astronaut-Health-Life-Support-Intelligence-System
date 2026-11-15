import { ActorRole, ParameterName } from "./aegisContracts";

export type GuidanceCategoryGroup = "INJURIES" | "SUDDEN_HEALTH" | "SPACEFLIGHT";

export type GuidanceCategoryId =
  // Injuries (8)
  | "CUTS_WOUNDS"
  | "BLEEDING"
  | "BURNS"
  | "BRUISES"
  | "SUSPECTED_FRACTURES"
  | "SPRAINS"
  | "EYE_INJURIES"
  | "HEAD_INJURIES"
  // Sudden health problems (8)
  | "BREATHING_DIFFICULTIES"
  | "CHEST_DISCOMFORT"
  | "DIZZINESS_FAINTING"
  | "SEVERE_HEADACHE"
  | "NAUSEA_VOMITING"
  | "ABDOMINAL_PAIN"
  | "ALLERGIC_REACTIONS"
  | "FEVER_INFECTION"
  // Spaceflight-specific concerns (6)
  | "SPACE_MOTION_SICKNESS"
  | "FLUID_SHIFTS_VISUAL"
  | "DECOMPRESSION_CONCERNS"
  | "RADIATION_EXPOSURE"
  | "TOXIC_ATMOSPHERE"
  | "HEAT_COLD_EMERGENCIES"
  // Special explicit unapproved/unsupported request option for safety verification
  | "UNLISTED_COMPLEX_CONCERN";

export type RedFlagSignId =
  | "UNCONSCIOUS_UNRESPONSIVE"
  | "ABNORMAL_ABSENT_BREATHING"
  | "SEVERE_UNCONTROLLED_BLEEDING"
  | "SEVERE_CHEST_PAIN"
  | "SUDDEN_NEURO_CHANGES"
  | "SEVERE_ALLERGIC_REACTION"
  | "SERIOUS_BURNS"
  | "SUSPECTED_FRACTURE_MAJOR_TRAUMA"
  | "SEVERE_EYE_INJURY"
  | "SUDDEN_DETERIORATION";

export interface GuidanceCategoryMeta {
  id: GuidanceCategoryId;
  group: GuidanceCategoryGroup;
  label: string;
  shortDesc: string;
  keywords: string[];
  defaultRedFlagEligible: boolean;
}

export interface RedFlagSignMeta {
  id: RedFlagSignId;
  label: string;
  urgentWarningText: string;
  defaultProtocolId: string;
}

export type TriStateAnswer = "YES" | "NO" | "UNSURE";

export type HelpTargetPerson = "ME" | "ANOTHER_CREW";

export interface MedicalGuidanceScreenInput {
  whatHappened: string;
  whoNeedsHelp: HelpTargetPerson;
  subjectCrewId: string;
  conscious: TriStateAnswer;
  breathingNormal: TriStateAnswer;
  severeBleeding: TriStateAnswer;
  whenBegan: string;
  selectedCategories: GuidanceCategoryId[];
  selectedRedFlags: RedFlagSignId[];
  urgentBypassTriggered: boolean;
  notes: string;
}

export interface ScreeningEvaluationResult {
  isEmergency: boolean;
  bypassToUrgent: boolean;
  priorityLevel: "URGENT_RED_FLAG" | "PRIORITY_GUIDANCE" | "STANDARD_FIRST_RESPONSE";
  matchedRedFlags: RedFlagSignId[];
  warningHeadline: string;
  warningReasons: string[];
  recommendedProtocolId: string | null;
  nonDiagnosticNotice: string;
}

export type GuidanceStepHeading =
  | "STEP 1 — DO THIS NOW"
  | "STEP 2 — NEXT ACTION"
  | "STEP 3 — CHECK"
  | "STEP 4 — GET HELP"
  | "STEP 5 — CONTINUE MONITORING";

export interface GuidanceStep {
  stepNumber: 1 | 2 | 3 | 4 | 5;
  heading: GuidanceStepHeading;
  whatToDo: string;
  howToDoIt: string;
  equipmentIds: string[];
  whatNotToDo: string;
  whenToStopAndEscalate: string;
}

export interface ApprovedGuidanceProtocol {
  protocolId: string;
  title: string;
  categoryIds: GuidanceCategoryId[];
  source: string;
  version: string;
  isUrgent: boolean;
  allowedForNonCmo: boolean;
  requiresCmoForAdvanced: boolean;
  cmoRestrictedNote?: string;
  overviewNotice: string;
  steps: [GuidanceStep, GuidanceStep, GuidanceStep, GuidanceStep, GuidanceStep];
  equipmentAlternatives: Record<string, string>;
  supportedResourceIds: string[];
  searchKeywords: string[];
  isSimulatedPrototype: true;
}

export interface ProtocolResolutionResult {
  found: boolean;
  protocol: ApprovedGuidanceProtocol | null;
  roleRestrictedNotice: string | null;
  noProcedureMessage: string | null;
  unapprovedWarning: string | null;
}

export type EquipmentFinderAvailability = "AVAILABLE" | "LIMITED" | "MISSING";

export interface EquipmentFinderMatch {
  equipmentId: string;
  name: string;
  storageLocation: string;
  availability: EquipmentFinderAvailability;
  operationalStatusLabel: string;
  inspectionAndExpiry: string;
  documentedAlternative: string;
  lastConfirmedText: string;
  requiresVerificationNote: string | null;
}

export interface MeasuredVitalContextItem {
  parameter: ParameterName;
  label: string;
  valueText: string;
  baselineBandText: string;
  deviationText: string;
  outsideBaseline: boolean;
  freshness: string;
  lastValidTimeIso: string | null;
}

export interface PersonalizedGuidanceContext {
  subjectCrewId: string;
  subjectCrewName: string;
  measuredVitals: MeasuredVitalContextItem[];
  measuredEnvironmentWarnings: string[];
  userReportedSummary: {
    latestSelfCheckin: string | null;
    latestSelfCheckinTimeIso: string | null;
    reportedSymptoms: string;
    allergiesAndMedsStatus: string;
    noteFromIntake: string;
  };
  unavailableOrUnknownInfo: string[];
  activeIncidentsSummary: Array<{
    incidentId: string;
    title: string;
    severity: string;
    state: string;
  }>;
  availableEquipmentCount: number;
  missingOrLimitedEquipment: string[];
  responderContext: {
    cmoAvailable: boolean;
    cmoStatusReason: string;
    continuityActive: boolean;
    primaryResponderName: string;
    backupResponderName: string;
    trainedCrewResponders: Array<{
      crewId: string;
      name: string;
      medicalTier: string;
      availability: string;
      recordedTraining: string[];
      permittedScopeNotice: string;
    }>;
  };
  earthCommsStatus: {
    earthWanConnected: boolean;
    browserOnline: boolean;
    statusLabel: string;
  };
}

export type MedicalGuidanceLifecycleState =
  | "REPORTED"
  | "SCREENED"
  | "GUIDANCE_PROVIDED"
  | "RESPONDER_NOTIFIED"
  | "ACKNOWLEDGED"
  | "RESPONSE_RECORDED"
  | "MONITORING"
  | "CLOSED"
  | "ESCALATED";

export type ConditionChangeDirection = "IMPROVED" | "UNCHANGED" | "WORSENING";

export interface ConditionCheckEntry {
  entryId: string;
  timestampIso: string;
  actorName: string;
  symptoms: string;
  painLevel0to10: number | null;
  responsiveness: "ALERT" | "DROWSY_CONFUSED" | "UNRESPONSIVE" | "UNKNOWN";
  vitalReadingsSummary: string[];
  manualVitalsNote: string;
  baselineDeviationNotes: string[];
  changeDirection: ConditionChangeDirection;
  actionsPerformed: string;
  equipmentUsed: string[];
  escalationWarningTriggered: boolean;
  escalationReason: string | null;
  nonCausalNote: string;
}

export interface GuidanceTimelineEntry {
  timestampIso: string;
  actorName: string;
  actorRole: ActorRole;
  fromState: MedicalGuidanceLifecycleState | "NEW";
  toState: MedicalGuidanceLifecycleState;
  actionType: string;
  summary: string;
}

export interface GuidanceIncidentRecord {
  incidentId: string;
  createdAtIso: string;
  updatedAtIso: string;
  missionName: string;
  subjectCrewId: string;
  subjectCrewName: string;
  reporterName: string;
  reporterRole: ActorRole;
  state: MedicalGuidanceLifecycleState;
  priorityLevel: "URGENT_RED_FLAG" | "PRIORITY_GUIDANCE" | "STANDARD_FIRST_RESPONSE";
  screeningInput: MedicalGuidanceScreenInput;
  screeningResult: ScreeningEvaluationResult;
  protocolId: string | null;
  protocolTitle: string | null;
  protocolSource: string | null;
  protocolVersion: string | null;
  noApprovedProcedureNotice: string | null;
  currentStepNumber: 1 | 2 | 3 | 4 | 5;
  completedStepNumbers: number[];
  primaryResponderId: string;
  primaryResponderName: string;
  backupResponderId: string;
  backupResponderName: string;
  responderNotifiedAtIso: string | null;
  ackDueAtIso: string | null;
  acknowledgedAtIso: string | null;
  acknowledgedBy: string | null;
  escalatedToBackup: boolean;
  escalationHistory: Array<{ timestampIso: string; reason: string; target: string }>;
  outstandingActions: string[];
  unansweredCmoQuestions: string[];
  unresolvedRisks: string[];
  earthCommsAtCreation: "AVAILABLE" | "UNAVAILABLE";
  earthConsultationStatus: "NOT_QUEUED" | "QUEUED_OFFLINE" | "SYNCED_EARTH";
  conditionChecks: ConditionCheckEntry[];
  equipmentUsedIds: string[];
  timeline: GuidanceTimelineEntry[];
  syncStatus: "SYNCED_CLOUD" | "QUEUED_OFFLINE";
  closedAtIso?: string | null;
  closureNotes?: string | null;
}

export type MedicalHelpDemoSceneId =
  | "SCENE_A_MINOR_CUT"
  | "SCENE_B_SEVERE_BLEEDING"
  | "SCENE_C_DIZZINESS_ILLNESS"
  | "SCENE_D_CMO_UNAVAILABLE"
  | "SCENE_E_EARTH_UNAVAILABLE"
  | "SCENE_F_CONDITION_WORSENS";

export const MEDICAL_GUIDANCE_PROTOTYPE_SAFETY_NOTICE =
  "AEGIS-V Emergency Medical Guidance & First-Response Assistant is a decision-support and crew coordination prototype — NOT a medical diagnosis, prescription tool, or autonomous doctor. Every procedure displays its prototype source and version. Missing telemetry is never assumed normal. Contact designated CMO or Earth Flight Surgeon whenever possible.";
