import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  CheckSquare,
  Compass,
  Flame,
  Globe2,
  SlidersHorizontal,
  Square,
  Users,
} from "lucide-react";
import {
  ActorRole,
  BaselineProfile,
  DemoSceneId,
  InterruptedTaskSummary,
  ShiftHandoverSummaryData,
} from "../types/aegisContracts";
import { PageId } from "../types/navigation";
import {
  ACTIVITY_MODE_META,
  ActivityMode,
  COUNTERMEASURE_BADGES,
  CrewRosterMember,
  MISSION_ENVIRONMENT_META,
  MISSION_ROUTINE_TASKS,
  MissionEnvironmentId,
  OpsStateDoc,
  RoutineGamificationState,
} from "../types/opsContracts";
import { VISUAL_ASSETS } from "../assets/visualCatalog";
import { SafeImage } from "../components/SafeImage";
import { formatMissionTimeUtc } from "../utils/aegisPureEngine";

interface ShiftRoutinePageProps {
  astronautName: string;
  missionName: string;
  operatorRole: ActorRole;
  baseline: BaselineProfile;
  activeScene: DemoSceneId;
  opsState: OpsStateDoc;
  crewRoster: CrewRosterMember[];
  routineState: RoutineGamificationState;
  shiftHandover?: ShiftHandoverSummaryData;
  offlineQueueCount: number;
  isBusy: boolean;
  scenarioFeedback: string | null;
  onActivateScene: (sceneId: DemoSceneId) => Promise<void>;
  onChangeActivityMode: (mode: ActivityMode) => Promise<void>;
  onChangeEnvironment: (env: MissionEnvironmentId) => Promise<void>;
  onToggleRoutineTask: (taskId: string) => Promise<void>;
  onSelectCrewMember: (crewId: string) => Promise<void>;
  onResumeInterruptedTask?: (task: InterruptedTaskSummary) => void;
  onStartTour: () => void;
  onNavigate: (page: PageId) => void;
  onBackHome: () => void;
}

const SCENARIOS: Array<{
  id: DemoSceneId;
  label: string;
  detail: string;
}> = [
  { id: "SCENE_1_NORMAL", label: "1. Normal Day", detail: "All readings inside baseline" },
  {
    id: "SCENE_2_GRADUAL_ANOMALY",
    label: "2. CO2 & Fatigue Drift",
    detail: "CO2 rises, SpO2 dips, bad data caught",
  },
  {
    id: "SCENE_3_EXPLAIN",
    label: "3. Alert Explanation",
    detail: "Plain-English evidence & NASA links",
  },
  {
    id: "SCENE_4_EARTH_UNAVAILABLE",
    label: "4. Offline Mode",
    detail: "Earth link drops; local storage active",
  },
  {
    id: "SCENE_5_RESPONSE_FOLLOWUP",
    label: "5. Recovery Check",
    detail: "Action recorded; vitals recover",
  },
  {
    id: "SCENE_6_CONNECTIVITY_RESTORED",
    label: "6. Synced & Closed",
    detail: "Report sent to Earth & case archived",
  },
  {
    id: "SCENE_7_CONTINUITY_CMO_UNAVAILABLE",
    label: "7. CMO Unavailable",
    detail: "Earth off & CMO off; crew Continuity mode",
  },
];

type ShiftTab = "HANDOVER" | "ROUTINE" | "SCENARIOS";

export const ShiftRoutinePage: React.FC<ShiftRoutinePageProps> = ({
  astronautName,
  missionName,
  operatorRole,
  baseline,
  activeScene,
  opsState,
  crewRoster,
  routineState,
  shiftHandover,
  offlineQueueCount,
  isBusy,
  scenarioFeedback,
  onActivateScene,
  onChangeActivityMode,
  onChangeEnvironment,
  onToggleRoutineTask,
  onSelectCrewMember,
  onResumeInterruptedTask,
  onStartTour,
  onNavigate,
  onBackHome,
}) => {
  const [activeTab, setActiveTab] = useState<ShiftTab>("HANDOVER");
  const activeCrew = crewRoster.find((c) => c.crewId === opsState.activeCrewId) || crewRoster[0];
  const envMeta = MISSION_ENVIRONMENT_META[routineState.environmentMode];
  const completedTasksCount = routineState.completedTaskIds.length;
  const routinePct = Math.round((completedTasksCount / MISSION_ROUTINE_TASKS.length) * 100);

  return (
    <div className="space-y-6">
      {/* Clean Visual Hero Header */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-8 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBackHome}
              className="px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
            <span className="text-xs font-mono text-slate-600">
              {missionName} · {astronautName} ({operatorRole.replace(/_/g, " ")})
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Shift Handover, Daily Routine &amp; Mission Scenarios
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Review crew shift handover status, track daily countermeasure streaks, switch mission
              environments, or run interactive demonstration scenarios.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("HANDOVER")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                activeTab === "HANDOVER"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white/80 text-slate-700 border-slate-200 hover:bg-white"
              }`}
            >
              1. Shift Handover Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ROUTINE")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                activeTab === "ROUTINE"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white/80 text-slate-700 border-slate-200 hover:bg-white"
              }`}
            >
              2. Daily Routine ({completedTasksCount}/{MISSION_ROUTINE_TASKS.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("SCENARIOS")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                activeTab === "SCENARIOS"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white/80 text-slate-700 border-slate-200 hover:bg-white"
              }`}
            >
              3. Scenarios &amp; Crew Switcher
            </button>
            <button
              type="button"
              onClick={onStartTour}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-sky-700" />
              <span>How It Works Tour</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 aspect-[16/9] rounded-xl overflow-hidden border border-slate-200/80">
          <SafeImage
            src={VISUAL_ASSETS.shiftRoutine}
            alt="Orbital crew shift handover tablet and daily mission checklist"
            caption={`${envMeta.shortLabel} · ${routineState.streakDays}-Day Streak`}
          />
        </div>
      </div>

      {/* Tab 1: Concise Shift Handover Summary + Operational Loop */}
      {activeTab === "HANDOVER" && (
        <div className="space-y-5">
          {shiftHandover && (
            <section
              aria-label="Shift Handover Summary"
              className="glass-panel rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Shift Handover Summary
                  </h2>
                  <p className="text-xs text-slate-500">
                    Crew shift status, active incidents, parameter shifts, recorded actions,
                    outstanding tasks, and data-quality gaps.
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-700 tabular-nums">
                  Last Update: {formatMissionTimeUtc(shiftHandover.lastUpdateIso)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                {/* 1. Crew Status & Subjective Self-Report */}
                <div className="glass-subtle rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      1. Astronaut Status
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate("daily-checkin")}
                      className="text-[11px] font-semibold text-sky-800 hover:text-sky-950 cursor-pointer"
                    >
                      Check-In →
                    </button>
                  </div>
                  <div className="font-semibold text-slate-900">
                    {shiftHandover.astronautStatusHeadline}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {shiftHandover.astronautStatusDetail}
                  </p>
                  {shiftHandover.latestSubjectiveCheckin ? (
                    <div className="pt-2 border-t border-slate-200/70 space-y-1">
                      <div className="text-[10px] font-mono font-semibold text-sky-900">
                        CREW SELF-REPORT · NON-SENSOR (
                        {formatMissionTimeUtc(shiftHandover.latestSubjectiveCheckin.submittedAtIso)}
                        )
                      </div>
                      <div className="font-medium text-slate-900">
                        {shiftHandover.latestSubjectiveCheckin.statusLabel}
                      </div>
                      {shiftHandover.latestSubjectiveCheckin.note && (
                        <div className="text-[11px] text-slate-600 italic">
                          {shiftHandover.latestSubjectiveCheckin.note}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-200/70 text-[11px] text-slate-500">
                      No optional subjective crew self-report recorded yet.
                    </div>
                  )}
                </div>

                {/* 2. Active Incidents */}
                <div className="glass-subtle rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      2. Active Incidents ({shiftHandover.activeIncidents.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate("alerts-response")}
                      className="text-[11px] font-semibold text-sky-800 hover:text-sky-950 cursor-pointer"
                    >
                      Open Alerts →
                    </button>
                  </div>
                  {shiftHandover.activeIncidents.length === 0 ? (
                    <p className="text-[11px] text-emerald-800 font-medium">
                      ● No open incidents in the active handover window.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {shiftHandover.activeIncidents.slice(0, 3).map((inc) => (
                        <li
                          key={inc.incidentId}
                          className="border-b border-slate-200/60 last:border-0 pb-1.5 last:pb-0"
                        >
                          <div className="font-semibold text-slate-900 leading-snug">
                            {inc.title}
                          </div>
                          <div className="text-[11px] font-mono text-amber-800 tabular-nums mt-0.5">
                            {inc.severity} · {inc.state.replace(/_/g, " ")} ·{" "}
                            {formatMissionTimeUtc(inc.updatedAtIso)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* 3. Recent Significant Changes */}
                <div className="glass-subtle rounded-xl p-4 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    3. Recent Significant Changes
                  </div>
                  {shiftHandover.recentSignificantChanges.length === 0 ? (
                    <p className="text-[11px] text-slate-600">
                      No significant shifts since previous valid observation.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {shiftHandover.recentSignificantChanges.map((chg) => (
                        <li
                          key={chg.parameter}
                          className="border-b border-slate-200/60 last:border-0 pb-1.5 last:pb-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-900">{chg.label}</span>
                            <span
                              className={`font-mono font-semibold tabular-nums ${
                                chg.outsideBaseline || chg.freshness !== "CURRENT"
                                  ? "text-amber-800"
                                  : "text-slate-900"
                              }`}
                            >
                              {chg.latestValueText}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-600 tabular-nums">
                            {chg.deltaText}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* 4. Actions Already Recorded */}
                <div className="glass-subtle rounded-xl p-4 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    4. Actions Already Recorded
                  </div>
                  {shiftHandover.actionsRecorded.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      No intervention responses, checklist logs, or medication doses recorded yet.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {shiftHandover.actionsRecorded.map((act, idx) => (
                        <li
                          key={`${act.timestampIso}-${idx}`}
                          className="border-b border-slate-200/60 last:border-0 pb-1.5 last:pb-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-900 truncate">{act.label}</span>
                            <span className="text-[10px] font-mono text-slate-500 tabular-nums shrink-0">
                              {formatMissionTimeUtc(act.timestampIso)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 line-clamp-2">
                            {act.detail}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* 5. Outstanding & Interrupted Tasks */}
                <div className="glass-subtle rounded-xl p-4 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    5. Outstanding &amp; Resumable Tasks
                  </div>
                  {shiftHandover.outstandingTasks.length > 0 ? (
                    <ul className="space-y-2">
                      {shiftHandover.outstandingTasks.map((task) => (
                        <li
                          key={`${task.kind}-${task.taskId}`}
                          className="rounded-lg bg-amber-50/80 border border-amber-200 p-2.5 space-y-1.5"
                        >
                          <div className="font-semibold text-amber-950 leading-snug">
                            {task.title}
                          </div>
                          <div className="text-[11px] font-mono text-amber-900 tabular-nums">
                            {task.completedStepsCount}/{task.totalSteps} done · Step{" "}
                            {task.currentStepNumber} · {task.outstandingStepsCount} remaining ·{" "}
                            {formatMissionTimeUtc(task.lastUpdatedIso)}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onResumeInterruptedTask
                                ? onResumeInterruptedTask(task)
                                : onNavigate(task.targetPage)
                            }
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-md cursor-pointer"
                          >
                            Resume Task (Step {task.currentStepNumber}) →
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-slate-600">
                      No paused incident checklists or guided procedures.
                    </p>
                  )}
                  {shiftHandover.routineRemainingTitles.length > 0 && (
                    <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                      <span className="font-medium text-slate-800">
                        Remaining routine prompts ({shiftHandover.routineRemainingTitles.length}):
                      </span>{" "}
                      {shiftHandover.routineRemainingTitles.slice(0, 2).join("; ")}
                      {shiftHandover.routineRemainingTitles.length > 2 ? "…" : ""}
                    </div>
                  )}
                </div>

                {/* 6. Unresolved Data-Quality Issues & Information Gaps */}
                <div className="glass-subtle rounded-xl p-4 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    6. Data Quality &amp; Information Gaps
                  </div>
                  {shiftHandover.unresolvedDataQualityIssues.length === 0 &&
                  shiftHandover.informationGaps.length === 0 ? (
                    <p className="text-[11px] text-emerald-800 font-medium">
                      ● No unresolved data-quality flags or operational gaps detected.
                    </p>
                  ) : (
                    <ul className="space-y-1.5 text-[11px]">
                      {shiftHandover.unresolvedDataQualityIssues.map((issue, i) => (
                        <li key={`dq-${i}`} className="text-amber-900">
                          ▲ <strong>Quality:</strong> {issue}
                        </li>
                      ))}
                      {shiftHandover.informationGaps.map((gap, i) => (
                        <li key={`gap-${i}`} className="text-slate-700">
                          • <strong>Gap:</strong> {gap}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* 8-Step Operational Loop Strip */}
          <section className="glass-panel rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                AEGIS-V 8-Step Operational Loop ({baseline.window_label})
              </h2>
              <span className="text-xs text-slate-500">
                Click any stage to jump straight to that tool.
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
              {(
                [
                  { label: "1. Monitor", page: "live-vitals" },
                  { label: "2. Validate", page: "live-vitals" },
                  { label: "3. Analyze", page: "daily-checkin" },
                  { label: "4. Explain", page: "alerts-response" },
                  { label: "5. Review", page: "alerts-response" },
                  { label: "6. Respond", page: "alerts-response" },
                  { label: "7. Follow Up", page: "alerts-response" },
                  { label: "8. Archive", page: "storage-history" },
                ] as Array<{ label: string; page: PageId }>
              ).map((stage) => (
                <button
                  key={stage.label}
                  type="button"
                  onClick={() => onNavigate(stage.page)}
                  className="px-3 py-2 rounded-xl bg-white/80 hover:bg-sky-50 border border-slate-200/80 text-slate-800 font-semibold text-center cursor-pointer transition-colors"
                >
                  {stage.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Tab 2: Today's Mission Health Routine & Streaks */}
      {activeTab === "ROUTINE" && (
        <section className="glass-panel rounded-2xl p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Today&apos;s Mission Health Routine &amp; Streaks
              </h2>
              <p className="text-xs text-slate-500">
                Scheduled daily check-ins for {envMeta.shortLabel}: {envMeta.recommendedCountermeasure}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800 tabular-nums">
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                <span>{routineState.streakDays}-Day Streak</span>
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {completedTasksCount}/{MISSION_ROUTINE_TASKS.length} Prompts ({routinePct}%)
              </span>
              <span className="text-slate-300">|</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-sky-900 tabular-nums">
                <Award className="w-3.5 h-3.5 text-sky-700" />
                <span>{routineState.readinessPoints} Readiness Pts</span>
              </span>
            </div>
          </div>

          <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-600 transition-all duration-300"
              style={{ width: `${routinePct}%` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            {MISSION_ROUTINE_TASKS.map((task) => {
              const done = routineState.completedTaskIds.includes(task.taskId);
              return (
                <div
                  key={task.taskId}
                  className={`rounded-xl p-3.5 border flex flex-col justify-between gap-2.5 transition-colors ${
                    done
                      ? "bg-emerald-50/75 border-emerald-200 text-slate-900"
                      : "bg-white/80 border-slate-200/80 text-slate-800"
                  }`}
                >
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onToggleRoutineTask(task.taskId)}
                    className="flex items-start gap-2 text-left cursor-pointer"
                  >
                    {done ? (
                      <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`font-medium leading-snug ${
                        done ? "line-through text-slate-500" : "text-slate-900"
                      }`}
                    >
                      {task.title}
                    </span>
                  </button>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span className="font-mono tabular-nums">{task.windowLabel}</span>
                    <button
                      type="button"
                      onClick={() => onNavigate(task.targetPage)}
                      className="text-sky-800 hover:text-sky-950 font-semibold cursor-pointer inline-flex items-center gap-0.5"
                    >
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-2 border-t border-slate-200/60">
            <span className="font-medium text-slate-800">Unlocked Badges:</span>
            {routineState.earnedBadges.length === 0 ? (
              <span>Complete any check-in, body inspection, or PVT test to earn badges.</span>
            ) : (
              routineState.earnedBadges.map((bId) => {
                const badge = COUNTERMEASURE_BADGES.find((b) => b.badgeId === bId);
                if (!badge) return null;
                return (
                  <span key={bId} className="font-medium text-emerald-800">
                    ● {badge.label}
                  </span>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Tab 3: Crew, Environment Switcher & 7 Mission Scenarios */}
      {activeTab === "SCENARIOS" && (
        <div className="space-y-5">
          {/* Crew Member, Activity & Mission Environment Switcher */}
          <div className="glass-panel rounded-2xl p-5 space-y-4 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                <Users className="w-4 h-4 text-sky-700" />
                <span>Crew:</span>
              </div>
              <select
                aria-label="Active Crew Member"
                value={opsState.activeCrewId}
                disabled={isBusy}
                onChange={(e) => onSelectCrewMember(e.target.value)}
                className="bg-white/90 border border-slate-300/80 rounded-xl px-3 py-2 text-xs font-medium text-slate-900"
              >
                {crewRoster.map((c) => (
                  <option key={c.crewId} value={c.crewId}>
                    {c.name} ({c.role})
                  </option>
                ))}
              </select>

              <span className="font-semibold text-slate-800 ml-2">Activity:</span>
              <select
                aria-label="Activity Mode"
                value={opsState.activityMode}
                disabled={isBusy}
                onChange={(e) => onChangeActivityMode(e.target.value as ActivityMode)}
                className="bg-white/90 border border-slate-300/80 rounded-xl px-3 py-2 text-xs font-medium text-slate-900"
              >
                {(Object.keys(ACTIVITY_MODE_META) as ActivityMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {ACTIVITY_MODE_META[mode].label}
                  </option>
                ))}
              </select>

              <span className="font-semibold text-slate-800 ml-2 inline-flex items-center gap-1">
                <Globe2 className="w-4 h-4 text-sky-700" />
                <span>Environment:</span>
              </span>
              <select
                aria-label="Mission Environment"
                value={routineState.environmentMode}
                disabled={isBusy}
                onChange={(e) => onChangeEnvironment(e.target.value as MissionEnvironmentId)}
                className="bg-white/90 border border-slate-300/80 rounded-xl px-3 py-2 text-xs font-medium text-slate-900"
              >
                {(Object.keys(MISSION_ENVIRONMENT_META) as MissionEnvironmentId[]).map(
                  (envKey) => (
                    <option key={envKey} value={envKey}>
                      {MISSION_ENVIRONMENT_META[envKey].shortLabel}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-slate-600 pt-2 border-t border-slate-200/70">
              <span>
                {envMeta.gravityLabel} · {envMeta.earthDelayLabel}
              </span>
              <span>·</span>
              <span>
                Active crew:{" "}
                <strong className="font-medium text-slate-900">
                  {activeCrew?.statusNote || "Ready"}
                </strong>
              </span>
              {offlineQueueCount > 0 && (
                <span className="text-amber-800 font-medium">
                  ▲ {offlineQueueCount} queued locally
                </span>
              )}
            </div>
          </div>

          {/* Coherent 6-Stage End-to-End Mission Story Walkthrough */}
          <section className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  6-Stage End-to-End Mission Story Walkthrough (Synthetic &amp; Resettable)
                </h2>
                <p className="text-xs text-slate-600">
                  Demonstrates AEGIS-V coherently from normal orbital ops through anomaly detection,
                  urgent crew help, CMO incapacity, Earth blackout, recovery, and closure.
                </p>
              </div>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void onActivateScene("SCENE_1_NORMAL")}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 cursor-pointer"
              >
                Reset Story to Stage 1
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {(
                [
                  {
                    stage: "Stage 1 · Normal Operations",
                    detail: "All 18 personal-baseline channels nominal; sensors verified.",
                    actionLabel: "Load & View Live Vitals →",
                    scene: "SCENE_1_NORMAL" as DemoSceneId,
                    target: "live-vitals" as PageId,
                  },
                  {
                    stage: "Stage 2 · Anomaly Detected",
                    detail: "Cabin CO2 rises, SpO2 dips, faulty spike isolated, 7-part alert ready.",
                    actionLabel: "Load & Inspect Evidence →",
                    scene: "SCENE_2_GRADUAL_ANOMALY" as DemoSceneId,
                    target: "alerts-response" as PageId,
                  },
                  {
                    stage: "Stage 3 · Astronaut Needs Medical Help",
                    detail: "Launch one-tap triage guidance, red-flag checks & kit locator.",
                    actionLabel: "Open Medical Help →",
                    scene: "SCENE_3_EXPLAIN" as DemoSceneId,
                    target: "medical-help" as PageId,
                  },
                  {
                    stage: "Stage 4 · CMO Unavailable",
                    detail: "CMO marked off clinical duty; non-CMO Continuity Mode active.",
                    actionLabel: "Activate Continuity Mode →",
                    scene: "SCENE_7_CONTINUITY_CMO_UNAVAILABLE" as DemoSceneId,
                    target: "continuity" as PageId,
                  },
                  {
                    stage: "Stage 5 · Earth Comms Lost",
                    detail: "Deep-space link severed; offline guides & local IndexedDB active.",
                    actionLabel: "Simulate Earth Blackout →",
                    scene: "SCENE_4_EARTH_UNAVAILABLE" as DemoSceneId,
                    target: "reports-library" as PageId,
                  },
                  {
                    stage: "Stage 6 · Follow-Up, Recovery & Handoff",
                    detail: "Record action, review post-action direction & inspect handover.",
                    actionLabel: "Load Recovery & Handover →",
                    scene: "SCENE_5_RESPONSE_FOLLOWUP" as DemoSceneId,
                    target: "alerts-response" as PageId,
                  },
                ]
              ).map((item) => {
                const active = activeScene === item.scene;
                return (
                  <div
                    key={item.stage}
                    className={`rounded-xl border p-3.5 flex flex-col justify-between gap-2.5 ${
                      active ? "bg-sky-50/90 border-sky-300" : "bg-white/80 border-slate-200/80"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{item.stage}</div>
                      <p className="text-[11px] text-slate-600 mt-1">{item.detail}</p>
                    </div>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={async () => {
                        await onActivateScene(item.scene);
                        onNavigate(item.target);
                      }}
                      className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                    >
                      {item.actionLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 7 Interactive Mission Scenarios */}
          <section className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-sky-700" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Try a Mission Scenario
                  </h2>
                  <p className="text-xs text-slate-500">
                    Switch simulation scenarios to inspect normal ops, CO2 drift, offline storage,
                    recovery, or CMO unavailable Continuity Mode.
                  </p>
                </div>
              </div>
              {scenarioFeedback && (
                <span className="text-xs font-semibold text-sky-800">{scenarioFeedback}</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {SCENARIOS.map((sc) => {
                const isActive = activeScene === sc.id;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => onActivateScene(sc.id)}
                    className={`text-left p-4 rounded-xl border transition-colors cursor-pointer disabled:opacity-60 ${
                      isActive
                        ? "bg-sky-50/90 border-sky-300 text-slate-900"
                        : "bg-white/75 border-slate-200/80 hover:bg-white text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-semibold ${
                          isActive ? "text-sky-900" : "text-slate-900"
                        }`}
                      >
                        {sc.label}
                      </span>
                      {isActive && <CheckCircle2 className="w-4 h-4 text-sky-700 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1.5">{sc.detail}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
