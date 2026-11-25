import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  Clock,
  ExternalLink,
  FileCheck2,
  KeyRound,
  Play,
  RefreshCw,
  ShieldAlert,
  Square,
  TrendingDown,
  Volume2,
} from "lucide-react";
import {
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  AUTHORIZED_PROTOTYPE_PROCEDURES,
  ActorRole,
  BaselineProfile,
  EMERGENCY_CHECKLIST_STEPS,
  IncidentChecklistProgress,
  IncidentRecord,
  IncidentState,
  PARAMETER_METADATA,
  PROTOTYPE_DISCLAIMER,
  ParameterName,
  TelemetryHistoryResponse,
} from "../types/aegisContracts";
import { SyncStatusText } from "../components/StatusText";
import { SafeImage } from "../components/SafeImage";
import { DataSourceBadge, InformationBadge } from "../components/InformationBadge";
import { VISUAL_ASSETS } from "../assets/visualCatalog";
import { formatMissionTimeUtc } from "../utils/aegisPureEngine";

interface AlertsResponsePageProps {
  incidents: IncidentRecord[];
  baseline: BaselineProfile;
  histories: Partial<Record<ParameterName, TelemetryHistoryResponse>>;
  operatorRole: ActorRole;
  continuityActive?: boolean;
  cmoAvailable?: boolean;
  checklistProgressMap?: Record<string, IncidentChecklistProgress>;
  initialSelectedIncidentId?: string | null;
  onTransitionIncident: (
    incidentId: string,
    action: "review" | "acknowledge" | "record-response" | "evaluate-followup" | "close",
    payload?: {
      authorized_action?: string;
      procedure_reference?: string;
      closure_notes?: string;
      auth_pin?: string;
      includeSimulatedFollowup?: boolean;
    }
  ) => Promise<void>;
  onSaveChecklistLog: (incidentId: string, completedSteps: string[], elapsedSec: number) => Promise<void>;
  onSaveChecklistProgress?: (
    incidentId: string,
    completedSteps: string[],
    currentStepIndex: number,
    elapsedSec: number,
    totalSteps: number
  ) => Promise<void>;
  onOpenStorageSettings?: () => void;
  onOpenContinuity?: () => void;
  onBackHome: () => void;
  actionFeedback: { ok: boolean; message: string } | null;
  isBusy: boolean;
}

const WORKFLOW_STEPS: Array<{ state: IncidentState; label: string }> = [
  { state: "DETECTED", label: "1. Detected" },
  { state: "REVIEWED", label: "2. Reviewed" },
  { state: "ACKNOWLEDGED", label: "3. Approved" },
  { state: "RESPONSE_RECORDED", label: "4. Action Taken" },
  { state: "MONITORING", label: "5. Monitoring" },
  { state: "CLOSED_RETAINED", label: "6. Saved & Closed" },
];

export const AlertsResponsePage: React.FC<AlertsResponsePageProps> = ({
  incidents,
  baseline,
  histories,
  operatorRole,
  continuityActive = false,
  cmoAvailable = true,
  checklistProgressMap = {},
  initialSelectedIncidentId = null,
  onTransitionIncident,
  onSaveChecklistLog,
  onSaveChecklistProgress,
  onOpenStorageSettings,
  onOpenContinuity,
  onBackHome,
  actionFeedback,
  isBusy,
}) => {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(
    initialSelectedIncidentId || ""
  );
  const [selectedProcedure, setSelectedProcedure] = useState("PROC-ENV-CO2-01");
  const [customActionNotes, setCustomActionNotes] = useState(
    "Checked cabin CO2 scrubber bypass and placed crew member on seated rest monitoring."
  );
  const [closureNotes, setClosureNotes] = useState(
    "Readings moved back toward normal personal baseline; alert closed and saved."
  );
  const [cmoPin, setCmoPin] = useState("");
  const [includeSimulatedFollowup, setIncludeSimulatedFollowup] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [checklistSavedMsg, setChecklistSavedMsg] = useState<string | null>(null);
  const hydratedProgressKeyRef = useRef<string>("");
  const checklistSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (
      initialSelectedIncidentId &&
      incidents.some((i) => i.incident_id === initialSelectedIncidentId)
    ) {
      setSelectedIncidentId(initialSelectedIncidentId);
    }
  }, [initialSelectedIncidentId, incidents]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const playCautionTone = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // Ignore audio hardware restriction
    }
  };

  const incident =
    incidents.find((i) => i.incident_id === selectedIncidentId) ||
    incidents.find((i) => i.state !== "CLOSED_RETAINED") ||
    incidents[0];

  const activeIncidentId = incident?.incident_id || "";
  const persistedChecklistProgress = activeIncidentId
    ? checklistProgressMap[activeIncidentId]
    : undefined;

  useEffect(() => {
    if (!activeIncidentId) return;
    const hydrationKey = `${activeIncidentId}|${persistedChecklistProgress?.updatedAtIso || "none"}`;
    if (hydratedProgressKeyRef.current === hydrationKey) return;
    hydratedProgressKeyRef.current = hydrationKey;

    if (persistedChecklistProgress) {
      const nextChecked: Record<string, boolean> = {};
      for (const s of persistedChecklistProgress.completedSteps) {
        nextChecked[s] = true;
      }
      setCheckedSteps(nextChecked);
      setCurrentStepIndex(
        Math.max(
          0,
          Math.min(EMERGENCY_CHECKLIST_STEPS.length - 1, persistedChecklistProgress.currentStepIndex)
        )
      );
      setElapsedSec(persistedChecklistProgress.elapsedSec || 0);
    } else {
      setCheckedSteps({});
      setCurrentStepIndex(0);
      setElapsedSec(0);
    }
    setChecklistSavedMsg(null);
  }, [activeIncidentId, persistedChecklistProgress]);

  if (!incident) {
    return (
      <div className="space-y-6">
        <div className="glass-panel rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-full sm:w-44 aspect-[16/10] rounded-xl overflow-hidden border border-white/80 shadow-sm shrink-0">
            <SafeImage
              src={VISUAL_ASSETS.cardVitals}
              alt="Astronaut medical response station"
              caption="Crew Safety Gate"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={onBackHome}
              className="text-xs font-medium text-sky-800 hover:text-sky-950 inline-flex items-center gap-1.5 cursor-pointer mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home Dashboard</span>
            </button>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Alerts &amp; Response
            </h1>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-10 text-center space-y-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <h2 className="text-lg font-semibold text-slate-900">
            No Active Alerts — Telemetry Within Baseline
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            All evaluated health and cabin readings are currently inside the crew member&apos;s
            personal normal range. Switch to Scenario 2 or 3 on the Home Dashboard, or log an
            outside-range daily check-in, to inspect the 7-part evidence explanation and response
            workflow.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onBackHome}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Return to Home Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentIdx = WORKFLOW_STEPS.findIndex((s) => s.state === incident.state);
  const exp = incident.explanation;
  const ctxBlock = exp.context_block || {};
  const reasoningBlock = exp.reasoning_block || {};
  const dqBlock = exp.data_quality_block || {};
  const coTriggeredRules = Array.isArray(reasoningBlock.co_triggered_rules)
    ? (reasoningBlock.co_triggered_rules as string[])
    : [];

  const canReview = operatorRole !== "MISSION_OBSERVER";
  const canAuthorizeCmo = operatorRole === "CREW_MEDICAL_OFFICER";

  const stepReviewAllowed = canReview && incident.state === "DETECTED";
  const stepAckAllowed =
    canAuthorizeCmo && (incident.state === "DETECTED" || incident.state === "REVIEWED");
  const stepRecordAllowed =
    canAuthorizeCmo &&
    (incident.state === "ACKNOWLEDGED" ||
      incident.state === "RESPONSE_RECORDED" ||
      incident.state === "MONITORING");
  const stepEvaluateAllowed =
    canReview && (incident.state === "RESPONSE_RECORDED" || incident.state === "MONITORING");
  const stepCloseAllowed = canAuthorizeCmo && incident.state !== "CLOSED_RETAINED";

  const hrHistory = histories.heart_rate_bpm?.observations || [];
  const hrMetric = baseline.metrics.heart_rate_bpm;
  const beforeAfterData = hrHistory.map((o, idx) => ({
    step: `T+${idx * 5}m`,
    hr: o.value,
    phase:
      incident.action_recorded_at && o.timestamp > incident.action_recorded_at
        ? "After Action"
        : "Before Action",
  }));

  const contextItems: Array<{ label: string; value: string }> = [
    {
      label: "Cabin CO2",
      value:
        ctxBlock.cabin_co2_mmhg !== null && ctxBlock.cabin_co2_mmhg !== undefined
          ? `${Number(ctxBlock.cabin_co2_mmhg).toFixed(2)} mmHg`
          : "Not recorded",
    },
    {
      label: "Ambient Radiation",
      value:
        ctxBlock.radiation_msv_hr !== null && ctxBlock.radiation_msv_hr !== undefined
          ? `${Number(ctxBlock.radiation_msv_hr).toFixed(3)} mSv/hr`
          : "Not recorded",
    },
    {
      label: "3-Day Avg Sleep",
      value:
        ctxBlock.sleep_duration_3d_avg_hrs !== null &&
        ctxBlock.sleep_duration_3d_avg_hrs !== undefined
          ? `${Number(ctxBlock.sleep_duration_3d_avg_hrs).toFixed(1)} hrs`
          : "Not recorded",
    },
    {
      label: "Latest Fatigue Score",
      value:
        ctxBlock.fatigue_score_latest !== null && ctxBlock.fatigue_score_latest !== undefined
          ? `${Number(ctxBlock.fatigue_score_latest).toFixed(1)} / 10`
          : "Not recorded",
    },
  ];
  if (ctxBlock.visual_symptom_severity_latest !== undefined && ctxBlock.visual_symptom_severity_latest !== null) {
    contextItems.push({
      label: "Visual Symptoms",
      value: `${Number(ctxBlock.visual_symptom_severity_latest).toFixed(1)} / 10`,
    });
  }
  if (ctxBlock.intraocular_pressure_latest !== undefined && ctxBlock.intraocular_pressure_latest !== null) {
    contextItems.push({
      label: "Eye Pressure (IOP)",
      value: `${Number(ctxBlock.intraocular_pressure_latest).toFixed(1)} mmHg`,
    });
  }
  if (ctxBlock.hydration_3d_avg_ml !== undefined && ctxBlock.hydration_3d_avg_ml !== null) {
    contextItems.push({
      label: "3-Day Avg Hydration",
      value: `${Number(ctxBlock.hydration_3d_avg_ml).toFixed(0)} mL`,
    });
  }
  if (ctxBlock.caloric_intake_3d_avg_kcal !== undefined && ctxBlock.caloric_intake_3d_avg_kcal !== null) {
    contextItems.push({
      label: "3-Day Avg Calories",
      value: `${Number(ctxBlock.caloric_intake_3d_avg_kcal).toFixed(0)} kcal`,
    });
  }

  return (
    <div className="space-y-6">
      {/* Header + Multi-Incident Switcher + 6-Step Progress */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-full sm:w-44 aspect-[16/10] rounded-xl overflow-hidden border border-white/80 shadow-sm shrink-0">
              <SafeImage
                src={VISUAL_ASSETS.cardVitals}
                alt="Astronaut crew response workflow"
                caption="6-Step Protocol"
              />
            </div>
            <div>
              <button
                type="button"
                onClick={onBackHome}
                className="text-xs font-medium text-sky-800 hover:text-sky-950 inline-flex items-center gap-1.5 cursor-pointer mb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Home Dashboard</span>
              </button>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-medium text-slate-700">{incident.incident_id}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-700">{incident.rule_id}</span>
                <span aria-hidden="true">·</span>
                <span>Priority: {incident.severity.toLowerCase()}</span>
                <span aria-hidden="true">·</span>
                <span>Detected {formatMissionTimeUtc(incident.created_at)}</span>
                <span aria-hidden="true">·</span>
                <SyncStatusText status={incident.sync_status} />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{incident.title}</h1>
            </div>
          </div>
        </div>

        {incidents.length > 1 && (
          <div className="pt-3 border-t border-slate-200/70 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-slate-600">Select Incident ({incidents.length}):</span>
            {incidents.map((item) => {
              const selected = item.incident_id === incident.incident_id;
              return (
                <button
                  key={item.incident_id}
                  type="button"
                  onClick={() => setSelectedIncidentId(item.incident_id)}
                  className={`px-3 py-1.5 rounded-xl border font-medium cursor-pointer transition-colors ${
                    selected
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white/75 text-slate-700 border-slate-200 hover:bg-white"
                  }`}
                >
                  <span className="font-mono">{item.incident_id}</span>
                  <span className="mx-1.5 opacity-60">·</span>
                  <span>{item.severity}</span>
                  <span className="mx-1.5 opacity-60">·</span>
                  <span>{item.state.replace(/_/g, " ").toLowerCase()}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 6-step workflow progress */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-3 border-t border-slate-200/70">
          {WORKFLOW_STEPS.map((step, idx) => {
            const isCompleted = idx < currentIdx || incident.state === "CLOSED_RETAINED";
            const isCurrent = step.state === incident.state;
            return (
              <div
                key={step.state}
                className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-between ${
                  isCurrent
                    ? "bg-sky-50/90 border-sky-300 text-sky-900 font-semibold"
                    : isCompleted
                    ? "bg-emerald-50/90 border-emerald-200 text-emerald-800"
                    : "bg-white/60 border-slate-200/80 text-slate-500"
                }`}
              >
                <span className="truncate">{step.label}</span>
                {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Plain-English 7-Part Explanation */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Why This Alert Triggered (7-Part Evidence Summary)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Measured evidence, baseline variance, context, deterministic rule logic, quality
                validation, uncertainty bounds, and NASA/CSA literature separated cleanly.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {incident.threshold_authority}
            </span>
          </div>

          {/* 1. Evidence Readings */}
          <section className="space-y-2.5 pt-4 border-t border-slate-200/70">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">1. Measured Evidence</h3>
              <InformationBadge type="MEASURED" tone="light" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-1.5 pr-3 font-medium">Metric</th>
                    <th className="py-1.5 px-3 font-medium">Value</th>
                    <th className="py-1.5 px-3 font-medium">Source</th>
                    <th className="py-1.5 pl-3 font-medium">Recorded Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60">
                  {exp.evidence_block.map((obs) => (
                    <tr key={obs.observation_id} className="text-slate-700">
                      <td className="py-2 pr-3 font-medium">
                        {PARAMETER_METADATA[obs.parameter]?.label || obs.parameter}
                      </td>
                      <td className="py-2 px-3 font-mono font-semibold text-amber-700 tabular-nums">
                        {obs.value} {obs.unit}
                      </td>
                      <td className="py-2 px-3">
                        <DataSourceBadge
                          source={obs.source_type}
                          hmacVerified={obs.device_hmac_verified}
                          tone="light"
                        />
                      </td>
                      <td className="py-2 pl-3 font-mono text-slate-500 whitespace-nowrap">
                        {formatMissionTimeUtc(obs.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 2. Personal Baseline Comparison */}
          <section className="space-y-2 pt-4 border-t border-slate-200/70">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                2. Comparison to Personal 14-Day Normal Range
              </h3>
              <InformationBadge type="COMPUTED" tone="light" />
            </div>
            <div className="space-y-2">
              {Object.values(exp.comparison_block).map((comp) => (
                <div
                  key={comp.parameter}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs py-1"
                >
                  <div>
                    <span className="font-medium text-slate-900">
                      {PARAMETER_METADATA[comp.parameter]?.label || comp.parameter}:
                    </span>{" "}
                    <span className="font-mono text-slate-600">{comp.comparison_text}</span>
                    <span className="ml-2 font-mono text-[11px] text-slate-500">
                      (P05–P95: {comp.baseline_p05}–{comp.baseline_p95} {comp.unit}, z=
                      {comp.z_score >= 0 ? "+" : ""}
                      {comp.z_score}σ)
                    </span>
                  </div>
                  <span
                    className={`font-medium shrink-0 ${
                      comp.outside_p05_p95_band ? "text-amber-700" : "text-emerald-700"
                    }`}
                  >
                    {comp.outside_p05_p95_band ? "▲ Outside P05–P95" : "● Within range"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Context */}
          <section className="space-y-2.5 pt-4 border-t border-slate-200/70">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                3. Cabin Environment &amp; Crew Context
              </h3>
              <InformationBadge type="MEASURED" tone="light" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {contextItems.map((item) => (
                <div key={item.label} className="glass-subtle rounded-xl p-2.5">
                  <div className="text-[11px] text-slate-500">{item.label}</div>
                  <div className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {String(ctxBlock.operational_schedule_note || "")}
            </p>
          </section>

          {/* 4. Trigger Rule & Reasoning */}
          <section className="space-y-2 pt-4 border-t border-slate-200/70">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                4. Deterministic Rule &amp; Reasoning
              </h3>
              <InformationBadge type="COMPUTED" tone="light" />
            </div>
            <div className="text-xs font-mono text-slate-700 glass-subtle rounded-xl p-3 space-y-1.5">
              <div>
                <span className="font-semibold text-slate-900">{incident.rule_id}</span>
                {coTriggeredRules.length > 1 && (
                  <span className="ml-2 text-amber-800">
                    · Co-triggered: {coTriggeredRules.join(", ")}
                  </span>
                )}
              </div>
              <p className="leading-relaxed">{String(reasoningBlock.formula_evaluated || "")}</p>
            </div>
            <p className="text-[11px] text-amber-900 bg-amber-50/85 border border-amber-200/80 rounded-xl px-3 py-2">
              Prototype demonstration logic — not a validated clinical threshold or medical diagnosis.
            </p>
          </section>

          {/* 5. Data Quality Check */}
          <section className="space-y-2 pt-4 border-t border-slate-200/70">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                5. Stage 2 Telemetry Quality Gate
              </h3>
              <InformationBadge type="COMPUTED" tone="light" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="glass-subtle rounded-xl p-2.5">
                <div className="text-[11px] text-slate-500">Valid Used</div>
                <div className="font-mono font-bold text-emerald-700 tabular-nums">
                  {String(dqBlock.valid_evaluated_count ?? 0)}
                </div>
              </div>
              <div className="glass-subtle rounded-xl p-2.5">
                <div className="text-[11px] text-slate-500">Estimated</div>
                <div className="font-mono font-bold text-sky-800 tabular-nums">
                  {String(dqBlock.estimated_count ?? 0)}
                </div>
              </div>
              <div className="glass-subtle rounded-xl p-2.5">
                <div className="text-[11px] text-slate-500">Stale Flagged</div>
                <div className="font-mono font-bold text-amber-700 tabular-nums">
                  {String(dqBlock.stale_flagged_count ?? 0)}
                </div>
              </div>
              <div className="glass-subtle rounded-xl p-2.5">
                <div className="text-[11px] text-slate-500">Quarantined</div>
                <div className="font-mono font-bold text-rose-700 tabular-nums">
                  {String(dqBlock.impossible_quarantined_count ?? 0)}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600">{String(dqBlock.gate_summary || "")}</p>
          </section>

          {/* 6. Uncertainty & Limitations */}
          <section className="space-y-1.5 pt-4 border-t border-slate-200/70">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                6. Uncertainty &amp; Interpretation Boundaries
              </h3>
              <InformationBadge type="COMPUTED" tone="light" />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{exp.uncertainty_block}</p>
          </section>

          {/* 7. Plain-English Narrative & Linked NASA/CSA Literature */}
          <section className="space-y-3 pt-4 border-t border-slate-200/70">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                7. Plain-English Summary &amp; NASA/CSA Research References
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500">
                  {exp.ai_narrative_summary.mode}
                </span>
                <InformationBadge type="AI_ASSISTED" tone="light" />
              </div>
            </div>
            <div className="bg-sky-50/85 border border-sky-200/80 rounded-xl p-3.5 space-y-1.5">
              <p className="text-xs text-slate-800 leading-relaxed">{exp.ai_narrative_summary.text}</p>
              <p className="text-[11px] text-sky-900/80">
                {exp.ai_narrative_summary.disclaimer}
              </p>
            </div>
            <div className="space-y-2.5">
              {exp.references_block.map((ref) => (
                <div
                  key={ref.resource_id}
                  className="glass-subtle rounded-xl p-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900">{ref.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {ref.publisher} · Published {ref.publication_date}
                    </div>
                    <div className="text-[11px] text-slate-700">{ref.evidence_note}</div>
                  </div>
                  <a
                    href={ref.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-800 hover:text-sky-950 font-semibold inline-flex items-center gap-1 shrink-0"
                  >
                    <span>Read source</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right: Step-by-Step Response Controls + Before/After Chart */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-sky-700" />
                <span>Response &amp; Human Review</span>
              </h2>
              <span className="text-[11px] font-mono text-slate-600">
                Role: {operatorRole.replace(/_/g, " ")}
              </span>
            </div>

            {actionFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  actionFeedback.ok
                    ? "bg-emerald-50/90 border-emerald-200 text-emerald-900"
                    : "bg-rose-50/90 border-rose-200 text-rose-900"
                }`}
              >
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{actionFeedback.message}</span>
              </div>
            )}

            {operatorRole === "MISSION_OBSERVER" && (
              <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Observer role is read-only. Switch to Crew Member or Crew Medical Officer to
                  record reviews or responses.
                </span>
                {onOpenStorageSettings && (
                  <button
                    type="button"
                    onClick={onOpenStorageSettings}
                    className="font-semibold text-sky-800 hover:text-sky-950 underline cursor-pointer"
                  >
                    Manage Role →
                  </button>
                )}
              </div>
            )}

            {(!cmoAvailable || (continuityActive && operatorRole !== "CREW_MEDICAL_OFFICER")) && (
              <div className="bg-sky-50/90 border border-sky-200 rounded-xl p-3 text-xs text-sky-950 space-y-2">
                <div className="font-semibold">
                  Continuity Mode Active — CMO Authorization Gate Preserved
                </div>
                <p className="text-sky-900 leading-relaxed">
                  {!cmoAvailable
                    ? "Designated CMO is marked unavailable. "
                    : ""}
                  Non-CMO crew can confirm evidence review (Step 1), evaluate follow-up, and log
                  crew-permitted procedures, while CMO + PIN authorization steps (Steps 2, 3, and 4
                  closure) remain locked without impersonation.
                </p>
                {onOpenContinuity && (
                  <button
                    type="button"
                    onClick={onOpenContinuity}
                    className="font-semibold text-sky-800 hover:text-sky-950 underline cursor-pointer"
                  >
                    Open Continuity Mode Guided Procedures &amp; Earth Handoff →
                  </button>
                )}
              </div>
            )}

            {incident.state === "CLOSED_RETAINED" ? (
              <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 space-y-1.5">
                <div className="font-semibold">Alert Resolved &amp; Retained</div>
                <p>
                  This incident is closed and sealed in your tamper-evident SHA-256 audit log.
                  Switch scenarios on the Home Dashboard to inspect another operational state.
                </p>
                {incident.authorized_action && (
                  <p className="font-mono text-[11px] pt-1">
                    Action recorded: {incident.procedure_reference} — {incident.authorized_action}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* CMO PIN Gate */}
                <div className="glass-subtle rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="cmo-auth-pin"
                      className="font-medium text-slate-900 inline-flex items-center gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-sky-700" />
                      <span>CMO Authorization PIN (Prototype Gate)</span>
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">CMO Verification</span>
                  </div>
                  <input
                    id="cmo-auth-pin"
                    type="password"
                    value={cmoPin}
                    disabled={!canAuthorizeCmo || isBusy}
                    onChange={(e) => setCmoPin(e.target.value)}
                    placeholder="Enter CMO authorization PIN"
                    className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-2.5 py-1.5 font-mono text-slate-900 disabled:opacity-50"
                  />
                  <p className="text-[11px] text-slate-500">
                    Client workflow gate verifying Crew Medical Officer approval before recording
                    procedures or closing incidents.
                  </p>
                </div>

                {/* Step 1: Review */}
                <div className="space-y-2 pb-3 border-b border-slate-200/70">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">Step 1: Confirm Evidence Reviewed</span>
                    {currentIdx >= 1 && (
                      <span className="text-[11px] font-medium text-emerald-700">● Completed</span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={isBusy || !stepReviewAllowed}
                    onClick={() => onTransitionIncident(incident.incident_id, "review")}
                    className="w-full py-2 px-3 bg-white/80 hover:bg-white disabled:opacity-45 text-slate-900 border border-slate-200/80 font-medium rounded-xl transition-colors cursor-pointer"
                  >
                    Mark Evidence Reviewed
                  </button>
                </div>

                {/* Step 2: Approve */}
                <div className="space-y-2 pb-3 border-b border-slate-200/70">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">Step 2: Approve Alert Handling</span>
                    {currentIdx >= 2 && (
                      <span className="text-[11px] font-medium text-emerald-700">● Approved</span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={isBusy || !stepAckAllowed}
                    onClick={() =>
                      onTransitionIncident(incident.incident_id, "acknowledge", {
                        auth_pin: cmoPin,
                      })
                    }
                    className="w-full py-2 px-3 bg-white/80 hover:bg-white disabled:opacity-45 text-slate-900 border border-slate-200/80 font-medium rounded-xl transition-colors cursor-pointer"
                  >
                    Approve &amp; Acknowledge (CMO)
                  </button>
                </div>

                {/* Step 3: Record Response & Evaluate Follow-Up */}
                <div className="space-y-2.5 pb-3 border-b border-slate-200/70">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">
                      Step 3: Record Action &amp; Track Recovery
                    </span>
                    {currentIdx >= 3 && (
                      <span className="text-[11px] font-medium text-emerald-700">● Recorded</span>
                    )}
                  </div>
                  <select
                    aria-label="Select response procedure"
                    value={selectedProcedure}
                    disabled={!canAuthorizeCmo || isBusy}
                    onChange={(e) => {
                      setSelectedProcedure(e.target.value);
                      setCustomActionNotes(AUTHORIZED_PROTOTYPE_PROCEDURES[e.target.value] || "");
                    }}
                    className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-2.5 py-2 text-slate-900 disabled:opacity-50"
                  >
                    {Object.entries(AUTHORIZED_PROTOTYPE_PROCEDURES).map(([code, desc]) => (
                      <option key={code} value={code}>
                        {code} — {desc.slice(0, 52)}...
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Action description"
                    type="text"
                    value={customActionNotes}
                    disabled={!canAuthorizeCmo || isBusy}
                    onChange={(e) => setCustomActionNotes(e.target.value)}
                    className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-2.5 py-2 text-slate-900 disabled:opacity-50"
                  />

                  <label className="flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSimulatedFollowup}
                      disabled={!canAuthorizeCmo || isBusy}
                      onChange={(e) => setIncludeSimulatedFollowup(e.target.checked)}
                      className="mt-0.5 accent-sky-700"
                    />
                    <span>
                      Append simulated post-action recovery readings (optional demo showcase; leave
                      unchecked to evaluate only real post-action telemetry)
                    </span>
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={isBusy || !stepRecordAllowed}
                      onClick={() =>
                        onTransitionIncident(incident.incident_id, "record-response", {
                          procedure_reference: selectedProcedure,
                          authorized_action: customActionNotes,
                          auth_pin: cmoPin,
                          includeSimulatedFollowup,
                        })
                      }
                      className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      Record Authorized Response
                    </button>

                    {(incident.state === "RESPONSE_RECORDED" ||
                      incident.state === "MONITORING") && (
                      <button
                        type="button"
                        disabled={isBusy || !stepEvaluateAllowed}
                        onClick={() =>
                          onTransitionIncident(incident.incident_id, "evaluate-followup", {
                            includeSimulatedFollowup,
                          })
                        }
                        className="py-2.5 px-3 bg-sky-50 hover:bg-sky-100 disabled:opacity-45 text-sky-900 border border-sky-200 font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Evaluate Follow-Up</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Step 4: Close & Archive */}
                <div className="space-y-2">
                  <div className="font-medium text-slate-900">Step 4: Close &amp; Save Record</div>
                  <input
                    aria-label="Closure notes"
                    type="text"
                    value={closureNotes}
                    disabled={!canAuthorizeCmo || isBusy}
                    onChange={(e) => setClosureNotes(e.target.value)}
                    className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-2.5 py-2 text-slate-900 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={isBusy || !stepCloseAllowed}
                    onClick={() =>
                      onTransitionIncident(incident.incident_id, "close", {
                        closure_notes: closureNotes,
                        auth_pin: cmoPin,
                      })
                    }
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Close &amp; Retain Audit Record (CMO)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Step-by-Step Emergency Checklist + Elapsed Timer + Resumption */}
          <div ref={checklistSectionRef} className="glass-panel rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Interactive Procedure Checklist
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={playCautionTone}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>Test Caution Tone</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextRunning = !timerRunning;
                    setTimerRunning(nextRunning);
                    if (!nextRunning && onSaveChecklistProgress) {
                      const completed = EMERGENCY_CHECKLIST_STEPS.filter((s) => checkedSteps[s]);
                      void onSaveChecklistProgress(
                        incident.incident_id,
                        completed,
                        currentStepIndex,
                        elapsedSec,
                        EMERGENCY_CHECKLIST_STEPS.length
                      );
                    }
                  }}
                  className="px-2.5 py-1 bg-white/80 hover:bg-white text-slate-700 border border-slate-200 rounded-lg text-[11px] font-mono tabular-nums inline-flex items-center gap-1 cursor-pointer"
                >
                  <Clock className="w-3 h-3 text-sky-700" />
                  <span>
                    {Math.floor(elapsedSec / 60)}m {String(elapsedSec % 60).padStart(2, "0")}s ·{" "}
                    {timerRunning ? "Pause" : "Start Timer"}
                  </span>
                </button>
              </div>
            </div>

            {(() => {
              const doneCount = EMERGENCY_CHECKLIST_STEPS.filter((s) => checkedSteps[s]).length;
              const outstandingCount = EMERGENCY_CHECKLIST_STEPS.length - doneCount;
              if (doneCount === 0 && elapsedSec === 0) return null;
              return (
                <div className="rounded-xl border border-sky-200 bg-sky-50/85 px-3 py-2.5 text-[11px] text-sky-950 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold">
                      {outstandingCount === 0
                        ? "Checklist Complete"
                        : `In-Progress Task (${doneCount}/${EMERGENCY_CHECKLIST_STEPS.length} done · ${outstandingCount} outstanding)`}
                    </span>
                    <div className="font-mono text-sky-800 mt-0.5">
                      Current: Step {currentStepIndex + 1} · Last update:{" "}
                      {formatMissionTimeUtc(
                        persistedChecklistProgress?.updatedAtIso || incident.updated_at
                      )}
                    </div>
                  </div>
                  {outstandingCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setTimerRunning(true);
                        const firstTodoIdx = EMERGENCY_CHECKLIST_STEPS.findIndex(
                          (s) => !checkedSteps[s]
                        );
                        if (firstTodoIdx >= 0) setCurrentStepIndex(firstTodoIdx);
                      }}
                      className="px-2.5 py-1 bg-sky-700 hover:bg-sky-800 text-white rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <Play className="w-3 h-3" />
                      <span>Resume Step {currentStepIndex + 1}</span>
                    </button>
                  )}
                </div>
              );
            })()}

            <div className="space-y-1.5 text-xs">
              {EMERGENCY_CHECKLIST_STEPS.map((step, idx) => {
                const done = Boolean(checkedSteps[step]);
                const isCurrent = !done && idx === currentStepIndex;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => {
                      if (!timerRunning) setTimerRunning(true);
                      const nextMap = { ...checkedSteps, [step]: !checkedSteps[step] };
                      setCheckedSteps(nextMap);
                      const completed = EMERGENCY_CHECKLIST_STEPS.filter((s) => nextMap[s]);
                      const firstTodo = EMERGENCY_CHECKLIST_STEPS.findIndex((s) => !nextMap[s]);
                      const nextStepIdx = firstTodo >= 0 ? firstTodo : idx;
                      setCurrentStepIndex(nextStepIdx);
                      if (onSaveChecklistProgress) {
                        void onSaveChecklistProgress(
                          incident.incident_id,
                          completed,
                          nextStepIdx,
                          elapsedSec,
                          EMERGENCY_CHECKLIST_STEPS.length
                        );
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl border flex items-start justify-between gap-2 cursor-pointer transition-colors ${
                      done
                        ? "bg-emerald-50/90 border-emerald-200 text-emerald-900"
                        : isCurrent
                        ? "bg-sky-50/90 border-sky-300 text-slate-900 font-medium"
                        : "bg-white/75 border-slate-200/80 text-slate-700 hover:bg-white"
                    }`}
                  >
                    <span className="flex items-start gap-2">
                      {done ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <span>
                        <span className="font-mono text-[11px] text-slate-500 mr-1.5">
                          {idx + 1}.
                        </span>
                        {step}
                      </span>
                    </span>
                    {isCurrent && (
                      <span className="font-mono text-[10px] font-semibold text-sky-800 shrink-0 mt-0.5">
                        ACTIVE
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-500">
                {checklistSavedMsg ||
                  `${EMERGENCY_CHECKLIST_STEPS.filter((s) => checkedSteps[s]).length} of ${EMERGENCY_CHECKLIST_STEPS.length} completed · progress auto-saved`}
              </span>
              <button
                type="button"
                disabled={isBusy}
                onClick={async () => {
                  const completed = EMERGENCY_CHECKLIST_STEPS.filter((s) => checkedSteps[s]);
                  await onSaveChecklistLog(incident.incident_id, completed, elapsedSec);
                  if (onSaveChecklistProgress) {
                    await onSaveChecklistProgress(
                      incident.incident_id,
                      completed,
                      currentStepIndex,
                      elapsedSec,
                      EMERGENCY_CHECKLIST_STEPS.length
                    );
                  }
                  setChecklistSavedMsg("Checklist log saved to private cloud history.");
                }}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-xl cursor-pointer whitespace-nowrap"
              >
                Save Checklist Log
              </button>
            </div>
          </div>

          {/* Before / After Recovery Chart */}
          <div className="glass-panel rounded-2xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-emerald-600" />
                  <span>Before &amp; After Post-Action Trend</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Evaluates observed readings after {incident.action_recorded_at ? `${incident.action_recorded_at.slice(11, 16)} UTC` : "an action is recorded"}.
                </p>
              </div>
              {incident.post_action_direction && (
                <span
                  className={`text-xs font-mono font-semibold whitespace-nowrap ${
                    incident.post_action_direction === "IMPROVING"
                      ? "text-emerald-700"
                      : incident.post_action_direction === "WORSENING"
                      ? "text-rose-700"
                      : "text-amber-700"
                  }`}
                >
                  {incident.post_action_direction}
                </span>
              )}
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={beforeAfterData}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="step"
                    stroke="#64748b"
                    tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                    domain={[55, 115]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255,255,255,0.96)",
                      borderColor: "#cbd5e1",
                      borderRadius: "10px",
                      fontSize: "11px",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  />
                  <ReferenceArea
                    y1={hrMetric.p05}
                    y2={hrMetric.p95}
                    fill="#0ea5e9"
                    fillOpacity={0.14}
                  />
                  <ReferenceLine
                    y={hrMetric.mean}
                    stroke="#0284c7"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="hr"
                    name="Heart Rate (bpm)"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {Object.keys(incident.post_action_comparisons || {}).length > 0 ? (
              <div className="space-y-2.5 pt-2 border-t border-slate-200/70">
                {Object.values(incident.post_action_comparisons).map((trend) => {
                  const dirCls =
                    trend.direction === "IMPROVING"
                      ? "text-emerald-700"
                      : trend.direction === "WORSENING"
                      ? "text-rose-700"
                      : "text-amber-700";
                  const dirSym =
                    trend.direction === "IMPROVING"
                      ? "●"
                      : trend.direction === "WORSENING"
                      ? "✖"
                      : "▲";
                  return (
                    <div key={trend.parameter} className="text-xs space-y-1 py-1">
                      <div className="flex items-center justify-between font-medium">
                        <span className="text-slate-900">
                          {PARAMETER_METADATA[trend.parameter]?.label || trend.parameter}
                        </span>
                        <span className={`font-mono ${dirCls}`}>
                          {dirSym} {trend.direction}
                        </span>
                      </div>
                      <p className="text-slate-600">{trend.summary_text}</p>
                      <p className="text-[11px] text-slate-500 italic">
                        Reports observed post-action direction only; does not establish causation or
                        treatment effectiveness.
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Record an action in Step 3 above and log new observations (or check recovery in
                follow-up) to compare readings before and after intervention.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

