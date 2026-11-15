import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Brain, CheckCircle2, Play, SunMoon, Timer } from "lucide-react";
import { OpsRecordDoc, PvtResultSummary } from "../types/opsContracts";
import { SafeImage } from "../components/SafeImage";
import { VISUAL_ASSETS } from "../assets/visualCatalog";

interface CognitiveReadinessPageProps {
  activeCrewName: string;
  pvtRecords: OpsRecordDoc[];
  onSavePvtResult: (summary: PvtResultSummary) => Promise<void>;
  onBackHome: () => void;
  isBusy: boolean;
}

type PvtStage = "IDLE" | "WAITING" | "STIMULUS" | "DONE";

export const CognitiveReadinessPage: React.FC<CognitiveReadinessPageProps> = ({
  activeCrewName,
  pvtRecords,
  onSavePvtResult,
  onBackHome,
  isBusy,
}) => {
  const [stage, setStage] = useState<PvtStage>("IDLE");
  const [trialResults, setTrialResults] = useState<number[]>([]);
  const [moodScore, setMoodScore] = useState(4);
  const [stressScore, setStressScore] = useState(2);
  const [journalNote, setJournalNote] = useState(
    "Focused during habitat shift; keeping bright blue-enriched lighting on for daytime alertness."
  );
  const [falseStartNote, setFalseStartNote] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const stimulusShownAtRef = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);
  const totalTrials = 5;

  // 90-minute orbital daylight/night cycle indicator
  const nowMinutes = new Date().getUTCMinutes() + (new Date().getUTCHours() % 2) * 60;
  const orbitMinute = nowMinutes % 90;
  const inSunlitPhase = orbitMinute < 54;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const scheduleNextStimulus = () => {
    setStage("WAITING");
    setFalseStartNote(null);
    const delayMs = 1100 + Math.floor(Math.random() * 1900);
    timeoutRef.current = window.setTimeout(() => {
      stimulusShownAtRef.current = performance.now();
      setStage("STIMULUS");
    }, delayMs);
  };

  const handleStartTest = () => {
    setTrialResults([]);
    setSavedBanner(null);
    scheduleNextStimulus();
  };

  const handleReactionTap = () => {
    if (stage === "WAITING") {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      setFalseStartNote("Early tap — wait until the target turns bright blue, then tap.");
      scheduleNextStimulus();
      return;
    }
    if (stage === "STIMULUS") {
      const rt = Math.round(performance.now() - stimulusShownAtRef.current);
      const updated = [...trialResults, rt];
      setTrialResults(updated);
      if (updated.length >= totalTrials) {
        setStage("DONE");
      } else {
        scheduleNextStimulus();
      }
    }
  };

  const meanRt =
    trialResults.length > 0
      ? Math.round(trialResults.reduce((a, b) => a + b, 0) / trialResults.length)
      : 278;
  const fastestRt = trialResults.length > 0 ? Math.min(...trialResults) : 242;
  const lapses = trialResults.filter((ms) => ms > 500).length;

  const handleSaveSession = async () => {
    await onSavePvtResult({
      meanRtMs: meanRt,
      fastestRtMs: fastestRt,
      lapsesCount: lapses,
      trialsCount: trialResults.length || totalTrials,
      moodScore,
      stressScore,
      orbitalCycleNote: inSunlitPhase
        ? `Orbital Day (min ${orbitMinute}/90)`
        : `Orbital Eclipse (min ${orbitMinute}/90)`,
      journalNote,
    });
    setSavedBanner("Cognitive PVT score and behavioral wellness check-in saved to your private cloud.");
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-full sm:w-44 aspect-[16/10] rounded-xl overflow-hidden border border-white/80 shadow-sm shrink-0">
            <SafeImage
              src={VISUAL_ASSETS.cognitive}
              alt="Orbital crew circadian workstation with Earth view"
              caption="Circadian & Vigilance"
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
              Cognitive Readiness &amp; Behavioral Check-In
            </h1>
            <p className="text-sm text-slate-600">
              5-trial reaction-time Psychomotor Vigilance Test (PVT), orbital circadian cue, and
              private mood check-in for {activeCrewName}.
            </p>
          </div>
        </div>

        <div className="glass-subtle rounded-xl px-4 py-2.5 text-xs flex items-center gap-2 shrink-0">
          <SunMoon className="w-4 h-4 text-sky-700" />
          <div>
            <div className="font-semibold text-slate-900">
              {inSunlitPhase ? "Orbital Daylight Window" : "Orbital Eclipse Window"}
            </div>
            <div className="text-slate-500 font-mono tabular-nums">
              Orbit minute {orbitMinute} of 90 · Keep circadian cabin schedule
            </div>
          </div>
        </div>
      </div>

      {savedBanner && (
        <div className="p-4 rounded-2xl border bg-emerald-50/90 border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive PVT Reaction Time Widget */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Timer className="w-4 h-4 text-sky-700" />
              <span>Reaction-Time Vigilance Test (5 Trials)</span>
            </h2>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              Trial {Math.min(trialResults.length + (stage === "DONE" ? 0 : 1), totalTrials)} / {totalTrials}
            </span>
          </div>

          <button
            type="button"
            onClick={stage === "IDLE" || stage === "DONE" ? handleStartTest : handleReactionTap}
            className={`w-full h-44 rounded-2xl border transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer ${
              stage === "STIMULUS"
                ? "bg-sky-600 border-sky-700 text-white"
                : stage === "WAITING"
                ? "bg-amber-50/90 border-amber-200 text-amber-900"
                : "bg-white/75 border-slate-200 hover:bg-white text-slate-900"
            }`}
          >
            {stage === "IDLE" && (
              <>
                <Play className="w-6 h-6 text-sky-700" />
                <span className="text-sm font-semibold">Tap to Start 5-Trial Reaction Test</span>
                <span className="text-xs text-slate-500">
                  Measures alertness against CO2 fatigue or sleep loss
                </span>
              </>
            )}
            {stage === "WAITING" && (
              <>
                <span className="text-base font-semibold">Hold steady — wait for blue cue...</span>
                <span className="text-xs">Do not tap until the box turns blue</span>
              </>
            )}
            {stage === "STIMULUS" && (
              <>
                <span className="text-2xl font-bold">TAP NOW!</span>
                <span className="text-xs text-sky-100">Recording millisecond response</span>
              </>
            )}
            {stage === "DONE" && (
              <>
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                <span className="text-base font-semibold">
                  Test Complete — Avg {meanRt} ms ({lapses} lapse{lapses !== 1 ? "s" : ""})
                </span>
                <span className="text-xs text-slate-500">Tap here to run again</span>
              </>
            )}
          </button>

          {falseStartNote && <p className="text-xs text-amber-700">{falseStartNote}</p>}

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="glass-subtle rounded-xl p-3">
              <div className="text-slate-500">Average RT</div>
              <div className="text-xl font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                {meanRt} ms
              </div>
            </div>
            <div className="glass-subtle rounded-xl p-3">
              <div className="text-slate-500">Fastest Trial</div>
              <div className="text-xl font-mono font-bold text-emerald-700 tabular-nums mt-0.5">
                {fastestRt} ms
              </div>
            </div>
            <div className="glass-subtle rounded-xl p-3">
              <div className="text-slate-500">Lapses (&gt;500 ms)</div>
              <div
                className={`text-xl font-mono font-bold tabular-nums mt-0.5 ${
                  lapses > 0 ? "text-amber-700" : "text-slate-900"
                }`}
              >
                {lapses}
              </div>
            </div>
          </div>
        </div>

        {/* Behavioral Mood & Stress Journal */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Brain className="w-4 h-4 text-sky-700" />
            <span>Private Behavioral Health &amp; Mood Check-In</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="glass-subtle rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Mood &amp; Focus (1–5)</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">{moodScore} / 5</span>
              </div>
              <input
                aria-label="Mood score"
                type="range"
                min={1}
                max={5}
                step={1}
                value={moodScore}
                onChange={(e) => setMoodScore(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
            </div>

            <div className="glass-subtle rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Workload Stress (1–5)</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">{stressScore} / 5</span>
              </div>
              <input
                aria-label="Workload stress score"
                type="range"
                min={1}
                max={5}
                step={1}
                value={stressScore}
                onChange={(e) => setStressScore(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <label htmlFor="behav-journal" className="font-medium text-slate-700">
              Private Crew Reflection (Stored encrypted in your personal account only)
            </label>
            <textarea
              id="behav-journal"
              rows={3}
              value={journalNote}
              onChange={(e) => setJournalNote(e.target.value)}
              className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
            />
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={handleSaveSession}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Save Cognitive &amp; Mood Check-In to Cloud
          </button>
        </div>
      </div>

      {/* Saved Cognitive History */}
      <div className="glass-panel rounded-2xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Saved Cognitive Readiness History ({pvtRecords.length})
        </h2>
        {pvtRecords.length === 0 ? (
          <p className="text-xs text-slate-500">
            No cognitive tests saved yet. Complete the reaction-time test above and save your check-in.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Time</th>
                  <th className="py-2 px-3 font-medium">Avg Reaction</th>
                  <th className="py-2 px-3 font-medium">Lapses</th>
                  <th className="py-2 px-3 font-medium">Mood / Stress</th>
                  <th className="py-2 pl-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {pvtRecords.map((rec) => (
                  <tr key={rec.recordId} className="text-slate-700">
                    <td className="py-2 pr-3 font-mono text-slate-500 whitespace-nowrap">
                      {rec.timestampIso.replace("T", " ").slice(0, 16)} UTC
                    </td>
                    <td className="py-2 px-3 font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {String(rec.payload.meanRtMs ?? "—")} ms
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                      {String(rec.payload.lapsesCount ?? 0)}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                      Mood {String(rec.payload.moodScore ?? "—")}/5 · Stress{" "}
                      {String(rec.payload.stressScore ?? "—")}/5
                    </td>
                    <td className="py-2 pl-3 text-slate-600">
                      {String(rec.payload.journalNote || "")}
                    </td>
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
