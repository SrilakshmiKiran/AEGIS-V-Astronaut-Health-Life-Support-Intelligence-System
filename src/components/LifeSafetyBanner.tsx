import React from "react";
import { AlertTriangle, Clock, HeartPulse, ShieldAlert } from "lucide-react";
import {
  CheckinScheduleEvaluation,
  EnvironmentSafetyAssessment,
  LifeSafetyEvent,
} from "../types/lifeSafetyContracts";

interface LifeSafetyBannerProps {
  openEvents: LifeSafetyEvent[];
  checkinEval: CheckinScheduleEvaluation;
  envAssessment: EnvironmentSafetyAssessment;
  browserOnline: boolean;
  earthWanConnected: boolean;
  activePageIsSentinel: boolean;
  feedback: { ok: boolean; message: string } | null;
  onOpenSentinel: () => void;
  onOpenEmergencyModal: () => void;
  onOpenMedicalHelp: () => void;
}

export const LifeSafetyBanner: React.FC<LifeSafetyBannerProps> = ({
  openEvents,
  checkinEval,
  envAssessment,
  browserOnline,
  earthWanConnected,
  activePageIsSentinel,
  feedback,
  onOpenSentinel,
  onOpenEmergencyModal,
  onOpenMedicalHelp,
}) => {
  const hasOpenEmergency = openEvents.length > 0;
  const isOverdue = checkinEval.statusCode === "MISSED_OVERDUE";
  const isDueReminder = checkinEval.statusCode === "REMINDER_DUE";
  const isEnvUrgent = envAssessment.overallLevel === "URGENT";
  const isEnvWarn =
    envAssessment.overallLevel === "ADVISORY" || envAssessment.overallLevel === "FAULT";

  const priorityTier = hasOpenEmergency
    ? "EMERGENCY"
    : isEnvUrgent
    ? "WARNING"
    : isOverdue || isEnvWarn
    ? "CAUTION"
    : isDueReminder
    ? "ADVISORY"
    : "INFORMATIONAL";

  const toneCls =
    hasOpenEmergency || isEnvUrgent
      ? "bg-rose-50/95 border-rose-300 text-rose-950"
      : isOverdue || isDueReminder || isEnvWarn
      ? "bg-amber-50/95 border-amber-300 text-amber-950"
      : "bg-white/75 border-slate-200/80 text-slate-800";

  return (
    <div className="mb-5 space-y-2">
      <div
        className={`rounded-2xl border px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${toneCls}`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          <span className="font-mono font-bold tracking-tight inline-flex items-center gap-1.5 whitespace-nowrap">
            {hasOpenEmergency || isEnvUrgent ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-sky-700 shrink-0" />
            )}
            <span>SENTINEL · {priorityTier}</span>
          </span>

          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            |
          </span>

          <span className="font-medium truncate">
            {hasOpenEmergency
              ? `${openEvents.length} Active Event (${openEvents[0].state.replace(
                  /_/g,
                  " "
                )} · Explicit Review Required)`
              : isOverdue
              ? checkinEval.headline
              : isEnvUrgent || isEnvWarn
              ? envAssessment.summaryHeadline
              : checkinEval.headline}
          </span>

          <span className="font-mono text-[11px] opacity-80 whitespace-nowrap">
            · Earth: {earthWanConnected ? "ON" : "OFF"} ·{" "}
            {browserOnline ? "Cloud Synced" : "Offline Local"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!activePageIsSentinel && (
            <button
              type="button"
              onClick={onOpenSentinel}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white/90 hover:bg-white text-slate-900 font-semibold cursor-pointer whitespace-nowrap"
            >
              Open Sentinel →
            </button>
          )}
          <button
            type="button"
            onClick={onOpenMedicalHelp}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
          >
            <HeartPulse className="w-3.5 h-3.5 shrink-0 text-rose-300" />
            <span>I NEED MEDICAL HELP</span>
          </button>
          <button
            type="button"
            onClick={onOpenEmergencyModal}
            className="px-3.5 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>Emergency Request</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl px-4 py-2 border text-xs font-medium ${
            feedback.ok
              ? "bg-emerald-50/90 border-emerald-200 text-emerald-950"
              : "bg-rose-50/90 border-rose-200 text-rose-950"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
};
