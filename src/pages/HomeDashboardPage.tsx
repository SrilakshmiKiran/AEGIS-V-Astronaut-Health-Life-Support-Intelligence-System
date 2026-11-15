import React, { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Brain,
  CalendarCheck2,
  ClipboardCheck,
  Compass,
  Database,
  FileText,
  HeartPulse,
  Pill,
  Shield,
  ShieldAlert,
  Stethoscope,
  Wind,
} from "lucide-react";
import {
  ALL_18_PARAMETERS,
  ActorRole,
  BaselineProfile,
  ConsultationQueueItem,
  DemoSceneId,
  IncidentRecord,
  InterruptedTaskSummary,
  ShiftHandoverSummaryData,
  TelemetryLatestResponse,
} from "../types/aegisContracts";
import { PageId } from "../types/navigation";
import {
  ActivityMode,
  CrewRosterMember,
  ExtendedBioSummary,
  MISSION_ENVIRONMENT_META,
  MISSION_ROUTINE_TASKS,
  MissionEnvironmentId,
  OpsStateDoc,
  RoutineGamificationState,
} from "../types/opsContracts";
import { VISUAL_ASSETS } from "../assets/visualCatalog";
import { SafeImage } from "../components/SafeImage";
import { isObservationDegraded } from "../utils/aegisPureEngine";

interface HomeDashboardPageProps {
  userEmail: string | null;
  astronautName: string;
  missionName: string;
  operatorRole: ActorRole;
  baseline: BaselineProfile;
  latest: TelemetryLatestResponse;
  incidents: IncidentRecord[];
  consultationQueue: ConsultationQueueItem[];
  earthWanConnected: boolean;
  browserOnline: boolean;
  activeScene: DemoSceneId;
  totalSavedObservations: number;
  snapshotCount: number;
  opsState: OpsStateDoc;
  crewRoster: CrewRosterMember[];
  offlineQueueCount: number;
  evaLogsCount: number;
  medRecordsCount: number;
  pvtRecordsCount: number;
  routineState: RoutineGamificationState;
  extendedBio: ExtendedBioSummary | null;
  shiftHandover?: ShiftHandoverSummaryData;
  sentinelSummary?: {
    openEventsCount: number;
    checkinStatusHeadline: string;
    checkinOverdue: boolean;
    envLevel: string;
  };
  activeMedicalHelpCount?: number;
  isBusy: boolean;
  scenarioFeedback: string | null;
  onActivateScene: (sceneId: DemoSceneId) => Promise<void>;
  onChangeActivityMode: (mode: ActivityMode) => Promise<void>;
  onChangeEnvironment: (env: MissionEnvironmentId) => Promise<void>;
  onToggleRoutineTask: (taskId: string) => Promise<void>;
  onSelectCrewMember: (crewId: string) => Promise<void>;
  onResumeInterruptedTask?: (task: InterruptedTaskSummary) => void;
  onOpenMedicalHelp?: (urgentBypass?: boolean) => void;
  onStartTour: () => void;
  onNavigate: (page: PageId) => void;
}

type CardGroupFilter = "ALL" | "SAFETY" | "HEALTH" | "CREW";

interface DashboardCardItem {
  page: PageId;
  group: Exclude<CardGroupFilter, "ALL">;
  order: string;
  category: string;
  title: string;
  metric: string;
  statusText: string;
  tone: "emerald" | "amber" | "rose" | "sky";
  description: string;
  actionLabel: string;
  icon: React.FC<{ className?: string }>;
  imageSrc: string;
  imageAlt: string;
}

export const HomeDashboardPage: React.FC<HomeDashboardPageProps> = ({
  astronautName,
  missionName,
  operatorRole,
  latest,
  incidents,
  consultationQueue,
  earthWanConnected,
  browserOnline,
  activeScene,
  totalSavedObservations,
  snapshotCount,
  opsState,
  crewRoster,
  offlineQueueCount,
  evaLogsCount,
  medRecordsCount,
  pvtRecordsCount,
  routineState,
  shiftHandover,
  sentinelSummary,
  activeMedicalHelpCount = 0,
  onOpenMedicalHelp,
  onStartTour,
  onNavigate,
}) => {
  const [groupFilter, setGroupFilter] = useState<CardGroupFilter>("ALL");

  const activeCrew =
    crewRoster.find((c) => c.crewId === opsState.activeCrewId) || crewRoster[0];
  const envMeta = MISSION_ENVIRONMENT_META[routineState.environmentMode];
  const completedTasksCount = routineState.completedTaskIds.length;

  const openIncidents = incidents.filter((i) => i.state !== "CLOSED_RETAINED");
  const activeIncident = openIncidents[0] || incidents[0];
  const validCount =
    (latest.quality_counts.VALID || 0) + (latest.quality_counts.ESTIMATED || 0);
  const degradedCount =
    (latest.quality_counts.STALE || 0) +
    (latest.quality_counts.MISSING || 0) +
    (latest.quality_counts.IMPOSSIBLE || 0) +
    (latest.quality_counts.CORRUPTED || 0);
  const isolatedCount = latest.quarantined_recent.length;

  const presentCount = ALL_18_PARAMETERS.filter((p) => {
    const obs = latest.latest_by_parameter[p];
    return Boolean(obs && !isObservationDegraded(obs));
  }).length;

  const outsideCount = ALL_18_PARAMETERS.filter((p) => {
    const obs = latest.latest_by_parameter[p];
    if (!obs || isObservationDegraded(obs)) return false;
    return Boolean(latest.baseline_comparisons[p]?.outside_p05_p95_band);
  }).length;

  const telemetryIncomplete =
    totalSavedObservations === 0 || presentCount < ALL_18_PARAMETERS.length || degradedCount > 0;

  const overallStatus: {
    label: string;
    tone: "emerald" | "amber";
  } =
    totalSavedObservations === 0 || presentCount === 0
      ? { label: "Telemetry Missing", tone: "amber" }
      : openIncidents.length > 0
      ? {
          label: `${openIncidents.length} Open Alert${openIncidents.length > 1 ? "s" : ""}`,
          tone: "amber",
        }
      : telemetryIncomplete
      ? { label: `${presentCount}/${ALL_18_PARAMETERS.length} Valid`, tone: "amber" }
      : outsideCount > 0
      ? { label: `${outsideCount} Baseline Watch`, tone: "amber" }
      : { label: "All 18 Channels Nominal", tone: "emerald" };

  const hrComp = latest.baseline_comparisons.heart_rate_bpm;
  const spo2Comp = latest.baseline_comparisons.spo2_pct;
  const sleepComp = latest.baseline_comparisons.sleep_duration_hrs;
  const hydrationComp = latest.baseline_comparisons.hydration_ml;
  const co2Comp = latest.baseline_comparisons.cabin_co2_mmhg;
  const radComp = latest.baseline_comparisons.radiation_msv_hr;

  const totalStoredRecords =
    totalSavedObservations + incidents.length + consultationQueue.length + snapshotCount;
  const pendingReports = consultationQueue.filter((q) => q.sync_status !== "SYNCED").length;
  const outstandingTasksCount = shiftHandover?.outstandingTasks.length || 0;

  const envHeroImage =
    routineState.environmentMode === "ISS_LEO"
      ? VISUAL_ASSETS.heroOrbital
      : routineState.environmentMode === "TRANSIT_SPACECRAFT"
      ? VISUAL_ASSETS.cardEarth
      : VISUAL_ASSETS.envHabitat;

  const cards: DashboardCardItem[] = [
    // Group 1: Safety & Immediate Help
    {
      page: "medical-help",
      group: "SAFETY",
      order: "01",
      category: "First-Response Aid",
      title: "Medical Help & Triage",
      metric:
        activeMedicalHelpCount > 0
          ? `${activeMedicalHelpCount} Active Guidance Case${activeMedicalHelpCount > 1 ? "s" : ""}`
          : "22 Injury & Symptom Guides",
      statusText: "● Works offline · Step-by-step aid",
      tone: activeMedicalHelpCount > 0 ? "rose" : "emerald",
      description:
        "Answer quick tap questions, check red-flag signs, find kit gear, and escalate.",
      actionLabel: "Open Medical Help",
      icon: HeartPulse,
      imageSrc: VISUAL_ASSETS.medicalHelp,
      imageAlt: "Orbital emergency medical kit and first-aid guidance tablet",
    },
    {
      page: "life-safety",
      group: "SAFETY",
      order: "02",
      category: "Crew Protection",
      title: "Life-Safety Sentinel",
      metric:
        sentinelSummary && sentinelSummary.openEventsCount > 0
          ? `${sentinelSummary.openEventsCount} Active Safety Event`
          : `Env: ${sentinelSummary?.envLevel || "NORMAL"}`,
      statusText: sentinelSummary?.checkinOverdue
        ? "▲ Scheduled check-in overdue"
        : "● Check-in & emergency watch active",
      tone:
        sentinelSummary && (sentinelSummary.openEventsCount > 0 || sentinelSummary.checkinOverdue)
          ? "rose"
          : "emerald",
      description:
        "Emergency responder workflow, check-in supervision, and emergency gear locator.",
      actionLabel: "Open Sentinel",
      icon: ShieldAlert,
      imageSrc: VISUAL_ASSETS.lifeSafety,
      imageAlt: "Spacecraft cabin life-safety pressure and oxygen sentinel panel",
    },
    {
      page: "continuity",
      group: "SAFETY",
      order: "03",
      category: "Earth-Independent Ops",
      title: "Continuity Mode",
      metric:
        activeScene === "SCENE_7_CONTINUITY_CMO_UNAVAILABLE"
          ? "CMO Unavailable Active"
          : "Non-CMO Operator Support",
      statusText: earthWanConnected
        ? "● Earth link on · Continuity ready"
        : "▲ Earth offline · Autonomous mode",
      tone:
        activeScene === "SCENE_7_CONTINUITY_CMO_UNAVAILABLE" || !earthWanConnected
          ? "amber"
          : "sky",
      description:
        "Crew skill board, offline guided checklists, and structured Earth handoff packages.",
      actionLabel: "Open Continuity Mode",
      icon: Shield,
      imageSrc: VISUAL_ASSETS.continuityMode,
      imageAlt: "Spacecraft continuity workstation displaying offline checklists",
    },

    // Group 2: Health, Vitals & Shift Operations
    {
      page: "live-vitals",
      group: "HEALTH",
      order: "04",
      category: "Continuous Sensors",
      title: "Live Vitals & Quality Filter",
      metric: hrComp
        ? `${hrComp.current_value.toFixed(0)} bpm · ${spo2Comp ? spo2Comp.current_value.toFixed(1) : "—"}% SpO2`
        : "8 Live Channels",
      statusText:
        isolatedCount > 0
          ? `▲ ${validCount} valid · ${isolatedCount} isolated`
          : `● ${validCount} valid sensor readings`,
      tone: isolatedCount > 0 ? "amber" : "emerald",
      description:
        "Inspect live 8-channel charts, last-known-good values, and sensor quality flags.",
      actionLabel: "Open Live Vitals",
      icon: Activity,
      imageSrc: VISUAL_ASSETS.liveVitals,
      imageAlt: "Astronaut biometric chest monitor and pulse oximeter",
    },
    {
      page: "daily-checkin",
      group: "HEALTH",
      order: "05",
      category: "Crew Input & Scans",
      title: "Daily Check-In",
      metric: sleepComp
        ? `${sleepComp.current_value.toFixed(1)}h sleep · ${hydrationComp ? hydrationComp.current_value.toFixed(0) : "—"} mL`
        : "10 Daily Inputs",
      statusText:
        outsideCount > 0
          ? `▲ ${outsideCount} channel${outsideCount > 1 ? "s" : ""} outside baseline`
          : `● ${presentCount}/${ALL_18_PARAMETERS.length} channels verified`,
      tone: outsideCount > 0 || telemetryIncomplete ? "amber" : "emerald",
      description:
        "Log quick self-report, sleep, hydration, glucose, voice memos, and scans.",
      actionLabel: "Open Check-In",
      icon: ClipboardCheck,
      imageSrc: VISUAL_ASSETS.dailyCheckin,
      imageAlt: "Portable ultrasound probe, thermometer, and glucose meter",
    },
    {
      page: "alerts-response",
      group: "HEALTH",
      order: "06",
      category: "Evidence & Recovery",
      title: "Alerts & Response",
      metric: activeIncident ? activeIncident.title : "No Active Alerts",
      statusText:
        activeIncident && activeIncident.state !== "CLOSED_RETAINED"
          ? `▲ Step: ${activeIncident.state.replace(/_/g, " ").toLowerCase()}`
          : "● All incidents reviewed or closed",
      tone: activeIncident && activeIncident.state !== "CLOSED_RETAINED" ? "amber" : "emerald",
      description:
        "View 7-part plain-English alert evidence, checklists, and recovery trends.",
      actionLabel: "Open Alerts",
      icon: AlertTriangle,
      imageSrc: VISUAL_ASSETS.cardVitals,
      imageAlt: "Astronaut health console displaying baseline alert thresholds",
    },
    {
      page: "shift-routine",
      group: "HEALTH",
      order: "07",
      category: "Handover & Routine",
      title: "Shift, Routine & Scenarios",
      metric: `${completedTasksCount}/${MISSION_ROUTINE_TASKS.length} Routine · ${routineState.streakDays}d Streak`,
      statusText:
        outstandingTasksCount > 0
          ? `▲ ${outstandingTasksCount} paused task${outstandingTasksCount > 1 ? "s" : ""} to resume`
          : `● ${envMeta.shortLabel} · Handover ready`,
      tone: outstandingTasksCount > 0 ? "amber" : "sky",
      description:
        "Full shift handover board, daily countermeasure streaks, and mission scenarios.",
      actionLabel: "Open Shift & Routine",
      icon: CalendarCheck2,
      imageSrc: VISUAL_ASSETS.shiftRoutine,
      imageAlt: "Astronaut digital shift handover logbook and hydration pack",
    },
    {
      page: "cabin-radiation",
      group: "HEALTH",
      order: "08",
      category: "Habitat Environment",
      title: "Cabin Air & Radiation",
      metric: co2Comp
        ? `${co2Comp.current_value.toFixed(2)} mmHg CO2 · ${radComp ? radComp.current_value.toFixed(3) : "—"} mSv/hr`
        : "CO2, Pressure & O2",
      statusText:
        co2Comp?.outside_p05_p95_band || radComp?.outside_p05_p95_band
          ? "▲ Above normal cabin band"
          : "● Cabin pressure & air nominal",
      tone:
        co2Comp?.outside_p05_p95_band || radComp?.outside_p05_p95_band ? "amber" : "emerald",
      description:
        "Monitor CO2, cabin pressure, oxygen supply, smoke sensors, and radiation.",
      actionLabel: "Open Cabin & Air",
      icon: Wind,
      imageSrc: VISUAL_ASSETS.cabinEclss,
      imageAlt: "Space station air-scrubber life support module",
    },
    {
      page: "reports-library",
      group: "HEALTH",
      order: "09",
      category: "Base Sync & Guides",
      title: "Base Reports & Library",
      metric: `${consultationQueue.length} Saved Report${consultationQueue.length !== 1 ? "s" : ""}`,
      statusText: earthWanConnected
        ? pendingReports > 0
          ? `● Link online · ${pendingReports} waiting`
          : "● Link online · Queue clear"
        : "▲ Earth offline · Queued locally",
      tone: earthWanConnected ? "emerald" : "amber",
      description:
        "Send Flight Surgeon reports, export JSON/Markdown, and search NASA/CSA guides.",
      actionLabel: "Open Reports & Library",
      icon: FileText,
      imageSrc: VISUAL_ASSETS.cardEarth,
      imageAlt: "Earth horizon seen from sunlit spacecraft cabin",
    },

    // Group 3: Crew Readiness & Records
    {
      page: "body-map",
      group: "CREW",
      order: "10",
      category: "Anatomy & Hazards",
      title: "Body Map & 5 Hazards",
      metric: "7 Body Systems · 5 Hazards",
      statusText: "● Interactive organ health guide",
      tone: "sky",
      description:
        "Tap body regions to inspect organ baselines, hazards, and protective actions.",
      actionLabel: "Open Body Map",
      icon: Stethoscope,
      imageSrc: VISUAL_ASSETS.bodyAtlas,
      imageAlt: "Medical tablet displaying translucent astronaut anatomy",
    },
    {
      page: "eva-readiness",
      group: "CREW",
      order: "11",
      category: "Spacewalk Airlock",
      title: "EVA & Suit Readiness",
      metric: `45m Pre-Breathe · ${evaLogsCount} Log${evaLogsCount !== 1 ? "s" : ""}`,
      statusText: "● Suit pressure & DCS checklist",
      tone: "sky",
      description:
        "Run O2 pre-breathe timers, verify suit scrubbers, and log post-EVA checks.",
      actionLabel: "Open EVA Readiness",
      icon: Shield,
      imageSrc: VISUAL_ASSETS.evaSuit,
      imageAlt: "White exploration EVA spacesuit in orbital airlock",
    },
    {
      page: "med-kit",
      group: "CREW",
      order: "12",
      category: "Crew Pharmacy",
      title: "Med Kit & Supplies",
      metric: `${medRecordsCount} Tracked Suppl${medRecordsCount !== 1 ? "ies" : "y"}`,
      statusText: "● Stock, doses & expiry checks",
      tone: "sky",
      description:
        "Track onboard medications, log countermeasures, and confirm kit equipment.",
      actionLabel: "Open Med Kit",
      icon: Pill,
      imageSrc: VISUAL_ASSETS.medKit,
      imageAlt: "Organized orbital medical kit with vials and cuffs",
    },
    {
      page: "cognitive-readiness",
      group: "CREW",
      order: "13",
      category: "Alertness & Mood",
      title: "Cognitive & Behavioral",
      metric: `5-Trial PVT · ${pvtRecordsCount} Check${pvtRecordsCount !== 1 ? "s" : ""}`,
      statusText: "● Reaction time & circadian cycle",
      tone: "sky",
      description:
        "Run millisecond PVT reaction checks and maintain private orbital mood logs.",
      actionLabel: "Open Cognitive Check",
      icon: Brain,
      imageSrc: VISUAL_ASSETS.cognitive,
      imageAlt: "Astronaut crew workstation with circadian lighting",
    },
    {
      page: "storage-history",
      group: "CREW",
      order: "14",
      category: "Private Cloud Memory",
      title: "Cloud Storage & Sync",
      metric: `${totalStoredRecords} Records · ${snapshotCount} Snapshots`,
      statusText:
        offlineQueueCount > 0
          ? `▲ ${offlineQueueCount} offline write(s) waiting`
          : browserOnline
          ? "● Private Firestore synced"
          : "▲ Offline IndexedDB queue",
      tone: offlineQueueCount > 0 || !browserOnline ? "amber" : "sky",
      description:
        "Manage profile & role access, export backups, and flush offline sync queue.",
      actionLabel: "Open Cloud Storage",
      icon: Database,
      imageSrc: VISUAL_ASSETS.heroOrbital,
      imageAlt: "Orbital habitat observation cupola and data archive",
    },
  ];

  const filteredCards =
    groupFilter === "ALL" ? cards : cards.filter((c) => c.group === groupFilter);

  return (
    <div className="space-y-5">
      {/* Compact Mission Header + Urgent Medical Actions + Visual */}
      <section className="glass-panel rounded-2xl p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-8 space-y-3.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
            <span className="font-semibold text-sky-900">{missionName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-slate-900">
              {astronautName} ({activeCrew?.role || operatorRole.replace(/_/g, " ")})
            </span>
            <span aria-hidden="true">·</span>
            <span
              className={`font-semibold ${
                overallStatus.tone === "emerald" ? "text-emerald-800" : "text-amber-800"
              }`}
            >
              {overallStatus.tone === "emerald" ? "● " : "▲ "}
              {overallStatus.label}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[11px]">
              Earth: {earthWanConnected ? "ON" : "OFF"} ·{" "}
              {browserOnline ? "Cloud Online" : "Offline Queue"}
            </span>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              AEGIS-V Crew Workspace
            </h1>
            <p className="text-sm text-slate-600">
              Tap any card below to open a clean, dedicated page for that tool—or start urgent
              medical guidance right away.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
            <button
              type="button"
              onClick={() =>
                onOpenMedicalHelp ? onOpenMedicalHelp(false) : onNavigate("medical-help")
              }
              className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <HeartPulse className="w-4 h-4 text-rose-300 shrink-0" />
              <span>I NEED MEDICAL HELP</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onOpenMedicalHelp ? onOpenMedicalHelp(true) : onNavigate("medical-help")
              }
              className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>URGENT EMERGENCY</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate("shift-routine")}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/85 hover:bg-white border border-slate-200 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <CalendarCheck2 className="w-3.5 h-3.5 text-sky-700" />
              <span>Shift Handover &amp; Scenarios</span>
            </button>

            <button
              type="button"
              onClick={onStartTour}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-sky-50/90 hover:bg-sky-100 border border-sky-200 text-xs font-semibold text-sky-900 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-sky-700" />
              <span>Tour</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 aspect-[16/9] rounded-xl overflow-hidden border border-slate-200/80">
          <SafeImage
            src={envHeroImage}
            alt={envMeta.label}
            caption={`${envMeta.shortLabel} · ${envMeta.gravityLabel}`}
          />
        </div>
      </section>

      {/* Clean Ordered Category Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "ALL", label: `All Tools (${cards.length})` },
              { id: "SAFETY", label: "Help & Safety (3)" },
              { id: "HEALTH", label: "Health & Shift (6)" },
              { id: "CREW", label: "Crew & Storage (5)" },
            ] as Array<{ id: CardGroupFilter; label: string }>
          ).map((tab) => {
            const active = groupFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGroupFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white/80 text-slate-700 border-slate-200/90 hover:bg-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <span className="text-xs text-slate-500">
          Every card opens a fresh, dedicated workspace page.
        </span>
      </div>

      {/* Neat, Uniform, Visually Rich Click-to-Open Card Grid */}
      <section
        aria-label="AEGIS-V Workspace Cards"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
      >
        {filteredCards.map((card) => {
          const Icon = card.icon;
          const statusCls =
            card.tone === "rose"
              ? "text-rose-700"
              : card.tone === "amber"
              ? "text-amber-700"
              : card.tone === "emerald"
              ? "text-emerald-700"
              : "text-sky-700";

          return (
            <button
              key={card.page}
              type="button"
              onClick={() => onNavigate(card.page)}
              className="glass-card-interactive rounded-2xl overflow-hidden text-left flex flex-col justify-between cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <div className="w-full">
                <div className="aspect-[16/9] w-full overflow-hidden border-b border-slate-200/70">
                  <SafeImage src={card.imageSrc} alt={card.imageAlt} />
                </div>

                <div className="p-4 sm:p-5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-semibold text-slate-500">
                      {card.order} · {card.category}
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-sky-50/90 border border-sky-100 flex items-center justify-center text-sky-700 shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      {card.title}
                    </h2>
                    <p className="text-xs font-mono font-semibold text-slate-800 tabular-nums mt-0.5 truncate">
                      {card.metric}
                    </p>
                    <p className={`text-xs font-medium mt-0.5 ${statusCls}`}>{card.statusText}</p>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                    {card.description}
                  </p>
                </div>
              </div>

              <div className="px-4 sm:px-5 py-3 border-t border-slate-200/70 w-full flex items-center justify-between text-xs font-semibold text-sky-800">
                <span>{card.actionLabel}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </div>
            </button>
          );
        })}
      </section>
    </div>
  );
};
