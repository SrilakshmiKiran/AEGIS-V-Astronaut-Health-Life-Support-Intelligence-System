import {
  ActorRole,
  ALL_18_PARAMETERS,
  AuditLogEntry,
  BaselineComparison,
  BaselineMetric,
  BaselineProfile,
  CORE_8_PARAMETERS,
  DeterministicFinding,
  FreshnessStatus,
  IncidentChecklistProgress,
  IncidentRecord,
  InterruptedTaskSummary,
  KnowledgeResource,
  PARAMETER_METADATA,
  ParameterName,
  ParameterTelemetryStatus,
  PostActionDirection,
  PostResponseTrend,
  PROTOTYPE_DISCLAIMER,
  RuleId,
  ShiftHandoverSummaryData,
  SUBJECTIVE_CHECKIN_LABELS,
  SubjectiveCheckinEntry,
  SubjectiveCheckinStatus,
  TelemetryObservation,
} from "../types/aegisContracts";
import {
  ContinuityPersistedState,
  CrewAvailabilityStatus,
  CrewCapabilityProfile,
  EarthHandoffPackageData,
  EquipmentOperationalStatus,
  GuidedProcedure,
  MissionSupportStatusSummary,
  OnboardMedicalEquipment,
  ResourceReadinessMatch,
} from "../types/continuityContracts";
import {
  CrewRosterMember,
  MISSION_ROUTINE_TASKS,
  OpsRecordDoc,
  OpsStateDoc,
  RoutineGamificationState,
} from "../types/opsContracts";

const K_SHA256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  view.setUint32(paddedLen - 8, hi, false);
  view.setUint32(paddedLen - 4, lo, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K_SHA256[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => v.toString(16).padStart(8, "0"))
    .join("");
}

export function computeAuditEntryHash(entry: Omit<AuditLogEntry, "entry_hash">): string {
  const canonical = JSON.stringify({
    log_id: entry.log_id,
    incident_id: entry.incident_id,
    timestamp: entry.timestamp,
    from_state: entry.from_state,
    to_state: entry.to_state,
    actor_id: entry.actor_id,
    actor_role: entry.actor_role,
    notes: entry.notes ?? "",
    prev_hash: entry.prev_hash,
  });
  return sha256Hex(canonical);
}

export function verifyAuditChain(entries: AuditLogEntry[]): {
  valid: boolean;
  brokenAtLogId?: string;
  checkedCount: number;
} {
  if (entries.length === 0) {
    return { valid: true, checkedCount: 0 };
  }
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (i > 0 && entry.prev_hash !== entries[i - 1].entry_hash) {
      return { valid: false, brokenAtLogId: entry.log_id, checkedCount: i + 1 };
    }
    const expected = computeAuditEntryHash({
      log_id: entry.log_id,
      incident_id: entry.incident_id,
      timestamp: entry.timestamp,
      from_state: entry.from_state,
      to_state: entry.to_state,
      actor_id: entry.actor_id,
      actor_role: entry.actor_role,
      notes: entry.notes,
      prev_hash: entry.prev_hash,
    });
    if (entry.entry_hash !== expected) {
      return { valid: false, brokenAtLogId: entry.log_id, checkedCount: i + 1 };
    }
  }
  return { valid: true, checkedCount: entries.length };
}

export function isObservationDegraded(o: TelemetryObservation): boolean {
  return (
    o.is_quarantined ||
    o.quality_status === "STALE" ||
    o.quality_status === "MISSING" ||
    o.quality_status === "IMPOSSIBLE" ||
    o.quality_status === "CORRUPTED" ||
    (o.source_type === "VERIFIED_DEVICE" && !o.device_hmac_verified) ||
    o.value == null ||
    Number.isNaN(o.value)
  );
}

export function compareToBaseline(
  observation: TelemetryObservation,
  profile: BaselineProfile
): BaselineComparison {
  const metric: BaselineMetric = profile.metrics[observation.parameter];
  const currentValue = observation.value ?? metric.mean;
  const stdFloor = Math.max(metric.std, 1e-3);
  const absoluteDelta = Number((currentValue - metric.mean).toFixed(4));
  const percentDelta = Number(
    (((currentValue - metric.mean) / Math.max(Math.abs(metric.mean), 1e-6)) * 100).toFixed(2)
  );
  const zScore = Number(((currentValue - metric.mean) / stdFloor).toFixed(2));
  const outsideBand = currentValue < metric.p05 || currentValue > metric.p95;

  const sign = absoluteDelta >= 0 ? "+" : "";
  const targetRef = observation.reference_target ?? metric.authorized_target;
  const targetStr =
    targetRef != null
      ? ` (Target: ${targetRef} ${metric.unit}, delta: ${(currentValue - targetRef >= 0 ? "+" : "") + (currentValue - targetRef).toFixed(1)} ${metric.unit})`
      : "";

  const comparisonText = `${sign}${absoluteDelta.toFixed(
    metric.unit === "mSv/hr" ? 3 : 1
  )} ${metric.unit} vs. ${metric.mean} ${metric.unit} baseline [p05–p95: ${metric.p05}–${metric.p95}] (z=${sign}${zScore}σ)${targetStr}`;

  return {
    parameter: observation.parameter,
    unit: metric.unit,
    baseline_window_label: profile.window_label,
    baseline_mean: metric.mean,
    baseline_std: metric.std,
    baseline_p05: metric.p05,
    baseline_p95: metric.p95,
    authorized_target: targetRef ?? null,
    current_value: currentValue,
    absolute_delta: absoluteDelta,
    percent_delta: percentDelta,
    z_score: zScore,
    outside_p05_p95_band: outsideBand,
    comparison_text: comparisonText,
    info_label: "COMPUTED",
  };
}

export function evaluatePostResponseTrend(
  preActionObservations: TelemetryObservation[],
  postActionObservations: TelemetryObservation[],
  parameter: ParameterName,
  profile: BaselineProfile
): PostResponseTrend {
  const metric = profile.metrics[parameter];
  const sortByTimeAsc = (list: TelemetryObservation[]) =>
    [...list].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

  const validPre = sortByTimeAsc(
    preActionObservations.filter(
      (o) =>
        o.parameter === parameter &&
        (o.quality_status === "VALID" || o.quality_status === "ESTIMATED") &&
        !o.is_quarantined &&
        !(o.source_type === "VERIFIED_DEVICE" && !o.device_hmac_verified) &&
        o.value != null &&
        !Number.isNaN(o.value)
    )
  );
  const validPost = sortByTimeAsc(
    postActionObservations.filter(
      (o) =>
        o.parameter === parameter &&
        (o.quality_status === "VALID" || o.quality_status === "ESTIMATED") &&
        !o.is_quarantined &&
        !(o.source_type === "VERIFIED_DEVICE" && !o.device_hmac_verified) &&
        o.value != null &&
        !Number.isNaN(o.value)
    )
  );

  const nonCausalDisclaimer =
    "Reports observed post-action direction only; does not claim causation or treatment efficacy.";

  if (validPre.length < 2 || validPost.length < 2) {
    return {
      parameter,
      unit: metric.unit,
      pre_action_mean: 0,
      post_action_mean: 0,
      post_action_latest: 0,
      absolute_change: 0,
      percent_change: 0,
      post_action_slope_per_min: 0,
      within_p05_p95_band: false,
      direction: "INSUFFICIENT_DATA",
      summary_text: "Insufficient valid post-action observations (< 2 pre/post readings) to compute directional trend.",
      non_causal_disclaimer: nonCausalDisclaimer,
      info_label: "COMPUTED",
    };
  }

  const preValues = validPre.map((o) => o.value as number);
  const postValues = validPost.map((o) => o.value as number);
  const preMean = Number(
    (preValues.reduce((a, b) => a + b, 0) / preValues.length).toFixed(2)
  );
  const postMean = Number(
    (postValues.reduce((a, b) => a + b, 0) / postValues.length).toFixed(2)
  );
  const postLatest = Number(postValues[postValues.length - 1].toFixed(2));
  const absoluteChange = Number((postLatest - preMean).toFixed(2));
  const percentChange = Number(
    (((postLatest - preMean) / Math.max(Math.abs(preMean), 1e-6)) * 100).toFixed(2)
  );

  const t0 = new Date(validPost[0].timestamp).getTime();
  const xs = validPost.map((o) => (new Date(o.timestamp).getTime() - t0) / 60000);
  const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - xMean) * (postValues[i] - postMean);
    den += (xs[i] - xMean) * (xs[i] - xMean);
  }
  const slopePerMin = den > 1e-6 ? Number((num / den).toFixed(4)) : 0;

  const withinBand = postLatest >= metric.p05 && postLatest <= metric.p95;
  const preDist = Math.abs(preMean - metric.mean);
  const postDist = Math.abs(postLatest - metric.mean);

  let direction: PostActionDirection = "STABLE";
  if (Math.abs(postDist - preDist) <= 0.25 * metric.std) {
    direction = "STABLE";
  } else if (postDist < preDist - 0.25 * metric.std) {
    direction = "IMPROVING";
  } else if (postDist > preDist + 0.25 * metric.std) {
    direction = "WORSENING";
  }

  let bandNote: string;
  if (withinBand) {
    bandNote = `within personal P05–P95 band [${metric.p05}–${metric.p95} ${metric.unit}]`;
  } else if (direction === "IMPROVING") {
    bandNote = `moved closer to personal baseline mean (${metric.mean} ${metric.unit}) though still outside P05–P95 [${metric.p05}–${metric.p95} ${metric.unit}]`;
  } else if (direction === "WORSENING") {
    bandNote = `moved further from personal baseline mean (${metric.mean} ${metric.unit}) outside P05–P95 [${metric.p05}–${metric.p95} ${metric.unit}]`;
  } else {
    bandNote = `remained near pre-action level outside P05–P95 [${metric.p05}–${metric.p95} ${metric.unit}]`;
  }

  const summaryText = `Pre-action mean ${preMean} ${metric.unit} → post-action latest ${postLatest} ${metric.unit} (${
    absoluteChange >= 0 ? "+" : ""
  }${absoluteChange} ${metric.unit}, ${direction}); ${bandNote}.`;

  return {
    parameter,
    unit: metric.unit,
    pre_action_mean: preMean,
    post_action_mean: postMean,
    post_action_latest: postLatest,
    absolute_change: absoluteChange,
    percent_change: percentChange,
    post_action_slope_per_min: slopePerMin,
    within_p05_p95_band: withinBand,
    direction,
    summary_text: summaryText,
    non_causal_disclaimer: nonCausalDisclaimer,
    info_label: "COMPUTED",
  };
}

export function deriveOverallPostActionDirection(
  trends: Record<string, PostResponseTrend | undefined>
): PostActionDirection {
  const validTrends = Object.values(trends).filter(
    (t): t is PostResponseTrend => Boolean(t && t.direction !== "INSUFFICIENT_DATA")
  );
  if (validTrends.length === 0) {
    return "INSUFFICIENT_DATA";
  }
  if (validTrends.some((t) => t.direction === "WORSENING")) {
    return "WORSENING";
  }
  if (validTrends.some((t) => t.direction === "IMPROVING")) {
    return "IMPROVING";
  }
  return "STABLE";
}

function computeLinearSlopePerMin(obsList: TelemetryObservation[]): number {
  if (obsList.length < 2) return 0;
  const sorted = [...obsList].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const t0 = new Date(sorted[0].timestamp).getTime();
  const xs = sorted.map((o) => (new Date(o.timestamp).getTime() - t0) / 60000);
  const ys = sorted.map((o) => o.value ?? 0);
  const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const yMean = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) * (xs[i] - xMean);
  }
  return den > 1e-6 ? num / den : 0;
}

export function evaluateTelemetryWindow(
  observations: TelemetryObservation[],
  profile: BaselineProfile
): DeterministicFinding[] {
  const findings: DeterministicFinding[] = [];

  const validObs = observations.filter(
    (o) =>
      !o.is_quarantined &&
      (o.quality_status === "VALID" || o.quality_status === "ESTIMATED") &&
      !(o.source_type === "VERIFIED_DEVICE" && !o.device_hmac_verified) &&
      o.value != null &&
      !Number.isNaN(o.value)
  );

  const degradedObs = observations
    .filter((o) => isObservationDegraded(o))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const byParam = (p: ParameterName) =>
    validObs
      .filter((o) => o.parameter === p)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const qualityFlagsSummary = {
    stale_count: observations.filter((o) => o.quality_status === "STALE").length,
    missing_count: observations.filter((o) => o.quality_status === "MISSING").length,
    impossible_count: observations.filter((o) => o.quality_status === "IMPOSSIBLE").length,
    corrupted_count: observations.filter(
      (o) =>
        o.quality_status === "CORRUPTED" ||
        (o.source_type === "VERIFIED_DEVICE" && !o.device_hmac_verified)
    ).length,
    quarantined_ids: degradedObs.map((o) => o.observation_id),
  };

  // Rule 1: RULE-CARDIO-TREND-01
  // >= 3 consecutive VALID heart_rate_bpm readings over >= 15 min exceed baseline_p95 AND min(mean + 3*std, 95.0) with positive linear slope.
  const hrObs = byParam("heart_rate_bpm");
  const hrMetric = profile.metrics.heart_rate_bpm;
  if (hrObs.length >= 3) {
    const threshold = Math.min(hrMetric.mean + 3 * hrMetric.std, 95.0);
    const trailingExceedRun: TelemetryObservation[] = [];
    for (let i = hrObs.length - 1; i >= 0; i--) {
      const val = hrObs[i].value ?? 0;
      if (val > hrMetric.p95 && val > threshold && hrObs[i].quality_status === "VALID") {
        trailingExceedRun.unshift(hrObs[i]);
      } else {
        break;
      }
    }

    if (trailingExceedRun.length >= 3) {
      const spanMin =
        (new Date(trailingExceedRun[trailingExceedRun.length - 1].timestamp).getTime() -
          new Date(trailingExceedRun[0].timestamp).getTime()) /
        60000;
      const slope = computeLinearSlopePerMin(trailingExceedRun);
      if (spanMin >= 15 && slope > 0) {
        const latestHr = trailingExceedRun[trailingExceedRun.length - 1];
        findings.push({
          rule_id: "RULE-CARDIO-TREND-01",
          rule_name: "Sustained Heart Rate Elevation Above Personal Baseline [Prototype Rule]",
          threshold_authority: "PROTOTYPE_DEMO_RULE_NOT_CLINICAL_STANDARD",
          prototype_disclaimer: PROTOTYPE_DISCLAIMER,
          severity: "MODERATE",
          triggered: true,
          time_window_start: trailingExceedRun[0].timestamp,
          time_window_end: latestHr.timestamp,
          contributing_observation_ids: trailingExceedRun.map((o) => o.observation_id),
          measured_summary: trailingExceedRun.map((o) => ({
            observation_id: o.observation_id,
            parameter: o.parameter,
            value: o.value,
            unit: o.unit,
            timestamp: o.timestamp,
            linear_slope_bpm_per_min: Number(slope.toFixed(3)),
          })),
          baseline_comparison: {
            heart_rate_bpm: compareToBaseline(latestHr, profile),
          } as Record<ParameterName, BaselineComparison>,
          data_quality_flags: qualityFlagsSummary,
          uncertainty_statement:
            "Optical/wearable heart rate trend alone cannot distinguish physical exertion, thermal load, or cardiovascular pathology without ECG and Flight Surgeon evaluation.",
          topic_tags: ["cardiovascular", "general_hazards"],
          info_label: "COMPUTED",
        });
      }
    }
  }

  // Rule 2: RULE-HYPOXIA-CO2-MULTI-02
  // VALID spo2_pct < 94.5% AND (respiration_rpm > 19.0 rpm OR cabin_co2_mmhg > 4.5 mmHg) within 30-min window.
  const spo2Obs = byParam("spo2_pct").filter((o) => o.quality_status === "VALID");
  const respObs = byParam("respiration_rpm").filter((o) => o.quality_status === "VALID");
  const co2Obs = byParam("cabin_co2_mmhg").filter((o) => o.quality_status === "VALID");
  const lowSpo2 = spo2Obs.filter((o) => (o.value ?? 100) < 94.5);

  const WINDOW_30_MIN_MS = 30 * 60000;
  for (let i = lowSpo2.length - 1; i >= 0; i--) {
    const targetSpo2 = lowSpo2[i];
    const tSpo2 = new Date(targetSpo2.timestamp).getTime();

    const windowResp = respObs.filter(
      (r) => Math.abs(new Date(r.timestamp).getTime() - tSpo2) <= WINDOW_30_MIN_MS
    );
    const windowCo2 = co2Obs.filter(
      (c) => Math.abs(new Date(c.timestamp).getTime() - tSpo2) <= WINDOW_30_MIN_MS
    );
    const highRespInWin = windowResp.filter((r) => (r.value ?? 0) > 19.0);
    const highCo2InWin = windowCo2.filter((c) => (c.value ?? 0) > 4.5);

    if (highRespInWin.length > 0 || highCo2InWin.length > 0) {
      const chosenResp =
        highRespInWin[highRespInWin.length - 1] || windowResp[windowResp.length - 1];
      const chosenCo2 =
        highCo2InWin[highCo2InWin.length - 1] || windowCo2[windowCo2.length - 1];
      const windowHr = hrObs.filter(
        (h) => Math.abs(new Date(h.timestamp).getTime() - tSpo2) <= WINDOW_30_MIN_MS
      );
      const chosenHr = windowHr[windowHr.length - 1];

      const contrib = [targetSpo2, chosenResp, chosenCo2, chosenHr]
        .filter((item): item is TelemetryObservation => Boolean(item))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const comparisons: Partial<Record<ParameterName, BaselineComparison>> = {
        spo2_pct: compareToBaseline(targetSpo2, profile),
      };
      if (chosenResp) comparisons.respiration_rpm = compareToBaseline(chosenResp, profile);
      if (chosenCo2) comparisons.cabin_co2_mmhg = compareToBaseline(chosenCo2, profile);
      if (chosenHr) comparisons.heart_rate_bpm = compareToBaseline(chosenHr, profile);

      findings.push({
        rule_id: "RULE-HYPOXIA-CO2-MULTI-02",
        rule_name: "Multi-Parameter Cardiorespiratory & Cabin CO2 Shift [Prototype Rule]",
        threshold_authority: "PROTOTYPE_DEMO_RULE_NOT_CLINICAL_STANDARD",
        prototype_disclaimer: PROTOTYPE_DISCLAIMER,
        severity: "HIGH",
        triggered: true,
        time_window_start: contrib[0].timestamp,
        time_window_end: contrib[contrib.length - 1].timestamp,
        contributing_observation_ids: contrib.map((o) => o.observation_id),
        measured_summary: contrib.map((o) => ({
          observation_id: o.observation_id,
          parameter: o.parameter,
          value: o.value,
          unit: o.unit,
          timestamp: o.timestamp,
        })),
        baseline_comparison: comparisons as Record<ParameterName, BaselineComparison>,
        data_quality_flags: qualityFlagsSummary,
        uncertainty_statement:
          "Pulse oximetry and ambient cabin CO2 sensors cannot establish arterial blood gas values or exclude localized air-pocket pooling without portable capnography and Flight Surgeon review.",
        topic_tags: ["cardiovascular", "environment", "general_hazards"],
        info_label: "COMPUTED",
      });
      break;
    }
  }

  // Rule 3: RULE-RAD-EXPOSURE-03
  const radObs = byParam("radiation_msv_hr").filter((o) => o.quality_status === "VALID");
  const highRad = radObs.filter((o) => (o.value ?? 0) > 0.1);
  if (highRad.length > 0) {
    const latestRad = highRad[highRad.length - 1];
    findings.push({
      rule_id: "RULE-RAD-EXPOSURE-03",
      rule_name: "Elevated Radiation Rate Context Alert [Prototype Rule]",
      threshold_authority: "PROTOTYPE_DEMO_RULE_NOT_CLINICAL_STANDARD",
      prototype_disclaimer: PROTOTYPE_DISCLAIMER,
      severity: "HIGH",
      triggered: true,
      time_window_start: latestRad.timestamp,
      time_window_end: latestRad.timestamp,
      contributing_observation_ids: [latestRad.observation_id],
      measured_summary: [
        {
          observation_id: latestRad.observation_id,
          parameter: latestRad.parameter,
          value: latestRad.value,
          unit: latestRad.unit,
          timestamp: latestRad.timestamp,
        },
      ],
      baseline_comparison: {
        radiation_msv_hr: compareToBaseline(latestRad, profile),
      } as Record<ParameterName, BaselineComparison>,
      data_quality_flags: qualityFlagsSummary,
      uncertainty_statement:
        "Area radiation rate monitoring does not compute organ-equivalent biological dose or predict deterministic tissue effects.",
      topic_tags: ["radiation", "environment", "dosimetry"],
      info_label: "COMPUTED",
    });
  }

  // Rule 4: RULE-DATA-QUALITY-04
  if (degradedObs.length >= 2) {
    findings.push({
      rule_id: "RULE-DATA-QUALITY-04",
      rule_name: "Degraded Telemetry Confidence / Stale, Missing, or Quarantined Feed [Prototype Rule]",
      threshold_authority: "PROTOTYPE_DEMO_RULE_NOT_CLINICAL_STANDARD",
      prototype_disclaimer: PROTOTYPE_DISCLAIMER,
      severity: "ADVISORY",
      triggered: true,
      time_window_start: degradedObs[0].timestamp,
      time_window_end: degradedObs[degradedObs.length - 1].timestamp,
      contributing_observation_ids: degradedObs.map((o) => o.observation_id),
      measured_summary: degradedObs.map((o) => ({
        observation_id: o.observation_id,
        parameter: o.parameter,
        value: o.value,
        unit: o.unit,
        quality_status: o.quality_status,
        is_quarantined: o.is_quarantined,
        timestamp: o.timestamp,
      })),
      baseline_comparison: {} as Record<ParameterName, BaselineComparison>,
      data_quality_flags: qualityFlagsSummary,
      uncertainty_statement:
        "Quarantined and stale readings are excluded from physiological baseline calculations until sensor contact and HMAC attestation are restored.",
      topic_tags: ["general_hazards", "research_context"],
      info_label: "COMPUTED",
    });
  }

  // Rule 5: RULE-ARCHER-SLEEP-FATIGUE-05
  const sleepObs = byParam("sleep_duration_hrs");
  const fatigueObs = byParam("fatigue_score");
  const exerciseObs = byParam("exercise_completion_pct");
  if (sleepObs.length >= 3 && fatigueObs.length >= 1 && exerciseObs.length >= 1) {
    const last3Sleep = sleepObs.slice(-3);
    const latestFatigue = fatigueObs[fatigueObs.length - 1];
    const latestExercise = exerciseObs[exerciseObs.length - 1];
    const sleepLow = last3Sleep.every(
      (o) => (o.value ?? 99) < profile.metrics.sleep_duration_hrs.p05
    );
    const sleepSpanHours =
      (new Date(last3Sleep[2].timestamp).getTime() -
        new Date(last3Sleep[0].timestamp).getTime()) /
      3600000;
    const fatigueHigh = (latestFatigue.value ?? 0) > profile.metrics.fatigue_score.p95;
    const exerciseLow =
      (latestExercise.value ?? 100) < profile.metrics.exercise_completion_pct.p05;

    if (sleepLow && sleepSpanHours >= 24 && fatigueHigh && exerciseLow) {
      const contrib = [...last3Sleep, latestFatigue, latestExercise].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      findings.push({
        rule_id: "RULE-ARCHER-SLEEP-FATIGUE-05",
        rule_name:
          "ARCheR Combined-Signal Sleep, Fatigue & Activity Deterioration Pattern [Prototype Rule]",
        threshold_authority: "PROTOTYPE_DEMO_RULE_NOT_CLINICAL_STANDARD",
        prototype_disclaimer: PROTOTYPE_DISCLAIMER,
        severity: "MODERATE",
        triggered: true,
        time_window_start: contrib[0].timestamp,
        time_window_end: contrib[contrib.length - 1].timestamp,
        contributing_observation_ids: contrib.map((o) => o.observation_id),
        measured_summary: [
          ...contrib.map((o) => ({
            observation_id: o.observation_id,
            parameter: o.parameter,
            value: o.value,
            unit: o.unit,
            timestamp: o.timestamp,
          })),
          {
            note: "Sleep duration has been below the astronaut's recent baseline across three consecutive daily check-ins, alongside elevated fatigue and reduced exercise completion. Review workload, sleep conditions, and recovery measures.",
          },
        ],
        baseline_comparison: {
          sleep_duration_hrs: compareToBaseline(last3Sleep[2], profile),
          fatigue_score: compareToBaseline(latestFatigue, profile),
          exercise_completion_pct: compareToBaseline(latestExercise, profile),
        } as Record<ParameterName, BaselineComparison>,
        data_quality_flags: qualityFlagsSummary,
        uncertainty_statement:
          "Self-reported fatigue and actigraphy sleep logs provide operational workload context only and do not diagnose neurobehavioral or circadian disorders.",
        topic_tags: ["sleep", "behavioural", "fatigue", "activity"],
        info_label: "COMPUTED",
      });
    }
  }

  // Rule 6: RULE-FLUID-EYE-SANS-06
  const visObs = byParam("visual_symptom_severity");
  const iopObs = byParam("intraocular_pressure_mmhg");
  if (visObs.length >= 2 && iopObs.length >= 1) {
    const last2Vis = visObs.slice(-2);
    const latestIop = iopObs[iopObs.length - 1];
    const visPositive = last2Vis.every((o) => (o.value ?? 0) > 0);
    const iopOutside =
      (latestIop.value ?? 14.5) > profile.metrics.intraocular_pressure_mmhg.p95 ||
      (latestIop.value ?? 14.5) < profile.metrics.intraocular_pressure_mmhg.p05;

    if (visPositive && iopOutside) {
      const contrib = [...last2Vis, latestIop].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      findings.push({
        rule_id: "RULE-FLUID-EYE-SANS-06",
        rule_name:
          "Fluid-Shift & Eye Health Persistent Symptom & Baseline Deviation Flag [Prototype Rule]",
        threshold_authority: "PROTOTYPE_DEMO_RULE_NOT_CLINICAL_STANDARD",
        prototype_disclaimer: PROTOTYPE_DISCLAIMER,
        severity: "MODERATE",
        triggered: true,
        time_window_start: contrib[0].timestamp,
        time_window_end: contrib[contrib.length - 1].timestamp,
        contributing_observation_ids: contrib.map((o) => o.observation_id),
        measured_summary: [
          ...contrib.map((o) => ({
            observation_id: o.observation_id,
            parameter: o.parameter,
            value: o.value,
            unit: o.unit,
            timestamp: o.timestamp,
          })),
          {
            note: "Visual symptoms have been reported on two consecutive check-ins and the latest recorded intraocular pressure differs from the astronaut's baseline. Review the trend and follow the mission medical protocol.",
          },
        ],
        baseline_comparison: {
          visual_symptom_severity: compareToBaseline(last2Vis[1], profile),
          intraocular_pressure_mmhg: compareToBaseline(latestIop, profile),
        } as Record<ParameterName, BaselineComparison>,
        data_quality_flags: qualityFlagsSummary,
        uncertainty_statement:
          "Does not infer intracranial pressure or diagnose an eye disorder from symptoms or tonometry alone.",
        topic_tags: ["vision", "fluid_shift", "countermeasures", "cardiovascular"],
        info_label: "COMPUTED",
      });
    }
  }

  // Rule 7: RULE-NUTRITION-HYDRATION-07
  const calObs = byParam("caloric_intake_kcal");
  const hydObs = byParam("hydration_ml");
  const appObs = byParam("appetite_score");
  if ((calObs.length >= 2 || hydObs.length >= 2) && appObs.length >= 1 && fatigueObs.length >= 1) {
    const last2Cal = calObs.slice(-2);
    const last2Hyd = hydObs.slice(-2);
    const latestApp = appObs[appObs.length - 1];
    const latestFat = fatigueObs[fatigueObs.length - 1];

    const calLow =
      last2Cal.length >= 2 &&
      last2Cal.every(
        (o) =>
          (o.value ?? 3000) < (o.reference_target ?? 2800) ||
          (o.value ?? 3000) < profile.metrics.caloric_intake_kcal.p05
      );
    const hydLow =
      last2Hyd.length >= 2 &&
      last2Hyd.every(
        (o) =>
          (o.value ?? 3000) < (o.reference_target ?? 2500) ||
          (o.value ?? 3000) < profile.metrics.hydration_ml.p05
      );

    if ((calLow || hydLow) && (latestApp.value ?? 10) < 6.0 && (latestFat.value ?? 0) > 4.0) {
      const contrib = [
        ...(calLow ? last2Cal : []),
        ...(hydLow ? last2Hyd : []),
        latestApp,
        latestFat,
      ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      findings.push({
        rule_id: "RULE-NUTRITION-HYDRATION-07",
        rule_name:
          "Low Energy/Hydration Intake, Reduced Appetite & Fatigue Pattern [Prototype Rule]",
        threshold_authority: "PROTOTYPE_DEMO_RULE_NOT_CLINICAL_STANDARD",
        prototype_disclaimer: PROTOTYPE_DISCLAIMER,
        severity: "ADVISORY",
        triggered: true,
        time_window_start: contrib[0].timestamp,
        time_window_end: contrib[contrib.length - 1].timestamp,
        contributing_observation_ids: contrib.map((o) => o.observation_id),
        measured_summary: [
          ...contrib.map((o) => ({
            observation_id: o.observation_id,
            parameter: o.parameter,
            value: o.value,
            unit: o.unit,
            timestamp: o.timestamp,
          })),
          {
            note: "Recorded energy or hydration intake remained below target across two logs alongside reduced appetite and elevated fatigue. Review the food plan and hydration record with the mission health team.",
          },
        ],
        baseline_comparison: {
          ...(last2Cal.length > 0
            ? { caloric_intake_kcal: compareToBaseline(last2Cal[last2Cal.length - 1], profile) }
            : {}),
          ...(last2Hyd.length > 0
            ? { hydration_ml: compareToBaseline(last2Hyd[last2Hyd.length - 1], profile) }
            : {}),
          appetite_score: compareToBaseline(latestApp, profile),
          fatigue_score: compareToBaseline(latestFat, profile),
        } as Record<ParameterName, BaselineComparison>,
        data_quality_flags: qualityFlagsSummary,
        uncertainty_statement:
          "Estimated meal logs from the spaceflight food catalogue track approximate energy and fluid intake only; they do not measure metabolic balance or electrolyte status.",
        topic_tags: ["nutrition", "hydration", "fatigue", "countermeasures"],
        info_label: "COMPUTED",
      });
    }
  }

  return findings;
}

export function retrieveRelevantResources(
  resources: KnowledgeResource[],
  topicTags?: string[],
  queryText?: string
): KnowledgeResource[] {
  return resources.filter((res) => {
    const matchesTag =
      !topicTags ||
      topicTags.length === 0 ||
      topicTags.some(
        (tag) =>
          res.topic_tags.includes(tag) ||
          (res.category && res.category.toLowerCase() === tag.toLowerCase())
      );

    const q = queryText?.trim().toLowerCase();
    const matchesQuery =
      !q ||
      res.title.toLowerCase().includes(q) ||
      res.summary.toLowerCase().includes(q) ||
      res.publisher.toLowerCase().includes(q) ||
      res.topic_tags.some((t) => t.toLowerCase().includes(q));

    return matchesTag && matchesQuery;
  });
}

export function validateRoleAndPin(
  role: ActorRole | null,
  pin: string,
  allowedRoles: ActorRole[],
  requirePin: boolean,
  expectedPin = "2026"
): { authorized: boolean; status: 200 | 401 | 403; message: string } {
  if (!role) {
    return {
      authorized: false,
      status: 401,
      message: "HTTP 401 Unauthorized: Missing X-AEGIS-Actor-Id or X-AEGIS-Actor-Role header.",
    };
  }
  if (requirePin && !pin.trim()) {
    return {
      authorized: false,
      status: 401,
      message: "HTTP 401 Unauthorized: Missing required X-AEGIS-Auth-Pin for clinical action.",
    };
  }
  if (!allowedRoles.includes(role)) {
    return {
      authorized: false,
      status: 403,
      message: `HTTP 403 Forbidden: Role '${role}' is not authorized for this action. Required: ${allowedRoles.join(", ")}.`,
    };
  }
  if (requirePin && pin.trim() !== expectedPin) {
    return {
      authorized: false,
      status: 403,
      message: "HTTP 403 Forbidden: Invalid CMO Authentication PIN (SHA-256 verification failed).",
    };
  }
  return {
    authorized: true,
    status: 200,
    message: "Authorized.",
  };
}

export function isProcedureAuthorized(
  procedure: GuidedProcedure,
  role: ActorRole,
  cmoAvailable: boolean
): { allowed: boolean; reason: string } {
  if (procedure.requiresCmo && !cmoAvailable) {
    return {
      allowed: false,
      reason:
        "Locked: Designated Crew Medical Officer (CMO) is currently UNAVAILABLE. Non-medical crew cannot impersonate the CMO or authorize controlled clinical steps.",
    };
  }
  if (procedure.requiresCmo && role !== "CREW_MEDICAL_OFFICER") {
    return {
      allowed: false,
      reason:
        "Locked: Requires CREW_MEDICAL_OFFICER role and CMO PIN (2026). Replacement crew must use crew-authorized Continuity procedures.",
    };
  }
  if (!procedure.allowedRoles.includes(role)) {
    return {
      allowed: false,
      reason: `Locked: Active operator role (${role.replace(
        /_/g,
        " "
      )}) is outside the permitted scope for ${procedure.procedureId}.`,
    };
  }
  return {
    allowed: true,
    reason: "Authorized for current operator role.",
  };
}

export function filterGuidedProcedures(
  procedures: GuidedProcedure[],
  query: string,
  filter: "ALL" | "AUTHORIZED_ONLY" | "CMO_RESTRICTED" | RuleId,
  role: ActorRole,
  cmoAvailable: boolean
): GuidedProcedure[] {
  const q = query.trim().toLowerCase();
  return procedures.filter((proc) => {
    if (filter === "AUTHORIZED_ONLY") {
      if (!isProcedureAuthorized(proc, role, cmoAvailable).allowed) return false;
    } else if (filter === "CMO_RESTRICTED") {
      if (!proc.requiresCmo) return false;
    } else if (filter !== "ALL") {
      if (!proc.relevantRuleIds.includes(filter)) return false;
    }

    if (!q) return true;
    const haystack = [
      proc.procedureId,
      proc.title,
      proc.operationalContext,
      proc.category,
      proc.requiredTraining,
      proc.source,
      ...proc.relevantRuleIds,
      ...proc.steps.map((s) => `${s.title} ${s.instruction} ${s.verificationCue}`),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function matchResourcesForIncident(
  incident: IncidentRecord | undefined,
  equipmentList: OnboardMedicalEquipment[],
  equipmentOverrides: Record<string, EquipmentOperationalStatus>,
  medRecords: OpsRecordDoc[],
  procedures: GuidedProcedure[]
): ResourceReadinessMatch {
  const incidentRuleId = incident?.rule_id ?? null;
  const relevantProcs = incidentRuleId
    ? procedures.filter((p) => p.relevantRuleIds.includes(incidentRuleId))
    : procedures;

  const requiredEqIds = new Set(relevantProcs.flatMap((p) => p.requiredEquipmentIds));
  const resolvedEquipment = equipmentList.map((eq) => ({
    ...eq,
    operationalStatus: equipmentOverrides[eq.equipmentId] ?? eq.operationalStatus,
  }));

  const matchedEquipment = incidentRuleId
    ? resolvedEquipment.filter(
        (eq) =>
          eq.relevantRuleIds.includes(incidentRuleId) ||
          requiredEqIds.has(eq.equipmentId) ||
          eq.operationalStatus === "UNAVAILABLE"
      )
    : resolvedEquipment;

  const availableEquipment = matchedEquipment.filter((eq) => eq.operationalStatus === "OPERATIONAL");
  const unavailableOrLimitedEquipment = matchedEquipment.filter(
    (eq) => eq.operationalStatus !== "OPERATIONAL"
  );

  const requiredConsumableIds = new Set(relevantProcs.flatMap((p) => p.requiredConsumableIds));
  const availableConsumables: ResourceReadinessMatch["availableConsumables"] = [];
  const missingOrDepletedConsumables: ResourceReadinessMatch["missingOrDepletedConsumables"] = [];

  for (const rec of medRecords) {
    const stockQty = Number(rec.payload.stockQty ?? 0);
    const expiresOn = String(rec.payload.expiresOn || "2027-12");
    const unit = String(rec.payload.unit || "units");
    const isLowOrExpiring = stockQty <= 15 || expiresOn <= "2026-12";
    const cmoControlled =
      rec.recordId.toUpperCase().includes("MODAFINIL") ||
      rec.title.toLowerCase().includes("modafinil") ||
      String(rec.payload.category || "") === "CONTROLLED_MED";

    if (stockQty <= 0) {
      missingOrDepletedConsumables.push({
        recordId: rec.recordId,
        name: rec.title,
        reason: "Depleted (0 remaining in Med Kit)",
      });
    } else {
      availableConsumables.push({
        recordId: rec.recordId,
        name: rec.title,
        stockQty,
        unit,
        expiresOn,
        isLowOrExpiring,
        cmoControlled,
      });
    }
  }

  for (const reqId of requiredConsumableIds) {
    const found = medRecords.some(
      (r) =>
        r.recordId === reqId ||
        r.recordId.toUpperCase().includes(reqId.replace("MED_", "")) ||
        r.title.toLowerCase().includes(reqId.replace("MED_", "").toLowerCase())
    );
    if (!found) {
      missingOrDepletedConsumables.push({
        recordId: reqId,
        name: reqId.replace("MED_", "").replace(/_/g, " "),
        reason: "Referenced in procedure checklist but not present in onboard Med Kit manifest",
      });
    }
  }

  const availableReferenceCount = resolvedEquipment.filter((e) => e.referenceAvailableOffline).length;

  return {
    incidentRuleId,
    availableEquipment,
    unavailableOrLimitedEquipment,
    availableConsumables,
    missingOrDepletedConsumables,
    availableReferenceCount,
    relevantProcedureIds: relevantProcs.map((p) => p.procedureId),
  };
}

export function evaluateMissionSupportStatus(input: {
  earthWanConnected: boolean;
  browserOnline: boolean;
  cmoAvailable: boolean;
  continuityActive: boolean;
  operatorRole: ActorRole;
  replacementOperatorName: string;
  crewRoster: CrewRosterMember[];
  crewCapabilities: Record<string, CrewCapabilityProfile>;
  crewAvailabilityOverrides: Record<string, CrewAvailabilityStatus>;
  equipmentList: OnboardMedicalEquipment[];
  equipmentOverrides: Record<string, EquipmentOperationalStatus>;
  procedures: GuidedProcedure[];
  offlineResourcesCount: number;
  medRecords: OpsRecordDoc[];
}): MissionSupportStatusSummary {
  const effectiveCrew = input.crewRoster.map((member) => {
    const cap = input.crewCapabilities[member.crewId];
    const availability =
      input.crewAvailabilityOverrides[member.crewId] ??
      (cap?.medicalTier === "CMO_QUALIFIED" && !input.cmoAvailable
        ? "UNAVAILABLE"
        : cap?.defaultAvailability ?? "AVAILABLE");
    return { member, cap, availability };
  });

  const availableCrew = effectiveCrew.filter((c) => c.availability === "AVAILABLE");
  const unavailableCrew = effectiveCrew.filter((c) => c.availability === "UNAVAILABLE");
  const availableTrainedResponders = availableCrew
    .filter((c) => c.cap && c.cap.medicalTier !== "NON_MEDICAL_SPECIALIST")
    .map((c) => `${c.member.name} (${c.cap?.medicalTier.replace(/_/g, " ")})`);

  const resolvedEquipment = input.equipmentList.map((eq) => ({
    ...eq,
    operationalStatus: input.equipmentOverrides[eq.equipmentId] ?? eq.operationalStatus,
  }));
  const operationalEquipment = resolvedEquipment.filter((e) => e.operationalStatus === "OPERATIONAL");
  const unavailableEquipment = resolvedEquipment.filter((e) => e.operationalStatus !== "OPERATIONAL");

  const accessibleProcedures = input.procedures.filter(
    (p) => isProcedureAuthorized(p, input.operatorRole, input.cmoAvailable).allowed
  );
  const lockedProcedures = input.procedures.filter(
    (p) => !isProcedureAuthorized(p, input.operatorRole, input.cmoAvailable).allowed
  );

  const availableItems: string[] = [
    `Local telemetry monitoring, validation gate, & baseline engine (${operationalEquipment.length} operational hardware items [Simulated])`,
    `Offline Space Health Reference Library (${input.offlineResourcesCount} curated NASA/CSA summaries) & ${accessibleProcedures.length} role-authorized prototype checklists`,
    `Med Kit live stock tracker (${input.medRecords.length} tracked consumables persisted in workspace)`,
    `Available non-CMO responders: ${availableCrew.map((c) => c.member.name).join(", ") || "None"}`,
  ];

  const unavailableOrMissingItems: string[] = [];
  if (!input.earthWanConnected) {
    unavailableOrMissingItems.push(
      "Earth Deep-Space WAN / Flight Surgeon live consultation link (queued locally as PENDING)"
    );
  }
  if (!input.browserOnline) {
    unavailableOrMissingItems.push("Browser network reachability (offline IndexedDB queue active)");
  }
  if (!input.cmoAvailable) {
    unavailableOrMissingItems.push(
      "Designated Crew Medical Officer (CMO) unavailable — CMO+PIN clinical actions and controlled medications remain locked"
    );
  }
  unavailableEquipment.forEach((eq) => {
    unavailableOrMissingItems.push(`${eq.name} [${eq.operationalStatus} — ${eq.location}]`);
  });

  const lowMedItems = input.medRecords.filter(
    (r) => Number(r.payload.stockQty ?? 0) <= 15 || String(r.payload.expiresOn || "") <= "2026-12"
  );
  if (lowMedItems.length > 0) {
    unavailableOrMissingItems.push(
      `Low-stock or near-expiry Med Kit supplies: ${lowMedItems.map((m) => m.title).join(", ")}`
    );
  }

  const uncertaintiesAndGaps: string[] = [
    "Wearable SpO2 and ambient CO2 cannot establish arterial blood gas values (Portable Capnography & Blood-Gas Analyzer is UNAVAILABLE).",
    "Prototype procedures and thresholds are simulated continuity guides — not validated clinical flight rules or autonomous medical treatment.",
    "Non-medical replacement operator permissions do not substitute for Flight Surgeon or CMO clinical assessment.",
  ];

  return {
    earthCommsStatus: input.earthWanConnected ? "AVAILABLE" : "UNAVAILABLE",
    cmoStatus: input.cmoAvailable ? "AVAILABLE" : "UNAVAILABLE",
    continuityModeActive: input.continuityActive,
    activeOperatorRole: input.operatorRole,
    replacementOperatorName: input.replacementOperatorName,
    availableCrewCount: availableCrew.length,
    unavailableCrewCount: unavailableCrew.length,
    availableTrainedResponders,
    operationalEquipmentCount: operationalEquipment.length,
    unavailableEquipmentCount: unavailableEquipment.length,
    offlineReferenceCount: input.offlineResourcesCount,
    accessibleProcedureCount: accessibleProcedures.length,
    lockedProcedureCount: lockedProcedures.length,
    availableItems,
    unavailableOrMissingItems,
    uncertaintiesAndGaps,
  };
}

export function buildEarthHandoffPackage(input: {
  incident: IncidentRecord | undefined;
  baseline: BaselineProfile;
  observations: TelemetryObservation[];
  opsState: OpsStateDoc;
  continuityState: ContinuityPersistedState;
  operatorRole: ActorRole;
  crewRoster: CrewRosterMember[];
  checklistLogs: OpsRecordDoc[];
  medRecords: OpsRecordDoc[];
  equipmentList: OnboardMedicalEquipment[];
  procedures: GuidedProcedure[];
  earthWanConnected: boolean;
  missionName: string;
  crewNotes?: string;
  unansweredQuestions?: string[];
}): EarthHandoffPackageData {
  const nowIso = new Date().toISOString();
  const packageId = `HANDOFF_${Date.now()}`;
  const inc = input.incident;
  const incidentId = inc?.incident_id || "INC-CONTINUITY-WATCH";
  const incidentTitle =
    inc?.title || "Earth-Independent Crew Continuity Observation Package";

  const replacementCrew =
    input.crewRoster.find((c) => c.crewId === input.continuityState.replacementOperatorCrewId) ||
    input.crewRoster[0];

  const incidentTimeline: EarthHandoffPackageData["incidentTimeline"] = inc
    ? (inc.replay_timeline || []).map((t) => ({
        timestamp: String(t.timestamp || nowIso),
        title: String(t.title || t.event_type || "Timeline event"),
        detail: String(t.detail || ""),
      }))
    : [
        {
          timestamp: nowIso,
          title: "Continuity Mode Snapshot",
          detail: "No open anomaly incident; compiled routine Earth handoff summary.",
        },
      ];

  const validRecent = input.observations
    .filter((o) => !o.is_quarantined && o.quality_status !== "STALE")
    .slice(-10);
  const recordedObservationsSummary: EarthHandoffPackageData["recordedObservationsSummary"] =
    validRecent.map((o) => ({
      parameter: o.parameter,
      label: o.parameter,
      value: `${o.value ?? "N/A"} ${o.unit}`,
      qualityStatus: o.quality_status,
      timestamp: o.timestamp,
    }));

  const degradedObs = input.observations.filter((o) => isObservationDegraded(o));
  const dataQualityWarnings: string[] = [];
  if (degradedObs.length > 0) {
    dataQualityWarnings.push(
      `${degradedObs.length} degraded/quarantined reading(s) excluded from baseline & rule math (${degradedObs
        .slice(0, 4)
        .map((d) => `${d.observation_id}: ${d.quality_status}`)
        .join("; ")}).`
    );
  }
  if (inc?.explanation?.data_quality_block?.gate_summary) {
    dataQualityWarnings.push(String(inc.explanation.data_quality_block.gate_summary));
  }
  if (dataQualityWarnings.length === 0) {
    dataQualityWarnings.push("All evaluated telemetry frames passed Stage 2 validation checks.");
  }

  const baselineComparisonsSummary = inc
    ? Object.values(inc.baseline_comparison || {}).map(
        (c) => `${c.parameter}: ${c.current_value} ${c.unit} (${c.comparison_text})`
      )
    : ["No active baseline excursion comparisons attached."];

  const deterministicFindingsSummary: string[] = inc
    ? [
        `Primary rule: ${inc.rule_id} (Severity: ${inc.severity}, State: ${inc.state})`,
        `Evaluated formula: ${String(
          inc.explanation?.reasoning_block?.formula_evaluated || inc.title
        )}`,
      ]
    : ["No active triggered anomaly finding in current telemetry window."];

  const crewRecordedActions: string[] = [];
  if (inc?.authorized_action) {
    crewRecordedActions.push(
      `Incident action (${inc.procedure_reference || "N/A"}): ${inc.authorized_action}`
    );
  }
  input.checklistLogs.slice(0, 6).forEach((log) => {
    crewRecordedActions.push(
      `[${log.timestampIso.slice(0, 16)}Z] ${log.title} (${log.status}) — ${String(
        log.payload.stepsJoined || log.payload.notes || "Logged by crew"
      )}`
    );
  });
  if (input.crewNotes?.trim()) {
    crewRecordedActions.push(`Operator handoff note: ${input.crewNotes.trim()}`);
  }
  if (crewRecordedActions.length === 0) {
    crewRecordedActions.push("No crew checklist actions recorded yet.");
  }

  const readiness = matchResourcesForIncident(
    inc,
    input.equipmentList,
    input.continuityState.equipmentStatusOverrides,
    input.medRecords,
    input.procedures
  );

  const availableResourcesSummary = [
    ...readiness.availableEquipment.map((e) => `${e.name} [${e.operationalStatus} · ${e.location}]`),
    ...readiness.availableConsumables
      .slice(0, 6)
      .map(
        (m) =>
          `${m.name}: ${m.stockQty} ${m.unit} (Exp ${m.expiresOn}${
            m.cmoControlled ? " · CMO-controlled" : ""
          })`
      ),
  ];

  const missingResourcesSummary = [
    ...readiness.unavailableOrLimitedEquipment.map(
      (e) => `${e.name} [${e.operationalStatus}]: ${e.notes}`
    ),
    ...readiness.missingOrDepletedConsumables.map((m) => `${m.name}: ${m.reason}`),
  ];

  const accessedIds = new Set([
    ...input.continuityState.accessedProcedureIds,
    ...Object.keys(input.continuityState.procedureStepsDone),
  ]);
  const proceduresAccessed = input.procedures
    .filter((p) => accessedIds.has(p.procedureId))
    .map((p) => ({
      procedureId: p.procedureId,
      title: p.title,
      version: p.version,
      completedSteps: (input.continuityState.procedureStepsDone[p.procedureId] || []).length,
      totalSteps: p.steps.length,
    }));

  const followUpObservations: string[] = [];
  if (inc && Object.values(inc.post_action_comparisons || {}).length > 0) {
    Object.values(inc.post_action_comparisons).forEach((t) => {
      followUpObservations.push(`${t.parameter}: ${t.summary_text}`);
    });
  } else {
    const latestCo2 = [...input.observations]
      .reverse()
      .find((o) => o.parameter === "cabin_co2_mmhg" && !o.is_quarantined && o.value !== null);
    followUpObservations.push(
      `Latest cabin context: CO2 ${latestCo2?.value ?? "N/A"} mmHg, ppO2 ${input.opsState.eclss.ppO2MmHg.toFixed(1)} mmHg, Scrubber ${input.opsState.eclss.scrubberBedPct}%, Cumulative radiation ${input.opsState.cumulativeRadiationMsv.toFixed(1)} mSv.`
    );
  }

  const unansweredQuestions =
    input.unansweredQuestions && input.unansweredQuestions.length > 0
      ? input.unansweredQuestions
      : [
          `1. With designated CMO (${input.continuityState.cmoAvailable ? "Available" : "UNAVAILABLE"}) and Earth comms offline at generation, please review crew-executed steps (${
            proceduresAccessed.map((p) => p.procedureId).join(", ") || "observation only"
          }) and advise next monitoring cadence.`,
          "2. Portable capnography / blood-gas analysis is unavailable onboard; confirm whether additional non-invasive oximetry or ocular ultrasound captures are required upon link recovery.",
          "3. Confirm duty/workload deferral criteria while CMO remains off clinical duty.",
        ];

  const uncertaintyStatements = [
    inc?.uncertainty_note ||
      "Wearable sensors and habitat telemetry do not replace Flight Surgeon evaluation or arterial blood gas testing.",
    PROTOTYPE_DISCLAIMER,
    "Earth-Independent Continuity Mode organizes crew observations and prototype checklists; it is not an autonomous medical officer or clinical decision authority.",
  ];

  const markdownDocument = `# AEGIS-V EARTH HANDOFF PACKAGE (${packageId})
> **PROTOTYPE DECISION-SUPPORT NOTICE:** ${PROTOTYPE_DISCLAIMER}
> **Continuity Mode Active:** \`${input.continuityState.continuityActive ? "YES" : "NO"}\` | **CMO Available:** \`${
    input.continuityState.cmoAvailable ? "AVAILABLE" : "UNAVAILABLE"
  }\` | **Earth Link at Generation:** \`${input.earthWanConnected ? "AVAILABLE" : "UNAVAILABLE"}\`

## 1. Astronaut & Handoff Operator
- **Subject Astronaut:** ${input.baseline.full_name} (\`${input.baseline.astronaut_id}\`)
- **Mission / Habitat:** ${input.missionName}
- **Prepared By:** ${replacementCrew?.name || "Crew Operator"} (\`${
    input.continuityState.replacementOperatorCrewId
  }\`) · Active Role: \`${input.operatorRole}\`
- **CMO Status Note:** ${input.continuityState.cmoStatusReason}
- **Generated At:** ${nowIso}

## 2. Incident Timeline (${incidentId})
${incidentTimeline.map((t) => `- \`${t.timestamp}\` — **${t.title}**: ${t.detail}`).join("\n")}

## 3. Recorded Observations & Data Quality Warnings
${recordedObservationsSummary
  .slice(0, 8)
  .map((o) => `- **${o.label}**: \`${o.value}\` [${o.qualityStatus}] (${o.timestamp})`)
  .join("\n")}
- **Quality Warnings:** ${dataQualityWarnings.join(" ")}

## 4. Personal Baseline Comparisons & Deterministic Findings
${baselineComparisonsSummary.map((b) => `- ${b}`).join("\n")}
${deterministicFindingsSummary.map((f) => `- ${f}`).join("\n")}

## 5. Crew-Recorded Actions & Procedures Accessed
${crewRecordedActions.map((a) => `- ${a}`).join("\n")}
${
  proceduresAccessed.length > 0
    ? proceduresAccessed
        .map(
          (p) =>
            `- Procedure \`${p.procedureId}\` (${p.version}): ${p.title} — ${p.completedSteps}/${p.totalSteps} steps completed`
        )
        .join("\n")
    : "- No guided procedure checklist accessed yet."
}

## 6. Available & Missing Medical Resources
- **Available:** ${availableResourcesSummary.slice(0, 6).join("; ") || "None listed"}
- **Missing / Limited:** ${missingResourcesSummary.join("; ") || "None"}

## 7. Follow-Up Observations & Unanswered Questions for Earth Flight Surgeon
${followUpObservations.map((f) => `- ${f}`).join("\n")}
${unansweredQuestions.map((q) => `- ${q}`).join("\n")}

## 8. Uncertainty & Scope Boundaries
${uncertaintyStatements.map((u) => `- ${u}`).join("\n")}
`.slice(0, 15500);

  return {
    packageId,
    generatedAtIso: nowIso,
    astronautId: input.baseline.astronaut_id,
    astronautName: input.baseline.full_name,
    missionName: input.missionName,
    continuityModeActive: input.continuityState.continuityActive,
    earthCommsAtGeneration: input.earthWanConnected ? "AVAILABLE" : "UNAVAILABLE",
    cmoAvailabilityAtGeneration: input.continuityState.cmoAvailable ? "AVAILABLE" : "UNAVAILABLE",
    preparedByCrewId: input.continuityState.replacementOperatorCrewId,
    preparedByRole: input.operatorRole,
    incidentId,
    incidentTitle,
    incidentTimeline,
    recordedObservationsSummary,
    dataQualityWarnings,
    baselineComparisonsSummary,
    deterministicFindingsSummary,
    crewRecordedActions,
    availableResourcesSummary,
    missingResourcesSummary,
    proceduresAccessed,
    followUpObservations,
    unansweredQuestions,
    uncertaintyStatements,
    markdownDocument,
  };
}

// ─── Human-Centered Telemetry Freshness, Self-Report RBAC, Resumption & Handover ───

export function formatMissionTimeUtc(
  iso?: string | null,
  includeSeconds = false
): string {
  if (!iso || typeof iso !== "string") return "Not recorded";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "Not recorded";
  const d = new Date(ms);
  const isoStr = d.toISOString();
  return includeSeconds
    ? `${isoStr.slice(0, 10)} ${isoStr.slice(11, 19)} UTC`
    : `${isoStr.slice(0, 10)} ${isoStr.slice(11, 16)} UTC`;
}

export function canSubmitSubjectiveCheckin(role: ActorRole): boolean {
  return role === "CREW_MEDICAL_OFFICER" || role === "CREW_MEMBER";
}

export function canViewPrivateCrewNotes(role: ActorRole): boolean {
  return role === "CREW_MEDICAL_OFFICER" || role === "CREW_MEMBER";
}

export function canConfirmEquipmentInventory(role: ActorRole): boolean {
  return role === "CREW_MEDICAL_OFFICER" || role === "CREW_MEMBER";
}

export function resolveStreamReferenceTimestamp(
  observations: TelemetryObservation[]
): string {
  let maxMs = -Infinity;
  for (const obs of observations) {
    if (!isObservationDegraded(obs)) {
      const ms = Date.parse(obs.timestamp);
      if (Number.isFinite(ms) && ms > maxMs) {
        maxMs = ms;
      }
    }
  }
  if (Number.isFinite(maxMs)) {
    return new Date(maxMs).toISOString();
  }
  for (const obs of observations) {
    const ms = Date.parse(obs.timestamp);
    if (Number.isFinite(ms) && ms > maxMs) {
      maxMs = ms;
    }
  }
  return Number.isFinite(maxMs) ? new Date(maxMs).toISOString() : new Date().toISOString();
}

export function evaluateParameterTelemetryStatus(
  observations: TelemetryObservation[],
  parameter: ParameterName,
  baseline: BaselineProfile,
  referenceNowIso?: string
): ParameterTelemetryStatus {
  const meta = PARAMETER_METADATA[parameter];
  const unit = baseline.metrics[parameter]?.unit || meta.unit;
  const decimals = meta.decimals;

  const allForParam = observations
    .filter((o) => o.parameter === parameter)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const validForParam = allForParam.filter((o) => !isObservationDegraded(o));
  const latestRaw = allForParam[allForParam.length - 1] ?? null;
  const lastValid = validForParam[validForParam.length - 1] ?? null;
  const prevValid = validForParam.length >= 2 ? validForParam[validForParam.length - 2] : null;

  const lastObservationTimeIso = latestRaw?.timestamp ?? null;
  const lastValidTimeIso = lastValid?.timestamp ?? null;

  const refIso = referenceNowIso || resolveStreamReferenceTimestamp(observations);
  const refMs = Date.parse(refIso);
  const lastValidMs = lastValid ? Date.parse(lastValid.timestamp) : NaN;
  const latestRawMs = latestRaw ? Date.parse(latestRaw.timestamp) : NaN;

  const isDailyHrp = !CORE_8_PARAMETERS.includes(parameter);
  const freshThresholdMin = isDailyHrp ? 26 * 60 : 15;
  const agingThresholdMin = isDailyHrp ? 48 * 60 : 60;

  let ageMinutes: number | null = null;
  if (Number.isFinite(refMs) && Number.isFinite(lastValidMs)) {
    ageMinutes = Math.max(0, Math.round((refMs - lastValidMs) / 60000));
  } else if (Number.isFinite(refMs) && Number.isFinite(latestRawMs)) {
    ageMinutes = Math.max(0, Math.round((refMs - latestRawMs) / 60000));
  }

  let freshness: FreshnessStatus = "CURRENT";
  let freshnessLabel = "Current";

  if (!latestRaw) {
    freshness = "UNAVAILABLE";
    freshnessLabel = "Unavailable (no observations)";
  } else if (!lastValid) {
    freshness = latestRaw.quality_status === "STALE" ? "STALE" : "UNAVAILABLE";
    freshnessLabel =
      latestRaw.quality_status === "STALE"
        ? "Stale (no valid baseline packet)"
        : `Unavailable (latest rejected: ${latestRaw.quality_status})`;
  } else {
    const newerPacketFailed =
      Number.isFinite(latestRawMs) &&
      Number.isFinite(lastValidMs) &&
      latestRawMs > lastValidMs &&
      isObservationDegraded(latestRaw);

    if (newerPacketFailed) {
      freshness = "STALE";
      freshnessLabel = `Latest rejected (${latestRaw.quality_status}) — showing last-known-good time`;
    } else if (ageMinutes !== null && ageMinutes > agingThresholdMin) {
      freshness = "STALE";
      freshnessLabel = `Stale (${ageMinutes >= 120 ? `${Math.round(ageMinutes / 60)}h` : `${ageMinutes}m`} old)`;
    } else if (ageMinutes !== null && ageMinutes > freshThresholdMin) {
      freshness = "AGING";
      freshnessLabel = `Aging (${ageMinutes}m since valid obs)`;
    } else {
      freshness = "CURRENT";
      freshnessLabel = "Current";
    }
  }

  const isStaleOrUnavailable = freshness === "STALE" || freshness === "UNAVAILABLE";
  const lastValidValue =
    lastValid && lastValid.value !== null && !Number.isNaN(lastValid.value)
      ? lastValid.value
      : null;
  const liveValue = isStaleOrUnavailable ? null : lastValidValue;

  let deltaSincePrevValid: number | null = null;
  let deltaSummary = "Unavailable";
  let dataSufficiencyNote: string | null = null;

  if (lastValidValue !== null && prevValid && prevValid.value !== null && !Number.isNaN(prevValid.value)) {
    const rawDelta = lastValidValue - prevValid.value;
    deltaSincePrevValid = Number(rawDelta.toFixed(decimals));
    const sign = deltaSincePrevValid > 0 ? "+" : "";
    deltaSummary = `${sign}${deltaSincePrevValid.toFixed(decimals)} ${unit} vs prev valid (${formatMissionTimeUtc(prevValid.timestamp)})`;
  } else if (lastValidValue !== null) {
    deltaSummary = "Insufficient history (<2 valid samples)";
    dataSufficiencyNote =
      "Insufficient history: only 1 valid observation recorded (need >= 2 to compute change).";
  } else {
    deltaSummary = "Insufficient data (no valid readings)";
    dataSufficiencyNote =
      "Insufficient data: no valid observation recorded for this parameter.";
  }

  return {
    parameter,
    unit,
    liveValue,
    lastValidValue,
    latestRawObservation: latestRaw,
    lastValidObservation: lastValid,
    previousValidObservation: prevValid,
    lastObservationTimeIso,
    lastValidTimeIso,
    freshness,
    freshnessLabel,
    ageMinutes,
    isStaleOrUnavailable,
    deltaSincePrevValid,
    deltaSummary,
    dataSufficiencyNote,
  };
}

export function extractSubjectiveCheckinHistory(
  opsRecords: OpsRecordDoc[],
  viewerRole: ActorRole
): SubjectiveCheckinEntry[] {
  const canSeeNote = canViewPrivateCrewNotes(viewerRole);
  return opsRecords
    .filter(
      (r) =>
        r.recordType === "BIO_EXTENDED" &&
        r.payload?.kind === "SUBJECTIVE_CHECKIN"
    )
    .sort((a, b) => Date.parse(b.timestampIso) - Date.parse(a.timestampIso))
    .map((r) => {
      const code = (r.payload.statusCode as SubjectiveCheckinStatus) || "FEEL_NORMAL";
      const label =
        typeof r.payload.statusLabel === "string" && r.payload.statusLabel
          ? r.payload.statusLabel
          : SUBJECTIVE_CHECKIN_LABELS[code] || "Self-report logged";
      const rawNote = typeof r.payload.note === "string" ? r.payload.note.trim() : "";
      const hasNote = rawNote.length > 0;
      const submittedByRole =
        (r.payload.submittedByRole as ActorRole) || "CREW_MEMBER";
      return {
        recordId: r.recordId,
        crewId: r.crewId,
        statusCode: code,
        statusLabel: label,
        note: hasNote
          ? canSeeNote
            ? rawNote
            : "[Private crew health note restricted to Crew Member / CMO roles]"
          : null,
        noteRedacted: hasNote && !canSeeNote,
        submittedAtIso: r.timestampIso,
        submittedByRole,
        sourceLabel: "CREW_SUBJECTIVE_SELF_REPORT",
      };
    });
}

export function extractLatestSubjectiveCheckin(
  opsRecords: OpsRecordDoc[],
  viewerRole: ActorRole
): SubjectiveCheckinEntry | null {
  return extractSubjectiveCheckinHistory(opsRecords, viewerRole)[0] ?? null;
}

export function extractIncidentChecklistProgressMap(
  opsRecords: OpsRecordDoc[],
  defaultTotalSteps: number
): Record<string, IncidentChecklistProgress> {
  const map: Record<string, IncidentChecklistProgress> = {};
  const progressRecords = opsRecords
    .filter(
      (r) =>
        r.recordType === "CHECKLIST_LOG" &&
        r.payload?.kind === "INCIDENT_CHECKLIST_PROGRESS" &&
        typeof r.payload?.incidentId === "string"
    )
    .sort((a, b) => Date.parse(a.timestampIso) - Date.parse(b.timestampIso));

  for (const r of progressRecords) {
    const incidentId = String(r.payload.incidentId);
    const completedSteps = Array.isArray(r.payload.completedSteps)
      ? r.payload.completedSteps.map(String)
      : String(r.payload.stepsJoined || "")
          .split(" | ")
          .map((s) => s.trim())
          .filter(Boolean);
    const updatedAtIso =
      typeof r.payload.updatedAtIso === "string" && r.payload.updatedAtIso
        ? r.payload.updatedAtIso
        : r.timestampIso;
    const prev = map[incidentId];
    if (!prev || Date.parse(updatedAtIso) >= Date.parse(prev.updatedAtIso)) {
      map[incidentId] = {
        incidentId,
        completedSteps,
        currentStepIndex: Math.max(0, Number(r.payload.currentStepIndex || 0)),
        elapsedSec: Math.max(0, Number(r.payload.elapsedSec || 0)),
        totalSteps: Math.max(1, Number(r.payload.totalSteps || defaultTotalSteps)),
        updatedAtIso,
      };
    }
  }
  return map;
}

export function extractInterruptedTasks(input: {
  incidents: IncidentRecord[];
  opsRecords: OpsRecordDoc[];
  continuityState: ContinuityPersistedState;
  emergencyChecklistSteps: string[];
  procedures: GuidedProcedure[];
}): InterruptedTaskSummary[] {
  const tasks: InterruptedTaskSummary[] = [];

  const incProgressMap = extractIncidentChecklistProgressMap(
    input.opsRecords,
    input.emergencyChecklistSteps.length
  );

  for (const inc of input.incidents) {
    if (inc.state === "CLOSED_RETAINED") continue;
    const progress = incProgressMap[inc.incident_id];
    if (!progress) continue;
    const completedSet = new Set(progress.completedSteps);
    const completedLabels = input.emergencyChecklistSteps.filter((s) => completedSet.has(s));
    const outstandingLabels = input.emergencyChecklistSteps.filter((s) => !completedSet.has(s));
    const hasPartialWork =
      (completedLabels.length > 0 && outstandingLabels.length > 0) ||
      (progress.elapsedSec > 0 && outstandingLabels.length > 0);
    if (!hasPartialWork) continue;

    const firstOutstandingIdx = input.emergencyChecklistSteps.findIndex((s) => !completedSet.has(s));
    const safeIdx =
      progress.currentStepIndex >= 0 &&
      progress.currentStepIndex < input.emergencyChecklistSteps.length
        ? progress.currentStepIndex
        : Math.max(0, firstOutstandingIdx);

    tasks.push({
      kind: "INCIDENT_CHECKLIST",
      taskId: `INC_CHK_${inc.incident_id}`,
      incidentId: inc.incident_id,
      title: `Incident Checklist: ${inc.title}`,
      completedStepsCount: completedLabels.length,
      totalSteps: input.emergencyChecklistSteps.length,
      currentStepNumber: safeIdx + 1,
      outstandingStepsCount: outstandingLabels.length,
      completedStepLabels: completedLabels,
      outstandingStepLabels: outstandingLabels,
      lastUpdatedIso: progress.updatedAtIso,
      targetPage: "alerts-response",
    });
  }

  for (const proc of input.procedures) {
    const doneNums = input.continuityState.procedureStepsDone[proc.procedureId] || [];
    const total = proc.steps.length;
    const doneSet = new Set(doneNums);
    const completedLabels = proc.steps
      .filter((st) => doneSet.has(st.stepNumber))
      .map((st) => `Step ${st.stepNumber}: ${st.title}`);
    const outstandingLabels = proc.steps
      .filter((st) => !doneSet.has(st.stepNumber))
      .map((st) => `Step ${st.stepNumber}: ${st.title}`);

    const savedStepIdx = input.continuityState.procedureCurrentStep?.[proc.procedureId];
    const isStartedInProgress =
      (completedLabels.length > 0 && outstandingLabels.length > 0) ||
      (savedStepIdx !== undefined && savedStepIdx > 0 && outstandingLabels.length > 0);

    if (!isStartedInProgress) continue;

    const firstOutstandingIdx = proc.steps.findIndex((st) => !doneSet.has(st.stepNumber));
    const stepIdx =
      savedStepIdx !== undefined && savedStepIdx >= 0 && savedStepIdx < total
        ? savedStepIdx
        : Math.max(0, firstOutstandingIdx);

    tasks.push({
      kind: "GUIDED_PROCEDURE",
      taskId: proc.procedureId,
      title: `${proc.procedureId}: ${proc.title}`,
      completedStepsCount: completedLabels.length,
      totalSteps: total,
      currentStepNumber: stepIdx + 1,
      outstandingStepsCount: outstandingLabels.length,
      completedStepLabels: completedLabels,
      outstandingStepLabels: outstandingLabels,
      lastUpdatedIso: input.continuityState.updatedAtIso,
      targetPage: "continuity",
    });
  }

  return tasks.sort((a, b) => Date.parse(b.lastUpdatedIso) - Date.parse(a.lastUpdatedIso));
}

export interface ResolvedEquipmentItem extends OnboardMedicalEquipment {
  effectiveStatus: EquipmentOperationalStatus;
  availability: "AVAILABLE" | "LIMITED" | "MISSING";
  lastConfirmedAtIso: string | null;
  confirmedBy: string;
  isSimulatedConfirmation: boolean;
}

export function resolveEquipmentInventory(
  equipmentList: OnboardMedicalEquipment[],
  continuityState: ContinuityPersistedState
): ResolvedEquipmentItem[] {
  return equipmentList.map((eq) => {
    const effectiveStatus =
      continuityState.equipmentStatusOverrides[eq.equipmentId] ?? eq.operationalStatus;
    const availability: "AVAILABLE" | "LIMITED" | "MISSING" =
      effectiveStatus === "OPERATIONAL"
        ? "AVAILABLE"
        : effectiveStatus === "LIMITED"
        ? "LIMITED"
        : "MISSING";
    const userConf = continuityState.equipmentConfirmations?.[eq.equipmentId];
    return {
      ...eq,
      effectiveStatus,
      availability,
      lastConfirmedAtIso: userConf?.confirmedAtIso ?? eq.defaultLastConfirmedIso,
      confirmedBy: userConf?.confirmedBy ?? (eq.defaultLastConfirmedIso ? "Simulated Demo Baseline" : "Unconfirmed"),
      isSimulatedConfirmation: !userConf,
    };
  });
}

export function buildShiftHandoverSummary(input: {
  baseline: BaselineProfile;
  observations: TelemetryObservation[];
  statusByParameter: Record<ParameterName, ParameterTelemetryStatus>;
  baselineComparisons: Record<ParameterName, BaselineComparison>;
  incidents: IncidentRecord[];
  opsRecords: OpsRecordDoc[];
  opsState: OpsStateDoc;
  routineState: RoutineGamificationState;
  continuityState: ContinuityPersistedState;
  equipmentList: OnboardMedicalEquipment[];
  procedures: GuidedProcedure[];
  emergencyChecklistSteps: string[];
  viewerRole: ActorRole;
  quarantinedRecent: TelemetryObservation[];
}): ShiftHandoverSummaryData {
  const openIncidents = input.incidents.filter((i) => i.state !== "CLOSED_RETAINED");
  const latestSubjective = extractLatestSubjectiveCheckin(input.opsRecords, input.viewerRole);
  const interruptedTasks = extractInterruptedTasks({
    incidents: input.incidents,
    opsRecords: input.opsRecords,
    continuityState: input.continuityState,
    emergencyChecklistSteps: input.emergencyChecklistSteps,
    procedures: input.procedures,
  });

  const staleOrUnavailParams = ALL_18_PARAMETERS.filter((p) => {
    const st = input.statusByParameter[p];
    return !st || st.isStaleOrUnavailable;
  });

  const outsideParams = ALL_18_PARAMETERS.filter((p) => {
    const st = input.statusByParameter[p];
    const comp = input.baselineComparisons[p];
    return Boolean(st && !st.isStaleOrUnavailable && comp?.outside_p05_p95_band);
  });

  let astronautStatusHeadline = "Verified Nominal";
  let astronautStatusDetail = `All ${ALL_18_PARAMETERS.length} channels valid within personal P05-P95 band.`;
  if (openIncidents.length > 0) {
    astronautStatusHeadline = `Attention Required (${openIncidents.length} Open Incident${openIncidents.length > 1 ? "s" : ""})`;
    astronautStatusDetail = `${openIncidents[0].title} (${openIncidents[0].state.replace(/_/g, " ").toLowerCase()})`;
  } else if (staleOrUnavailParams.length > 0 || input.quarantinedRecent.length > 0) {
    astronautStatusHeadline = `Degraded / Incomplete Telemetry (${staleOrUnavailParams.length} stale or unavailable)`;
    astronautStatusDetail = "Stale, missing, or quarantined sensor data detected; verify affected channels.";
  } else if (outsideParams.length > 0) {
    astronautStatusHeadline = `Baseline Watch (${outsideParams.length} Outside P05-P95)`;
    astronautStatusDetail = `Elevated deviation in ${outsideParams.slice(0, 3).map((p) => PARAMETER_METADATA[p].shortLabel).join(", ")}.`;
  }

  // Recent significant changes from previous valid observations
  const priorityOrder: ParameterName[] = [
    "heart_rate_bpm",
    "spo2_pct",
    "cabin_co2_mmhg",
    "respiration_rpm",
    "systolic_bp_mmhg",
    "skin_temp_c",
    "sleep_duration_hrs",
    "fatigue_score",
    "hydration_ml",
  ];
  const recentSignificantChanges: ShiftHandoverSummaryData["recentSignificantChanges"] = [];
  for (const param of priorityOrder) {
    const st = input.statusByParameter[param];
    const comp = input.baselineComparisons[param];
    if (!st) continue;
    const meta = PARAMETER_METADATA[param];
    const hasSignificantDelta =
      st.deltaSincePrevValid !== null && Math.abs(st.deltaSincePrevValid) > 0;
    if (hasSignificantDelta || comp?.outside_p05_p95_band || st.isStaleOrUnavailable) {
      const valText =
        st.liveValue !== null
          ? `${st.liveValue.toFixed(meta.decimals)} ${meta.unit}`
          : st.lastValidValue !== null
          ? `Last valid: ${st.lastValidValue.toFixed(meta.decimals)} ${meta.unit} [${st.freshness}]`
          : "Unavailable";
      recentSignificantChanges.push({
        parameter: param,
        label: meta.label,
        latestValueText: valText,
        deltaText: st.deltaSummary,
        outsideBaseline: Boolean(comp?.outside_p05_p95_band),
        freshness: st.freshness,
      });
    }
    if (recentSignificantChanges.length >= 4) break;
  }

  // Actions already recorded
  const actionsRecorded: ShiftHandoverSummaryData["actionsRecorded"] = [];
  for (const inc of input.incidents) {
    if (inc.authorized_action) {
      actionsRecorded.push({
        timestampIso: inc.action_recorded_at || inc.updated_at,
        label: `${inc.incident_id} · ${inc.procedure_reference || "Response"}`,
        detail: inc.authorized_action,
      });
    }
  }
  const savedLogs = input.opsRecords
    .filter(
      (r) =>
        (r.recordType === "CHECKLIST_LOG" &&
          r.recordId !== "REC_CONTINUITY_STATE" &&
          r.payload?.kind !== "INCIDENT_CHECKLIST_PROGRESS") ||
        (r.recordType === "MED_LOG" && Number(r.payload?.dosesLoggedToday || 0) > 0)
    )
    .sort((a, b) => Date.parse(b.timestampIso) - Date.parse(a.timestampIso));

  for (const r of savedLogs.slice(0, 4)) {
    actionsRecorded.push({
      timestampIso: typeof r.payload?.lastTakenIso === "string" ? r.payload.lastTakenIso : r.timestampIso,
      label: r.title,
      detail:
        r.recordType === "MED_LOG"
          ? `${r.payload.dosesLoggedToday} dose(s) logged today`
          : `${r.status.replace(/_/g, " ")}`,
    });
  }
  actionsRecorded.sort((a, b) => Date.parse(b.timestampIso) - Date.parse(a.timestampIso));

  const routineRemainingTitles = MISSION_ROUTINE_TASKS.filter(
    (t) => !input.routineState.completedTaskIds.includes(t.taskId)
  ).map((t) => `${t.windowLabel} — ${t.title}`);

  const unresolvedDataQualityIssues: string[] = [];
  if (input.quarantinedRecent.length > 0) {
    const sample = input.quarantinedRecent
      .slice(0, 3)
      .map((q) => `${PARAMETER_METADATA[q.parameter]?.shortLabel || q.parameter} (${q.quality_status})`)
      .join(", ");
    unresolvedDataQualityIssues.push(
      `${input.quarantinedRecent.length} quarantined/flagged reading(s): ${sample}`
    );
  }
  if (staleOrUnavailParams.length > 0) {
    unresolvedDataQualityIssues.push(
      `${staleOrUnavailParams.length} parameter(s) currently STALE or UNAVAILABLE (not displayed as live).`
    );
  }

  const informationGaps: string[] = [];
  const insufficientParams = ALL_18_PARAMETERS.filter(
    (p) => input.statusByParameter[p]?.dataSufficiencyNote
  );
  if (insufficientParams.length > 0) {
    informationGaps.push(
      `${insufficientParams.length} parameter(s) lack >=2 valid observations for change calculation.`
    );
  }
  const resolvedEq = resolveEquipmentInventory(input.equipmentList, input.continuityState);
  resolvedEq
    .filter((e) => e.effectiveStatus !== "OPERATIONAL")
    .forEach((e) => {
      informationGaps.push(`${e.name} is ${e.effectiveStatus} (${e.location}).`);
    });
  if (!input.continuityState.cmoAvailable) {
    informationGaps.push("Designated CMO unavailable; CMO-restricted reviews await CMO/Ground confirmation.");
  }

  const timestamps: number[] = [];
  for (const obs of input.observations) {
    const t = Date.parse(obs.timestamp);
    if (Number.isFinite(t)) timestamps.push(t);
  }
  for (const inc of input.incidents) {
    const t = Date.parse(inc.updated_at);
    if (Number.isFinite(t)) timestamps.push(t);
  }
  for (const rec of input.opsRecords) {
    const t = Date.parse(rec.timestampIso);
    if (Number.isFinite(t)) timestamps.push(t);
  }
  const contT = Date.parse(input.continuityState.updatedAtIso);
  if (Number.isFinite(contT)) timestamps.push(contT);
  const lastUpdateIso =
    timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;

  return {
    astronautStatusHeadline,
    astronautStatusDetail,
    latestSubjectiveCheckin: latestSubjective,
    activeIncidents: openIncidents.map((i) => ({
      incidentId: i.incident_id,
      title: i.title,
      severity: i.severity,
      state: i.state,
      updatedAtIso: i.updated_at,
    })),
    recentSignificantChanges,
    actionsRecorded: actionsRecorded.slice(0, 5),
    outstandingTasks: interruptedTasks,
    routineRemainingTitles,
    unresolvedDataQualityIssues,
    informationGaps,
    lastUpdateIso,
  };
}


