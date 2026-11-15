import React, { useState } from "react";
import { CheckCircle2, ClipboardCheck, Eye, Moon, Utensils, ShieldAlert } from "lucide-react";
import {
  ALL_18_PARAMETERS,
  BaselineProfile,
  NutritionCatalogueItem,
  PARAMETER_METADATA,
  ParameterName,
  QualityStatus,
  TelemetryHistoryResponse,
  TelemetryLatestResponse,
} from "../types/aegisContracts";
import { CONFIGURED_PROTOTYPE_RULES } from "../mocks/cloudPreviewFixtures";
import {
  DataSourceBadge,
  InformationBadge,
  QualityBadge,
} from "../components/InformationBadge";

interface HealthIntelligencePageProps {
  baseline: BaselineProfile;
  latest: TelemetryLatestResponse;
  histories: Partial<Record<ParameterName, TelemetryHistoryResponse>>;
  nutritionCatalogue: NutritionCatalogueItem[];
  onSubmitCheckin: (
    entries: Array<{
      parameter: ParameterName;
      value: number;
      quality_status?: QualityStatus;
      notes?: string;
    }>
  ) => Promise<void>;
  checkinFeedback: { ok: boolean; message: string } | null;
}

type HrpTabId = "ARCHER_SLEEP" | "FLUID_EYE_SANS" | "NUTRITION_FOOD";

export const HealthIntelligencePage: React.FC<HealthIntelligencePageProps> = ({
  baseline,
  latest,
  histories,
  nutritionCatalogue,
  onSubmitCheckin,
  checkinFeedback,
}) => {
  const [activeHrpTab, setActiveHrpTab] = useState<HrpTabId>("ARCHER_SLEEP");

  // Form states for Section B: Sleep, Activity & Well-being (ARCheR)
  const [sleepDuration, setSleepDuration] = useState<string>("6.5");
  const [sleepQuality, setSleepQuality] = useState<string>("7.0");
  const [exercisePct, setExercisePct] = useState<string>("85");
  const [fatigueScore, setFatigueScore] = useState<string>("4.5");

  // Form states for Section C: Fluid-Shift & Eye Health (SANS)
  const [visualSymptoms, setVisualSymptoms] = useState<string>("1.0");
  const [iopMmhg, setIopMmhg] = useState<string>("15.8");
  const [thighCuffPct, setThighCuffPct] = useState<string>("95");

  // Form states for Section D: Nutrition & Food Physiology
  const [selectedMealId, setSelectedMealId] = useState<string>(
    nutritionCatalogue[0]?.meal_id || "MEAL-ISS-STD-01"
  );
  const [caloricIntake, setCaloricIntake] = useState<string>("2650");
  const [hydrationMl, setHydrationMl] = useState<string>("2380");
  const [appetiteScore, setAppetiteScore] = useState<string>("7.5");

  const handleMealSelect = (mealId: string) => {
    setSelectedMealId(mealId);
    const meal = nutritionCatalogue.find((m) => m.meal_id === mealId);
    if (meal) {
      setCaloricIntake(String(meal.caloric_intake_kcal));
      setHydrationMl(String(meal.hydration_ml));
    }
  };

  const handleSleepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmitCheckin([
      { parameter: "sleep_duration_hrs", value: Number(sleepDuration) },
      { parameter: "sleep_quality_score", value: Number(sleepQuality) },
      { parameter: "exercise_completion_pct", value: Number(exercisePct) },
      { parameter: "fatigue_score", value: Number(fatigueScore) },
    ]);
  };

  const handleFluidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmitCheckin([
      { parameter: "visual_symptom_severity", value: Number(visualSymptoms) },
      {
        parameter: "intraocular_pressure_mmhg",
        value: Number(iopMmhg),
        notes: "CMO clinical tonometry entry",
      },
      { parameter: "thigh_cuff_adherence_pct", value: Number(thighCuffPct) },
    ]);
  };

  const handleNutritionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmitCheckin([
      {
        parameter: "caloric_intake_kcal",
        value: Number(caloricIntake),
        quality_status: "ESTIMATED",
        notes: `Spaceflight Food Catalogue (${selectedMealId})`,
      },
      { parameter: "hydration_ml", value: Number(hydrationMl) },
      { parameter: "appetite_score", value: Number(appetiteScore) },
    ]);
  };

  const get3DaySeries = (param: ParameterName) => {
    const obs = histories[param]?.observations || [];
    return obs.slice(-3);
  };

  return (
    <div className="space-y-6">
      {/* SUBSECTION A: 14-Day Personal Health Baseline Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">
                A. 14-Day Personal Health Baseline ({baseline.full_name})
              </h2>
              <InformationBadge type="COMPUTED" />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Window: <span className="font-mono text-slate-300">{baseline.window_label}</span> ·
              Compares latest readings against individualized Mean, Standard Deviation (σ), and
              P05–P95 normal reference band.
            </p>
          </div>
          <span className="text-xs font-mono text-amber-300">
            Calibration: {baseline.calibration_status}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 pr-3">Parameter</th>
                <th className="py-2 px-3">Category</th>
                <th className="py-2 px-3">Mean</th>
                <th className="py-2 px-3">Std Dev (σ)</th>
                <th className="py-2 px-3">P05–P95 Reference Band</th>
                <th className="py-2 px-3">Target</th>
                <th className="py-2 px-3">Current Reading</th>
                <th className="py-2 px-3">Z-Score / Delta</th>
                <th className="py-2 pl-3">Band Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {ALL_18_PARAMETERS.map((param) => {
                const metric = baseline.metrics[param];
                const meta = PARAMETER_METADATA[param];
                const comp = latest.baseline_comparisons[param];
                const obs = latest.latest_by_parameter[param];
                if (!metric || !comp || !obs) return null;

                const isOut = comp.outside_p05_p95_band;

                return (
                  <tr key={param} className="hover:bg-slate-900/50">
                    <td className="py-2 pr-3 font-sans font-medium text-slate-100 whitespace-nowrap">
                      {meta.label}{" "}
                      <span className="font-mono text-[11px] text-slate-400">({param})</span>
                    </td>
                    <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{meta.category}</td>
                    <td className="py-2 px-3 text-slate-200 tabular-nums whitespace-nowrap">
                      {metric.mean} {metric.unit}
                    </td>
                    <td className="py-2 px-3 text-slate-300 tabular-nums whitespace-nowrap">
                      ±{metric.std}
                    </td>
                    <td className="py-2 px-3 text-cyan-300 tabular-nums whitespace-nowrap">
                      [{metric.p05} – {metric.p95}] {metric.unit}
                    </td>
                    <td className="py-2 px-3 text-slate-400 tabular-nums whitespace-nowrap">
                      {metric.authorized_target != null
                        ? `${metric.authorized_target} ${metric.unit}`
                        : "—"}
                    </td>
                    <td
                      className={`py-2 px-3 font-bold tabular-nums whitespace-nowrap ${
                        isOut ? "text-amber-300" : "text-white"
                      }`}
                    >
                      {comp.current_value.toFixed(meta.decimals)} {metric.unit}
                    </td>
                    <td
                      className={`py-2 px-3 tabular-nums whitespace-nowrap ${
                        isOut ? "text-amber-300" : "text-slate-300"
                      }`}
                    >
                      {comp.absolute_delta >= 0 ? "+" : ""}
                      {comp.absolute_delta.toFixed(meta.decimals)} ({comp.z_score >= 0 ? "+" : ""}
                      {comp.z_score}σ)
                    </td>
                    <td className="py-2 pl-3 whitespace-nowrap">
                      {isOut ? (
                        <span className="text-amber-300 font-semibold">▲ OUTSIDE P05–P95</span>
                      ) : (
                        <span className="text-emerald-300">● WITHIN BAND</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUBSECTIONS B, C, D: Tabbed NASA HRP Health Research Modules & Manual Check-In Forms */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">
                B / C / D. NASA HRP Health Context Modules &amp; Crew Check-In
              </h2>
              <InformationBadge type="MEASURED" />
              <InformationBadge type="COMPUTED" />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Select a research category tab below to inspect multi-day trends and log manual crew
              or CMO observations.
            </p>
          </div>

          {/* Interactive Segmented Tabs */}
          <div
            role="tablist"
            aria-label="NASA HRP Health Research Categories"
            className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeHrpTab === "ARCHER_SLEEP"}
              onClick={() => setActiveHrpTab("ARCHER_SLEEP")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeHrpTab === "ARCHER_SLEEP"
                  ? "bg-cyan-500 text-slate-950 font-semibold"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>B. Sleep, Activity &amp; Well-being (ARCheR)</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeHrpTab === "FLUID_EYE_SANS"}
              onClick={() => setActiveHrpTab("FLUID_EYE_SANS")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeHrpTab === "FLUID_EYE_SANS"
                  ? "bg-cyan-500 text-slate-950 font-semibold"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>C. Fluid-Shift &amp; Eye Health</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeHrpTab === "NUTRITION_FOOD"}
              onClick={() => setActiveHrpTab("NUTRITION_FOOD")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeHrpTab === "NUTRITION_FOOD"
                  ? "bg-cyan-500 text-slate-950 font-semibold"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>D. Nutrition &amp; Food Physiology</span>
            </button>
          </div>
        </div>

        {checkinFeedback && (
          <div
            className={`p-3 rounded border text-xs font-mono flex items-center gap-2 ${
              checkinFeedback.ok
                ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                : "bg-rose-950/40 border-rose-500/50 text-rose-300"
            }`}
          >
            {checkinFeedback.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 shrink-0" />
            )}
            <span>{checkinFeedback.message}</span>
          </div>
        )}

        {/* TAB B: Sleep, Activity & Well-being (ARCheR) */}
        {activeHrpTab === "ARCHER_SLEEP" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Sleep, Activity &amp; Well-being (NASA ARCheR Context)
                </h3>
                <span className="text-xs font-mono text-cyan-400">RULE-ARCHER-SLEEP-FATIGUE-05</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(
                  [
                    "sleep_duration_hrs",
                    "sleep_quality_score",
                    "exercise_completion_pct",
                    "fatigue_score",
                  ] as ParameterName[]
                ).map((param) => {
                  const obs = latest.latest_by_parameter[param];
                  const comp = latest.baseline_comparisons[param];
                  const meta = PARAMETER_METADATA[param];
                  const metric = baseline.metrics[param];
                  if (!obs || !comp) return null;

                  return (
                    <div
                      key={param}
                      className="bg-slate-900/90 border border-slate-800 rounded p-3 flex flex-col justify-between"
                    >
                      <span className="text-xs text-slate-300 font-medium">{meta.label}</span>
                      <div className="my-2 flex items-baseline gap-1">
                        <span
                          className={`text-xl font-mono font-bold tabular-nums ${
                            comp.outside_p05_p95_band ? "text-amber-300" : "text-white"
                          }`}
                        >
                          {obs.value}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{meta.unit}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        P05–P95: {metric.p05}–{metric.p95}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded p-3 space-y-1.5 text-xs">
                <div className="font-mono font-semibold text-amber-300">
                  Combined-Signal Rule Evaluation (RULE-ARCHER-SLEEP-FATIGUE-05):
                </div>
                <p className="text-slate-300">
                  Sleep duration has been below the astronaut&apos;s recent baseline for three
                  consecutive days (
                  {get3DaySeries("sleep_duration_hrs")
                    .map((o) => `${o.value} hrs`)
                    .join(" → ")}
                   vs. 7.5 hrs target). Reported fatigue has increased while exercise completion has
                  decreased. Review workload, sleep conditions and recovery measures.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSleepSubmit}
              className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-cyan-400" />
                  <span>Manual ARCheR Check-In Form</span>
                </h4>
                <DataSourceBadge source="MANUAL_ENTRY" />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="chk-sleep-hrs" className="block text-slate-300 mb-1">
                    Sleep Duration (hrs, Target 7.5)
                  </label>
                  <input
                    id="chk-sleep-hrs"
                    type="number"
                    step="0.1"
                    min="0"
                    max="16"
                    value={sleepDuration}
                    onChange={(e) => setSleepDuration(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-white"
                  />
                </div>
                <div>
                  <label htmlFor="chk-sleep-qual" className="block text-slate-300 mb-1">
                    Sleep Quality (1–10)
                  </label>
                  <input
                    id="chk-sleep-qual"
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={sleepQuality}
                    onChange={(e) => setSleepQuality(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-white"
                  />
                </div>
                <div>
                  <label htmlFor="chk-exercise-pct" className="block text-slate-300 mb-1">
                    Exercise Completion (%)
                  </label>
                  <input
                    id="chk-exercise-pct"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={exercisePct}
                    onChange={(e) => setExercisePct(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-white"
                  />
                </div>
                <div>
                  <label htmlFor="chk-fatigue-score" className="block text-slate-300 mb-1">
                    Fatigue Score (1–10)
                  </label>
                  <input
                    id="chk-fatigue-score"
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={fatigueScore}
                    onChange={(e) => setFatigueScore(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded transition-colors"
              >
                Record Sleep &amp; Well-Being Check-In
              </button>
            </form>
          </div>
        )}

        {/* TAB C: Fluid-Shift & Eye Health */}
        {activeHrpTab === "FLUID_EYE_SANS" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Fluid-Shift &amp; Eye Health Monitoring (NASA SANS / Thigh-Cuff Context)
                </h3>
                <span className="text-xs font-mono text-cyan-400">RULE-FLUID-EYE-SANS-06</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    "visual_symptom_severity",
                    "intraocular_pressure_mmhg",
                    "thigh_cuff_adherence_pct",
                  ] as ParameterName[]
                ).map((param) => {
                  const obs = latest.latest_by_parameter[param];
                  const comp = latest.baseline_comparisons[param];
                  const meta = PARAMETER_METADATA[param];
                  const metric = baseline.metrics[param];
                  if (!obs || !comp) return null;

                  return (
                    <div
                      key={param}
                      className="bg-slate-900/90 border border-slate-800 rounded p-3 flex flex-col justify-between"
                    >
                      <span className="text-xs text-slate-300 font-medium">{meta.label}</span>
                      <div className="my-2 flex items-baseline gap-1">
                        <span
                          className={`text-xl font-mono font-bold tabular-nums ${
                            comp.outside_p05_p95_band ? "text-amber-300" : "text-white"
                          }`}
                        >
                          {obs.value}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{meta.unit}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Baseline: {metric.mean} [{metric.p05}–{metric.p95}]
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded p-3 space-y-1.5 text-xs">
                <div className="font-mono font-semibold text-amber-300">
                  Combined-Signal Rule Evaluation (RULE-FLUID-EYE-SANS-06):
                </div>
                <p className="text-slate-300">
                  Visual symptoms have been reported on two consecutive check-ins. The latest
                  recorded measurement differs from the astronaut&apos;s baseline (14.5 mmHg).
                  Review the trend and follow the mission medical protocol.
                </p>
                <p className="text-amber-300/90 font-mono text-[11px]">
                  Non-Diagnostic Scope Notice: Does not infer intracranial pressure (ICP) or
                  diagnose an eye disorder from symptoms or tonometry alone.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleFluidSubmit}
              className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-cyan-400" />
                  <span>Fluid-Shift &amp; Tonometry Check-In</span>
                </h4>
                <span className="text-[11px] font-mono text-amber-300">CMO + PIN 2026 Required</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label htmlFor="chk-vis-symp" className="block text-slate-300 mb-1">
                    Visual Symptom Severity (0–10)
                  </label>
                  <input
                    id="chk-vis-symp"
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={visualSymptoms}
                    onChange={(e) => setVisualSymptoms(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-white"
                  />
                </div>
                <div>
                  <label htmlFor="chk-iop" className="block text-slate-300 mb-1">
                    Intraocular Pressure — IOP (mmHg, Baseline 14.5 mmHg)
                  </label>
                  <input
                    id="chk-iop"
                    type="number"
                    step="0.1"
                    min="5"
                    max="40"
                    value={iopMmhg}
                    onChange={(e) => setIopMmhg(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-white"
                  />
                </div>
                <div>
                  <label htmlFor="chk-thigh-cuff" className="block text-slate-300 mb-1">
                    Thigh Cuff Countermeasure Adherence (%)
                  </label>
                  <input
                    id="chk-thigh-cuff"
                    type="number"
                    step="5"
                    min="0"
                    max="100"
                    value={thighCuffPct}
                    onChange={(e) => setThighCuffPct(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded transition-colors"
              >
                Record Fluid-Shift &amp; Eye Check-In
              </button>
            </form>
          </div>
        )}

        {/* TAB D: Nutrition & Food Physiology */}
        {activeHrpTab === "NUTRITION_FOOD" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Nutrition &amp; Food Physiology (OCHMO-TB-013 Context)
                </h3>
                <span className="text-xs font-mono text-cyan-400">RULE-NUTRITION-HYDRATION-07</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(
                  ["caloric_intake_kcal", "hydration_ml", "appetite_score"] as ParameterName[]
                ).map((param) => {
                  const obs = latest.latest_by_parameter[param];
                  const comp = latest.baseline_comparisons[param];
                  const meta = PARAMETER_METADATA[param];
                  const metric = baseline.metrics[param];
                  if (!obs || !comp) return null;

                  return (
                    <div
                      key={param}
                      className="bg-slate-900/90 border border-slate-800 rounded p-3 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs text-slate-300 font-medium">{meta.label}</span>
                        <QualityBadge status={obs.quality_status} />
                      </div>
                      <div className="my-2 flex items-baseline gap-1">
                        <span
                          className={`text-xl font-mono font-bold tabular-nums ${
                            comp.outside_p05_p95_band ? "text-amber-300" : "text-white"
                          }`}
                        >
                          {obs.value}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{meta.unit}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Target: {metric.authorized_target ?? metric.mean} {meta.unit}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded p-3 space-y-1.5 text-xs">
                <div className="font-mono font-semibold text-amber-300">
                  Combined-Signal Rule Evaluation (RULE-NUTRITION-HYDRATION-07):
                </div>
                <p className="text-slate-300">
                  Recorded energy intake has remained below the assigned target (2800 kcal / 2500 mL
                  hydration) for two days, with reduced appetite reported. Fatigue is also elevated.
                  Review the food plan and hydration record with the mission health team.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleNutritionSubmit}
              className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-cyan-400" />
                  <span>Nutrition &amp; Hydration Check-In</span>
                </h4>
                <QualityBadge status="ESTIMATED" />
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label htmlFor="chk-meal-pack" className="block text-slate-300 mb-1">
                    Spaceflight Food Catalogue Quick Selector
                  </label>
                  <select
                    id="chk-meal-pack"
                    value={selectedMealId}
                    onChange={(e) => handleMealSelect(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-white"
                  >
                    {nutritionCatalogue.map((m) => (
                      <option key={m.meal_id} value={m.meal_id}>
                        {m.name} ({m.caloric_intake_kcal} kcal / {m.hydration_ml} mL)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="chk-kcal" className="block text-slate-300 mb-1">
                      Calories (kcal)
                    </label>
                    <input
                      id="chk-kcal"
                      type="number"
                      step="50"
                      value={caloricIntake}
                      onChange={(e) => setCaloricIntake(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 font-mono text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="chk-hyd" className="block text-slate-300 mb-1">
                      Hydration (mL)
                    </label>
                    <input
                      id="chk-hyd"
                      type="number"
                      step="50"
                      value={hydrationMl}
                      onChange={(e) => setHydrationMl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 font-mono text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="chk-appetite" className="block text-slate-300 mb-1">
                      Appetite (1–10)
                    </label>
                    <input
                      id="chk-appetite"
                      type="number"
                      step="0.5"
                      min="1"
                      max="10"
                      value={appetiteScore}
                      onChange={(e) => setAppetiteScore(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 font-mono text-white"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded transition-colors"
              >
                Record Nutrition &amp; Hydration Check-In
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Configured Prototype Rules Catalogue Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                Configured Deterministic Anomaly &amp; HRP Combined-Signal Rules (7 Rules)
              </h3>
              <InformationBadge type="COMPUTED" />
            </div>
            <p className="text-xs text-slate-400">
              100% transparent, reproducible mathematical rule definitions — no black-box alert
              triggering.
            </p>
          </div>
          <span className="text-xs font-mono text-amber-300">
            Demo Rule Logic — Not a Clinical Threshold
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 pr-3">Rule ID</th>
                <th className="py-2 px-3">Rule Name</th>
                <th className="py-2 px-3">Severity</th>
                <th className="py-2 px-3">Category</th>
                <th className="py-2 pl-3">Deterministic Trigger Formula</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {CONFIGURED_PROTOTYPE_RULES.map((rule) => (
                <tr key={rule.rule_id} className="text-slate-200">
                  <td className="py-2 pr-3 text-cyan-300 font-semibold whitespace-nowrap">
                    {rule.rule_id}
                  </td>
                  <td className="py-2 px-3 font-sans font-medium text-white">{rule.rule_name}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span
                      className={
                        rule.severity === "HIGH"
                          ? "text-rose-300 font-semibold"
                          : rule.severity === "MODERATE"
                          ? "text-amber-300 font-semibold"
                          : "text-cyan-300"
                      }
                    >
                      {rule.severity}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{rule.category}</td>
                  <td className="py-2 pl-3 text-slate-300">{rule.deterministic_formula}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
