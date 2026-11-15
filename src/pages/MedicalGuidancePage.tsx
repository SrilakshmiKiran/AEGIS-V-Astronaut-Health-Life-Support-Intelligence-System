import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Download,
  FileJson,
  FileText,
  HeartPulse,
  Lock,
  MapPin,
  Mic,
  MicOff,
  PackageSearch,
  PhoneCall,
  Search,
  Send,
  ShieldAlert,
  UserCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  ActorRole,
  BaselineProfile,
  IncidentRecord,
  KnowledgeResource,
  SubjectiveCheckinEntry,
  TelemetryLatestResponse,
} from "../types/aegisContracts";
import { ContinuityPersistedState } from "../types/continuityContracts";
import {
  EnvironmentSafetyAssessment,
  LifeSafetyConfig,
  LifeSafetyEvent,
} from "../types/lifeSafetyContracts";
import {
  ConditionChangeDirection,
  ConditionCheckEntry,
  GuidanceCategoryGroup,
  GuidanceCategoryId,
  GuidanceIncidentRecord,
  MEDICAL_GUIDANCE_PROTOTYPE_SAFETY_NOTICE,
  MedicalGuidanceScreenInput,
  MedicalHelpDemoSceneId,
  RedFlagSignId,
  TriStateAnswer,
} from "../types/medicalGuidanceContracts";
import { CrewRosterMember } from "../types/opsContracts";
import { PageId } from "../types/navigation";
import { SafeImage } from "../components/SafeImage";
import { VISUAL_ASSETS } from "../assets/visualCatalog";
import { ResolvedEquipmentItem, formatMissionTimeUtc } from "../utils/aegisPureEngine";
import {
  APPROVED_GUIDANCE_PROTOCOLS,
  GUIDANCE_CATEGORIES,
  RED_FLAG_SIGNS,
} from "../utils/approvedMedicalLibrary";
import {
  DEFAULT_SCREEN_INPUT,
  buildConsultationItemFromGuidanceIncident,
  buildGuidanceDemoScene,
  buildMedicalGuidanceHandoffMarkdown,
  buildPersonalizedGuidanceContext,
  createMedicalGuidanceIncident,
  evaluateEmergencyScreening,
  evaluateGuidanceResponderOverdue,
  findMedicalEquipmentWithAlternatives,
  recordConditionTrackingUpdate,
  resolveProtocolForIntake,
  searchGuidanceLibrary,
  transitionMedicalGuidanceIncident,
} from "../utils/medicalGuidanceEngine";

interface MedicalGuidancePageProps {
  missionName: string;
  actorName: string;
  operatorRole: ActorRole;
  activeCrewId: string;
  crewRoster: CrewRosterMember[];
  baseline: BaselineProfile;
  latest: TelemetryLatestResponse;
  envAssessment: EnvironmentSafetyAssessment;
  incidents: IncidentRecord[];
  lifeSafetyEvents: LifeSafetyEvent[];
  lifeSafetyConfig: LifeSafetyConfig;
  subjectiveHistory: SubjectiveCheckinEntry[];
  resolvedEquipment: ResolvedEquipmentItem[];
  continuityState: ContinuityPersistedState;
  resources: KnowledgeResource[];
  guidanceIncidents: GuidanceIncidentRecord[];
  earthWanConnected: boolean;
  browserOnline: boolean;
  isBusy: boolean;
  feedback: { ok: boolean; message: string } | null;
  initialUrgentMode?: boolean;
  onSaveGuidanceIncident: (incident: GuidanceIncidentRecord, label: string) => Promise<void>;
  onQueueEarthHandoff: (incident: GuidanceIncidentRecord, markdown: string) => Promise<void>;
  onUpdateContinuityState: (
    updater: (prev: ContinuityPersistedState) => ContinuityPersistedState
  ) => Promise<void>;
  onUpdateEarthWan: (connected: boolean) => Promise<void>;
  onOpenSentinel: () => void;
  onNavigate: (page: PageId) => void;
  onBackHome: () => void;
}

type GuidanceWorkspaceTab = "INTAKE" | "STEPS" | "LIBRARY" | "TRACKING" | "HANDOFF";

const WHEN_BEGAN_OPTIONS = [
  "Just now (< 10 min)",
  "10–60 minutes ago",
  "1–6 hours ago",
  "> 6 hours / gradual",
  "Unsure",
];

const DEMO_SCENE_CARDS: Array<{
  id: MedicalHelpDemoSceneId;
  code: string;
  label: string;
}> = [
  { id: "SCENE_A_MINOR_CUT", code: "SCENE A", label: "Minor Cut" },
  { id: "SCENE_B_SEVERE_BLEEDING", code: "SCENE B", label: "Severe Bleeding" },
  { id: "SCENE_C_DIZZINESS_ILLNESS", code: "SCENE C", label: "Sudden Illness" },
  { id: "SCENE_D_CMO_UNAVAILABLE", code: "SCENE D", label: "CMO Unavailable" },
  { id: "SCENE_E_EARTH_UNAVAILABLE", code: "SCENE E", label: "Earth Offline" },
  { id: "SCENE_F_CONDITION_WORSENS", code: "SCENE F", label: "Condition Worsens" },
];

export const MedicalGuidancePage: React.FC<MedicalGuidancePageProps> = ({
  missionName,
  actorName,
  operatorRole,
  activeCrewId,
  crewRoster,
  baseline,
  latest,
  envAssessment,
  incidents,
  lifeSafetyEvents,
  lifeSafetyConfig,
  subjectiveHistory,
  resolvedEquipment,
  continuityState,
  resources,
  guidanceIncidents,
  earthWanConnected,
  browserOnline,
  isBusy,
  feedback,
  initialUrgentMode = false,
  onSaveGuidanceIncident,
  onQueueEarthHandoff,
  onUpdateContinuityState,
  onUpdateEarthWan,
  onOpenSentinel,
  onNavigate,
  onBackHome,
}) => {
  const [activeTab, setActiveTab] = useState<GuidanceWorkspaceTab>(
    initialUrgentMode ? "STEPS" : guidanceIncidents.length > 0 ? "STEPS" : "INTAKE"
  );
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    guidanceIncidents[0]?.incidentId || null
  );
  const [intake, setIntake] = useState<MedicalGuidanceScreenInput>(() => ({
    ...DEFAULT_SCREEN_INPUT,
    subjectCrewId: activeCrewId || "AST-01-COMMANDER",
    urgentBypassTriggered: initialUrgentMode,
  }));
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [showEquipmentFinder, setShowEquipmentFinder] = useState(true);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryGroup, setLibraryGroup] = useState<GuidanceCategoryGroup | "ALL">("ALL");
  const [sceneNotice, setSceneNotice] = useState<string | null>(null);

  // Condition tracking form state
  const [condSymptoms, setCondSymptoms] = useState("");
  const [condPain, setCondPain] = useState<number>(3);
  const [condResp, setCondResp] =
    useState<ConditionCheckEntry["responsiveness"]>("ALERT");
  const [condManualVitals, setCondManualVitals] = useState("");
  const [condChange, setCondChange] = useState<ConditionChangeDirection>("UNCHANGED");
  const [condActions, setCondActions] = useState("");
  const [condEquipUsed, setCondEquipUsed] = useState<string[]>([]);

  // Lifecycle notes
  const [closureNote, setClosureNote] = useState("");
  const [responseNote, setResponseNote] = useState("");

  // Optional SpeechRecognition dictation
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceNoteStatus, setVoiceNoteStatus] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (!selectedIncidentId && guidanceIncidents.length > 0) {
      setSelectedIncidentId(guidanceIncidents[0].incidentId);
    }
  }, [guidanceIncidents, selectedIncidentId]);

  const activeIncident = useMemo(
    () =>
      guidanceIncidents.find((i) => i.incidentId === selectedIncidentId) ||
      guidanceIncidents[0] ||
      null,
    [guidanceIncidents, selectedIncidentId]
  );

  const liveScreening = useMemo(() => evaluateEmergencyScreening(intake), [intake]);

  const activeProtocolResolution = useMemo(() => {
    if (activeIncident) {
      if (activeIncident.protocolId) {
        const foundProto =
          APPROVED_GUIDANCE_PROTOCOLS.find(
            (p) => p.protocolId === activeIncident.protocolId
          ) || null;
        return {
          found: Boolean(foundProto),
          protocol: foundProto,
          roleRestrictedNotice:
            foundProto?.requiresCmoForAdvanced &&
            (!continuityState.cmoAvailable || operatorRole !== "CREW_MEDICAL_OFFICER")
              ? foundProto.cmoRestrictedNote || null
              : null,
          noProcedureMessage: activeIncident.noApprovedProcedureNotice,
          unapprovedWarning: null,
        };
      }
      return {
        found: false,
        protocol: null,
        roleRestrictedNotice: null,
        noProcedureMessage:
          activeIncident.noApprovedProcedureNotice ||
          "No approved onboard procedure matched this event. Contact CMO / Earth Flight Surgeon.",
        unapprovedWarning:
          "Safety rule: AEGIS-V never invents procedures or medication dosages.",
      };
    }
    return resolveProtocolForIntake(intake, liveScreening, continuityState, operatorRole);
  }, [activeIncident, intake, liveScreening, continuityState, operatorRole]);

  const currentStepNum = activeIncident?.currentStepNumber || 1;
  const activeProtocol = activeProtocolResolution.protocol;
  const currentStep = activeProtocol
    ? activeProtocol.steps.find((s) => s.stepNumber === currentStepNum) ||
      activeProtocol.steps[0]
    : null;

  const equipmentMatches = useMemo(() => {
    if (!activeProtocol) return [];
    const stepEqIds = currentStep?.equipmentIds || [];
    const allProtoEqIds = Array.from(
      new Set(activeProtocol.steps.flatMap((s) => s.equipmentIds))
    );
    const idsToCheck = showAllSteps ? allProtoEqIds : stepEqIds.length > 0 ? stepEqIds : allProtoEqIds;
    return findMedicalEquipmentWithAlternatives(idsToCheck, resolvedEquipment, activeProtocol);
  }, [activeProtocol, currentStep, showAllSteps, resolvedEquipment]);

  const personalizedContext = useMemo(
    () =>
      buildPersonalizedGuidanceContext({
        subjectCrewId: activeIncident?.subjectCrewId || intake.subjectCrewId,
        intake: activeIncident?.screeningInput || intake,
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
        earthWanConnected,
        browserOnline,
        viewerRole: operatorRole,
      }),
    [
      activeIncident,
      intake,
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
      earthWanConnected,
      browserOnline,
      operatorRole,
    ]
  );

  const libraryResults = useMemo(
    () => searchGuidanceLibrary(libraryQuery, libraryGroup, resources),
    [libraryQuery, libraryGroup, resources]
  );

  const responderOverdue = useMemo(() => {
    if (!activeIncident) return { isOverdue: false, overdueMinutes: 0 };
    return evaluateGuidanceResponderOverdue(activeIncident, new Date().toISOString());
  }, [activeIncident]);

  const isObserverReadOnly = operatorRole === "MISSION_OBSERVER";

  const handleToggleVoiceDictation = () => {
    if (isListeningVoice && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListeningVoice(false);
      return;
    }
    const SpeechRec =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (typeof SpeechRec !== "function") {
      setVoiceNoteStatus(
        "Voice dictation is not supported in this browser — use the quick tap buttons or text box."
      );
      return;
    }
    try {
      const rec = new (SpeechRec as new () => {
        lang: string;
        interimResults: boolean;
        onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      })();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.onresult = (ev) => {
        const transcript = ev.results?.[0]?.[0]?.transcript || "";
        if (transcript) {
          setIntake((prev) => ({
            ...prev,
            whatHappened: prev.whatHappened
              ? `${prev.whatHappened} ${transcript}`
              : transcript,
          }));
          setVoiceNoteStatus(`Captured voice input: "${transcript}"`);
        }
      };
      rec.onerror = () => {
        setIsListeningVoice(false);
        setVoiceNoteStatus("Microphone unavailable — quick tap buttons remain ready.");
      };
      rec.onend = () => setIsListeningVoice(false);
      recognitionRef.current = rec;
      rec.start();
      setIsListeningVoice(true);
      setVoiceNoteStatus("Listening... speak briefly what happened.");
    } catch {
      setVoiceNoteStatus("Could not start microphone — continue with tap buttons.");
    }
  };

  const handleTriggerUrgentBypass = async () => {
    if (isObserverReadOnly) return;
    const nowIso = new Date().toISOString();
    const urgentInput: MedicalGuidanceScreenInput = {
      ...intake,
      whatHappened: intake.whatHappened || "Urgent emergency bypass activated by crew",
      urgentBypassTriggered: true,
    };
    const screening = evaluateEmergencyScreening(urgentInput);
    const resolution = resolveProtocolForIntake(
      urgentInput,
      screening,
      continuityState,
      operatorRole
    );
    const created = createMedicalGuidanceIncident({
      nowIso,
      missionName,
      intake: urgentInput,
      screening,
      resolution,
      reporterName: actorName,
      reporterRole: operatorRole,
      crewRoster,
      continuityState,
      lifeSafetyConfig,
      earthWanConnected,
      browserOnline,
    });
    setIntake(urgentInput);
    setSelectedIncidentId(created.incidentId);
    setActiveTab("STEPS");
    await onSaveGuidanceIncident(created, "Urgent medical help initiated");
  };

  const handleSubmitIntake = async () => {
    if (isObserverReadOnly) return;
    const nowIso = new Date().toISOString();
    const screening = evaluateEmergencyScreening(intake);
    const resolution = resolveProtocolForIntake(
      intake,
      screening,
      continuityState,
      operatorRole
    );
    const created = createMedicalGuidanceIncident({
      nowIso,
      missionName,
      intake,
      screening,
      resolution,
      reporterName: actorName,
      reporterRole: operatorRole,
      crewRoster,
      continuityState,
      lifeSafetyConfig,
      earthWanConnected,
      browserOnline,
    });
    setSelectedIncidentId(created.incidentId);
    setActiveTab("STEPS");
    await onSaveGuidanceIncident(created, "Medical guidance intake started");
  };

  const handleSelectCategoryShortcut = async (catId: GuidanceCategoryId) => {
    const updatedIntake: MedicalGuidanceScreenInput = {
      ...DEFAULT_SCREEN_INPUT,
      subjectCrewId: activeCrewId || "AST-01-COMMANDER",
      selectedCategories: [catId],
      whatHappened:
        catId === "UNLISTED_COMPLEX_CONCERN"
          ? "Unlisted / complex medical concern"
          : GUIDANCE_CATEGORIES.find((c) => c.id === catId)?.label || catId,
      severeBleeding: catId === "BLEEDING" ? "YES" : "NO",
      selectedRedFlags:
        catId === "BLEEDING"
          ? ["SEVERE_UNCONTROLLED_BLEEDING"]
          : catId === "BURNS"
          ? ["SERIOUS_BURNS"]
          : catId === "EYE_INJURIES"
          ? ["SEVERE_EYE_INJURY"]
          : catId === "CHEST_DISCOMFORT"
          ? ["SEVERE_CHEST_PAIN"]
          : catId === "BREATHING_DIFFICULTIES"
          ? ["ABNORMAL_ABSENT_BREATHING"]
          : catId === "SUSPECTED_FRACTURES"
          ? ["SUSPECTED_FRACTURE_MAJOR_TRAUMA"]
          : [],
      urgentBypassTriggered: false,
    };
    setIntake(updatedIntake);
    if (isObserverReadOnly) {
      setSelectedIncidentId(null);
      setActiveTab("STEPS");
      return;
    }
    const nowIso = new Date().toISOString();
    const screening = evaluateEmergencyScreening(updatedIntake);
    const resolution = resolveProtocolForIntake(
      updatedIntake,
      screening,
      continuityState,
      operatorRole
    );
    const created = createMedicalGuidanceIncident({
      nowIso,
      missionName,
      intake: updatedIntake,
      screening,
      resolution,
      reporterName: actorName,
      reporterRole: operatorRole,
      crewRoster,
      continuityState,
      lifeSafetyConfig,
      earthWanConnected,
      browserOnline,
    });
    setSelectedIncidentId(created.incidentId);
    setActiveTab("STEPS");
    await onSaveGuidanceIncident(created, `Guidance opened: ${updatedIntake.whatHappened}`);
  };

  const handleStepNavigation = async (
    targetStep: 1 | 2 | 3 | 4 | 5,
    markCurrentComplete: boolean
  ) => {
    if (!activeIncident || isObserverReadOnly) return;
    const nowIso = new Date().toISOString();
    const doneSet = new Set(activeIncident.completedStepNumbers);
    if (markCurrentComplete) {
      doneSet.add(activeIncident.currentStepNumber);
    }
    const updated: GuidanceIncidentRecord = {
      ...activeIncident,
      currentStepNumber: targetStep,
      completedStepNumbers: Array.from(doneSet).sort((a, b) => a - b),
      updatedAtIso: nowIso,
      syncStatus: browserOnline ? "SYNCED_CLOUD" : "QUEUED_OFFLINE",
    };
    await onSaveGuidanceIncident(updated, `Step ${targetStep} active`);
  };

  const handleRecordConditionCheck = async () => {
    if (!activeIncident || isObserverReadOnly) return;
    const nowIso = new Date().toISOString();
    const updated = recordConditionTrackingUpdate({
      incident: activeIncident,
      nowIso,
      actorName,
      actorRole: operatorRole,
      symptoms: condSymptoms,
      painLevel0to10: condPain,
      responsiveness: condResp,
      manualVitalsNote: condManualVitals,
      changeDirection: condChange,
      actionsPerformed: condActions,
      equipmentUsed: condEquipUsed,
      latest,
      baseline,
      browserOnline,
    });
    setCondSymptoms("");
    setCondActions("");
    setCondManualVitals("");
    await onSaveGuidanceIncident(
      updated,
      condChange === "WORSENING" ? "Condition worsened — escalated" : "Condition check recorded"
    );
  };

  const handleLifecycleTransition = async (
    action:
      | { type: "NOTIFY_RESPONDER"; ackWindowMinutes?: number }
      | { type: "ACKNOWLEDGE_RESPONDER"; note?: string }
      | { type: "ESCALATE_TO_BACKUP"; reason: string }
      | { type: "RECORD_RESPONSE"; summary: string }
      | { type: "ENTER_MONITORING"; note?: string }
      | { type: "CLOSE_EXPLICIT"; closureNotes: string }
  ) => {
    if (!activeIncident || isObserverReadOnly) return;
    const updated = transitionMedicalGuidanceIncident(activeIncident, action, {
      actorName,
      actorRole: operatorRole,
      nowIso: new Date().toISOString(),
      browserOnline,
    });
    await onSaveGuidanceIncident(updated, `Lifecycle → ${updated.state}`);
  };

  const handleRunDemoScene = async (sceneId: MedicalHelpDemoSceneId) => {
    const nowIso = new Date().toISOString();
    const result = buildGuidanceDemoScene({
      sceneId,
      nowIso,
      missionName,
      crewRoster,
      continuityState,
      lifeSafetyConfig,
      latest,
      baseline,
      earthWanConnected,
      browserOnline,
    });
    setIntake(result.intake);
    setSceneNotice(result.sceneBanner);
    if (result.continuityOverride) {
      await onUpdateContinuityState(() => result.continuityOverride!);
    }
    if (result.earthWanOverride !== undefined) {
      await onUpdateEarthWan(result.earthWanOverride);
    }
    setSelectedIncidentId(result.incident.incidentId);
    setActiveTab(
      sceneId === "SCENE_F_CONDITION_WORSENS"
        ? "TRACKING"
        : sceneId === "SCENE_D_CMO_UNAVAILABLE" || sceneId === "SCENE_E_EARTH_UNAVAILABLE"
        ? "HANDOFF"
        : "STEPS"
    );
    if (!isObserverReadOnly) {
      await onSaveGuidanceIncident(result.incident, result.sceneBanner);
    }
  };

  const handleDownloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const toggleRedFlag = (id: RedFlagSignId) => {
    setIntake((prev) => {
      const exists = prev.selectedRedFlags.includes(id);
      return {
        ...prev,
        selectedRedFlags: exists
          ? prev.selectedRedFlags.filter((r) => r !== id)
          : [...prev.selectedRedFlags, id],
      };
    });
  };

  const toggleCategory = (id: GuidanceCategoryId) => {
    setIntake((prev) => {
      const exists = prev.selectedCategories.includes(id);
      return {
        ...prev,
        selectedCategories: exists
          ? prev.selectedCategories.filter((c) => c !== id)
          : [...prev.selectedCategories, id],
      };
    });
  };

  const isEmergencyBanner =
    activeIncident?.priorityLevel === "URGENT_RED_FLAG" ||
    activeIncident?.state === "ESCALATED" ||
    liveScreening.isEmergency;

  return (
    <div className="space-y-5">
      {/* Top Header & Immediate Urgent Emergency Control */}
      <section
        className={`rounded-2xl border p-5 space-y-4 ${
          isEmergencyBanner
            ? "bg-rose-50/95 border-rose-300 text-rose-950"
            : "glass-panel border-slate-200 text-slate-900"
        }`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-8 space-y-3">
            <div className="space-y-1">
              <button
                type="button"
                onClick={onBackHome}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Mission Dashboard</span>
              </button>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2.5">
                <HeartPulse
                  className={`w-6 h-6 shrink-0 ${
                    isEmergencyBanner ? "text-rose-700" : "text-sky-700"
                  }`}
                />
                <span>Emergency Medical Guidance &amp; First-Response Assistant</span>
              </h1>
              <p className="text-xs opacity-90 max-w-3xl">
                {MEDICAL_GUIDANCE_PROTOTYPE_SAFETY_NOTICE}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isBusy || isObserverReadOnly}
                onClick={handleTriggerUrgentBypass}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-60 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>URGENT EMERGENCY</span>
              </button>
              <button
                type="button"
                onClick={onOpenSentinel}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold cursor-pointer"
              >
                Life-Safety Sentinel →
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 aspect-[16/9] rounded-xl overflow-hidden border border-slate-200/80">
            <SafeImage
              src={VISUAL_ASSETS.medicalHelp}
              alt="Orbital emergency medical kit and first-response guidance tablet"
              caption="22 Verified Onboard Guides · Offline Ready"
            />
          </div>
        </div>

        {/* Status Bar: Earth Comms, CMO Availability, Offline Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="rounded-xl bg-white/85 border border-slate-200 px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-slate-600 font-medium">Earth Comms</span>
            <span className="font-mono font-semibold text-slate-900 inline-flex items-center gap-1">
              {earthWanConnected && browserOnline ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-700" />
              )}
              {earthWanConnected && browserOnline ? "AVAILABLE" : "UNAVAILABLE (OFFLINE READY)"}
            </span>
          </div>

          <div className="rounded-xl bg-white/85 border border-slate-200 px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-slate-600 font-medium">CMO Availability</span>
            <span className="font-mono font-semibold text-slate-900">
              {continuityState.cmoAvailable
                ? "● CMO AVAILABLE"
                : `▲ CMO UNAVAILABLE (${personalizedContext.responderContext.primaryResponderName})`}
            </span>
          </div>

          <div className="rounded-xl bg-white/85 border border-slate-200 px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-slate-600 font-medium">Active Role</span>
            <span className="font-mono font-semibold text-slate-900">
              {operatorRole.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* 6 Synthetic Demonstration Scenarios */}
        <div className="pt-2 border-t border-slate-200/70 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              6 Verification &amp; Training Scenarios (Synthetic Demo Data)
            </span>
            {sceneNotice && (
              <span className="text-xs font-medium text-sky-900 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-lg">
                {sceneNotice}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {DEMO_SCENE_CARDS.map((sc) => (
              <button
                key={sc.id}
                type="button"
                disabled={isBusy}
                onClick={() => handleRunDemoScene(sc.id)}
                className="text-left px-3 py-2 rounded-xl border border-slate-200 bg-white/90 hover:bg-sky-50 hover:border-sky-300 cursor-pointer transition-colors"
              >
                <div className="font-mono text-[10px] font-bold text-sky-800">{sc.code}</div>
                <div className="text-xs font-semibold text-slate-900 truncate">{sc.label}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {feedback && (
        <div
          className={`rounded-xl px-4 py-2.5 border text-xs font-medium ${
            feedback.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-950"
              : "bg-rose-50 border-rose-200 text-rose-950"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Persistent Active Guidance Incident Strip */}
      {guidanceIncidents.length > 0 && (
        <section className="glass-panel rounded-2xl p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">
              Active &amp; Recent Guidance Incidents (Preserved Offline &amp; Cloud)
            </span>
            {activeIncident && (
              <span className="font-mono text-xs font-semibold text-slate-900">
                Selected: {activeIncident.incidentId} · State: {activeIncident.state} ·{" "}
                {activeIncident.syncStatus}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {guidanceIncidents.slice(0, 6).map((inc) => {
              const isSelected = activeIncident?.incidentId === inc.incidentId;
              return (
                <button
                  key={inc.incidentId}
                  type="button"
                  onClick={() => {
                    setSelectedIncidentId(inc.incidentId);
                    setActiveTab("STEPS");
                  }}
                  className={`px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer text-left ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900"
                      : inc.state === "ESCALATED" || inc.priorityLevel === "URGENT_RED_FLAG"
                      ? "bg-rose-50 border-rose-200 text-rose-950 hover:bg-rose-100"
                      : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <div className="font-mono text-[10px] opacity-80">
                    {inc.state} · {inc.subjectCrewName}
                  </div>
                  <div className="font-semibold truncate max-w-[220px]">
                    {inc.protocolTitle || inc.screeningInput.whatHappened || inc.incidentId}
                  </div>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setSelectedIncidentId(null);
                setIntake({
                  ...DEFAULT_SCREEN_INPUT,
                  subjectCrewId: activeCrewId || "AST-01-COMMANDER",
                });
                setActiveTab("INTAKE");
              }}
              className="px-3 py-2 rounded-xl border border-dashed border-slate-300 bg-white/75 hover:bg-white text-xs font-semibold text-slate-800 cursor-pointer"
            >
              + Start New Help Intake
            </button>
          </div>
        </section>
      )}

      {/* Workspace Navigation Tabs */}
      <nav className="flex flex-wrap gap-2" aria-label="Medical Guidance Sections">
        {(
          [
            { id: "INTAKE", label: "1. Rapid Intake & Screening" },
            { id: "STEPS", label: "2. Step-by-Step Guidance & Equipment" },
            { id: "LIBRARY", label: "3. Browse 22 Categories & Offline Library" },
            { id: "TRACKING", label: "4. Live Condition Tracking & Escalation" },
            { id: "HANDOFF", label: "5. Personalized Context & Earth Handoff" },
          ] as Array<{ id: GuidanceWorkspaceTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold cursor-pointer transition-colors ${
              activeTab === tab.id
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white/90 text-slate-800 border-slate-200 hover:bg-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* TAB 1: RAPID INTAKE & ADAPTIVE EMERGENCY SCREENING */}
      {activeTab === "INTAKE" && (
        <section className="glass-panel rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Rapid Emergency Screening &amp; Intake
              </h2>
              <p className="text-xs text-slate-600">
                Designed for high-stress use: tap large buttons below. Any red-flag sign immediately
                opens urgent guidance and alerts a responder.
              </p>
            </div>
            <button
              type="button"
              disabled={isObserverReadOnly || isBusy}
              onClick={handleTriggerUrgentBypass}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Skip Form — URGENT EMERGENCY Now</span>
            </button>
          </div>

          {liveScreening.isEmergency && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 space-y-2 text-rose-950">
              <div className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                <span>{liveScreening.warningHeadline}</span>
              </div>
              <ul className="list-disc pl-5 text-xs space-y-1">
                {liveScreening.warningReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <button
                type="button"
                disabled={isObserverReadOnly || isBusy}
                onClick={handleSubmitIntake}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold cursor-pointer"
              >
                Open Urgent Procedure &amp; Notify Responder Immediately →
              </button>
            </div>
          )}

          {/* Question 1: Who needs help + Subject */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Who needs help?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "ME", label: "Me" },
                    { id: "ANOTHER_CREW", label: "Another crew member" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setIntake((p) => ({
                        ...p,
                        whoNeedsHelp: opt.id,
                        subjectCrewId:
                          opt.id === "ME"
                            ? activeCrewId || "AST-01-COMMANDER"
                            : crewRoster.find((c) => c.crewId !== activeCrewId)?.crewId ||
                              "AST-03-SPECIALIST",
                      }))
                    }
                    className={`min-h-[46px] px-3 py-2 rounded-xl border text-sm font-semibold cursor-pointer ${
                      intake.whoNeedsHelp === opt.id
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="subject-crew-select"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Crew Member Needing Help
              </label>
              <select
                id="subject-crew-select"
                value={intake.subjectCrewId}
                onChange={(e) =>
                  setIntake((p) => ({ ...p, subjectCrewId: e.target.value }))
                }
                className="w-full min-h-[46px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900"
              >
                {crewRoster.map((member) => (
                  <option key={member.crewId} value={member.crewId}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Critical 3 Rapid Safety Checks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(
              [
                {
                  key: "conscious",
                  label: "Is the person conscious?",
                  dangerValue: "NO",
                },
                {
                  key: "breathingNormal",
                  label: "Is the person breathing normally?",
                  dangerValue: "NO",
                },
                {
                  key: "severeBleeding",
                  label: "Is there severe bleeding?",
                  dangerValue: "YES",
                },
              ] as const
            ).map((q) => (
              <div
                key={q.key}
                className="rounded-xl border border-slate-200 bg-white/80 p-3.5 space-y-2"
              >
                <div className="text-xs font-bold text-slate-900">{q.label}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["YES", "NO", "UNSURE"] as TriStateAnswer[]).map((ans) => {
                    const active = intake[q.key] === ans;
                    const isDanger = ans === q.dangerValue || ans === "UNSURE";
                    return (
                      <button
                        key={ans}
                        type="button"
                        onClick={() => setIntake((p) => ({ ...p, [q.key]: ans }))}
                        className={`min-h-[44px] rounded-lg border text-xs font-bold cursor-pointer ${
                          active
                            ? isDanger
                              ? "bg-rose-700 text-white border-rose-700"
                              : "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {ans === "YES" ? "Yes" : ans === "NO" ? "No" : "Unsure"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* What happened + Optional Voice Dictation + When began */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="what-happened-input"
                  className="text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  What happened? (Brief description or optional voice input)
                </label>
                <button
                  type="button"
                  onClick={handleToggleVoiceDictation}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                    isListeningVoice
                      ? "bg-rose-700 text-white border-rose-700"
                      : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {isListeningVoice ? (
                    <MicOff className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                  <span>{isListeningVoice ? "Stop Voice" : "Voice Input (Optional)"}</span>
                </button>
              </div>
              <textarea
                id="what-happened-input"
                rows={2}
                value={intake.whatHappened}
                onChange={(e) =>
                  setIntake((p) => ({ ...p, whatHappened: e.target.value }))
                }
                placeholder="Example: Cut forearm on rack latch, or sudden dizziness near Node-2..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
              />
              {voiceNoteStatus && (
                <div className="text-[11px] text-slate-600">{voiceNoteStatus}</div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                When did it begin?
              </label>
              <div className="space-y-1.5">
                {WHEN_BEGAN_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setIntake((p) => ({ ...p, whenBegan: opt }))}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                      intake.whenBegan === opt
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Red-Flag Warning Signs Checkboxes */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-rose-800">
              Any urgent warning signs present? (Tap any that apply)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {RED_FLAG_SIGNS.map((rf) => {
                const selected = intake.selectedRedFlags.includes(rf.id);
                return (
                  <button
                    key={rf.id}
                    type="button"
                    onClick={() => toggleRedFlag(rf.id)}
                    className={`min-h-[44px] text-left px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                      selected
                        ? "bg-rose-700 text-white border-rose-700"
                        : "bg-white text-slate-800 border-slate-200 hover:bg-rose-50"
                    }`}
                  >
                    {selected ? "✖ " : "○ "}
                    {rf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Symptoms / Category Selector */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Symptoms or injury category (Navigation options — NOT diagnoses)
            </div>
            <div className="flex flex-wrap gap-2">
              {GUIDANCE_CATEGORIES.map((cat) => {
                const active = intake.selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                      active
                        ? "bg-sky-700 text-white border-sky-700"
                        : "bg-white text-slate-800 border-slate-200 hover:bg-sky-50"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => toggleCategory("UNLISTED_COMPLEX_CONCERN")}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                  intake.selectedCategories.includes("UNLISTED_COMPLEX_CONCERN")
                    ? "bg-amber-700 text-white border-amber-700"
                    : "bg-white text-slate-800 border-slate-300 hover:bg-amber-50"
                }`}
              >
                Other / Unlisted Concern
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-600">
              {liveScreening.nonDiagnosticNotice}
            </span>
            <button
              type="button"
              disabled={isBusy || isObserverReadOnly}
              onClick={handleSubmitIntake}
              className="min-h-[46px] px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Start Step-by-Step First-Response Guidance</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* TAB 2: STEP-BY-STEP FIRST-RESPONSE GUIDANCE & EQUIPMENT FINDER */}
      {activeTab === "STEPS" && (
        <section className="space-y-4">
          {/* No Approved Procedure Fallback */}
          {!activeProtocol ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 space-y-3 text-amber-950">
              <div className="flex items-center gap-2 text-base font-bold">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
                <span>No Approved Onboard Procedure Available</span>
              </div>
              <p className="text-sm">
                {activeProtocolResolution.noProcedureMessage ||
                  "No approved onboard procedure matches this symptom or situation."}
              </p>
              {activeProtocolResolution.unapprovedWarning && (
                <p className="text-xs font-semibold">
                  {activeProtocolResolution.unapprovedWarning}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("LIBRARY")}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-amber-300 text-slate-900 text-xs font-bold cursor-pointer"
                >
                  Browse 22 Approved Categories →
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("TRACKING")}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                >
                  Notify Human Responder / CMO →
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Protocol Header + Source + Version + Role Notice */}
              <div
                className={`rounded-2xl border p-5 space-y-3 ${
                  activeProtocol.isUrgent || isEmergencyBanner
                    ? "bg-rose-50/90 border-rose-300 text-rose-950"
                    : "glass-panel border-slate-200 text-slate-900"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-mono text-xs font-bold uppercase tracking-wider">
                      {activeProtocol.protocolId} · {activeProtocol.version}
                    </div>
                    <h2 className="text-xl font-bold">{activeProtocol.title}</h2>
                    <div className="text-xs opacity-90">
                      <span className="font-semibold">Approved Source:</span>{" "}
                      {activeProtocol.source}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEquipmentFinder((v) => !v)}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <PackageSearch className="w-4 h-4 text-sky-700" />
                      <span>FIND EQUIPMENT</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAllSteps((v) => !v)}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-semibold cursor-pointer"
                    >
                      {showAllSteps ? "Show 1 Step at a Time" : "Overview: All 5 Steps"}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-white/85 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800">
                  {activeProtocol.overviewNotice}
                </div>

                {activeProtocolResolution.roleRestrictedNotice && (
                  <div className="rounded-xl bg-amber-50 border border-amber-300 px-3.5 py-2.5 text-xs text-amber-950 flex items-start gap-2">
                    <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>{activeProtocolResolution.roleRestrictedNotice}</span>
                  </div>
                )}

                {/* Progress Indicator */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>
                      Step {currentStepNum} of 5 ·{" "}
                      {activeIncident?.completedStepNumbers.length || 0} completed
                    </span>
                    <span className="font-mono">
                      {Math.round(((activeIncident?.completedStepNumbers.length || 0) / 5) * 100)}%
                      logged
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {activeProtocol.steps.map((s) => {
                      const isCurrent = s.stepNumber === currentStepNum;
                      const isDone = activeIncident?.completedStepNumbers.includes(s.stepNumber);
                      return (
                        <button
                          key={s.stepNumber}
                          type="button"
                          onClick={() => handleStepNavigation(s.stepNumber, false)}
                          className={`py-2 px-2 rounded-lg border text-[11px] font-bold cursor-pointer truncate ${
                            isCurrent
                              ? "bg-slate-900 text-white border-slate-900"
                              : isDone
                              ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {isDone ? "✓ " : ""}Step {s.stepNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 1-Step-At-A-Time Stress-Friendly Card OR All 5 Steps */}
              <div className="space-y-4">
                {(showAllSteps ? activeProtocol.steps : currentStep ? [currentStep] : []).map(
                  (step) => (
                    <article
                      key={step.stepNumber}
                      className="glass-panel rounded-2xl p-6 space-y-4 border border-slate-200"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                          {step.heading}
                        </h3>
                        {activeIncident?.completedStepNumbers.includes(step.stepNumber) && (
                          <span className="text-xs font-bold text-emerald-800 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Step Completed
                          </span>
                        )}
                      </div>

                      <div className="rounded-xl bg-slate-900 text-white p-4 space-y-1">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-sky-300">
                          What to do
                        </div>
                        <div className="text-base sm:text-lg font-bold leading-snug">
                          {step.whatToDo}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-1.5">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                            How to do it
                          </div>
                          <p className="text-sm text-slate-900 leading-relaxed">{step.howToDoIt}</p>
                        </div>

                        <div className="rounded-xl bg-rose-50/80 border border-rose-200 p-4 space-y-1.5">
                          <div className="text-xs font-bold uppercase tracking-wider text-rose-800">
                            What NOT to do
                          </div>
                          <p className="text-sm text-rose-950 leading-relaxed">
                            {step.whatNotToDo}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl bg-amber-50/90 border border-amber-200 p-4 space-y-1">
                        <div className="text-xs font-bold uppercase tracking-wider text-amber-900">
                          When to stop and seek higher-level assistance
                        </div>
                        <p className="text-sm text-amber-950 font-medium">
                          {step.whenToStopAndEscalate}
                        </p>
                      </div>

                      <div className="text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span>
                          Equipment needed:{" "}
                          {step.equipmentIds.length > 0
                            ? step.equipmentIds.join(", ")
                            : "No specialized hardware required for this step"}
                        </span>
                        <span className="font-mono">
                          {activeProtocol.protocolId} · {activeProtocol.version}
                        </span>
                      </div>
                    </article>
                  )
                )}

                {/* Large Stress-Friendly Step Controls */}
                {!showAllSteps && (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={currentStepNum <= 1 || isBusy}
                      onClick={() =>
                        handleStepNavigation(
                          Math.max(1, currentStepNum - 1) as 1 | 2 | 3 | 4 | 5,
                          false
                        )
                      }
                      className="min-h-[48px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-sm font-bold text-slate-900 inline-flex items-center gap-2 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Previous Step</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isBusy || isObserverReadOnly}
                        onClick={() => setActiveTab("TRACKING")}
                        className="min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-900 cursor-pointer"
                      >
                        Log Condition / Pain →
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || isObserverReadOnly}
                        onClick={() =>
                          handleStepNavigation(
                            Math.min(5, currentStepNum + 1) as 1 | 2 | 3 | 4 | 5,
                            true
                          )
                        }
                        className="min-h-[48px] px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                      >
                        <span>
                          {currentStepNum < 5
                            ? `Done — Next Step (${currentStepNum + 1}/5)`
                            : "Mark Step 5 Checked"}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Medical Equipment Finder */}
              {showEquipmentFinder && (
                <div className="glass-panel rounded-2xl p-5 space-y-3 border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 inline-flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-sky-700" />
                      <span>Onboard Medical Equipment Finder &amp; Documented Alternatives</span>
                    </h3>
                    <span className="text-[11px] font-mono text-slate-600">
                      Verify physical seal &amp; expiry before use
                    </span>
                  </div>

                  {equipmentMatches.length === 0 ? (
                    <p className="text-xs text-slate-600">
                      This protocol step does not require specialized hardware.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {equipmentMatches.map((eq) => (
                        <div
                          key={eq.equipmentId}
                          className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-mono text-[10px] text-slate-500">
                                {eq.equipmentId}
                              </div>
                              <div className="font-bold text-slate-900 text-sm">{eq.name}</div>
                            </div>
                            <span
                              className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                eq.availability === "AVAILABLE"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : eq.availability === "LIMITED"
                                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                                  : "bg-rose-50 text-rose-800 border border-rose-200"
                              }`}
                            >
                              {eq.availability}
                            </span>
                          </div>
                          <div className="text-slate-800">
                            <span className="font-semibold">Storage Location:</span>{" "}
                            {eq.storageLocation}
                          </div>
                          <div className="text-slate-700">
                            <span className="font-semibold">Operational / Inspection:</span>{" "}
                            {eq.inspectionAndExpiry} · {eq.lastConfirmedText}
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-slate-800">
                            <span className="font-semibold">Documented Alternative:</span>{" "}
                            {eq.documentedAlternative}
                          </div>
                          {eq.requiresVerificationNote && (
                            <div className="text-amber-800 font-semibold">
                              ▲ {eq.requiresVerificationNote}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* TAB 3: SEARCHABLE 22 GUIDANCE CATEGORIES & OFFLINE LIBRARY */}
      {activeTab === "LIBRARY" && (
        <section className="glass-panel rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 inline-flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-700" />
                <span>Offline Searchable Guidance Categories (22 Navigation Topics)</span>
              </h2>
              <p className="text-xs text-slate-600">
                100% available without internet or Earth communications. Categories are navigation
                starting points — never automated diagnoses.
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              Offline Cache Ready ({APPROVED_GUIDANCE_PROTOCOLS.length} Approved Protocols)
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={libraryQuery}
                onChange={(e) => setLibraryQuery(e.target.value)}
                placeholder="Search offline library (e.g. bleeding, burn, eye, dizzy, CO2, radiation)..."
                className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "ALL", label: "All (22)" },
                  { id: "INJURIES", label: "Injuries (8)" },
                  { id: "SUDDEN_HEALTH", label: "Sudden Health (8)" },
                  { id: "SPACEFLIGHT", label: "Spaceflight (6)" },
                ] as const
              ).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setLibraryGroup(g.id)}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                    libraryGroup === g.id
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {libraryResults.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCategoryShortcut(cat.id)}
                className="text-left rounded-xl border border-slate-200 bg-white hover:border-sky-400 hover:bg-sky-50/40 p-4 space-y-1.5 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase text-sky-800">
                    {cat.group.replace(/_/g, " ")}
                  </span>
                  {cat.defaultRedFlagEligible && (
                    <span className="font-mono text-[10px] font-bold text-rose-700">
                      PRIORITY CHECK
                    </span>
                  )}
                </div>
                <div className="text-sm font-bold text-slate-900">{cat.label}</div>
                <p className="text-xs text-slate-600">{cat.shortDesc}</p>
              </button>
            ))}
          </div>

          {libraryResults.categories.length === 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2 text-xs text-amber-950">
              <div className="font-bold">
                No approved category matched "{libraryQuery}".
              </div>
              <p>
                AEGIS-V does not invent unapproved procedures or medication dosages. Escalate this
                unlisted concern directly to the Crew Medical Officer or Earth Flight Surgeon.
              </p>
              <button
                type="button"
                onClick={() => handleSelectCategoryShortcut("UNLISTED_COMPLEX_CONCERN")}
                className="px-3 py-2 rounded-lg bg-amber-800 text-white font-semibold cursor-pointer"
              >
                Open Unlisted Concern Escalation →
              </button>
            </div>
          )}

          {/* Offline Curated NASA/CSA References */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Curated NASA / CSA Reference Pack ({libraryResults.resources.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {libraryResults.resources.slice(0, 4).map((res) => (
                <div
                  key={res.resource_id}
                  className="rounded-xl border border-slate-200 bg-white/85 p-3 space-y-1 text-xs"
                >
                  <div className="font-semibold text-slate-900">{res.title}</div>
                  <div className="text-[11px] text-slate-600">
                    {res.publisher} · {res.publication_date}
                  </div>
                  <p className="text-slate-700">{res.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: LIVE CONDITION TRACKING & HUMAN ESCALATION LIFECYCLE */}
      {activeTab === "TRACKING" && (
        <section className="space-y-4">
          {!activeIncident ? (
            <div className="glass-panel rounded-2xl p-6 text-sm text-slate-700 space-y-3">
              <p>No active guidance incident selected yet. Start an intake or urgent emergency first.</p>
              <button
                type="button"
                onClick={() => setActiveTab("INTAKE")}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
              >
                Open Rapid Intake →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left: Live Condition Check Logger */}
              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-sky-700" />
                    <span>Live Condition Tracking</span>
                  </h2>
                  <p className="text-xs text-slate-600">
                    Log condition direction, pain, responsiveness, actions, and equipment. Any
                    worsening triggers an immediate escalation warning.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Condition Change Since Last Check
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["IMPROVED", "UNCHANGED", "WORSENING"] as ConditionChangeDirection[]).map(
                      (dir) => (
                        <button
                          key={dir}
                          type="button"
                          onClick={() => setCondChange(dir)}
                          className={`min-h-[44px] rounded-xl border text-xs font-bold cursor-pointer ${
                            condChange === dir
                              ? dir === "WORSENING"
                                ? "bg-rose-700 text-white border-rose-700"
                                : dir === "IMPROVED"
                                ? "bg-emerald-700 text-white border-emerald-700"
                                : "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-800 border-slate-300"
                          }`}
                        >
                          {dir}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Pain Level (0–10): <span className="font-mono">{condPain}/10</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={condPain}
                      onChange={(e) => setCondPain(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Responsiveness
                    </label>
                    <select
                      value={condResp}
                      onChange={(e) =>
                        setCondResp(
                          e.target.value as ConditionCheckEntry["responsiveness"]
                        )
                      }
                      className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900"
                    >
                      <option value="ALERT">Alert &amp; Oriented</option>
                      <option value="DROWSY_CONFUSED">Drowsy / Confused (Urgent)</option>
                      <option value="UNRESPONSIVE">Unresponsive (Critical)</option>
                      <option value="UNKNOWN">Unknown</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Current Symptoms &amp; Observations
                  </label>
                  <input
                    type="text"
                    value={condSymptoms}
                    onChange={(e) => setCondSymptoms(e.target.value)}
                    placeholder="e.g. Bleeding slowed under bandage, pain 3/10..."
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Actions Performed &amp; Manual Vitals (optional)
                  </label>
                  <input
                    type="text"
                    value={condActions}
                    onChange={(e) => setCondActions(e.target.value)}
                    placeholder="Actions taken (e.g. applied gauze, seated rest, 250 mL water)"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 mb-2"
                  />
                  <input
                    type="text"
                    value={condManualVitals}
                    onChange={(e) => setCondManualVitals(e.target.value)}
                    placeholder="Manual vitals note (auto-pulls valid latest vitals automatically)"
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-slate-700">
                    Equipment Used (tap any)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {resolvedEquipment
                      .filter((e) => e.effectiveStatus !== "UNAVAILABLE")
                      .slice(0, 8)
                      .map((eq) => {
                        const used = condEquipUsed.includes(eq.equipmentId);
                        return (
                          <button
                            key={eq.equipmentId}
                            type="button"
                            onClick={() =>
                              setCondEquipUsed((p) =>
                                p.includes(eq.equipmentId)
                                  ? p.filter((x) => x !== eq.equipmentId)
                                  : [...p, eq.equipmentId]
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer ${
                              used
                                ? "bg-sky-700 text-white border-sky-700"
                                : "bg-white text-slate-800 border-slate-200"
                            }`}
                          >
                            {eq.equipmentId}
                          </button>
                        );
                      })}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isBusy || isObserverReadOnly}
                  onClick={handleRecordConditionCheck}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold cursor-pointer"
                >
                  Save Condition Check &amp; Re-Evaluate Escalation
                </button>

                {/* Recent Condition Entries */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="text-xs font-bold text-slate-700">
                    Recorded Condition Checks ({activeIncident.conditionChecks.length})
                  </div>
                  {activeIncident.conditionChecks.length === 0 ? (
                    <p className="text-xs text-slate-500">No follow-up checks logged yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {[...activeIncident.conditionChecks].reverse().map((chk) => (
                        <div
                          key={chk.entryId}
                          className={`rounded-xl border p-3 text-xs space-y-1 ${
                            chk.escalationWarningTriggered
                              ? "bg-rose-50 border-rose-300 text-rose-950"
                              : "bg-white border-slate-200 text-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between font-mono text-[11px]">
                            <span>{formatMissionTimeUtc(chk.timestampIso)}</span>
                            <span className="font-bold">
                              {chk.changeDirection} · Pain {chk.painLevel0to10 ?? "N/A"}/10
                            </span>
                          </div>
                          <div className="font-semibold">{chk.symptoms}</div>
                          <div>Actions: {chk.actionsPerformed}</div>
                          {chk.escalationReason && (
                            <div className="font-bold text-rose-800">
                              ▲ ESCALATION: {chk.escalationReason}
                            </div>
                          )}
                          <div className="text-[11px] opacity-80">{chk.nonCausalNote}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Human Response & Escalation Lifecycle */}
              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
                    <PhoneCall className="w-4 h-4 text-rose-700" />
                    <span>Human Response &amp; Escalation Lifecycle</span>
                  </h2>
                  <p className="text-xs text-slate-600">
                    Lifecycle: REPORTED → SCREENED → GUIDANCE_PROVIDED → RESPONDER_NOTIFIED →
                    ACKNOWLEDGED → RESPONSE_RECORDED → MONITORING → CLOSED / ESCALATED.
                    Emergencies never close automatically.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600">Current State:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {activeIncident.state}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600">Primary Responder:</span>
                    <span className="font-semibold text-slate-900">
                      {activeIncident.primaryResponderName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600">Backup Responder:</span>
                    <span className="font-semibold text-slate-900">
                      {activeIncident.backupResponderName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600">Acknowledgment:</span>
                    <span className="font-mono text-slate-900">
                      {activeIncident.acknowledgedAtIso
                        ? `${activeIncident.acknowledgedBy} @ ${formatMissionTimeUtc(
                            activeIncident.acknowledgedAtIso
                          )}`
                        : "Not yet acknowledged"}
                    </span>
                  </div>
                </div>

                {responderOverdue.isOverdue && (
                  <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-950 space-y-2">
                    <div className="font-bold">
                      ▲ Primary responder acknowledgment overdue ({responderOverdue.overdueMinutes}{" "}
                      min past window)
                    </div>
                    <button
                      type="button"
                      disabled={isBusy || isObserverReadOnly}
                      onClick={() =>
                        handleLifecycleTransition({
                          type: "ESCALATE_TO_BACKUP",
                          reason: `Primary ack overdue by ${responderOverdue.overdueMinutes} min`,
                        })
                      }
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-rose-700 text-white font-bold cursor-pointer"
                    >
                      Escalate to Backup ({activeIncident.backupResponderName}) Now
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isBusy || isObserverReadOnly || activeIncident.state === "CLOSED"}
                    onClick={() =>
                      handleLifecycleTransition({
                        type: "NOTIFY_RESPONDER",
                        ackWindowMinutes: lifeSafetyConfig.ackTimeoutMinutes,
                      })
                    }
                    className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-900 cursor-pointer"
                  >
                    1. Notify Responder
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || isObserverReadOnly || activeIncident.state === "CLOSED"}
                    onClick={() =>
                      handleLifecycleTransition({
                        type: "ACKNOWLEDGE_RESPONDER",
                        note: "Responder engaged at scene",
                      })
                    }
                    className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-900 cursor-pointer"
                  >
                    2. Acknowledge (Human)
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || isObserverReadOnly || activeIncident.state === "CLOSED"}
                    onClick={() =>
                      handleLifecycleTransition({
                        type: "ESCALATE_TO_BACKUP",
                        reason: "Crew requested backup responder escalation",
                      })
                    }
                    className="min-h-[42px] px-3 py-2 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-900 cursor-pointer"
                  >
                    Escalate to Backup
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || isObserverReadOnly || activeIncident.state === "CLOSED"}
                    onClick={() =>
                      handleLifecycleTransition({
                        type: "ENTER_MONITORING",
                        note: "Transitioned to scheduled follow-up monitoring",
                      })
                    }
                    className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-900 cursor-pointer"
                  >
                    4. Enter Monitoring
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={responseNote}
                      onChange={(e) => setResponseNote(e.target.value)}
                      placeholder="Summary of response action completed..."
                      className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                    />
                    <button
                      type="button"
                      disabled={
                        isBusy ||
                        isObserverReadOnly ||
                        !responseNote.trim() ||
                        activeIncident.state === "CLOSED"
                      }
                      onClick={async () => {
                        const txt = responseNote.trim();
                        setResponseNote("");
                        await handleLifecycleTransition({
                          type: "RECORD_RESPONSE",
                          summary: txt,
                        });
                      }}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-sky-700 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                    >
                      3. Record Response
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={closureNote}
                      onChange={(e) => setClosureNote(e.target.value)}
                      placeholder="Explicit human closure notes (required to close)..."
                      className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                    />
                    <button
                      type="button"
                      disabled={
                        isBusy ||
                        isObserverReadOnly ||
                        !closureNote.trim() ||
                        activeIncident.state === "CLOSED"
                      }
                      onClick={async () => {
                        const txt = closureNote.trim();
                        setClosureNote("");
                        await handleLifecycleTransition({
                          type: "CLOSE_EXPLICIT",
                          closureNotes: txt,
                        });
                      }}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                    >
                      5. Explicit Close
                    </button>
                  </div>
                </div>

                {/* Chronological Timeline */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200">
                  <div className="text-xs font-bold text-slate-700">
                    Chronological Audit Timeline ({activeIncident.timeline.length})
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto text-xs">
                    {[...activeIncident.timeline].reverse().map((ev, idx) => (
                      <div
                        key={`${ev.timestampIso}_${idx}`}
                        className="rounded-lg bg-white border border-slate-200 px-3 py-2"
                      >
                        <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
                          <span>{formatMissionTimeUtc(ev.timestampIso)}</span>
                          <span>
                            {ev.fromState} → {ev.toState}
                          </span>
                        </div>
                        <div className="font-semibold text-slate-900">{ev.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 5: PERSONALIZED CONTEXT, CONTINUITY MODE & EARTH HANDOFF */}
      {activeTab === "HANDOFF" && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Measured Data */}
            <div className="glass-panel rounded-2xl p-4 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-sky-800">
                1. MEASURED TELEMETRY &amp; ECLSS (Sensors)
              </h3>
              <div className="space-y-1.5 text-xs">
                {personalizedContext.measuredVitals.slice(0, 7).map((m) => (
                  <div
                    key={m.parameter}
                    className={`rounded-lg border px-2.5 py-1.5 flex items-center justify-between gap-2 ${
                      m.outsideBaseline
                        ? "bg-amber-50 border-amber-200 text-amber-950"
                        : "bg-white border-slate-200 text-slate-900"
                    }`}
                  >
                    <span className="font-semibold">{m.label}</span>
                    <span className="font-mono text-[11px]">{m.valueText}</span>
                  </div>
                ))}
              </div>
              {personalizedContext.measuredEnvironmentWarnings.length > 0 && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs text-rose-900 space-y-1">
                  <div className="font-bold">Environment Warnings:</div>
                  {personalizedContext.measuredEnvironmentWarnings.map((w) => (
                    <div key={w}>▲ {w}</div>
                  ))}
                </div>
              )}
            </div>

            {/* User-Reported Context */}
            <div className="glass-panel rounded-2xl p-4 space-y-2.5 text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                2. USER-REPORTED &amp; SELF-CHECK-IN
              </h3>
              <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-1.5">
                <div>
                  <span className="font-semibold">Subject:</span>{" "}
                  {personalizedContext.subjectCrewName}
                </div>
                <div>
                  <span className="font-semibold">Reported Symptoms:</span>{" "}
                  {personalizedContext.userReportedSummary.reportedSymptoms}
                </div>
                <div>
                  <span className="font-semibold">Latest Self-Check-In:</span>{" "}
                  {personalizedContext.userReportedSummary.latestSelfCheckin ||
                    "No self-check-in logged"}
                </div>
                <div>
                  <span className="font-semibold">Allergies / Meds:</span>{" "}
                  {personalizedContext.userReportedSummary.allergiesAndMedsStatus}
                </div>
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1 text-amber-950">
                <div className="font-bold">
                  Unavailable / Unknown Info (Never Assumed Normal):
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  {personalizedContext.unavailableOrUnknownInfo.slice(0, 4).map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Continuity Mode & Crew Training */}
            <div className="glass-panel rounded-2xl p-4 space-y-2.5 text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 inline-flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-sky-700" />
                <span>3. CREW RESPONDERS &amp; CONTINUITY SCOPE</span>
              </h3>
              <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-1">
                <div className="font-bold">
                  CMO Status:{" "}
                  {personalizedContext.responderContext.cmoAvailable
                    ? "AVAILABLE"
                    : "UNAVAILABLE (Continuity Mode Active)"}
                </div>
                <div className="text-slate-600">
                  {personalizedContext.responderContext.cmoStatusReason}
                </div>
                <div>
                  <span className="font-semibold">Designated Primary:</span>{" "}
                  {personalizedContext.responderContext.primaryResponderName}
                </div>
                <div>
                  <span className="font-semibold">Backup Responder:</span>{" "}
                  {personalizedContext.responderContext.backupResponderName}
                </div>
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {personalizedContext.responderContext.trainedCrewResponders.map((cr) => (
                  <div
                    key={cr.crewId}
                    className="rounded-lg bg-white border border-slate-200 px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>{cr.name}</span>
                      <span className="font-mono text-[10px]">{cr.availability}</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {cr.medicalTier} · {cr.recordedTraining[0]}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onNavigate("continuity")}
                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-semibold cursor-pointer"
              >
                Open Full Continuity Mode Workspace →
              </button>
            </div>
          </div>

          {/* Earth Handoff Export & Consultation Queue */}
          {activeIncident && (
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Incident Record &amp; Earth Flight Surgeon Handoff Package
                  </h3>
                  <p className="text-xs text-slate-600">
                    Offline-preserved chronological handoff summarizing screening, measured vs
                    self-reported info, guidance shown, responder actions, and unanswered questions.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const md = buildMedicalGuidanceHandoffMarkdown(
                        activeIncident,
                        personalizedContext
                      );
                      handleDownloadFile(
                        `${activeIncident.incidentId}_handoff.md`,
                        md,
                        "text/markdown"
                      );
                    }}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Download .MD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const pkg = buildConsultationItemFromGuidanceIncident(
                        activeIncident,
                        personalizedContext,
                        baseline,
                        earthWanConnected && browserOnline
                      );
                      handleDownloadFile(
                        `${activeIncident.incidentId}_handoff.json`,
                        JSON.stringify({ incident: activeIncident, context: personalizedContext, consultationPackage: pkg }, null, 2),
                        "application/json"
                      );
                    }}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    <span>Download .JSON</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || isObserverReadOnly}
                    onClick={async () => {
                      const md = buildMedicalGuidanceHandoffMarkdown(
                        activeIncident,
                        personalizedContext
                      );
                      await onQueueEarthHandoff(activeIncident, md);
                    }}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {earthWanConnected && browserOnline ? (
                      <Send className="w-3.5 h-3.5" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {earthWanConnected && browserOnline
                        ? "Send to Earth Consultation Queue"
                        : "Queue Locally for Earth Reconnect"}
                    </span>
                  </button>
                </div>
              </div>

              <pre className="rounded-xl bg-slate-950 text-slate-100 p-4 text-xs font-mono overflow-x-auto max-h-72 whitespace-pre-wrap">
                {buildMedicalGuidanceHandoffMarkdown(activeIncident, personalizedContext)}
              </pre>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
