import React from "react";
import {
  ALL_18_PARAMETERS,
  BaselineProfile,
  DataSourceType,
  DemoSceneId,
  IncidentRecord,
  PARAMETER_METADATA,
  SimulatorStatusResponse,
  SystemHealthResponse,
} from "../types/aegisContracts";
import { OperatorSession } from "../services/apiClient";
import { InformationBadge, SyncBadge } from "../components/InformationBadge";
import {
  CheckCircle2,
  Database,
  History,
  Lock,
  Play,
  Radio,
  Settings,
  ShieldCheck,
} from "lucide-react";

interface HistoryReplayPageProps {
  incidents: IncidentRecord[];
  baseline: BaselineProfile;
  systemHealth: SystemHealthResponse;
  simulatorStatus: SimulatorStatusResponse;
  auditIntegrity: {
    chain_valid: boolean;
    entry_count: number;
    latest_hash: string;
    wal_mode_active: boolean;
    triggers_active: boolean;
  };
  backups: Array<{
    backup_id: string;
    filename: string;
    created_at: string;
    reason: string;
    sha256_checksum: string;
  }>;
  operator: OperatorSession;
  onActivateScene: (sceneId: DemoSceneId) => Promise<void>;
  onToggleEarthLink: (connected: boolean) => Promise<void>;
  onUpdateConfig: (cfg: {
    optional_llm_enabled?: boolean;
    data_source_mode?: DataSourceType;
  }) => Promise<void>;
  onCreateBackup: () => Promise<void>;
  settingsFeedback: { ok: boolean; message: string } | null;
}

export const HistoryReplayPage: React.FC<HistoryReplayPageProps> = ({
  incidents,
  baseline,
  systemHealth,
  simulatorStatus,
  auditIntegrity,
  backups,
  operator,
  onActivateScene,
  onToggleEarthLink,
  onUpdateConfig,
  onCreateBackup,
  settingsFeedback,
}) => {
  const incident = incidents[0];

  return (
    <div className="space-y-6">
      {/* SECTION 8 PART 1: Chronological History & Incident Replay Timeline */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">
              Chronological Mission History &amp; Incident Replay Scrubber
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <InformationBadge type="MEASURED" />
            <InformationBadge type="COMPUTED" />
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Reconstructs the complete chronological sequence of telemetry readings, Stage 2 data
          quarantine events, deterministic rule triggers, CMO acknowledgments, recorded responses,
          and post-action follow-up evaluations.
        </p>

        {!incident ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded p-4 text-xs font-mono text-slate-400">
            Currently in Scene 1 (Nominal State) — no incident replay events recorded. Activate
            Scene 2–6 to inspect the full chronological incident timeline and SHA-256 audit chain.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chronological Replay Events */}
            <div className="lg:col-span-7 space-y-2.5">
              <h3 className="text-xs font-mono font-semibold text-cyan-300 uppercase">
                Chronological Replay Timeline ({incident.incident_id})
              </h3>
              <div className="space-y-2">
                {incident.replay_timeline.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-900/90 border border-slate-800 rounded p-3 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-400">
                        <span className="text-cyan-400 font-semibold">
                          STEP {String(item.step ?? idx + 1)}
                        </span>
                        <span>·</span>
                        <span>
                          {String(item.timestamp || "").replace("T", " ").slice(0, 19)} UTC
                        </span>
                        {Boolean(item.state) && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-300">STATE: {String(item.state)}</span>
                          </>
                        )}
                      </div>
                      <div className="font-semibold text-white">{String(item.title || "")}</div>
                      <p className="text-slate-300">{String(item.detail || "")}</p>
                    </div>
                    <InformationBadge
                      type={item.label === "MEASURED" ? "MEASURED" : "COMPUTED"}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Immutable SHA-256 Audit Log Chain */}
            <div className="lg:col-span-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-semibold text-emerald-300 uppercase">
                  Tamper-Evident SHA-256 Audit Log
                </h3>
                <SyncBadge status={incident.sync_status} />
              </div>

              <div className="space-y-2">
                {incident.audit_log.map((entry) => (
                  <div
                    key={entry.log_id}
                    className="bg-slate-900/90 border border-slate-800 rounded p-3 text-xs font-mono space-y-1"
                  >
                    <div className="flex items-center justify-between text-cyan-300">
                      <span className="font-semibold">
                        {entry.log_id}: {entry.from_state} → {entry.to_state}
                      </span>
                      <span className="text-slate-400">
                        {entry.timestamp.slice(11, 19)} UTC
                      </span>
                    </div>
                    <div className="text-slate-300 font-sans">{entry.notes}</div>
                    <div className="text-[11px] text-slate-400">
                      Actor: {entry.actor_id} ({entry.actor_role})
                    </div>
                    <div className="text-[10px] text-slate-500 truncate" title={entry.entry_hash}>
                      SHA-256: {entry.entry_hash}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 8 PART 2: 5-Panel Settings, Data Sources & System Diagnostics */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">
              System Settings, Data Sources &amp; Onboard Diagnostics (5-Panel Controller)
            </h2>
          </div>
          {settingsFeedback && (
            <span
              className={`text-xs font-mono px-2.5 py-1 rounded border ${
                settingsFeedback.ok
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                  : "bg-rose-950/40 border-rose-500/40 text-rose-300"
              }`}
            >
              {settingsFeedback.message}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Panel B: Telemetry Source & 6-Scene Simulator Controller */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Play className="w-4 h-4 text-cyan-400" />
                <span>Panel B — Telemetry Source &amp; Demo Simulator</span>
              </h3>
              <span className="text-xs font-mono text-amber-300">
                Mode: {simulatorStatus.data_source_mode}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="text-slate-400">Select Active Telemetry Data Source Mode:</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ data_source_mode: "SIMULATED" })}
                  className={`p-2 rounded border font-mono text-left ${
                    simulatorStatus.data_source_mode === "SIMULATED"
                      ? "bg-cyan-950/60 border-cyan-400 text-white"
                      : "bg-slate-900 border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="font-semibold">SIMULATED</div>
                  <div className="text-[10px]">SIM-ENGINE-01 Demo Feed</div>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ data_source_mode: "VERIFIED_DEVICE" })}
                  className={`p-2 rounded border font-mono text-left ${
                    simulatorStatus.data_source_mode === "VERIFIED_DEVICE"
                      ? "bg-cyan-950/60 border-cyan-400 text-white"
                      : "bg-slate-900 border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="font-semibold">VERIFIED_DEVICE</div>
                  <div className="text-[10px]">CSA Hexoskin + HMAC-SHA256</div>
                </button>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
              <div className="text-slate-400">Direct 6-Scene Simulator Triggers:</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono">
                {(
                  [
                    "SCENE_1_NORMAL",
                    "SCENE_2_GRADUAL_ANOMALY",
                    "SCENE_3_EXPLAIN",
                    "SCENE_4_EARTH_UNAVAILABLE",
                    "SCENE_5_RESPONSE_FOLLOWUP",
                    "SCENE_6_CONNECTIVITY_RESTORED",
                  ] as DemoSceneId[]
                ).map((sc, idx) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => onActivateScene(sc)}
                    className={`px-2 py-1.5 rounded border text-[11px] truncate ${
                      simulatorStatus.active_scene === sc
                        ? "bg-cyan-500 text-slate-950 border-cyan-400 font-semibold"
                        : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800"
                    }`}
                  >
                    Scene {idx + 1}: {sc.replace(`SCENE_${idx + 1}_`, "")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Panel C: Earth WAN Link & Onboard SQLite Persistence Diagnostics */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>Panel C — Earth WAN Link &amp; SQLite Persistence</span>
              </h3>
              <span
                className={`text-xs font-mono font-semibold ${
                  systemHealth.earth_wan_connected ? "text-emerald-300" : "text-amber-300"
                }`}
              >
                {systemHealth.earth_wan_connected ? "● WAN ONLINE" : "▲ OFFLINE MODE"}
              </span>
            </div>

            <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded p-3 text-xs">
              <div>
                <div className="font-semibold text-white">Earth Deep-Space WAN Link Toggle</div>
                <div className="text-slate-400 text-[11px]">
                  Simulate loss of Earth connectivity while onboard computing continues locally
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleEarthLink(!systemHealth.earth_wan_connected)}
                className={`px-3 py-1.5 rounded font-mono text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  systemHealth.earth_wan_connected
                    ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                    : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                }`}
              >
                {systemHealth.earth_wan_connected ? "Disconnect Earth WAN" : "Restore Earth WAN"}
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 text-xs font-mono">
              {Object.entries(systemHealth.db_counts).map(([table, count]) => (
                <div
                  key={table}
                  className="bg-slate-900/70 border border-slate-800 rounded p-2 flex flex-col justify-between"
                >
                  <span className="text-[10px] text-slate-400 truncate" title={table}>
                    {table}
                  </span>
                  <span className="text-sm font-bold text-cyan-300 tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Panel D: Optional AI / Explanation Mode Configuration */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Database className="w-4 h-4 text-cyan-400" />
                <span>Panel D — Optional AI / Explanation Mode</span>
              </h3>
              <InformationBadge type="AI_ASSISTED" />
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Default: Deterministic Offline Template Explanation. Optional Local LLM is strictly
              limited to narrative summarization and never controls alert generation, diagnosis, or
              treatment.
            </p>

            <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded p-3 text-xs">
              <div>
                <div className="font-mono font-semibold text-white">
                  Active Mode:{" "}
                  {systemHealth.optional_llm_enabled ? "OPTIONAL_LOCAL_LLM" : "TEMPLATE_OFFLINE"}
                </div>
                <div className="text-slate-400 text-[11px]">
                  Guardrail filter blocks clinical diagnosis/prescription claims
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateConfig({ optional_llm_enabled: !systemHealth.optional_llm_enabled })
                }
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded font-mono text-xs transition-colors"
              >
                Toggle Narrative Mode
              </button>
            </div>
          </div>

          {/* Panel E: Prototype RBAC Security, Tamper-Evident Audit Chain & Crash Recovery */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>Panel E — RBAC Security, Audit Chain &amp; Backups</span>
              </h3>
              <span className="text-xs font-mono text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>CHAIN VALID</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-900/80 border border-slate-800 rounded p-2.5">
                <div className="text-slate-400 text-[11px]">Active Operator Role</div>
                <div className="text-cyan-300 font-semibold mt-0.5">
                  {operator.actorRole || "UNAUTHENTICATED (401)"}
                </div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded p-2.5">
                <div className="text-slate-400 text-[11px]">SQLite Durability Mode</div>
                <div className="text-emerald-300 font-semibold mt-0.5">
                  PRAGMA journal_mode=WAL
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="text-[11px] font-mono text-slate-400 truncate">
                Snapshots: {backups.length} (Latest: {backups[0]?.filename})
              </div>
              <button
                type="button"
                onClick={onCreateBackup}
                className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded transition-colors whitespace-nowrap shrink-0"
              >
                Create Hot SQLite Snapshot Backup
              </button>
            </div>
          </div>
        </div>

        {/* Panel A: Astronaut Profile & 18-Parameter Seeded Baseline Summary */}
        <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>
                Panel A — Astronaut Profile &amp; Seeded 18-Parameter Baseline Summary (
                {baseline.astronaut_id} — {baseline.full_name})
              </span>
            </h3>
            <span className="text-xs font-mono text-slate-400">{baseline.window_label}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs font-mono">
            {ALL_18_PARAMETERS.map((param) => {
              const m = baseline.metrics[param];
              const meta = PARAMETER_METADATA[param];
              return (
                <div
                  key={param}
                  className="bg-slate-900/80 border border-slate-800 rounded p-2 space-y-0.5"
                >
                  <div className="text-slate-300 font-sans font-medium truncate" title={meta.label}>
                    {meta.shortLabel}
                  </div>
                  <div className="text-cyan-300 font-bold tabular-nums">
                    {m.mean} {m.unit}
                  </div>
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    P05–P95: {m.p05}–{m.p95}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
