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
import { formatMissionTimeUtc, isObservationDegraded } from "../utils/aegisPureEngine";

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

type CardGroupFilter =
  | "ALL"
  | "HEALTH_INTELLIGENCE"
  | "HELP_SAFETY"
  | "CREW_CONTINUITY"
  | "EVIDENCE_RESEARCH";

interface DashboardCardItem {
  page: PageId;
  group: Exclude<CardGroupFilter, "ALL">;
  groupLabel: string;
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
    tone: "emerald" | "amber" | "rose";
  } =
    sentinelSummary && sentinelSummary.openEventsCount > 0
      ? {
          label: `${sentinelSummary.openEventsCount} Emergency/Welfare Event`,
          tone: "rose",
        }
      : totalSavedObservations === 0 || presentCount === 0
      ? { label: "Telemetry Missing", tone: "amber" }
      : openIncidents.length > 0
      ? {
          label: `${openIncidents.length} Open Alert${openIncidents.length > 1 ? "s" : ""}`,
          tone: "amber",
        }
      : telemetryIncomplete
      ? { label: `${presentCount}/${ALL_18_PARAMETERS.length} Channels Valid`, tone: "amber" }
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

  const latestObservationIso =
    shiftHandover?.lastUpdateIso ||
    ALL_18_PARAMETERS.map((p) => latest.latest_by_parameter[p]?.timestamp)
      .filter((t): t is string => Boolean(t))
      .sort()
      .reverse()[0] ||
    null;

  const envHeroImage =
    routineState.environmentMode === "ISS_LEO"
      ? VISUAL_ASSETS.heroOrbital
      : routineState.environmentMode === "TRANSIT_SPACECRAFT"
      ? VISUAL_ASSETS.cardEarth
      : VISUAL_ASSETS.envHabitat;

  const sentinelTierLabel =
    sentinelSummary && sentinelSummary.openEventsCount > 0
      ? "EMERGENCY"
      : sentinelSummary?.envLevel === "URGENT" || sentinelSummary?.checkinOverdue
      ? "WARNING"
      : sentinelSummary?.envLevel === "ADVISORY" || sentinelSummary?.envLevel === "FAULT"
      ? "CAUTION"
      : openIncidents.length > 0
      ? "ADVISORY"
      : "INFORMATIONAL";

  const cards: DashboardCardItem[] = [
    // Group A — Health Intelligence
    {
      page: "live-vitals",
      group: "HEALTH_INTELLIGENCE",
      groupLabel: "Group A · Health Intelligence",
      order: "01",
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
      group: "HEALTH_INTELLIGENCE",
      groupLabel: "Group A · Health Intelligence",
      order: "02",
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
      page: "cabin-radiation",
      group: "HEALTH_INTELLIGENCE",
      groupLabel: "Group A · Health Intelligence",
      order: "03",
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
      page: "cognitive-readiness",
      group: "HEALTH_INTELLIGENCE",
      groupLabel: "Group A · Health Intelligence",
      order: "04",
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

    // Group B — Help & Safety
    {
      page: "medical-help",
      group: "HELP_SAFETY",
      groupLabel: "Group B · Help & Safety",
      order: "05",
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
      group: "HELP_SAFETY",
      groupLabel: "Group B · Help & Safety",
      order: "06",
      category: "Crew Protection",
      title: "Life-Safety Sentinel",
      metric:
        sentinelSummary && sentinelSummary.openEventsCount > 0
          ? `${sentinelSummary.openEventsCount} Active Safety Event`
          : `Priority: ${sentinelTierLabel}`,
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
      page: "alerts-response",
      group: "HELP_SAFETY",
      groupLabel: "Group B · Help & Safety",
      order: "07",
      category: "Alert Handling",
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

    // Group C — Crew & Continuity
    {
      page: "continuity",
      group: "CREW_CONTINUITY",
      groupLabel: "Group C · Crew & Continuity",
      order: "08",
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
    {
      page: "shift-routine",
      group: "CREW_CONTINUITY",
      groupLabel: "Group C · Crew & Continuity",
      order: "09",
      category: "Handover & Walkthroughs",
      title: "Shift, Routine & Scenarios",
      metric: `${completedTasksCount}/${MISSION_ROUTINE_TASKS.length} Routine · ${routineState.streakDays}d Streak`,
      statusText:
        outstandingTasksCount > 0
          ? `▲ ${outstandingTasksCount} paused task${outstandingTasksCount > 1 ? "s" : ""} to resume`
          : `● ${envMeta.shortLabel} · Handover & 6-scene demo ready`,
      tone: outstandingTasksCount > 0 ? "amber" : "sky",
      description:
        "Full shift handover board, countermeasure streaks, and 6-scene mission demo.",
      actionLabel: "Open Shift & Routine",
      icon: CalendarCheck2,
      imageSrc: VISUAL_ASSETS.shiftRoutine,
      imageAlt: "Astronaut digital shift handover logbook and hydration pack",
    },
    {
      page: "eva-readiness",
      group: "CREW_CONTINUITY",
      groupLabel: "Group C · Crew & Continuity",
      order: "10",
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
      group: "CREW_CONTINUITY",
      groupLabel: "Group C · Crew & Continuity",
      order: "11",
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

    // Group D — Evidence & Research
    {
      page: "reports-library",
      group: "EVIDENCE_RESEARCH",
      groupLabel: "Group D · Evidence & Research",
      order: "12",
      category: "Base Sync & Research",
      title: "Base Reports & Library",
      metric: `${consultationQueue.length} Saved Report${consultationQueue.length !== 1 ? "s" : ""}`,
      statusText: earthWanConnected
        ? pendingReports > 0
          ? `● Link online · ${pendingReports} waiting`
          : "● Link online · Queue clear"
        : "▲ Earth offline · Queued locally",
      tone: earthWanConnected ? "emerald" : "amber",
      description:
        "Send Flight Surgeon reports, export JSON/Markdown, and search NASA/CSA literature.",
      actionLabel: "Open Reports & Library",
      icon: FileText,
      imageSrc: VISUAL_ASSETS.cardEarth,
      imageAlt: "Earth horizon seen from sunlit spacecraft cabin",
    },
    {
      page: "body-map",
      group: "EVIDENCE_RESEARCH",
      groupLabel: "Group D · Evidence & Research",
      order: "13",
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
      page: "storage-history",
      group: "EVIDENCE_RESEARCH",
      groupLabel: "Group D · Evidence & Research",
      order: "14",
      category: "Audit & Private Cloud",
      title: "Cloud Storage & History",
      metric: `${totalStoredRecords} Records · ${snapshotCount} Snapshots`,
      statusText:
        offlineQueueCount > 0
          ? `▲ ${offlineQueueCount} offline write(s) waiting`
          : browserOnline
          ? "● Private Firestore synced"
          : "▲ Offline IndexedDB queue",
      tone: offlineQueueCount > 0 || !browserOnline ? "amber" : "sky",
      description:
        "Inspect SHA-256 audit history, manage role access, export backups, and sync offline writes.",
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
      {/* Compact Deep-Navy Mission Command Header */}
      <section className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#070E1E] via-[#0B162E] to-[#102140] border border-slate-800 text-slate-100 p-5 sm:p-6 shadow-lg">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="space-y-1">
              <div className="font-mono text-[11px] font-semibold tracking-wider text-cyan-300 uppercase">
                MISSION COMMAND WORKSPACE · {envMeta.shortLabel}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                AEGIS-V Operational Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                When Earth is far away, every decision matters. Launch immediate medical aid, monitor
                cabin &amp; crew status, or open any specialized tool below.
              </p>
            </div>

            {/* 8 Real-State Mission Status Indicators */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2">
                <div className="text-slate-400">Mission / Habitat</div>
                <div className="font-semibold text-white truncate mt-0.5">{missionName}</div>
              </div>
              <div className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2">
                <div className="text-slate-400">Active Crew &amp; Role</div>
                <div className="font-semibold text-white truncate mt-0.5">
                  {astronautName} ({activeCrew?.role || operatorRole.replace(/_/g, " ")})
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2">
                <div className="text-slate-400">Monitoring &amp; Alerts</div>
                <div
                  className={`font-semibold truncate mt-0.5 ${
                    overallStatus.tone === "rose"
                      ? "text-rose-300"
                      : overallStatus.tone === "amber"
                      ? "text-amber-300"
                      : "text-emerald-300"
                  }`}
                >
                  {overallStatus.label} · {openIncidents.length} Open
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2">
                <div className="text-slate-400">Sentinel · Earth · Sync</div>
                <div className="font-mono font-semibold text-cyan-200 truncate mt-0.5 tabular-nums">
                  {sentinelTierLabel} · {earthWanConnected ? "WAN ON" : "WAN OFF"} ·{" "}
                  {offlineQueueCount > 0 ? `${offlineQueueCount} Q` : browserOnline ? "Synced" : "Local"}
                </div>
              </div>
            </div>

            {/* 4 Primary Action Controls */}
            <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={() =>
                  onOpenMedicalHelp ? onOpenMedicalHelp(false) : onNavigate("medical-help")
                }
                className="min-h-[42px] px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <HeartPulse className="w-4 h-4 shrink-0" />
                <span>I NEED MEDICAL HELP</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onOpenMedicalHelp ? onOpenMedicalHelp(true) : onNavigate("medical-help")
                }
                className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>URGENT EMERGENCY</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("life-safety")}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-cyan-300" />
                <span>OPEN LIFE-SAFETY SENTINEL</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("shift-routine")}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CalendarCheck2 className="w-3.5 h-3.5 text-cyan-300" />
                <span>SHIFT HANDOVER</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-2">
            <div className="aspect-[16/9] rounded-xl overflow-hidden border border-slate-700/80">
              <SafeImage
                src={envHeroImage}
                alt={envMeta.label}
                caption={`${envMeta.shortLabel} · ${envMeta.gravityLabel}`}
              />
            </div>
            <div className="text-[11px] font-mono text-slate-400 text-right tabular-nums">
              Last Sync / Obs: {formatMissionTimeUtc(latestObservationIso)}
            </div>
          </div>
        </div>
      </section>

      {/* Above-the-Fold Priority Situation Summary Strip */}
      <section
        aria-label="Mission Priority Summary"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs"
      >
        <button
          type="button"
          onClick={() => onNavigate("life-safety")}
          className="glass-panel rounded-xl p-3.5 text-left hover:bg-white/90 transition-colors cursor-pointer space-y-1"
        >
          <div className="font-mono text-[10px] font-semibold uppercase text-slate-500">
            Life-Safety &amp; Air · {sentinelTierLabel}
          </div>
          <div className="font-bold text-slate-900 truncate">
            Env: {sentinelSummary?.envLevel || "NORMAL"} ·{" "}
            {co2Comp ? `${co2Comp.current_value.toFixed(2)} mmHg CO2` : "CO2 Nominal"}
          </div>
          <div className="text-[11px] text-sky-800 font-medium">
            {sentinelSummary?.checkinOverdue ? "▲ Check-in overdue — review" : "● Open Sentinel →"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("alerts-response")}
          className="glass-panel rounded-xl p-3.5 text-left hover:bg-white/90 transition-colors cursor-pointer space-y-1"
        >
          <div className="font-mono text-[10px] font-semibold uppercase text-slate-500">
            Health &amp; Active Alerts
          </div>
          <div className="font-bold text-slate-900 truncate">
            {openIncidents.length > 0
              ? `${openIncidents.length} Open: ${activeIncident?.title || "Inspect Alert"}`
              : `${presentCount}/${ALL_18_PARAMETERS.length} Channels Valid`}
          </div>
          <div className="text-[11px] text-sky-800 font-medium">
            {openIncidents.length > 0 ? "Inspect 7-Part Evidence →" : "All Baselines Clear →"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("continuity")}
          className="glass-panel rounded-xl p-3.5 text-left hover:bg-white/90 transition-colors cursor-pointer space-y-1"
        >
          <div className="font-mono text-[10px] font-semibold uppercase text-slate-500">
            Continuity &amp; Equipment
          </div>
          <div className="font-bold text-slate-900 truncate">
            {earthWanConnected ? "Earth Link On · Ready" : "Earth Link Off · Autonomous"}
          </div>
          <div className="text-[11px] text-sky-800 font-medium">
            {medRecordsCount} Med Supplies · Continuity Board →
          </div>
        </button>

        <div className="glass-panel rounded-xl p-3.5 flex flex-col justify-between gap-2">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase text-slate-500">
              Guided Walkthrough &amp; 6-Scene Story
            </div>
            <div className="font-bold text-slate-900 mt-0.5 truncate">
              {outstandingTasksCount > 0
                ? `${outstandingTasksCount} Paused Task to Resume`
                : "Interactive 6-Stage Judge Story"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onStartTour}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Compass className="w-3 h-3" />
              <span>Interactive Tour</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("shift-routine")}
              className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-900 rounded-lg text-[11px] font-semibold cursor-pointer"
            >
              6-Scene Demo →
            </button>
          </div>
        </div>
      </section>

      {/* Ordered 4-Group Module Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "ALL", label: `All Modules (${cards.length})` },
              { id: "HEALTH_INTELLIGENCE", label: "A · Health Intelligence (4)" },
              { id: "HELP_SAFETY", label: "B · Help & Safety (3)" },
              { id: "CREW_CONTINUITY", label: "C · Crew & Continuity (4)" },
              { id: "EVIDENCE_RESEARCH", label: "D · Evidence & Research (3)" },
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
                    : "bg-white/85 text-slate-700 border-slate-200/90 hover:bg-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <span className="text-xs text-slate-500">
          Prototype workspace · Each card opens a dedicated screen.
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
