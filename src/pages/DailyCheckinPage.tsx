import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck, Lock, MessageSquareHeart, ShieldAlert } from "lucide-react";
import {
  ALL_18_PARAMETERS,
  ActorRole,
  BaselineProfile,
  NutritionCatalogueItem,
  PARAMETER_METADATA,
  ParameterName,
  QualityStatus,
  SUBJECTIVE_CHECKIN_LABELS,
  SubjectiveCheckinEntry,
  SubjectiveCheckinStatus,
  TelemetryLatestResponse,
} from "../types/aegisContracts";
import {
  BodyRegionId,
  DiagnosticScanEntry,
  ExtendedBioSummary,
  OpsRecordDoc,
} from "../types/opsContracts";
import { StoredVoiceMemoRecord } from "../services/voiceMemoDb";
import { StoredDiagnosticScan } from "../services/diagnosticScanDb";
import { ExtendedBioScanPanel } from "../components/ExtendedBioScanPanel";
import {
  CheckinGroupId,
  DailyVoiceMemoPanel,
  DraftVoiceMemo,
  InlineVoiceRecorderButton,
  pickSupportedAudioMimeType,
} from "../components/DailyVoiceMemoPanel";
import { SafeImage } from "../components/SafeImage";
import { VISUAL_ASSETS } from "../assets/visualCatalog";
import { CuratedReferencesStrip } from "../components/CuratedReferencesStrip";
import {
  canSubmitSubjectiveCheckin,
  formatMissionTimeUtc,
} from "../utils/aegisPureEngine";

interface DailyCheckinPageProps {
  baseline: BaselineProfile;
  latest: TelemetryLatestResponse;
  operatorRole: ActorRole;
  subjectiveHistory: SubjectiveCheckinEntry[];
  nutritionCatalogue: NutritionCatalogueItem[];
  storedMemos: StoredVoiceMemoRecord[];
  cloudMemoRecords: OpsRecordDoc[];
  extendedBio: ExtendedBioSummary | null;
  storedScans: StoredDiagnosticScan[];
  onSubmitCheckin: (
    entries: Array<{
      parameter: ParameterName;
      value: number;
      quality_status?: QualityStatus;
      notes?: string;
    }>
  ) => Promise<void>;
  onSubmitSubjectiveCheckin: (
    statusCode: SubjectiveCheckinStatus,
    note: string
  ) => Promise<void>;
  onSaveVoiceMemo: (input: {
    group: CheckinGroupId;
    parameterLabel: string;
    blob: Blob;
    mimeType: string;
    durationSec: number;
    note: string;
  }) => Promise<void>;
  onDeleteVoiceMemo: (memoId: string) => Promise<void>;
  onSaveExtendedBio: (input: {
    bloodGlucoseMgDl: number;
    coreTempC: number;
    notes: string;
  }) => Promise<void>;
  onSaveDiagnosticScan: (input: {
    bodyRegion: BodyRegionId;
    modality: DiagnosticScanEntry["modality"];
    caption: string;
    imageDataUrl: string;
    mimeType: string;
    sizeBytes: number;
  }) => Promise<void>;
  onDeleteDiagnosticScan: (scanId: string) => Promise<void>;
  onBackHome: () => void;
  feedback: { ok: boolean; message: string } | null;
  isBusy: boolean;
}

export const DailyCheckinPage: React.FC<DailyCheckinPageProps> = ({
  baseline,
  latest,
  operatorRole,
  subjectiveHistory,
  nutritionCatalogue,
  storedMemos,
  cloudMemoRecords,
  extendedBio,
  storedScans,
  onSubmitCheckin,
  onSubmitSubjectiveCheckin,
  onSaveVoiceMemo,
  onDeleteVoiceMemo,
  onSaveExtendedBio,
  onSaveDiagnosticScan,
  onDeleteDiagnosticScan,
  onBackHome,
  feedback,
  isBusy,
}) => {
  const [subjectiveStatus, setSubjectiveStatus] =
    useState<SubjectiveCheckinStatus>("FEEL_NORMAL");
  const [subjectiveNote, setSubjectiveNote] = useState("");
  const canSelfReport = canSubmitSubjectiveCheckin(operatorRole);
  const [sleepDuration, setSleepDuration] = useState("6.8");
  const [sleepQuality, setSleepQuality] = useState("7.0");
  const [exercisePct, setExercisePct] = useState("90");
  const [fatigueScore, setFatigueScore] = useState("4.0");

  const [visualSymptoms, setVisualSymptoms] = useState("1.0");
  const [iopMmhg, setIopMmhg] = useState("15.5");
  const [thighCuffPct, setThighCuffPct] = useState("95");

  const [selectedMealId, setSelectedMealId] = useState(
    nutritionCatalogue[0]?.meal_id || "MEAL-ISS-STD-01"
  );
  const [caloricIntake, setCaloricIntake] = useState("2650");
  const [hydrationMl, setHydrationMl] = useState("2380");
  const [appetiteScore, setAppetiteScore] = useState("7.5");

  const [activeRecordingGroup, setActiveRecordingGroup] = useState<CheckinGroupId | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [draftsByGroup, setDraftsByGroup] = useState<
    Partial<Record<CheckinGroupId, DraftVoiceMemo>>
  >({});
  const [openForms, setOpenForms] = useState(true);
  const [openVoiceAndScans, setOpenVoiceAndScans] = useState(false);
  const [openMetricsTable, setOpenMetricsTable] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  const stopTracksAndTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          // Ignore unmount stop error
        }
      }
      stopTracksAndTimer();
    };
  }, []);

  const clearDraft = (group: CheckinGroupId) => {
    setDraftsByGroup((prev) => {
      const existing = prev[group];
      if (existing?.previewUrl) {
        URL.revokeObjectURL(existing.previewUrl);
      }
      const next = { ...prev };
      delete next[group];
      return next;
    });
  };

  const handleStopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    stopTracksAndTimer();
    setActiveRecordingGroup(null);
  };

  const handleStartRecording = async (group: CheckinGroupId, label: string) => {
    setMicError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setMicError(
        "Audio recording (MediaRecorder API) is unavailable in this browser or context."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickSupportedAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      startedAtRef.current = Date.now();
      recorderRef.current = recorder;

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const elapsed = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const finalType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalType });
        const previewUrl = URL.createObjectURL(blob);
        setDraftsByGroup((prev) => {
          const old = prev[group];
          if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl);
          return {
            ...prev,
            [group]: {
              group,
              parameterLabel: label,
              blob,
              mimeType: finalType,
              durationSec: elapsed,
              previewUrl,
            },
          };
        });
        stopTracksAndTimer();
        setActiveRecordingGroup(null);
      };

      clearDraft(group);
      setRecordingSeconds(0);
      setActiveRecordingGroup(group);
      recorder.start(250);

      timerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setRecordingSeconds(secs);
        if (secs >= 45 && recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
      }, 250);
    } catch (err) {
      stopTracksAndTimer();
      setActiveRecordingGroup(null);
      setMicError(
        err instanceof Error
          ? `Microphone access needed to record voice memos: ${err.message}`
          : "Microphone access was denied."
      );
    }
  };

  const handleMealSelect = (mealId: string) => {
    setSelectedMealId(mealId);
    const meal = nutritionCatalogue.find((m) => m.meal_id === mealId);
    if (meal) {
      setCaloricIntake(String(meal.caloric_intake_kcal));
      setHydrationMl(String(meal.hydration_ml));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Back to Home Dashboard */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-full sm:w-44 aspect-[16/10] rounded-xl overflow-hidden border border-white/80 shadow-sm shrink-0">
            <SafeImage
              src={VISUAL_ASSETS.dailyCheckin}
              alt="Handheld orbital medical check-in kit"
              caption="18-Metric Log & Scans"
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
              Daily Check-In &amp; All 18 Metrics
            </h1>
            <p className="text-sm text-slate-600">
              Save daily sleep, eye comfort, fluid-shift, and nutrition logs privately to Firestore,
              and compare all 18 parameters against your 14-day normal range.
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2 ${
            feedback.ok
              ? "bg-emerald-50/90 border-emerald-200 text-emerald-900"
              : "bg-rose-50/90 border-rose-200 text-rose-900"
          }`}
        >
          {feedback.ok ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Progressive Section Controls */}
      <div className="glass-subtle rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-slate-700">
          Section View: Quick self-report &amp; check-in forms are expanded; extended bio, scans &amp;
          18-metric table collapse cleanly.
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setOpenForms(true);
              setOpenVoiceAndScans(true);
              setOpenMetricsTable(true);
            }}
            className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 cursor-pointer"
          >
            Expand All Sections
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenForms(false);
              setOpenVoiceAndScans(false);
              setOpenMetricsTable(false);
            }}
            className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-700 cursor-pointer"
          >
            Compact View
          </button>
        </div>
      </div>

      {/* Quick Optional Subjective Crew Check-In (Clearly Separated from Sensor Telemetry) */}
      <section
        aria-label="Subjective Crew Check-In"
        className="glass-panel rounded-2xl p-5 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <MessageSquareHeart className="w-4 h-4 text-sky-700" />
              <span>Optional Subjective Crew Self-Report</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Self-reported crew feeling and optional private note. Stored separately as{" "}
              <span className="font-mono font-semibold text-slate-800">
                CREW_SUBJECTIVE_SELF_REPORT
              </span>{" "}
              and never mixed with automated hardware sensor telemetry.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Access: {operatorRole.replace(/_/g, " ")}
          </span>
        </div>

        {!canSelfReport && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Mission Observer access is read-only. Self-report submission is disabled and private
              crew notes are redacted for privacy.
            </span>
          </div>
        )}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!canSelfReport) return;
            await onSubmitSubjectiveCheckin(subjectiveStatus, subjectiveNote);
            setSubjectiveNote("");
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            {(Object.keys(SUBJECTIVE_CHECKIN_LABELS) as SubjectiveCheckinStatus[]).map((code) => {
              const selected = subjectiveStatus === code;
              const toneCls =
                code === "NEED_ASSISTANCE"
                  ? selected
                    ? "bg-rose-700 text-white border-rose-700"
                    : "bg-rose-50/85 text-rose-900 border-rose-200 hover:bg-rose-100/80"
                  : code === "WORSE_THAN_USUAL"
                  ? selected
                    ? "bg-amber-700 text-white border-amber-700"
                    : "bg-amber-50/85 text-amber-900 border-amber-200 hover:bg-amber-100/80"
                  : selected
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white/80 text-slate-800 border-slate-200/80 hover:bg-white";
              return (
                <button
                  key={code}
                  type="button"
                  disabled={!canSelfReport || isBusy}
                  onClick={() => setSubjectiveStatus(code)}
                  className={`px-3.5 py-2.5 rounded-xl border font-medium text-left transition-colors cursor-pointer disabled:opacity-50 ${toneCls}`}
                >
                  {SUBJECTIVE_CHECKIN_LABELS[code]}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 text-xs">
            <input
              type="text"
              aria-label="Optional subjective check-in note"
              maxLength={280}
              disabled={!canSelfReport || isBusy}
              value={subjectiveNote}
              onChange={(e) => setSubjectiveNote(e.target.value)}
              placeholder="Optional short note (visible only to Crew Member & CMO roles)..."
              className="flex-1 bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!canSelfReport || isBusy}
              className="px-4 py-2 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-semibold rounded-xl cursor-pointer whitespace-nowrap"
            >
              Record Self-Report
            </button>
          </div>
        </form>

        {subjectiveHistory.length > 0 && (
          <div className="pt-3 border-t border-slate-200/70 space-y-1.5 text-xs">
            <div className="font-medium text-slate-700">
              Recent Self-Reports ({subjectiveHistory.length})
            </div>
            <div className="space-y-1.5">
              {subjectiveHistory.slice(0, 3).map((entry) => (
                <div
                  key={entry.recordId}
                  className="glass-subtle rounded-xl px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium text-slate-900">
                      <span className="font-mono text-[10px] text-sky-800 mr-2">
                        [SELF-REPORT · NON-SENSOR]
                      </span>
                      {entry.statusLabel}
                    </div>
                    {entry.note && (
                      <div
                        className={`text-[11px] ${
                          entry.noteRedacted ? "italic text-slate-500" : "text-slate-600"
                        }`}
                      >
                        Note: {entry.note}
                      </div>
                    )}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                    {formatMissionTimeUtc(entry.submittedAtIso)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Section 2 (Collapsible): 3 Daily Check-In Forms */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setOpenForms(!openForms)}
          className="w-full glass-panel rounded-2xl px-5 py-3.5 flex items-center justify-between text-left cursor-pointer hover:bg-white/85 transition-colors"
        >
          <div>
            <div className="text-sm font-semibold text-slate-900">
              2. Daily Quantitative Check-In Forms (Sleep, Eye/Fluid-Shift, Nutrition)
            </div>
            <div className="text-xs text-slate-500">
              Log numerical check-in metrics or attach inline voice observations.
            </div>
          </div>
          {openForms ? (
            <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
          )}
        </button>

      {openForms && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form 1: Sleep & Energy */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const memoDraft = draftsByGroup.SLEEP_ENERGY;
            await onSubmitCheckin([
              { parameter: "sleep_duration_hrs", value: Number(sleepDuration) },
              { parameter: "sleep_quality_score", value: Number(sleepQuality) },
              { parameter: "exercise_completion_pct", value: Number(exercisePct) },
              { parameter: "fatigue_score", value: Number(fatigueScore) },
            ]);
            if (memoDraft) {
              await onSaveVoiceMemo({
                group: "SLEEP_ENERGY",
                parameterLabel: "Sleep & Energy Check-In",
                blob: memoDraft.blob,
                mimeType: memoDraft.mimeType,
                durationSec: memoDraft.durationSec,
                note: `Sleep ${sleepDuration}h, quality ${sleepQuality}/10, exercise ${exercisePct}%, fatigue ${fatigueScore}/10`,
              });
              clearDraft("SLEEP_ENERGY");
            }
          }}
          className="glass-panel rounded-2xl p-5 space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-sky-700" />
              <span>Sleep &amp; Energy Check-In</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label htmlFor="s-hrs" className="block text-slate-600 mb-1">
                  Sleep (hrs)
                </label>
                <input
                  id="s-hrs"
                  type="number"
                  step="0.1"
                  min="0"
                  max="16"
                  value={sleepDuration}
                  onChange={(e) => setSleepDuration(e.target.value)}
                  className="w-full bg-white/80 border border-slate-300/80 rounded-xl px-2.5 py-2 font-mono text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="s-qual" className="block text-slate-600 mb-1">
                  Quality (1–10)
                </label>
                <input
                  id="s-qual"
                  type="number"
                  step="0.5"
                  min="1"
                  max="10"
                  value={sleepQuality}
                  onChange={(e) => setSleepQuality(e.target.value)}
                  className="w-full bg-white/80 border border-slate-300/80 rounded-xl px-2.5 py-2 font-mono text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="s-ex" className="block text-slate-600 mb-1">
                  Exercise (%)
                </label>
                <input
                  id="s-ex"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={exercisePct}
                  onChange={(e) => setExercisePct(e.target.value)}
                  className="w-full bg-white/80 border border-slate-300/80 rounded-xl px-2.5 py-2 font-mono text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="s-fat" className="block text-slate-600 mb-1">
                  Fatigue (1–10)
                </label>
                <input
                  id="s-fat"
                  type="number"
                  step="0.5"
                  min="1"
                  max="10"
                  value={fatigueScore}
                  onChange={(e) => setFatigueScore(e.target.value)}
                  className="w-full bg-white/80 border border-slate-300/80 rounded-xl px-2.5 py-2 font-mono text-slate-900"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <InlineVoiceRecorderButton
              group="SLEEP_ENERGY"
              label="Sleep & Energy"
              draft={draftsByGroup.SLEEP_ENERGY || null}
              activeRecordingGroup={activeRecordingGroup}
              recordingSeconds={recordingSeconds}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              onClearDraft={clearDraft}
            />
            <button
              type="submit"
              disabled={isBusy}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Save Sleep &amp; Energy
            </button>
          </div>
        </form>

        {/* Form 2: Vision & Fluid Check */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const memoDraft = draftsByGroup.EYE_FLUID;
            await onSubmitCheckin([
              { parameter: "visual_symptom_severity", value: Number(visualSymptoms) },
              {
                parameter: "intraocular_pressure_mmhg",
                value: Number(iopMmhg),
                notes: "Eye pressure check-in",
              },
              { parameter: "thigh_cuff_adherence_pct", value: Number(thighCuffPct) },
            ]);
            if (memoDraft) {
              await onSaveVoiceMemo({
                group: "EYE_FLUID",
                parameterLabel: "Eye & Fluid-Shift Check-In",
                blob: memoDraft.blob,
                mimeType: memoDraft.mimeType,
                durationSec: memoDraft.durationSec,
                note: `Visual symptoms ${visualSymptoms}/10, IOP ${iopMmhg} mmHg, thigh cuff ${thighCuffPct}%`,
              });
              clearDraft("EYE_FLUID");
            }
          }}
          className="glass-panel rounded-2xl p-5 space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-sky-700" />
              <span>Eye &amp; Fluid-Shift Check-In</span>
            </h2>
            <div className="space-y-2.5 text-xs">
              <div>
                <label htmlFor="e-vis" className="block text-slate-600 mb-1">
                  Visual Symptoms (0–10)
                </label>
                <input
                  id="e-vis"
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  value={visualSymptoms}
                  onChange={(e) => setVisualSymptoms(e.target.value)}
                  className="w-full bg-white/80 border border-slate-300/80 rounded-xl px-2.5 py-2 font-mono text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="e-iop" className="block text-slate-600 mb-1">
                    Eye Pressure (mmHg)
                  </label>
                  <input
                    id="e-iop"
                    type="number"
                    step="0.1"
                    min="5"
                    max="40"
                    value={iopMmhg}
                    onChange={(e) => setIopMmhg(e.target.value)}
                    className="w-full bg-white/80 border border-slate-300/80 rounded-xl px-2.5 py-2 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="e-cuff" className="block text-slate-600 mb-1">
                    Thigh Cuff Use (%)
                  </label>
                  <input
                    id="e-cuff"
                    type="number"
                    step="5"
                    min="0"
                    max="100"
                    value={thighCuffPct}
                    onChange={(e) => setThighCuffPct(e.target.value)}
                    className="w-full bg-white/80 border border-slate-300/80 rounded-xl px-2.5 py-2 font-mono text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <InlineVoiceRecorderButton
              group="EYE_FLUID"
              label="Eye & Fluid-Shift"
              draft={draftsByGroup.EYE_FLUID || null}
              activeRecordingGroup={activeRecordingGroup}
              recordingSeconds={recordingSeconds}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              onClearDraft={clearDraft}
            />
            <button
              type="submit"
              disabled={isBusy}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Save Eye &amp; Fluid Check
            </button>
          </div>
        </form>

        {/* Form 3: Food & Hydration */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const memoDraft = draftsByGroup.FOOD_HYDRATION;
            await onSubmitCheckin([
              {
                parameter: "caloric_intake_kcal",
                value: Number(caloricIntake),
                quality_status: "ESTIMATED",
                notes: `Meal pack: ${selectedMealId}`,
              },
              { parameter: "hydration_ml", value: Number(hydrationMl) },
              { parameter: "appetite_score", value: Number(appetiteScore) },
            ]);
            if (memoDraft) {
              await onSaveVoiceMemo({
                group: "FOOD_HYDRATION",
                parameterLabel: "Food & Hydration Check-In",
                blob: memoDraft.blob,
                mimeType: memoDraft.mimeType,
                durationSec: memoDraft.durationSec,
                note: `${caloricIntake} kcal, ${hydrationMl} mL water, appetite ${appetiteScore}/10 (${selectedMealId})`,
              });
              clearDraft("FOOD_HYDRATION");
            }
          }}
          className="glass-panel rounded-2xl p-5 space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-sky-700" />
              <span>Food &amp; Hydration Check-In</span>
            </h2>
            <div className="space-y-2.5 text-xs">
              <div>
                <label htmlFor="n-meal" className="block text-slate-600 mb-1">
                  Meal Pack Preset
                </label>
                <select
                  id="n-meal"
                  value={selectedMealId}
                  onChange={(e) => handleMealSelect(e.target.value)}
                  className="w-full bg-white/80 border border-slate-300/80 rounded-xl px-2.5 py-2 text-slate-900"
                >
                  {nutritionCatalogue.map((m) => (
                    <option key={m.meal_id} value={m.meal_id}>
                      {m.name} ({m.caloric_intake_kcal} kcal)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="n-kcal" className="block text-slate-600 mb-1">
                    Calories
                  </label>
                  <input
                    id="n-kcal"
                    type="number"
                    step="50"
                    value={caloricIntake}
                    onChange={(e) => setCaloricIntake(e.target.value)}
                    className="w-full bg-white/80 border border-slate-300/80 rounded-xl px-2 py-2 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="n-hyd" className="block text-slate-600 mb-1">
                    Water (mL)
                  </label>
                  <input
                    id="n-hyd"
                    type="number"
                    step="50"
                    value={hydrationMl}
                    onChange={(e) => setHydrationMl(e.target.value)}
                    className="w-full bg-white/80 border border-slate-300/80 rounded-xl px-2.5 py-2 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="n-app" className="block text-slate-600 mb-1">
                    Appetite
                  </label>
                  <input
                    id="n-app"
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={appetiteScore}
                    onChange={(e) => setAppetiteScore(e.target.value)}
                    className="w-full bg-white/80 border border-slate-300/80 rounded-xl px-2 py-2 font-mono text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <InlineVoiceRecorderButton
              group="FOOD_HYDRATION"
              label="Food & Hydration"
              draft={draftsByGroup.FOOD_HYDRATION || null}
              activeRecordingGroup={activeRecordingGroup}
              recordingSeconds={recordingSeconds}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              onClearDraft={clearDraft}
            />
            <button
              type="submit"
              disabled={isBusy}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Save Food &amp; Hydration
            </button>
          </div>
        </form>
      </div>
      )}
      </div>

      {/* Section 3 (Collapsible): Voice Memos, Glucose, Core Temp & Diagnostic Scans */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setOpenVoiceAndScans(!openVoiceAndScans)}
          className="w-full glass-panel rounded-2xl px-5 py-3.5 flex items-center justify-between text-left cursor-pointer hover:bg-white/85 transition-colors"
        >
          <div>
            <div className="text-sm font-semibold text-slate-900">
              3. Extended Biometrics, Voice Memos &amp; Ultrasound/Camera Scans ({storedMemos.length} memos · {storedScans.length} scans)
            </div>
            <div className="text-xs text-slate-500">
              Record standalone audio observations, blood glucose (mg/dL), core body temp (°C), and diagnostic image captures.
            </div>
          </div>
          {openVoiceAndScans ? (
            <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
          )}
        </button>

        {openVoiceAndScans && (
          <div className="space-y-5">
            <DailyVoiceMemoPanel
              storedMemos={storedMemos}
              cloudMemoRecords={cloudMemoRecords}
              activeRecordingGroup={activeRecordingGroup}
              recordingSeconds={recordingSeconds}
              standaloneDraft={draftsByGroup.GENERAL_CHECKIN || null}
              micError={micError}
              isBusy={isBusy}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              onClearDraft={clearDraft}
              onSaveStandaloneMemo={async (note, parameterLabel) => {
                const draft = draftsByGroup.GENERAL_CHECKIN;
                if (!draft) return;
                await onSaveVoiceMemo({
                  group: "GENERAL_CHECKIN",
                  parameterLabel,
                  blob: draft.blob,
                  mimeType: draft.mimeType,
                  durationSec: draft.durationSec,
                  note,
                });
                clearDraft("GENERAL_CHECKIN");
              }}
              onDeleteSavedMemo={onDeleteVoiceMemo}
            />

            <ExtendedBioScanPanel
              extendedBio={extendedBio}
              storedScans={storedScans}
              isBusy={isBusy}
              onSaveExtendedBio={onSaveExtendedBio}
              onSaveDiagnosticScan={onSaveDiagnosticScan}
              onDeleteDiagnosticScan={onDeleteDiagnosticScan}
            />
          </div>
        )}
      </div>

      {/* Section 4 (Collapsible): All 18 Parameters Table */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setOpenMetricsTable(!openMetricsTable)}
          className="w-full glass-panel rounded-2xl px-5 py-3.5 flex items-center justify-between text-left cursor-pointer hover:bg-white/85 transition-colors"
        >
          <div>
            <div className="text-sm font-semibold text-slate-900">
              4. All 18 Tracked Parameters vs. 14-Day Personal Baseline (Last-Valid &amp; Δ Table)
            </div>
            <div className="text-xs text-slate-500">
              Inspect freshness, last-valid timestamps, baseline P05–P95 bands, and prior-reading deltas.
            </div>
          </div>
          {openMetricsTable ? (
            <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
          )}
        </button>

      {openMetricsTable && (
      <div className="glass-panel rounded-2xl p-6 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            All 18 Tracked Parameters vs. 14-Day Personal Baseline
          </h2>
          <p className="text-xs text-slate-500">
            Every continuous sensor channel and daily crew check-in compared against personal average
            and P05–P95 normal range.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Metric</th>
                <th className="py-2 px-3 font-medium">Normal Range (P05–P95)</th>
                <th className="py-2 px-3 font-medium">Latest Reading</th>
                <th className="py-2 px-3 font-medium">Freshness &amp; Last Valid</th>
                <th className="py-2 px-3 font-medium">Δ vs Prev Valid</th>
                <th className="py-2 pl-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {ALL_18_PARAMETERS.map((param) => {
                const metric = baseline.metrics[param];
                const meta = PARAMETER_METADATA[param];
                const comp = latest.baseline_comparisons[param];
                const status = latest.status_by_parameter?.[param];
                if (!metric) return null;
                const isStaleOrUnavail = Boolean(status?.isStaleOrUnavailable);
                const isOut = Boolean(comp?.outside_p05_p95_band && !isStaleOrUnavail);

                return (
                  <tr key={param} className="hover:bg-white/60 transition-colors">
                    <td className="py-2.5 pr-3 font-medium text-slate-900 whitespace-nowrap">
                      {meta.label}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-sky-800 tabular-nums whitespace-nowrap">
                      {metric.p05} – {metric.p95} {metric.unit}
                    </td>
                    <td
                      className={`py-2.5 px-3 font-mono font-semibold tabular-nums whitespace-nowrap ${
                        isStaleOrUnavail
                          ? "text-rose-700"
                          : isOut
                          ? "text-amber-700"
                          : "text-slate-900"
                      }`}
                    >
                      {isStaleOrUnavail ? (
                        <span>
                          {status?.freshness === "STALE" ? "Stale (Not Live)" : "Unavailable"}
                          {status?.lastValidValue !== null && status?.lastValidValue !== undefined
                            ? ` · Last valid: ${status.lastValidValue.toFixed(meta.decimals)} ${metric.unit}`
                            : ""}
                        </span>
                      ) : status?.liveValue !== null && status?.liveValue !== undefined ? (
                        `${status.liveValue.toFixed(meta.decimals)} ${metric.unit}`
                      ) : comp ? (
                        `${comp.current_value.toFixed(meta.decimals)} ${metric.unit}`
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      <span
                        className={
                          isStaleOrUnavail
                            ? "text-rose-700 font-semibold"
                            : status?.freshness === "AGING"
                            ? "text-amber-700 font-semibold"
                            : "text-emerald-700 font-semibold"
                        }
                      >
                        {status?.freshness || "UNKNOWN"}
                      </span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span>{formatMissionTimeUtc(status?.lastValidTimeIso)}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 tabular-nums max-w-xs truncate">
                      {status?.dataSufficiencyNote
                        ? status.dataSufficiencyNote
                        : status?.deltaSummary || "Insufficient history"}
                    </td>
                    <td className="py-2.5 pl-3 whitespace-nowrap">
                      {isStaleOrUnavail ? (
                        <span className="text-rose-700 font-medium">▲ Stale / Unavail</span>
                      ) : isOut ? (
                        <span className="text-amber-700 font-medium">▲ Outside range</span>
                      ) : (
                        <span className="text-emerald-700 font-medium">● Normal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
      </div>

      <CuratedReferencesStrip
        title="Linked NASA & CSA Sleep, Vision (SANS), Hydration & Nutrition References"
        topicTags={["sleep", "vision", "fluid_shift", "nutrition", "hydration"]}
        maxItems={3}
      />
    </div>
  );
};
