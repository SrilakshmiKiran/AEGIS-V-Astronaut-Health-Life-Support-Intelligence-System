import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Shield, ShieldCheck, Sun, Upload, Wind, Zap } from "lucide-react";
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
  PARAMETER_METADATA,
  ParameterName,
  TelemetryHistoryResponse,
  TelemetryLatestResponse,
} from "../types/aegisContracts";
import {
  DEFAULT_ECLSS,
  EclssSnapshot,
  EnvContaminantStatus,
  EnvDataSourceMode,
  EnvSmokeFireStatus,
  EnvSystemHealthStatus,
  EnvVentilationStatus,
  OpsStateDoc,
} from "../types/opsContracts";
import { EnvironmentSafetyAssessment } from "../types/lifeSafetyContracts";
import { ENV_SOURCE_LABELS, evaluateEnvironmentLifeSafety } from "../utils/lifeSafetyEngine";
import { QualityStatusText } from "../components/StatusText";
import { SafeImage } from "../components/SafeImage";
import { VISUAL_ASSETS } from "../assets/visualCatalog";
import { CuratedReferencesStrip } from "../components/CuratedReferencesStrip";
import { formatMissionTimeUtc } from "../utils/aegisPureEngine";

interface CabinRadiationPageProps {
  baseline: BaselineProfile;
  latest: TelemetryLatestResponse;
  histories: Partial<Record<ParameterName, TelemetryHistoryResponse>>;
  opsState: OpsStateDoc;
  envAssessment?: EnvironmentSafetyAssessment;
  onUpdateOpsState: (updates: Partial<Omit<OpsStateDoc, "ownerId">>) => Promise<void>;
  onOpenLifeSafety?: () => void;
  onTriggerEmergencyFromEnv?: () => void;
  onBackHome: () => void;
  isBusy: boolean;
}

export const CabinRadiationPage: React.FC<CabinRadiationPageProps> = ({
  baseline,
  latest,
  histories,
  opsState,
  envAssessment: externalAssessment,
  onUpdateOpsState,
  onOpenLifeSafety,
  onTriggerEmergencyFromEnv,
  onBackHome,
  isBusy,
}) => {
  const [eclssDraft, setEclssDraft] = useState<EclssSnapshot>({
    ...DEFAULT_ECLSS,
    ...opsState.eclss,
  });
  const [shelterSec, setShelterSec] = useState(12 * 60);
  const [showImportBox, setShowImportBox] = useState(false);
  const [importText, setImportText] = useState(
    '{"cabinPressureKpa": 101.2, "cabinPressureRateKpaHr": 0.0, "ppO2MmHg": 160.4, "o2SupplyPct": 92, "traceCoPpm": 1.8}'
  );
  const [importMessage, setImportMessage] = useState<string | null>(null);

  useEffect(() => {
    setEclssDraft({ ...DEFAULT_ECLSS, ...opsState.eclss });
  }, [opsState.eclss]);

  useEffect(() => {
    if (!opsState.solarStormActive) {
      setShelterSec(12 * 60);
      return;
    }
    const id = window.setInterval(() => {
      setShelterSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [opsState.solarStormActive]);

  const liveAssessment =
    externalAssessment ||
    evaluateEnvironmentLifeSafety(eclssDraft, latest, opsState.solarStormActive);

  const doseBudgetPct = Math.min(100, (opsState.cumulativeRadiationMsv / 600) * 100);
  const stormMins = Math.floor(shelterSec / 60);
  const stormSecs = shelterSec % 60;

  const handleSaveEclss = async () => {
    await onUpdateOpsState({
      eclss: {
        ...DEFAULT_ECLSS,
        ...eclssDraft,
        envLastUpdatedIso: new Date().toISOString(),
      },
    });
    setImportMessage("Saved environmental snapshot & data-source provenance.");
  };

  const handleImportSnapshot = async () => {
    const raw = importText.trim();
    if (!raw) return;
    try {
      let parsed: Partial<EclssSnapshot> = {};
      if (raw.startsWith("{")) {
        const obj = JSON.parse(raw) as Record<string, unknown>;
        parsed = {
          cabinPressureKpa:
            typeof obj.cabinPressureKpa === "number" ? obj.cabinPressureKpa : eclssDraft.cabinPressureKpa,
          cabinPressureRateKpaHr:
            typeof obj.cabinPressureRateKpaHr === "number"
              ? obj.cabinPressureRateKpaHr
              : eclssDraft.cabinPressureRateKpaHr,
          ppO2MmHg: typeof obj.ppO2MmHg === "number" ? obj.ppO2MmHg : eclssDraft.ppO2MmHg,
          o2SupplyPct: typeof obj.o2SupplyPct === "number" ? obj.o2SupplyPct : eclssDraft.o2SupplyPct,
          traceCoPpm: typeof obj.traceCoPpm === "number" ? obj.traceCoPpm : eclssDraft.traceCoPpm,
          cabinTempC: typeof obj.cabinTempC === "number" ? obj.cabinTempC : eclssDraft.cabinTempC,
          relativeHumidityPct:
            typeof obj.relativeHumidityPct === "number"
              ? obj.relativeHumidityPct
              : eclssDraft.relativeHumidityPct,
          scrubberBedPct:
            typeof obj.scrubberBedPct === "number" ? obj.scrubberBedPct : eclssDraft.scrubberBedPct,
        };
      } else {
        // Support simple CSV lines: parameter,value
        const nextParsed: Record<string, number> = {};
        raw.split(/\r?\n/).forEach((line) => {
          const [k, v] = line.split(",").map((s) => s.trim());
          const num = Number(v);
          if (k && Number.isFinite(num)) nextParsed[k] = num;
        });
        parsed = {
          cabinPressureKpa: nextParsed.cabinPressureKpa ?? eclssDraft.cabinPressureKpa,
          cabinPressureRateKpaHr:
            nextParsed.cabinPressureRateKpaHr ?? eclssDraft.cabinPressureRateKpaHr,
          ppO2MmHg: nextParsed.ppO2MmHg ?? eclssDraft.ppO2MmHg,
          o2SupplyPct: nextParsed.o2SupplyPct ?? eclssDraft.o2SupplyPct,
          traceCoPpm: nextParsed.traceCoPpm ?? eclssDraft.traceCoPpm,
        };
      }

      const nextEclss: EclssSnapshot = {
        ...DEFAULT_ECLSS,
        ...eclssDraft,
        ...parsed,
        envDataSource: "IMPORTED_RECORD",
        envSourceLabel: "Imported Habitat JSON/CSV Record (User Loaded)",
        envLastUpdatedIso: new Date().toISOString(),
      };
      setEclssDraft(nextEclss);
      await onUpdateOpsState({ eclss: nextEclss });
      setImportMessage("Imported environmental snapshot and labeled provenance as IMPORTED_RECORD.");
      setShowImportBox(false);
    } catch {
      setImportMessage(
        "Could not parse snapshot — provide valid JSON (e.g. {\"cabinPressureKpa\": 100.8}) or CSV (parameter,value)."
      );
    }
  };

  const activeSourceMode: EnvDataSourceMode = eclssDraft.envDataSource || "SIMULATED";

  return (
    <div className="space-y-6">
      {/* Page Header & Back to Home Dashboard */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-full sm:w-44 aspect-[16/10] rounded-xl overflow-hidden border border-white/80 shadow-sm shrink-0">
            <SafeImage
              src={opsState.solarStormActive ? VISUAL_ASSETS.envHabitat : VISUAL_ASSETS.cabinEclss}
              alt="Cabin life-support ECLSS rack and radiation shielding"
              caption={opsState.solarStormActive ? "Storm Shelter Active" : "ECLSS & Radiation"}
            />
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={onBackHome}
              className="text-xs font-medium text-sky-800 hover:text-sky-950 inline-flex items-center gap-1.5 cursor-pointer mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home Dashboard</span>
            </button>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Cabin Air, ECLSS Life-Safety &amp; Radiation
            </h1>
            <p className="text-sm text-slate-600">
              Monitor CO2, radiation, cabin pressure, pressure-loss rate, O2 partial pressure &amp;
              reserve, smoke/fire, contaminants, ventilation, and hardware health with strict data
              provenance labels.
            </p>
          </div>
        </div>

        {(onOpenLifeSafety || onTriggerEmergencyFromEnv) && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenLifeSafety && (
              <button
                type="button"
                onClick={onOpenLifeSafety}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Open Life-Safety Sentinel →</span>
              </button>
            )}
            {onTriggerEmergencyFromEnv && (
              <button
                type="button"
                onClick={onTriggerEmergencyFromEnv}
                className="px-3.5 py-2 text-xs font-semibold bg-rose-700 hover:bg-rose-800 text-white rounded-xl cursor-pointer whitespace-nowrap"
              >
                Emergency Request
              </button>
            )}
          </div>
        )}
      </div>

      {/* Data Provenance & Prototype Safety Boundary Strip */}
      <div
        className={`rounded-2xl p-4 border text-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
          liveAssessment.overallLevel === "URGENT"
            ? "bg-rose-50/90 border-rose-300 text-rose-950"
            : liveAssessment.overallLevel === "ADVISORY" || liveAssessment.overallLevel === "FAULT"
            ? "bg-amber-50/90 border-amber-300 text-amber-950"
            : "bg-sky-50/85 border-sky-200 text-slate-900"
        }`}
      >
        <div className="space-y-1">
          <div className="font-mono text-[11px] font-bold uppercase tracking-wide">
            ENV ASSESSMENT: {liveAssessment.overallLevel} · PROVENANCE:{" "}
            {ENV_SOURCE_LABELS[activeSourceMode]}
          </div>
          <div className="font-semibold">{liveAssessment.summaryHeadline}</div>
          <div className="text-[11px] opacity-85">
            Decision-support prototype only: no live spacecraft ECLSS bus or hardware valve control
            is connected.
            {eclssDraft.envLastUpdatedIso
              ? ` Last snapshot update: ${formatMissionTimeUtc(eclssDraft.envLastUpdatedIso)}.`
              : ""}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            aria-label="Environmental Data Source Mode"
            value={activeSourceMode}
            disabled={isBusy}
            onChange={(e) => {
              const mode = e.target.value as EnvDataSourceMode;
              setEclssDraft({
                ...eclssDraft,
                envDataSource: mode,
                envSourceLabel: ENV_SOURCE_LABELS[mode],
              });
            }}
            className="bg-white/90 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-900"
          >
            <option value="SIMULATED">Synthetic Demo Data</option>
            <option value="MANUAL_ENTRY">Manual Gauge Inspection</option>
            <option value="IMPORTED_RECORD">Imported JSON/CSV Record</option>
          </select>
          <button
            type="button"
            onClick={() => setShowImportBox(!showImportBox)}
            className="px-3 py-1.5 bg-white/90 hover:bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{showImportBox ? "Close Import" : "Import JSON/CSV"}</span>
          </button>
        </div>
      </div>

      {showImportBox && (
        <div className="glass-panel rounded-2xl p-5 space-y-3 text-xs">
          <div className="font-semibold text-slate-900">
            Import Environmental Snapshot (JSON or CSV)
          </div>
          <p className="text-slate-600">
            Paste JSON keys (<code>cabinPressureKpa</code>, <code>cabinPressureRateKpaHr</code>,{" "}
            <code>ppO2MmHg</code>, <code>o2SupplyPct</code>, <code>traceCoPpm</code>) or CSV lines
            (<code>parameter,value</code>). Imported records are permanently tagged{" "}
            <code>IMPORTED_RECORD</code>.
          </p>
          <textarea
            aria-label="Environmental Import Data"
            rows={3}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white/90 p-2.5 font-mono text-xs text-slate-900"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={handleImportSnapshot}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl cursor-pointer"
            >
              Parse &amp; Save Imported Snapshot
            </button>
          </div>
        </div>
      )}

      {importMessage && (
        <div className="p-3 rounded-xl border border-sky-200 bg-sky-50/90 text-xs text-sky-950 font-medium">
          {importMessage}
        </div>
      )}

      {/* Two Dedicated Environmental Charts (Preserved Intact) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(["cabin_co2_mmhg", "radiation_msv_hr"] as ParameterName[]).map((param) => {
          const obs = latest.latest_by_parameter[param];
          const comp = latest.baseline_comparisons[param];
          const status = latest.status_by_parameter?.[param];
          const meta = PARAMETER_METADATA[param];
          const metric = baseline.metrics[param];
          const hist = histories[param];
          if (!obs && !status) return null;

          const isStaleOrUnavail = Boolean(status?.isStaleOrUnavailable);
          const isAging = status?.freshness === "AGING";
          const isOut = Boolean(comp?.outside_p05_p95_band && !isStaleOrUnavail);
          const chartData =
            hist?.observations.map((o) => ({
              time: o.timestamp.slice(11, 16),
              value: o.value,
            })) || [];

          return (
            <div
              key={param}
              className={`glass-panel rounded-2xl p-6 space-y-4 ${
                isOut || isStaleOrUnavail ? "ring-1 ring-amber-300/80" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-50/90 border border-sky-100 flex items-center justify-center text-sky-700 shrink-0">
                    {param === "radiation_msv_hr" ? (
                      <Zap className="w-4 h-4" />
                    ) : (
                      <Wind className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{meta.label}</h2>
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      Normal range: {metric.p05}–{metric.p95} {meta.unit} (avg {metric.mean})
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {obs && <QualityStatusText status={obs.quality_status} />}
                  {status && (
                    <div
                      className={`text-[11px] font-mono font-semibold mt-0.5 ${
                        isStaleOrUnavail
                          ? "text-rose-700"
                          : isAging
                          ? "text-amber-700"
                          : "text-emerald-700"
                      }`}
                    >
                      {status.freshness}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-y border-slate-200/70 py-3 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  {isStaleOrUnavail ? (
                    <div>
                      <span className="text-2xl font-mono font-bold text-amber-800">
                        {status?.freshness === "STALE" ? "Stale — Not Live" : "Unavailable"}
                      </span>
                      <div className="text-xs font-mono text-slate-700 tabular-nums mt-0.5">
                        Last valid:{" "}
                        {status?.lastValidValue !== null && status?.lastValidValue !== undefined
                          ? `${status.lastValidValue.toFixed(meta.decimals)} ${meta.unit}`
                          : "None recorded"}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span
                        className={`text-3xl font-mono font-bold tabular-nums ${
                          isOut ? "text-amber-700" : "text-slate-900"
                        }`}
                      >
                        {status?.liveValue !== null && status?.liveValue !== undefined
                          ? status.liveValue.toFixed(meta.decimals)
                          : obs?.value !== null && obs?.value !== undefined
                          ? obs.value.toFixed(meta.decimals)
                          : "—"}
                      </span>
                      <span className="text-xs font-mono text-slate-500 ml-1.5">{meta.unit}</span>
                    </div>
                  )}
                  <span
                    className={`text-xs font-medium ${
                      isStaleOrUnavail || isOut ? "text-amber-700" : "text-emerald-700"
                    }`}
                  >
                    {isStaleOrUnavail
                      ? status?.freshnessLabel
                      : isOut
                      ? "▲ Above normal cabin range"
                      : "● Within cabin range"}
                  </span>
                </div>

                {status && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono text-slate-600 tabular-nums pt-1">
                    <div>
                      Obs: {formatMissionTimeUtc(status.lastObservationTimeIso)}
                    </div>
                    <div>
                      Last Valid: {formatMissionTimeUtc(status.lastValidTimeIso)}
                    </div>
                    <div className={status.dataSufficiencyNote ? "text-amber-800" : "text-slate-700"}>
                      {status.dataSufficiencyNote
                        ? status.dataSufficiencyNote
                        : `Δ ${status.deltaSummary}`}
                    </div>
                  </div>
                )}
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="time"
                      stroke="#64748b"
                      tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255,255,255,0.96)",
                        borderColor: "#cbd5e1",
                        borderRadius: "10px",
                        fontSize: "12px",
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    />
                    <ReferenceArea
                      y1={metric.p05}
                      y2={metric.p95}
                      fill="#0ea5e9"
                      fillOpacity={0.14}
                    />
                    <ReferenceLine
                      y={metric.mean}
                      stroke="#0284c7"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={isOut ? "#d97706" : "#0284c7"}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full ECLSS Cabin Atmosphere + Cumulative Radiation & Solar Storm Shelter */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Full ECLSS Life-Safety Atmosphere (All 8 Parameters) */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Full ECLSS Cabin Life-Safety Atmosphere (8 Parameters)
              </h2>
              <p className="text-xs text-slate-500">
                Cabin pressure, leak rate, ppO2, O2 reserve, smoke/fire, contaminants, ventilation,
                and hardware fault status.
              </p>
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={handleSaveEclss}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold rounded-xl cursor-pointer whitespace-nowrap"
            >
              Save ECLSS Readings
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="glass-subtle rounded-xl p-3.5 space-y-1">
              <label htmlFor="eclss-kpa" className="text-slate-600 flex justify-between">
                <span>1. Cabin Pressure</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {eclssDraft.cabinPressureKpa.toFixed(1)} kPa
                </span>
              </label>
              <input
                id="eclss-kpa"
                type="range"
                min={88}
                max={105}
                step={0.2}
                value={eclssDraft.cabinPressureKpa}
                onChange={(e) =>
                  setEclssDraft({ ...eclssDraft, cabinPressureKpa: Number(e.target.value) })
                }
                className="w-full accent-sky-600"
              />
              <div className="text-[11px] text-slate-500">Nominal: 99–103 kPa</div>
            </div>

            <div className="glass-subtle rounded-xl p-3.5 space-y-1">
              <label htmlFor="eclss-leak-rate" className="text-slate-600 flex justify-between">
                <span>2. Pressure-Loss Rate</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    Number(eclssDraft.cabinPressureRateKpaHr ?? 0) <= -0.15
                      ? "text-amber-800"
                      : "text-slate-900"
                  }`}
                >
                  {Number(eclssDraft.cabinPressureRateKpaHr ?? 0).toFixed(2)} kPa/hr
                </span>
              </label>
              <input
                id="eclss-leak-rate"
                type="range"
                min={-1.5}
                max={0.2}
                step={0.05}
                value={Number(eclssDraft.cabinPressureRateKpaHr ?? 0)}
                onChange={(e) =>
                  setEclssDraft({
                    ...eclssDraft,
                    cabinPressureRateKpaHr: Number(e.target.value),
                  })
                }
                className="w-full accent-sky-600"
              />
              <div className="text-[11px] text-slate-500">Alert below -0.15 kPa/hr</div>
            </div>

            <div className="glass-subtle rounded-xl p-3.5 space-y-1">
              <label htmlFor="eclss-ppo2" className="text-slate-600 flex justify-between">
                <span>3. Cabin ppO2</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {eclssDraft.ppO2MmHg.toFixed(1)} mmHg
                </span>
              </label>
              <input
                id="eclss-ppo2"
                type="range"
                min={135}
                max={185}
                step={0.5}
                value={eclssDraft.ppO2MmHg}
                onChange={(e) => setEclssDraft({ ...eclssDraft, ppO2MmHg: Number(e.target.value) })}
                className="w-full accent-sky-600"
              />
              <div className="text-[11px] text-slate-500">Safe: 148–172 mmHg</div>
            </div>

            <div className="glass-subtle rounded-xl p-3.5 space-y-1">
              <label htmlFor="eclss-o2-supply" className="text-slate-600 flex justify-between">
                <span>4. O2 Supply Reserve</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    Number(eclssDraft.o2SupplyPct ?? 92) < 60 ? "text-amber-800" : "text-slate-900"
                  }`}
                >
                  {Number(eclssDraft.o2SupplyPct ?? 92).toFixed(0)}%
                </span>
              </label>
              <input
                id="eclss-o2-supply"
                type="range"
                min={15}
                max={100}
                step={1}
                value={Number(eclssDraft.o2SupplyPct ?? 92)}
                onChange={(e) =>
                  setEclssDraft({ ...eclssDraft, o2SupplyPct: Number(e.target.value) })
                }
                className="w-full accent-sky-600"
              />
              <div className="text-[11px] text-slate-500">Reserve target: &gt;= 60%</div>
            </div>

            <div className="glass-subtle rounded-xl p-3.5 space-y-1.5">
              <label htmlFor="eclss-smoke" className="text-slate-600 block">
                5. Smoke / Fire Detector
              </label>
              <select
                id="eclss-smoke"
                value={eclssDraft.smokeFireStatus || "CLEAR"}
                onChange={(e) =>
                  setEclssDraft({
                    ...eclssDraft,
                    smokeFireStatus: e.target.value as EnvSmokeFireStatus,
                  })
                }
                className="w-full bg-white/90 border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-[11px] text-slate-900"
              >
                <option value="CLEAR">CLEAR</option>
                <option value="ADVISORY">ADVISORY (Particulate)</option>
                <option value="ALARM">ALARM (Smoke/Fire)</option>
                <option value="SENSOR_FAULT">SENSOR FAULT</option>
              </select>
            </div>

            <div className="glass-subtle rounded-xl p-3.5 space-y-1.5">
              <label htmlFor="eclss-contaminants" className="text-slate-600 block">
                6. Contaminants &amp; Trace CO
              </label>
              <select
                id="eclss-contaminants"
                value={eclssDraft.contaminantStatus || "NOMINAL"}
                onChange={(e) =>
                  setEclssDraft({
                    ...eclssDraft,
                    contaminantStatus: e.target.value as EnvContaminantStatus,
                  })
                }
                className="w-full bg-white/90 border border-slate-300 rounded-lg px-2 py-1 font-mono text-[11px] text-slate-900"
              >
                <option value="NOMINAL">NOMINAL</option>
                <option value="ELEVATED_TRACE">ELEVATED TRACE</option>
                <option value="CRITICAL_TOXIC">CRITICAL TOXIC</option>
                <option value="SENSOR_FAULT">SENSOR FAULT</option>
              </select>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Trace CO:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {eclssDraft.traceCoPpm.toFixed(1)} ppm
                </span>
              </div>
              <input
                aria-label="Trace CO ppm"
                type="range"
                min={0}
                max={12}
                step={0.2}
                value={eclssDraft.traceCoPpm}
                onChange={(e) =>
                  setEclssDraft({ ...eclssDraft, traceCoPpm: Number(e.target.value) })
                }
                className="w-full accent-sky-600"
              />
            </div>

            <div className="glass-subtle rounded-xl p-3.5 space-y-1.5">
              <label htmlFor="eclss-vent" className="text-slate-600 block">
                7. Ventilation System Status
              </label>
              <select
                id="eclss-vent"
                value={eclssDraft.ventilationStatus || "NOMINAL_FLOW"}
                onChange={(e) =>
                  setEclssDraft({
                    ...eclssDraft,
                    ventilationStatus: e.target.value as EnvVentilationStatus,
                  })
                }
                className="w-full bg-white/90 border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-[11px] text-slate-900"
              >
                <option value="NOMINAL_FLOW">NOMINAL FLOW</option>
                <option value="REDUCED_FLOW">REDUCED FLOW</option>
                <option value="BYPASS_ACTIVE">BYPASS ACTIVE</option>
                <option value="FAN_FAULT">FAN FAULT</option>
              </select>
            </div>

            <div className="glass-subtle rounded-xl p-3.5 space-y-1.5">
              <label htmlFor="eclss-health" className="text-slate-600 block">
                8. Life-Support Equipment Health
              </label>
              <select
                id="eclss-health"
                value={eclssDraft.lifeSupportHealthStatus || "OPERATIONAL"}
                onChange={(e) =>
                  setEclssDraft({
                    ...eclssDraft,
                    lifeSupportHealthStatus: e.target.value as EnvSystemHealthStatus,
                  })
                }
                className="w-full bg-white/90 border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-[11px] text-slate-900"
              >
                <option value="OPERATIONAL">OPERATIONAL</option>
                <option value="DEGRADED_ADVISORY">DEGRADED ADVISORY</option>
                <option value="FAULT_DETECTED">FAULT DETECTED</option>
                <option value="OFFLINE_UNVERIFIED">OFFLINE / UNVERIFIED</option>
              </select>
            </div>

            <div className="glass-subtle rounded-xl p-3.5 space-y-1">
              <div className="text-slate-600">Temp / RH / Scrubber</div>
              <div className="text-sm font-mono font-bold text-slate-900 tabular-nums">
                {eclssDraft.cabinTempC.toFixed(1)} °C · {eclssDraft.relativeHumidityPct.toFixed(0)}%
              </div>
              <div className="text-[11px] text-slate-600 font-mono tabular-nums">
                Water {eclssDraft.potableWaterPpm.toFixed(1)} ppm · Scrubber{" "}
                {eclssDraft.scrubberBedPct}%
              </div>
            </div>
          </div>

          {/* Deterministic Findings Table */}
          <div className="pt-3 border-t border-slate-200/70 space-y-2">
            <div className="text-xs font-semibold text-slate-900">
              Deterministic Life-Safety Environment Evaluation ({liveAssessment.findings.length}{" "}
              channels)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {liveAssessment.findings.map((f) => (
                <div
                  key={f.id}
                  className={`rounded-xl p-2.5 border ${
                    f.severity === "URGENT"
                      ? "bg-rose-50/90 border-rose-200 text-rose-950"
                      : f.severity === "ADVISORY" || f.severity === "FAULT"
                      ? "bg-amber-50/90 border-amber-200 text-amber-950"
                      : "bg-white/75 border-slate-200/80 text-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{f.parameterLabel}</span>
                    <span className="font-mono text-[10px] font-bold">{f.severity}</span>
                  </div>
                  <div className="font-mono text-[11px] font-semibold mt-0.5">{f.currentText}</div>
                  <div className="text-[11px] opacity-85 mt-0.5 leading-snug">{f.message}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Cumulative Radiation Dose Budget & Solar Storm Shelter */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-600" />
              <span>Cumulative Dose &amp; Solar Storm Shelter</span>
            </h2>
          </div>

          <div className="glass-subtle rounded-xl p-4 space-y-2 text-xs">
            <div className="flex items-baseline justify-between">
              <span className="text-slate-600">Mission Cumulative Radiation</span>
              <span className="text-xl font-mono font-bold text-slate-900 tabular-nums">
                {opsState.cumulativeRadiationMsv.toFixed(1)} / 600 mSv
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  doseBudgetPct > 70 ? "bg-amber-600" : "bg-sky-600"
                }`}
                style={{ width: `${doseBudgetPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{doseBudgetPct.toFixed(1)}% of NASA 600 mSv career limit</span>
              <button
                type="button"
                disabled={isBusy}
                onClick={() =>
                  onUpdateOpsState({
                    cumulativeRadiationMsv: Number(
                      (opsState.cumulativeRadiationMsv + 2.4).toFixed(1)
                    ),
                  })
                }
                className="text-sky-800 hover:text-sky-950 font-semibold cursor-pointer"
              >
                + Log EVA/Transit Dose (+2.4 mSv)
              </button>
            </div>
          </div>

          <div
            className={`rounded-xl p-4 border text-xs space-y-3 ${
              opsState.solarStormActive
                ? "bg-amber-50/95 border-amber-300 text-amber-950"
                : "bg-emerald-50/90 border-emerald-200 text-emerald-900"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                {opsState.solarStormActive ? (
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">
                    {opsState.solarStormActive
                      ? "▲ Solar Particle Event (SPE) Alert Active"
                      : "● Space Weather Nominal — No SPE Warning"}
                  </div>
                  <p className="mt-0.5">
                    {opsState.solarStormActive
                      ? `Proton flux rising — relocate crew inside polythene/water-wall storm shelter within ${String(stormMins).padStart(2, "0")}:${String(stormSecs).padStart(2, "0")}.`
                      : "Solar X-ray and proton monitors quiet. Test storm shelter drill anytime."}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                onUpdateOpsState({ solarStormActive: !opsState.solarStormActive })
              }
              className={`w-full py-2 px-3 rounded-xl font-semibold text-xs cursor-pointer ${
                opsState.solarStormActive
                  ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                  : "bg-amber-600 hover:bg-amber-700 text-white"
              }`}
            >
              {opsState.solarStormActive
                ? "Clear Storm Shelter Drill"
                : "Trigger Solar Storm Shelter Alert"}
            </button>
          </div>
        </div>
      </div>

      {/* Plain-English Interpretation Note (Preserved Intact) */}
      <div className="glass-panel rounded-2xl p-5 text-xs text-slate-600 leading-relaxed">
        <span className="font-semibold text-slate-900">Habitat Monitoring Note:</span> Elevated
        cabin CO2 combined with rising heart rate or fatigue triggers an informational alert so the
        crew can check scrubber filters early. Shaded light-blue regions reflect this habitat&apos;s
        14-day normal band.
      </div>

      <CuratedReferencesStrip
        title="Linked NASA & CSA Cabin Environment & Radiation References"
        topicTags={["radiation", "dosimetry", "environment"]}
      />
    </div>
  );
};


