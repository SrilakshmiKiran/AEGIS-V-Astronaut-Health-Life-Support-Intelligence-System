import {
  ALL_18_PARAMETERS,
  ActorRole,
  BaselineProfile,
  IncidentRecord,
  PARAMETER_METADATA,
  ParameterName,
  ParameterTelemetryStatus,
  TelemetryLatestResponse,
} from "../types/aegisContracts";
import {
  ContinuityPersistedState,
  ONBOARD_MEDICAL_EQUIPMENT,
} from "../types/continuityContracts";
import {
  CheckinScheduleEvaluation,
  DEFAULT_LIFE_SAFETY_CONFIG,
  EmergencyCategory,
  EmergencyDashboardAnswers,
  EnvironmentFinding,
  EnvironmentSafetyAssessment,
  LifeSafetyConfig,
  LifeSafetyEvent,
  LifeSafetyEventState,
  LifeSafetyTimelineEntry,
  ThreatClassification,
} from "../types/lifeSafetyContracts";
import {
  CrewRosterMember,
  EclssSnapshot,
  EnvDataSourceMode,
  OpsRecordDoc,
} from "../types/opsContracts";
import {
  ResolvedEquipmentItem,
  formatMissionTimeUtc,
  resolveEquipmentInventory,
} from "./aegisPureEngine";

export const ENV_SOURCE_LABELS: Record<EnvDataSourceMode, string> = {
  SIMULATED: "SYNTHETIC DEMO DATA (no live spacecraft ECLSS bus connected)",
  IMPORTED_RECORD: "IMPORTED HABITAT RECORD (user-loaded JSON/CSV snapshot)",
  MANUAL_ENTRY: "MANUAL CREW INSPECTION (hand-entered gauge reading)",
  VERIFIED_DEVICE: "VERIFIED HARDWARE BUS (external sensor adapter)",
};

export function canOperateLifeSafety(role: ActorRole): boolean {
  return role === "CREW_MEDICAL_OFFICER" || role === "CREW_MEMBER";
}

export function evaluateEnvironmentLifeSafety(
  eclss: EclssSnapshot,
  latest: TelemetryLatestResponse,
  solarStormActive: boolean
): EnvironmentSafetyAssessment {
  const sourceMode: EnvDataSourceMode = eclss.envDataSource || "SIMULATED";
  const sourceModeLabel = ENV_SOURCE_LABELS[sourceMode];
  const findings: EnvironmentFinding[] = [];
  const unresolvedWarnings: string[] = [];

  // 1. Cabin Pressure
  const kpa = eclss.cabinPressureKpa;
  const kpaSeverity: EnvironmentFinding["severity"] =
    kpa < 94 ? "URGENT" : kpa < 98.5 || kpa > 103.5 ? "ADVISORY" : "NOMINAL";
  findings.push({
    id: "ENV-PRESSURE",
    parameterLabel: "Cabin Total Pressure",
    currentText: `${kpa.toFixed(1)} kPa`,
    severity: kpaSeverity,
    sourceModeLabel,
    message:
      kpaSeverity === "URGENT"
        ? "Cabin total pressure below 94.0 kPa warning threshold — inspect hatch seals & hull isolation guides."
        : kpaSeverity === "ADVISORY"
        ? "Cabin total pressure outside nominal 99.0–103.0 kPa band."
        : "Within nominal 99.0–103.0 kPa band.",
  });

  // 2. Cabin Pressure-Loss Rate
  const lossRate = Number(eclss.cabinPressureRateKpaHr ?? 0);
  const rateSeverity: EnvironmentFinding["severity"] =
    lossRate <= -0.5 ? "URGENT" : lossRate <= -0.15 ? "ADVISORY" : "NOMINAL";
  findings.push({
    id: "ENV-PRESSURE-RATE",
    parameterLabel: "Cabin Pressure-Loss Rate",
    currentText: `${lossRate >= 0 ? "+" : ""}${lossRate.toFixed(2)} kPa/hr`,
    severity: rateSeverity,
    sourceModeLabel,
    message:
      rateSeverity === "URGENT"
        ? "Rapid pressure drop rate (<= -0.50 kPa/hr) — prioritize pressure-loss checklist & ultrasonic leak locator."
        : rateSeverity === "ADVISORY"
        ? "Gradual negative pressure drift detected — monitor seal integrity."
        : "Stable pressure rate (nominal <= 0.15 kPa/hr drift).",
  });

  // 3. Oxygen Partial Pressure
  const ppo2 = eclss.ppO2MmHg;
  const ppo2Severity: EnvironmentFinding["severity"] =
    ppo2 < 142 || ppo2 > 178 ? "URGENT" : ppo2 < 148 || ppo2 > 172 ? "ADVISORY" : "NOMINAL";
  findings.push({
    id: "ENV-PPO2",
    parameterLabel: "Oxygen Partial Pressure (ppO2)",
    currentText: `${ppo2.toFixed(1)} mmHg`,
    severity: ppo2Severity,
    sourceModeLabel,
    message:
      ppo2Severity === "NOMINAL"
        ? "Within safe 148–172 mmHg crew target."
        : "Outside 148–172 mmHg safe ppO2 target — verify O2 regulator & mixing fans.",
  });

  // 4. Oxygen Supply Status
  const o2Supply = Number(eclss.o2SupplyPct ?? 92);
  const o2SupplySeverity: EnvironmentFinding["severity"] =
    o2Supply < 35 ? "URGENT" : o2Supply < 60 ? "ADVISORY" : "NOMINAL";
  findings.push({
    id: "ENV-O2-SUPPLY",
    parameterLabel: "Oxygen Supply Reserve",
    currentText: `${o2Supply.toFixed(0)}% reserve`,
    severity: o2SupplySeverity,
    sourceModeLabel,
    message:
      o2SupplySeverity === "NOMINAL"
        ? "Primary & reserve O2 banks nominal (>= 60%)."
        : "O2 supply reserve below 60% — review ECLSS storage & resupply cadence.",
  });

  // 5. Smoke / Fire Detector
  const smoke = eclss.smokeFireStatus || "CLEAR";
  const smokeSeverity: EnvironmentFinding["severity"] =
    smoke === "ALARM"
      ? "URGENT"
      : smoke === "SENSOR_FAULT"
      ? "FAULT"
      : smoke === "ADVISORY"
      ? "ADVISORY"
      : "NOMINAL";
  findings.push({
    id: "ENV-SMOKE-FIRE",
    parameterLabel: "Smoke / Fire Detector Status",
    currentText: smoke.replace(/_/g, " "),
    severity: smokeSeverity,
    sourceModeLabel,
    message:
      smoke === "ALARM"
        ? "SMOKE/FIRE DETECTOR ALARM — locate Portable Breathing Apparatus & Fire Extinguisher immediately."
        : smoke === "SENSOR_FAULT"
        ? "Smoke detector optical sensor fault — unverified particulate coverage."
        : smoke === "ADVISORY"
        ? "Particulate scatter advisory — inspect rack airflow filters."
        : "All optical smoke & thermal channels clear.",
  });

  // 6. Atmospheric Contaminant Observations
  const contam = eclss.contaminantStatus || "NOMINAL";
  const co = eclss.traceCoPpm;
  const contamSeverity: EnvironmentFinding["severity"] =
    contam === "CRITICAL_TOXIC" || co >= 9
      ? "URGENT"
      : contam === "SENSOR_FAULT"
      ? "FAULT"
      : contam === "ELEVATED_TRACE" || co >= 5
      ? "ADVISORY"
      : "NOMINAL";
  findings.push({
    id: "ENV-CONTAMINANTS",
    parameterLabel: "Atmospheric Contaminants & Trace CO",
    currentText: `${contam.replace(/_/g, " ")} · CO ${co.toFixed(1)} ppm`,
    severity: contamSeverity,
    sourceModeLabel,
    message:
      contamSeverity === "URGENT"
        ? "Elevated atmospheric contaminant / trace CO (>= 9.0 ppm) — verify charcoal scrubbers & PBA access."
        : contamSeverity === "FAULT"
        ? "Trace contaminant analyzer fault — readings unverified."
        : contamSeverity === "ADVISORY"
        ? "Elevated trace gas or CO (>= 5.0 ppm) detected — inspect trace contaminant control."
        : "Trace CO (< 5.0 ppm) and NH3/VOC trace monitors nominal.",
  });

  // 7. Ventilation System Status
  const vent = eclss.ventilationStatus || "NOMINAL_FLOW";
  const ventSeverity: EnvironmentFinding["severity"] =
    vent === "FAN_FAULT"
      ? "FAULT"
      : vent === "REDUCED_FLOW" || vent === "BYPASS_ACTIVE"
      ? "ADVISORY"
      : "NOMINAL";
  findings.push({
    id: "ENV-VENTILATION",
    parameterLabel: "Ventilation System Status",
    currentText: vent.replace(/_/g, " "),
    severity: ventSeverity,
    sourceModeLabel,
    message:
      vent === "FAN_FAULT"
        ? "Intermodule ventilation fan fault — risk of localized CO2 pocket buildup."
        : vent === "REDUCED_FLOW" || vent === "BYPASS_ACTIVE"
        ? "Ventilation operating in reduced or bypass configuration."
        : "Cabin mixing & intermodule ventilation airflow nominal.",
  });

  // 8. Life-Support Equipment Health & Fault Status
  const sysHealth = eclss.lifeSupportHealthStatus || "OPERATIONAL";
  const sysSeverity: EnvironmentFinding["severity"] =
    sysHealth === "FAULT_DETECTED"
      ? "URGENT"
      : sysHealth === "OFFLINE_UNVERIFIED"
      ? "FAULT"
      : sysHealth === "DEGRADED_ADVISORY"
      ? "ADVISORY"
      : "NOMINAL";
  findings.push({
    id: "ENV-SYSTEM-HEALTH",
    parameterLabel: "Life-Support Equipment Health",
    currentText: `${sysHealth.replace(/_/g, " ")} · Scrubber ${eclss.scrubberBedPct}%`,
    severity: sysSeverity,
    sourceModeLabel,
    message:
      sysSeverity === "NOMINAL"
        ? "ECLSS hardware health nominal and scrubber capacity >= 60%."
        : "Life-support hardware degraded, faulted, or unverified — review subsystem rack status.",
  });

  // 9. Reuse existing CO2 & Radiation telemetry channels (respecting freshness!)
  const co2Status = latest.status_by_parameter?.cabin_co2_mmhg;
  const co2Comp = latest.baseline_comparisons?.cabin_co2_mmhg;
  const radStatus = latest.status_by_parameter?.radiation_msv_hr;
  const radComp = latest.baseline_comparisons?.radiation_msv_hr;

  if (co2Status) {
    const isStale = co2Status.isStaleOrUnavailable;
    const isHigh = !isStale && co2Status.liveValue !== null && co2Status.liveValue > 4.2;
    const sev: EnvironmentFinding["severity"] = isStale
      ? "FAULT"
      : isHigh
      ? "URGENT"
      : co2Comp?.outside_p05_p95_band
      ? "ADVISORY"
      : "NOMINAL";
    findings.push({
      id: "ENV-CO2-TELEMETRY",
      parameterLabel: "Cabin CO2 (Telemetry Channel)",
      currentText:
        co2Status.liveValue !== null
          ? `${co2Status.liveValue.toFixed(2)} mmHg`
          : `${co2Status.freshness} (last valid: ${co2Status.lastValidValue?.toFixed(2) ?? "N/A"} mmHg)`,
      severity: sev,
      sourceModeLabel: co2Status.lastValidObservation?.source_type || "SIMULATED",
      message: isStale
        ? `CO2 channel ${co2Status.freshness} — not displayed as live; cross-check CDRA gauge.`
        : isHigh
        ? "Cabin CO2 elevated (> 4.2 mmHg) — check scrubber differential & crew symptoms."
        : "Cabin CO2 within personal habitat baseline.",
    });
  }

  if (radStatus) {
    const isStale = radStatus.isStaleOrUnavailable;
    const isHigh = (!isStale && radStatus.liveValue !== null && radStatus.liveValue >= 0.08) || solarStormActive;
    const sev: EnvironmentFinding["severity"] = isStale
      ? "FAULT"
      : isHigh
      ? "URGENT"
      : radComp?.outside_p05_p95_band
      ? "ADVISORY"
      : "NOMINAL";
    findings.push({
      id: "ENV-RADIATION-TELEMETRY",
      parameterLabel: "Radiation / SPE Weather (Telemetry)",
      currentText:
        radStatus.liveValue !== null
          ? `${radStatus.liveValue.toFixed(3)} mSv/hr${solarStormActive ? " · SPE ACTIVE" : ""}`
          : `${radStatus.freshness}${solarStormActive ? " · SPE ACTIVE" : ""}`,
      severity: sev,
      sourceModeLabel: radStatus.lastValidObservation?.source_type || "SIMULATED",
      message: solarStormActive
        ? "Solar Particle Event (SPE) drill/alert active — review storm shelter verification."
        : isStale
        ? `Radiation channel ${radStatus.freshness} — verify local dosimeter kit.`
        : isHigh
        ? "Elevated dose rate (>= 0.08 mSv/hr) — inspect shelter shielding."
        : "Ambient dose rate within habitat reference band.",
    });
  }

  findings.forEach((f) => {
    if (f.severity !== "NOMINAL") {
      unresolvedWarnings.push(`${f.parameterLabel} [${f.severity}]: ${f.message}`);
    }
  });

  const hasUrgent = findings.some((f) => f.severity === "URGENT");
  const hasFault = findings.some((f) => f.severity === "FAULT");
  const hasAdvisory = findings.some((f) => f.severity === "ADVISORY");

  const overallLevel: EnvironmentSafetyAssessment["overallLevel"] = hasUrgent
    ? "URGENT"
    : hasFault
    ? "FAULT"
    : hasAdvisory
    ? "ADVISORY"
    : "NOMINAL";

  const summaryHeadline =
    overallLevel === "URGENT"
      ? `Urgent Habitat Life-Safety Flag (${findings.filter((f) => f.severity === "URGENT").length} channel(s))`
      : overallLevel === "FAULT"
      ? "Sensor / Hardware Unverified — Inspect Faulted Life-Safety Channels"
      : overallLevel === "ADVISORY"
      ? `Environmental Advisory (${findings.filter((f) => f.severity === "ADVISORY").length} channel(s) outside nominal)`
      : "All Monitored Habitat Life-Safety Channels Nominal";

  return {
    overallLevel,
    summaryHeadline,
    dataSourceBanner: sourceModeLabel,
    findings,
    unresolvedWarnings,
  };
}

export function evaluateCheckinScheduleStatus(
  config: LifeSafetyConfig,
  realNowIso: string = new Date().toISOString()
): CheckinScheduleEvaluation {
  const realMs = Date.parse(realNowIso);
  const offsetMs = (config.simulatedElapsedOffsetMinutes || 0) * 60000;
  const effectiveMs = (Number.isFinite(realMs) ? realMs : Date.now()) + offsetMs;
  const effectiveNowIso = new Date(effectiveMs).toISOString();

  const lastMs = Date.parse(config.lastCheckinAtIso);
  const safeLastMs = Number.isFinite(lastMs) ? lastMs : effectiveMs;
  const intervalMs = Math.max(1, config.checkinIntervalHours) * 3600 * 1000;
  const graceMs = Math.max(1, config.gracePeriodMinutes) * 60000;

  const nextDueMs = safeLastMs + intervalMs;
  const graceDeadlineMs = nextDueMs + graceMs;

  const minutesSinceLastCheckin = Math.max(0, Math.round((effectiveMs - safeLastMs) / 60000));
  const minutesUntilDue = Math.round((nextDueMs - effectiveMs) / 60000);
  const minutesOverdue = Math.max(0, Math.round((effectiveMs - graceDeadlineMs) / 60000));

  const safetyNotice =
    "Safety Rule: Never infer unconsciousness or medical incapacity from a missed check-in alone — crew may be in EVA prep, sleep shift, or RF shadow.";

  if (config.activeWelfareEventId) {
    return {
      statusCode: "WELFARE_CHECK_ACTIVE",
      effectiveNowIso,
      lastCheckinAtIso: new Date(safeLastMs).toISOString(),
      nextDueIso: new Date(nextDueMs).toISOString(),
      graceDeadlineIso: new Date(graceDeadlineMs).toISOString(),
      minutesSinceLastCheckin,
      minutesUntilDue,
      minutesOverdue,
      headline: "Welfare Check & Escalation Active",
      detail: `Active missed check-in welfare workflow (${config.activeWelfareEventId}) awaiting confirmation/resolution.`,
      safetyNotice,
    };
  }

  if (effectiveMs >= graceDeadlineMs) {
    return {
      statusCode: "MISSED_OVERDUE",
      effectiveNowIso,
      lastCheckinAtIso: new Date(safeLastMs).toISOString(),
      nextDueIso: new Date(nextDueMs).toISOString(),
      graceDeadlineIso: new Date(graceDeadlineMs).toISOString(),
      minutesSinceLastCheckin,
      minutesUntilDue,
      minutesOverdue,
      headline: `Check-In Overdue (+${minutesOverdue} min past grace period)`,
      detail: `Scheduled ${config.checkinIntervalHours}h check-in & ${config.gracePeriodMinutes}m grace window elapsed. Authorized operator may log a missed check-in and initiate a welfare check.`,
      safetyNotice,
    };
  }

  if (effectiveMs >= nextDueMs) {
    return {
      statusCode: "REMINDER_DUE",
      effectiveNowIso,
      lastCheckinAtIso: new Date(safeLastMs).toISOString(),
      nextDueIso: new Date(nextDueMs).toISOString(),
      graceDeadlineIso: new Date(graceDeadlineMs).toISOString(),
      minutesSinceLastCheckin,
      minutesUntilDue: 0,
      minutesOverdue: 0,
      headline: "Crew Check-In Due (Within Grace Period)",
      detail: `Grace period expires at ${formatMissionTimeUtc(new Date(graceDeadlineMs).toISOString())}. Record check-in to keep schedule nominal.`,
      safetyNotice,
    };
  }

  return {
    statusCode: "ON_SCHEDULE",
    effectiveNowIso,
    lastCheckinAtIso: new Date(safeLastMs).toISOString(),
    nextDueIso: new Date(nextDueMs).toISOString(),
    graceDeadlineIso: new Date(graceDeadlineMs).toISOString(),
    minutesSinceLastCheckin,
    minutesUntilDue: Math.max(0, minutesUntilDue),
    minutesOverdue: 0,
    headline: "Crew Check-In On Schedule",
    detail: `Next scheduled check-in due at ${formatMissionTimeUtc(new Date(nextDueMs).toISOString())} (in ${Math.max(
      0,
      minutesUntilDue
    )} min).`,
    safetyNotice,
  };
}

export function isLifeSafetyAckOverdue(
  event: LifeSafetyEvent,
  effectiveNowIso: string
): boolean {
  if (event.state !== "PRIMARY_NOTIFIED") return false;
  if (event.primaryAckAtIso) return false;
  const nowMs = Date.parse(effectiveNowIso);
  const deadlineMs = Date.parse(event.ackDeadlineIso);
  return Number.isFinite(nowMs) && Number.isFinite(deadlineMs) && nowMs >= deadlineMs;
}

export function createEmergencyLifeSafetyEvent(input: {
  nowIso: string;
  astronautId: string;
  astronautName: string;
  activeCrewId: string;
  actorName: string;
  actorRole: ActorRole;
  category: EmergencyCategory;
  title?: string;
  notes: string;
  latest: TelemetryLatestResponse;
  eclss: EclssSnapshot;
  envAssessment: EnvironmentSafetyAssessment;
  config: LifeSafetyConfig;
  crewRoster: CrewRosterMember[];
  continuityState: ContinuityPersistedState;
  earthWanConnected: boolean;
  browserOnline: boolean;
}): LifeSafetyEvent {
  const nowMs = Date.parse(input.nowIso) || Date.now();
  const ackDeadlineIso = new Date(
    nowMs + Math.max(1, input.config.ackTimeoutMinutes) * 60000
  ).toISOString();
  const eventId = `LSS_${nowMs}`;

  const primaryCrew = input.crewRoster.find(
    (c) => c.crewId === input.config.primaryResponderCrewId
  );
  const backupCrew = input.crewRoster.find(
    (c) => c.crewId === input.config.backupResponderCrewId
  );

  // Build snapshot of valid vs untrustworthy telemetry
  const keyParams: ParameterName[] = [
    "heart_rate_bpm",
    "spo2_pct",
    "systolic_bp_mmhg",
    "respiration_rpm",
    "cabin_co2_mmhg",
    "radiation_msv_hr",
  ];
  const contributingObservations: LifeSafetyEvent["contributingObservations"] = [];
  const dataQualityWarnings: string[] = [];

  for (const param of keyParams) {
    const st = input.latest.status_by_parameter?.[param];
    const meta = PARAMETER_METADATA[param];
    if (!st) continue;
    if (!st.isStaleOrUnavailable && st.liveValue !== null) {
      contributingObservations.push({
        parameter: meta.label,
        valueText: `${st.liveValue.toFixed(meta.decimals)} ${meta.unit}`,
        freshness: st.freshness,
        sourceType: st.lastValidObservation?.source_type || "SIMULATED",
      });
    } else {
      dataQualityWarnings.push(
        `${meta.label}: ${st.freshnessLabel}${
          st.lastValidValue !== null
            ? ` (last valid: ${st.lastValidValue.toFixed(meta.decimals)} ${meta.unit} at ${formatMissionTimeUtc(
                st.lastValidTimeIso
              )})`
            : ""
        }`
      );
    }
  }

  if (input.latest.quarantined_recent.length > 0) {
    dataQualityWarnings.push(
      `${input.latest.quarantined_recent.length} quarantined telemetry packet(s) excluded from live display.`
    );
  }
  input.envAssessment.unresolvedWarnings.forEach((w) => dataQualityWarnings.push(w));

  const resolvedEq = resolveEquipmentInventory(
    ONBOARD_MEDICAL_EQUIPMENT,
    input.continuityState
  );
  const equipmentSummaryAtEvent = resolvedEq.map(
    (eq) =>
      `${eq.name} [${eq.availability} · ${eq.effectiveStatus} · ${eq.location}]`
  );

  const threatClassification: ThreatClassification =
    input.category === "ENVIRONMENTAL_HAZARD"
      ? "ENVIRONMENTAL"
      : input.category === "MISSED_CHECKIN"
      ? "MISSED_CHECKIN_WELFARE"
      : input.category === "HEALTH_CONCERN"
      ? input.envAssessment.overallLevel === "URGENT"
        ? "MULTI_FACTOR"
        : "HEALTH_RELATED"
      : "MULTI_FACTOR";

  const severity: LifeSafetyEvent["severity"] =
    input.category === "MISSED_CHECKIN" ? "MODERATE" : "HIGH";

  const defaultTitle =
    input.category === "MISSED_CHECKIN"
      ? `Welfare Check Initiated — Missed Scheduled Check-In (${input.astronautName})`
      : input.category === "ENVIRONMENTAL_HAZARD"
      ? `Priority Environmental Life-Safety Alert (${input.astronautName})`
      : `Priority Crew Emergency Request (${input.astronautName})`;

  const environmentalSnapshotSummary = `Pressure ${input.eclss.cabinPressureKpa.toFixed(
    1
  )} kPa (rate ${Number(input.eclss.cabinPressureRateKpaHr ?? 0).toFixed(
    2
  )} kPa/hr), ppO2 ${input.eclss.ppO2MmHg.toFixed(1)} mmHg, O2 reserve ${Number(
    input.eclss.o2SupplyPct ?? 92
  ).toFixed(0)}%, Smoke: ${input.eclss.smokeFireStatus || "CLEAR"}, Vent: ${
    input.eclss.ventilationStatus || "NOMINAL_FLOW"
  } [${input.eclss.envDataSource || "SIMULATED"}]`;

  const entry1: LifeSafetyTimelineEntry = {
    entryId: `TL_${nowMs}_1`,
    timestampIso: input.nowIso,
    eventType:
      input.category === "MISSED_CHECKIN"
        ? "MISSED_CHECKIN_RECORDED"
        : "EMERGENCY_TRIGGERED",
    actorName: input.actorName,
    actorRole: input.actorRole,
    summary:
      input.notes.trim() ||
      (input.category === "MISSED_CHECKIN"
        ? "Missed check-in logged; authorized welfare check & primary responder alert initiated. No medical incapacity inferred."
        : "Priority emergency request confirmed by operator; onboard escalation workflow activated (simulated crew notification)."),
    earthCommsStatus: input.earthWanConnected ? "AVAILABLE" : "UNAVAILABLE",
    browserOnline: input.browserOnline,
    observationsSnapshot: contributingObservations.map(
      (o) => `${o.parameter}: ${o.valueText} (${o.freshness}, ${o.sourceType})`
    ),
    dataQualityWarnings,
    equipmentSnapshot: equipmentSummaryAtEvent.slice(0, 6),
  };

  const entry2: LifeSafetyTimelineEntry = {
    entryId: `TL_${nowMs}_2`,
    timestampIso: input.nowIso,
    eventType: "PRIMARY_NOTIFIED",
    actorName: "AEGIS Life-Safety Sentinel",
    actorRole: input.actorRole,
    summary: `Notified configured primary onboard responder: ${
      primaryCrew?.name || input.config.primaryResponderCrewId
    }. Acknowledgement window: ${input.config.ackTimeoutMinutes} min (due ${formatMissionTimeUtc(
      ackDeadlineIso
    )}).`,
    earthCommsStatus: input.earthWanConnected ? "AVAILABLE" : "UNAVAILABLE",
    browserOnline: input.browserOnline,
  };

  return {
    eventId,
    createdAtIso: input.nowIso,
    updatedAtIso: input.nowIso,
    astronautId: input.astronautId,
    astronautName: input.astronautName,
    activeCrewId: input.activeCrewId,
    category: input.category,
    threatClassification,
    severity,
    state: "PRIMARY_NOTIFIED",
    title: (input.title || defaultTitle).slice(0, 180),
    summary:
      input.notes.trim() ||
      (input.category === "MISSED_CHECKIN"
        ? "Crew check-in overdue past grace window. Welfare verification initiated without assuming medical incapacity."
        : "Crew emergency support request activated and retained in local/cloud event recorder."),
    primaryResponderCrewId: input.config.primaryResponderCrewId,
    primaryResponderName: primaryCrew?.name || input.config.primaryResponderCrewId,
    primaryNotifiedAtIso: input.nowIso,
    primaryAckAtIso: null,
    primaryAckBy: null,
    ackDeadlineIso,
    backupResponderCrewId: input.config.backupResponderCrewId,
    backupResponderName: backupCrew?.name || input.config.backupResponderCrewId,
    backupNotifiedAtIso: null,
    backupAckAtIso: null,
    backupAckBy: null,
    earthCommsAtTrigger: input.earthWanConnected ? "AVAILABLE" : "UNAVAILABLE",
    browserOnlineAtTrigger: input.browserOnline,
    contributingObservations,
    environmentalSnapshotSummary,
    dataQualityWarnings,
    equipmentSummaryAtEvent,
    authorizedProcedureRef: null,
    operatorActionNote: null,
    followUpObservationNote: null,
    resolutionNote: null,
    resolvedAtIso: null,
    resolvedBy: null,
    syncStatus: input.browserOnline ? "SYNCED_CLOUD" : "QUEUED_OFFLINE",
    timeline: [entry1, entry2],
  };
}

export function applyLifeSafetyTransition(
  event: LifeSafetyEvent,
  action:
    | {
        type: "ACKNOWLEDGE_PRIMARY" | "ACKNOWLEDGE_BACKUP";
        note?: string;
      }
    | {
        type: "ESCALATE_BACKUP";
        reason?: string;
      }
    | {
        type: "RECORD_RESPONSE";
        procedureRef: string;
        actionNote: string;
      }
    | {
        type: "ADD_FOLLOWUP";
        followUpNote: string;
        observationsSummary?: string[];
      }
    | {
        type: "RESOLVE_RETAIN";
        resolutionNote: string;
      },
  actor: {
    actorName: string;
    actorRole: ActorRole;
    nowIso: string;
    earthWanConnected: boolean;
    browserOnline: boolean;
  }
): LifeSafetyEvent {
  if (!canOperateLifeSafety(actor.actorRole)) {
    throw new Error(
      `Permission denied: Role '${actor.actorRole}' is read-only and cannot modify life-safety event state.`
    );
  }
  if (event.state === "RESOLVED_RETAINED") {
    throw new Error("This life-safety event is already resolved and permanently retained in history.");
  }

  const earthCommsStatus: "AVAILABLE" | "UNAVAILABLE" = actor.earthWanConnected
    ? "AVAILABLE"
    : "UNAVAILABLE";
  const nextSeq = event.timeline.length + 1;
  const syncStatus: "QUEUED_OFFLINE" | "SYNCED_CLOUD" = actor.browserOnline
    ? "SYNCED_CLOUD"
    : "QUEUED_OFFLINE";

  if (action.type === "ACKNOWLEDGE_PRIMARY") {
    const entry: LifeSafetyTimelineEntry = {
      entryId: `TL_${Date.now()}_${nextSeq}`,
      timestampIso: actor.nowIso,
      eventType: "PRIMARY_ACKNOWLEDGED",
      actorName: actor.actorName,
      actorRole: actor.actorRole,
      summary:
        action.note?.trim() ||
        `Primary responder workflow acknowledged by ${actor.actorName}.`,
      earthCommsStatus,
      browserOnline: actor.browserOnline,
    };
    return {
      ...event,
      updatedAtIso: actor.nowIso,
      state: "ACKNOWLEDGED",
      primaryAckAtIso: actor.nowIso,
      primaryAckBy: actor.actorName,
      syncStatus,
      timeline: [...event.timeline, entry],
    };
  }

  if (action.type === "ESCALATE_BACKUP") {
    const entry: LifeSafetyTimelineEntry = {
      entryId: `TL_${Date.now()}_${nextSeq}`,
      timestampIso: actor.nowIso,
      eventType: "ESCALATED_TO_BACKUP",
      actorName: actor.actorName,
      actorRole: actor.actorRole,
      summary:
        action.reason?.trim() ||
        `Primary acknowledgement overdue/unavailable — escalated to backup responder: ${event.backupResponderName}.`,
      earthCommsStatus,
      browserOnline: actor.browserOnline,
    };
    return {
      ...event,
      updatedAtIso: actor.nowIso,
      state: "OVERDUE_ESCALATED",
      backupNotifiedAtIso: actor.nowIso,
      syncStatus,
      timeline: [...event.timeline, entry],
    };
  }

  if (action.type === "ACKNOWLEDGE_BACKUP") {
    const entry: LifeSafetyTimelineEntry = {
      entryId: `TL_${Date.now()}_${nextSeq}`,
      timestampIso: actor.nowIso,
      eventType: "BACKUP_ACKNOWLEDGED",
      actorName: actor.actorName,
      actorRole: actor.actorRole,
      summary:
        action.note?.trim() ||
        `Backup responder acknowledgement recorded by ${actor.actorName}.`,
      earthCommsStatus,
      browserOnline: actor.browserOnline,
    };
    return {
      ...event,
      updatedAtIso: actor.nowIso,
      state: "ACKNOWLEDGED",
      backupNotifiedAtIso: event.backupNotifiedAtIso || actor.nowIso,
      backupAckAtIso: actor.nowIso,
      backupAckBy: actor.actorName,
      syncStatus,
      timeline: [...event.timeline, entry],
    };
  }

  if (action.type === "RECORD_RESPONSE") {
    const entry: LifeSafetyTimelineEntry = {
      entryId: `TL_${Date.now()}_${nextSeq}`,
      timestampIso: actor.nowIso,
      eventType: "RESPONSE_RECORDED",
      actorName: actor.actorName,
      actorRole: actor.actorRole,
      summary: `Approved reference [${action.procedureRef}]: ${action.actionNote.trim()}`,
      earthCommsStatus,
      browserOnline: actor.browserOnline,
    };
    return {
      ...event,
      updatedAtIso: actor.nowIso,
      state: "RESPONSE_RECORDED",
      authorizedProcedureRef: action.procedureRef,
      operatorActionNote: action.actionNote.trim(),
      syncStatus,
      timeline: [...event.timeline, entry],
    };
  }

  if (action.type === "ADD_FOLLOWUP") {
    const entry: LifeSafetyTimelineEntry = {
      entryId: `TL_${Date.now()}_${nextSeq}`,
      timestampIso: actor.nowIso,
      eventType: "FOLLOWUP_RECORDED",
      actorName: actor.actorName,
      actorRole: actor.actorRole,
      summary: `Follow-up check: ${action.followUpNote.trim()}`,
      earthCommsStatus,
      browserOnline: actor.browserOnline,
      observationsSnapshot: action.observationsSummary,
    };
    return {
      ...event,
      updatedAtIso: actor.nowIso,
      state: "MONITORING",
      followUpObservationNote: action.followUpNote.trim(),
      syncStatus,
      timeline: [...event.timeline, entry],
    };
  }

  if (action.type === "RESOLVE_RETAIN") {
    // RESOLVE_RETAIN — requires explicit human action; never auto-closes
    const resNote =
      action.resolutionNote.trim() ||
      "Human operator verified crew/habitat status and closed active escalation.";
    const entry: LifeSafetyTimelineEntry = {
      entryId: `TL_${Date.now()}_${nextSeq}`,
      timestampIso: actor.nowIso,
      eventType: "RESOLVED_RETAINED",
      actorName: actor.actorName,
      actorRole: actor.actorRole,
      summary: `Explicit human resolution (retained in history): ${resNote}`,
      earthCommsStatus,
      browserOnline: actor.browserOnline,
    };
    return {
      ...event,
      updatedAtIso: actor.nowIso,
      state: "RESOLVED_RETAINED",
      resolutionNote: resNote,
      resolvedAtIso: actor.nowIso,
      resolvedBy: actor.actorName,
      syncStatus,
      timeline: [...event.timeline, entry],
    };
  }

  return event;
}

export function buildEmergencyConsolidatedSummary(input: {
  activeEvent: LifeSafetyEvent | null;
  latest: TelemetryLatestResponse;
  envAssessment: EnvironmentSafetyAssessment;
  checkinEval: CheckinScheduleEvaluation;
  incidents: IncidentRecord[];
  resolvedEquipment: ResolvedEquipmentItem[];
  earthWanConnected: boolean;
  browserOnline: boolean;
  offlineQueueCount: number;
}): EmergencyDashboardAnswers {
  const openHealthIncidents = input.incidents.filter((i) => i.state !== "CLOSED_RETAINED");
  const trustworthyObservations: string[] = [];
  const untrustworthyOrMissingObservations: string[] = [];

  for (const param of ALL_18_PARAMETERS) {
    const st = input.latest.status_by_parameter?.[param];
    const meta = PARAMETER_METADATA[param];
    if (!st) continue;
    if (!st.isStaleOrUnavailable && st.liveValue !== null) {
      trustworthyObservations.push(
        `${meta.shortLabel}: ${st.liveValue.toFixed(meta.decimals)} ${meta.unit} (${st.freshness}, ${formatMissionTimeUtc(
          st.lastValidTimeIso
        )})`
      );
    } else {
      untrustworthyOrMissingObservations.push(
        `${meta.shortLabel}: ${st.freshnessLabel}`
      );
    }
  }
  input.envAssessment.unresolvedWarnings.forEach((w) =>
    untrustworthyOrMissingObservations.push(w)
  );

  const ev = input.activeEvent;
  const whatIsHappening = ev
    ? `${ev.title} — ${ev.summary} (State: ${ev.state.replace(/_/g, " ")})`
    : input.checkinEval.statusCode === "MISSED_OVERDUE"
    ? `${input.checkinEval.headline} — ${input.checkinEval.safetyNotice}`
    : input.envAssessment.overallLevel !== "NOMINAL"
    ? input.envAssessment.summaryHeadline
    : openHealthIncidents.length > 0
    ? `${openHealthIncidents.length} open health monitoring incident(s): ${openHealthIncidents[0].title}`
    : "No active emergency event. Sentinel monitoring telemetry, check-in cadence, and habitat parameters.";

  const threatTypeLabel = ev
    ? ev.threatClassification === "HEALTH_RELATED"
      ? "Health-Related Concern"
      : ev.threatClassification === "ENVIRONMENTAL"
      ? "Environmental / Habitat Hazard"
      : ev.threatClassification === "MISSED_CHECKIN_WELFARE"
      ? "Missed Check-In / Crew Welfare (Non-Diagnostic)"
      : "Multi-Factor (Health + Habitat)"
    : input.envAssessment.overallLevel !== "NOMINAL" && openHealthIncidents.length > 0
    ? "Multi-Factor (Health + Environmental)"
    : input.envAssessment.overallLevel !== "NOMINAL"
    ? "Environmental / Habitat Condition"
    : input.checkinEval.statusCode === "MISSED_OVERDUE"
    ? "Missed Check-In / Welfare Reminder"
    : openHealthIncidents.length > 0
    ? "Health-Related Telemetry Incident"
    : "Nominal Watch (No Active Threat)";

  const acknowledgementStatus = ev
    ? ev.primaryAckAtIso
      ? `Primary acknowledged by ${ev.primaryAckBy} at ${formatMissionTimeUtc(ev.primaryAckAtIso)}`
      : ev.backupAckAtIso
      ? `Backup acknowledged by ${ev.backupAckBy} at ${formatMissionTimeUtc(ev.backupAckAtIso)}`
      : ev.backupNotifiedAtIso
      ? `Escalated to backup responder (${ev.backupResponderName}) at ${formatMissionTimeUtc(
          ev.backupNotifiedAtIso
        )} — awaiting acknowledgement`
      : `Primary responder notified (${ev.primaryResponderName}) — awaiting acknowledgement (due ${formatMissionTimeUtc(
          ev.ackDeadlineIso
        )})`
    : "No active escalation waiting on acknowledgement.";

  const availableResources = input.resolvedEquipment.filter(
    (e) => e.availability === "AVAILABLE"
  );

  const unresolvedItems: string[] = [];
  if (ev && ev.state !== "RESOLVED_RETAINED") {
    if (!ev.primaryAckAtIso && !ev.backupAckAtIso) {
      unresolvedItems.push("Responder acknowledgement still pending.");
    }
    if (!ev.operatorActionNote) {
      unresolvedItems.push("No approved procedure response action recorded yet.");
    }
    if (!ev.followUpObservationNote) {
      unresolvedItems.push("Follow-up observation not yet logged (required before explicit closure).");
    }
  }
  if (input.checkinEval.statusCode === "MISSED_OVERDUE") {
    unresolvedItems.push("Scheduled crew check-in overdue past grace window.");
  }
  if (untrustworthyOrMissingObservations.length > 0) {
    unresolvedItems.push(
      `${untrustworthyOrMissingObservations.length} stale, unverified, or flagged observation/environment channel(s).`
    );
  }
  if (!input.earthWanConnected) {
    unresolvedItems.push("Earth communication link unavailable (onboard autonomy / local queue active).");
  }
  if (input.offlineQueueCount > 0) {
    unresolvedItems.push(`${input.offlineQueueCount} offline write(s) awaiting browser reconnection sync.`);
  }

  const earthCommsSummary = !input.browserOnline
    ? `Browser Offline — ${input.offlineQueueCount} item(s) saved locally in IndexedDB; simulated Earth link ${
        input.earthWanConnected ? "ON" : "OFF"
      }.`
    : input.earthWanConnected
    ? "Simulated Earth Deep-Space Link AVAILABLE (browser cloud sync active)."
    : "Simulated Earth Link UNAVAILABLE — operating autonomously; events retained locally in Firestore/IndexedDB.";

  return {
    whatIsHappening,
    threatTypeLabel,
    trustworthyObservations,
    untrustworthyOrMissingObservations,
    acknowledgementStatus,
    relevantResourcesCount: availableResources.length,
    unresolvedItems,
    earthCommsSummary,
  };
}

export function filterEmergencyResources(
  resources: ResolvedEquipmentItem[],
  searchQuery: string,
  categoryFilter: "ALL" | "ENVIRONMENTAL" | "RESPIRATORY_MEDICAL" | "FIRE_PRESSURE" | "DIAGNOSTIC" | "AVAILABLE_ONLY"
): ResolvedEquipmentItem[] {
  const q = searchQuery.trim().toLowerCase();
  return resources.filter((eq) => {
    if (categoryFilter === "AVAILABLE_ONLY") {
      if (eq.availability !== "AVAILABLE") return false;
    } else if (categoryFilter !== "ALL") {
      if (eq.emergencyCategory !== categoryFilter) return false;
    }
    if (!q) return true;
    const text = [
      eq.equipmentId,
      eq.name,
      eq.location,
      eq.notes,
      eq.maintenanceOrExpiryInfo || "",
      eq.availability,
      eq.effectiveStatus,
    ]
      .join(" ")
      .toLowerCase();
    return text.includes(q);
  });
}

export function serializeLifeSafetyEventToOpsRecord(
  event: LifeSafetyEvent,
  ownerId = ""
): OpsRecordDoc {
  // Keep top-level payload keys strictly <= 10 (firestore.rules enforces payload.keys().size() <= 30)
  return {
    ownerId,
    recordId: event.eventId.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 120),
    recordType: "CHECKLIST_LOG",
    crewId: event.activeCrewId.slice(0, 64),
    title: event.title.slice(0, 200),
    status: event.state.slice(0, 64),
    timestampIso: event.updatedAtIso.slice(0, 64),
    payload: {
      kind: "LIFE_SAFETY_EVENT",
      eventId: event.eventId,
      state: event.state,
      severity: event.severity,
      category: event.category,
      updatedAtIso: event.updatedAtIso,
      event: event as unknown as Record<string, unknown>,
    },
  };
}

export function serializeLifeSafetyConfigToOpsRecord(
  config: LifeSafetyConfig,
  crewId: string,
  ownerId = ""
): OpsRecordDoc {
  return {
    ownerId,
    recordId: "REC_LIFE_SAFETY_CONFIG",
    recordType: "CHECKLIST_LOG",
    crewId: crewId.slice(0, 64),
    title: "AEGIS Life-Safety Sentinel Schedule & Escalation Config",
    status: config.activeWelfareEventId ? "WELFARE_ACTIVE" : "ACTIVE",
    timestampIso: config.updatedAtIso.slice(0, 64),
    payload: {
      kind: "LIFE_SAFETY_CONFIG",
      config: config as unknown as Record<string, unknown>,
      updatedAtIso: config.updatedAtIso,
    },
  };
}

export function extractLifeSafetyEventsFromOpsRecords(
  opsRecords: OpsRecordDoc[]
): LifeSafetyEvent[] {
  const byId = new Map<string, LifeSafetyEvent>();
  for (const r of opsRecords) {
    if (
      r.recordType === "CHECKLIST_LOG" &&
      r.payload?.kind === "LIFE_SAFETY_EVENT" &&
      r.payload?.event &&
      typeof r.payload.event === "object"
    ) {
      const ev = r.payload.event as LifeSafetyEvent;
      if (ev.eventId) {
        const prev = byId.get(ev.eventId);
        if (!prev || Date.parse(ev.updatedAtIso) >= Date.parse(prev.updatedAtIso)) {
          byId.set(ev.eventId, ev);
        }
      }
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => Date.parse(b.updatedAtIso) - Date.parse(a.updatedAtIso)
  );
}

export function extractLifeSafetyConfigFromOpsRecords(
  opsRecords: OpsRecordDoc[]
): LifeSafetyConfig {
  const rec = opsRecords.find(
    (r) =>
      r.recordId === "REC_LIFE_SAFETY_CONFIG" &&
      r.payload?.kind === "LIFE_SAFETY_CONFIG" &&
      r.payload?.config &&
      typeof r.payload.config === "object"
  );
  if (!rec) return DEFAULT_LIFE_SAFETY_CONFIG;
  return {
    ...DEFAULT_LIFE_SAFETY_CONFIG,
    ...(rec.payload.config as Partial<LifeSafetyConfig>),
  };
}

export function exportLifeSafetyEventMarkdown(event: LifeSafetyEvent): string {
  return `# AEGIS LIFE-SAFETY SENTINEL — EVENT RECORD (${event.eventId})
> **Prototype Safety Notice:** Research decision-support log only. Not a clinical diagnosis, treatment order, or real spacecraft distress transmission.

- **Title:** ${event.title}
- **State:** ${event.state}
- **Severity:** ${event.severity} · **Threat Type:** ${event.threatClassification}
- **Subject Crew:** ${event.astronautName} (\`${event.astronautId}\` / \`${event.activeCrewId}\`)
- **Created (UTC):** ${formatMissionTimeUtc(event.createdAtIso, true)}
- **Updated (UTC):** ${formatMissionTimeUtc(event.updatedAtIso, true)}
- **Earth Comms at Trigger:** ${event.earthCommsAtTrigger} (Browser Online: ${event.browserOnlineAtTrigger ? "YES" : "NO"})

## Responders & Acknowledgements
- **Primary Responder:** ${event.primaryResponderName} (\`${event.primaryResponderCrewId}\`) · Notified: ${formatMissionTimeUtc(event.primaryNotifiedAtIso, true)} · Ack Deadline: ${formatMissionTimeUtc(event.ackDeadlineIso, true)}
- **Primary Acknowledgement:** ${event.primaryAckBy ? `${event.primaryAckBy} at ${formatMissionTimeUtc(event.primaryAckAtIso, true)}` : "Pending / Not acknowledged"}
- **Backup Responder:** ${event.backupResponderName} (\`${event.backupResponderCrewId}\`) · Escalated: ${event.backupNotifiedAtIso ? formatMissionTimeUtc(event.backupNotifiedAtIso, true) : "Not escalated"}
- **Backup Acknowledgement:** ${event.backupAckBy ? `${event.backupAckBy} at ${formatMissionTimeUtc(event.backupAckAtIso, true)}` : "None"}

## Observations & Environmental Context
- **Environmental Snapshot:** ${event.environmentalSnapshotSummary}
${
  event.contributingObservations.length > 0
    ? event.contributingObservations
        .map((o) => `- **${o.parameter}:** ${o.valueText} [${o.freshness} · ${o.sourceType}]`)
        .join("\n")
    : "- No valid live physiological telemetry attached."
}

## Data-Quality Warnings
${
  event.dataQualityWarnings.length > 0
    ? event.dataQualityWarnings.map((w) => `- ${w}`).join("\n")
    : "- None."
}

## Response, Follow-Up & Explicit Closure
- **Approved Procedure Ref:** ${event.authorizedProcedureRef || "None recorded"}
- **Operator Action:** ${event.operatorActionNote || "None recorded"}
- **Follow-Up Observations:** ${event.followUpObservationNote || "None recorded"}
- **Resolution:** ${event.resolvedBy ? `${event.resolutionNote} (Closed by ${event.resolvedBy} at ${formatMissionTimeUtc(event.resolvedAtIso, true)})` : "OPEN — awaiting explicit human closure"}

## Chronological Event Timeline
${event.timeline
  .map(
    (t) =>
      `- \`${formatMissionTimeUtc(t.timestampIso, true)}\` **[${t.eventType}]** (${t.actorName} · Earth: ${t.earthCommsStatus}): ${t.summary}`
  )
  .join("\n")}
`;
}
