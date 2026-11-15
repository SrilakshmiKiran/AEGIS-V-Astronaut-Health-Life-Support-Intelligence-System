import React, { useEffect, useMemo, useRef, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import {
  ALL_18_PARAMETERS,
  ActorRole,
  BaselineComparison,
  BaselineProfile,
  ConsultationQueueItem,
  DemoSceneId,
  EMERGENCY_CHECKLIST_STEPS,
  IncidentChecklistProgress,
  IncidentRecord,
  InterruptedTaskSummary,
  ParameterName,
  ParameterTelemetryStatus,
  QualityStatus,
  SUBJECTIVE_CHECKIN_LABELS,
  SubjectiveCheckinEntry,
  SubjectiveCheckinStatus,
  TelemetryHistoryResponse,
  TelemetryLatestResponse,
  TelemetryObservation,
} from "./types/aegisContracts";
import { PageId } from "./types/navigation";
import {
  CURATED_NASA_CSA_RESOURCES,
  NUTRITION_CATALOGUE,
  SEEDED_BASELINE_PROFILE,
  buildEarthHandoffConsultationItem,
} from "./mocks/cloudPreviewFixtures";
import {
  buildEarthHandoffPackage,
  buildShiftHandoverSummary,
  canConfirmEquipmentInventory,
  canSubmitSubjectiveCheckin,
  compareToBaseline,
  evaluateParameterTelemetryStatus,
  extractIncidentChecklistProgressMap,
  extractSubjectiveCheckinHistory,
  resolveEquipmentInventory,
  resolveStreamReferenceTimestamp,
} from "./utils/aegisPureEngine";
import {
  EmergencyCategory,
  LifeSafetyConfig,
  LifeSafetyEvent,
} from "./types/lifeSafetyContracts";
import {
  applyLifeSafetyTransition,
  buildEmergencyConsolidatedSummary,
  canOperateLifeSafety,
  createEmergencyLifeSafetyEvent,
  evaluateCheckinScheduleStatus,
  evaluateEnvironmentLifeSafety,
  extractLifeSafetyConfigFromOpsRecords,
  extractLifeSafetyEventsFromOpsRecords,
  serializeLifeSafetyConfigToOpsRecord,
  serializeLifeSafetyEventToOpsRecord,
} from "./utils/lifeSafetyEngine";
import { GuidanceIncidentRecord } from "./types/medicalGuidanceContracts";
import {
  buildConsultationItemFromGuidanceIncident,
  buildPersonalizedGuidanceContext,
  extractGuidanceIncidentsFromOpsRecords,
  serializeGuidanceIncidentToOpsRecord,
} from "./utils/medicalGuidanceEngine";
import { useFirebaseAuth } from "./context/FirebaseContext";
import {
  SnapshotSummary,
  WorkspaceProfileDoc,
  createSnapshotInCloud,
  deleteSnapshotInCloud,
  ensureUserWorkspace,
  generateBaseHealthReportInCloud,
  generateReportInCloud,
  injectTestObservationToCloud,
  recordVerifiedDeviceObservationInCloud,
  saveCheckinObservations,
  saveEarthHandoffPackageInCloud,
  subscribeWorkspace,
  switchScenarioInCloud,
  syncReportsInCloud,
  transitionIncidentInCloud,
  updateWorkspaceSettingsInCloud,
} from "./services/firestoreWorkspace";
import {
  ContinuityPersistedState,
  CrewAvailabilityStatus,
  DEFAULT_CONTINUITY_STATE,
  EquipmentConfirmationRecord,
  EquipmentOperationalStatus,
  GUIDED_PROCEDURES,
  ONBOARD_MEDICAL_EQUIPMENT,
  SCENE_7_CONTINUITY_INITIAL_STATE,
} from "./types/continuityContracts";
import {
  ActivityMode,
  BodyRegionId,
  CrewRosterMember,
  DEFAULT_ECLSS,
  DEFAULT_OPS_STATE,
  DiagnosticScanEntry,
  EvaSessionSummary,
  ExtendedBioSummary,
  LIGHT_DELAY_META,
  LightDelayMode,
  MISSION_ENVIRONMENT_META,
  MISSION_ROUTINE_TASKS,
  MissionEnvironmentId,
  OpsRecordDoc,
  OpsStateDoc,
  PvtResultSummary,
  RoutineGamificationState,
  SEEDED_CREW_ROSTER,
} from "./types/opsContracts";
import {
  deleteOpsRecordInCloud,
  ensureOpsWorkspace,
  subscribeOpsWorkspace,
  updateOpsStateInCloud,
  upsertOpsRecordInCloud,
} from "./services/opsWorkspace";
import {
  OfflineQueueAction,
  enqueueOfflineAction,
  getQueuedOfflineActions,
  removeQueuedOfflineAction,
} from "./services/offlineQueueDb";
import {
  StoredVoiceMemoRecord,
  deleteVoiceMemoBlob,
  getVoiceMemosForOwner,
  saveVoiceMemoBlob,
} from "./services/voiceMemoDb";
import {
  StoredDiagnosticScan,
  deleteDiagnosticScanImage,
  getDiagnosticScansForOwner,
  saveDiagnosticScanImage,
} from "./services/diagnosticScanDb";
import { CheckinGroupId } from "./components/DailyVoiceMemoPanel";
import { LandingPage } from "./pages/LandingPage";
import { HomeDashboardPage } from "./pages/HomeDashboardPage";
import { LiveVitalsPage } from "./pages/LiveVitalsPage";
import { DailyCheckinPage } from "./pages/DailyCheckinPage";
import { AlertsResponsePage } from "./pages/AlertsResponsePage";
import { CabinRadiationPage } from "./pages/CabinRadiationPage";
import { ReportsLibraryPage } from "./pages/ReportsLibraryPage";
import { StorageHistoryPage } from "./pages/StorageHistoryPage";
import { EvaReadinessPage } from "./pages/EvaReadinessPage";
import { MedKitPage } from "./pages/MedKitPage";
import { CognitiveReadinessPage } from "./pages/CognitiveReadinessPage";
import { BodyAtlasPage } from "./pages/BodyAtlasPage";
import { ContinuityModePage } from "./pages/ContinuityModePage";
import { LifeSafetySentinelPage } from "./pages/LifeSafetySentinelPage";
import { MedicalGuidancePage } from "./pages/MedicalGuidancePage";
import { ShiftRoutinePage } from "./pages/ShiftRoutinePage";
import { LifeSafetyBanner } from "./components/LifeSafetyBanner";
import { EmergencyRequestModal } from "./components/EmergencyRequestModal";
import { InteractiveOnboardingTour } from "./components/InteractiveOnboardingTour";
import {
  AegisAssistantDock,
  AssistantActionRequest,
} from "./components/AegisAssistantDock";
import { AegisBrandIcon } from "./components/AegisBrandIcon";

const TOP_NAV_SIGNED_IN: Array<{ id: PageId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "live-vitals", label: "Live Vitals" },
  { id: "daily-checkin", label: "Daily Check-In" },
  { id: "alerts-response", label: "Alerts" },
  { id: "continuity", label: "Continuity" },
];

const MOBILE_NAV_SIGNED_IN: Array<{ id: PageId; label: string }> = [
  { id: "landing", label: "Showcase (Page 1)" },
  { id: "home", label: "Home Dashboard (Page 2)" },
  { id: "medical-help", label: "I Need Medical Help (First-Response)" },
  { id: "life-safety", label: "Life-Safety Sentinel" },
  { id: "continuity", label: "Continuity Mode (CMO Unavailable)" },
  { id: "body-map", label: "Body Map & 5 Hazards" },
  { id: "live-vitals", label: "Live Vitals & Quality Filter" },
  { id: "daily-checkin", label: "Daily Check-In" },
  { id: "alerts-response", label: "Alerts & Response" },
  { id: "cabin-radiation", label: "Cabin Air & Radiation" },
  { id: "reports-library", label: "Doctor Reports & Library" },
  { id: "shift-routine", label: "Shift Handover, Routine & Scenarios" },
  { id: "storage-history", label: "Cloud Storage & History" },
  { id: "eva-readiness", label: "EVA & Suit Readiness" },
  { id: "med-kit", label: "Med Kit & Countermeasures" },
  { id: "cognitive-readiness", label: "Cognitive & Behavioral" },
];

export default function App() {
  const { user, authReady, authError, isSigningIn, signInWithGoogle, signOutUser } =
    useFirebaseAuth();

  const [activePage, setActivePage] = useState<PageId>("landing");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceRetryCount, setWorkspaceRetryCount] = useState(0);
  const [workspace, setWorkspace] = useState<WorkspaceProfileDoc | null>(null);
  const [observations, setObservations] = useState<TelemetryObservation[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [consultationQueue, setConsultationQueue] = useState<ConsultationQueueItem[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [opsState, setOpsState] = useState<OpsStateDoc>({
    ownerId: "",
    ...DEFAULT_OPS_STATE,
  });
  const [opsRecords, setOpsRecords] = useState<OpsRecordDoc[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueAction[]>([]);
  const [storedVoiceMemos, setStoredVoiceMemos] = useState<StoredVoiceMemoRecord[]>([]);
  const [storedScans, setStoredScans] = useState<StoredDiagnosticScan[]>([]);
  const [opsLoaded, setOpsLoaded] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourInitializedForUid, setTourInitializedForUid] = useState<string | null>(null);
  const [resumeIncidentId, setResumeIncidentId] = useState<string | null>(null);
  const [resumeProcedureId, setResumeProcedureId] = useState<string | null>(null);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [medicalGuidanceUrgentMode, setMedicalGuidanceUrgentMode] = useState(false);
  const [medicalGuidanceFeedback, setMedicalGuidanceFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [sentinelFeedback, setSentinelFeedback] = useState<{ ok: boolean; message: string } | null>(
    null
  );
  const [clockTickIso, setClockTickIso] = useState<string>(() => new Date().toISOString());

  const [isBusy, setIsBusy] = useState(false);
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [scenarioFeedback, setScenarioFeedback] = useState<string | null>(null);
  const [vitalsFeedback, setVitalsFeedback] = useState<{ ok: boolean; message: string } | null>(
    null
  );
  const [alertFeedback, setAlertFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [storageFeedback, setStorageFeedback] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  const prevUidRef = useRef<string | null>(null);
  const isFlushingQueueRef = useRef(false);

  const formatErr = (err: unknown, fallback: string): string =>
    err instanceof Error && err.message ? err.message : fallback;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activePage]);

  useEffect(() => {
    const id = window.setInterval(() => setClockTickIso(new Date().toISOString()), 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const currentUid = user?.uid ?? null;
    if (currentUid && prevUidRef.current !== currentUid) {
      setActivePage("home");
    } else if (!currentUid && prevUidRef.current !== null) {
      setActivePage("landing");
    }
    prevUidRef.current = currentUid;
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady || !user) {
      setWorkspaceReady(false);
      setWorkspace(null);
      setObservations([]);
      setIncidents([]);
      setConsultationQueue([]);
      setSnapshots([]);
      setOpsRecords([]);
      setOfflineQueue([]);
      setStoredVoiceMemos([]);
      setStoredScans([]);
      setOpsLoaded(false);
      setTourOpen(false);
      setTourInitializedForUid(null);
      return;
    }

    let cancelled = false;
    let unsubscribeMain: (() => void) | null = null;
    let unsubscribeOps: (() => void) | null = null;

    const init = async () => {
      try {
        setWorkspaceError(null);
        await ensureUserWorkspace(user);
        await ensureOpsWorkspace(user.uid);
        if (cancelled) return;

        const [queued, localMemos, localScans] = await Promise.all([
          getQueuedOfflineActions(user.uid),
          getVoiceMemosForOwner(user.uid),
          getDiagnosticScansForOwner(user.uid),
        ]);
        if (!cancelled) {
          setOfflineQueue(queued);
          setStoredVoiceMemos(localMemos);
          setStoredScans(localScans);
        }

        unsubscribeMain = subscribeWorkspace(user.uid, {
          onWorkspace: (ws) => setWorkspace(ws),
          onObservations: (obs) => setObservations(obs),
          onIncidents: (inc) => setIncidents(inc),
          onConsultations: (cons) => setConsultationQueue(cons),
          onSnapshots: (snaps) => setSnapshots(snaps),
          onError: (err) => setWorkspaceError(err.message),
        });

        unsubscribeOps = subscribeOpsWorkspace(user.uid, {
          onOpsState: (st) => setOpsState(st),
          onOpsRecords: (recs) => {
            setOpsRecords(recs);
            setOpsLoaded(true);
          },
          onError: (err) => setWorkspaceError(err.message),
        });

        setWorkspaceReady(true);
      } catch (err) {
        if (!cancelled) {
          setWorkspaceError(
            err instanceof Error ? err.message : "Could not load private cloud workspace."
          );
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      if (unsubscribeMain) unsubscribeMain();
      if (unsubscribeOps) unsubscribeOps();
    };
  }, [authReady, user, workspaceRetryCount]);

  const baseline: BaselineProfile = useMemo(() => {
    return {
      ...SEEDED_BASELINE_PROFILE,
      full_name: workspace?.astronautName || SEEDED_BASELINE_PROFILE.full_name,
      mission_role: workspace?.missionName || SEEDED_BASELINE_PROFILE.mission_role,
    };
  }, [workspace]);

  const latest: TelemetryLatestResponse = useMemo(() => {
    const latestByParameter = {} as Record<ParameterName, TelemetryObservation>;
    const baselineComparisons = {} as Record<ParameterName, BaselineComparison>;
    const statusByParameter = {} as Record<ParameterName, ParameterTelemetryStatus>;
    const streamRefIso = resolveStreamReferenceTimestamp(observations);

    ALL_18_PARAMETERS.forEach((param) => {
      const validForParam = observations.filter(
        (o) => o.parameter === param && !o.is_quarantined && o.quality_status !== "STALE"
      );
      const fallbackAll = observations.filter((o) => o.parameter === param);
      const chosen =
        validForParam.length > 0
          ? validForParam[validForParam.length - 1]
          : fallbackAll[fallbackAll.length - 1];
      if (chosen) {
        latestByParameter[param] = chosen;
        baselineComparisons[param] = compareToBaseline(chosen, baseline);
      }
      statusByParameter[param] = evaluateParameterTelemetryStatus(
        observations,
        param,
        baseline,
        streamRefIso
      );
    });

    const qualityCounts: Record<QualityStatus, number> = {
      VALID: observations.filter((o) => o.quality_status === "VALID").length,
      ESTIMATED: observations.filter((o) => o.quality_status === "ESTIMATED").length,
      MISSING: observations.filter((o) => o.quality_status === "MISSING").length,
      STALE: observations.filter((o) => o.quality_status === "STALE").length,
      IMPOSSIBLE: observations.filter((o) => o.quality_status === "IMPOSSIBLE").length,
      CORRUPTED: observations.filter((o) => o.quality_status === "CORRUPTED").length,
    };

    const quarantinedRecent = observations.filter(
      (o) =>
        o.is_quarantined ||
        o.quality_status === "STALE" ||
        o.quality_status === "MISSING" ||
        o.quality_status === "IMPOSSIBLE" ||
        o.quality_status === "CORRUPTED"
    );

    return {
      astronaut_id: baseline.astronaut_id,
      as_of_timestamp: new Date().toISOString(),
      stream_reference_timestamp: streamRefIso,
      latest_by_parameter: latestByParameter,
      baseline_comparisons: baselineComparisons,
      status_by_parameter: statusByParameter,
      quality_counts: qualityCounts,
      quarantined_recent: quarantinedRecent,
    };
  }, [observations, baseline]);

  const histories: Partial<Record<ParameterName, TelemetryHistoryResponse>> = useMemo(() => {
    const map: Partial<Record<ParameterName, TelemetryHistoryResponse>> = {};
    ALL_18_PARAMETERS.forEach((param) => {
      const metric = baseline.metrics[param];
      const filtered = observations
        .filter(
          (o) => o.parameter === param && !o.is_quarantined && o.quality_status !== "STALE"
        )
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      map[param] = {
        parameter: param,
        unit: metric.unit,
        baseline_metric: metric,
        observations: filtered,
      };
    });
    return map;
  }, [observations, baseline]);

  const activeAlertCount = incidents.filter((i) => i.state !== "CLOSED_RETAINED").length;
  const actorLabel = user?.displayName || user?.email || "Crew Operator";

  const effectiveOpsRecords: OpsRecordDoc[] = useMemo(() => {
    const byId = new Map<string, OpsRecordDoc>();
    for (const r of opsRecords) {
      byId.set(r.recordId, r);
    }
    const queuedUpserts = [...offlineQueue]
      .filter(
        (q): q is Extract<OfflineQueueAction, { kind: "UPSERT_OPS_RECORD" }> =>
          q.kind === "UPSERT_OPS_RECORD"
      )
      .sort((a, b) => Date.parse(a.createdAtIso) - Date.parse(b.createdAtIso));
    for (const item of queuedUpserts) {
      byId.set(item.record.recordId, item.record);
    }
    return Array.from(byId.values()).sort((a, b) => b.timestampIso.localeCompare(a.timestampIso));
  }, [opsRecords, offlineQueue]);

  const crewRoster: CrewRosterMember[] = useMemo(() => {
    const profileRecs = effectiveOpsRecords.filter((r) => r.recordType === "CREW_PROFILE");
    if (profileRecs.length === 0) return SEEDED_CREW_ROSTER;
    return profileRecs
      .map((r) => ({
        crewId: r.crewId,
        name: r.title,
        role: String(r.payload.role || "Crew Member"),
        age: Number(r.payload.age || 38),
        restingHrMean: Number(r.payload.restingHrMean || 66),
        statusNote: String(r.payload.statusNote || "Ready"),
        activeAlertCount: Number(r.payload.activeAlertCount || 0),
      }))
      .sort((a, b) => a.crewId.localeCompare(b.crewId));
  }, [effectiveOpsRecords]);

  const activeCrewMember =
    crewRoster.find((c) => c.crewId === opsState.activeCrewId) || crewRoster[0];

  const evaRecords = useMemo(
    () => effectiveOpsRecords.filter((r) => r.recordType === "EVA_SESSION"),
    [effectiveOpsRecords]
  );
  const medRecords = useMemo(
    () =>
      effectiveOpsRecords
        .filter((r) => r.recordType === "MED_LOG")
        .sort((a, b) => a.title.localeCompare(b.title)),
    [effectiveOpsRecords]
  );
  const pvtRecords = useMemo(
    () => effectiveOpsRecords.filter((r) => r.recordType === "PVT_COGNITIVE"),
    [effectiveOpsRecords]
  );
  const consultMessages = useMemo(
    () =>
      effectiveOpsRecords
        .filter((r) => r.recordType === "CONSULT_MSG")
        .sort((a, b) => a.timestampIso.localeCompare(b.timestampIso)),
    [effectiveOpsRecords]
  );
  const voiceMemoRecords = useMemo(
    () => effectiveOpsRecords.filter((r) => r.recordType === "VOICE_MEMO"),
    [effectiveOpsRecords]
  );

  const extendedBio: ExtendedBioSummary | null = useMemo(() => {
    const bioRec = effectiveOpsRecords.find(
      (r) =>
        r.recordType === "BIO_EXTENDED" &&
        r.payload.kind === "BLOOD_SUGAR_TEMP"
    );
    if (!bioRec) return null;
    return {
      bloodGlucoseMgDl: Number(bioRec.payload.bloodGlucoseMgDl ?? 94),
      coreTempC: Number(bioRec.payload.coreTempC ?? 36.8),
      notes: String(bioRec.payload.notes || ""),
      recordedAtIso: bioRec.timestampIso,
    };
  }, [effectiveOpsRecords]);

  const scanCountByRegion = useMemo(() => {
    const counts: Partial<Record<BodyRegionId, number>> = {};
    for (const s of storedScans) {
      counts[s.bodyRegion] = (counts[s.bodyRegion] || 0) + 1;
    }
    return counts;
  }, [storedScans]);

  const routineState: RoutineGamificationState = useMemo(() => {
    const todayUtc = new Date().toISOString().slice(0, 10);
    const rec = effectiveOpsRecords.find(
      (r) => r.recordType === "GAMIFICATION_ROUTINE" && r.recordId === "REC_MISSION_ROUTINE"
    );
    if (!rec) {
      return {
        environmentMode: "ISS_LEO",
        completedDateUtc: todayUtc,
        completedTaskIds: [],
        streakDays: 1,
        readinessPoints: 20,
        earnedBadges: [],
        onboardingCompleted: false,
      };
    }
    const savedDate = String(rec.payload.completedDateUtc || todayUtc);
    const isSameDay = savedDate === todayUtc;
    const rawTasks = String(rec.payload.completedTaskIdsCsv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const rawBadges = String(rec.payload.earnedBadgesCsv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      environmentMode: (rec.payload.environmentMode as MissionEnvironmentId) || "ISS_LEO",
      completedDateUtc: todayUtc,
      completedTaskIds: isSameDay ? rawTasks : [],
      streakDays: Math.max(1, Number(rec.payload.streakDays || 1)),
      readinessPoints: Number(rec.payload.readinessPoints || 20),
      earnedBadges: rawBadges,
      onboardingCompleted: Boolean(rec.payload.onboardingCompleted),
    };
  }, [effectiveOpsRecords]);

  const checklistLogs = useMemo(
    () =>
      effectiveOpsRecords.filter(
        (r) =>
          r.recordType === "CHECKLIST_LOG" &&
          r.recordId !== "REC_CONTINUITY_STATE" &&
          r.payload?.kind !== "INCIDENT_CHECKLIST_PROGRESS" &&
          r.payload?.kind !== "LIFE_SAFETY_EVENT" &&
          r.payload?.kind !== "LIFE_SAFETY_CONFIG"
      ),
    [effectiveOpsRecords]
  );

  const continuityState: ContinuityPersistedState = useMemo(() => {
    const fallback =
      workspace?.activeScene === "SCENE_7_CONTINUITY_CMO_UNAVAILABLE"
        ? SCENE_7_CONTINUITY_INITIAL_STATE
        : DEFAULT_CONTINUITY_STATE;
    const rec = effectiveOpsRecords.find((r) => r.recordId === "REC_CONTINUITY_STATE");
    if (!rec) return fallback;
    const p = rec.payload || {};
    return {
      continuityActive:
        typeof p.continuityActive === "boolean" ? p.continuityActive : fallback.continuityActive,
      cmoAvailable:
        typeof p.cmoAvailable === "boolean" ? p.cmoAvailable : fallback.cmoAvailable,
      cmoStatusReason:
        typeof p.cmoStatusReason === "string" && p.cmoStatusReason.trim()
          ? p.cmoStatusReason
          : fallback.cmoStatusReason,
      replacementOperatorCrewId:
        typeof p.replacementOperatorCrewId === "string" && p.replacementOperatorCrewId.trim()
          ? p.replacementOperatorCrewId
          : fallback.replacementOperatorCrewId,
      crewAvailabilityOverrides:
        p.crewAvailabilityOverrides && typeof p.crewAvailabilityOverrides === "object"
          ? (p.crewAvailabilityOverrides as Record<string, CrewAvailabilityStatus>)
          : fallback.crewAvailabilityOverrides,
      equipmentStatusOverrides:
        p.equipmentStatusOverrides && typeof p.equipmentStatusOverrides === "object"
          ? (p.equipmentStatusOverrides as Record<string, EquipmentOperationalStatus>)
          : fallback.equipmentStatusOverrides,
      procedureStepsDone:
        p.procedureStepsDone && typeof p.procedureStepsDone === "object"
          ? (p.procedureStepsDone as Record<string, number[]>)
          : fallback.procedureStepsDone,
      accessedProcedureIds: Array.isArray(p.accessedProcedureIds)
        ? (p.accessedProcedureIds as string[])
        : fallback.accessedProcedureIds,
      walkthroughStep: Number(p.walkthroughStep || fallback.walkthroughStep),
      activeProcedureId:
        typeof p.activeProcedureId === "string" && p.activeProcedureId.trim()
          ? p.activeProcedureId
          : fallback.activeProcedureId,
      procedureCurrentStep:
        p.procedureCurrentStep && typeof p.procedureCurrentStep === "object"
          ? (p.procedureCurrentStep as Record<string, number>)
          : fallback.procedureCurrentStep,
      equipmentConfirmations:
        p.equipmentConfirmations && typeof p.equipmentConfirmations === "object"
          ? (p.equipmentConfirmations as Record<string, EquipmentConfirmationRecord>)
          : fallback.equipmentConfirmations,
      updatedAtIso:
        typeof p.updatedAtIso === "string" ? p.updatedAtIso : rec.timestampIso || fallback.updatedAtIso,
    };
  }, [effectiveOpsRecords, workspace?.activeScene]);

  const subjectiveHistory: SubjectiveCheckinEntry[] = useMemo(
    () =>
      extractSubjectiveCheckinHistory(
        effectiveOpsRecords,
        workspace?.operatorRole || "CREW_MEMBER"
      ),
    [effectiveOpsRecords, workspace?.operatorRole]
  );

  const incidentChecklistProgressMap: Record<string, IncidentChecklistProgress> = useMemo(
    () => extractIncidentChecklistProgressMap(effectiveOpsRecords, EMERGENCY_CHECKLIST_STEPS.length),
    [effectiveOpsRecords]
  );

  const shiftHandover = useMemo(
    () =>
      buildShiftHandoverSummary({
        baseline,
        observations,
        statusByParameter:
          latest.status_by_parameter || ({} as Record<ParameterName, ParameterTelemetryStatus>),
        baselineComparisons: latest.baseline_comparisons,
        incidents,
        opsRecords: effectiveOpsRecords,
        opsState,
        routineState,
        continuityState,
        equipmentList: ONBOARD_MEDICAL_EQUIPMENT,
        procedures: GUIDED_PROCEDURES,
        emergencyChecklistSteps: EMERGENCY_CHECKLIST_STEPS,
        viewerRole: workspace?.operatorRole || "CREW_MEMBER",
        quarantinedRecent: latest.quarantined_recent,
      }),
    [
      baseline,
      observations,
      latest,
      incidents,
      effectiveOpsRecords,
      opsState,
      routineState,
      continuityState,
      workspace?.operatorRole,
    ]
  );

  const queuedLifeSafetyRecordIds = useMemo(() => {
    const set = new Set<string>();
    offlineQueue.forEach((q) => {
      if (q.kind === "UPSERT_OPS_RECORD") {
        set.add(q.record.recordId);
      }
    });
    return set;
  }, [offlineQueue]);

  const lifeSafetyConfig: LifeSafetyConfig = useMemo(
    () => extractLifeSafetyConfigFromOpsRecords(effectiveOpsRecords),
    [effectiveOpsRecords]
  );

  const lifeSafetyEvents: LifeSafetyEvent[] = useMemo(
    () =>
      extractLifeSafetyEventsFromOpsRecords(effectiveOpsRecords).map((ev) => ({
        ...ev,
        syncStatus: queuedLifeSafetyRecordIds.has(ev.eventId)
          ? "QUEUED_OFFLINE"
          : "SYNCED_CLOUD",
      })),
    [effectiveOpsRecords, queuedLifeSafetyRecordIds]
  );

  const openLifeSafetyEvents = useMemo(
    () => lifeSafetyEvents.filter((e) => e.state !== "RESOLVED_RETAINED"),
    [lifeSafetyEvents]
  );

  const guidanceIncidents: GuidanceIncidentRecord[] = useMemo(
    () =>
      extractGuidanceIncidentsFromOpsRecords(effectiveOpsRecords).map((inc) => {
        const expectedRecId = `MEDG_${inc.incidentId.replace(/[^a-zA-Z0-9_\-]/g, "_")}`.slice(
          0,
          120
        );
        return {
          ...inc,
          syncStatus: queuedLifeSafetyRecordIds.has(expectedRecId)
            ? "QUEUED_OFFLINE"
            : "SYNCED_CLOUD",
        };
      }),
    [effectiveOpsRecords, queuedLifeSafetyRecordIds]
  );

  const openGuidanceIncidents = useMemo(
    () => guidanceIncidents.filter((g) => g.state !== "CLOSED"),
    [guidanceIncidents]
  );

  const envAssessment = useMemo(
    () => evaluateEnvironmentLifeSafety(opsState.eclss, latest, opsState.solarStormActive),
    [opsState.eclss, latest, opsState.solarStormActive]
  );

  const checkinEval = useMemo(
    () => evaluateCheckinScheduleStatus(lifeSafetyConfig, clockTickIso),
    [lifeSafetyConfig, clockTickIso]
  );

  const resolvedEquipment = useMemo(
    () => resolveEquipmentInventory(ONBOARD_MEDICAL_EQUIPMENT, continuityState),
    [continuityState]
  );

  const emergencyAnswers = useMemo(
    () =>
      buildEmergencyConsolidatedSummary({
        activeEvent: openLifeSafetyEvents[0] || lifeSafetyEvents[0] || null,
        latest,
        envAssessment,
        checkinEval,
        incidents,
        resolvedEquipment,
        earthWanConnected: workspace?.earthWanConnected ?? true,
        browserOnline,
        offlineQueueCount: offlineQueue.length,
      }),
    [
      openLifeSafetyEvents,
      lifeSafetyEvents,
      latest,
      envAssessment,
      checkinEval,
      incidents,
      resolvedEquipment,
      workspace?.earthWanConnected,
      browserOnline,
      offlineQueue.length,
    ]
  );

  useEffect(() => {
    if (!user || !workspaceReady || !opsLoaded) return;
    if (tourInitializedForUid === user.uid) return;
    let localDone = false;
    try {
      localDone = window.localStorage.getItem(`aegis_v_tour_done_${user.uid}`) === "true";
    } catch {
      localDone = false;
    }
    if (!routineState.onboardingCompleted && !localDone) {
      setTourOpen(true);
    }
    setTourInitializedForUid(user.uid);
  }, [user, workspaceReady, opsLoaded, routineState.onboardingCompleted, tourInitializedForUid]);

  const flushOfflineQueue = async () => {
    if (!user || isFlushingQueueRef.current) return;
    const queued = await getQueuedOfflineActions(user.uid);
    if (queued.length === 0) return;

    isFlushingQueueRef.current = true;
    setIsBusy(true);
    let syncedCount = 0;
    let rollingObs = [...observations];
    try {
      for (const item of queued) {
        if (item.kind === "CHECKIN_BATCH") {
          await saveCheckinObservations(
            user.uid,
            item.entries,
            rollingObs,
            baseline,
            actorLabel,
            {
              existingIncidents: incidents,
              optionalLlmEnabled: workspace?.optionalLlmEnabled ?? false,
              earthWanConnected: workspace?.earthWanConnected ?? true,
            }
          );
          rollingObs = [
            ...rollingObs,
            ...item.entries.map((e, idx) => ({
              observation_id: `QUEUED_${idx}_${Date.now()}`,
              astronaut_id: baseline.astronaut_id,
              timestamp: item.createdAtIso,
              parameter: e.parameter,
              value: e.value,
              unit: baseline.metrics[e.parameter].unit,
              source_type: "MANUAL_ENTRY" as const,
              device_hmac_verified: false,
              info_label: "MEASURED" as const,
              quality_status: e.quality_status || ("VALID" as const),
              is_quarantined: false,
            })),
          ];
        } else if (item.kind === "UPSERT_OPS_RECORD") {
          const recToSync = { ...item.record };
          if (
            recToSync.payload?.kind === "LIFE_SAFETY_EVENT" &&
            recToSync.payload?.event &&
            typeof recToSync.payload.event === "object"
          ) {
            recToSync.payload = {
              ...recToSync.payload,
              event: {
                ...(recToSync.payload.event as Record<string, unknown>),
                syncStatus: "SYNCED_CLOUD",
              },
            };
          } else if (
            recToSync.payload?.kind === "MEDICAL_GUIDANCE_INCIDENT" &&
            recToSync.payload?.incident &&
            typeof recToSync.payload.incident === "object"
          ) {
            recToSync.payload = {
              ...recToSync.payload,
              incident: {
                ...(recToSync.payload.incident as Record<string, unknown>),
                syncStatus: "SYNCED_CLOUD",
              },
            };
          }
          await upsertOpsRecordInCloud(user.uid, recToSync);
        } else if (item.kind === "UPDATE_OPS_STATE") {
          await updateOpsStateInCloud(user.uid, item.updates);
        }
        await removeQueuedOfflineAction(user.uid, item.queueId);
        syncedCount += 1;
      }
      const remaining = await getQueuedOfflineActions(user.uid);
      setOfflineQueue(remaining);
      setStorageFeedback({
        ok: true,
        message: `Synced ${syncedCount} buffered browser offline item(s) into private Firestore workspace.`,
      });
    } catch (err) {
      const remaining = await getQueuedOfflineActions(user.uid);
      setOfflineQueue(remaining);
      setStorageFeedback({
        ok: false,
        message: `Offline queue sync paused after ${syncedCount} item(s): ${formatErr(
          err,
          "Network or storage error."
        )}`,
      });
    } finally {
      isFlushingQueueRef.current = false;
      setIsBusy(false);
    }
  };

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!user || !workspaceReady || !browserOnline || offlineQueue.length === 0) return;
    void flushOfflineQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workspaceReady, browserOnline, offlineQueue.length]);

  const handleActivateScene = async (sceneId: DemoSceneId) => {
    if (!user || !workspace) return;
    setIsBusy(true);
    setAlertFeedback(null);
    setVitalsFeedback(null);
    setSyncFeedback(null);
    setResumeIncidentId(null);
    setResumeProcedureId(null);
    try {
      const res = await switchScenarioInCloud(user.uid, sceneId, workspace.optionalLlmEnabled);
      setScenarioFeedback(res.message);
    } catch (err) {
      setScenarioFeedback(formatErr(err, "Failed to switch scenario."));
    } finally {
      setIsBusy(false);
    }
  };

  const handleInjectTestReading = async (
    type: "VALID" | "STALE" | "IMPOSSIBLE" | "SPOOFED_HMAC"
  ) => {
    if (!user) return;
    setIsBusy(true);
    try {
      const res = await injectTestObservationToCloud(user.uid, type);
      setVitalsFeedback({ ok: res.ok, message: res.message });
    } catch (err) {
      setVitalsFeedback({ ok: false, message: formatErr(err, "Could not inject reading.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmitCheckin = async (
    entries: Array<{
      parameter: ParameterName;
      value: number;
      quality_status?: QualityStatus;
      notes?: string;
    }>
  ) => {
    if (!user) return;
    if (!browserOnline) {
      await enqueueOfflineAction({
        queueId: `OFF_CHK_${Date.now()}`,
        ownerId: user.uid,
        createdAtIso: new Date().toISOString(),
        kind: "CHECKIN_BATCH",
        label: `Daily check-in (${entries.length} readings)`,
        entries,
      });
      setOfflineQueue(await getQueuedOfflineActions(user.uid));
      setVitalsFeedback({
        ok: true,
        message: "Browser offline — check-in buffered in IndexedDB and will sync on reconnect.",
      });
      return;
    }

    setIsBusy(true);
    try {
      const res = await saveCheckinObservations(
        user.uid,
        entries,
        observations,
        baseline,
        actorLabel,
        {
          existingIncidents: incidents,
          optionalLlmEnabled: workspace?.optionalLlmEnabled ?? false,
          earthWanConnected: workspace?.earthWanConnected ?? true,
        }
      );
      if (res.ok) {
        const nowIso = new Date().toISOString();
        await persistOpsRecordOfflineFirst(
          serializeLifeSafetyConfigToOpsRecord(
            { ...lifeSafetyConfig, lastCheckinAtIso: nowIso, updatedAtIso: nowIso },
            opsState.activeCrewId,
            user.uid
          ),
          "Update last check-in time"
        );
        const hasEye = entries.some(
          (e) =>
            e.parameter === "intraocular_pressure_mmhg" ||
            e.parameter === "visual_symptom_severity"
        );
        const hasSleep = entries.some((e) => e.parameter === "sleep_duration_hrs");
        const hasHydration = entries.some((e) => e.parameter === "hydration_ml");
        await awardRoutineCompletion(
          hasEye
            ? "TASK_SANS_CABIN"
            : hasSleep
            ? "TASK_TEMP_VOICE"
            : hasHydration
            ? "TASK_HYDRATION_GLUCOSE"
            : undefined,
          hasEye ? "OCULAR_WATCH" : undefined
        );
      }
      setVitalsFeedback({ ok: res.ok, message: res.message });
    } catch (err) {
      setVitalsFeedback({
        ok: false,
        message: formatErr(err, "Could not save check-in reading."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleTransitionIncident = async (
    incidentId: string,
    action: "review" | "acknowledge" | "record-response" | "evaluate-followup" | "close",
    payload?: {
      authorized_action?: string;
      procedure_reference?: string;
      closure_notes?: string;
      auth_pin?: string;
      includeSimulatedFollowup?: boolean;
    }
  ) => {
    if (!user || !workspace) return;
    const inc = incidents.find((i) => i.incident_id === incidentId);
    if (!inc) return;
    setIsBusy(true);
    try {
      const res = await transitionIncidentInCloud(
        user.uid,
        inc,
        observations,
        baseline,
        action,
        actorLabel,
        workspace.operatorRole,
        payload
      );
      setAlertFeedback({ ok: res.ok, message: res.message });
    } catch (err) {
      setAlertFeedback({
        ok: false,
        message: formatErr(err, "Could not transition incident state."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleGeneratePackage = async (incidentId: string) => {
    if (!user) return;
    const inc = incidents.find((i) => i.incident_id === incidentId) || incidents[0];
    if (!inc) return;
    setIsBusy(true);
    try {
      const res = await generateReportInCloud(user.uid, inc);
      setSyncFeedback({ ok: res.ok, message: res.message });
    } catch (err) {
      setSyncFeedback({ ok: false, message: formatErr(err, "Could not generate report.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleGenerateBaseReport = async (input: {
    baseDestination: string;
    crewNote: string;
    transmitNow: boolean;
  }) => {
    if (!user || !workspace) return;
    setIsBusy(true);
    try {
      const res = await generateBaseHealthReportInCloud(user.uid, {
        workspace,
        baseline,
        latest,
        incidents,
        opsState,
        environmentMode: routineState.environmentMode,
        extendedBio,
        voiceMemoCount: storedVoiceMemos.length,
        scanCount: storedScans.length,
        baseDestination: input.baseDestination,
        crewNote: input.crewNote,
        transmitNow: input.transmitNow,
      });
      setSyncFeedback({ ok: res.ok, message: res.message });
    } catch (err) {
      setSyncFeedback({
        ok: false,
        message: formatErr(err, "Could not generate Base health report."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSimulateSync = async () => {
    if (!user || !workspace) return;
    setIsBusy(true);
    try {
      const res = await syncReportsInCloud(
        user.uid,
        workspace.earthWanConnected,
        consultationQueue,
        incidents
      );
      setSyncFeedback({ ok: res.ok, message: res.message });
    } catch (err) {
      setSyncFeedback({ ok: false, message: formatErr(err, "Sync attempt failed.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdateWorkspace = async (
    updates: Partial<{
      astronautName: string;
      missionName: string;
      earthWanConnected: boolean;
      operatorRole: ActorRole;
    }>
  ) => {
    if (!user || !workspace) return;
    setIsBusy(true);
    try {
      const res = await updateWorkspaceSettingsInCloud(user.uid, workspace, updates);
      setStorageFeedback({ ok: res.ok, message: res.message });
    } catch (err) {
      setStorageFeedback({ ok: false, message: formatErr(err, "Could not update workspace settings.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveSnapshot = async () => {
    if (!user) return;
    setIsBusy(true);
    try {
      const res = await createSnapshotInCloud(user.uid, "Manual cloud memory snapshot", {
        observations: observations.length,
        incidents: incidents.length,
        reports: consultationQueue.length,
      });
      setStorageFeedback({ ok: res.ok, message: res.message });
    } catch (err) {
      setStorageFeedback({ ok: false, message: formatErr(err, "Could not save snapshot.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    if (!user) return;
    setIsBusy(true);
    try {
      await deleteSnapshotInCloud(user.uid, snapshotId);
      setStorageFeedback({ ok: true, message: "Removed snapshot from cloud storage." });
    } catch (err) {
      setStorageFeedback({ ok: false, message: formatErr(err, "Could not delete snapshot.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdateOpsState = async (updates: Partial<Omit<OpsStateDoc, "ownerId">>) => {
    if (!user) return;
    const normalizedUpdates = updates.eclss
      ? {
          ...updates,
          eclss: { ...DEFAULT_ECLSS, ...opsState.eclss, ...updates.eclss },
        }
      : updates;
    if (!browserOnline) {
      await enqueueOfflineAction({
        queueId: `OFF_ST_${Date.now()}`,
        ownerId: user.uid,
        createdAtIso: new Date().toISOString(),
        kind: "UPDATE_OPS_STATE",
        label: "Habitat / activity state update",
        updates: normalizedUpdates,
      });
      setOfflineQueue(await getQueuedOfflineActions(user.uid));
      return;
    }
    setIsBusy(true);
    try {
      await updateOpsStateInCloud(user.uid, normalizedUpdates);
    } catch (err) {
      setStorageFeedback({ ok: false, message: formatErr(err, "Could not update habitat state.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSelectCrewMember = async (crewId: string) => {
    if (!user || !workspace) return;
    const member = crewRoster.find((c) => c.crewId === crewId);
    setIsBusy(true);
    try {
      await updateOpsStateInCloud(user.uid, { activeCrewId: crewId });
      if (member) {
        await updateWorkspaceSettingsInCloud(user.uid, workspace, {
          astronautName: member.name,
        });
      }
    } catch (err) {
      setStorageFeedback({ ok: false, message: formatErr(err, "Could not switch crew member.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRecordVerifiedSensorHr = async (bpm: number, deviceLabel: string) => {
    if (!user) return;
    setIsBusy(true);
    try {
      const res = await recordVerifiedDeviceObservationInCloud(
        user.uid,
        opsState.activeCrewId,
        bpm,
        deviceLabel,
        {
          existingObservations: observations,
          existingIncidents: incidents,
          baseline,
          optionalLlmEnabled: workspace?.optionalLlmEnabled ?? false,
          earthWanConnected: workspace?.earthWanConnected ?? true,
        }
      );
      setVitalsFeedback({ ok: res.ok, message: res.message });
    } catch (err) {
      setVitalsFeedback({ ok: false, message: formatErr(err, "Could not record sensor reading.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveChecklistLog = async (
    incidentId: string,
    completedSteps: string[],
    elapsedSec: number
  ) => {
    if (!user) return;
    const nowIso = new Date().toISOString();
    const record: Omit<OpsRecordDoc, "ownerId"> = {
      recordId: `CHK_${Date.now()}`,
      recordType: "CHECKLIST_LOG",
      crewId: opsState.activeCrewId,
      title: `Emergency Checklist (${incidentId})`,
      status: `${completedSteps.length}_STEPS_DONE`,
      timestampIso: nowIso,
      payload: {
        incidentId,
        completedCount: completedSteps.length,
        elapsedSec,
        stepsJoined: completedSteps.join(" | ").slice(0, 600),
      },
    };
    if (!browserOnline) {
      await enqueueOfflineAction({
        queueId: `OFF_CHKLOG_${Date.now()}`,
        ownerId: user.uid,
        createdAtIso: nowIso,
        kind: "UPSERT_OPS_RECORD",
        label: `Checklist snapshot (${incidentId})`,
        record: { ownerId: user.uid, ...record },
      });
      setOfflineQueue(await getQueuedOfflineActions(user.uid));
      return;
    }
    setIsBusy(true);
    try {
      await upsertOpsRecordInCloud(user.uid, record);
    } catch (err) {
      setAlertFeedback({ ok: false, message: formatErr(err, "Could not save checklist log.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveIncidentChecklistProgress = async (
    incidentId: string,
    completedSteps: string[],
    currentStepIndex: number,
    elapsedSec: number,
    totalSteps: number
  ) => {
    if (!user) return;
    const nowIso = new Date().toISOString();
    const safeId = incidentId.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 80);
    const record: Omit<OpsRecordDoc, "ownerId"> = {
      recordId: `INC_CHK_${safeId}`,
      recordType: "CHECKLIST_LOG",
      crewId: opsState.activeCrewId,
      title: `Checklist Progress (${incidentId})`.slice(0, 200),
      status: `${completedSteps.length}_OF_${totalSteps}_DONE`,
      timestampIso: nowIso,
      payload: {
        kind: "INCIDENT_CHECKLIST_PROGRESS",
        incidentId,
        completedSteps,
        currentStepIndex,
        elapsedSec,
        totalSteps,
        updatedAtIso: nowIso,
      },
    };
    if (!browserOnline) {
      await enqueueOfflineAction({
        queueId: `OFF_INCCHK_${safeId}_${Date.now()}`,
        ownerId: user.uid,
        createdAtIso: nowIso,
        kind: "UPSERT_OPS_RECORD",
        label: `Checklist progress (${incidentId})`,
        record: { ownerId: user.uid, ...record },
      });
      setOfflineQueue(await getQueuedOfflineActions(user.uid));
      return;
    }
    try {
      await upsertOpsRecordInCloud(user.uid, record);
    } catch (err) {
      setAlertFeedback({ ok: false, message: formatErr(err, "Could not save checklist progress.") });
    }
  };

  const handleSubmitSubjectiveCheckin = async (
    statusCode: SubjectiveCheckinStatus,
    note: string
  ) => {
    if (!user || !workspace) return;
    if (!canSubmitSubjectiveCheckin(workspace.operatorRole)) {
      setVitalsFeedback({
        ok: false,
        message: "Permission denied: Mission Observer role is read-only and cannot submit crew self-reports.",
      });
      return;
    }
    const nowIso = new Date().toISOString();
    const label = SUBJECTIVE_CHECKIN_LABELS[statusCode];
    const record: Omit<OpsRecordDoc, "ownerId"> = {
      recordId: `SUBJ_${Date.now()}`,
      recordType: "BIO_EXTENDED",
      crewId: opsState.activeCrewId,
      title: `Crew Self-Report: ${label}`.slice(0, 200),
      status: statusCode,
      timestampIso: nowIso,
      payload: {
        kind: "SUBJECTIVE_CHECKIN",
        statusCode,
        statusLabel: label,
        note: note.trim().slice(0, 280),
        submittedByRole: workspace.operatorRole,
        sourceLabel: "CREW_SUBJECTIVE_SELF_REPORT",
      },
    };

    if (!browserOnline) {
      await enqueueOfflineAction({
        queueId: `OFF_SUBJ_${Date.now()}`,
        ownerId: user.uid,
        createdAtIso: nowIso,
        kind: "UPSERT_OPS_RECORD",
        label: `Subjective self-report (${label})`,
        record: { ownerId: user.uid, ...record },
      });
      setOfflineQueue(await getQueuedOfflineActions(user.uid));
      setVitalsFeedback({
        ok: true,
        message: "Subjective check-in saved to offline IndexedDB queue and will sync automatically.",
      });
      return;
    }

    setIsBusy(true);
    try {
      await upsertOpsRecordInCloud(user.uid, record);
      await persistOpsRecordOfflineFirst(
        serializeLifeSafetyConfigToOpsRecord(
          { ...lifeSafetyConfig, lastCheckinAtIso: nowIso, updatedAtIso: nowIso },
          opsState.activeCrewId,
          user.uid
        ),
        "Subjective check-in timestamp refresh"
      );
      setVitalsFeedback({
        ok: true,
        message: `Saved crew subjective check-in ("${label}") as non-sensor self-report.`,
      });
    } catch (err) {
      setVitalsFeedback({
        ok: false,
        message: formatErr(err, "Could not save subjective crew check-in."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdateContinuityState = async (
    updater: (prev: ContinuityPersistedState) => ContinuityPersistedState
  ) => {
    if (!user) return;
    const nextState: ContinuityPersistedState = {
      ...updater(continuityState),
      updatedAtIso: new Date().toISOString(),
    };
    const record: Omit<OpsRecordDoc, "ownerId"> = {
      recordId: "REC_CONTINUITY_STATE",
      recordType: "CHECKLIST_LOG",
      crewId: opsState.activeCrewId,
      title: "AEGIS Continuity Mode State",
      status: nextState.continuityActive ? "CONTINUITY_ACTIVE" : "NOMINAL",
      timestampIso: nextState.updatedAtIso,
      payload: { ...nextState },
    };

    if (!browserOnline) {
      await enqueueOfflineAction({
        queueId: `OFF_CONT_${Date.now()}`,
        ownerId: user.uid,
        createdAtIso: nextState.updatedAtIso,
        kind: "UPSERT_OPS_RECORD",
        label: "Continuity Mode state update",
        record: { ownerId: user.uid, ...record },
      });
      setOfflineQueue(await getQueuedOfflineActions(user.uid));
      setSyncFeedback({
        ok: true,
        message: "Browser offline — Continuity state buffered locally and queued for sync.",
      });
      return;
    }

    setIsBusy(true);
    try {
      await upsertOpsRecordInCloud(user.uid, record);
    } catch (err) {
      setSyncFeedback({
        ok: false,
        message: formatErr(err, "Could not persist Continuity Mode state."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmEquipmentInventory = async (equipmentId: string) => {
    if (!user || !workspace) return;
    if (!canConfirmEquipmentInventory(workspace.operatorRole)) {
      setSyncFeedback({
        ok: false,
        message: "Permission denied: Mission Observer role cannot confirm equipment inventory.",
      });
      return;
    }
    const confirmer = activeCrewMember?.name || actorLabel;
    await handleUpdateContinuityState((prev) => ({
      ...prev,
      equipmentConfirmations: {
        ...(prev.equipmentConfirmations || {}),
        [equipmentId]: {
          confirmedAtIso: new Date().toISOString(),
          confirmedBy: confirmer,
        },
      },
    }));
  };

  const handleResumeInterruptedTask = (task: InterruptedTaskSummary) => {
    if (task.kind === "INCIDENT_CHECKLIST") {
      if (task.incidentId) {
        setResumeIncidentId(task.incidentId);
      }
      navigateTo("alerts-response");
    } else {
      setResumeProcedureId(task.taskId);
      navigateTo("continuity");
    }
  };

  const persistOpsRecordOfflineFirst = async (
    record: Omit<OpsRecordDoc, "ownerId">,
    label: string
  ): Promise<"CLOUD" | "OFFLINE"> => {
    if (!user) return "OFFLINE";
    const fullRecord: OpsRecordDoc = { ownerId: user.uid, ...record };
    if (!browserOnline) {
      await enqueueOfflineAction({
        queueId: `OFF_LSS_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ownerId: user.uid,
        createdAtIso: new Date().toISOString(),
        kind: "UPSERT_OPS_RECORD",
        label,
        record: fullRecord,
      });
      setOfflineQueue(await getQueuedOfflineActions(user.uid));
      return "OFFLINE";
    }
    try {
      await upsertOpsRecordInCloud(user.uid, record);
      return "CLOUD";
    } catch {
      await enqueueOfflineAction({
        queueId: `OFF_LSS_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ownerId: user.uid,
        createdAtIso: new Date().toISOString(),
        kind: "UPSERT_OPS_RECORD",
        label,
        record: fullRecord,
      });
      setOfflineQueue(await getQueuedOfflineActions(user.uid));
      return "OFFLINE";
    }
  };

  const handleUpdateLifeSafetyConfig = async (updates: Partial<LifeSafetyConfig>) => {
    if (!user || !workspace) return;
    if (!canOperateLifeSafety(workspace.operatorRole)) {
      setSentinelFeedback({
        ok: false,
        message: "Permission denied: Mission Observer cannot modify life-safety configuration.",
      });
      return;
    }
    const nowIso = new Date().toISOString();
    const nextCfg: LifeSafetyConfig = {
      ...lifeSafetyConfig,
      ...updates,
      updatedAtIso: nowIso,
    };
    const rec = serializeLifeSafetyConfigToOpsRecord(nextCfg, opsState.activeCrewId, user.uid);
    setClockTickIso(nowIso);
    const mode = await persistOpsRecordOfflineFirst(rec, "Life-Safety Sentinel schedule update");
    setSentinelFeedback({
      ok: true,
      message:
        mode === "OFFLINE"
          ? "Check-in schedule saved locally in IndexedDB offline queue."
          : "Saved Life-Safety Sentinel schedule & responder configuration.",
    });
  };

  const handleRecordScheduledCheckin = async () => {
    if (!user || !workspace) return;
    if (!canOperateLifeSafety(workspace.operatorRole)) return;
    const nowIso = new Date().toISOString();
    const nextCfg: LifeSafetyConfig = {
      ...lifeSafetyConfig,
      lastCheckinAtIso: nowIso,
      simulatedElapsedOffsetMinutes: 0,
      activeWelfareEventId: null,
      updatedAtIso: nowIso,
    };
    const rec = serializeLifeSafetyConfigToOpsRecord(nextCfg, opsState.activeCrewId, user.uid);
    setClockTickIso(nowIso);
    const mode = await persistOpsRecordOfflineFirst(rec, "Scheduled crew check-in confirmation");
    setSentinelFeedback({
      ok: true,
      message:
        mode === "OFFLINE"
          ? "Check-in confirmation recorded offline (note: open emergency events remain open until explicit closure)."
          : "Recorded crew check-in confirmation and reset next due timer.",
    });
  };

  const handleTriggerEmergencyRequest = async (input: {
    category: EmergencyCategory;
    notes: string;
  }) => {
    if (!user || !workspace) return;
    if (!canOperateLifeSafety(workspace.operatorRole)) {
      setSentinelFeedback({
        ok: false,
        message: "Permission denied: Mission Observer cannot create emergency requests.",
      });
      return;
    }
    setIsBusy(true);
    try {
      const nowIso = checkinEval.effectiveNowIso || new Date().toISOString();
      const ev = createEmergencyLifeSafetyEvent({
        nowIso,
        astronautId: baseline.astronaut_id,
        astronautName: activeCrewMember?.name || workspace.astronautName,
        activeCrewId: opsState.activeCrewId,
        actorName: actorLabel,
        actorRole: workspace.operatorRole,
        category: input.category,
        notes: input.notes,
        latest,
        eclss: opsState.eclss,
        envAssessment,
        config: lifeSafetyConfig,
        crewRoster,
        continuityState,
        earthWanConnected: workspace.earthWanConnected,
        browserOnline,
      });
      const rec = serializeLifeSafetyEventToOpsRecord(ev, user.uid);
      const mode = await persistOpsRecordOfflineFirst(rec, ev.title);
      if (input.category === "MISSED_CHECKIN") {
        const nextCfg: LifeSafetyConfig = {
          ...lifeSafetyConfig,
          activeWelfareEventId: ev.eventId,
          updatedAtIso: nowIso,
        };
        await persistOpsRecordOfflineFirst(
          serializeLifeSafetyConfigToOpsRecord(nextCfg, opsState.activeCrewId, user.uid),
          "Welfare check activation"
        );
      }
      setEmergencyModalOpen(false);
      navigateTo("life-safety");
      setSentinelFeedback({
        ok: true,
        message:
          mode === "OFFLINE"
            ? `Priority emergency event ${ev.eventId} recorded offline in IndexedDB; will sync automatically on reconnect.`
            : `Priority emergency event ${ev.eventId} logged and primary responder (${ev.primaryResponderName}) notified.`,
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleTransitionLifeSafetyEvent = async (
    eventId: string,
    action:
      | { type: "ACKNOWLEDGE_PRIMARY" | "ACKNOWLEDGE_BACKUP"; note?: string }
      | { type: "ESCALATE_BACKUP"; reason?: string }
      | { type: "RECORD_RESPONSE"; procedureRef: string; actionNote: string }
      | { type: "ADD_FOLLOWUP"; followUpNote: string }
      | { type: "RESOLVE_RETAIN"; resolutionNote: string }
  ) => {
    if (!user || !workspace) return;
    const target = lifeSafetyEvents.find((e) => e.eventId === eventId);
    if (!target) return;
    setIsBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const latestObsList =
        action.type === "ADD_FOLLOWUP"
          ? Object.values(latest.status_by_parameter || {})
              .filter((s) => !s.isStaleOrUnavailable && s.liveValue !== null)
              .slice(0, 6)
              .map((s) => `${s.parameter}: ${s.liveValue} (${s.freshness})`)
          : undefined;

      const updated = applyLifeSafetyTransition(
        target,
        action.type === "ADD_FOLLOWUP"
          ? { ...action, observationsSummary: latestObsList }
          : action,
        {
          actorName: actorLabel,
          actorRole: workspace.operatorRole,
          nowIso,
          earthWanConnected: workspace.earthWanConnected,
          browserOnline,
        }
      );
      const rec = serializeLifeSafetyEventToOpsRecord(updated, user.uid);
      const mode = await persistOpsRecordOfflineFirst(rec, `Life-safety ${action.type}`);
      if (
        action.type === "RESOLVE_RETAIN" &&
        lifeSafetyConfig.activeWelfareEventId === eventId
      ) {
        const nextCfg: LifeSafetyConfig = {
          ...lifeSafetyConfig,
          activeWelfareEventId: null,
          updatedAtIso: nowIso,
        };
        await persistOpsRecordOfflineFirst(
          serializeLifeSafetyConfigToOpsRecord(nextCfg, opsState.activeCrewId, user.uid),
          "Clear active welfare link"
        );
      }
      setSentinelFeedback({
        ok: true,
        message:
          mode === "OFFLINE"
            ? `Updated ${eventId} (${updated.state}) in IndexedDB offline queue.`
            : `Updated ${eventId} → ${updated.state.replace(/_/g, " ")}.`,
      });
    } catch (err) {
      setSentinelFeedback({
        ok: false,
        message: formatErr(err, "Could not update life-safety event."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveGuidanceIncident = async (
    incident: GuidanceIncidentRecord,
    label: string
  ) => {
    if (!user) return;
    setIsBusy(true);
    try {
      const rec = serializeGuidanceIncidentToOpsRecord(incident, user.uid);
      const mode = await persistOpsRecordOfflineFirst(rec, label);
      setMedicalGuidanceFeedback({
        ok: true,
        message:
          mode === "OFFLINE"
            ? `${label} — saved locally in IndexedDB offline queue (will sync on reconnect).`
            : `${label} — saved (${incident.incidentId}).`,
      });
    } catch (err) {
      setMedicalGuidanceFeedback({
        ok: false,
        message: formatErr(err, "Could not save medical guidance incident."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleQueueGuidanceEarthHandoff = async (incident: GuidanceIncidentRecord) => {
    if (!user || !workspace) return;
    setIsBusy(true);
    try {
      const ctx = buildPersonalizedGuidanceContext({
        subjectCrewId: incident.subjectCrewId,
        intake: incident.screeningInput,
        baseline,
        latest,
        envAssessment,
        incidents,
        lifeSafetyEvents,
        subjectiveHistory,
        resolvedEquipment,
        crewRoster,
        continuityState,
        lifeSafetyConfig,
        earthWanConnected: workspace.earthWanConnected,
        browserOnline,
        viewerRole: workspace.operatorRole,
      });
      const earthAvailable = workspace.earthWanConnected && browserOnline;
      const pkg = buildConsultationItemFromGuidanceIncident(
        incident,
        ctx,
        baseline,
        earthAvailable
      );

      const updatedInc: GuidanceIncidentRecord = {
        ...incident,
        updatedAtIso: new Date().toISOString(),
        earthConsultationStatus: earthAvailable ? "SYNCED_EARTH" : "QUEUED_OFFLINE",
      };
      await persistOpsRecordOfflineFirst(
        serializeGuidanceIncidentToOpsRecord(updatedInc, user.uid),
        `Earth handoff status (${updatedInc.earthConsultationStatus})`
      );

      if (!browserOnline) {
        const msgRec: Omit<OpsRecordDoc, "ownerId"> = {
          recordId: `HANDOFF_${incident.incidentId.slice(0, 80)}`,
          recordType: "CONSULT_MSG",
          crewId: incident.subjectCrewId.slice(0, 64),
          title: `Queued Medical Help Handoff (${incident.incidentId})`.slice(0, 195),
          status: "QUEUED_LOCAL",
          timestampIso: updatedInc.updatedAtIso,
          payload: {
            sender: "CREW_OPERATOR",
            senderName: actorLabel,
            body: pkg.payload.markdown_report.slice(0, 1500),
            attachmentLabel: `${incident.incidentId}_handoff.md`,
            attachmentKind: "MEDICAL_GUIDANCE_HANDOFF",
            lightDelayLabel: LIGHT_DELAY_META[opsState.lightDelayMode].roundTripText,
          },
        };
        await enqueueOfflineAction({
          queueId: `OFF_MEDHAND_${Date.now()}`,
          ownerId: user.uid,
          createdAtIso: updatedInc.updatedAtIso,
          kind: "UPSERT_OPS_RECORD",
          label: `Offline medical help handoff (${incident.incidentId})`,
          record: { ownerId: user.uid, ...msgRec },
        });
        setOfflineQueue(await getQueuedOfflineActions(user.uid));
        setMedicalGuidanceFeedback({
          ok: true,
          message: `Browser offline — Medical Help Handoff (${incident.incidentId}) queued locally in IndexedDB.`,
        });
        return;
      }

      const res = await saveEarthHandoffPackageInCloud(user.uid, pkg);
      setMedicalGuidanceFeedback({
        ok: res.ok,
        message: earthAvailable
          ? `Earth Consultation Package (${pkg.package_id}) synced to Earth queue.`
          : `Earth comms unavailable — Consultation Package (${pkg.package_id}) saved with PENDING status until link restores.`,
      });
    } catch (err) {
      setMedicalGuidanceFeedback({
        ok: false,
        message: formatErr(err, "Could not queue Earth medical handoff."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveProcedureChecklistLog = async (
    procedureId: string,
    procedureTitle: string,
    incidentId: string,
    completedSteps: number[],
    totalSteps: number,
    note: string
  ) => {
    if (!user) return;
    const nowIso = new Date().toISOString();
    const record: Omit<OpsRecordDoc, "ownerId"> = {
      recordId: `CHK_PROC_${Date.now()}`,
      recordType: "CHECKLIST_LOG",
      crewId: opsState.activeCrewId,
      title: `${procedureId}: ${procedureTitle}`.slice(0, 200),
      status: `${completedSteps.length}_OF_${totalSteps}_STEPS`,
      timestampIso: nowIso,
      payload: {
        procedureId,
        incidentId,
        completedCount: completedSteps.length,
        totalSteps,
        stepsJoined: completedSteps.join(","),
        note: note.slice(0, 300),
      },
    };

    if (!browserOnline) {
      await enqueueOfflineAction({
        queueId: `OFF_CHKPROC_${Date.now()}`,
        ownerId: user.uid,
        createdAtIso: nowIso,
        kind: "UPSERT_OPS_RECORD",
        label: `Continuity checklist (${procedureId})`,
        record: { ownerId: user.uid, ...record },
      });
      setOfflineQueue(await getQueuedOfflineActions(user.uid));
      setSyncFeedback({
        ok: true,
        message: `Saved ${procedureId} progress to offline buffer.`,
      });
      return;
    }

    setIsBusy(true);
    try {
      await upsertOpsRecordInCloud(user.uid, record);
      setSyncFeedback({
        ok: true,
        message: `Checklist progress for ${procedureId} (${completedSteps.length}/${totalSteps} steps) logged.`,
      });
    } catch (err) {
      setSyncFeedback({
        ok: false,
        message: formatErr(err, "Could not save guided procedure checklist log."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveEarthHandoff = async (
    handoff: ReturnType<typeof buildEarthHandoffPackage>,
    incident: IncidentRecord | undefined
  ) => {
    if (!user) return;
    setIsBusy(true);
    try {
      const pkgItem = buildEarthHandoffConsultationItem(handoff, incident, "PENDING");
      const res = await saveEarthHandoffPackageInCloud(user.uid, pkgItem);
      setSyncFeedback({ ok: res.ok, message: res.message });
    } catch (err) {
      setSyncFeedback({
        ok: false,
        message: formatErr(err, "Could not save Earth Handoff Package."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveEvaSession = async (summary: EvaSessionSummary) => {
    if (!user) return;
    setIsBusy(true);
    try {
      await upsertOpsRecordInCloud(user.uid, {
        recordId: `EVA_${Date.now()}`,
        recordType: "EVA_SESSION",
        crewId: opsState.activeCrewId,
        title: summary.suitId,
        status: summary.leakCheckPassed && summary.dcsSymptomGrade === "NONE" ? "GO_NOMINAL" : "HOLD_REVIEW",
        timestampIso: new Date().toISOString(),
        payload: { ...summary },
      });
    } catch (err) {
      setStorageFeedback({ ok: false, message: formatErr(err, "Could not save EVA readiness log.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleLogMedDose = async (record: OpsRecordDoc) => {
    if (!user) return;
    const prevStock = Number(record.payload.stockQty || 0);
    const prevToday = Number(record.payload.dosesLoggedToday || 0);
    setIsBusy(true);
    try {
      await upsertOpsRecordInCloud(user.uid, {
        ...record,
        status: prevStock - 1 <= 15 ? "LOW_STOCK" : "STOCKED",
        payload: {
          ...record.payload,
          stockQty: Math.max(0, prevStock - 1),
          dosesLoggedToday: prevToday + 1,
          lastTakenIso: new Date().toISOString(),
        },
      });
      await awardRoutineCompletion("TASK_ARED_VITD");
    } catch (err) {
      setStorageFeedback({ ok: false, message: formatErr(err, "Could not log medication dose.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddSupplyItem = async (
    name: string,
    category: string,
    schedule: string,
    qty: number,
    unit: string,
    expiresOn: string
  ) => {
    if (!user) return;
    setIsBusy(true);
    try {
      await upsertOpsRecordInCloud(user.uid, {
        recordId: `MED_${Date.now()}`,
        recordType: "MED_LOG",
        crewId: opsState.activeCrewId,
        title: name,
        status: qty <= 15 ? "LOW_STOCK" : "STOCKED",
        timestampIso: new Date().toISOString(),
        payload: {
          category,
          dosageOrSchedule: schedule,
          stockQty: qty,
          unit,
          expiresOn,
          dosesLoggedToday: 0,
        },
      });
    } catch (err) {
      setStorageFeedback({ ok: false, message: formatErr(err, "Could not add supply item.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSavePvtResult = async (summary: PvtResultSummary) => {
    if (!user) return;
    setIsBusy(true);
    try {
      await upsertOpsRecordInCloud(user.uid, {
        recordId: `PVT_${Date.now()}`,
        recordType: "PVT_COGNITIVE",
        crewId: opsState.activeCrewId,
        title: `PVT ${summary.meanRtMs} ms`,
        status: summary.lapsesCount > 1 ? "FATIGUE_WATCH" : "ALERT_NOMINAL",
        timestampIso: new Date().toISOString(),
        payload: { ...summary },
      });
      await awardRoutineCompletion("TASK_PVT_ALERT", "MIND_STEADY");
    } catch (err) {
      setStorageFeedback({ ok: false, message: formatErr(err, "Could not save PVT result.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendConsultMessage = async (input: {
    body: string;
    attachmentLabel: string;
    attachmentKind: string;
    requestGroundReply: boolean;
  }) => {
    if (!user) return;
    const nowIso = new Date().toISOString();
    const record: Omit<OpsRecordDoc, "ownerId"> = {
      recordId: `MSG_CREW_${Date.now()}`,
      recordType: "CONSULT_MSG",
      crewId: opsState.activeCrewId,
      title: `Crew Message (${LIGHT_DELAY_META[opsState.lightDelayMode].label})`,
      status: input.requestGroundReply ? "SENT" : "QUEUED_LOCAL",
      timestampIso: nowIso,
      payload: {
        sender: "CREW_OPERATOR",
        senderName: activeCrewMember?.name || workspace?.astronautName || "Crew Operator",
        body: input.body,
        attachmentLabel: input.attachmentLabel,
        attachmentKind: input.attachmentKind,
        lightDelayLabel: LIGHT_DELAY_META[opsState.lightDelayMode].roundTripText,
      },
    };

    if (!browserOnline || !workspace?.earthWanConnected) {
      await enqueueOfflineAction({
        queueId: `OFF_MSG_${Date.now()}`,
        ownerId: user.uid,
        createdAtIso: nowIso,
        kind: "UPSERT_OPS_RECORD",
        label: `Flight Surgeon message (${input.body.slice(0, 30)}...)`,
        record: { ownerId: user.uid, ...record },
      });
      setOfflineQueue(await getQueuedOfflineActions(user.uid));
      setSyncFeedback({
        ok: false,
        message: !browserOnline
          ? "Browser offline — note buffered in IndexedDB queue and will deliver on reconnect."
          : "Simulated Earth link unavailable — note queued locally until link is restored.",
      });
      return;
    }

    setIsBusy(true);
    try {
      await upsertOpsRecordInCloud(user.uid, record);
      if (input.requestGroundReply) {
        const replyIso = new Date(Date.now() + 1000).toISOString();
        await upsertOpsRecordInCloud(user.uid, {
          recordId: `MSG_FS_${Date.now() + 1}`,
          recordType: "CONSULT_MSG",
          crewId: opsState.activeCrewId,
          title: "Flight Surgeon Guidance Reply",
          status: "RECEIVED",
          timestampIso: replyIso,
          payload: {
            sender: "EARTH_FLIGHT_SURGEON",
            senderName: "Dr. M. Hollis (Ground Flight Surgeon)",
            body: input.attachmentLabel
              ? `Received "${input.attachmentLabel}". Continue seated rest + 250 mL hydration, re-check ocular comfort and CO2 scrubber telemetry in 30 minutes.`
              : "Acknowledged note. Maintain hydration & CDRA scrubber watch; transmit follow-up readings after next rest block.",
            attachmentLabel: "",
            attachmentKind: "",
            lightDelayLabel: LIGHT_DELAY_META[opsState.lightDelayMode].roundTripText,
          },
        });
      }
      setSyncFeedback({
        ok: true,
        message: "Consultation note & diagnostic capture synced with Flight Surgeon channel.",
      });
    } catch (err) {
      setSyncFeedback({
        ok: false,
        message: formatErr(err, "Could not send consultation message."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveVoiceMemo = async (input: {
    group: CheckinGroupId;
    parameterLabel: string;
    blob: Blob;
    mimeType: string;
    durationSec: number;
    note: string;
  }) => {
    if (!user) return;
    const nowIso = new Date().toISOString();
    const memoId = `MEMO_${Date.now()}`;
    const entry: StoredVoiceMemoRecord = {
      memoId,
      ownerId: user.uid,
      crewId: opsState.activeCrewId,
      observationGroup: input.group,
      parameterLabel: input.parameterLabel,
      durationSec: input.durationSec,
      mimeType: input.mimeType,
      sizeBytes: input.blob.size,
      note: input.note,
      createdAtIso: nowIso,
      audioBlob: input.blob,
    };

    await saveVoiceMemoBlob(entry);
    setStoredVoiceMemos(await getVoiceMemosForOwner(user.uid));

    const record: Omit<OpsRecordDoc, "ownerId"> = {
      recordId: memoId,
      recordType: "VOICE_MEMO",
      crewId: opsState.activeCrewId,
      title: input.parameterLabel.slice(0, 200),
      status: "RECORDED",
      timestampIso: nowIso,
      payload: {
        observationGroup: input.group,
        parameterLabel: input.parameterLabel,
        durationSec: input.durationSec,
        mimeType: input.mimeType,
        sizeBytes: input.blob.size,
        note: input.note.slice(0, 300),
      },
    };

    if (!browserOnline) {
      await enqueueOfflineAction({
        queueId: `OFF_MEMO_${Date.now()}`,
        ownerId: user.uid,
        createdAtIso: nowIso,
        kind: "UPSERT_OPS_RECORD",
        label: `Voice memo (${input.parameterLabel})`,
        record: { ownerId: user.uid, ...record },
      });
      setOfflineQueue(await getQueuedOfflineActions(user.uid));
      setVitalsFeedback({
        ok: true,
        message: "Voice memo stored locally; cloud metadata queued for sync.",
      });
      return;
    }

    try {
      await upsertOpsRecordInCloud(user.uid, record);
      setVitalsFeedback({
        ok: true,
        message: `Saved ${input.durationSec}s voice memo for ${input.parameterLabel}.`,
      });
    } catch (err) {
      setVitalsFeedback({
        ok: false,
        message: formatErr(err, "Voice memo stored in browser IndexedDB, but cloud metadata sync failed."),
      });
    }
  };

  const saveRoutineState = async (next: RoutineGamificationState) => {
    if (!user) return;
    await upsertOpsRecordInCloud(user.uid, {
      recordId: "REC_MISSION_ROUTINE",
      recordType: "GAMIFICATION_ROUTINE",
      crewId: opsState.activeCrewId,
      title: `Mission Routine (${MISSION_ENVIRONMENT_META[next.environmentMode].shortLabel})`,
      status: `${next.completedTaskIds.length}/${MISSION_ROUTINE_TASKS.length}_DONE`,
      timestampIso: new Date().toISOString(),
      payload: {
        environmentMode: next.environmentMode,
        completedDateUtc: next.completedDateUtc,
        completedTaskIdsCsv: next.completedTaskIds.join(",").slice(0, 400),
        streakDays: next.streakDays,
        readinessPoints: next.readinessPoints,
        earnedBadgesCsv: next.earnedBadges.join(",").slice(0, 400),
        onboardingCompleted: next.onboardingCompleted,
      },
    });
  };

  const handleCompleteTour = async () => {
    setTourOpen(false);
    if (!user) return;
    try {
      window.localStorage.setItem(`aegis_v_tour_done_${user.uid}`, "true");
    } catch {
      // ignore storage errors
    }
    await saveRoutineState({
      ...routineState,
      onboardingCompleted: true,
    });
  };

  const handleStartTour = () => {
    setActivePage("home");
    setTourOpen(true);
  };

  const awardRoutineCompletion = async (taskId?: string, extraBadgeId?: string) => {
    const tasks = new Set(routineState.completedTaskIds);
    let points = routineState.readinessPoints;
    if (taskId && !tasks.has(taskId)) {
      tasks.add(taskId);
      points += 20;
    }
    const badges = new Set(routineState.earnedBadges);
    if (extraBadgeId) badges.add(extraBadgeId);
    if (tasks.size >= 3) badges.add("DAILY_CADENCE");
    if (tasks.size >= MISSION_ROUTINE_TASKS.length) badges.add("MISSION_READY_100");
    if (routineState.streakDays >= 3) badges.add("MISSION_STREAK_3");

    await saveRoutineState({
      ...routineState,
      completedTaskIds: Array.from(tasks),
      readinessPoints: points,
      earnedBadges: Array.from(badges),
    });
  };

  const handleChangeEnvironment = async (env: MissionEnvironmentId) => {
    if (!user) return;
    setIsBusy(true);
    try {
      const suggestedDelay = MISSION_ENVIRONMENT_META[env].suggestedLightDelay;
      await Promise.all([
        saveRoutineState({ ...routineState, environmentMode: env }),
        updateOpsStateInCloud(user.uid, { lightDelayMode: suggestedDelay }),
      ]);
    } catch (err) {
      setStorageFeedback({ ok: false, message: formatErr(err, "Could not switch environment.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleRoutineTask = async (taskId: string) => {
    if (!user) return;
    setIsBusy(true);
    try {
      const exists = routineState.completedTaskIds.includes(taskId);
      const nextTasks = exists
        ? routineState.completedTaskIds.filter((id) => id !== taskId)
        : [...routineState.completedTaskIds, taskId];
      const nextPoints = Math.max(0, routineState.readinessPoints + (exists ? -20 : 20));
      const badges = new Set(routineState.earnedBadges);
      if (nextTasks.length >= 3) badges.add("DAILY_CADENCE");
      if (nextTasks.length >= MISSION_ROUTINE_TASKS.length) badges.add("MISSION_READY_100");
      await saveRoutineState({
        ...routineState,
        completedTaskIds: nextTasks,
        readinessPoints: nextPoints,
        earnedBadges: Array.from(badges),
      });
    } catch (err) {
      setStorageFeedback({ ok: false, message: formatErr(err, "Could not update routine task.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveExtendedBio = async (input: {
    bloodGlucoseMgDl: number;
    coreTempC: number;
    notes: string;
  }) => {
    if (!user) return;
    setIsBusy(true);
    try {
      await upsertOpsRecordInCloud(user.uid, {
        recordId: `BIO_EXT_${Date.now()}`,
        recordType: "BIO_EXTENDED",
        crewId: opsState.activeCrewId,
        title: `Glucose ${input.bloodGlucoseMgDl} mg/dL · Temp ${input.coreTempC.toFixed(1)} °C`,
        status: "RECORDED",
        timestampIso: new Date().toISOString(),
        payload: {
          kind: "BLOOD_SUGAR_TEMP",
          bloodGlucoseMgDl: input.bloodGlucoseMgDl,
          coreTempC: input.coreTempC,
          notes: input.notes.slice(0, 200),
        },
      });
      await awardRoutineCompletion("TASK_HYDRATION_GLUCOSE", "BIO_COMPLETE");
      setVitalsFeedback({
        ok: true,
        message: `Saved extended check-in (Glucose ${input.bloodGlucoseMgDl} mg/dL, Core Temp ${input.coreTempC.toFixed(1)} °C).`,
      });
    } catch (err) {
      setVitalsFeedback({ ok: false, message: formatErr(err, "Could not save extended biometrics.") });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveDiagnosticScan = async (input: {
    bodyRegion: BodyRegionId;
    modality: DiagnosticScanEntry["modality"];
    caption: string;
    imageDataUrl: string;
    mimeType: string;
    sizeBytes: number;
  }) => {
    if (!user) return;
    setIsBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const scanId = `SCAN_${Date.now()}`;
      const record: StoredDiagnosticScan = {
        scanId,
        ownerId: user.uid,
        crewId: opsState.activeCrewId,
        bodyRegion: input.bodyRegion,
        modality: input.modality,
        caption: input.caption,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        createdAtIso: nowIso,
        imageDataUrl: input.imageDataUrl,
      };
      await saveDiagnosticScanImage(record);
      setStoredScans(await getDiagnosticScansForOwner(user.uid));

      await upsertOpsRecordInCloud(user.uid, {
        recordId: scanId,
        recordType: "BIO_EXTENDED",
        crewId: opsState.activeCrewId,
        title: input.caption.slice(0, 200),
        status: "CAPTURED",
        timestampIso: nowIso,
        payload: {
          kind: "DIAGNOSTIC_SCAN",
          bodyRegion: input.bodyRegion,
          modality: input.modality,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
        },
      });
      await awardRoutineCompletion(
        input.bodyRegion === "eyes" ? "TASK_SANS_CABIN" : undefined,
        input.bodyRegion === "eyes" ? "OCULAR_WATCH" : "BIO_COMPLETE"
      );
      setVitalsFeedback({
        ok: true,
        message: `Saved ${input.modality.replace(/_/g, " ")} image privately (${input.bodyRegion}).`,
      });
    } catch (err) {
      setVitalsFeedback({
        ok: false,
        message: formatErr(err, "Could not save diagnostic scan image."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteDiagnosticScan = async (scanId: string) => {
    if (!user) return;
    setIsBusy(true);
    try {
      await deleteDiagnosticScanImage(user.uid, scanId);
      setStoredScans(await getDiagnosticScansForOwner(user.uid));
      await deleteOpsRecordInCloud(user.uid, scanId);
      setVitalsFeedback({ ok: true, message: "Deleted saved diagnostic scan." });
    } catch (err) {
      setVitalsFeedback({
        ok: false,
        message: formatErr(err, "Could not delete diagnostic scan."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteVoiceMemo = async (memoId: string) => {
    if (!user) return;
    setIsBusy(true);
    try {
      await deleteVoiceMemoBlob(user.uid, memoId);
      setStoredVoiceMemos(await getVoiceMemosForOwner(user.uid));
      if (browserOnline && voiceMemoRecords.some((r) => r.recordId === memoId)) {
        await deleteOpsRecordInCloud(user.uid, memoId);
      }
      setVitalsFeedback({ ok: true, message: "Removed voice memo." });
    } catch (err) {
      setVitalsFeedback({
        ok: false,
        message: formatErr(err, "Could not remove voice memo."),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const navigateTo = (page: PageId) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  const handleExecuteAssistantAction = async (
    action: AssistantActionRequest
  ): Promise<string | null> => {
    if (!user || !workspace) return null;
    try {
      if (action.type === "NAVIGATE") {
        const validPages: PageId[] = [
          "landing",
          "home",
          "life-safety",
          "continuity",
          "medical-help",
          "body-map",
          "live-vitals",
          "daily-checkin",
          "alerts-response",
          "cabin-radiation",
          "reports-library",
          "shift-routine",
          "storage-history",
          "eva-readiness",
          "med-kit",
          "cognitive-readiness",
        ];
        if (validPages.includes(action.target as PageId)) {
          navigateTo(action.target as PageId);
          return action.label || `Opened ${action.target}`;
        }
      } else if (action.type === "ENVIRONMENT") {
        const validEnvs: MissionEnvironmentId[] = [
          "ISS_LEO",
          "TRANSIT_SPACECRAFT",
          "LUNAR_BASE",
          "MARS_ROVER",
        ];
        if (validEnvs.includes(action.target as MissionEnvironmentId)) {
          await handleChangeEnvironment(action.target as MissionEnvironmentId);
          return action.label || `Switched environment to ${action.target}`;
        }
      } else if (action.type === "SCENARIO") {
        const validScenes: DemoSceneId[] = [
          "SCENE_1_NORMAL",
          "SCENE_2_GRADUAL_ANOMALY",
          "SCENE_3_EXPLAIN",
          "SCENE_4_EARTH_UNAVAILABLE",
          "SCENE_5_RESPONSE_FOLLOWUP",
          "SCENE_6_CONNECTIVITY_RESTORED",
          "SCENE_7_CONTINUITY_CMO_UNAVAILABLE",
        ];
        if (validScenes.includes(action.target as DemoSceneId)) {
          await handleActivateScene(action.target as DemoSceneId);
          return action.label || `Activated ${action.target}`;
        }
      } else if (action.type === "START_TOUR") {
        handleStartTour();
        return action.label || "Opened Interactive Tour";
      }
    } catch (err) {
      setScenarioFeedback(formatErr(err, "Assistant action failed."));
    }
    return null;
  };

  if (!authReady) {
    return (
      <div className="min-h-screen text-slate-600 flex items-center justify-center text-sm">
        Checking your private session...
      </div>
    );
  }

  const effectivePage: PageId = !user ? "landing" : activePage;

  return (
    <div className="min-h-screen text-slate-900 flex flex-col">
      {/* Clean 3-Zone Frosted Glass Top Navigation Bar */}
      <header className="glass-header px-4 lg:px-8 py-3.5 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single-Element Brand Wordmark (Always navigates to Page 1 Showcase) */}
          <div className="flex items-center gap-3 shrink-0">
            {user && (
              <button
                type="button"
                aria-label="Toggle Menu"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-1.5 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200/80 bg-white/60 cursor-pointer"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigateTo("landing")}
              className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 hover:text-sky-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <AegisBrandIcon className="w-8 h-8 shrink-0 drop-shadow-xs" />
              <span>AEGIS-V</span>
            </button>
          </div>

          {/* Zone 2: Concise Single-Line Navigation Links */}
          {user ? (
            <nav className="hidden md:flex items-center gap-6">
              {TOP_NAV_SIGNED_IN.map((item) => {
                const isActive = effectivePage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 cursor-pointer ${
                      isActive
                        ? "text-slate-900 border-sky-600"
                        : "text-slate-600 border-transparent hover:text-slate-900"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.id === "alerts-response" && activeAlertCount > 0 && (
                      <span className="ml-1 font-mono text-xs font-semibold text-amber-700">
                        ({activeAlertCount})
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          ) : (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <a
                href="#capabilities"
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
              >
                How It Works
              </a>
              <a
                href="#privacy"
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
              >
                Private Storage
              </a>
            </nav>
          )}

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={signOutUser}
                className="px-3.5 py-2 text-xs font-medium text-slate-800 hover:text-slate-950 bg-white/75 hover:bg-white border border-slate-200/80 rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isSigningIn}
                onClick={signInWithGoogle}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isSigningIn ? "Signing in..." : "Sign in with Google"}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {user && mobileMenuOpen && (
          <nav className="md:hidden pt-3 mt-3 border-t border-slate-200/70 flex flex-col gap-1">
            {MOBILE_NAV_SIGNED_IN.map((item) => {
              const isActive = effectivePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`text-left px-3 py-2 rounded-xl text-sm font-medium cursor-pointer ${
                    isActive
                      ? "bg-sky-100/80 text-sky-950"
                      : "text-slate-700 hover:bg-white/70"
                  }`}
                >
                  {item.label}
                  {item.id === "alerts-response" && activeAlertCount > 0
                    ? ` (${activeAlertCount})`
                    : ""}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8">
        <div className="max-w-7xl mx-auto">
          {effectivePage === "landing" && (
            <LandingPage
              isAuthenticated={Boolean(user)}
              userEmail={user?.email ?? null}
              isSigningIn={isSigningIn}
              authError={authError}
              onSignIn={signInWithGoogle}
              onEnterHomeDashboard={() => navigateTo("home")}
            />
          )}

          {effectivePage !== "landing" && user && workspaceError && (
            <div className="glass-panel rounded-2xl p-6 max-w-lg mx-auto space-y-4">
              <h1 className="text-base font-semibold text-slate-900">
                Could not open private workspace
              </h1>
              <p className="text-xs text-rose-700 font-mono break-words">{workspaceError}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceError(null);
                    setWorkspaceReady(false);
                    setWorkspaceRetryCount((c) => c + 1);
                  }}
                  className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium rounded-xl cursor-pointer"
                >
                  Retry Workspace Load
                </button>
                <button
                  type="button"
                  onClick={signOutUser}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-xl cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {effectivePage !== "landing" && user && !workspaceError && (!workspaceReady || !workspace) && (
            <div className="glass-panel rounded-2xl p-10 text-center text-sm text-slate-600">
              Loading your private cloud workspace...
            </div>
          )}

          {effectivePage !== "landing" && user && workspace && !workspaceError && tourOpen && (
            <InteractiveOnboardingTour
              activePage={effectivePage}
              activeScene={workspace.activeScene}
              environmentMode={routineState.environmentMode}
              isBusy={isBusy}
              onNavigate={navigateTo}
              onActivateScene={handleActivateScene}
              onChangeEnvironment={handleChangeEnvironment}
              onCompleteTour={handleCompleteTour}
            />
          )}

          {effectivePage !== "landing" && user && workspace && !workspaceError && (
            <LifeSafetyBanner
              openEvents={openLifeSafetyEvents}
              checkinEval={checkinEval}
              envAssessment={envAssessment}
              browserOnline={browserOnline}
              earthWanConnected={workspace.earthWanConnected}
              activePageIsSentinel={effectivePage === "life-safety"}
              feedback={sentinelFeedback}
              onOpenSentinel={() => navigateTo("life-safety")}
              onOpenEmergencyModal={() => setEmergencyModalOpen(true)}
              onOpenMedicalHelp={() => {
                setMedicalGuidanceUrgentMode(false);
                navigateTo("medical-help");
              }}
            />
          )}

          {effectivePage === "home" && user && workspace && !workspaceError && (
            <HomeDashboardPage
              userEmail={user.email}
              astronautName={workspace.astronautName}
              missionName={workspace.missionName}
              operatorRole={workspace.operatorRole}
              baseline={baseline}
              latest={latest}
              incidents={incidents}
              consultationQueue={consultationQueue}
              earthWanConnected={workspace.earthWanConnected}
              browserOnline={browserOnline}
              activeScene={workspace.activeScene}
              totalSavedObservations={observations.length}
              snapshotCount={snapshots.length}
              opsState={opsState}
              crewRoster={crewRoster}
              offlineQueueCount={offlineQueue.length}
              evaLogsCount={evaRecords.length}
              medRecordsCount={medRecords.length}
              pvtRecordsCount={pvtRecords.length}
              routineState={routineState}
              extendedBio={extendedBio}
              shiftHandover={shiftHandover}
              sentinelSummary={{
                openEventsCount: openLifeSafetyEvents.length,
                checkinStatusHeadline: checkinEval.headline,
                checkinOverdue: checkinEval.statusCode === "MISSED_OVERDUE",
                envLevel: envAssessment.overallLevel,
              }}
              activeMedicalHelpCount={openGuidanceIncidents.length}
              isBusy={isBusy}
              scenarioFeedback={scenarioFeedback}
              onActivateScene={handleActivateScene}
              onChangeActivityMode={(mode: ActivityMode) =>
                handleUpdateOpsState({ activityMode: mode })
              }
              onChangeEnvironment={handleChangeEnvironment}
              onToggleRoutineTask={handleToggleRoutineTask}
              onSelectCrewMember={handleSelectCrewMember}
              onResumeInterruptedTask={handleResumeInterruptedTask}
              onOpenMedicalHelp={(urgentBypass) => {
                setMedicalGuidanceUrgentMode(Boolean(urgentBypass));
                navigateTo("medical-help");
              }}
              onStartTour={handleStartTour}
              onNavigate={navigateTo}
            />
          )}

          {effectivePage === "live-vitals" && user && workspace && !workspaceError && (
            <LiveVitalsPage
              baseline={baseline}
              latest={latest}
              histories={histories}
              activityMode={opsState.activityMode}
              onChangeActivityMode={(mode: ActivityMode) =>
                handleUpdateOpsState({ activityMode: mode })
              }
              onRecordVerifiedSensorHr={handleRecordVerifiedSensorHr}
              onInjectTestReading={handleInjectTestReading}
              onBackHome={() => navigateTo("home")}
              feedback={vitalsFeedback}
              isBusy={isBusy}
            />
          )}

          {effectivePage === "daily-checkin" && user && workspace && !workspaceError && (
            <DailyCheckinPage
              baseline={baseline}
              latest={latest}
              operatorRole={workspace.operatorRole}
              subjectiveHistory={subjectiveHistory}
              nutritionCatalogue={NUTRITION_CATALOGUE}
              storedMemos={storedVoiceMemos}
              cloudMemoRecords={voiceMemoRecords}
              extendedBio={extendedBio}
              storedScans={storedScans}
              onSubmitCheckin={handleSubmitCheckin}
              onSubmitSubjectiveCheckin={handleSubmitSubjectiveCheckin}
              onSaveVoiceMemo={handleSaveVoiceMemo}
              onDeleteVoiceMemo={handleDeleteVoiceMemo}
              onSaveExtendedBio={handleSaveExtendedBio}
              onSaveDiagnosticScan={handleSaveDiagnosticScan}
              onDeleteDiagnosticScan={handleDeleteDiagnosticScan}
              onBackHome={() => navigateTo("home")}
              feedback={vitalsFeedback}
              isBusy={isBusy}
            />
          )}

          {effectivePage === "alerts-response" && user && workspace && !workspaceError && (
            <AlertsResponsePage
              incidents={incidents}
              baseline={baseline}
              histories={histories}
              operatorRole={workspace.operatorRole}
              continuityActive={continuityState.continuityActive}
              cmoAvailable={continuityState.cmoAvailable}
              checklistProgressMap={incidentChecklistProgressMap}
              initialSelectedIncidentId={resumeIncidentId}
              onTransitionIncident={handleTransitionIncident}
              onSaveChecklistLog={handleSaveChecklistLog}
              onSaveChecklistProgress={handleSaveIncidentChecklistProgress}
              onOpenStorageSettings={() => navigateTo("storage-history")}
              onOpenContinuity={() => navigateTo("continuity")}
              onBackHome={() => navigateTo("home")}
              actionFeedback={alertFeedback}
              isBusy={isBusy}
            />
          )}

          {effectivePage === "cabin-radiation" && user && workspace && !workspaceError && (
            <CabinRadiationPage
              baseline={baseline}
              latest={latest}
              histories={histories}
              opsState={opsState}
              envAssessment={envAssessment}
              onUpdateOpsState={handleUpdateOpsState}
              onOpenLifeSafety={() => navigateTo("life-safety")}
              onTriggerEmergencyFromEnv={() => setEmergencyModalOpen(true)}
              onBackHome={() => navigateTo("home")}
              isBusy={isBusy}
            />
          )}

          {effectivePage === "reports-library" && user && workspace && !workspaceError && (
            <ReportsLibraryPage
              baseline={baseline}
              latest={latest}
              incidents={incidents}
              consultationQueue={consultationQueue}
              resources={CURATED_NASA_CSA_RESOURCES}
              earthWanConnected={workspace.earthWanConnected}
              browserOnline={browserOnline}
              lightDelayMode={opsState.lightDelayMode}
              opsState={opsState}
              environmentMode={routineState.environmentMode}
              extendedBio={extendedBio}
              storedScansCount={storedScans.length}
              voiceMemoCount={storedVoiceMemos.length}
              astronautName={activeCrewMember?.name || workspace.astronautName}
              missionName={workspace.missionName}
              consultMessages={consultMessages}
              onChangeLightDelayMode={(mode: LightDelayMode) =>
                handleUpdateOpsState({ lightDelayMode: mode })
              }
              onSendConsultMessage={handleSendConsultMessage}
              onGenerateBaseReport={handleGenerateBaseReport}
              onGeneratePackage={handleGeneratePackage}
              onSimulateSync={handleSimulateSync}
              onOpenContinuity={() => navigateTo("continuity")}
              onBackHome={() => navigateTo("home")}
              syncFeedback={syncFeedback}
              isBusy={isBusy}
            />
          )}

          {effectivePage === "storage-history" && user && workspace && !workspaceError && (
            <StorageHistoryPage
              userEmail={user.email}
              workspace={workspace}
              observations={observations}
              incidents={incidents}
              consultationQueue={consultationQueue}
              snapshots={snapshots}
              offlineQueue={offlineQueue}
              browserOnline={browserOnline}
              crewRoster={crewRoster}
              activeCrewId={opsState.activeCrewId}
              onSelectCrewMember={handleSelectCrewMember}
              onFlushOfflineQueue={flushOfflineQueue}
              onSaveSnapshot={handleSaveSnapshot}
              onDeleteSnapshot={handleDeleteSnapshot}
              onUpdateWorkspace={handleUpdateWorkspace}
              onResetScenario={handleActivateScene}
              onBackHome={() => navigateTo("home")}
              feedback={storageFeedback}
              isBusy={isBusy}
            />
          )}

          {effectivePage === "eva-readiness" && user && workspace && !workspaceError && (
            <EvaReadinessPage
              activeCrewId={opsState.activeCrewId}
              activeCrewName={activeCrewMember?.name || workspace.astronautName}
              evaRecords={evaRecords}
              onSaveEvaSession={handleSaveEvaSession}
              onBackHome={() => navigateTo("home")}
              isBusy={isBusy}
            />
          )}

          {effectivePage === "med-kit" && user && workspace && !workspaceError && (
            <MedKitPage
              activeCrewName={activeCrewMember?.name || workspace.astronautName}
              operatorRole={workspace.operatorRole}
              medRecords={medRecords}
              continuityState={continuityState}
              equipmentOverrides={continuityState.equipmentStatusOverrides}
              onConfirmEquipmentInventory={handleConfirmEquipmentInventory}
              onOpenContinuity={() => navigateTo("continuity")}
              onLogDose={handleLogMedDose}
              onAddSupplyItem={handleAddSupplyItem}
              onBackHome={() => navigateTo("home")}
              isBusy={isBusy}
            />
          )}

          {effectivePage === "cognitive-readiness" && user && workspace && !workspaceError && (
            <CognitiveReadinessPage
              activeCrewName={activeCrewMember?.name || workspace.astronautName}
              pvtRecords={pvtRecords}
              onSavePvtResult={handleSavePvtResult}
              onBackHome={() => navigateTo("home")}
              isBusy={isBusy}
            />
          )}

          {effectivePage === "body-map" && user && workspace && !workspaceError && (
            <BodyAtlasPage
              baseline={baseline}
              latest={latest}
              incidents={incidents}
              opsState={opsState}
              environmentMode={routineState.environmentMode}
              extendedBio={extendedBio}
              scanCountByRegion={scanCountByRegion}
              onChangeEnvironment={handleChangeEnvironment}
              onNavigate={navigateTo}
              onBackHome={() => navigateTo("home")}
              isBusy={isBusy}
            />
          )}

          {effectivePage === "continuity" && user && workspace && !workspaceError && (
            <ContinuityModePage
              activeScene={workspace.activeScene}
              operatorRole={workspace.operatorRole}
              earthWanConnected={workspace.earthWanConnected}
              browserOnline={browserOnline}
              baseline={baseline}
              observations={observations}
              incidents={incidents}
              consultationQueue={consultationQueue}
              resources={CURATED_NASA_CSA_RESOURCES}
              opsState={opsState}
              crewRoster={crewRoster}
              medRecords={medRecords}
              checklistLogs={checklistLogs}
              continuityState={continuityState}
              initialProcedureId={resumeProcedureId}
              missionName={workspace.missionName}
              isBusy={isBusy}
              syncFeedback={syncFeedback}
              onActivateScene={handleActivateScene}
              onUpdateWorkspace={handleUpdateWorkspace}
              onUpdateContinuityState={handleUpdateContinuityState}
              onConfirmEquipmentInventory={handleConfirmEquipmentInventory}
              onSaveProcedureChecklistLog={handleSaveProcedureChecklistLog}
              onSaveEarthHandoff={handleSaveEarthHandoff}
              onSimulateSync={handleSimulateSync}
              onNavigate={navigateTo}
              onBackHome={() => navigateTo("home")}
            />
          )}

          {effectivePage === "life-safety" && user && workspace && !workspaceError && (
            <LifeSafetySentinelPage
              astronautName={activeCrewMember?.name || workspace.astronautName}
              activeCrewId={opsState.activeCrewId}
              operatorRole={workspace.operatorRole}
              crewRoster={crewRoster}
              latest={latest}
              envAssessment={envAssessment}
              checkinEval={checkinEval}
              lifeSafetyConfig={lifeSafetyConfig}
              lifeSafetyEvents={lifeSafetyEvents}
              emergencyAnswers={emergencyAnswers}
              resolvedEquipment={resolvedEquipment}
              medRecords={medRecords}
              earthWanConnected={workspace.earthWanConnected}
              browserOnline={browserOnline}
              isBusy={isBusy}
              onOpenEmergencyModal={() => setEmergencyModalOpen(true)}
              onUpdateConfig={handleUpdateLifeSafetyConfig}
              onRecordCheckin={handleRecordScheduledCheckin}
              onInitiateWelfareCheck={(note) =>
                handleTriggerEmergencyRequest({ category: "MISSED_CHECKIN", notes: note })
              }
              onTransitionEvent={handleTransitionLifeSafetyEvent}
              onConfirmEquipmentInventory={handleConfirmEquipmentInventory}
              onNavigate={navigateTo}
              onBackHome={() => navigateTo("home")}
            />
          )}

          {effectivePage === "medical-help" && user && workspace && !workspaceError && (
            <MedicalGuidancePage
              missionName={workspace.missionName}
              actorName={actorLabel}
              operatorRole={workspace.operatorRole}
              activeCrewId={opsState.activeCrewId}
              crewRoster={crewRoster}
              baseline={baseline}
              latest={latest}
              envAssessment={envAssessment}
              incidents={incidents}
              lifeSafetyEvents={lifeSafetyEvents}
              lifeSafetyConfig={lifeSafetyConfig}
              subjectiveHistory={subjectiveHistory}
              resolvedEquipment={resolvedEquipment}
              continuityState={continuityState}
              resources={CURATED_NASA_CSA_RESOURCES}
              guidanceIncidents={guidanceIncidents}
              earthWanConnected={workspace.earthWanConnected}
              browserOnline={browserOnline}
              isBusy={isBusy}
              feedback={medicalGuidanceFeedback}
              initialUrgentMode={medicalGuidanceUrgentMode}
              onSaveGuidanceIncident={handleSaveGuidanceIncident}
              onQueueEarthHandoff={(inc) => handleQueueGuidanceEarthHandoff(inc)}
              onUpdateContinuityState={handleUpdateContinuityState}
              onUpdateEarthWan={(connected) =>
                handleUpdateWorkspace({ earthWanConnected: connected })
              }
              onOpenSentinel={() => navigateTo("life-safety")}
              onNavigate={navigateTo}
              onBackHome={() => navigateTo("home")}
            />
          )}

          {effectivePage === "shift-routine" && user && workspace && !workspaceError && (
            <ShiftRoutinePage
              astronautName={workspace.astronautName}
              missionName={workspace.missionName}
              operatorRole={workspace.operatorRole}
              baseline={baseline}
              activeScene={workspace.activeScene}
              opsState={opsState}
              crewRoster={crewRoster}
              routineState={routineState}
              shiftHandover={shiftHandover}
              offlineQueueCount={offlineQueue.length}
              isBusy={isBusy}
              scenarioFeedback={scenarioFeedback}
              onActivateScene={handleActivateScene}
              onChangeActivityMode={(mode: ActivityMode) =>
                handleUpdateOpsState({ activityMode: mode })
              }
              onChangeEnvironment={handleChangeEnvironment}
              onToggleRoutineTask={handleToggleRoutineTask}
              onSelectCrewMember={handleSelectCrewMember}
              onResumeInterruptedTask={handleResumeInterruptedTask}
              onStartTour={handleStartTour}
              onNavigate={navigateTo}
              onBackHome={() => navigateTo("home")}
            />
          )}
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="glass-header border-t border-slate-200/60 border-b-0 px-4 lg:px-8 pt-4 pb-20 sm:pb-16 text-xs text-slate-600 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 font-medium text-slate-700">
            <AegisBrandIcon className="w-5 h-5 shrink-0" />
            <span>AEGIS-V Private Crew Health Workspace</span>
          </span>
          <span>
            Research &amp; decision-support prototype — not a clinical medical device.
          </span>
        </div>
      </footer>

      {/* Emergency Request Confirmation Modal */}
      {user && workspace && !workspaceError && (
        <EmergencyRequestModal
          open={emergencyModalOpen}
          astronautName={activeCrewMember?.name || workspace.astronautName}
          activeCrewId={opsState.activeCrewId}
          operatorRole={workspace.operatorRole}
          primaryResponderName={
            crewRoster.find((c) => c.crewId === lifeSafetyConfig.primaryResponderCrewId)?.name ||
            lifeSafetyConfig.primaryResponderCrewId
          }
          earthWanConnected={workspace.earthWanConnected}
          browserOnline={browserOnline}
          latest={latest}
          isBusy={isBusy}
          onClose={() => setEmergencyModalOpen(false)}
          onConfirmTrigger={handleTriggerEmergencyRequest}
        />
      )}

      {/* Wake-Word Voice Agent & Grounded Chatbot */}
      <AegisAssistantDock
        isAuthenticated={Boolean(user && workspace && !workspaceError)}
        activePage={effectivePage}
        astronautName={workspace?.astronautName || actorLabel}
        baseline={baseline}
        latest={latest}
        incidents={incidents}
        earthWanConnected={workspace?.earthWanConnected ?? true}
        activityMode={opsState.activityMode}
        lightDelayMode={opsState.lightDelayMode}
        routineState={routineState}
        extendedBio={extendedBio}
        storedScansCount={storedScans.length}
        onExecuteAction={handleExecuteAssistantAction}
        onSaveCameraScan={user && workspace ? handleSaveDiagnosticScan : undefined}
      />
    </div>
  );
}
