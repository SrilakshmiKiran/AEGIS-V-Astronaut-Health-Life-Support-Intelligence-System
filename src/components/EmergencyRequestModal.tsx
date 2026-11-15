import React, { useState } from "react";
import { AlertTriangle, CheckSquare, ShieldAlert, Square, X } from "lucide-react";
import { ActorRole, TelemetryLatestResponse } from "../types/aegisContracts";
import { EmergencyCategory } from "../types/lifeSafetyContracts";
import { formatMissionTimeUtc } from "../utils/aegisPureEngine";

interface EmergencyRequestModalProps {
  open: boolean;
  astronautName: string;
  activeCrewId: string;
  operatorRole: ActorRole;
  primaryResponderName: string;
  earthWanConnected: boolean;
  browserOnline: boolean;
  latest: TelemetryLatestResponse;
  isBusy: boolean;
  onClose: () => void;
  onConfirmTrigger: (input: {
    category: EmergencyCategory;
    notes: string;
  }) => Promise<void>;
}

export const EmergencyRequestModal: React.FC<EmergencyRequestModalProps> = ({
  open,
  astronautName,
  activeCrewId,
  operatorRole,
  primaryResponderName,
  earthWanConnected,
  browserOnline,
  latest,
  isBusy,
  onClose,
  onConfirmTrigger,
}) => {
  const [category, setCategory] = useState<EmergencyCategory>("HEALTH_CONCERN");
  const [notes, setNotes] = useState("");
  const [confirmedGuard, setConfirmedGuard] = useState(false);

  if (!open) return null;

  const statuses = Object.values(latest.status_by_parameter || {});
  const validObsCount = statuses.filter((s) => !s.isStaleOrUnavailable && s.liveValue !== null).length;
  const flaggedCount = statuses.filter((s) => s.isStaleOrUnavailable).length;
  const isObserver = operatorRole === "MISSION_OBSERVER";

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmedGuard || isObserver) return;
    await onConfirmTrigger({ category, notes });
    setConfirmedGuard(false);
    setNotes("");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl border border-rose-200 shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-rose-700 text-white px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div>
              <h2 id="emergency-modal-title" className="text-base font-bold leading-tight">
                Priority Crew Emergency Request
              </h2>
              <p className="text-[11px] text-rose-100">
                Accidental-activation guard · Local &amp; cloud escalation workflow
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close emergency dialog"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-rose-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-4 text-xs text-slate-800">
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-[11px] text-amber-950 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Research Prototype Boundary Notice</span>
            </div>
            <p>
              Activating this creates a high-priority local/Firestore incident, captures valid
              observations, and notifies the simulated onboard responder workflow (
              <strong>{primaryResponderName}</strong>). It does{" "}
              <strong>not</strong> transmit a real spacecraft distress beacon or command hardware.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-slate-50 border border-slate-200 p-3 font-mono text-[11px] tabular-nums">
            <div>
              <span className="text-slate-500 block">Subject Crew</span>
              <strong className="text-slate-900">
                {astronautName} ({activeCrewId})
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">UTC Mission Time</span>
              <strong className="text-slate-900">
                {formatMissionTimeUtc(new Date().toISOString(), true)}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Attached Telemetry</span>
              <strong className="text-slate-900">
                {validObsCount} valid · {flaggedCount} quality-warned
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Comms &amp; Storage</span>
              <strong className="text-slate-900">
                Earth: {earthWanConnected ? "ON" : "OFF"} ·{" "}
                {browserOnline ? "Cloud Sync" : "IndexedDB Offline"}
              </strong>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emergency-category" className="font-semibold text-slate-900 block">
              Emergency Classification
            </label>
            <select
              id="emergency-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as EmergencyCategory)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
            >
              <option value="HEALTH_CONCERN">Crew Health / Acute Symptom Support</option>
              <option value="ENVIRONMENTAL_HAZARD">
                Habitat Environment Hazard (Pressure / O2 / Smoke / CO2)
              </option>
              <option value="COMMUNICATION_LOSS">Deep-Space Comms / Isolation Contingency</option>
              <option value="GENERAL_ASSISTANCE">Immediate Crew Assistance Required</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emergency-notes" className="font-semibold text-slate-900 block">
              Situational Note (Optional)
            </label>
            <textarea
              id="emergency-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Briefly note location, symptoms, cabin sound/odor, or assistance needed..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
            />
          </div>

          {isObserver ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-900 font-medium">
              Mission Observer role is read-only. Switch to Crew Member or Crew Medical Officer in
              Settings to activate an emergency request.
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmedGuard(!confirmedGuard)}
              className={`w-full text-left rounded-xl p-3 border flex items-start gap-2.5 cursor-pointer transition-colors ${
                confirmedGuard
                  ? "bg-rose-50 border-rose-300 text-rose-950"
                  : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
              }`}
            >
              {confirmedGuard ? (
                <CheckSquare className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              )}
              <span className="font-medium leading-snug">
                I confirm this is a deliberate priority request (accidental-activation guard) and
                should log locally and alert {primaryResponderName}.
              </span>
            </button>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isBusy || !confirmedGuard || isObserver}
              className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-45 text-white font-semibold cursor-pointer"
            >
              {isBusy ? "Logging..." : "Confirm Priority Emergency Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
