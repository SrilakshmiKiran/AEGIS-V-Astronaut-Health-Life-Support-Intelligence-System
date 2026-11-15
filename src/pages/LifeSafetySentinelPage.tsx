import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  PackageCheck,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  Wrench,
} from "lucide-react";
import {
  AUTHORIZED_PROTOTYPE_PROCEDURES,
  ActorRole,
  TelemetryLatestResponse,
} from "../types/aegisContracts";
import { GUIDED_PROCEDURES } from "../types/continuityContracts";
import {
  CheckinScheduleEvaluation,
  EmergencyDashboardAnswers,
  EnvironmentSafetyAssessment,
  LifeSafetyConfig,
  LifeSafetyEvent,
} from "../types/lifeSafetyContracts";
import { CrewRosterMember, OpsRecordDoc } from "../types/opsContracts";
import { ResolvedEquipmentItem, canConfirmEquipmentInventory, formatMissionTimeUtc } from "../utils/aegisPureEngine";
import {
  canOperateLifeSafety,
  exportLifeSafetyEventMarkdown,
  filterEmergencyResources,
  isLifeSafetyAckOverdue,
} from "../utils/lifeSafetyEngine";
import { PageId } from "../types/navigation";
import { SafeImage } from "../components/SafeImage";
import { VISUAL_ASSETS } from "../assets/visualCatalog";

interface LifeSafetySentinelPageProps {
  astronautName: string;
  activeCrewId: string;
  operatorRole: ActorRole;
  crewRoster: CrewRosterMember[];
  latest: TelemetryLatestResponse;
  envAssessment: EnvironmentSafetyAssessment;
  checkinEval: CheckinScheduleEvaluation;
  lifeSafetyConfig: LifeSafetyConfig;
  lifeSafetyEvents: LifeSafetyEvent[];
  emergencyAnswers: EmergencyDashboardAnswers;
  resolvedEquipment: ResolvedEquipmentItem[];
  medRecords: OpsRecordDoc[];
  earthWanConnected: boolean;
  browserOnline: boolean;
  isBusy: boolean;
  onOpenEmergencyModal: () => void;
  onUpdateConfig: (next: Partial<LifeSafetyConfig>) => Promise<void>;
  onRecordCheckin: () => Promise<void>;
  onInitiateWelfareCheck: (note: string) => Promise<void>;
  onTransitionEvent: (
    eventId: string,
    action:
      | { type: "ACKNOWLEDGE_PRIMARY" | "ACKNOWLEDGE_BACKUP"; note?: string }
      | { type: "ESCALATE_BACKUP"; reason?: string }
      | { type: "RECORD_RESPONSE"; procedureRef: string; actionNote: string }
      | { type: "ADD_FOLLOWUP"; followUpNote: string }
      | { type: "RESOLVE_RETAIN"; resolutionNote: string }
  ) => Promise<void>;
  onConfirmEquipmentInventory: (equipmentId: string) => Promise<void>;
  onNavigate: (page: PageId) => void;
  onBackHome: () => void;
}

export const LifeSafetySentinelPage: React.FC<LifeSafetySentinelPageProps> = ({
  astronautName,
  activeCrewId,
  operatorRole,
  crewRoster,
  envAssessment,
  checkinEval,
  lifeSafetyConfig,
  lifeSafetyEvents,
  emergencyAnswers,
  resolvedEquipment,
  medRecords,
  earthWanConnected,
  browserOnline,
  isBusy,
  onOpenEmergencyModal,
  onUpdateConfig,
  onRecordCheckin,
  onInitiateWelfareCheck,
  onTransitionEvent,
  onConfirmEquipmentInventory,
  onNavigate,
  onBackHome,
}) => {
  const canOperate = canOperateLifeSafety(operatorRole);
  const canConfirmEquip = canConfirmEquipmentInventory(operatorRole);

  const openEvents = lifeSafetyEvents.filter((e) => e.state !== "RESOLVED_RETAINED");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    openEvents[0]?.eventId || lifeSafetyEvents[0]?.eventId || null
  );

  const selectedEvent =
    lifeSafetyEvents.find((e) => e.eventId === selectedEventId) ||
    openEvents[0] ||
    lifeSafetyEvents[0] ||
    null;

  // Approved procedures strictly from curated prototype sets
  const approvedProcedures = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(AUTHORIZED_PROTOTYPE_PROCEDURES).forEach(([id, title]) => map.set(id, title));
    GUIDED_PROCEDURES.forEach((p) => {
      if (!p.requiresCmo && !map.has(p.procedureId)) {
        map.set(p.procedureId, `${p.title} [Guided Crew Continuity Ref]`);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, []);

  const [selectedProcRef, setSelectedProcRef] = useState(
    approvedProcedures[0]?.id || "PROC-ENV-CO2-01"
  );
  const [actionNote, setActionNote] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [welfareNote, setWelfareNote] = useState("");

  // Resource locator state
  const [resourceSearch, setResourceSearch] = useState("");
  const [resourceFilter, setResourceFilter] = useState<
    "ALL" | "ENVIRONMENTAL" | "RESPIRATORY_MEDICAL" | "FIRE_PRESSURE" | "DIAGNOSTIC" | "AVAILABLE_ONLY"
  >("ALL");

  const filteredResources = useMemo(
    () => filterEmergencyResources(resolvedEquipment, resourceSearch, resourceFilter),
    [resolvedEquipment, resourceSearch, resourceFilter]
  );

  const ackOverdue = selectedEvent
    ? isLifeSafetyAckOverdue(selectedEvent, checkinEval.effectiveNowIso)
    : false;

  const downloadTextFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const lowOrExpiringMeds = medRecords.filter(
    (r) => Number(r.payload.stockQty || 0) <= 15 || String(r.payload.expiresOn || "") <= "2026-12"
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="glass-panel rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-8 space-y-3">
          <div className="space-y-1">
            <button
              type="button"
              onClick={onBackHome}
              className="text-xs font-medium text-sky-800 hover:text-sky-950 inline-flex items-center gap-1.5 cursor-pointer mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home Dashboard</span>
            </button>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Shield className="w-6 h-6 text-rose-700 shrink-0" />
              <span>AEGIS Life-Safety Sentinel</span>
            </h1>
            <p className="text-sm text-slate-600">
              Consolidated crew emergency dashboard, missed check-in supervision, escalation &amp;
              acknowledgement workflow, chronological event recorder, and emergency resource locator.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate("cabin-radiation")}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white/90 hover:bg-white text-xs font-semibold text-slate-800 cursor-pointer"
            >
              Inspect ECLSS Air &amp; Radiation →
            </button>
            <button
              type="button"
              onClick={onOpenEmergencyModal}
              className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Trigger Emergency Request</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 aspect-[16/9] rounded-xl overflow-hidden border border-slate-200/80">
          <SafeImage
            src={VISUAL_ASSETS.lifeSafety}
            alt="Orbital cabin life-safety pressure gauge and emergency oxygen mask kit"
            caption={`Crew Check-In Watch · Env ${envAssessment.overallLevel}`}
          />
        </div>
      </div>

      {/* Scientific & Operational Safety Boundary Banner */}
      <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-950 space-y-1">
        <div className="font-mono font-bold uppercase tracking-wide text-[11px]">
          RESEARCH PROTOTYPE &amp; OPERATIONAL SAFETY BOUNDARY
        </div>
        <p className="leading-relaxed">
          AEGIS Life-Safety Sentinel is a decision-support and event-coordination prototype for{" "}
          <strong>
            {astronautName} ({activeCrewId})
          </strong>
          . It does <strong>not</strong> diagnose medical conditions, prescribe treatment, fabricate
          sensor channels, autonomously control spacecraft hardware, or transmit a real distress
          beacon. Emergency events <strong>never auto-close</strong> when readings recover and
          require explicit human verification.
        </p>
      </div>

      {/* 7-Question Consolidated Emergency Dashboard */}
      <section aria-label="Consolidated Emergency Summary" className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Emergency Situation Overview (7 Essential Questions)
            </h2>
            <p className="text-xs text-slate-500">
              Single-glance crew triage state designed for low-stress emergency readability.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-700 tabular-nums">
            Effective Clock: {formatMissionTimeUtc(checkinEval.effectiveNowIso, true)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="glass-subtle rounded-xl p-4 space-y-1.5 md:col-span-2 lg:col-span-2">
            <div className="text-[11px] font-mono font-semibold uppercase text-slate-500">
              1. What Is Happening?
            </div>
            <div className="text-sm font-semibold text-slate-900 leading-snug">
              {emergencyAnswers.whatIsHappening}
            </div>
          </div>

          <div className="glass-subtle rounded-xl p-4 space-y-1.5">
            <div className="text-[11px] font-mono font-semibold uppercase text-slate-500">
              2. Threat Classification
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {emergencyAnswers.threatTypeLabel}
            </div>
            <div className="text-[11px] text-slate-600">
              ECLSS Environment: <strong>{envAssessment.overallLevel}</strong>
            </div>
          </div>

          <div className="glass-subtle rounded-xl p-4 space-y-1.5">
            <div className="text-[11px] font-mono font-semibold uppercase text-slate-500">
              3. Trustworthy Observations vs. Quality Flags
            </div>
            <div className="text-emerald-800 font-semibold">
              ● {emergencyAnswers.trustworthyObservations.length} verified valid live channel(s)
            </div>
            <ul className="space-y-0.5 text-[11px] font-mono text-slate-700 max-h-28 overflow-y-auto">
              {emergencyAnswers.trustworthyObservations.slice(0, 5).map((obs, idx) => (
                <li key={idx}>{obs}</li>
              ))}
            </ul>
            {emergencyAnswers.untrustworthyOrMissingObservations.length > 0 && (
              <div className="pt-1 border-t border-slate-200/70 text-[11px] text-amber-900">
                <strong>Withheld / Flagged ({emergencyAnswers.untrustworthyOrMissingObservations.length}):</strong>{" "}
                {emergencyAnswers.untrustworthyOrMissingObservations.slice(0, 2).join(" · ")}
              </div>
            )}
          </div>

          <div className="glass-subtle rounded-xl p-4 space-y-1.5">
            <div className="text-[11px] font-mono font-semibold uppercase text-slate-500">
              4. Who Has Acknowledged?
            </div>
            <div className="font-semibold text-slate-900 leading-snug">
              {emergencyAnswers.acknowledgementStatus}
            </div>
            <div className="text-[11px] text-slate-600">
              Primary: {crewRoster.find((c) => c.crewId === lifeSafetyConfig.primaryResponderCrewId)?.name || lifeSafetyConfig.primaryResponderCrewId}
              <br />
              Backup: {crewRoster.find((c) => c.crewId === lifeSafetyConfig.backupResponderCrewId)?.name || lifeSafetyConfig.backupResponderCrewId}
            </div>
          </div>

          <div className="glass-subtle rounded-xl p-4 space-y-1.5">
            <div className="text-[11px] font-mono font-semibold uppercase text-slate-500">
              5. Available Emergency Resources
            </div>
            <div className="text-sm font-mono font-bold text-slate-900 tabular-nums">
              {emergencyAnswers.relevantResourcesCount} / {resolvedEquipment.length} Equipment Ready
            </div>
            <p className="text-[11px] text-slate-600">
              Storage locations &amp; maintenance status indexed below (labeled simulated until crew-confirmed).
            </p>
          </div>

          <div className="glass-subtle rounded-xl p-4 space-y-1.5 md:col-span-2">
            <div className="text-[11px] font-mono font-semibold uppercase text-slate-500">
              6. What Remains Unresolved?
            </div>
            {emergencyAnswers.unresolvedItems.length === 0 ? (
              <div className="text-emerald-800 font-medium">
                ● No unresolved emergency items, overdue check-ins, or comms gaps.
              </div>
            ) : (
              <ul className="space-y-1 text-amber-950 font-medium">
                {emergencyAnswers.unresolvedItems.map((item, idx) => (
                  <li key={idx}>▲ {item}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass-subtle rounded-xl p-4 space-y-1.5">
            <div className="text-[11px] font-mono font-semibold uppercase text-slate-500">
              7. Is Earth Communication Available?
            </div>
            <div
              className={`font-semibold ${
                earthWanConnected && browserOnline ? "text-emerald-800" : "text-amber-900"
              }`}
            >
              {earthWanConnected ? "● Simulated Earth Link ON" : "▲ Simulated Earth Link OFF"}
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              {emergencyAnswers.earthCommsSummary}
            </p>
          </div>
        </div>
      </section>

      {/* Active Escalation Workflow & Chronological Event Recorder */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Emergency Escalation &amp; Event Recorder
              </h2>
              <p className="text-xs text-slate-500">
                Select any active or retained historical emergency event to advance acknowledgement,
                approved procedures, follow-up observations, or export records.
              </p>
            </div>
            {lifeSafetyEvents.length > 0 && (
              <select
                aria-label="Select Emergency Event"
                value={selectedEvent?.eventId || ""}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="bg-white/90 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 max-w-xs"
              >
                {lifeSafetyEvents.map((ev) => (
                  <option key={ev.eventId} value={ev.eventId}>
                    [{ev.state === "RESOLVED_RETAINED" ? "RETAINED" : ev.state}] {ev.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {!selectedEvent ? (
            <div className="rounded-xl border border-slate-200 bg-white/75 p-5 text-xs text-slate-600 space-y-2">
              <div className="font-semibold text-slate-900">No emergency or welfare events recorded yet.</div>
              <p>
                Use <strong>Trigger Emergency Request</strong> above to test priority escalation, or
                test a missed crew check-in in the scheduler panel to generate a welfare-check timeline.
              </p>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div
                className={`rounded-xl border p-4 space-y-2 ${
                  selectedEvent.state === "RESOLVED_RETAINED"
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                    : "bg-rose-50/85 border-rose-200 text-rose-950"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold">
                    {selectedEvent.eventId} · {selectedEvent.state.replace(/_/g, " ")} ·{" "}
                    {selectedEvent.syncStatus === "QUEUED_OFFLINE" ? "LOCAL OFFLINE QUEUE" : "CLOUD SYNCED"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        downloadTextFile(
                          `${selectedEvent.eventId}.md`,
                          exportLifeSafetyEventMarkdown(selectedEvent),
                          "text/markdown"
                        )
                      }
                      className="px-2.5 py-1 bg-white/90 hover:bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Export MD</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadTextFile(
                          `${selectedEvent.eventId}.json`,
                          JSON.stringify(selectedEvent, null, 2),
                          "application/json"
                        )
                      }
                      className="px-2.5 py-1 bg-white/90 hover:bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export JSON</span>
                    </button>
                  </div>
                </div>
                <div className="text-sm font-bold">{selectedEvent.title}</div>
                <p className="opacity-90">{selectedEvent.summary}</p>
                <div className="font-mono text-[11px] pt-1 border-t border-slate-300/60">
                  Environment Snapshot: {selectedEvent.environmentalSnapshotSummary}
                </div>
              </div>

              {ackOverdue && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 flex flex-wrap items-center justify-between gap-2 text-amber-950">
                  <div>
                    <strong>Primary Acknowledgement Deadline Elapsed:</strong>{" "}
                    {selectedEvent.primaryResponderName} did not acknowledge within{" "}
                    {lifeSafetyConfig.ackTimeoutMinutes} min. Escalate to backup responder{" "}
                    <strong>{selectedEvent.backupResponderName}</strong>.
                  </div>
                  <button
                    type="button"
                    disabled={isBusy || !canOperate}
                    onClick={() =>
                      onTransitionEvent(selectedEvent.eventId, {
                        type: "ESCALATE_BACKUP",
                        reason: "Ack timeout elapsed — escalated to backup responder.",
                      })
                    }
                    className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-45 text-white font-semibold rounded-xl cursor-pointer"
                  >
                    Escalate to Backup Responder Now
                  </button>
                </div>
              )}

              {/* Responder Action Controls (Explicit Human Control) */}
              {selectedEvent.state !== "RESOLVED_RETAINED" ? (
                <div className="rounded-xl border border-slate-200 bg-white/80 p-4 space-y-3">
                  <div className="font-semibold text-slate-900 flex items-center justify-between gap-2">
                    <span>Onboard Escalation &amp; Response Controls</span>
                    {!canOperate && (
                      <span className="text-[11px] text-rose-700 font-normal">
                        Read-only role (Mission Observer cannot mutate emergency state)
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!selectedEvent.primaryAckAtIso && (
                      <button
                        type="button"
                        disabled={isBusy || !canOperate}
                        onClick={() =>
                          onTransitionEvent(selectedEvent.eventId, {
                            type: "ACKNOWLEDGE_PRIMARY",
                          })
                        }
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white font-semibold rounded-xl cursor-pointer"
                      >
                        Acknowledge (Primary: {selectedEvent.primaryResponderName})
                      </button>
                    )}

                    {!selectedEvent.backupNotifiedAtIso && (
                      <button
                        type="button"
                        disabled={isBusy || !canOperate}
                        onClick={() =>
                          onTransitionEvent(selectedEvent.eventId, {
                            type: "ESCALATE_BACKUP",
                          })
                        }
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-45 text-white font-semibold rounded-xl cursor-pointer"
                      >
                        Escalate to Backup ({selectedEvent.backupResponderName})
                      </button>
                    )}

                    {selectedEvent.backupNotifiedAtIso && !selectedEvent.backupAckAtIso && (
                      <button
                        type="button"
                        disabled={isBusy || !canOperate}
                        onClick={() =>
                          onTransitionEvent(selectedEvent.eventId, {
                            type: "ACKNOWLEDGE_BACKUP",
                          })
                        }
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white font-semibold rounded-xl cursor-pointer"
                      >
                        Acknowledge (Backup: {selectedEvent.backupResponderName})
                      </button>
                    )}
                  </div>

                  {/* Step: Approved Procedure Response */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-slate-200/70">
                    <select
                      aria-label="Approved Reference Procedure"
                      value={selectedProcRef}
                      onChange={(e) => setSelectedProcRef(e.target.value)}
                      className="sm:col-span-5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                    >
                      {approvedProcedures.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.id}: {p.label}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="Operator Response Note"
                      type="text"
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder="Record crew action taken using approved guide..."
                      className="sm:col-span-4 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                    />
                    <button
                      type="button"
                      disabled={isBusy || !canOperate || !actionNote.trim()}
                      onClick={async () => {
                        await onTransitionEvent(selectedEvent.eventId, {
                          type: "RECORD_RESPONSE",
                          procedureRef: selectedProcRef,
                          actionNote,
                        });
                        setActionNote("");
                      }}
                      className="sm:col-span-3 px-3 py-1.5 bg-sky-700 hover:bg-sky-800 disabled:opacity-45 text-white font-semibold rounded-xl cursor-pointer"
                    >
                      Record Response
                    </button>
                  </div>

                  {/* Step: Follow-Up Observation */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                      aria-label="Follow-up Observation Note"
                      type="text"
                      value={followUpNote}
                      onChange={(e) => setFollowUpNote(e.target.value)}
                      placeholder="Log follow-up check (e.g., crew spoke via intercom, CO2 dropping, SpO2 97%)..."
                      className="sm:col-span-9 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                    />
                    <button
                      type="button"
                      disabled={isBusy || !canOperate || !followUpNote.trim()}
                      onClick={async () => {
                        await onTransitionEvent(selectedEvent.eventId, {
                          type: "ADD_FOLLOWUP",
                          followUpNote,
                        });
                        setFollowUpNote("");
                      }}
                      className="sm:col-span-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-45 text-white font-semibold rounded-xl cursor-pointer"
                    >
                      Add Follow-Up
                    </button>
                  </div>

                  {/* Step: Explicit Human Closure */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-slate-200/70">
                    <input
                      aria-label="Explicit Closure Note"
                      type="text"
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder="Explicit human verification note required before closing & retaining..."
                      className="sm:col-span-9 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                    />
                    <button
                      type="button"
                      disabled={isBusy || !canOperate || !resolutionNote.trim()}
                      onClick={async () => {
                        await onTransitionEvent(selectedEvent.eventId, {
                          type: "RESOLVE_RETAIN",
                          resolutionNote,
                        });
                        setResolutionNote("");
                      }}
                      className="sm:col-span-3 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-45 text-white font-semibold rounded-xl cursor-pointer"
                    >
                      Resolve &amp; Retain
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-950 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Closed explicitly by {selectedEvent.resolvedBy} at{" "}
                    {formatMissionTimeUtc(selectedEvent.resolvedAtIso, true)} — permanently
                    retained in timeline history.
                  </span>
                </div>
              )}

              {/* Chronological Event Timeline */}
              <div className="space-y-2">
                <div className="font-semibold text-slate-900">
                  Chronological Event Recorder ({selectedEvent.timeline.length} entries)
                </div>
                <ol className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {selectedEvent.timeline.map((entry) => (
                    <li
                      key={entry.entryId}
                      className="rounded-xl border border-slate-200 bg-white/80 p-3 space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-slate-600 tabular-nums">
                        <span className="font-bold text-slate-900">{entry.eventType}</span>
                        <span>
                          {formatMissionTimeUtc(entry.timestampIso, true)} · Earth:{" "}
                          {entry.earthCommsStatus} ·{" "}
                          {entry.browserOnline ? "Cloud" : "Offline Local"}
                        </span>
                      </div>
                      <div className="text-slate-900 font-medium">{entry.summary}</div>
                      <div className="text-[11px] text-slate-500">
                        Actor: {entry.actorName} ({entry.actorRole.replace(/_/g, " ")})
                      </div>
                      {entry.observationsSnapshot && entry.observationsSnapshot.length > 0 && (
                        <div className="text-[11px] font-mono text-slate-700 bg-slate-50 rounded-lg p-2 mt-1">
                          Attached Obs: {entry.observationsSnapshot.join(" | ")}
                        </div>
                      )}
                      {entry.dataQualityWarnings && entry.dataQualityWarnings.length > 0 && (
                        <div className="text-[11px] text-amber-900 bg-amber-50 rounded-lg p-2 mt-1">
                          Quality Warnings: {entry.dataQualityWarnings.join(" | ")}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Missed Crew Check-In Scheduler & Escalation Configuration */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-6 space-y-4 text-xs">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-700" />
              <span>Missed Crew Check-In &amp; Welfare Escalation</span>
            </h2>
            <p className="text-slate-500 mt-0.5">
              Tracks scheduled crew check-ins with grace window and primary/backup escalation.
            </p>
          </div>

          <div
            className={`rounded-xl p-4 border space-y-2 ${
              checkinEval.statusCode === "MISSED_OVERDUE" ||
              checkinEval.statusCode === "WELFARE_CHECK_ACTIVE"
                ? "bg-amber-50/90 border-amber-300 text-amber-950"
                : checkinEval.statusCode === "REMINDER_DUE"
                ? "bg-sky-50/90 border-sky-200 text-sky-950"
                : "bg-emerald-50/85 border-emerald-200 text-emerald-950"
            }`}
          >
            <div className="font-mono text-[11px] font-bold">
              STATUS: {checkinEval.statusCode.replace(/_/g, " ")}
            </div>
            <div className="text-sm font-bold">{checkinEval.headline}</div>
            <p className="leading-relaxed">{checkinEval.detail}</p>
            <div className="pt-2 border-t border-slate-300/60 font-medium text-[11px]">
              {checkinEval.safetyNotice}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={isBusy || !canOperate}
              onClick={onRecordCheckin}
              className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Record Check-In Now</span>
            </button>
            <button
              type="button"
              disabled={isBusy || !canOperate}
              onClick={async () => {
                await onInitiateWelfareCheck(welfareNote);
                setWelfareNote("");
              }}
              className="py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-45 text-white font-semibold cursor-pointer"
            >
              Initiate Welfare Check
            </button>
          </div>

          <input
            aria-label="Optional Welfare Check Note"
            type="text"
            value={welfareNote}
            onChange={(e) => setWelfareNote(e.target.value)}
            placeholder="Optional welfare context (e.g., no intercom reply in Airlock 2)..."
            className="w-full rounded-xl border border-slate-300 bg-white/90 px-3 py-1.5 text-slate-900"
          />

          <div className="rounded-xl border border-slate-200 bg-white/75 p-4 space-y-3">
            <div className="font-semibold text-slate-900">
              Schedule &amp; Responder Configuration
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1">
                <span className="text-[11px] text-slate-600 block">Cadence (hr)</span>
                <select
                  aria-label="Check-in Interval Hours"
                  value={lifeSafetyConfig.checkinIntervalHours}
                  disabled={isBusy || !canOperate}
                  onChange={(e) =>
                    onUpdateConfig({ checkinIntervalHours: Number(e.target.value) })
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono"
                >
                  <option value={4}>4h</option>
                  <option value={8}>8h</option>
                  <option value={12}>12h</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] text-slate-600 block">Grace (min)</span>
                <select
                  aria-label="Grace Period Minutes"
                  value={lifeSafetyConfig.gracePeriodMinutes}
                  disabled={isBusy || !canOperate}
                  onChange={(e) =>
                    onUpdateConfig({ gracePeriodMinutes: Number(e.target.value) })
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono"
                >
                  <option value={10}>10m</option>
                  <option value={15}>15m</option>
                  <option value={30}>30m</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] text-slate-600 block">Ack Timeout</span>
                <select
                  aria-label="Ack Escalation Timeout"
                  value={lifeSafetyConfig.ackTimeoutMinutes}
                  disabled={isBusy || !canOperate}
                  onChange={(e) =>
                    onUpdateConfig({ ackTimeoutMinutes: Number(e.target.value) })
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono"
                >
                  <option value={5}>5m</option>
                  <option value={10}>10m</option>
                  <option value={20}>20m</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[11px] text-slate-600 block">Primary Responder</span>
                <select
                  aria-label="Primary Responder"
                  value={lifeSafetyConfig.primaryResponderCrewId}
                  disabled={isBusy || !canOperate}
                  onChange={(e) =>
                    onUpdateConfig({ primaryResponderCrewId: e.target.value })
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-[11px]"
                >
                  {crewRoster.map((c) => (
                    <option key={c.crewId} value={c.crewId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] text-slate-600 block">Backup Responder</span>
                <select
                  aria-label="Backup Responder"
                  value={lifeSafetyConfig.backupResponderCrewId}
                  disabled={isBusy || !canOperate}
                  onChange={(e) =>
                    onUpdateConfig({ backupResponderCrewId: e.target.value })
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-[11px]"
                >
                  {crewRoster.map((c) => (
                    <option key={c.crewId} value={c.crewId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-slate-600">
                Test Clock Offset: +{lifeSafetyConfig.simulatedElapsedOffsetMinutes || 0} min
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isBusy || !canOperate}
                  onClick={() =>
                    onUpdateConfig({
                      simulatedElapsedOffsetMinutes:
                        (lifeSafetyConfig.simulatedElapsedOffsetMinutes || 0) + 540,
                    })
                  }
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-[11px] font-semibold text-slate-800 cursor-pointer"
                >
                  Advance +9h (Test Overdue)
                </button>
                {(lifeSafetyConfig.simulatedElapsedOffsetMinutes || 0) > 0 && (
                  <button
                    type="button"
                    disabled={isBusy || !canOperate}
                    onClick={() => onUpdateConfig({ simulatedElapsedOffsetMinutes: 0 })}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer"
                  >
                    Reset Clock
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Searchable Emergency Resource Locator */}
      <section aria-label="Emergency Resource Locator" className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-sky-700" />
              <span>Emergency Resource Locator &amp; Equipment Availability</span>
            </h2>
            <p className="text-xs text-slate-500">
              Search medical kits, portable oxygen/PBA, fire suppression, pressure-leak patch kits,
              storage lockers, and expiry status. Clearly labeled simulated until crew-confirmed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                aria-label="Search Emergency Resources"
                type="text"
                value={resourceSearch}
                onChange={(e) => setResourceSearch(e.target.value)}
                placeholder="Search oxygen, extinguisher, locker..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 bg-white/90 text-slate-900 w-60"
              />
            </div>

            <select
              aria-label="Filter Emergency Resources"
              value={resourceFilter}
              onChange={(e) =>
                setResourceFilter(
                  e.target.value as
                    | "ALL"
                    | "ENVIRONMENTAL"
                    | "RESPIRATORY_MEDICAL"
                    | "FIRE_PRESSURE"
                    | "DIAGNOSTIC"
                    | "AVAILABLE_ONLY"
                )
              }
              className="rounded-xl border border-slate-300 bg-white/90 px-3 py-1.5 font-medium text-slate-900"
            >
              <option value="ALL">All Categories ({resolvedEquipment.length})</option>
              <option value="AVAILABLE_ONLY">Available Only</option>
              <option value="FIRE_PRESSURE">Fire &amp; Breathing O2</option>
              <option value="ENVIRONMENTAL">Environmental &amp; Pressure Kits</option>
              <option value="RESPIRATORY_MEDICAL">Respiratory &amp; Oximetry</option>
              <option value="DIAGNOSTIC">Wearable &amp; Diagnostic</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {filteredResources.map((eq) => {
            const isOp = eq.effectiveStatus === "OPERATIONAL";
            const isUnavail = eq.effectiveStatus === "UNAVAILABLE";
            return (
              <div
                key={eq.equipmentId}
                className={`rounded-xl p-4 border flex flex-col justify-between gap-2.5 ${
                  isUnavail
                    ? "bg-rose-50/85 border-rose-200 text-rose-950"
                    : isOp
                    ? "bg-white/80 border-slate-200 text-slate-900"
                    : "bg-amber-50/85 border-amber-200 text-amber-950"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                    <span className="text-slate-500">{eq.equipmentId}</span>
                    <span
                      className={`font-bold ${
                        isOp ? "text-emerald-700" : isUnavail ? "text-rose-700" : "text-amber-700"
                      }`}
                    >
                      {eq.availability} · {eq.effectiveStatus}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-slate-900">{eq.name}</div>
                  <div>
                    <strong>Location:</strong> {eq.location}
                  </div>
                  {eq.maintenanceOrExpiryInfo && (
                    <div className="text-[11px] text-slate-700">
                      <strong>Maint / Expiry:</strong> {eq.maintenanceOrExpiryInfo}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-600 leading-snug">{eq.notes}</div>
                </div>

                <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2 text-[11px]">
                  <div className="font-mono text-slate-600">
                    <div>
                      Checked:{" "}
                      {eq.lastConfirmedAtIso
                        ? formatMissionTimeUtc(eq.lastConfirmedAtIso)
                        : "Unconfirmed"}
                    </div>
                    <div className="text-[10px]">
                      {eq.isSimulatedConfirmation
                        ? "[SIMULATED DEMO STATUS]"
                        : `[CREW-CONFIRMED] ${eq.confirmedBy}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy || !canConfirmEquip}
                    onClick={() => onConfirmEquipmentInventory(eq.equipmentId)}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white rounded-lg font-medium cursor-pointer"
                  >
                    Confirm Check
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Linked Med-Kit Consumable Watch */}
        <div className="pt-3 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <PackageCheck className="w-4 h-4 text-sky-700 shrink-0" />
            <span>
              Med-Kit Consumables: <strong>{medRecords.length}</strong> tracked ·{" "}
              <strong className={lowOrExpiringMeds.length > 0 ? "text-amber-800" : "text-emerald-800"}>
                {lowOrExpiringMeds.length} low-stock / near-expiry item(s)
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("med-kit")}
            className="text-sky-800 hover:text-sky-950 font-semibold cursor-pointer"
          >
            Manage Med Kit Consumables →
          </button>
        </div>
      </section>

      {/* Retained Historical Emergency Events Archive */}
      {lifeSafetyEvents.filter((e) => e.state === "RESOLVED_RETAINED").length > 0 && (
        <section className="glass-panel rounded-2xl p-5 space-y-3 text-xs">
          <div className="font-semibold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-emerald-700" />
            <span>Retained Historical Emergency Events</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lifeSafetyEvents
              .filter((e) => e.state === "RESOLVED_RETAINED")
              .map((ev) => (
                <div
                  key={ev.eventId}
                  className="rounded-xl border border-slate-200 bg-white/80 p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{ev.title}</div>
                    <div className="text-[11px] font-mono text-slate-600 tabular-nums">
                      Closed by {ev.resolvedBy} · {formatMissionTimeUtc(ev.resolvedAtIso, true)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedEventId(ev.eventId)}
                    className="px-2.5 py-1 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg font-semibold text-slate-800 cursor-pointer shrink-0"
                  >
                    Inspect Record
                  </button>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
};
