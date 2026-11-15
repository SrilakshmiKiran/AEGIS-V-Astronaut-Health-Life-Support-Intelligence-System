import React, { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BatteryCharging,
  CheckCircle2,
  Clock,
  Droplets,
  Play,
  Pause,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { EvaSessionSummary, OpsRecordDoc } from "../types/opsContracts";
import { SafeImage } from "../components/SafeImage";
import { VISUAL_ASSETS } from "../assets/visualCatalog";

interface EvaReadinessPageProps {
  activeCrewId: string;
  activeCrewName: string;
  evaRecords: OpsRecordDoc[];
  onSaveEvaSession: (summary: EvaSessionSummary) => Promise<void>;
  onBackHome: () => void;
  isBusy: boolean;
}

export const EvaReadinessPage: React.FC<EvaReadinessPageProps> = ({
  activeCrewName,
  evaRecords,
  onSaveEvaSession,
  onBackHome,
  isBusy,
}) => {
  const [suitId, setSuitId] = useState("EMU-204-GATEWAY");
  const [preBreatheRunning, setPreBreatheRunning] = useState(false);
  const [preBreatheSecRemaining, setPreBreatheSecRemaining] = useState(45 * 60);
  const [suitPressureKpa, setSuitPressureKpa] = useState(29.6);
  const [suitPpO2MmHg, setSuitPpO2MmHg] = useState(218);
  const [suitCo2MmHg, setSuitCo2MmHg] = useState(1.2);
  const [batteryPct, setBatteryPct] = useState(96);
  const [sublimatorWaterPct, setSublimatorWaterPct] = useState(94);
  const [leakCheckPassed, setLeakCheckPassed] = useState(true);
  const [dcsGrade, setDcsGrade] = useState<EvaSessionSummary["dcsSymptomGrade"]>("NONE");
  const [notes, setNotes] = useState("Pre-breathe exercise protocol completed cleanly; gloves and helmet seals verified.");
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!preBreatheRunning) return;
    const timer = window.setInterval(() => {
      setPreBreatheSecRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [preBreatheRunning]);

  const mins = Math.floor(preBreatheSecRemaining / 60);
  const secs = preBreatheSecRemaining % 60;
  const completedMin = Math.round((45 * 60 - preBreatheSecRemaining) / 60);

  const suitHealthy =
    suitPressureKpa >= 28.5 &&
    suitPressureKpa <= 31.0 &&
    suitPpO2MmHg >= 195 &&
    suitCo2MmHg <= 3.0 &&
    batteryPct >= 80 &&
    leakCheckPassed &&
    dcsGrade === "NONE";

  const handleSave = async () => {
    setSavedBanner(null);
    await onSaveEvaSession({
      suitId,
      preBreatheTargetMin: 45,
      preBreatheCompletedMin: completedMin,
      suitPressureKpa,
      suitPpO2MmHg,
      suitCo2MmHg,
      batteryPct,
      sublimatorWaterPct,
      leakCheckPassed,
      dcsSymptomGrade: dcsGrade,
      notes,
    });
    setSavedBanner("EVA suit check and post-spacewalk symptom log saved to your private cloud history.");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-full sm:w-44 aspect-[16/10] rounded-xl overflow-hidden border border-white/80 shadow-sm shrink-0">
            <SafeImage
              src={VISUAL_ASSETS.evaSuit}
              alt="EVA spacewalk suit EMU-204 in airlock"
              caption={suitId}
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
              EVA &amp; Spacewalk Suit Readiness
            </h1>
            <p className="text-sm text-slate-600">
              Track 100% O2 pre-breathe denitrogenation, suit life-support telemetry, leak gate, and
              post-spacewalk decompression sickness (DCS) checks for {activeCrewName}.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isBusy}
          onClick={handleSave}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Save EVA Check to Cloud</span>
        </button>
      </div>

      {savedBanner && (
        <div className="p-4 rounded-2xl border bg-emerald-50/90 border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* Pre-Breathe Timer + Suit Go/No-Go */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 glass-panel rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-700" />
                <span>O2 Pre-Breathe Countdown</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Reduces blood nitrogen before depressurizing to 29.6 kPa suit pressure.
              </p>
            </div>
          </div>

          <div className="glass-subtle rounded-xl p-5 text-center space-y-3">
            <div className="text-xs font-medium text-slate-500">Time Remaining (45m Protocol)</div>
            <div className="text-4xl font-mono font-bold text-slate-900 tabular-nums">
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPreBreatheRunning(!preBreatheRunning)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {preBreatheRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{preBreatheRunning ? "Pause Timer" : "Start Pre-Breathe"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreBreatheRunning(false);
                  setPreBreatheSecRemaining(45 * 60);
                }}
                className="px-3 py-2 bg-white/85 hover:bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreBreatheRunning(false);
                  setPreBreatheSecRemaining(0);
                }}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-medium cursor-pointer"
              >
                Mark Complete
              </button>
            </div>
          </div>

          <div
            className={`rounded-xl p-4 border text-xs flex items-start gap-2.5 ${
              suitHealthy
                ? "bg-emerald-50/90 border-emerald-200 text-emerald-900"
                : "bg-amber-50/90 border-amber-200 text-amber-900"
            }`}
          >
            {suitHealthy ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold">
                {suitHealthy ? "● Suit & Crew Ready for Airlock" : "▲ Check Thresholds Before Egress"}
              </div>
              <p className="mt-0.5">
                {suitHealthy
                  ? "Suit pressure, oxygen, CO2 scrubber, battery, leak check, and DCS status are all green."
                  : "One or more suit telemetry values, leak check, or DCS symptoms require review."}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Suit Life-Support Telemetry & Post-EVA DCS */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Suit Telemetry &amp; DCS Screening</h2>
            <select
              aria-label="Select EVA Suit"
              value={suitId}
              onChange={(e) => setSuitId(e.target.value)}
              className="bg-white/85 border border-slate-300/80 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900"
            >
              <option value="EMU-204-GATEWAY">EMU-204 (Primary Airlock)</option>
              <option value="EMU-207-RESERVE">EMU-207 (Backup Suit)</option>
              <option value="ORLAN-MKS-03">xEMU-03 (Surface / Transit)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="glass-subtle rounded-xl p-3.5 space-y-1.5">
              <label htmlFor="suit-kpa" className="text-slate-600 flex items-center justify-between">
                <span>Suit Pressure</span>
                <span className="font-mono text-slate-900 font-semibold tabular-nums">
                  {suitPressureKpa.toFixed(1)} kPa
                </span>
              </label>
              <input
                id="suit-kpa"
                type="range"
                min={26}
                max={34}
                step={0.2}
                value={suitPressureKpa}
                onChange={(e) => setSuitPressureKpa(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
              <div className="text-[11px] text-slate-500">Target: 29.0–30.5 kPa</div>
            </div>

            <div className="glass-subtle rounded-xl p-3.5 space-y-1.5">
              <label htmlFor="suit-o2" className="text-slate-600 flex items-center justify-between">
                <span>Suit O2 (ppO2)</span>
                <span className="font-mono text-slate-900 font-semibold tabular-nums">
                  {suitPpO2MmHg} mmHg
                </span>
              </label>
              <input
                id="suit-o2"
                type="range"
                min={160}
                max={240}
                step={1}
                value={suitPpO2MmHg}
                onChange={(e) => setSuitPpO2MmHg(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
              <div className="text-[11px] text-slate-500">Nominal: 205–225 mmHg</div>
            </div>

            <div className="glass-subtle rounded-xl p-3.5 space-y-1.5">
              <label htmlFor="suit-co2" className="text-slate-600 flex items-center justify-between">
                <span>Suit Scrubber CO2</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    suitCo2MmHg > 3 ? "text-amber-700" : "text-slate-900"
                  }`}
                >
                  {suitCo2MmHg.toFixed(1)} mmHg
                </span>
              </label>
              <input
                id="suit-co2"
                type="range"
                min={0.5}
                max={5.0}
                step={0.1}
                value={suitCo2MmHg}
                onChange={(e) => setSuitCo2MmHg(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
              <div className="text-[11px] text-slate-500">Max safe: 3.0 mmHg</div>
            </div>

            <div className="glass-subtle rounded-xl p-3.5 space-y-1.5">
              <div className="text-slate-600 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">
                  <BatteryCharging className="w-3.5 h-3.5 text-sky-700" />
                  <span>Suit Battery</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {batteryPct}%
                </span>
              </div>
              <input
                aria-label="Suit Battery Percentage"
                type="range"
                min={40}
                max={100}
                step={1}
                value={batteryPct}
                onChange={(e) => setBatteryPct(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
            </div>

            <div className="glass-subtle rounded-xl p-3.5 space-y-1.5">
              <div className="text-slate-600 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-sky-700" />
                  <span>Cooling Water</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {sublimatorWaterPct}%
                </span>
              </div>
              <input
                aria-label="Cooling Water Percentage"
                type="range"
                min={30}
                max={100}
                step={1}
                value={sublimatorWaterPct}
                onChange={(e) => setSublimatorWaterPct(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
            </div>

            <div className="glass-subtle rounded-xl p-3.5 flex flex-col justify-between">
              <div className="text-slate-600">Airlock Leak Check</div>
              <button
                type="button"
                onClick={() => setLeakCheckPassed(!leakCheckPassed)}
                className={`mt-2 px-3 py-1.5 rounded-xl font-medium text-xs cursor-pointer border ${
                  leakCheckPassed
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                {leakCheckPassed ? "● Seal Hold Passed" : "✖ Leak Detected"}
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200/70 space-y-3 text-xs">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-sky-700" />
              <span>Post-EVA Decompression Sickness (DCS) Screening</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  { id: "NONE", label: "No Symptoms (Clear)" },
                  { id: "MILD_JOINT", label: "Mild Joint / Shoulder Ache" },
                  { id: "MODERATE_EVAL", label: "Neuro / Chest Eval Needed" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDcsGrade(opt.id)}
                  className={`p-3 rounded-xl border text-left font-medium cursor-pointer transition-colors ${
                    dcsGrade === opt.id
                      ? opt.id === "NONE"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                        : "bg-amber-50 border-amber-300 text-amber-900"
                      : "bg-white/75 border-slate-200 text-slate-700 hover:bg-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              aria-label="EVA readiness notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
              placeholder="Pre-breathe or post-EVA clinical notes..."
            />
          </div>
        </div>
      </div>

      {/* Saved EVA History */}
      <div className="glass-panel rounded-2xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Saved EVA Readiness &amp; DCS Logs ({evaRecords.length})
        </h2>
        {evaRecords.length === 0 ? (
          <p className="text-xs text-slate-500">
            No EVA suit checks saved yet. Adjust suit parameters above and save a check to record
            it in your private workspace.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Time</th>
                  <th className="py-2 px-3 font-medium">Suit &amp; Gate</th>
                  <th className="py-2 px-3 font-medium">Suit O2 / CO2</th>
                  <th className="py-2 px-3 font-medium">DCS Status</th>
                  <th className="py-2 pl-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {evaRecords.map((rec) => (
                  <tr key={rec.recordId} className="text-slate-700">
                    <td className="py-2 pr-3 font-mono text-slate-500 whitespace-nowrap">
                      {rec.timestampIso.replace("T", " ").slice(0, 16)} UTC
                    </td>
                    <td className="py-2 px-3 font-medium whitespace-nowrap">
                      {rec.title} · {rec.status}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                      {String(rec.payload.suitPpO2MmHg ?? "—")} mmHg /{" "}
                      {String(rec.payload.suitCo2MmHg ?? "—")} mmHg
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {String(rec.payload.dcsSymptomGrade || "NONE")}
                    </td>
                    <td className="py-2 pl-3 text-slate-600">{String(rec.payload.notes || "")}</td>
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
