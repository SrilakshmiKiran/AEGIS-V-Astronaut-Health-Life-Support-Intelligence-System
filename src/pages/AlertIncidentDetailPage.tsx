import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  ShieldAlert,
  TrendingDown,
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
  BaselineProfile,
  IncidentRecord,
  IncidentState,
  ParameterName,
  PROTOTYPE_DISCLAIMER,
  TelemetryHistoryResponse,
} from "../types/aegisContracts";
import {
  DataSourceBadge,
  InformationBadge,
  QualityBadge,
  SyncBadge,
} from "../components/InformationBadge";

interface AlertIncidentDetailPageProps {
  incidents: IncidentRecord[];
  baseline: BaselineProfile;
  histories: Partial<Record<ParameterName, TelemetryHistoryResponse>>;
  onTransitionIncident: (
    incidentId: string,
    action: "review" | "acknowledge" | "record-response" | "evaluate-followup" | "close",
    payload?: {
      authorized_action?: string;
      procedure_reference?: string;
      closure_notes?: string;
    }
  ) => Promise<void>;
  actionFeedback: { ok: boolean; status: number; message: string } | null;
}

const WORKFLOW_STATES: IncidentState[] = [
  "DETECTED",
  "REVIEWED",
  "ACKNOWLEDGED",
  "RESPONSE_RECORDED",
  "MONITORING",
  "CLOSED_RETAINED",
];

export const AlertIncidentDetailPage: React.FC<AlertIncidentDetailPageProps> = ({
  incidents,
  baseline,
  histories,
  onTransitionIncident,
  actionFeedback,
}) => {
  const [selectedProcedure, setSelectedProcedure] = useState<string>("PROC-ENV-CO2-01");
  const [customActionNotes, setCustomActionNotes] = useState<string>(
    "Executed cabin CO2 scrubber bypass check and placed crew member on seated rest monitoring"
  );
  const [closureNotes, setClosureNotes] = useState<string>(
    "Post-action recovery trend verified; incident closed and retained in onboard SQLite archive."
  );

  const incident = incidents[0];

  if (!incident) {
    return (
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-8 text-center space-y-3">
        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
        <h2 className="text-base font-semibold text-white">
          Zero Active Alerts or Incidents (Nominal State)
        </h2>
        <p className="text-xs text-slate-400 max-w-xl mx-auto">
          All 18 physiological and habitat parameters are within Cdr. Elena Vance&apos;s personal
          14-day baseline P05–P95 reference band. Use the 6-Scene Demo Simulator Bar below to
          activate Scene 2 (Gradual Anomaly) or Scene 3 (Explain) to inspect a full incident
          workflow.
        </p>
      </div>
    );
  }

  const currentIdx = WORKFLOW_STATES.indexOf(incident.state);
  const exp = incident.explanation;

  // Build Before/After chart series for Heart Rate and SpO2
  const hrHistory = histories.heart_rate_bpm?.observations || [];
  const hrMetric = baseline.metrics.heart_rate_bpm;
  const beforeAfterChartData = hrHistory.map((o, idx) => ({
    step: `T+${idx * 5}m`,
    phase: o.context_metadata?.phase === "POST_RESPONSE_FOLLOWUP" ? "After Response" : "Before Response",
    hr: o.value,
    p05: hrMetric.p05,
    p95: hrMetric.p95,
    mean: hrMetric.mean,
  }));

  return (
    <div className="space-y-6">
      {/* Top Incident Header & 6-State Horizontal Progress Indicator */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="text-amber-300 font-bold">{incident.incident_id}</span>
              <span aria-hidden="true">·</span>
              <span className="text-rose-300 font-semibold">SEVERITY: {incident.severity}</span>
              <span aria-hidden="true">·</span>
              <span className="text-cyan-300">{incident.rule_id}</span>
              <span aria-hidden="true">·</span>
              <span>DETECTED: {incident.created_at.replace("T", " ").slice(0, 19)} UTC</span>
              <span aria-hidden="true">·</span>
              <SyncBadge status={incident.sync_status} />
            </div>
            <h2 className="text-lg font-semibold text-white mt-1">{incident.title}</h2>
            <p className="text-xs text-amber-300/90 font-mono mt-0.5">{PROTOTYPE_DISCLAIMER}</p>
          </div>
          <InformationBadge type="COMPUTED" />
        </div>

        {/* 6-State Horizontal Workflow Progress Stepper */}
        <div className="pt-2">
          <div className="text-xs font-mono text-slate-400 mb-2">
            Six-State Incident Workflow Lifecycle:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {WORKFLOW_STATES.map((stateName, idx) => {
              const isCompleted = idx < currentIdx || incident.state === "CLOSED_RETAINED";
              const isCurrent = stateName === incident.state;

              return (
                <div
                  key={stateName}
                  className={`p-2.5 rounded border text-xs font-mono flex items-center justify-between ${
                    isCurrent
                      ? "bg-cyan-950/70 border-cyan-400 text-white font-semibold"
                      : isCompleted
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                      : "bg-slate-900/60 border-slate-800 text-slate-500"
                  }`}
                >
                  <span className="truncate">
                    {idx + 1}. {stateName}
                  </span>
                  {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  {isCurrent && !isCompleted && (
                    <AlertTriangle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout: 7-Part Explanation (Left) & RBAC Actions + Before/After Trend (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: 7-Part Evidence-Backed Explanation */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Seven-Component Evidence-Backed Alert Explanation
            </h3>
            <div className="flex items-center gap-1.5">
              <InformationBadge type="MEASURED" />
              <InformationBadge type="COMPUTED" />
              <InformationBadge type="AI_ASSISTED" />
            </div>
          </div>

          {/* 1. EVIDENCE (MEASURED) */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-semibold text-cyan-300 uppercase">
                1. Evidence — Contributing Telemetry Observations
              </h4>
              <InformationBadge type="MEASURED" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-1.5 pr-2">Obs ID</th>
                    <th className="py-1.5 px-2">Parameter</th>
                    <th className="py-1.5 px-2">Value</th>
                    <th className="py-1.5 px-2">UTC Timestamp</th>
                    <th className="py-1.5 pl-2">Provenance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {exp.evidence_block.map((obs) => (
                    <tr key={obs.observation_id} className="text-slate-200">
                      <td className="py-1.5 pr-2 text-cyan-300">{obs.observation_id}</td>
                      <td className="py-1.5 px-2">{obs.parameter}</td>
                      <td className="py-1.5 px-2 font-bold text-amber-300 tabular-nums">
                        {obs.value} {obs.unit}
                      </td>
                      <td className="py-1.5 px-2 text-slate-400">
                        {obs.timestamp.replace("T", " ").slice(0, 19)}Z
                      </td>
                      <td className="py-1.5 pl-2">
                        <DataSourceBadge
                          source={obs.source_type}
                          hmacVerified={obs.device_hmac_verified}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. BASELINE COMPARISON (COMPUTED) */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-semibold text-blue-300 uppercase">
                2. Personal Baseline Comparison (14-Day Window)
              </h4>
              <InformationBadge type="COMPUTED" />
            </div>
            <div className="space-y-2">
              {Object.values(exp.comparison_block).map((comp) => (
                <div
                  key={comp.parameter}
                  className="bg-slate-900/80 border border-slate-800 rounded p-2.5 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <span className="text-white font-semibold">{comp.parameter}</span>:{" "}
                    <span className="text-amber-300">{comp.comparison_text}</span>
                  </div>
                  <span className="text-amber-300 shrink-0">
                    {comp.outside_p05_p95_band ? "▲ OUTSIDE P05–P95" : "● WITHIN BAND"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. CONTEXT (MEASURED) */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-semibold text-cyan-300 uppercase">
                3. Habitat &amp; Crew Check-In Context
              </h4>
              <InformationBadge type="MEASURED" />
            </div>
            <p className="text-xs text-slate-300">
              {String(exp.context_block.operational_schedule_note || "")}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs font-mono text-slate-300">
              <div className="bg-slate-900/80 border border-slate-800 rounded p-2">
                Cabin CO2: <span className="text-amber-300">5.4 mmHg</span>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded p-2">
                Radiation: <span className="text-emerald-300">0.023 mSv/hr</span>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded p-2">
                3d Sleep: <span className="text-amber-300">5.8 → 5.5 → 5.2 hrs</span>
              </div>
            </div>
          </div>

          {/* 4. REASONING (COMPUTED) */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-semibold text-blue-300 uppercase">
                4. Deterministic Rule Reasoning
              </h4>
              <InformationBadge type="COMPUTED" />
            </div>
            <div className="text-xs font-mono text-slate-200 bg-slate-900/80 border border-slate-800 rounded p-2.5">
              {String(exp.reasoning_block.formula_evaluated || "")}
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Authority: {exp.threshold_authority} · {exp.prototype_disclaimer}
            </div>
          </div>

          {/* 5. DATA QUALITY (COMPUTED) */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-semibold text-blue-300 uppercase">
                5. Data Quality &amp; Quarantine Verification
              </h4>
              <InformationBadge type="COMPUTED" />
            </div>
            <p className="text-xs text-slate-300">
              {String(exp.data_quality_block.gate_summary || "")}
            </p>
            <div className="flex flex-wrap gap-3 text-xs font-mono text-slate-400">
              <span>Valid Evaluated: {String(exp.data_quality_block.valid_evaluated_count)}</span>
              <span>·</span>
              <span className="text-amber-300">
                Stale Flagged: {String(exp.data_quality_block.stale_flagged_count)}
              </span>
              <span>·</span>
              <span className="text-rose-300">
                Quarantined Impossible: {String(exp.data_quality_block.impossible_quarantined_count)}
              </span>
            </div>
          </div>

          {/* 6. UNCERTAINTY (COMPUTED) */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-semibold text-blue-300 uppercase">
                6. Sensor &amp; Clinical Uncertainty Boundary
              </h4>
              <InformationBadge type="COMPUTED" />
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{exp.uncertainty_block}</p>
          </div>

          {/* 7. REFERENCES & AI NARRATIVE SUMMARY */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-semibold text-emerald-300 uppercase">
                7. Linked NASA / CSA Research References &amp; Narrative Summary
              </h4>
              <InformationBadge type="AI_ASSISTED" />
            </div>

            <div className="space-y-2">
              {exp.references_block.map((ref) => (
                <div
                  key={ref.resource_id}
                  className="bg-slate-900/80 border border-slate-800 rounded p-2.5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white">{ref.title}</span>
                    <a
                      href={ref.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 font-mono text-[11px] inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Official Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {ref.publisher} · Published: {ref.publication_date}
                  </div>
                  <div className="text-[11px] text-amber-300/90">{ref.evidence_note}</div>
                </div>
              ))}
            </div>

            {/* Strictly Separated AI / Template Narrative Summary Card */}
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-emerald-300">
                <span>NARRATIVE MODE: {exp.ai_narrative_summary.mode}</span>
                <InformationBadge type="AI_ASSISTED" />
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {exp.ai_narrative_summary.text}
              </p>
              <p className="text-[11px] font-mono text-slate-400">
                {exp.ai_narrative_summary.disclaimer}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Fail-Closed RBAC Action Panel & Before/After Response Trend Chart */}
        <div className="lg:col-span-5 space-y-4">
          {/* Incident Workflow Action Panel */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-cyan-400" />
                <span>Incident Response &amp; Lifecycle Controls</span>
              </h3>
              <span className="text-xs font-mono text-cyan-400">{incident.state}</span>
            </div>

            {actionFeedback && (
              <div
                className={`p-2.5 rounded border text-xs font-mono flex items-start gap-2 ${
                  actionFeedback.ok
                    ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                    : "bg-rose-950/40 border-rose-500/50 text-rose-300"
                }`}
              >
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{actionFeedback.message}</span>
              </div>
            )}

            {/* Step 1 -> 2: Review */}
            <div className="space-y-2 border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">
                  Step 1: Review Evidence (DETECTED → REVIEWED)
                </span>
                <span className="font-mono text-[11px] text-slate-400">CMO / CREW</span>
              </div>
              <button
                type="button"
                onClick={() => onTransitionIncident(incident.incident_id, "review")}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-mono text-xs rounded border border-slate-700 transition-colors"
              >
                Mark Evidence Reviewed (/review)
              </button>
            </div>

            {/* Step 2 -> 3: Acknowledge (Requires CMO + PIN) */}
            <div className="space-y-2 border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">
                  Step 2: CMO Acknowledgment (REVIEWED → ACKNOWLEDGED)
                </span>
                <span className="font-mono text-[11px] text-amber-300">CMO + PIN</span>
              </div>
              <button
                type="button"
                onClick={() => onTransitionIncident(incident.incident_id, "acknowledge")}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs rounded border border-slate-700 transition-colors"
              >
                Record CMO Acknowledgment (/acknowledge)
              </button>
            </div>

            {/* Step 3 -> 4/5: Record Authorized Prototype Procedure */}
            <div className="space-y-2.5 border-b border-slate-800 pb-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">
                  Step 3: Record Response (→ RESPONSE_RECORDED → MONITORING)
                </span>
                <span className="font-mono text-[11px] text-amber-300">CMO + PIN</span>
              </div>

              <div>
                <label htmlFor="proc-select" className="block text-slate-400 mb-1">
                  Authorized Prototype Procedure:
                </label>
                <select
                  id="proc-select"
                  value={selectedProcedure}
                  onChange={(e) => {
                    setSelectedProcedure(e.target.value);
                    setCustomActionNotes(AUTHORIZED_PROTOTYPE_PROCEDURES[e.target.value] || "");
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-white text-xs"
                >
                  {Object.entries(AUTHORIZED_PROTOTYPE_PROCEDURES).map(([code, desc]) => (
                    <option key={code} value={code}>
                      {code}: {desc.slice(0, 62)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="action-notes" className="block text-slate-400 mb-1">
                  Recorded Action Description:
                </label>
                <input
                  id="action-notes"
                  type="text"
                  value={customActionNotes}
                  onChange={(e) => setCustomActionNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-slate-200 text-xs"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  onTransitionIncident(incident.incident_id, "record-response", {
                    procedure_reference: selectedProcedure,
                    authorized_action: customActionNotes,
                  })
                }
                className="w-full py-2 px-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded transition-colors"
              >
                Record Response &amp; Start Monitoring (/record-response)
              </button>
            </div>

            {/* Step 5 -> 6: Evaluate Follow-up & Close Incident */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">
                  Step 4: Close &amp; Retain in Archive (→ CLOSED_RETAINED)
                </span>
                <span className="font-mono text-[11px] text-amber-300">CMO + PIN</span>
              </div>
              <input
                aria-label="Incident Closure Notes"
                type="text"
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-slate-200 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onTransitionIncident(incident.incident_id, "evaluate-followup")}
                  className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs rounded border border-slate-700 transition-colors"
                >
                  Re-Evaluate Follow-Up
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onTransitionIncident(incident.incident_id, "close", {
                      closure_notes: closureNotes,
                    })
                  }
                  className="py-2 px-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded transition-colors"
                >
                  Close &amp; Retain (/close)
                </button>
              </div>
            </div>
          </div>

          {/* Before / After Post-Response Trend Comparison Chart */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-emerald-400" />
                  <span>Before &amp; After Response Trend Comparison</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Compares pre-action excursion against post-action trajectory toward baseline
                </p>
              </div>
              <InformationBadge type="COMPUTED" />
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={beforeAfterChartData}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="step"
                    stroke="#64748b"
                    tick={{ fontSize: 10, fontFamily: "monospace" }}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 10, fontFamily: "monospace" }}
                    domain={[55, 115]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      fontSize: "11px",
                      fontFamily: "monospace",
                    }}
                  />
                  <ReferenceArea
                    y1={hrMetric.p05}
                    y2={hrMetric.p95}
                    fill="#06b6d4"
                    fillOpacity={0.14}
                  />
                  <ReferenceLine
                    y={hrMetric.mean}
                    stroke="#06b6d4"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                  <Line
                    type="monotone"
                    dataKey="hr"
                    name="Heart Rate (bpm)"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {Object.keys(incident.post_action_comparisons).length > 0 ? (
              <div className="space-y-2 pt-1">
                {Object.values(incident.post_action_comparisons).map((trend) => (
                  <div
                    key={trend.parameter}
                    className="bg-slate-900/80 border border-slate-800 rounded p-2.5 text-xs font-mono space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{trend.parameter}</span>
                      <span className="text-emerald-300 font-bold">● {trend.direction}</span>
                    </div>
                    <div className="text-slate-300">{trend.summary_text}</div>
                    <div className="text-[10px] text-slate-400">{trend.non_causal_disclaimer}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-400 bg-slate-900/70 border border-slate-800 rounded p-3">
                Record a prototype response above (or click Scene 5: RESPONSE FOLLOW-UP in the
                simulator bar) to compute pre- vs. post-action directional trajectories.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
