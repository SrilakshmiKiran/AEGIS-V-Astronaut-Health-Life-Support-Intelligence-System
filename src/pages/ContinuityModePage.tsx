import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileJson,
  FileText,
  Lock,
  PackageCheck,
  Play,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Users,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";
import {
  ActorRole,
  BaselineProfile,
  ConsultationQueueItem,
  DemoSceneId,
  IncidentRecord,
  KnowledgeResource,
  PROTOTYPE_DISCLAIMER,
  RuleId,
  TelemetryObservation,
} from "../types/aegisContracts";
import { PageId } from "../types/navigation";
import {
  ContinuityPersistedState,
  CrewAvailabilityStatus,
  EquipmentOperationalStatus,
  GUIDED_PROCEDURES,
  ONBOARD_MEDICAL_EQUIPMENT,
  SIMULATED_CREW_CAPABILITIES,
} from "../types/continuityContracts";
import { CrewRosterMember, OpsRecordDoc, OpsStateDoc } from "../types/opsContracts";
import {
  buildEarthHandoffPackage,
  canConfirmEquipmentInventory,
  evaluateMissionSupportStatus,
  filterGuidedProcedures,
  formatMissionTimeUtc,
  isProcedureAuthorized,
  matchResourcesForIncident,
  resolveEquipmentInventory,
} from "../utils/aegisPureEngine";
import { SyncStatusText } from "../components/StatusText";
import { SafeImage } from "../components/SafeImage";
import { VISUAL_ASSETS } from "../assets/visualCatalog";

interface ContinuityModePageProps {
  activeScene: DemoSceneId;
  operatorRole: ActorRole;
  earthWanConnected: boolean;
  browserOnline: boolean;
  baseline: BaselineProfile;
  observations: TelemetryObservation[];
  incidents: IncidentRecord[];
  consultationQueue: ConsultationQueueItem[];
  resources: KnowledgeResource[];
  opsState: OpsStateDoc;
  crewRoster: CrewRosterMember[];
  medRecords: OpsRecordDoc[];
  checklistLogs: OpsRecordDoc[];
  continuityState: ContinuityPersistedState;
  initialProcedureId?: string | null;
  missionName: string;
  isBusy: boolean;
  syncFeedback: { ok: boolean; message: string } | null;
  onActivateScene: (sceneId: DemoSceneId) => Promise<void>;
  onUpdateWorkspace: (
    updates: Partial<{
      earthWanConnected: boolean;
      operatorRole: ActorRole;
    }>
  ) => Promise<void>;
  onUpdateContinuityState: (
    updater: (prev: ContinuityPersistedState) => ContinuityPersistedState
  ) => Promise<void>;
  onConfirmEquipmentInventory?: (equipmentId: string) => Promise<void>;
  onSaveProcedureChecklistLog: (
    procedureId: string,
    procedureTitle: string,
    incidentId: string,
    completedSteps: number[],
    totalSteps: number,
    note: string
  ) => Promise<void>;
  onSaveEarthHandoff: (
    handoff: ReturnType<typeof buildEarthHandoffPackage>,
    incident: IncidentRecord | undefined
  ) => Promise<void>;
  onSimulateSync: () => Promise<void>;
  onNavigate: (page: PageId) => void;
  onBackHome: () => void;
}

const CONTINUITY_STORY_STEPS: Array<{
  step: number;
  title: string;
  summary: string;
  sectionId: string;
}> = [
  {
    step: 1,
    title: "Incident Detected",
    summary: "INC-DEMO-001 triggered (SpO2 92.4%, Cabin CO2 5.4 mmHg); evidence preserved.",
    sectionId: "continuity-incident-context",
  },
  {
    step: 2,
    title: "Earth Comms Unavailable",
    summary: "Deep-space Earth WAN link severed; onboard operations remain functional offline.",
    sectionId: "continuity-controls",
  },
  {
    step: 3,
    title: "CMO Marked Unavailable",
    summary: "Designated CMO (Dr. Aris Chen) unavailable; CMO+PIN clinical gates remain locked.",
    sectionId: "continuity-controls",
  },
  {
    step: 4,
    title: "Replacement Operator Active",
    summary: "Cdr. Elena Vance (CREW_MEMBER) operates simplified Continuity view with clear role bounds.",
    sectionId: "continuity-crew-board",
  },
  {
    step: 5,
    title: "Mission Support Status",
    summary: "Deterministic view of what is available, missing, and uncertain — no fake % scores.",
    sectionId: "continuity-support-status",
  },
  {
    step: 6,
    title: "Medical Resource Readiness",
    summary: "Verify live Med Kit stock, equipment status, and missing Capnography gap.",
    sectionId: "continuity-resources",
  },
  {
    step: 7,
    title: "Guided Procedure Stepper",
    summary: "Search offline catalog and execute authorized PROC-ENV-CO2-01 step-by-step.",
    sectionId: "continuity-procedures",
  },
  {
    step: 8,
    title: "Log Checklist & Observations",
    summary: "Save crew-recorded steps and symptom notes into persistent workspace history.",
    sectionId: "continuity-procedures",
  },
  {
    step: 9,
    title: "Generate & Export Handoff",
    summary: "Compile structured Earth Handoff Package (.MD / .JSON) queued locally as PENDING.",
    sectionId: "continuity-handoff",
  },
  {
    step: 10,
    title: "Restore Link & Sync",
    summary: "Restore Earth link and flush PENDING handoff package to SYNCED.",
    sectionId: "continuity-handoff",
  },
];

export const ContinuityModePage: React.FC<ContinuityModePageProps> = ({
  activeScene,
  operatorRole,
  earthWanConnected,
  browserOnline,
  baseline,
  observations,
  incidents,
  consultationQueue,
  resources,
  opsState,
  crewRoster,
  medRecords,
  checklistLogs,
  continuityState,
  initialProcedureId = null,
  missionName,
  isBusy,
  syncFeedback,
  onActivateScene,
  onUpdateWorkspace,
  onUpdateContinuityState,
  onConfirmEquipmentInventory,
  onSaveProcedureChecklistLog,
  onSaveEarthHandoff,
  onSimulateSync,
  onNavigate,
  onBackHome,
}) => {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>("");
  const [procSearch, setProcSearch] = useState<string>("");
  const [procFilter, setProcFilter] = useState<
    "ALL" | "AUTHORIZED_ONLY" | "CMO_RESTRICTED" | RuleId
  >("ALL");
  const [selectedProcedureId, setSelectedProcedureId] = useState<string>(
    initialProcedureId || continuityState.activeProcedureId || "PROC-ENV-CO2-01"
  );
  const [activeStepIdx, setActiveStepIdx] = useState<number>(
    continuityState.procedureCurrentStep?.[
      initialProcedureId || continuityState.activeProcedureId || "PROC-ENV-CO2-01"
    ] ?? 0
  );
  const [procedureNote, setProcedureNote] = useState<string>(
    "Verified secondary finger oximeter fit and confirmed Node-2 CDRA airflow indicator nominal."
  );
  const [handoffCrewNote, setHandoffCrewNote] = useState<string>(
    "CMO off clinical duty; crew executed PROC-ENV-CO2-01 non-invasive checks and placed subject on seated rest hydration."
  );
  const [customQuestion, setCustomQuestion] = useState<string>("");
  const [localFeedback, setLocalFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [showMarkdownPreview, setShowMarkdownPreview] = useState<boolean>(false);

  useEffect(() => {
    const targetProc = initialProcedureId || continuityState.activeProcedureId;
    if (targetProc && GUIDED_PROCEDURES.some((p) => p.procedureId === targetProc)) {
      setSelectedProcedureId(targetProc);
      const savedIdx = continuityState.procedureCurrentStep?.[targetProc];
      if (savedIdx !== undefined) {
        setActiveStepIdx(savedIdx);
      }
    }
  }, [initialProcedureId, continuityState.activeProcedureId, continuityState.procedureCurrentStep]);

  const openIncidents = useMemo(
    () => incidents.filter((i) => i.state !== "CLOSED_RETAINED"),
    [incidents]
  );
  const activeIncident =
    incidents.find((i) => i.incident_id === selectedIncidentId) ||
    openIncidents[0] ||
    incidents[0];

  const replacementOperator =
    crewRoster.find((c) => c.crewId === continuityState.replacementOperatorCrewId) || crewRoster[0];

  const supportStatus = useMemo(
    () =>
      evaluateMissionSupportStatus({
        earthWanConnected,
        browserOnline,
        cmoAvailable: continuityState.cmoAvailable,
        continuityActive: continuityState.continuityActive,
        operatorRole,
        replacementOperatorName: replacementOperator?.name || "Crew Operator",
        crewRoster,
        crewCapabilities: SIMULATED_CREW_CAPABILITIES,
        crewAvailabilityOverrides: continuityState.crewAvailabilityOverrides,
        equipmentList: ONBOARD_MEDICAL_EQUIPMENT,
        equipmentOverrides: continuityState.equipmentStatusOverrides,
        procedures: GUIDED_PROCEDURES,
        offlineResourcesCount: resources.length,
        medRecords,
      }),
    [
      earthWanConnected,
      browserOnline,
      continuityState,
      operatorRole,
      replacementOperator,
      crewRoster,
      resources.length,
      medRecords,
    ]
  );

  const resourceMatch = useMemo(
    () =>
      matchResourcesForIncident(
        activeIncident,
        ONBOARD_MEDICAL_EQUIPMENT,
        continuityState.equipmentStatusOverrides,
        medRecords,
        GUIDED_PROCEDURES
      ),
    [activeIncident, continuityState.equipmentStatusOverrides, medRecords]
  );

  const filteredProcedures = useMemo(
    () =>
      filterGuidedProcedures(
        GUIDED_PROCEDURES,
        procSearch,
        procFilter,
        operatorRole,
        continuityState.cmoAvailable
      ),
    [procSearch, procFilter, operatorRole, continuityState.cmoAvailable]
  );

  const selectedProcedure =
    GUIDED_PROCEDURES.find((p) => p.procedureId === selectedProcedureId) ||
    filteredProcedures[0] ||
    GUIDED_PROCEDURES[0];

  const selectedProcAuth = isProcedureAuthorized(
    selectedProcedure,
    operatorRole,
    continuityState.cmoAvailable
  );
  const selectedDoneSteps = continuityState.procedureStepsDone[selectedProcedure.procedureId] || [];
  const clampedStepIdx = Math.max(0, Math.min(selectedProcedure.steps.length - 1, activeStepIdx));
  const currentStep = selectedProcedure.steps[clampedStepIdx];

  const generatedHandoff = useMemo(
    () =>
      buildEarthHandoffPackage({
        incident: activeIncident,
        baseline,
        observations,
        opsState,
        continuityState,
        operatorRole,
        crewRoster,
        checklistLogs,
        medRecords,
        equipmentList: ONBOARD_MEDICAL_EQUIPMENT,
        procedures: GUIDED_PROCEDURES,
        earthWanConnected,
        missionName,
        crewNotes: handoffCrewNote,
        unansweredQuestions: customQuestion.trim()
          ? [
              customQuestion.trim(),
              "2. Portable capnography / blood-gas analysis unavailable; advise whether additional oximetry or ocular ultrasound captures are needed upon Earth link recovery.",
            ]
          : undefined,
      }),
    [
      activeIncident,
      baseline,
      observations,
      opsState,
      continuityState,
      operatorRole,
      crewRoster,
      checklistLogs,
      medRecords,
      earthWanConnected,
      missionName,
      handoffCrewNote,
      customQuestion,
    ]
  );

  const handoffQueueItems = useMemo(
    () =>
      consultationQueue.filter(
        (q) =>
          q.package_id.startsWith("HANDOFF_") ||
          q.payload?.incident_summary?.procedure_reference === "CONTINUITY-HANDOFF"
      ),
    [consultationQueue]
  );

  const isSimplifiedNonMedicalView =
    continuityState.continuityActive &&
    (!continuityState.cmoAvailable || operatorRole !== "CREW_MEDICAL_OFFICER");

  const handleToggleCmoAvailability = async () => {
    const nextCmoAvail = !continuityState.cmoAvailable;
    await onUpdateContinuityState((prev) => ({
      ...prev,
      continuityActive: !nextCmoAvail ? true : prev.continuityActive,
      cmoAvailable: nextCmoAvail,
      cmoStatusReason: nextCmoAvail
        ? "Designated CMO (Dr. Aris Chen) marked AVAILABLE on shift."
        : "Simulated Contingency: Designated CMO (Dr. Aris Chen) marked UNAVAILABLE — replacement crew authorized only for non-CMO Continuity steps.",
      crewAvailabilityOverrides: {
        ...prev.crewAvailabilityOverrides,
        "AST-02-FE-PILOT": nextCmoAvail ? "AVAILABLE" : "UNAVAILABLE",
      },
      updatedAtIso: new Date().toISOString(),
    }));
    if (!nextCmoAvail && operatorRole === "CREW_MEDICAL_OFFICER") {
      await onUpdateWorkspace({ operatorRole: "CREW_MEMBER" });
    }
    setLocalFeedback({
      ok: true,
      message: nextCmoAvail
        ? "CMO marked AVAILABLE. Standard CMO role permissions can be used with CMO PIN (2026)."
        : "CMO marked UNAVAILABLE. Active workflow switched to CREW_MEMBER Continuity view; CMO-gated procedures remain locked.",
    });
  };

  const handleToggleContinuityMode = async () => {
    const nextActive = !continuityState.continuityActive;
    await onUpdateContinuityState((prev) => ({
      ...prev,
      continuityActive: nextActive,
      updatedAtIso: new Date().toISOString(),
    }));
  };

  const handleSelectReplacementOperator = async (crewId: string) => {
    const cap = SIMULATED_CREW_CAPABILITIES[crewId];
    if (cap?.medicalTier === "CMO_QUALIFIED" && !continuityState.cmoAvailable) {
      setLocalFeedback({
        ok: false,
        message:
          "Cannot assign an unavailable CMO as replacement operator or impersonate CMO authority.",
      });
      return;
    }
    await onUpdateContinuityState((prev) => ({
      ...prev,
      replacementOperatorCrewId: crewId,
      updatedAtIso: new Date().toISOString(),
    }));
    if (operatorRole === "MISSION_OBSERVER" || (operatorRole === "CREW_MEDICAL_OFFICER" && !continuityState.cmoAvailable)) {
      await onUpdateWorkspace({ operatorRole: "CREW_MEMBER" });
    }
  };

  const handleCycleCrewAvailability = async (crewId: string) => {
    const cap = SIMULATED_CREW_CAPABILITIES[crewId];
    if (cap?.medicalTier === "CMO_QUALIFIED" && !continuityState.cmoAvailable) {
      await handleToggleCmoAvailability();
      return;
    }
    const order: CrewAvailabilityStatus[] = ["AVAILABLE", "BUSY", "UNAVAILABLE"];
    const current =
      continuityState.crewAvailabilityOverrides[crewId] ?? cap?.defaultAvailability ?? "AVAILABLE";
    const next = order[(order.indexOf(current) + 1) % order.length];
    await onUpdateContinuityState((prev) => ({
      ...prev,
      crewAvailabilityOverrides: {
        ...prev.crewAvailabilityOverrides,
        [crewId]: next,
      },
      updatedAtIso: new Date().toISOString(),
    }));
  };

  const handleCycleEquipmentStatus = async (equipmentId: string, baseStatus: EquipmentOperationalStatus) => {
    const order: EquipmentOperationalStatus[] = ["OPERATIONAL", "LIMITED", "UNAVAILABLE"];
    const current = continuityState.equipmentStatusOverrides[equipmentId] ?? baseStatus;
    const next = order[(order.indexOf(current) + 1) % order.length];
    await onUpdateContinuityState((prev) => ({
      ...prev,
      equipmentStatusOverrides: {
        ...prev.equipmentStatusOverrides,
        [equipmentId]: next,
      },
      updatedAtIso: new Date().toISOString(),
    }));
  };

  const handleSelectProcedure = async (procedureId: string) => {
    setSelectedProcedureId(procedureId);
    const procObj = GUIDED_PROCEDURES.find((p) => p.procedureId === procedureId);
    const doneNums = continuityState.procedureStepsDone[procedureId] || [];
    const savedIdx = continuityState.procedureCurrentStep?.[procedureId];
    const firstTodoIdx = procObj
      ? procObj.steps.findIndex((s) => !doneNums.includes(s.stepNumber))
      : 0;
    const nextIdx =
      savedIdx !== undefined ? savedIdx : firstTodoIdx >= 0 ? firstTodoIdx : 0;
    setActiveStepIdx(nextIdx);

    await onUpdateContinuityState((prev) => ({
      ...prev,
      activeProcedureId: procedureId,
      accessedProcedureIds: Array.from(new Set([...prev.accessedProcedureIds, procedureId])),
      procedureCurrentStep: {
        ...(prev.procedureCurrentStep || {}),
        [procedureId]: nextIdx,
      },
      updatedAtIso: new Date().toISOString(),
    }));
  };

  const handleStepNavigation = async (nextIdx: number) => {
    setActiveStepIdx(nextIdx);
    await onUpdateContinuityState((prev) => ({
      ...prev,
      activeProcedureId: selectedProcedure.procedureId,
      procedureCurrentStep: {
        ...(prev.procedureCurrentStep || {}),
        [selectedProcedure.procedureId]: nextIdx,
      },
      updatedAtIso: new Date().toISOString(),
    }));
  };

  const handleToggleProcedureStep = async (stepNumber: number) => {
    if (!selectedProcAuth.allowed) {
      setLocalFeedback({ ok: false, message: selectedProcAuth.reason });
      return;
    }
    const exists = selectedDoneSteps.includes(stepNumber);
    const nextSteps = exists
      ? selectedDoneSteps.filter((n) => n !== stepNumber)
      : [...selectedDoneSteps, stepNumber].sort((a, b) => a - b);

    const firstTodoIdx = selectedProcedure.steps.findIndex(
      (s) => !nextSteps.includes(s.stepNumber)
    );
    const nextStepIdx = firstTodoIdx >= 0 ? firstTodoIdx : clampedStepIdx;
    setActiveStepIdx(nextStepIdx);

    await onUpdateContinuityState((prev) => ({
      ...prev,
      activeProcedureId: selectedProcedure.procedureId,
      accessedProcedureIds: Array.from(
        new Set([...prev.accessedProcedureIds, selectedProcedure.procedureId])
      ),
      procedureStepsDone: {
        ...prev.procedureStepsDone,
        [selectedProcedure.procedureId]: nextSteps,
      },
      procedureCurrentStep: {
        ...(prev.procedureCurrentStep || {}),
        [selectedProcedure.procedureId]: nextStepIdx,
      },
      updatedAtIso: new Date().toISOString(),
    }));
  };

  const handleDownloadHandoff = (format: "md" | "json") => {
    const content =
      format === "md"
        ? generatedHandoff.markdownDocument
        : JSON.stringify(generatedHandoff, null, 2);
    const mime = format === "md" ? "text/markdown" : "application/json";
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${generatedHandoff.packageId}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const jumpToWalkthroughStep = async (stepNum: number, sectionId: string) => {
    await onUpdateContinuityState((prev) => ({
      ...prev,
      walkthroughStep: stepNum,
      updatedAtIso: new Date().toISOString(),
    }));
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const replacementCandidates = crewRoster.filter(
    (c) => SIMULATED_CREW_CAPABILITIES[c.crewId]?.medicalTier !== "CMO_QUALIFIED"
  );

  return (
    <div className="space-y-6">
      {/* Header & Mission Autonomy Framing */}
      <div className="glass-panel rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-8 space-y-3">
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={onBackHome}
              className="text-xs font-medium text-sky-800 hover:text-sky-950 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home Dashboard</span>
            </button>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-sky-900">AEGIS CONTINUITY MODE</span>
              <span aria-hidden="true">·</span>
              <span>Earth-Independent Crew Support</span>
              <span aria-hidden="true">·</span>
              <span>Decision-Support &amp; Coordination Only (Not an Autonomous Doctor)</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Earth-Independent Crew Continuity &amp; CMO Handoff
            </h1>
            <p className="text-sm text-slate-600 max-w-3xl">
              Maintains structured incident awareness, role-bounded procedures, equipment &amp; Med Kit
              readiness, and Earth handoff packaging when Earth communications and the Crew Medical
              Officer are unavailable.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onActivateScene("SCENE_7_CONTINUITY_CMO_UNAVAILABLE")}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                activeScene === "SCENE_7_CONTINUITY_CMO_UNAVAILABLE"
                  ? "bg-amber-700 hover:bg-amber-800 text-white"
                  : "bg-slate-900 hover:bg-slate-800 text-white"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>
                {activeScene === "SCENE_7_CONTINUITY_CMO_UNAVAILABLE"
                  ? "Scenario 7 Active (Reset)"
                  : "Activate Scenario 7: CMO Unavailable"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate("alerts-response")}
              className="px-3.5 py-2.5 bg-white/85 hover:bg-white border border-slate-300/80 text-slate-800 rounded-xl text-xs font-medium cursor-pointer whitespace-nowrap"
            >
              Inspect Active Alerts ({openIncidents.length})
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 aspect-[16/9] rounded-xl overflow-hidden border border-slate-200/80">
          <SafeImage
            src={VISUAL_ASSETS.continuityMode}
            alt="Spacecraft continuity medical workstation displaying offline checklists"
            caption={
              continuityState.cmoAvailable
                ? "CMO On Duty · Continuity Ready"
                : "CMO Unavailable · Crew Continuity Active"
            }
          />
        </div>
      </div>

      {/* Interactive 10-Step Continuity Story Bar */}
      <section
        aria-label="Continuity Mode 10-Step Walkthrough"
        className="glass-panel rounded-2xl p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Interactive Continuity Scenario Story (Step {continuityState.walkthroughStep} of{" "}
              {CONTINUITY_STORY_STEPS.length})
            </h2>
            <p className="text-xs text-slate-600">
              {CONTINUITY_STORY_STEPS[continuityState.walkthroughStep - 1]?.summary}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              disabled={continuityState.walkthroughStep <= 1}
              onClick={() => {
                const prevStep = Math.max(1, continuityState.walkthroughStep - 1);
                const def = CONTINUITY_STORY_STEPS[prevStep - 1];
                void jumpToWalkthroughStep(prevStep, def.sectionId);
              }}
              className="px-3 py-1.5 bg-white/85 hover:bg-white disabled:opacity-45 border border-slate-200 rounded-xl text-slate-700 font-medium cursor-pointer"
            >
              Prev Step
            </button>
            <button
              type="button"
              disabled={continuityState.walkthroughStep >= CONTINUITY_STORY_STEPS.length}
              onClick={() => {
                const nextStep = Math.min(
                  CONTINUITY_STORY_STEPS.length,
                  continuityState.walkthroughStep + 1
                );
                const def = CONTINUITY_STORY_STEPS[nextStep - 1];
                void jumpToWalkthroughStep(nextStep, def.sectionId);
              }}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white rounded-xl font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5">
          {CONTINUITY_STORY_STEPS.map((st) => {
            const isCurrent = continuityState.walkthroughStep === st.step;
            const isPast = st.step < continuityState.walkthroughStep;
            return (
              <button
                key={st.step}
                type="button"
                onClick={() => void jumpToWalkthroughStep(st.step, st.sectionId)}
                className={`text-left px-2.5 py-2 rounded-xl border text-[11px] transition-colors cursor-pointer ${
                  isCurrent
                    ? "bg-sky-50/95 border-sky-400 text-slate-900 font-semibold"
                    : isPast
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                    : "bg-white/65 border-slate-200/80 text-slate-600 hover:bg-white"
                }`}
              >
                <div className="font-mono text-[10px] opacity-80">Step {st.step}</div>
                <div className="truncate mt-0.5">{st.title}</div>
              </button>
            );
          })}
        </div>
      </section>

      {(localFeedback || syncFeedback) && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2 ${
            (localFeedback ?? syncFeedback)?.ok
              ? "bg-emerald-50/90 border-emerald-200 text-emerald-900"
              : "bg-amber-50/90 border-amber-200 text-amber-950"
          }`}
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{(localFeedback ?? syncFeedback)?.message}</span>
        </div>
      )}

      {/* Simplified Non-Medical-Operator Banner & Permission Boundaries */}
      {isSimplifiedNonMedicalView && (
        <section
          aria-label="Simplified Non-Medical Operator Mode Notice"
          className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 space-y-2 text-xs text-amber-950"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-sm inline-flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Simplified Non-Medical-Operator Workflow Active — Operator:{" "}
                {replacementOperator?.name || "Crew Member"} ({operatorRole.replace(/_/g, " ")})
              </span>
            </span>
            <span className="font-mono text-[11px] text-amber-900">
              CMO+PIN (2026) Gates Remain Enforced
            </span>
          </div>
          <p className="leading-relaxed">
            {continuityState.cmoStatusReason} Existing telemetry, incident history, and curated
            references remain accessible.{" "}
            <strong>Training &amp; Permission Boundary:</strong> Non-CMO operators can execute
            crew-permitted environmental/observation procedures and prepare Earth handoff packages,
            but cannot impersonate the CMO, release controlled pharmaceuticals, or close CMO-gated
            clinical incidents.
          </p>
        </section>
      )}

      {/* Feature 1 Controls: Continuity Mode, Earth Link, CMO Availability & Replacement Operator */}
      <section
        id="continuity-controls"
        aria-label="Continuity Scenario Controls"
        className="glass-panel rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            1. Contingency Controls &amp; Operator Authority
          </h2>
          <span className="text-[11px] font-mono text-slate-500">
            Active Role: {operatorRole} · Persisted in Workspace
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Continuity Mode Toggle */}
          <div className="glass-subtle rounded-xl p-4 flex flex-col justify-between gap-3">
            <div>
              <div className="text-[11px] text-slate-500">Continuity Mode</div>
              <div className="font-semibold text-slate-900 mt-0.5">
                {continuityState.continuityActive ? "● Active (Crew Autonomy)" : "○ Standby"}
              </div>
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={handleToggleContinuityMode}
              className={`w-full py-2 px-3 rounded-xl font-semibold cursor-pointer ${
                continuityState.continuityActive
                  ? "bg-amber-700 hover:bg-amber-800 text-white"
                  : "bg-slate-900 hover:bg-slate-800 text-white"
              }`}
            >
              {continuityState.continuityActive ? "Deactivate Continuity" : "Activate Continuity"}
            </button>
          </div>

          {/* Earth Comms Toggle */}
          <div className="glass-subtle rounded-xl p-4 flex flex-col justify-between gap-3">
            <div>
              <div className="text-[11px] text-slate-500">Earth Deep-Space Link (Simulated)</div>
              <div
                className={`font-semibold mt-0.5 inline-flex items-center gap-1.5 ${
                  earthWanConnected ? "text-emerald-800" : "text-amber-800"
                }`}
              >
                {earthWanConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                <span>{earthWanConnected ? "AVAILABLE (Online)" : "UNAVAILABLE (Offline)"}</span>
              </div>
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onUpdateWorkspace({ earthWanConnected: !earthWanConnected })}
              className="w-full py-2 px-3 bg-white/90 hover:bg-white border border-slate-300/80 text-slate-900 rounded-xl font-medium cursor-pointer"
            >
              {earthWanConnected ? "Sever Earth Link (Test Offline)" : "Restore Earth Link"}
            </button>
          </div>

          {/* CMO Availability Toggle */}
          <div className="glass-subtle rounded-xl p-4 flex flex-col justify-between gap-3">
            <div>
              <div className="text-[11px] text-slate-500">Designated Crew Medical Officer</div>
              <div
                className={`font-semibold mt-0.5 ${
                  continuityState.cmoAvailable ? "text-emerald-800" : "text-rose-800"
                }`}
              >
                {continuityState.cmoAvailable ? "● CMO AVAILABLE" : "▲ CMO UNAVAILABLE"}
              </div>
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={handleToggleCmoAvailability}
              className="w-full py-2 px-3 bg-white/90 hover:bg-white border border-slate-300/80 text-slate-900 rounded-xl font-medium cursor-pointer"
            >
              {continuityState.cmoAvailable ? "Mark CMO Unavailable" : "Restore CMO Available"}
            </button>
          </div>

          {/* Replacement Crew Operator Selector (Non-CMO) */}
          <div className="glass-subtle rounded-xl p-4 flex flex-col justify-between gap-2">
            <label htmlFor="replacement-crew-select" className="text-[11px] text-slate-500">
              Authorized Replacement Operator (Non-CMO)
            </label>
            <select
              id="replacement-crew-select"
              value={continuityState.replacementOperatorCrewId}
              disabled={isBusy}
              onChange={(e) => void handleSelectReplacementOperator(e.target.value)}
              className="w-full bg-white/90 border border-slate-300/80 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900"
            >
              {replacementCandidates.map((c) => (
                <option key={c.crewId} value={c.crewId}>
                  {c.name} ({c.crewId})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-600">
              Tier:{" "}
              {SIMULATED_CREW_CAPABILITIES[
                continuityState.replacementOperatorCrewId
              ]?.medicalTier.replace(/_/g, " ") || "CREW FIRST RESPONDER"}
            </span>
          </div>
        </div>
      </section>

      {/* Preserved Active Incident Summary */}
      <section
        id="continuity-incident-context"
        aria-label="Preserved Incident Context"
        className="glass-panel rounded-2xl p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Preserved Incident Evidence &amp; Active Context
          </h2>
          {incidents.length > 1 && (
            <select
              aria-label="Select incident in Continuity Mode"
              value={activeIncident?.incident_id || ""}
              onChange={(e) => setSelectedIncidentId(e.target.value)}
              className="bg-white/90 border border-slate-300/80 rounded-xl px-2.5 py-1 text-xs font-mono text-slate-900"
            >
              {incidents.map((inc) => (
                <option key={inc.incident_id} value={inc.incident_id}>
                  {inc.incident_id} · {inc.rule_id} ({inc.state})
                </option>
              ))}
            </select>
          )}
        </div>

        {activeIncident ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs items-center">
            <div className="lg:col-span-8 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-slate-500">
                <span className="font-mono font-semibold text-slate-800">
                  {activeIncident.incident_id}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{activeIncident.rule_id}</span>
                <span aria-hidden="true">·</span>
                <span>State: {activeIncident.state}</span>
                <span aria-hidden="true">·</span>
                <SyncStatusText status={activeIncident.sync_status} />
              </div>
              <div className="text-sm font-semibold text-slate-900">{activeIncident.title}</div>
              <p className="text-slate-600 leading-relaxed">{activeIncident.uncertainty_note}</p>
            </div>
            <div className="lg:col-span-4 flex flex-wrap lg:justify-end gap-2">
              <button
                type="button"
                onClick={() => onNavigate("alerts-response")}
                className="px-3 py-2 bg-white/85 hover:bg-white border border-slate-300/80 rounded-xl font-medium text-slate-800 cursor-pointer"
              >
                Open Full 7-Part Evidence →
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600">
            No anomaly incidents active — telemetry is inside personal 14-day baseline ranges. Activate
            Scenario 7 above to test an incident with CMO unavailable.
          </p>
        )}
      </section>

      {/* Feature 5: Consolidated Mission Support Status (No Fake %) */}
      <section
        id="continuity-support-status"
        aria-label="Mission Support Status"
        className="glass-panel rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-sky-700" />
              <span>2. Mission Support Status (Deterministic Readiness Summary)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Separates verified available capabilities from unavailable resources and explicit
              information gaps. No synthetic readiness percentages or safety assurances.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          <div className="glass-subtle rounded-xl p-3">
            <div className="text-[11px] text-slate-500">Earth Comms</div>
            <div
              className={`font-mono font-bold mt-0.5 ${
                supportStatus.earthCommsStatus === "AVAILABLE" ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              {supportStatus.earthCommsStatus}
            </div>
          </div>
          <div className="glass-subtle rounded-xl p-3">
            <div className="text-[11px] text-slate-500">CMO Status</div>
            <div
              className={`font-mono font-bold mt-0.5 ${
                supportStatus.cmoStatus === "AVAILABLE" ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {supportStatus.cmoStatus}
            </div>
          </div>
          <div className="glass-subtle rounded-xl p-3">
            <div className="text-[11px] text-slate-500">Crew Available</div>
            <div className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
              {supportStatus.availableCrewCount} / {crewRoster.length}
            </div>
          </div>
          <div className="glass-subtle rounded-xl p-3">
            <div className="text-[11px] text-slate-500">Hardware Operational</div>
            <div className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
              {supportStatus.operationalEquipmentCount} / {ONBOARD_MEDICAL_EQUIPMENT.length}
            </div>
          </div>
          <div className="glass-subtle rounded-xl p-3">
            <div className="text-[11px] text-slate-500">Offline References</div>
            <div className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
              {supportStatus.offlineReferenceCount} Guides
            </div>
          </div>
          <div className="glass-subtle rounded-xl p-3">
            <div className="text-[11px] text-slate-500">Authorized Procedures</div>
            <div className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
              {supportStatus.accessibleProcedureCount} Open · {supportStatus.lockedProcedureCount} Locked
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
            <div className="font-semibold text-emerald-950">Available Now</div>
            <ul className="list-disc pl-4 space-y-1.5 text-emerald-900">
              {supportStatus.availableItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/75 p-4 space-y-2">
            <div className="font-semibold text-amber-950">Unavailable or Limited</div>
            <ul className="list-disc pl-4 space-y-1.5 text-amber-900">
              {supportStatus.unavailableOrMissingItems.length > 0 ? (
                supportStatus.unavailableOrMissingItems.map((item) => <li key={item}>{item}</li>)
              ) : (
                <li>All tracked support items currently available.</li>
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/80 p-4 space-y-2">
            <div className="font-semibold text-slate-900">Uncertainties &amp; Information Gaps</div>
            <ul className="list-disc pl-4 space-y-1.5 text-slate-700">
              {supportStatus.uncertaintiesAndGaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Feature 2: Crew Capability Board */}
      <section
        id="continuity-crew-board"
        aria-label="Crew Capability Board"
        className="glass-panel rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-700" />
              <span>3. Crew Capability Board [Simulated Crew Profiles]</span>
            </h2>
            <p className="text-xs text-slate-500">
              Displays recorded competencies, availability status, and strict task boundaries. Not
              every crew member is medically qualified.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Simulated Training Profiles · Non-CMO Boundaries Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {crewRoster.map((member) => {
            const cap = SIMULATED_CREW_CAPABILITIES[member.crewId];
            const effectiveAvail: CrewAvailabilityStatus =
              continuityState.crewAvailabilityOverrides[member.crewId] ??
              (cap?.medicalTier === "CMO_QUALIFIED" && !continuityState.cmoAvailable
                ? "UNAVAILABLE"
                : cap?.defaultAvailability ?? "AVAILABLE");
            const isReplacement = continuityState.replacementOperatorCrewId === member.crewId;
            const isCmo = cap?.medicalTier === "CMO_QUALIFIED";

            return (
              <div
                key={member.crewId}
                className={`rounded-2xl border p-4 space-y-3 ${
                  effectiveAvail === "UNAVAILABLE"
                    ? "bg-rose-50/70 border-rose-200"
                    : isReplacement
                    ? "bg-sky-50/75 border-sky-300"
                    : "bg-white/80 border-slate-200/80"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {member.crewId} · {cap?.simulatedLabel || "Simulated Profile"}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 mt-0.5">
                      {member.name} — {member.role}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleCycleCrewAvailability(member.crewId)}
                    className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] font-semibold cursor-pointer ${
                      effectiveAvail === "AVAILABLE"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : effectiveAvail === "BUSY"
                        ? "bg-amber-50 border-amber-200 text-amber-800"
                        : "bg-rose-100 border-rose-300 text-rose-900"
                    }`}
                  >
                    {effectiveAvail}
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="font-medium text-slate-800">
                    Qualification Tier:{" "}
                    <span className="font-mono text-sky-900">
                      {cap?.medicalTier.replace(/_/g, " ") || "CREW"}
                    </span>
                    {isReplacement && " · Active Continuity Operator"}
                  </div>
                  <div className="text-slate-600">
                    <strong>Recorded Training:</strong> {cap?.recordedTraining.join(" · ")}
                  </div>
                  <div className="text-slate-600">
                    <strong>Assigned Responsibilities:</strong>{" "}
                    {cap?.assignedResponsibilities.join(" · ")}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/70 text-[11px]">
                  <div>
                    <div className="font-semibold text-emerald-800">Permitted Tasks</div>
                    <ul className="list-disc pl-3.5 text-slate-700 space-y-0.5 mt-0.5">
                      {cap?.permittedTasks.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-rose-800">
                      {isCmo ? "Operational Caveat" : "Restricted (Requires CMO / Ground)"}
                    </div>
                    <ul className="list-disc pl-3.5 text-slate-700 space-y-0.5 mt-0.5">
                      {cap?.restrictedTasks.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature 3: Medical Resource Readiness (Shared Med Kit + Simulated Hardware + Incident Match) */}
      <section
        id="continuity-resources"
        aria-label="Medical Resource Readiness"
        className="glass-panel rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-sky-700" />
              <span>4. Medical Resource Readiness (Live Med Kit + Simulated Equipment)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Combines live Med Kit consumables with simulated onboard hardware readiness and
              incident-specific matching for{" "}
              <span className="font-mono text-slate-800">
                {resourceMatch.incidentRuleId || "All Rules"}
              </span>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("med-kit")}
            className="px-3 py-1.5 bg-white/85 hover:bg-white border border-slate-300/80 rounded-xl text-xs font-medium text-sky-900 cursor-pointer"
          >
            Open Full Med Kit Inventory →
          </button>
        </div>

        {/* Incident-Matched Equipment Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {resolveEquipmentInventory(ONBOARD_MEDICAL_EQUIPMENT, continuityState).map((eq) => {
            const effStatus = eq.effectiveStatus;
            const isMatched =
              !activeIncident ||
              eq.relevantRuleIds.includes(activeIncident.rule_id) ||
              effStatus === "UNAVAILABLE";
            const canConfirm = canConfirmEquipmentInventory(operatorRole);

            return (
              <div
                key={eq.equipmentId}
                className={`rounded-xl border p-4 flex flex-col justify-between gap-2.5 ${
                  effStatus === "UNAVAILABLE"
                    ? "bg-rose-50/75 border-rose-200"
                    : effStatus === "LIMITED"
                    ? "bg-amber-50/75 border-amber-200"
                    : "bg-white/80 border-slate-200/80"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-slate-500">{eq.equipmentId}</span>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleCycleEquipmentStatus(eq.equipmentId, eq.operationalStatus)}
                      title="Click to simulate hardware state transition"
                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold cursor-pointer border ${
                        effStatus === "OPERATIONAL"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : effStatus === "LIMITED"
                          ? "bg-amber-100 border-amber-300 text-amber-900"
                          : "bg-rose-100 border-rose-300 text-rose-900"
                      }`}
                    >
                      {eq.availability} · {effStatus}
                    </button>
                  </div>
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                    <span>{eq.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-700">
                    <strong>Storage:</strong> {eq.location}
                  </div>
                  <p className="text-[11px] text-slate-600">{eq.notes}</p>
                </div>
                <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span>
                      {eq.referenceAvailableOffline ? "● Ref Offline" : "▲ No Offline Ref"}
                      {isMatched && activeIncident ? " · Incident Match" : ""}
                    </span>
                    <span className="font-mono text-slate-500">
                      {eq.lastConfirmedAtIso
                        ? formatMissionTimeUtc(eq.lastConfirmedAtIso)
                        : "Unconfirmed"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500">
                      {eq.isSimulatedConfirmation
                        ? "Simulated Demo Baseline"
                        : `Confirmed by ${eq.confirmedBy}`}
                    </span>
                    {onConfirmEquipmentInventory && (
                      <button
                        type="button"
                        disabled={isBusy || !canConfirm}
                        onClick={() => void onConfirmEquipmentInventory(eq.equipmentId)}
                        className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white rounded text-[10px] font-medium cursor-pointer"
                      >
                        Confirm Check
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Med Kit Consumables Readiness */}
        <div className="glass-subtle rounded-xl p-4 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-900">
              Live Med Kit Consumables &amp; Expiry Watch ({medRecords.length} Tracked)
            </span>
            <span className="text-[11px] text-slate-500">
              Shared live store with Med Kit &amp; Countermeasures
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {resourceMatch.availableConsumables.map((m) => (
              <div
                key={m.recordId}
                className={`rounded-lg border p-2.5 flex items-center justify-between gap-2 ${
                  m.isLowOrExpiring
                    ? "bg-amber-50/90 border-amber-200"
                    : "bg-white/85 border-slate-200"
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 truncate">{m.name}</div>
                  <div className="text-[11px] text-slate-500">
                    Exp {m.expiresOn}
                    {m.cmoControlled ? " · CMO-Controlled (Locked without CMO)" : ""}
                  </div>
                </div>
                <span className="font-mono font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                  {m.stockQty} {m.unit}
                </span>
              </div>
            ))}
          </div>
          {resourceMatch.missingOrDepletedConsumables.length > 0 && (
            <div className="text-[11px] text-rose-800 font-medium pt-1">
              Missing/Depleted:{" "}
              {resourceMatch.missingOrDepletedConsumables
                .map((m) => `${m.name} (${m.reason})`)
                .join("; ")}
            </div>
          )}
        </div>
      </section>

      {/* Feature 4: Offline-Searchable Guided Procedure Access (One-Step-at-a-Time) */}
      <section
        id="continuity-procedures"
        aria-label="Offline Guided Procedure Access"
        className="glass-panel rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-700" />
              <span>5. Offline-Searchable Guided Procedures (Curated Prototype Reference)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Curated static checklists only — no AI-generated medical instructions and no claim of
              NASA operational flight-rule approval.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {GUIDED_PROCEDURES.length} Offline Procedures Indexed
          </span>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-2.5 text-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              aria-label="Search offline procedures"
              value={procSearch}
              onChange={(e) => setProcSearch(e.target.value)}
              placeholder="Search offline procedures (e.g., CO2, scrubber, SpO2, radiation, fluid, Modafinil)..."
              className="w-full bg-white/90 border border-slate-300/80 rounded-xl pl-10 pr-4 py-2 text-slate-900"
            />
          </div>
          <select
            aria-label="Filter procedures by authorization or rule"
            value={procFilter}
            onChange={(e) =>
              setProcFilter(e.target.value as "ALL" | "AUTHORIZED_ONLY" | "CMO_RESTRICTED" | RuleId)
            }
            className="bg-white/90 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
          >
            <option value="ALL">All Procedures ({GUIDED_PROCEDURES.length})</option>
            <option value="AUTHORIZED_ONLY">Authorized for Active Role Only</option>
            <option value="CMO_RESTRICTED">CMO-Restricted Only</option>
            <option value="RULE-HYPOXIA-CO2-MULTI-02">Matched: CO2 / Hypoxia</option>
            <option value="RULE-CARDIO-TREND-01">Matched: Cardio HR Trend</option>
            <option value="RULE-RAD-EXPOSURE-03">Matched: Radiation Exposure</option>
            <option value="RULE-FLUID-EYE-SANS-06">Matched: Fluid-Shift / SANS</option>
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Procedure Catalog List */}
          <div className="lg:col-span-5 space-y-2.5 text-xs">
            {filteredProcedures.length === 0 ? (
              <div className="glass-subtle rounded-xl p-4 text-slate-500">
                No curated procedures matched your search filter.
              </div>
            ) : (
              filteredProcedures.map((proc) => {
                const auth = isProcedureAuthorized(proc, operatorRole, continuityState.cmoAvailable);
                const doneCount = (continuityState.procedureStepsDone[proc.procedureId] || []).length;
                const isSelected = selectedProcedure.procedureId === proc.procedureId;
                return (
                  <button
                    key={proc.procedureId}
                    type="button"
                    onClick={() => void handleSelectProcedure(proc.procedureId)}
                    className={`w-full text-left rounded-xl border p-3.5 space-y-1.5 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-sky-50/95 border-sky-400 text-slate-900"
                        : !auth.allowed
                        ? "bg-rose-50/60 border-rose-200 text-slate-700"
                        : "bg-white/80 border-slate-200/80 hover:bg-white text-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-sky-900">
                        {proc.procedureId}
                      </span>
                      {auth.allowed ? (
                        <span className="font-mono text-[10px] text-emerald-800 font-semibold">
                          {doneCount}/{proc.steps.length} steps
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-rose-800 font-semibold">
                          <Lock className="w-3 h-3" />
                          <span>LOCKED (CMO)</span>
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-slate-900 leading-snug">{proc.title}</div>
                    <div className="text-[11px] text-slate-600 line-clamp-2">
                      {proc.operationalContext}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Selected Procedure Metadata + Step-by-Step Stepper */}
          <div className="lg:col-span-7 glass-subtle rounded-2xl p-5 space-y-4 text-xs">
            <div className="space-y-1.5 border-b border-slate-200/70 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
                <span>
                  {selectedProcedure.procedureId} · {selectedProcedure.version}
                </span>
                <span>{selectedProcedure.source}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">{selectedProcedure.title}</h3>
              <p className="text-slate-600 leading-relaxed">{selectedProcedure.operationalContext}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white/80 border border-slate-200/80 rounded-xl p-3 space-y-1">
                <div className="font-semibold text-slate-800">Required Training &amp; Authority</div>
                <div className="text-slate-600">{selectedProcedure.requiredTraining}</div>
                <div className="font-mono text-[11px] text-slate-500">
                  Permitted Roles: {selectedProcedure.allowedRoles.join(", ")}
                </div>
              </div>
              <div className="bg-white/80 border border-slate-200/80 rounded-xl p-3 space-y-1">
                <div className="font-semibold text-slate-800">Required Equipment</div>
                <div className="text-slate-600">
                  {selectedProcedure.requiredEquipmentIds
                    .map((id) => {
                      const eq = ONBOARD_MEDICAL_EQUIPMENT.find((e) => e.equipmentId === id);
                      const eff = continuityState.equipmentStatusOverrides[id] ?? eq?.operationalStatus;
                      return eq ? `${eq.name} [${eff}]` : id;
                    })
                    .join(" · ") || "None"}
                </div>
              </div>
            </div>

            {!selectedProcAuth.allowed ? (
              <div className="rounded-xl border border-rose-300 bg-rose-50/90 p-4 space-y-2 text-rose-950">
                <div className="font-semibold flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>Procedure Execution Locked</span>
                </div>
                <p>{selectedProcAuth.reason}</p>
                <p className="text-[11px] text-rose-800">
                  Security rule: Non-medical crew cannot impersonate the Crew Medical Officer or
                  unlock CMO-restricted checklists without active CMO credentials and PIN (2026).
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDoneSteps.length > 0 &&
                  selectedDoneSteps.length < selectedProcedure.steps.length && (
                    <div className="rounded-xl border border-sky-200 bg-sky-50/90 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-sky-950">
                      <div>
                        <span className="font-semibold">
                          In-Progress Procedure: {selectedDoneSteps.length}/
                          {selectedProcedure.steps.length} completed ·{" "}
                          {selectedProcedure.steps.length - selectedDoneSteps.length} outstanding
                        </span>
                        <div className="font-mono text-sky-800 mt-0.5">
                          Last update: {formatMissionTimeUtc(continuityState.updatedAtIso)}
                        </div>
                      </div>
                      {(() => {
                        const firstTodoIdx = selectedProcedure.steps.findIndex(
                          (st) => !selectedDoneSteps.includes(st.stepNumber)
                        );
                        if (firstTodoIdx < 0) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => void handleStepNavigation(firstTodoIdx)}
                            className="px-2.5 py-1 bg-sky-700 hover:bg-sky-800 text-white rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <Play className="w-3 h-3" />
                            <span>Resume Step {firstTodoIdx + 1}</span>
                          </button>
                        );
                      })()}
                    </div>
                  )}

                {/* One-Step-at-a-Time Stepper */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">
                    Step {currentStep.stepNumber} of {selectedProcedure.steps.length}:{" "}
                    {currentStep.title}
                  </span>
                  <span className="font-mono text-[11px] text-emerald-800">
                    {selectedDoneSteps.length}/{selectedProcedure.steps.length} Completed
                  </span>
                </div>

                <div className="bg-white/95 border border-sky-200 rounded-xl p-4 space-y-2.5">
                  <p className="text-sm text-slate-900 leading-relaxed">{currentStep.instruction}</p>
                  <div className="text-[11px] text-sky-900 bg-sky-50/85 border border-sky-200 rounded-lg p-2.5">
                    <strong>Verification Cue:</strong> {currentStep.verificationCue}
                  </div>
                  {currentStep.cautionNote && (
                    <div className="text-[11px] text-amber-900 bg-amber-50/85 border border-amber-200 rounded-lg p-2.5">
                      <strong>Caution:</strong> {currentStep.cautionNote}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleToggleProcedureStep(currentStep.stepNumber)}
                      className={`px-3.5 py-2 rounded-xl font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                        selectedDoneSteps.includes(currentStep.stepNumber)
                          ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {selectedDoneSteps.includes(currentStep.stepNumber)
                          ? "Step Completed (Click to Undo)"
                          : `Complete Step ${currentStep.stepNumber}`}
                      </span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={clampedStepIdx <= 0}
                        onClick={() => void handleStepNavigation(Math.max(0, clampedStepIdx - 1))}
                        className="px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-45 border border-slate-300 rounded-xl font-medium text-slate-800 cursor-pointer"
                      >
                        Previous Step
                      </button>
                      <button
                        type="button"
                        disabled={clampedStepIdx >= selectedProcedure.steps.length - 1}
                        onClick={() =>
                          void handleStepNavigation(
                            Math.min(selectedProcedure.steps.length - 1, clampedStepIdx + 1)
                          )
                        }
                        className="px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-45 border border-slate-300 rounded-xl font-medium text-slate-800 cursor-pointer"
                      >
                        Next Step
                      </button>
                    </div>
                  </div>
                </div>

                {/* Save Procedure Log to Workspace History */}
                <div className="bg-white/80 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                  <label htmlFor="proc-observation-note" className="block font-semibold text-slate-800">
                    Crew Observation Note for Procedure Log
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="proc-observation-note"
                      type="text"
                      value={procedureNote}
                      onChange={(e) => setProcedureNote(e.target.value)}
                      className="flex-1 bg-white border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
                    />
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={async () => {
                        await onSaveProcedureChecklistLog(
                          selectedProcedure.procedureId,
                          selectedProcedure.title,
                          activeIncident?.incident_id || "CONTINUITY-WATCH",
                          selectedDoneSteps,
                          selectedProcedure.steps.length,
                          procedureNote
                        );
                        setLocalFeedback({
                          ok: true,
                          message: `Saved ${selectedProcedure.procedureId} log (${selectedDoneSteps.length}/${selectedProcedure.steps.length} steps) into persistent workspace history.`,
                        });
                      }}
                      className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span>Save Procedure Log</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Explicit Limitations */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/75 p-3 space-y-1 text-[11px] text-amber-950">
              <div className="font-semibold">Explicit Procedure Limitations</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {selectedProcedure.limitations.map((lim) => (
                  <li key={lim}>{lim}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 6: Earth Handoff Package & Delayed Sync */}
      <section
        id="continuity-handoff"
        aria-label="Earth Handoff Package"
        className="glass-panel rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-700" />
              <span>6. Earth Handoff Package &amp; Delayed Recovery Sync</span>
            </h2>
            <p className="text-xs text-slate-500">
              Compiles incident timeline, observations, quality warnings, baseline shifts, crew
              actions, missing equipment, accessed procedures, unanswered questions, and explicit
              uncertainties into a local exportable packet.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleDownloadHandoff("md")}
              className="px-3 py-2 bg-white/85 hover:bg-white border border-slate-300/80 rounded-xl font-medium text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .MD</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadHandoff("json")}
              className="px-3 py-2 bg-white/85 hover:bg-white border border-slate-300/80 rounded-xl font-medium text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>Export .JSON</span>
            </button>
            <button
              type="button"
              onClick={() => setShowMarkdownPreview((v) => !v)}
              className="px-3 py-2 bg-white/85 hover:bg-white border border-slate-300/80 rounded-xl font-medium text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{showMarkdownPreview ? "Hide Markdown" : "Preview Markdown"}</span>
            </button>
          </div>
        </div>

        {/* Editable Crew Note + Question for Earth */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <label htmlFor="handoff-crew-note" className="block font-medium text-slate-700">
              Crew Handoff Observation Summary
            </label>
            <input
              id="handoff-crew-note"
              type="text"
              value={handoffCrewNote}
              onChange={(e) => setHandoffCrewNote(e.target.value)}
              className="w-full bg-white/90 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="handoff-question" className="block font-medium text-slate-700">
              Priority Unanswered Question for Ground Flight Surgeon (Optional)
            </label>
            <input
              id="handoff-question"
              type="text"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              placeholder="e.g., Confirm 24h workload deferral until CMO recovery & SpO2 re-check..."
              className="w-full bg-white/90 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
            />
          </div>
        </div>

        {/* Structured Handoff Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="glass-subtle rounded-xl p-3 space-y-1">
            <div className="text-[11px] text-slate-500">Astronaut &amp; Operator</div>
            <div className="font-semibold text-slate-900">
              {generatedHandoff.astronautName} ({generatedHandoff.astronautId})
            </div>
            <div className="text-[11px] text-slate-600">
              Prepared by {generatedHandoff.preparedByCrewId} ({generatedHandoff.preparedByRole})
            </div>
          </div>

          <div className="glass-subtle rounded-xl p-3 space-y-1">
            <div className="text-[11px] text-slate-500">Comms &amp; CMO at Generation</div>
            <div className="font-mono font-semibold text-slate-900">
              Earth: {generatedHandoff.earthCommsAtGeneration} · CMO:{" "}
              {generatedHandoff.cmoAvailabilityAtGeneration}
            </div>
            <div className="text-[11px] text-slate-600">
              {generatedHandoff.incidentTimeline.length} timeline events ·{" "}
              {generatedHandoff.recordedObservationsSummary.length} observations
            </div>
          </div>

          <div className="glass-subtle rounded-xl p-3 space-y-1">
            <div className="text-[11px] text-slate-500">Actions &amp; Procedures Accessed</div>
            <div className="font-semibold text-slate-900">
              {generatedHandoff.crewRecordedActions.length} crew action(s) ·{" "}
              {generatedHandoff.proceduresAccessed.length} procedure(s)
            </div>
            <div className="text-[11px] text-slate-600 truncate">
              {generatedHandoff.proceduresAccessed.map((p) => p.procedureId).join(", ") ||
                "No procedure accessed yet"}
            </div>
          </div>

          <div className="glass-subtle rounded-xl p-3 space-y-1">
            <div className="text-[11px] text-slate-500">Resource Gaps &amp; Uncertainties</div>
            <div className="font-semibold text-amber-800">
              {generatedHandoff.missingResourcesSummary.length} missing/limited ·{" "}
              {generatedHandoff.unansweredQuestions.length} open questions
            </div>
            <div className="text-[11px] text-slate-600 truncate">
              {generatedHandoff.dataQualityWarnings[0]}
            </div>
          </div>
        </div>

        {/* Save Handoff + Sync Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            disabled={isBusy}
            onClick={async () => {
              await onSaveEarthHandoff(generatedHandoff, activeIncident);
              setLocalFeedback({
                ok: true,
                message: earthWanConnected
                  ? `Saved Earth Handoff Package (${generatedHandoff.packageId}) as PENDING in queue.`
                  : `Earth comms unavailable — saved Earth Handoff Package (${generatedHandoff.packageId}) locally with status PENDING.`,
              });
            }}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Save Earth Handoff Package to Queue (PENDING)</span>
          </button>

          {!earthWanConnected && (
            <button
              type="button"
              disabled={isBusy}
              onClick={async () => {
                await onUpdateWorkspace({ earthWanConnected: true });
                setLocalFeedback({
                  ok: true,
                  message:
                    "Simulated Earth link restored. Click 'Sync Queued Packages to Earth' to mark PENDING packages as SYNCED.",
                });
              }}
              className="px-4 py-2.5 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Restore Earth Link</span>
            </button>
          )}

          <button
            type="button"
            disabled={isBusy}
            onClick={onSimulateSync}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Queued Packages to Earth</span>
          </button>
        </div>

        {showMarkdownPreview && (
          <pre className="glass-subtle rounded-xl p-4 text-xs font-mono text-slate-700 overflow-x-auto max-h-96 whitespace-pre-wrap leading-relaxed">
            {generatedHandoff.markdownDocument}
          </pre>
        )}

        {/* Saved Handoff Packages in Consultation Queue */}
        {handoffQueueItems.length > 0 && (
          <div className="pt-3 border-t border-slate-200/70 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">
                Saved Earth Handoff Packages ({handoffQueueItems.length})
              </span>
              <button
                type="button"
                onClick={() => onNavigate("reports-library")}
                className="text-sky-800 hover:text-sky-950 font-semibold cursor-pointer"
              >
                View in Base Health Reports &amp; Library →
              </button>
            </div>
            <div className="space-y-1.5">
              {handoffQueueItems.map((pkg) => (
                <div
                  key={pkg.package_id}
                  className="glass-subtle rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-mono font-semibold text-slate-900">{pkg.package_id}</span>
                    <span className="mx-2 text-slate-400">·</span>
                    <span className="text-slate-700">{pkg.payload?.incident_summary?.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-500">
                      {formatMissionTimeUtc(pkg.created_at)}
                    </span>
                    <SyncStatusText status={pkg.sync_status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
          {PROTOTYPE_DISCLAIMER}
        </p>
      </section>
    </div>
  );
};
