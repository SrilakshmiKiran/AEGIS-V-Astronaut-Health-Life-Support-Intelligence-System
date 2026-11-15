import { ActorRole } from "./aegisContracts";

export type EmergencyCategory =
  | "HEALTH_CONCERN"
  | "ENVIRONMENTAL_HAZARD"
  | "MISSED_CHECKIN"
  | "COMMUNICATION_LOSS"
  | "GENERAL_ASSISTANCE";

export type ThreatClassification =
  | "HEALTH_RELATED"
  | "ENVIRONMENTAL"
  | "MISSED_CHECKIN_WELFARE"
  | "MULTI_FACTOR";

export type LifeSafetyEventState =
  | "DETECTED"
  | "PRIMARY_NOTIFIED"
  | "ACKNOWLEDGED"
  | "OVERDUE_ESCALATED"
  | "RESPONSE_RECORDED"
  | "MONITORING"
  | "RESOLVED_RETAINED";

export type CheckinScheduleStatusCode =
  | "ON_SCHEDULE"
  | "REMINDER_DUE"
  | "MISSED_OVERDUE"
  | "WELFARE_CHECK_ACTIVE"
  | "ESCALATED_BACKUP";

export interface LifeSafetyTimelineEntry {
  entryId: string;
  timestampIso: string;
  eventType:
    | "EMERGENCY_TRIGGERED"
    | "ENV_ANOMALY_FLAGGED"
    | "MISSED_CHECKIN_RECORDED"
    | "WELFARE_CHECK_INITIATED"
    | "PRIMARY_NOTIFIED"
    | "PRIMARY_ACKNOWLEDGED"
    | "ESCALATED_TO_BACKUP"
    | "BACKUP_ACKNOWLEDGED"
    | "RESPONSE_RECORDED"
    | "FOLLOWUP_RECORDED"
    | "RESOLVED_RETAINED";
  actorName: string;
  actorRole: ActorRole;
  summary: string;
  earthCommsStatus: "AVAILABLE" | "UNAVAILABLE";
  browserOnline: boolean;
  observationsSnapshot?: string[];
  dataQualityWarnings?: string[];
  equipmentSnapshot?: string[];
}

export interface LifeSafetyEvent {
  eventId: string;
  createdAtIso: string;
  updatedAtIso: string;
  astronautId: string;
  astronautName: string;
  activeCrewId: string;
  category: EmergencyCategory;
  threatClassification: ThreatClassification;
  severity: "HIGH" | "MODERATE" | "ADVISORY";
  state: LifeSafetyEventState;
  title: string;
  summary: string;
  primaryResponderCrewId: string;
  primaryResponderName: string;
  primaryNotifiedAtIso: string;
  primaryAckAtIso: string | null;
  primaryAckBy: string | null;
  ackDeadlineIso: string;
  backupResponderCrewId: string;
  backupResponderName: string;
  backupNotifiedAtIso: string | null;
  backupAckAtIso: string | null;
  backupAckBy: string | null;
  earthCommsAtTrigger: "AVAILABLE" | "UNAVAILABLE";
  browserOnlineAtTrigger: boolean;
  contributingObservations: Array<{
    parameter: string;
    valueText: string;
    freshness: string;
    sourceType: string;
  }>;
  environmentalSnapshotSummary: string;
  dataQualityWarnings: string[];
  equipmentSummaryAtEvent: string[];
  authorizedProcedureRef: string | null;
  operatorActionNote: string | null;
  followUpObservationNote: string | null;
  resolutionNote: string | null;
  resolvedAtIso: string | null;
  resolvedBy: string | null;
  syncStatus: "QUEUED_OFFLINE" | "SYNCED_CLOUD";
  timeline: LifeSafetyTimelineEntry[];
}

export interface LifeSafetyConfig {
  checkinIntervalHours: number;
  gracePeriodMinutes: number;
  ackTimeoutMinutes: number;
  primaryResponderCrewId: string;
  backupResponderCrewId: string;
  lastCheckinAtIso: string;
  simulatedElapsedOffsetMinutes: number;
  activeWelfareEventId: string | null;
  updatedAtIso: string;
}

export const DEFAULT_LIFE_SAFETY_CONFIG: LifeSafetyConfig = {
  checkinIntervalHours: 8,
  gracePeriodMinutes: 15,
  ackTimeoutMinutes: 10,
  primaryResponderCrewId: "AST-02-FE-PILOT",
  backupResponderCrewId: "AST-01-COMMANDER",
  lastCheckinAtIso: "2026-11-15T00:00:00Z",
  simulatedElapsedOffsetMinutes: 0,
  activeWelfareEventId: null,
  updatedAtIso: "2026-11-15T00:00:00Z",
};

export interface CheckinScheduleEvaluation {
  statusCode: CheckinScheduleStatusCode;
  effectiveNowIso: string;
  lastCheckinAtIso: string;
  nextDueIso: string;
  graceDeadlineIso: string;
  minutesSinceLastCheckin: number;
  minutesUntilDue: number;
  minutesOverdue: number;
  headline: string;
  detail: string;
  safetyNotice: string;
}

export interface EnvironmentFinding {
  id: string;
  parameterLabel: string;
  currentText: string;
  severity: "NOMINAL" | "ADVISORY" | "URGENT" | "FAULT";
  sourceModeLabel: string;
  message: string;
}

export interface EnvironmentSafetyAssessment {
  overallLevel: "NOMINAL" | "ADVISORY" | "URGENT" | "FAULT";
  summaryHeadline: string;
  dataSourceBanner: string;
  findings: EnvironmentFinding[];
  unresolvedWarnings: string[];
}

export interface EmergencyDashboardAnswers {
  whatIsHappening: string;
  threatTypeLabel: string;
  trustworthyObservations: string[];
  untrustworthyOrMissingObservations: string[];
  acknowledgementStatus: string;
  relevantResourcesCount: number;
  unresolvedItems: string[];
  earthCommsSummary: string;
}
