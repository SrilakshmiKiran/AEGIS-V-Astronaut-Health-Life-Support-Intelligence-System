import React from "react";
import { ExternalLink, ShieldAlert, Wind, Zap } from "lucide-react";
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
  KnowledgeResource,
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

interface RadiationEnvironmentPageProps {
  baseline: BaselineProfile;
  latest: TelemetryLatestResponse;
  histories: Partial<Record<ParameterName, TelemetryHistoryResponse>>;
  resources: KnowledgeResource[];
}

export const RadiationEnvironmentPage: React.FC<RadiationEnvironmentPageProps> = ({
  baseline,
  latest,
  histories,
  resources,
}) => {
  const envParams: ParameterName[] = ["radiation_msv_hr", "cabin_co2_mmhg"];
  const radResources = resources.filter((r) =>
    ["CSA-RAD-04", "NASA-HAZARDS-01"].includes(r.resource_id)
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Scope Guardrail */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">
              Radiation &amp; Habitat Environmental Telemetry Monitor
            </h2>
            <InformationBadge type="MEASURED" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Monitors spacecraft dosimetry rate (<code className="text-cyan-300">mSv/hr</code>) and
            ambient cabin carbon dioxide partial pressure (
            <code className="text-cyan-300">mmHg</code>) against 14-day habitat baseline bands.
          </p>
        </div>

        <div className="bg-amber-950/30 border border-amber-500/40 rounded px-3 py-2 text-xs font-mono text-amber-300 flex items-center gap-2 shrink-0">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>No Unvalidated Biological Radiation Dose Predictions</span>
        </div>
      </div>

      {/* Two Main Environmental Telemetry Cards & Historical Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {envParams.map((param) => {
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
              className={`bg-[#111827] border rounded-lg p-4 space-y-4 ${
                isOutside ? "border-amber-500/60" : "border-slate-800"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    {param === "radiation_msv_hr" ? (
                      <Zap className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <Wind className="w-4 h-4 text-cyan-400" />
                    )}
                    <h3 className="text-base font-semibold text-white">{meta.label}</h3>
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-0.5">
                    Baseline Mean: {metric.mean} {meta.unit} · P05–P95 Band: [{metric.p05}–
                    {metric.p95} {meta.unit}]
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <DataSourceBadge
                    source={obs.source_type}
                    hmacVerified={obs.device_hmac_verified}
                  />
                  <QualityBadge status={obs.quality_status} />
                </div>
              </div>

              <div className="flex items-baseline justify-between border-y border-slate-800/80 py-3">
                <div>
                  <span
                    className={`text-3xl font-mono font-bold tabular-nums ${
                      isOutside ? "text-amber-300" : "text-white"
                    }`}
                  >
                    {obs.value !== null ? obs.value.toFixed(meta.decimals) : "—"}
                  </span>
                  <span className="text-xs font-mono text-slate-400 ml-1.5">{meta.unit}</span>
                </div>
                <div className="text-right font-mono text-xs">
                  <div className={isOutside ? "text-amber-300 font-semibold" : "text-emerald-300"}>
                    {comp.outside_p05_p95_band ? "▲ EXCURSION ABOVE BAND" : "● NOMINAL HABITAT BAND"}
                  </div>
                  <div className="text-slate-400 text-[11px] tabular-nums">
                    Delta: {comp.absolute_delta >= 0 ? "+" : ""}
                    {comp.absolute_delta.toFixed(meta.decimals)} {meta.unit} (z={comp.z_score}σ)
                  </div>
                </div>
              </div>

              <div className="h-56 w-full">
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
                      fillOpacity={0.14}
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
                      name={`${meta.label} (${meta.unit})`}
                      stroke={isOutside ? "#fbbf24" : "#38bdf8"}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Last Updated: {obs.timestamp.replace("T", " ").slice(0, 19)} UTC</span>
                <span>Sensor ID: {obs.device_id || "SIM-ENGINE-01"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Linked Space Radiation & Habitat Environment Research Context */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            Relevant Canadian Space Agency (CSA) &amp; NASA HRP Radiation Research Context
          </h3>
          <InformationBadge type="AI_ASSISTED" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {radResources.map((res) => (
            <div
              key={res.resource_id}
              className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2 font-mono text-slate-400">
                <span>
                  {res.resource_id} · {res.publisher} ({res.publication_date})
                </span>
                <a
                  href={res.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                >
                  <span>Source</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <h4 className="text-sm font-semibold text-white">{res.title}</h4>
              <p className="text-slate-300 leading-relaxed">{res.summary}</p>
              <div className="text-[11px] font-mono text-amber-300/90 pt-1">
                Scope Note: {res.evidence_note}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
