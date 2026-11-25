import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  Download,
  History,
  KeyRound,
  Lock,
  Radio,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  ActorRole,
  ConsultationQueueItem,
  DemoSceneId,
  IncidentRecord,
  TelemetryObservation,
} from "../types/aegisContracts";
import { SnapshotSummary, WorkspaceProfileDoc } from "../services/firestoreWorkspace";
import { OfflineQueueAction } from "../services/offlineQueueDb";
import { CrewRosterMember } from "../types/opsContracts";
import { SafeImage } from "../components/SafeImage";
import { VISUAL_ASSETS } from "../assets/visualCatalog";
import { verifyAuditChain } from "../utils/aegisPureEngine";

interface StorageHistoryPageProps {
  userEmail: string | null;
  workspace: WorkspaceProfileDoc;
  observations: TelemetryObservation[];
  incidents: IncidentRecord[];
  consultationQueue: ConsultationQueueItem[];
  snapshots: SnapshotSummary[];
  offlineQueue: OfflineQueueAction[];
  browserOnline: boolean;
  crewRoster: CrewRosterMember[];
  activeCrewId: string;
  onSelectCrewMember: (crewId: string) => Promise<void>;
  onFlushOfflineQueue: () => Promise<void>;
  onSaveSnapshot: () => Promise<void>;
  onDeleteSnapshot: (snapshotId: string) => Promise<void>;
  onUpdateWorkspace: (
    updates: Partial<{
      astronautName: string;
      missionName: string;
      earthWanConnected: boolean;
      operatorRole: ActorRole;
    }>
  ) => Promise<void>;
  onResetScenario: (sceneId: DemoSceneId) => Promise<void>;
  onBackHome: () => void;
  feedback: { ok: boolean; message: string } | null;
  isBusy: boolean;
}

export const StorageHistoryPage: React.FC<StorageHistoryPageProps> = ({
  userEmail,
  workspace,
  observations,
  incidents,
  consultationQueue,
  snapshots,
  offlineQueue,
  browserOnline,
  crewRoster,
  activeCrewId,
  onSelectCrewMember,
  onFlushOfflineQueue,
  onSaveSnapshot,
  onDeleteSnapshot,
  onUpdateWorkspace,
  onResetScenario,
  onBackHome,
  feedback,
  isBusy,
}) => {
  const [crewNameInput, setCrewNameInput] = useState(workspace.astronautName);
  const [missionInput, setMissionInput] = useState(workspace.missionName);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>("");
  const [pendingCmoElevation, setPendingCmoElevation] = useState(false);
  const [rolePinInput, setRolePinInput] = useState("");
  const [rolePinError, setRolePinError] = useState<string | null>(null);

  useEffect(() => {
    setCrewNameInput(workspace.astronautName);
    setMissionInput(workspace.missionName);
  }, [workspace.astronautName, workspace.missionName]);

  const incident =
    incidents.find((i) => i.incident_id === selectedIncidentId) || incidents[0];
  const totalRecords =
    observations.length + incidents.length + consultationQueue.length + snapshots.length;

  const chainCheck =
    incident && incident.audit_log.length > 0 ? verifyAuditChain(incident.audit_log) : null;

  const handleExportAllJson = () => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      accountEmail: userEmail,
      workspace,
      counts: {
        observations: observations.length,
        incidents: incidents.length,
        reports: consultationQueue.length,
        snapshots: snapshots.length,
      },
      observations,
      incidents,
      consultationQueue,
      snapshots,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aegis_private_memory_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-full sm:w-44 aspect-[16/10] rounded-xl overflow-hidden border border-white/80 shadow-sm shrink-0">
            <SafeImage
              src={VISUAL_ASSETS.heroOrbital}
              alt="Orbital habitat private workspace archive"
              caption="Encrypted Workspace"
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
              Private Cloud Storage &amp; History
            </h1>
            <p className="text-sm text-slate-600">
              Inspect everything saved in your private Firestore workspace, create backup snapshots,
              export your data, or replay past events.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isBusy}
            onClick={handleExportAllJson}
            className="px-3.5 py-2 bg-white/85 hover:bg-white text-slate-800 border border-slate-300/80 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export All Data (.JSON)</span>
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onSaveSnapshot}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Cloud Snapshot</span>
          </button>
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
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Cloud Memory Overview */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Your Private Memory Storage Space
            </h2>
          </div>
          <span className="text-xs text-emerald-800 font-medium inline-flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            <span>Private to {userEmail || "your account"}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="glass-subtle rounded-xl p-3.5">
            <div className="text-xs text-slate-500">Total Saved Items</div>
            <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-1">
              {totalRecords}
            </div>
          </div>
          <div className="glass-subtle rounded-xl p-3.5">
            <div className="text-xs text-slate-500">Sensor &amp; Check-In Readings</div>
            <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-1">
              {observations.length}
            </div>
          </div>
          <div className="glass-subtle rounded-xl p-3.5">
            <div className="text-xs text-slate-500">Saved Alerts</div>
            <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-1">
              {incidents.length}
            </div>
          </div>
          <div className="glass-subtle rounded-xl p-3.5">
            <div className="text-xs text-slate-500">Doctor Reports</div>
            <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-1">
              {consultationQueue.length}
            </div>
          </div>
          <div className="glass-subtle rounded-xl p-3.5">
            <div className="text-xs text-slate-500">Backup Snapshots</div>
            <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-1">
              {snapshots.length}
            </div>
          </div>
        </div>

        {/* Saved Snapshots Table */}
        <div className="pt-2">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Saved Cloud Snapshots</h3>
          {snapshots.length === 0 ? (
            <p className="text-xs text-slate-500">No snapshots saved yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">Snapshot File</th>
                    <th className="py-2 px-3 font-medium">Created</th>
                    <th className="py-2 px-3 font-medium">Note</th>
                    <th className="py-2 px-3 font-medium">Records</th>
                    <th className="py-2 pl-3 font-medium text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {snapshots.map((snap) => (
                    <tr key={snap.snapshot_id} className="text-slate-700">
                      <td className="py-2 pr-3 font-mono font-medium text-slate-900">
                        {snap.filename}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-500">
                        {snap.created_at.replace("T", " ").slice(0, 19)} UTC
                      </td>
                      <td className="py-2 px-3">{snap.reason}</td>
                      <td className="py-2 px-3 font-mono tabular-nums">
                        {snap.observation_count} obs · {snap.incident_count} alerts
                      </td>
                      <td className="py-2 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteSnapshot(snap.snapshot_id)}
                          aria-label={`Delete snapshot ${snap.filename}`}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Workspace Settings & Crew Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onUpdateWorkspace({
              astronautName: crewNameInput,
              missionName: missionInput,
            });
          }}
          className="glass-panel rounded-2xl p-6 space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-900">Crew Profile &amp; Mission</h2>
          <div className="space-y-3 text-xs">
            <div>
              <label htmlFor="ws-crew-name" className="block text-slate-600 mb-1">
                Crew Member Name
              </label>
              <input
                id="ws-crew-name"
                type="text"
                value={crewNameInput}
                onChange={(e) => setCrewNameInput(e.target.value)}
                className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="ws-mission-name" className="block text-slate-600 mb-1">
                Mission / Habitat Name
              </label>
              <input
                id="ws-mission-name"
                type="text"
                value={missionInput}
                onChange={(e) => setMissionInput(e.target.value)}
                className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isBusy}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Save Profile Changes
          </button>
        </form>

        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Connection &amp; Access Controls</h2>

          {/* 4-Way Connectivity & Persistence Breakdown */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="glass-subtle rounded-xl p-3">
              <div className="text-[11px] text-slate-500">1. Browser Network</div>
              <div
                className={`font-semibold mt-0.5 ${
                  browserOnline ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {browserOnline ? "● Browser Online" : "▲ Browser Offline"}
              </div>
            </div>
            <div className="glass-subtle rounded-xl p-3">
              <div className="text-[11px] text-slate-500">2. IndexedDB Offline Buffer</div>
              <div className="font-semibold text-slate-900 mt-0.5 tabular-nums">
                {offlineQueue.length === 0
                  ? "● Empty (All Synced)"
                  : `▲ ${offlineQueue.length} Queued Write${offlineQueue.length > 1 ? "s" : ""}`}
              </div>
            </div>
            <div className="glass-subtle rounded-xl p-3">
              <div className="text-[11px] text-slate-500">3. Simulated Earth Link</div>
              <div
                className={`font-semibold mt-0.5 ${
                  workspace.earthWanConnected ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {workspace.earthWanConnected ? "● Simulated WAN Up" : "▲ Earth Link Down"}
              </div>
            </div>
            <div className="glass-subtle rounded-xl p-3">
              <div className="text-[11px] text-slate-500">4. Workspace Persistence</div>
              <div className="font-semibold text-sky-900 mt-0.5">
                ● Private Firestore Cloud
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-200/70 text-xs">
            <div className="flex items-start gap-2">
              <Radio className="w-4 h-4 text-sky-700 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-slate-900">Earth Connection Simulation</div>
                <div className="text-slate-500">
                  Simulate communication blackout independently from browser connectivity.
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                onUpdateWorkspace({ earthWanConnected: !workspace.earthWanConnected })
              }
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                workspace.earthWanConnected
                  ? "bg-amber-50/90 text-amber-800 border border-amber-200 hover:bg-amber-100"
                  : "bg-emerald-50/90 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              {workspace.earthWanConnected ? "Switch to Offline" : "Reconnect Earth"}
            </button>
          </div>

          <div className="space-y-2.5 py-2 border-b border-slate-200/70 text-xs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-900">Workspace Role</div>
                <div className="text-slate-500">
                  Medical Officer elevation requires verification PIN; Observer is read-only.
                </div>
              </div>
              <select
                aria-label="Workspace Role"
                value={workspace.operatorRole}
                onChange={(e) => {
                  const targetRole = e.target.value as ActorRole;
                  setRolePinError(null);
                  if (
                    targetRole === "CREW_MEDICAL_OFFICER" &&
                    workspace.operatorRole !== "CREW_MEDICAL_OFFICER"
                  ) {
                    setPendingCmoElevation(true);
                    setRolePinInput("");
                  } else {
                    setPendingCmoElevation(false);
                    void onUpdateWorkspace({ operatorRole: targetRole });
                  }
                }}
                className="bg-white/85 border border-slate-300/80 rounded-xl px-2.5 py-2 text-slate-900"
              >
                <option value="CREW_MEDICAL_OFFICER">Crew Medical Officer</option>
                <option value="CREW_MEMBER">Crew Member</option>
                <option value="MISSION_OBSERVER">Observer (Read-Only)</option>
              </select>
            </div>

            {pendingCmoElevation && (
              <div className="glass-subtle rounded-xl p-3 space-y-2 border border-sky-200">
                <div className="font-medium text-slate-900 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-sky-700" />
                  <span>Enter CMO Authorization PIN to Elevate Role</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Prototype client workflow gate layered over your Firebase Auth owner-isolated
                  workspace.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label="CMO elevation PIN"
                    type="password"
                    value={rolePinInput}
                    onChange={(e) => setRolePinInput(e.target.value)}
                    placeholder="Enter CMO PIN"
                    className="flex-1 min-w-[140px] bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono text-slate-900"
                  />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={async () => {
                      if (rolePinInput.trim() !== "2026") {
                        setRolePinError("Invalid CMO authorization PIN.");
                        return;
                      }
                      setPendingCmoElevation(false);
                      setRolePinError(null);
                      await onUpdateWorkspace({ operatorRole: "CREW_MEDICAL_OFFICER" });
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl cursor-pointer"
                  >
                    Verify &amp; Switch
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingCmoElevation(false);
                      setRolePinError(null);
                    }}
                    className="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                {rolePinError && <p className="text-[11px] text-rose-700">{rolePinError}</p>}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 text-xs">
            <div className="flex items-start gap-2">
              <RotateCcw className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-slate-900">Reset Sample Data</div>
                <div className="text-slate-500">
                  Reload the default mission scenario in your cloud workspace.
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onResetScenario("SCENE_2_GRADUAL_ANOMALY")}
              className="px-3 py-1.5 bg-white/80 hover:bg-white border border-slate-200/80 text-slate-800 rounded-xl font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              Reset Scenario
            </button>
          </div>
        </div>
      </div>

      {/* Browser IndexedDB Offline Queue & Multi-Crew CMO Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Browser Offline Queue (IndexedDB Buffer)
              </h2>
              <p className="text-xs text-slate-500">
                When Earth or browser connectivity drops, updates buffer locally and auto-sync upon
                reconnect.
              </p>
            </div>
            <button
              type="button"
              disabled={isBusy || offlineQueue.length === 0}
              onClick={onFlushOfflineQueue}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold rounded-xl cursor-pointer whitespace-nowrap"
            >
              Sync Queued ({offlineQueue.length})
            </button>
          </div>
          {offlineQueue.length === 0 ? (
            <div className="text-xs text-emerald-800 bg-emerald-50/90 border border-emerald-200 rounded-xl p-3">
              ● Local IndexedDB queue is empty — all records are synced with private cloud storage.
            </div>
          ) : (
            <div className="space-y-1.5 text-xs">
              {offlineQueue.map((item) => (
                <div
                  key={item.queueId}
                  className="glass-subtle rounded-xl p-2.5 flex items-center justify-between gap-2"
                >
                  <span className="font-medium text-slate-800 truncate">{item.label}</span>
                  <span className="font-mono text-slate-500 shrink-0">
                    {item.createdAtIso.slice(11, 19)} UTC
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-6 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Multi-Crew Roster (CMO View)</h2>
            <p className="text-xs text-slate-500">
              Switch active crew profile for daily check-ins, EVA suits, and cognitive tracking.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {crewRoster.map((member) => {
              const isSelected = member.crewId === activeCrewId;
              return (
                <button
                  key={member.crewId}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onSelectCrewMember(member.crewId)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-sky-50/90 border-sky-300 text-slate-900"
                      : "bg-white/75 border-slate-200 hover:bg-white text-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="truncate">{member.name}</span>
                    {isSelected && <span className="text-sky-700 text-[11px]">Active</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{member.role}</div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    Avg HR {member.restingHrMean} bpm · {member.statusNote}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chronological Event Timeline & Audit Trail */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-sky-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Chronological Timeline &amp; Audit History
            </h2>
          </div>

          {chainCheck && (
            <div
              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                chainCheck.valid ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {chainCheck.valid ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    SHA-256 Chain Verified ({chainCheck.checkedCount} entr
                    {chainCheck.checkedCount === 1 ? "y" : "ies"})
                  </span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>Chain Mismatch at {chainCheck.brokenAtLogId}</span>
                </>
              )}
            </div>
          )}
        </div>

        {incidents.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Incident Audit View:</span>
            {incidents.map((item) => (
              <button
                key={item.incident_id}
                type="button"
                onClick={() => setSelectedIncidentId(item.incident_id)}
                className={`px-2.5 py-1 rounded-xl border font-mono cursor-pointer ${
                  item.incident_id === incident?.incident_id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white/75 text-slate-700 border-slate-200 hover:bg-white"
                }`}
              >
                {item.incident_id}
              </button>
            ))}
          </div>
        )}

        {!incident ? (
          <p className="text-xs text-slate-500">
            No alert timeline events in the current Normal Day scenario. Switch to Scenario 2 or 3
            on Home Dashboard to inspect a full event sequence.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-2">
              <h3 className="text-xs font-semibold text-slate-700">Step-by-Step Replay</h3>
              <div className="divide-y divide-slate-200/70 glass-subtle rounded-xl">
                {incident.replay_timeline.map((item, idx) => (
                  <div key={idx} className="p-3.5 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-500 font-mono">
                      <span>Step {String(item.step ?? idx + 1)}</span>
                      <span>
                        {String(item.timestamp || "").replace("T", " ").slice(0, 19)} UTC
                      </span>
                    </div>
                    <div className="font-semibold text-slate-900">{String(item.title || "")}</div>
                    <p className="text-slate-600">{String(item.detail || "")}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-2">
              <h3 className="text-xs font-semibold text-slate-700">
                Tamper-Evident SHA-256 Audit Log
              </h3>
              <div className="divide-y divide-slate-200/70 glass-subtle rounded-xl">
                {incident.audit_log.map((entry) => (
                  <div key={entry.log_id} className="p-3.5 text-xs space-y-1">
                    <div className="flex items-center justify-between font-mono text-slate-700">
                      <span className="font-semibold">
                        {entry.from_state} → {entry.to_state}
                      </span>
                      <span className="text-slate-500">{entry.timestamp.slice(11, 19)} UTC</span>
                    </div>
                    <p className="text-slate-600">{entry.notes}</p>
                    <div className="text-[11px] font-mono text-slate-400 truncate">
                      {entry.actor_id} ({entry.actor_role}) · prev:{entry.prev_hash.slice(0, 10)} →
                      hash:{entry.entry_hash.slice(0, 14)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
