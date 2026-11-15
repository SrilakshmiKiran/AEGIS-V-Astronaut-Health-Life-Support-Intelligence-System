import React from "react";
import { Download, FileJson, FileText, RefreshCw, Send, ShieldCheck } from "lucide-react";
import {
  BaselineProfile,
  ConsultationQueueItem,
  IncidentRecord,
} from "../types/aegisContracts";
import { InformationBadge, SyncBadge } from "../components/InformationBadge";

interface EarthConsultationPageProps {
  baseline: BaselineProfile;
  incidents: IncidentRecord[];
  consultationQueue: ConsultationQueueItem[];
  earthWanConnected: boolean;
  onGeneratePackage: (incidentId: string) => Promise<void>;
  onSimulateSync: () => Promise<void>;
  syncFeedback: { ok: boolean; message: string } | null;
}

export const EarthConsultationPage: React.FC<EarthConsultationPageProps> = ({
  baseline,
  incidents,
  consultationQueue,
  earthWanConnected,
  onGeneratePackage,
  onSimulateSync,
  syncFeedback,
}) => {
  const activePkg = consultationQueue[0];
  const primaryIncident = incidents[0];

  const handleDownload = (format: "json" | "md") => {
    if (!activePkg) return;
    const content =
      format === "json"
        ? JSON.stringify(activePkg.payload, null, 2)
        : activePkg.payload.markdown_report;
    const mime = format === "json" ? "application/json" : "text/markdown";
    const ext = format === "json" ? "json" : "md";

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activePkg.package_id}_Earth_Consultation.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Consultation Generation / Sync Controls */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">
              Reports &amp; Earth Flight Surgeon Consultation Package
            </h2>
            <InformationBadge type="COMPUTED" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Compiles astronaut health summary, personal baseline deviations, incident timeline,
            before/after response trajectory, and Flight Surgeon questions for asynchronous Earth
            transmission.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {primaryIncident && (
            <button
              type="button"
              onClick={() => onGeneratePackage(primaryIncident.incident_id)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded text-xs font-mono transition-colors inline-flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Generate / Refresh Package ({primaryIncident.incident_id})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSimulateSync}
            className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded text-xs transition-colors inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Attempt Earth Sync</span>
          </button>

          {activePkg && (
            <>
              <button
                type="button"
                onClick={() => handleDownload("md")}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded text-xs font-mono transition-colors inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .MD</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownload("json")}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded text-xs font-mono transition-colors inline-flex items-center gap-1.5"
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Download .JSON</span>
              </button>
            </>
          )}
        </div>
      </div>

      {syncFeedback && (
        <div
          className={`p-3 rounded border text-xs font-mono flex items-center justify-between ${
            syncFeedback.ok
              ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
              : "bg-amber-950/40 border-amber-500/50 text-amber-300"
          }`}
        >
          <span>{syncFeedback.message}</span>
          <span className="text-slate-400">
            Sync operations never delete local SQLite records.
          </span>
        </div>
      )}

      {/* Offline Sync Queue Table (PENDING, SYNCED, ERROR) */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">
              Offline Export &amp; Synchronization Queue (PENDING / SYNCED / ERROR)
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Earth Link: {earthWanConnected ? "● CONNECTED" : "▲ DISCONNECTED"} · Sync operations
            never delete local SQLite records.
          </span>
        </div>

        {consultationQueue.length === 0 ? (
          <div className="text-xs font-mono text-slate-400 bg-slate-900/70 border border-slate-800 rounded p-4">
            No consultation packages currently in sync queue. Activate Scene 2–6 or click
            &quot;Generate Package&quot; above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3">Package ID</th>
                  <th className="py-2 px-3">Incident ID</th>
                  <th className="py-2 px-3">Created UTC</th>
                  <th className="py-2 px-3">Last Sync Attempt</th>
                  <th className="py-2 px-3">Sync Status</th>
                  <th className="py-2 pl-3">Queue / Link Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {consultationQueue.map((item) => (
                  <tr key={item.package_id} className="text-slate-200">
                    <td className="py-2 pr-3 text-cyan-300 font-semibold">{item.package_id}</td>
                    <td className="py-2 px-3">{item.incident_id}</td>
                    <td className="py-2 px-3 text-slate-400">
                      {item.created_at.replace("T", " ").slice(0, 19)}Z
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      {item.last_attempt_at
                        ? `${item.last_attempt_at.replace("T", " ").slice(0, 19)}Z`
                        : "—"}
                    </td>
                    <td className="py-2 px-3">
                      <SyncBadge status={item.sync_status} />
                    </td>
                    <td className="py-2 pl-3 text-slate-300">
                      {item.error_message ||
                        "Transmitted to Earth Mission Control MCC-H; local archive retained."}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Consultation Package Preview */}
      {activePkg && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Structured Summary & Flight Surgeon Questions */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Astronaut Health &amp; Incident Summary
                </h3>
                <SyncBadge status={activePkg.sync_status} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-slate-900/80 border border-slate-800 rounded p-3">
                <div>
                  <div className="text-slate-400">Astronaut</div>
                  <div className="text-white font-semibold">{baseline.full_name}</div>
                </div>
                <div>
                  <div className="text-slate-400">Incident / State</div>
                  <div className="text-cyan-300">
                    {activePkg.payload.incident_summary.incident_id} ·{" "}
                    {activePkg.payload.incident_summary.state}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Recorded Procedure</div>
                  <div className="text-emerald-300">
                    {activePkg.payload.incident_summary.procedure_reference || "Pending"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Post-Action Trend</div>
                  <div className="text-emerald-300">
                    {activePkg.payload.incident_summary.post_action_direction ||
                      "INSUFFICIENT_DATA"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-mono font-semibold text-cyan-300 uppercase">
                  Flight Surgeon Consultation Questions
                </h4>
                <div className="space-y-2">
                  {activePkg.payload.flight_surgeon_questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900/80 border border-slate-800 rounded p-2.5 text-xs text-slate-200 leading-relaxed"
                    >
                      {q}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Live Markdown Report Preview */}
          <div className="lg:col-span-6 bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Consultation Package Markdown Preview ({activePkg.package_id}.md)
              </h3>
              <span className="text-xs font-mono text-slate-400">UTF-8 / Offline Export</span>
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded p-3.5 text-xs font-mono text-slate-300 overflow-x-auto max-h-96 whitespace-pre-wrap leading-relaxed">
              {activePkg.payload.markdown_report}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
