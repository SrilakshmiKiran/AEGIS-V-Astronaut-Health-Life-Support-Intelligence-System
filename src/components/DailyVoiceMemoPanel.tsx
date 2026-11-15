import React, { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, Trash2, UploadCloud } from "lucide-react";
import { OpsRecordDoc, VoiceMemoEntry } from "../types/opsContracts";
import { StoredVoiceMemoRecord } from "../services/voiceMemoDb";

export type CheckinGroupId = VoiceMemoEntry["observationGroup"];

export interface DraftVoiceMemo {
  group: CheckinGroupId;
  parameterLabel: string;
  blob: Blob;
  mimeType: string;
  durationSec: number;
  previewUrl: string;
}

const OBSERVATION_TARGET_OPTIONS: Array<{
  group: CheckinGroupId;
  label: string;
}> = [
  { group: "SLEEP_ENERGY", label: "Sleep & Energy" },
  { group: "EYE_FLUID", label: "Eye & Fluid-Shift" },
  { group: "FOOD_HYDRATION", label: "Food & Hydration" },
  { group: "GENERAL_CHECKIN", label: "General Daily Observation" },
];

const MAX_MEMO_SECONDS = 45;

export function pickSupportedAudioMimeType(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

interface InlineVoiceRecorderProps {
  group: CheckinGroupId;
  label: string;
  draft: DraftVoiceMemo | null;
  activeRecordingGroup: CheckinGroupId | null;
  recordingSeconds: number;
  onStartRecording: (group: CheckinGroupId, label: string) => void;
  onStopRecording: () => void;
  onClearDraft: (group: CheckinGroupId) => void;
}

export const InlineVoiceRecorderButton: React.FC<InlineVoiceRecorderProps> = ({
  group,
  label,
  draft,
  activeRecordingGroup,
  recordingSeconds,
  onStartRecording,
  onStopRecording,
  onClearDraft,
}) => {
  const isRecordingThis = activeRecordingGroup === group;
  const isRecordingOther = activeRecordingGroup !== null && activeRecordingGroup !== group;
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [draft?.previewUrl]);

  const togglePreview = () => {
    if (!draft) return;
    if (!audioRef.current) {
      const audio = new Audio(draft.previewUrl);
      audio.onended = () => setIsPlaying(false);
      audioRef.current = audio;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      void audioRef.current.play();
      setIsPlaying(true);
    }
  };

  if (isRecordingThis) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 bg-rose-50/95 border border-rose-200 text-xs text-rose-900">
        <span className="font-medium font-mono tabular-nums">
          Recording {label}... {recordingSeconds}s / {MAX_MEMO_SECONDS}s
        </span>
        <button
          type="button"
          onClick={onStopRecording}
          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
        >
          <Square className="w-3 h-3" />
          <span>Stop</span>
        </button>
      </div>
    );
  }

  if (draft) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 bg-sky-50/90 border border-sky-200 text-xs text-sky-950">
        <span className="font-medium truncate">
          Voice memo ready ({draft.durationSec}s · attaches on save)
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={togglePreview}
            aria-label={`Play ${label} voice memo draft`}
            className="p-1.5 bg-white hover:bg-sky-100 border border-sky-200 rounded-lg text-sky-800 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={() => onClearDraft(group)}
            aria-label={`Discard ${label} voice memo draft`}
            className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 rounded-lg text-slate-500 hover:text-rose-700 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={isRecordingOther}
      onClick={() => onStartRecording(group, label)}
      className="w-full py-2 px-3 bg-white/75 hover:bg-white disabled:opacity-50 border border-slate-200/90 text-slate-700 rounded-xl text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
    >
      <Mic className="w-3.5 h-3.5 text-sky-700" />
      <span>Attach Short Voice Memo</span>
    </button>
  );
};

interface DailyVoiceMemoPanelProps {
  storedMemos: StoredVoiceMemoRecord[];
  cloudMemoRecords: OpsRecordDoc[];
  activeRecordingGroup: CheckinGroupId | null;
  recordingSeconds: number;
  standaloneDraft: DraftVoiceMemo | null;
  micError: string | null;
  isBusy: boolean;
  onStartRecording: (group: CheckinGroupId, label: string) => void;
  onStopRecording: () => void;
  onClearDraft: (group: CheckinGroupId) => void;
  onSaveStandaloneMemo: (note: string, parameterLabel: string) => Promise<void>;
  onDeleteSavedMemo: (memoId: string) => Promise<void>;
}

export const DailyVoiceMemoPanel: React.FC<DailyVoiceMemoPanelProps> = ({
  storedMemos,
  cloudMemoRecords,
  activeRecordingGroup,
  recordingSeconds,
  standaloneDraft,
  micError,
  isBusy,
  onStartRecording,
  onStopRecording,
  onClearDraft,
  onSaveStandaloneMemo,
  onDeleteSavedMemo,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<CheckinGroupId>("GENERAL_CHECKIN");
  const [noteInput, setNoteInput] = useState("");
  const [playingMemoId, setPlayingMemoId] = useState<string | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause();
      }
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
      }
    };
  }, []);

  const targetOption =
    OBSERVATION_TARGET_OPTIONS.find((o) => o.group === selectedGroup) ||
    OBSERVATION_TARGET_OPTIONS[3];

  const handleTogglePlayStored = (memo: StoredVoiceMemoRecord) => {
    if (playingMemoId === memo.memoId && playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      setPlayingMemoId(null);
      return;
    }

    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
    }
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
    }

    const url = URL.createObjectURL(memo.audioBlob);
    playbackUrlRef.current = url;
    const audio = new Audio(url);
    audio.onended = () => setPlayingMemoId(null);
    playbackAudioRef.current = audio;
    setPlayingMemoId(memo.memoId);
    void audio.play();
  };

  const blobById = new Map<string, StoredVoiceMemoRecord>(
    storedMemos.map((m) => [m.memoId, m])
  );

  // Merge local IndexedDB audio blobs with synced Firestore metadata records
  const mergedMemos = cloudMemoRecords.map((rec) => {
    const localBlob = blobById.get(rec.recordId);
    return {
      memoId: rec.recordId,
      title: rec.title,
      parameterLabel: String(rec.payload.parameterLabel || rec.title),
      durationSec: Number(rec.payload.durationSec || localBlob?.durationSec || 0),
      sizeBytes: Number(rec.payload.sizeBytes || localBlob?.sizeBytes || 0),
      note: String(rec.payload.note || ""),
      createdAtIso: rec.timestampIso,
      localRecord: localBlob || null,
    };
  });

  // Also show any IndexedDB memos that may still be queued offline
  for (const local of storedMemos) {
    if (!cloudMemoRecords.some((r) => r.recordId === local.memoId)) {
      mergedMemos.unshift({
        memoId: local.memoId,
        title: local.parameterLabel,
        parameterLabel: local.parameterLabel,
        durationSec: local.durationSec,
        sizeBytes: local.sizeBytes,
        note: local.note,
        createdAtIso: local.createdAtIso,
        localRecord: local,
      });
    }
  }

  return (
    <section className="glass-panel rounded-2xl p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Mic className="w-4 h-4 text-sky-700" />
            <span>Daily Observation Voice Memos</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record short audio context snippets (up to {MAX_MEMO_SECONDS}s) using your browser
            microphone. Audio saves privately on this device via IndexedDB and syncs memo logs to
            your cloud workspace.
          </p>
        </div>
      </div>

      {micError && (
        <div className="p-3.5 rounded-xl border bg-amber-50/90 border-amber-200 text-amber-900 text-xs">
          {micError}
        </div>
      )}

      {/* Standalone Voice Memo Recorder Bar */}
      <div className="glass-subtle rounded-xl p-4 space-y-3 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-4">
            <label htmlFor="memo-target" className="block text-slate-600 mb-1">
              Observation Category
            </label>
            <select
              id="memo-target"
              value={selectedGroup}
              disabled={activeRecordingGroup !== null}
              onChange={(e) => setSelectedGroup(e.target.value as CheckinGroupId)}
              className="w-full bg-white/90 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
            >
              {OBSERVATION_TARGET_OPTIONS.map((opt) => (
                <option key={opt.group} value={opt.group}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-5">
            <label htmlFor="memo-note" className="block text-slate-600 mb-1">
              Short Label or Note (Optional)
            </label>
            <input
              id="memo-note"
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="e.g., Mild sinus pressure after morning sleep"
              className="w-full bg-white/90 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
            />
          </div>

          <div className="md:col-span-3 md:pt-5 flex items-center gap-2">
            {activeRecordingGroup === "GENERAL_CHECKIN" ? (
              <button
                type="button"
                onClick={onStopRecording}
                className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap font-mono tabular-nums"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop ({recordingSeconds}s)</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={activeRecordingGroup !== null}
                onClick={() => onStartRecording("GENERAL_CHECKIN", targetOption.label)}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Record Snippet</span>
              </button>
            )}
          </div>
        </div>

        {standaloneDraft && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70">
            <div className="flex items-center gap-3">
              <audio controls src={standaloneDraft.previewUrl} className="h-8 max-w-xs" />
              <span className="font-mono text-slate-600 tabular-nums">
                {standaloneDraft.durationSec}s ·{" "}
                {Math.max(1, Math.round(standaloneDraft.blob.size / 1024))} KB
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onClearDraft("GENERAL_CHECKIN")}
                className="px-3 py-1.5 bg-white hover:bg-rose-50 text-slate-700 border border-slate-200 rounded-xl font-medium cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={async () => {
                  await onSaveStandaloneMemo(
                    noteInput.trim() || `${targetOption.label} voice note`,
                    targetOption.label
                  );
                  setNoteInput("");
                }}
                className="px-3.5 py-1.5 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Save Voice Memo</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stored Voice Memos List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span className="font-semibold text-slate-900">
            Saved Daily Voice Memos ({mergedMemos.length})
          </span>
          <span>Private to your signed-in account</span>
        </div>

        {mergedMemos.length === 0 ? (
          <p className="text-xs text-slate-500">
            No voice memos recorded yet. Attach a snippet inside any Daily Check-In form above or
            use the recorder here.
          </p>
        ) : (
          <div className="divide-y divide-slate-200/70 glass-subtle rounded-xl">
            {mergedMemos.map((memo) => {
              const isPlaying = playingMemoId === memo.memoId;
              return (
                <div
                  key={memo.memoId}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-slate-500">
                      <span className="font-semibold text-slate-900">{memo.parameterLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{memo.durationSec}s</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {Math.max(1, Math.round(memo.sizeBytes / 1024))} KB
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">
                        {memo.createdAtIso.replace("T", " ").slice(0, 16)} UTC
                      </span>
                    </div>
                    {memo.note && <p className="text-slate-600 truncate">{memo.note}</p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {memo.localRecord ? (
                      <button
                        type="button"
                        onClick={() => handleTogglePlayStored(memo.localRecord!)}
                        className={`px-3 py-1.5 rounded-xl border font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          isPlaying
                            ? "bg-sky-700 border-sky-700 text-white"
                            : "bg-white hover:bg-sky-50 border-slate-200 text-slate-800"
                        }`}
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Play Snippet</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        Audio stored on recording device
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onDeleteSavedMemo(memo.memoId)}
                      aria-label={`Delete voice memo ${memo.memoId}`}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
