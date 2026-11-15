import React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock,
  Radio,
  RefreshCw,
  ShieldCheck,
  User,
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
  BaselineProfile,
  CORE_8_PARAMETERS,
  ConsultationQueueItem,
  IncidentRecord,
  NavigationTabId,
  PARAMETER_METADATA,
  ParameterName,
  TelemetryHistoryResponse,
  TelemetryLatestResponse,
} from "../types/aegisContracts";
import {
  DataSourceBadge,
  InformationBadge,
  QualityBadge,
  SyncBadge,
} from "../components/InformationBadge";

interface OverviewPageProps {
  baseline: BaselineProfile;
  latest: TelemetryLatestResponse;
  histories: Partial<Record<ParameterName, TelemetryHistoryResponse>>;
  incidents: IncidentRecord[];
  consultationQueue: ConsultationQueueItem[];
  earthWanConnected: boolean;
  onNavigate: (tab: NavigationTabId) => void;
}

const KEY_TREND_PARAMS: ParameterName[] = [
  "heart_rate_bpm",
  "spo2_pct",
  "respiration_rpm",
  "cabin_co2_mmhg",
];

export const OverviewPage: React.FC<OverviewPageProps> = ({
  baseline,
  latest,
  histories,
  incidents,
  consultationQueue,
  earthWanConnected,
  onNavigate,
}) => {
  const activeIncident = incidents.find((i) => i.state !== "CLOSED_RETAINED") || incidents[0];
  const latestSyncStatus =
    consultationQueue.length > 0
      ? consultationQueue[0].sync_status
      : activeIncident?.sync_status || "LOCAL_ONLY";

  const validCount =
    (latest.quality_counts.VALID || 0) + (latest.quality_counts.ESTIMATED || 0);
  const staleCount = latest.quality_counts.STALE || 0;
  const quarantinedCount =
    (latest.quality_counts.IMPOSSIBLE || 0) +
    (latest.quality_counts.CORRUPTED || 0) +
    (latest.quality_counts.MISSING || 0);

  const hasExcursion = CORE_8_PARAMETERS.some(
    (p) => latest.baseline_comparisons[p]?.outside_p05_p95_band
  );

  return (
    <div className="space-y-6">
      {/* Top Astronaut Profile & Mission Status Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Astronaut Profile Card */}
        <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-mono text-cyan-400">
                  {baseline.astronaut_id} · FLIGHT ENGINEER
                </div>
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  {baseline.full_name}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mission: Lunar Gateway Prototype (Cislunar Habitation Node-2)
                </p>
              </div>
            </div>
            <InformationBadge type="COMPUTED" />
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-slate-400">Personal Baseline Reference</div>
              <div className="font-mono text-slate-200 mt-0.5 truncate" title={baseline.window_label}>
                2026-10-30 → 2026-11-12 (14d)
              </div>
            </div>
            <div>
              <div className="text-slate-400">Calibration Provenance</div>
              <div className="font-mono text-amber-300 mt-0.5">SIMULATED DEMO BASELINE</div>
            </div>
          </div>
        </div>

        {/* Overall Health Status & Mission Operational Telemetry */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Overall Health Summary */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Health Summary</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="my-2">
              {hasExcursion ? (
                <div className="text-sm font-mono font-semibold text-amber-300">
                  ▲ DEVIATION DETECTED
                </div>
              ) : (
                <div className="text-sm font-mono font-semibold text-emerald-300">
                  ● NOMINAL BASELINE
                </div>
              )}
              <div className="text-[11px] text-slate-400 mt-1">
                {activeIncident && activeIncident.state !== "CLOSED_RETAINED"
                  ? `Active: ${activeIncident.rule_id}`
                  : "All 18 parameters within P05–P95"}
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Active Alerts: {incidents.filter((i) => i.state !== "CLOSED_RETAINED").length}
            </div>
          </div>

          {/* Data Freshness & Quality Gate */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Data Freshness</span>
              <Clock className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="my-2">
              <div className="text-sm font-mono font-semibold text-slate-100 tabular-nums">
                ● &lt; 5s LATENCY
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1">
                Valid: {validCount} · Stale: {staleCount}
              </div>
            </div>
            <div className="text-[11px] font-mono text-rose-300">
              Quarantined: {quarantinedCount} rejected
            </div>
          </div>

          {/* Earth Connectivity Status */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Earth Deep-Space Link</span>
              <Radio className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="my-2">
              {earthWanConnected ? (
                <div className="text-sm font-mono font-semibold text-emerald-300">
                  ● WAN CONNECTED
                </div>
              ) : (
                <div className="text-sm font-mono font-semibold text-amber-300">
                  ▲ EARTH UNAVAILABLE
                </div>
              )}
              <div className="text-[11px] text-slate-400 mt-1">
                {earthWanConnected
                  ? "Deep Space Network telemetry active"
                  : "Autonomous local onboard mode active"}
              </div>
            </div>
            <div className="text-[11px] font-mono text-cyan-300">
              Onboard Node: 100% Operational
            </div>
          </div>

          {/* Offline Synchronization Status */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Offline Sync Queue</span>
              <RefreshCw className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="my-2">
              <SyncBadge status={latestSyncStatus} />
              <div className="text-[11px] text-slate-400 mt-1">
                {consultationQueue.length} consultation pkg(s) queued
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("consultation")}
              className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 text-left underline"
            >
              Inspect Sync Queue →
            </button>
          </div>
        </div>
      </div>

      {/* Active Alert Callout Banner */}
      {activeIncident && (
        <div
          className={`rounded-lg border p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
            activeIncident.state === "CLOSED_RETAINED"
              ? "bg-slate-900/90 border-slate-700"
              : "bg-amber-950/30 border-amber-500/50"
          }`}
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <AlertTriangle
                className={`w-4 h-4 ${
                  activeIncident.state === "CLOSED_RETAINED"
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
              />
              <span className="font-semibold text-white">{activeIncident.incident_id}</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-300 font-semibold">{activeIncident.rule_id}</span>
              <span aria-hidden="true">·</span>
              <span className="text-cyan-300">STATE: {activeIncident.state}</span>
              <span aria-hidden="true">·</span>
              <InformationBadge type="COMPUTED" />
            </div>
            <h3 className="text-base font-semibold text-white">{activeIncident.title}</h3>
            <p className="text-xs text-slate-300">
              Contributing Parameters: SpO2 (92.4% vs. 98.2% baseline), Cabin CO2 (5.4 mmHg vs. 2.8
              mmHg baseline), Respiration (22.0 rpm), Heart Rate (108.0 bpm) + 3-Day HRP Sleep/Fatigue
              shift.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate("incident-detail")}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <span>Inspect Evidence &amp; Respond</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Latest Health Readings Grid (All 8 Core Vital & Habitat Parameters) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Latest Continuous Vital &amp; Habitat Telemetry Readings
            </h3>
            <p className="text-xs text-slate-400">
              Real-time comparison against Cdr. Elena Vance&apos;s 14-day personal baseline [P05–P95
              normal reference band]
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("live-monitor")}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
          >
            <span>Open Full Live Monitor</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CORE_8_PARAMETERS.map((param) => {
            const obs = latest.latest_by_parameter[param];
            const comp = latest.baseline_comparisons[param];
            const meta = PARAMETER_METADATA[param];
            const metric = baseline.metrics[param];
            if (!obs || !comp) return null;

            const isOutside = comp.outside_p05_p95_band;

            return (
              <div
                key={param}
                className={`bg-[#111827] border rounded-lg p-3.5 flex flex-col justify-between ${
                  isOutside ? "border-amber-500/50" : "border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-xs">
                  <span className="text-slate-300 font-medium truncate">{meta.label}</span>
                  <DataSourceBadge
                    source={obs.source_type}
                    hmacVerified={obs.device_hmac_verified}
                  />
                </div>

                <div className="my-2 flex items-baseline gap-1.5">
                  <span
                    className={`text-2xl font-mono font-bold tabular-nums ${
                      isOutside ? "text-amber-300" : "text-white"
                    }`}
                  >
                    {obs.value !== null ? obs.value.toFixed(meta.decimals) : "—"}
                  </span>
                  <span className="text-xs font-mono text-slate-400">{meta.unit}</span>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Baseline [P05–P95]:</span>
                    <span className="text-slate-300 tabular-nums">
                      {metric.p05}–{metric.p95} {meta.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`tabular-nums ${
                        isOutside ? "text-amber-300 font-semibold" : "text-emerald-300"
                      }`}
                    >
                      Δ {comp.absolute_delta >= 0 ? "+" : ""}
                      {comp.absolute_delta.toFixed(meta.decimals)} ({comp.z_score >= 0 ? "+" : ""}
                      {comp.z_score}σ)
                    </span>
                    <QualityBadge status={obs.quality_status} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4 Key Trend Mini-Charts with P05-P95 Baseline Reference Bands */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Key Physiological &amp; Habitat Trajectories vs. Personal Baseline Band
            </h3>
            <p className="text-xs text-slate-400">
              Shaded cyan region denotes personal 14-day P05–P95 reference band; dashed line denotes
              personal baseline mean
            </p>
          </div>
          <div className="flex items-center gap-2">
            <InformationBadge type="MEASURED" />
            <InformationBadge type="COMPUTED" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {KEY_TREND_PARAMS.map((param) => {
            const hist = histories[param];
            const meta = PARAMETER_METADATA[param];
            const metric = baseline.metrics[param];
            const chartData =
              hist?.observations.map((o) => ({
                time: o.timestamp.slice(11, 16),
                value: o.value,
                p05: metric.p05,
                p95: metric.p95,
                mean: metric.mean,
              })) || [];

            return (
              <div
                key={param}
                className="bg-[#111827] border border-slate-800 rounded-lg p-4 flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100">
                      {meta.label} ({meta.unit})
                    </h4>
                    <div className="text-[11px] font-mono text-slate-400">
                      Mean: {metric.mean} {meta.unit} · P05–P95 Band: [{metric.p05}–{metric.p95}{" "}
                      {meta.unit}]
                    </div>
                  </div>
                  <DataSourceBadge source="SIMULATED" />
                </div>

                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="time"
                        stroke="#64748b"
                        tick={{ fontSize: 11, fontFamily: "monospace" }}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fontSize: 11, fontFamily: "monospace" }}
                        domain={["auto", "auto"]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          fontSize: "12px",
                          fontFamily: "monospace",
                        }}
                      />
                      <ReferenceArea
                        y1={metric.p05}
                        y2={metric.p95}
                        fill="#06b6d4"
                        fillOpacity={0.12}
                      />
                      <ReferenceLine
                        y={metric.mean}
                        stroke="#06b6d4"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        name={`${meta.shortLabel} (${meta.unit})`}
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#38bdf8" }}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
