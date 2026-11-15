import React from "react";
import { ShieldAlert, PlusCircle, Clock } from "lucide-react";
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
  PARAMETER_METADATA,
  ParameterName,
  TelemetryHistoryResponse,
  TelemetryLatestResponse,
} from "../types/aegisContracts";
import {
  DataSourceBadge,
  InformationBadge,
  QualityBadge,
} from "../components/InformationBadge";

interface LiveMonitorPageProps {
  baseline: BaselineProfile;
  latest: TelemetryLatestResponse;
  histories: Partial<Record<ParameterName, TelemetryHistoryResponse>>;
  onInjectTestReading: (
    type: "VALID" | "STALE" | "IMPOSSIBLE" | "SPOOFED_HMAC"
  ) => Promise<void>;
}

export const LiveMonitorPage: React.FC<LiveMonitorPageProps> = ({
  baseline,
  latest,
  histories,
  onInjectTestReading,
}) => {
  return (
    <div className="space-y-6">
      {/* Header & Test Telemetry Injection Bar */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">
              Live Continuous Health &amp; Habitat Telemetry Monitor (8 Core Channels)
            </h2>
            <InformationBadge type="MEASURED" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Displays current reading, canonical unit, trend sparkline with P05–P95 personal baseline
            band, UTC timestamp, source provenance (`SIMULATED` vs. `VERIFIED_DEVICE`), and Stage 2
            data quality status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-xs font-mono text-slate-400">Stage 2 Gate Test:</span>
          <button
            type="button"
            onClick={() => onInjectTestReading("VALID")}
            className="px-2.5 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded transition-colors inline-flex items-center gap-1"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Inject VALID (71 bpm)</span>
          </button>
          <button
            type="button"
            onClick={() => onInjectTestReading("STALE")}
            className="px-2.5 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded transition-colors inline-flex items-center gap-1"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Inject STALE (28m old)</span>
          </button>
          <button
            type="button"
            onClick={() => onInjectTestReading("IMPOSSIBLE")}
            className="px-2.5 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 rounded transition-colors inline-flex items-center gap-1"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Inject IMPOSSIBLE (-10 bpm)</span>
          </button>
          <button
            type="button"
            onClick={() => onInjectTestReading("SPOOFED_HMAC")}
            className="px-2.5 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 rounded transition-colors inline-flex items-center gap-1"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Inject Unsigned Hardware</span>
          </button>
        </div>
      </div>

      {/* 8 Parameter Telemetry Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {CORE_8_PARAMETERS.map((param) => {
          const obs = latest.latest_by_parameter[param];
          const comp = latest.baseline_comparisons[param];
          const meta = PARAMETER_METADATA[param];
          const metric = baseline.metrics[param];
          const hist = histories[param];

          if (!obs || !comp) return null;

          const isOutside = comp.outside_p05_p95_band;
          const chartData =
            hist?.observations.map((o) => ({
              time: o.timestamp.slice(11, 16),
              value: o.value,
            })) || [];

          return (
            <div
              key={param}
              className={`bg-[#111827] border rounded-lg p-4 flex flex-col justify-between ${
                isOutside ? "border-amber-500/60" : "border-slate-800"
              }`}
            >
              {/* Card Top Row: Title + Provenance Badges */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white truncate">{meta.label}</h3>
                  <InformationBadge type="MEASURED" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                  <DataSourceBadge
                    source={obs.source_type}
                    hmacVerified={obs.device_hmac_verified}
                  />
                  <QualityBadge status={obs.quality_status} quarantined={obs.is_quarantined} />
                </div>
              </div>

              {/* Numeric Value + Unit + Baseline Comparison */}
              <div className="my-3">
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-3xl font-mono font-bold tabular-nums ${
                      isOutside ? "text-amber-300" : "text-white"
                    }`}
                  >
                    {obs.value !== null ? obs.value.toFixed(meta.decimals) : "—"}
                  </span>
                  <span className="text-xs font-mono uppercase text-slate-400">{meta.unit}</span>
                </div>

                <div
                  className={`text-[11px] font-mono mt-1 tabular-nums ${
                    isOutside ? "text-amber-300" : "text-slate-400"
                  }`}
                >
                  {comp.absolute_delta >= 0 ? "+" : ""}
                  {comp.absolute_delta.toFixed(meta.decimals)} {meta.unit} vs. {metric.mean}{" "}
                  {meta.unit} baseline [p05–p95: {metric.p05}–{metric.p95}]
                </div>
              </div>

              {/* Mini Trend Graph with P05-P95 Baseline Reference Band */}
              <div className="h-28 w-full my-1">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 4, right: 6, left: -24, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" />
                    <XAxis
                      dataKey="time"
                      stroke="#475569"
                      tick={{ fontSize: 10, fontFamily: "monospace" }}
                    />
                    <YAxis
                      stroke="#475569"
                      tick={{ fontSize: 10, fontFamily: "monospace" }}
                      domain={["auto", "auto"]}
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
                      y1={metric.p05}
                      y2={metric.p95}
                      fill="#06b6d4"
                      fillOpacity={0.14}
                    />
                    <ReferenceLine
                      y={metric.mean}
                      stroke="#06b6d4"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name={`${meta.shortLabel} (${meta.unit})`}
                      stroke={isOutside ? "#fbbf24" : "#38bdf8"}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Timestamp & Device Provenance Footer */}
              <div className="pt-2.5 mt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>{obs.timestamp.replace("T", " ").slice(0, 19)} UTC</span>
                </span>
                <span>{obs.device_id || "SIM-ENGINE-01"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stage 2 Data Quality Quarantine Drawer */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">
              Stage 2 Data-Quality Gate &amp; Quarantine Drawer
            </h3>
            <InformationBadge type="COMPUTED" />
          </div>
          <span className="text-xs font-mono text-slate-400">
            Quarantined / Flagged Packets: {latest.quarantined_recent.length}
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-3">
          Readings flagged as <code className="text-rose-300">IMPOSSIBLE</code>,{" "}
          <code className="text-rose-300">CORRUPTED</code> (including failed hardware HMAC-SHA256
          verification), or <code className="text-amber-300">STALE</code> (&gt;15 min old) are
          isolated here so they never corrupt Cdr. Vance&apos;s personal baseline or trigger false
          clinical alarms.
        </p>

        {latest.quarantined_recent.length === 0 ? (
          <div className="text-xs font-mono text-emerald-300 bg-slate-900/70 border border-slate-800 rounded p-3">
            ● Zero quarantined or stale packets in current telemetry window. All sensor frames passed
            Stage 2 validation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3">Observation ID</th>
                  <th className="py-2 px-3">UTC Timestamp</th>
                  <th className="py-2 px-3">Parameter</th>
                  <th className="py-2 px-3">Raw Value</th>
                  <th className="py-2 px-3">Source</th>
                  <th className="py-2 px-3">Quality Status</th>
                  <th className="py-2 pl-3">Stage 2 Gate Diagnostic Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {latest.quarantined_recent.map((q) => (
                  <tr key={q.observation_id} className="text-slate-200">
                    <td className="py-2 pr-3 text-cyan-300 whitespace-nowrap">
                      {q.observation_id}
                    </td>
                    <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                      {q.timestamp.replace("T", " ").slice(0, 19)}Z
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">{q.parameter}</td>
                    <td className="py-2 px-3 text-rose-300 tabular-nums whitespace-nowrap">
                      {q.value !== null ? `${q.value} ${q.unit}` : "NULL"}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <DataSourceBadge
                        source={q.source_type}
                        hmacVerified={q.device_hmac_verified}
                      />
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <QualityBadge status={q.quality_status} quarantined={q.is_quarantined} />
                    </td>
                    <td className="py-2 pl-3 text-slate-300">{q.quality_notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
