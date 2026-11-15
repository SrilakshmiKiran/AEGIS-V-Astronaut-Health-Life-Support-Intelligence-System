import React, { useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Play,
  Stethoscope,
  X,
} from "lucide-react";
import { DemoSceneId } from "../types/aegisContracts";
import { PageId } from "../types/navigation";
import { MissionEnvironmentId } from "../types/opsContracts";

interface InteractiveOnboardingTourProps {
  activePage: PageId;
  activeScene: DemoSceneId;
  environmentMode: MissionEnvironmentId;
  isBusy: boolean;
  onNavigate: (page: PageId) => void;
  onActivateScene: (sceneId: DemoSceneId) => Promise<void>;
  onChangeEnvironment: (env: MissionEnvironmentId) => Promise<void>;
  onCompleteTour: () => Promise<void>;
}

interface TourStepDef {
  index: number;
  shortLabel: string;
  title: string;
  targetPage: PageId;
  plainExplanation: string;
  tryHint: string;
}

const TOUR_STEPS: TourStepDef[] = [
  {
    index: 0,
    shortLabel: "1. Environment & Drift",
    title: "Step 1 of 5 · Pick Your Mission Environment & Test Live Scenarios",
    targetPage: "home",
    plainExplanation:
      "AEGIS-V compares 18 astronaut vitals and cabin air metrics against a personal 14-day normal range. Try switching to Mars Surface or simulating CO2 & Fatigue Drift to see your live gauges respond.",
    tryHint: "Try clicking one of the interactive buttons below, then inspect the dashboard.",
  },
  {
    index: 1,
    shortLabel: "2. Body Map & Hazards",
    title: "Step 2 of 5 · Clickable Crew Body Map & NASA 5 Hazards",
    targetPage: "body-map",
    plainExplanation:
      "Not sure what a spaceflight measurement means? Click any organ system (Brain, Eyes/SANS, Heart, Lungs, Bones, Kidneys, Skin) on the anatomical figure to read why the exam is needed and how NASA's 5 hazards affect it.",
    tryHint: "On the Body Map below, click Eyes (SANS) or Heart & BP to inspect live guidance.",
  },
  {
    index: 2,
    shortLabel: "3. Check-In, Voice & Scans",
    title: "Step 3 of 5 · Log Daily Vitals, Blood Sugar, Voice Memos & Scans",
    targetPage: "daily-checkin",
    plainExplanation:
      "Log sleep, fluid intake, Blood Sugar (mg/dL), and Core Body Temp (°C). You can also record 45-second Voice Memos and capture live Camera or Ultrasound photos—all kept private to your Google account.",
    tryHint: "Try adjusting Blood Sugar or recording a short Voice Observation Memo below.",
  },
  {
    index: 3,
    shortLabel: "4. Alerts & AI Triage",
    title: "Step 4 of 5 · Evidence-Backed Alerts & Autonomous AI Triage",
    targetPage: "alerts-response",
    plainExplanation:
      "When an indicator leaves your personal normal range, Alerts & Response walks you through a 7-part plain-English explanation and emergency checklist. Under Mars signal delays, Doctor Reports & Library includes an AI Triage Helper.",
    tryHint: "Switch between Alerts & Response and the AI Triage Helper below.",
  },
  {
    index: 4,
    shortLabel: "5. Routine & Streaks",
    title: "Step 5 of 5 · Complete Today's Mission Routine & Earn Streaks",
    targetPage: "home",
    plainExplanation:
      "Your Home Dashboard shows 5 timed daily health prompts, readiness points, and countermeasure badges. Completing check-ins, Med Kit doses, or PVT reaction tests updates your progress automatically.",
    tryHint: "Click Finish Guide whenever you are ready—you can replay this tour anytime from Home.",
  },
];

export const InteractiveOnboardingTour: React.FC<InteractiveOnboardingTourProps> = ({
  activePage,
  activeScene,
  environmentMode,
  isBusy,
  onNavigate,
  onActivateScene,
  onChangeEnvironment,
  onCompleteTour,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [triedActions, setTriedActions] = useState<string[]>([]);

  const step = TOUR_STEPS[stepIndex] || TOUR_STEPS[0];
  const progressPct = Math.round(((stepIndex + 1) / TOUR_STEPS.length) * 100);

  const markTried = (key: string) => {
    setTriedActions((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const goToStep = (nextIdx: number) => {
    const clamped = Math.max(0, Math.min(TOUR_STEPS.length - 1, nextIdx));
    setStepIndex(clamped);
    const target = TOUR_STEPS[clamped].targetPage;
    if (activePage !== target) {
      onNavigate(target);
    }
  };

  return (
    <section
      aria-label="First-Time Interactive Walkthrough"
      className="glass-panel rounded-2xl p-5 sm:p-6 mb-6 border border-sky-300/80 space-y-4"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-800">
            <Compass className="w-4 h-4 text-sky-700 shrink-0" />
            <span>First-Time Interactive Guide · {progressPct}% Complete</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">{step.title}</h2>
        </div>

        <button
          type="button"
          onClick={() => void onCompleteTour()}
          className="px-3 py-1.5 bg-white/80 hover:bg-white border border-slate-200/80 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
        >
          <X className="w-3.5 h-3.5" />
          <span>Skip Guide</span>
        </button>
      </div>

      {/* Stepper Bar */}
      <div className="space-y-2">
        <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-600 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {TOUR_STEPS.map((s) => {
            const isCurrent = s.index === stepIndex;
            const isPast = s.index < stepIndex;
            return (
              <button
                key={s.shortLabel}
                type="button"
                onClick={() => goToStep(s.index)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  isCurrent
                    ? "bg-slate-900 text-white border-slate-900"
                    : isPast
                    ? "bg-emerald-50/90 text-emerald-900 border-emerald-200"
                    : "bg-white/70 text-slate-600 border-slate-200/80 hover:bg-white"
                }`}
              >
                {isPast ? `✓ ${s.shortLabel}` : s.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Explanation + Hands-On Try Controls */}
      <div className="glass-subtle rounded-xl p-4 space-y-3">
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{step.plainExplanation}</p>

        {/* Step-Specific Live Interactive Sandbox Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {stepIndex === 0 && (
            <>
              <button
                type="button"
                disabled={isBusy}
                onClick={async () => {
                  await onChangeEnvironment("MARS_ROVER");
                  markTried("env-mars");
                }}
                className="px-3 py-2 bg-white hover:bg-sky-50 border border-sky-200 text-sky-950 font-medium rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5 text-sky-700" />
                <span>
                  {environmentMode === "MARS_ROVER" || triedActions.includes("env-mars")
                    ? "✓ Switched to Mars Base (0.38g)"
                    : "Try: Switch to Mars Base (0.38g)"}
                </span>
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={async () => {
                  await onActivateScene("SCENE_2_GRADUAL_ANOMALY");
                  markTried("scene-drift");
                }}
                className="px-3 py-2 bg-white hover:bg-amber-50 border border-amber-200 text-amber-950 font-medium rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Activity className="w-3.5 h-3.5 text-amber-700" />
                <span>
                  {activeScene === "SCENE_2_GRADUAL_ANOMALY" || triedActions.includes("scene-drift")
                    ? "✓ CO2 & Fatigue Drift Active"
                    : "Try: Simulate CO2 & Fatigue Drift"}
                </span>
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={async () => {
                  await onActivateScene("SCENE_1_NORMAL");
                  await onChangeEnvironment("ISS_LEO");
                  markTried("reset-normal");
                }}
                className="px-3 py-2 bg-white/80 hover:bg-white border border-slate-200 text-slate-700 rounded-xl cursor-pointer whitespace-nowrap"
              >
                Reset to Normal Space Station
              </button>
            </>
          )}

          {stepIndex === 1 && (
            <>
              <button
                type="button"
                onClick={() => {
                  onNavigate("body-map");
                  markTried("open-body");
                }}
                className="px-3 py-2 bg-white hover:bg-sky-50 border border-sky-200 text-sky-950 font-medium rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Stethoscope className="w-3.5 h-3.5 text-sky-700" />
                <span>
                  {activePage === "body-map"
                    ? "✓ Body Atlas Open Below"
                    : "Open Interactive Body Map"}
                </span>
              </button>
              <span className="text-slate-500">
                Click any organ hotspot or NASA 5-Hazards tab below to explore it live.
              </span>
            </>
          )}

          {stepIndex === 2 && (
            <>
              <button
                type="button"
                onClick={() => {
                  onNavigate("daily-checkin");
                  markTried("open-checkin");
                }}
                className="px-3 py-2 bg-white hover:bg-sky-50 border border-sky-200 text-sky-950 font-medium rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5 text-sky-700" />
                <span>
                  {activePage === "daily-checkin"
                    ? "✓ Daily Check-In Open Below"
                    : "Open Daily Check-In & Scans"}
                </span>
              </button>
              <span className="text-slate-500">
                Scroll down to test Blood Sugar, Core Temp, Voice Memos, or Camera Scan Capture.
              </span>
            </>
          )}

          {stepIndex === 3 && (
            <>
              <button
                type="button"
                onClick={() => {
                  onNavigate("alerts-response");
                  markTried("open-alerts");
                }}
                className={`px-3 py-2 border rounded-xl font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activePage === "alerts-response"
                    ? "bg-sky-50 border-sky-300 text-sky-950"
                    : "bg-white hover:bg-sky-50 border-slate-200 text-slate-800"
                }`}
              >
                <span>{activePage === "alerts-response" ? "✓ Alerts Open" : "View Alerts & Checklist"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate("reports-library");
                  markTried("open-ai");
                }}
                className={`px-3 py-2 border rounded-xl font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activePage === "reports-library"
                    ? "bg-sky-50 border-sky-300 text-sky-950"
                    : "bg-white hover:bg-sky-50 border-slate-200 text-slate-800"
                }`}
              >
                <span>
                  {activePage === "reports-library"
                    ? "✓ AI Triage & Reports Open"
                    : "Try Autonomous AI Triage Helper"}
                </span>
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={async () => {
                  await onActivateScene("SCENE_7_CONTINUITY_CMO_UNAVAILABLE");
                  onNavigate("continuity");
                  markTried("open-continuity");
                }}
                className={`px-3 py-2 border rounded-xl font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activePage === "continuity"
                    ? "bg-amber-50 border-amber-300 text-amber-950"
                    : "bg-white hover:bg-amber-50 border-slate-200 text-slate-800"
                }`}
              >
                <span>
                  {activePage === "continuity"
                    ? "✓ Continuity Mode Open"
                    : "Try: CMO Unavailable (Continuity Mode)"}
                </span>
              </button>
            </>
          )}

          {stepIndex === 4 && (
            <>
              <button
                type="button"
                onClick={() => onNavigate("home")}
                className="px-3 py-2 bg-white hover:bg-sky-50 border border-sky-200 text-sky-950 font-medium rounded-xl cursor-pointer whitespace-nowrap"
              >
                {activePage === "home"
                  ? "✓ Home Routine & Streaks Visible Below"
                  : "Return to Home Dashboard"}
              </button>
              <span className="text-slate-500">{step.tryHint}</span>
            </>
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <span className="text-xs text-slate-500">{step.tryHint}</span>

        <div className="flex items-center gap-2 shrink-0">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={() => goToStep(stepIndex - 1)}
              className="px-3.5 py-2 bg-white/85 hover:bg-white border border-slate-300/80 text-slate-800 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
          )}

          {stepIndex < TOUR_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => goToStep(stepIndex + 1)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onCompleteTour()}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Finish Guide</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
