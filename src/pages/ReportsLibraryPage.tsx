import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Printer,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Stethoscope,
  WifiOff,
} from "lucide-react";
import {
  ALL_18_PARAMETERS,
  BaselineProfile,
  ConsultationQueueItem,
  IncidentRecord,
  KnowledgeResource,
  PARAMETER_METADATA,
  TelemetryLatestResponse,
} from "../types/aegisContracts";
import {
  DIAGNOSTIC_PRESET_CAPTURES,
  EXTENDED_BIO_BANDS,
  ExtendedBioSummary,
  LIGHT_DELAY_META,
  LightDelayMode,
  MISSION_ENVIRONMENT_META,
  MissionEnvironmentId,
  OpsRecordDoc,
  OpsStateDoc,
} from "../types/opsContracts";
import { SyncStatusText } from "../components/StatusText";
import { SafeImage } from "../components/SafeImage";
import { VISUAL_ASSETS } from "../assets/visualCatalog";

const PRESET_CAPTURE_THUMB: Record<"FUNDOSCOPE" | "ECG" | "ULTRASOUND", string> = {
  FUNDOSCOPE: VISUAL_ASSETS.bodyAtlas,
  ECG: VISUAL_ASSETS.liveVitals,
  ULTRASOUND: VISUAL_ASSETS.dailyCheckin,
};

const BASE_DESTINATIONS = [
  "Earth Mission Control — Flight Surgeon Console",
  "Lunar Gateway Medical Bay",
  "Artemis / Mars Surface Habitat Medical Base",
];

interface ReportsLibraryPageProps {
  baseline: BaselineProfile;
  latest: TelemetryLatestResponse;
  incidents: IncidentRecord[];
  consultationQueue: ConsultationQueueItem[];
  resources: KnowledgeResource[];
  earthWanConnected: boolean;
  browserOnline: boolean;
  lightDelayMode: LightDelayMode;
  opsState: OpsStateDoc;
  environmentMode: MissionEnvironmentId;
  extendedBio: ExtendedBioSummary | null;
  storedScansCount: number;
  voiceMemoCount: number;
  astronautName: string;
  missionName: string;
  consultMessages: OpsRecordDoc[];
  onChangeLightDelayMode: (mode: LightDelayMode) => Promise<void>;
  onSendConsultMessage: (input: {
    body: string;
    attachmentLabel: string;
    attachmentKind: string;
    requestGroundReply: boolean;
  }) => Promise<void>;
  onGenerateBaseReport: (input: {
    baseDestination: string;
    crewNote: string;
    transmitNow: boolean;
  }) => Promise<void>;
  onGeneratePackage: (incidentId: string) => Promise<void>;
  onSimulateSync: () => Promise<void>;
  onOpenContinuity?: () => void;
  onBackHome: () => void;
  syncFeedback: { ok: boolean; message: string } | null;
  isBusy: boolean;
}

const CATEGORIES = [
  "All",
  "Spaceflight hazards",
  "Cardiovascular and physiological risks",
  "Radiation monitoring",
  "Sleep and astronaut well-being",
  "Fluid shift and eye health",
  "Nutrition and hydration",
  "Space research experiments",
];

export const ReportsLibraryPage: React.FC<ReportsLibraryPageProps> = ({
  baseline,
  latest,
  incidents,
  consultationQueue,
  resources,
  earthWanConnected,
  browserOnline,
  lightDelayMode,
  opsState,
  environmentMode,
  extendedBio,
  storedScansCount,
  voiceMemoCount,
  astronautName,
  missionName,
  consultMessages,
  onChangeLightDelayMode,
  onSendConsultMessage,
  onGenerateBaseReport,
  onGeneratePackage,
  onSimulateSync,
  onOpenContinuity,
  onBackHome,
  syncFeedback,
  isBusy,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [msgText, setMsgText] = useState("");
  const [selectedCaptureId, setSelectedCaptureId] = useState<string>(DIAGNOSTIC_PRESET_CAPTURES[0].id);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [baseDestination, setBaseDestination] = useState<string>(BASE_DESTINATIONS[0]);
  const [crewReportNote, setCrewReportNote] = useState<string>(
    "Completed routine crew health assessment, hydration target, and cabin atmosphere check."
  );

  const [aiQuestion, setAiQuestion] = useState(
    "Summarize my current readings, highlight any spaceflight risks, and suggest safe crew preventive actions."
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{
    modeLabel: string;
    summary: string;
    hazardContext: string;
    suggestedActions: string[];
    whenToEscalate: string;
    citedMetrics: string[];
  } | null>(null);

  const activePkg =
    consultationQueue.find((q) => q.package_id === selectedPackageId) || consultationQueue[0];
  const primaryIncident = incidents[0];
  const lightMeta = LIGHT_DELAY_META[lightDelayMode];
  const envMeta = MISSION_ENVIRONMENT_META[environmentMode];

  const readinessSummary = useMemo(() => {
    const outList: string[] = [];
    let normalCount = 0;
    for (const param of ALL_18_PARAMETERS) {
      const comp = latest.baseline_comparisons[param];
      const meta = PARAMETER_METADATA[param];
      if (!comp || !meta) continue;
      if (comp.outside_p05_p95_band) {
        outList.push(`${meta.shortLabel}: ${comp.current_value.toFixed(meta.decimals)} ${meta.unit}`);
      } else {
        normalCount += 1;
      }
    }
    const openInc = incidents.filter((i) => i.state !== "CLOSED_RETAINED");
    const highAlert = openInc.some((i) => i.severity === "HIGH");
    const glucoseOut =
      extendedBio !== null &&
      (extendedBio.bloodGlucoseMgDl < EXTENDED_BIO_BANDS.bloodGlucoseMgDl.p05 ||
        extendedBio.bloodGlucoseMgDl > EXTENDED_BIO_BANDS.bloodGlucoseMgDl.p95);
    const tempOut =
      extendedBio !== null &&
      (extendedBio.coreTempC < EXTENDED_BIO_BANDS.coreTempC.p05 ||
        extendedBio.coreTempC > EXTENDED_BIO_BANDS.coreTempC.p95);

    const status =
      highAlert || opsState.solarStormActive || outList.length >= 3
        ? { label: "Medical Review Recommended", tone: "amber" as const }
        : openInc.length > 0 || outList.length > 0 || glucoseOut || tempOut
        ? { label: "Advisory Watch — Monitor", tone: "amber" as const }
        : { label: "Nominal — Fit for Duty", tone: "emerald" as const };

    return { normalCount, outList, openAlerts: openInc.length, status };
  }, [latest, incidents, extendedBio, opsState.solarStormActive]);

  const handleRunTriageAssistant = async (promptOverride?: string) => {
    const queryText = (promptOverride || aiQuestion).trim();
    if (promptOverride) setAiQuestion(promptOverride);
    setAiLoading(true);
    setAiError(null);

    const latestMetrics = ALL_18_PARAMETERS.map((param) => {
      const comp = latest.baseline_comparisons[param];
      const metric = baseline.metrics[param];
      const meta = PARAMETER_METADATA[param];
      if (!comp || !metric) return null;
      return {
        parameter: meta.label,
        value: Number(comp.current_value.toFixed(meta.decimals)),
        unit: metric.unit,
        status: comp.outside_p05_p95_band ? "OUTSIDE_PERSONAL_RANGE" : "NORMAL",
        normalRange: `${metric.p05}-${metric.p95} ${metric.unit}`,
      };
    }).filter((m): m is NonNullable<typeof m> => m !== null);

    const activeAlerts = incidents
      .filter((i) => i.state !== "CLOSED_RETAINED")
      .map((i) => ({
        title: i.title,
        severity: i.severity,
        state: i.state,
        ruleId: i.rule_id,
      }));

    try {
      const resp = await fetch("/api/triage-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          astronautName: baseline.full_name,
          missionEnvironment: envMeta.label,
          gravityLabel: envMeta.gravityLabel,
          lightDelayLabel: lightMeta.roundTripText,
          activityMode: opsState.activityMode,
          question: queryText,
          latestMetrics,
          extendedBio: extendedBio
            ? {
                bloodGlucoseMgDl: extendedBio.bloodGlucoseMgDl,
                coreTempC: extendedBio.coreTempC,
                recentScanCount: storedScansCount,
              }
            : { recentScanCount: storedScansCount },
          activeAlerts,
          earthWanConnected,
        }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        error?: string;
        model?: string;
        guidance?: {
          summary?: string;
          hazardContext?: string;
          suggestedActions?: string[];
          whenToEscalate?: string;
          citedMetrics?: string[];
        };
      };

      if (!resp.ok || !data.ok || !data.guidance) {
        throw new Error(data.error || "Onboard AI service returned an error.");
      }

      setAiResult({
        modeLabel: `AI-ASSISTED (${data.model || "gemini-4-hydrogen"}) · PROTOTYPE DECISION SUPPORT`,
        summary: data.guidance.summary || "Telemetry reviewed.",
        hazardContext: data.guidance.hazardContext || envMeta.primaryFocus,
        suggestedActions: Array.isArray(data.guidance.suggestedActions)
          ? data.guidance.suggestedActions
          : [],
        whenToEscalate:
          data.guidance.whenToEscalate ||
          "Escalate to Crew Medical Officer or Ground Flight Surgeon if symptoms worsen.",
        citedMetrics: Array.isArray(data.guidance.citedMetrics) ? data.guidance.citedMetrics : [],
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unable to reach AI triage route.";
      setAiError(errMsg);
      const drifting = latestMetrics.filter((m) => m.status !== "NORMAL");
      setAiResult({
        modeLabel: "LOCAL DETERMINISTIC FALLBACK · PROTOTYPE DECISION SUPPORT",
        summary:
          drifting.length > 0
            ? `${drifting.length} metric(s) are outside ${baseline.full_name}'s 14-day personal band (${drifting
                .map((d) => `${d.parameter}: ${d.value} ${d.unit}`)
                .join(", ")}). Under ${envMeta.shortLabel} conditions, prioritize immediate cabin air & hydration checks while Earth sync recovers.`
            : `All 18 baseline metrics for ${baseline.full_name} are within personal P05–P95 bands in ${envMeta.shortLabel}.`,
        hazardContext: `${envMeta.primaryFocus} (${envMeta.radiationContext})`,
        suggestedActions: [
          envMeta.recommendedCountermeasure,
          "Verify cabin CO2 (mmHg) and ppO2 scrubber capacity on Cabin Air & Radiation.",
          "Log Blood Sugar (mg/dL), Core Temp (°C), and a Voice Observation Memo in Daily Check-In.",
        ],
        whenToEscalate:
          "Notify the Crew Medical Officer and queue a Flight Surgeon report if SpO2 < 95%, Core Temp >= 37.8 °C, or symptoms persist beyond 30 minutes of seated rest.",
        citedMetrics: (drifting.length > 0 ? drifting : latestMetrics.slice(0, 4)).map(
          (m) => `${m.parameter}: ${m.value} ${m.unit}`
        ),
      });
    } finally {
      setAiLoading(false);
    }
  };

  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      const matchesCat =
        selectedCategory === "All" ||
        (res.category && res.category.toLowerCase() === selectedCategory.toLowerCase());
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        res.title.toLowerCase().includes(q) ||
        res.summary.toLowerCase().includes(q) ||
        res.publisher.toLowerCase().includes(q) ||
        res.topic_tags.some((t) => t.toLowerCase().includes(q));
      return matchesCat && matchesQuery;
    });
  }, [resources, selectedCategory, searchQuery]);

  const handleDownload = (format: "json" | "md") => {
    if (!activePkg) return;
    const content =
      format === "json"
        ? JSON.stringify(activePkg.payload, null, 2)
        : activePkg.payload.markdown_report;
    const mime = format === "json" ? "application/json" : "text/markdown";
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activePkg.package_id}_Report.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header & Action Bar */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-full sm:w-44 aspect-[16/10] rounded-xl overflow-hidden border border-white/80 shadow-sm shrink-0">
            <SafeImage
              src={VISUAL_ASSETS.cardEarth}
              alt="Earth horizon telemetry downlink"
              caption="Base Medical Downlink"
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
              Astronaut Health Reports to Base &amp; Library
            </h1>
            <p className="text-sm text-slate-600">
              Compile a full 18-metric crew health report for Base Flight Surgeons, transmit or
              queue offline, export packets, and browse NASA &amp; CSA references.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {primaryIncident && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onGeneratePackage(primaryIncident.incident_id)}
              className="px-3.5 py-2 bg-white/85 hover:bg-white text-slate-800 border border-slate-300/80 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-sky-700" />
              <span>Refresh Alert Report</span>
            </button>
          )}

          <button
            type="button"
            disabled={isBusy}
            onClick={onSimulateSync}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Queue to Base</span>
          </button>

          {activePkg && (
            <>
              <button
                type="button"
                onClick={() => handleDownload("md")}
                className="px-3 py-2 bg-white/85 hover:bg-white text-slate-700 border border-slate-300/80 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export .MD</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownload("json")}
                className="px-3 py-2 bg-white/85 hover:bg-white text-slate-700 border border-slate-300/80 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Export .JSON</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-2 bg-white/85 hover:bg-white text-slate-700 border border-slate-300/80 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / PDF</span>
              </button>
            </>
          )}
        </div>
      </div>

      {syncFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2 ${
            syncFeedback.ok
              ? "bg-emerald-50/90 border-emerald-200 text-emerald-900"
              : "bg-amber-50/90 border-amber-200 text-amber-900"
          }`}
        >
          {syncFeedback.ok ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
          ) : (
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-700" />
          )}
          <span>{syncFeedback.message}</span>
        </div>
      )}

      {/* Astronaut-to-Base Health Report Composer */}
      <div className="glass-panel rounded-2xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-700" />
              <span>Send Astronaut Health Report to Base</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Packages {astronautName}&apos;s live 18-metric baseline status, blood sugar &amp; core
              temp, ECLSS &amp; radiation dose, and saved diagnostics for Base review ({missionName}).
            </p>
          </div>
          <span
            className={`text-xs font-semibold whitespace-nowrap ${
              readinessSummary.status.tone === "emerald" ? "text-emerald-800" : "text-amber-800"
            }`}
          >
            {readinessSummary.status.tone === "emerald" ? "●" : "▲"} {readinessSummary.status.label}
          </span>
        </div>

        {/* Live Telemetry Snapshot Included in Report */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="glass-subtle rounded-xl p-3">
            <div className="text-slate-500">18-Metric Baseline</div>
            <div className="font-mono font-bold text-slate-900 text-sm tabular-nums mt-0.5">
              {readinessSummary.normalCount} / {ALL_18_PARAMETERS.length} Normal
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {readinessSummary.outList.length > 0
                ? `${readinessSummary.outList.length} outside P05–P95`
                : "All within personal band"}
            </div>
          </div>

          <div className="glass-subtle rounded-xl p-3">
            <div className="text-slate-500">Glucose &amp; Core Temp</div>
            <div className="font-mono font-bold text-slate-900 text-sm tabular-nums mt-0.5">
              {extendedBio
                ? `${extendedBio.bloodGlucoseMgDl.toFixed(0)} mg/dL · ${extendedBio.coreTempC.toFixed(1)} °C`
                : "92 mg/dL · 36.8 °C"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {voiceMemoCount} audio memo{voiceMemoCount !== 1 ? "s" : ""} · {storedScansCount} scan
              {storedScansCount !== 1 ? "s" : ""}
            </div>
          </div>

          <div className="glass-subtle rounded-xl p-3">
            <div className="text-slate-500">Radiation &amp; ECLSS</div>
            <div className="font-mono font-bold text-slate-900 text-sm tabular-nums mt-0.5">
              {opsState.cumulativeRadiationMsv.toFixed(1)} / 600 mSv
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              ppO2 {opsState.eclss.ppO2MmHg.toFixed(0)} mmHg · Scrubber {opsState.eclss.scrubberBedPct}%
            </div>
          </div>

          <div className="glass-subtle rounded-xl p-3">
            <div className="text-slate-500">Active Alerts &amp; Link</div>
            <div className="font-mono font-bold text-slate-900 text-sm tabular-nums mt-0.5">
              {readinessSummary.openAlerts} Open Alert{readinessSummary.openAlerts !== 1 ? "s" : ""}
            </div>
            <div
              className={`text-[11px] mt-0.5 font-medium ${
                earthWanConnected && browserOnline ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              {earthWanConnected
                ? `● Base link simulated on (${lightMeta.roundTripText})`
                : "▲ Base link offline (queues safely)"}
              {!browserOnline ? " · Browser offline" : ""}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          Consultation downlink simulation: reports persist in your private Firestore workspace queue
          when browser network is online (no external NASA ground endpoint).
        </p>

        {/* Base Destination + Crew Note Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onGenerateBaseReport({
              baseDestination,
              crewNote: crewReportNote,
              transmitNow: true,
            });
            setSelectedPackageId("");
          }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end text-xs"
        >
          <div className="lg:col-span-4 space-y-1">
            <label htmlFor="base-destination-select" className="block font-medium text-slate-700">
              Receiving Base Station
            </label>
            <select
              id="base-destination-select"
              value={baseDestination}
              onChange={(e) => setBaseDestination(e.target.value)}
              className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
            >
              {BASE_DESTINATIONS.map((dest) => (
                <option key={dest} value={dest}>
                  {dest}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-5 space-y-1">
            <label htmlFor="crew-base-note" className="block font-medium text-slate-700">
              Astronaut Self-Check Note for Base Medical Team
            </label>
            <input
              id="crew-base-note"
              type="text"
              value={crewReportNote}
              onChange={(e) => setCrewReportNote(e.target.value)}
              placeholder="Any symptoms, sleep quality, workload, or EVA notes for Base..."
              className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
            />
          </div>

          <div className="lg:col-span-3 flex flex-wrap sm:flex-nowrap items-center gap-2">
            <button
              type="submit"
              disabled={isBusy}
              className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{earthWanConnected ? "Send Report to Base" : "Queue Report for Base"}</span>
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={async () => {
                await onGenerateBaseReport({
                  baseDestination,
                  crewNote: crewReportNote,
                  transmitNow: false,
                });
                setSelectedPackageId("");
              }}
              title="Save draft to local queue without immediate transmission"
              className="px-3 py-2.5 bg-white/85 hover:bg-white border border-slate-300/80 text-slate-700 font-medium rounded-xl whitespace-nowrap cursor-pointer"
            >
              Save Draft
            </button>
          </div>
        </form>
      </div>

      {/* Sync Queue Table */}
      <div className="glass-panel rounded-2xl p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Saved Base Health Reports, Earth Handoffs &amp; Sync Queue ({consultationQueue.length})
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>
              Click any row to preview, export, or print · Base Link:{" "}
              {earthWanConnected ? "● Online" : "▲ Offline (saved locally)"}
            </span>
            {onOpenContinuity && (
              <button
                type="button"
                onClick={onOpenContinuity}
                className="font-semibold text-sky-800 hover:text-sky-950 cursor-pointer"
              >
                Open Continuity Handoff Builder →
              </button>
            )}
          </div>
        </div>

        {consultationQueue.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            No reports sent yet. Click &ldquo;Send Report to Base&rdquo; above to compile and save a
            complete astronaut health report right now.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Report ID</th>
                  <th className="py-2 px-3 font-medium">Type &amp; Summary</th>
                  <th className="py-2 px-3 font-medium">Created</th>
                  <th className="py-2 px-3 font-medium">Base Sync Status</th>
                  <th className="py-2 pl-3 font-medium">Delivery Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {consultationQueue.map((item) => {
                  const isSelected = activePkg?.package_id === item.package_id;
                  const reportTitle =
                    item.payload?.incident_summary?.title || item.incident_id;
                  return (
                    <tr
                      key={item.package_id}
                      onClick={() => setSelectedPackageId(item.package_id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-sky-50/90 text-slate-900"
                          : "text-slate-700 hover:bg-white/60"
                      }`}
                    >
                      <td className="py-2.5 pr-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {isSelected ? "▶ " : ""}
                        {item.package_id}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 max-w-xs truncate">
                        {item.package_id.startsWith("HANDOFF_") ||
                        item.incident_id.startsWith("CONTINUITY")
                          ? `Earth Handoff Package — ${reportTitle}`
                          : reportTitle}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {item.created_at.replace("T", " ").slice(0, 16)} UTC
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <SyncStatusText status={item.sync_status} />
                      </td>
                      <td className="py-2.5 pl-3 text-slate-600">
                        {item.error_message ||
                          "Saved in private cloud storage and ready for Base Flight Surgeon review."}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Report Preview */}
      {activePkg && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Questions &amp; Summary for Base
              </h3>
              <span className="text-xs text-slate-500 truncate">
                {activePkg.payload.astronaut_profile.full_name}
              </span>
            </div>
            <div className="glass-subtle rounded-xl p-3 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">
                {activePkg.payload.incident_summary.title}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {activePkg.payload.astronaut_profile.mission}
              </div>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-700 list-disc pl-4">
              {activePkg.payload.flight_surgeon_questions.map((q, idx) => (
                <li key={idx} className="leading-relaxed">
                  {q}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-7 glass-panel rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Full Base Health Report Preview ({activePkg.package_id})
              </h3>
              <span className="text-xs font-mono text-slate-500">{activePkg.package_id}.md</span>
            </div>
            <pre className="glass-subtle rounded-xl p-4 text-xs font-mono text-slate-700 overflow-x-auto max-h-96 whitespace-pre-wrap leading-relaxed">
              {activePkg.payload.markdown_report}
            </pre>
          </div>
        </div>
      )}

      {/* Onboard Autonomous AI Triage & Self-Assessment Helper */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-sky-700" />
              <span>Autonomous Crew Health Triage Helper (Delay / Offline Support)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              When {lightMeta.label} signal delay ({lightMeta.roundTripText}) delays Earth guidance,
              summarize your verified metrics and NASA 5-hazard context locally.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
            Prototype Decision Support
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            "Explain any outside-range readings and what I should do right now.",
            "Assess SANS eye fluid shift and cabin CO2 risks in my current environment.",
            "What warning signs mean I need urgent Flight Surgeon escalation?",
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={aiLoading}
              onClick={() => void handleRunTriageAssistant(preset)}
              className="px-3 py-1.5 bg-white/80 hover:bg-white border border-slate-200/80 rounded-xl text-slate-700 cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleRunTriageAssistant();
          }}
          className="flex flex-col sm:flex-row gap-2 text-xs"
        >
          <input
            type="text"
            aria-label="Ask onboard health triage helper"
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            className="flex-1 bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
          />
          <button
            type="submit"
            disabled={aiLoading}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold rounded-xl cursor-pointer whitespace-nowrap"
          >
            {aiLoading ? "Analyzing Telemetry..." : "Analyze My Readings"}
          </button>
        </form>

        {aiError && (
          <div className="text-xs text-amber-800 bg-amber-50/90 border border-amber-200 rounded-xl px-3 py-2">
            {aiError} — Showing deterministic onboard safety summary below.
          </div>
        )}

        {aiResult && (
          <div className="glass-subtle rounded-2xl p-5 space-y-3 text-xs">
            <div className="text-[11px] font-mono font-semibold text-sky-800">
              {aiResult.modeLabel}
            </div>
            <p className="text-sm text-slate-900 leading-relaxed font-medium">{aiResult.summary}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <div className="font-semibold text-slate-900">Recommended Crew Actions</div>
                <ul className="list-disc pl-4 space-y-1 text-slate-700">
                  {aiResult.suggestedActions.map((act) => (
                    <li key={act}>{act}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="font-semibold text-slate-900">Spaceflight Hazard Context</div>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">{aiResult.hazardContext}</p>
                </div>
                <div>
                  <div className="font-semibold text-amber-900">When to Contact Ground / CMO</div>
                  <p className="text-amber-800 mt-0.5 leading-relaxed">{aiResult.whenToEscalate}</p>
                </div>
              </div>
            </div>
            {aiResult.citedMetrics.length > 0 && (
              <div className="pt-2 border-t border-slate-200/70 text-[11px] font-mono text-slate-600">
                Cited Telemetry: {aiResult.citedMetrics.join(" · ")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Two-Way Asynchronous Earth Flight Surgeon Thread + Diagnostic Attachments */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-sky-700" />
              <span>Two-Way Flight Surgeon Consultation &amp; Diagnostic Captures</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Signal latency ({lightMeta.label}): {lightMeta.roundTripText}. Attach fundoscope,
              ECG, or ultrasound captures for Ground Flight Surgeon review.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {(Object.keys(LIGHT_DELAY_META) as LightDelayMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={isBusy}
                onClick={() => onChangeLightDelayMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl border cursor-pointer whitespace-nowrap ${
                  lightDelayMode === mode
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white/75 text-slate-700 border-slate-200 hover:bg-white"
                }`}
              >
                {LIGHT_DELAY_META[mode].label.split(" (")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Thread History */}
        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {consultMessages.map((msg) => {
            const isGround = String(msg.payload.sender || "") === "EARTH_FLIGHT_SURGEON";
            const attachLabel = String(msg.payload.attachmentLabel || "");
            return (
              <div
                key={msg.recordId}
                className={`rounded-xl p-3.5 text-xs border ${
                  isGround
                    ? "bg-sky-50/90 border-sky-200 text-slate-900"
                    : "bg-white/85 border-slate-200 text-slate-900"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-800">
                    {String(msg.payload.senderName || (isGround ? "Ground Flight Surgeon" : baseline.full_name))}
                  </span>
                  <span className="font-mono">
                    {msg.timestampIso.replace("T", " ").slice(0, 16)} UTC · {msg.status}
                  </span>
                </div>
                <p className="mt-1 leading-relaxed text-slate-700">{String(msg.payload.body || "")}</p>
                {attachLabel && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-800 bg-white/80 border border-sky-200 rounded-lg px-2.5 py-1">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Attached Diagnostic: {attachLabel}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!msgText.trim()) return;
            const preset = DIAGNOSTIC_PRESET_CAPTURES.find((c) => c.id === selectedCaptureId);
            const attachmentLabel = uploadedFileName
              ? `Local Capture: ${uploadedFileName}`
              : preset
              ? preset.label
              : "";
            await onSendConsultMessage({
              body: msgText.trim(),
              attachmentLabel,
              attachmentKind: uploadedFileName ? "UPLOADED_IMAGE" : preset?.svgPreviewKind || "",
              requestGroundReply: earthWanConnected,
            });
            setMsgText("");
            setUploadedFileName("");
          }}
          className="pt-3 border-t border-slate-200/70 space-y-3 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Diagnostic Capture Attachment"
              value={selectedCaptureId}
              onChange={(e) => setSelectedCaptureId(e.target.value)}
              className="bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
            >
              <option value="">No preset capture attached</option>
              {DIAGNOSTIC_PRESET_CAPTURES.map((cap) => (
                <option key={cap.id} value={cap.id}>
                  Attach: {cap.label}
                </option>
              ))}
            </select>

            <label className="px-3 py-2 bg-white/85 hover:bg-white border border-slate-300/80 rounded-xl text-slate-700 font-medium cursor-pointer inline-flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-sky-700" />
              <span>{uploadedFileName ? uploadedFileName : "Upload Image / Strip"}</span>
              <input
                type="file"
                accept="image/*,.csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setUploadedFileName(file.name);
                }}
              />
            </label>
          </div>

          {(() => {
            const activePreset = DIAGNOSTIC_PRESET_CAPTURES.find((c) => c.id === selectedCaptureId);
            if (!activePreset || uploadedFileName) return null;
            return (
              <div className="glass-subtle rounded-xl p-2.5 flex items-center gap-3">
                <div className="w-20 aspect-[4/3] rounded-lg overflow-hidden border border-white/80 shrink-0">
                  <SafeImage
                    src={PRESET_CAPTURE_THUMB[activePreset.svgPreviewKind]}
                    alt={activePreset.label}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {activePreset.label}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                    {activePreset.summary}
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              aria-label="Message for Flight Surgeon"
              type="text"
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder="Write note or symptom update for Earth Flight Surgeon..."
              className="flex-1 bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
            />
            <button
              type="submit"
              disabled={isBusy || !msgText.trim()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{earthWanConnected ? "Send & Request Reply" : "Queue Offline Note"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Curated NASA & CSA Space Health Library */}
      <div className="space-y-4 pt-2">
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-700" />
                <h2 className="text-base font-semibold text-slate-900">
                  Offline Space Health Reference Library ({resources.length} NASA &amp; CSA Guides)
                </h2>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Research &amp; Educational Literature Only — separate from approved onboard emergency and clinical procedures.
              </p>
            </div>
            {!earthWanConnected && (
              <span className="text-xs text-amber-700 font-medium inline-flex items-center gap-1">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Available offline locally</span>
              </span>
            )}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              aria-label="Search Space Health Library"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics (e.g., radiation, sleep, vision, nutrition)..."
              className="w-full bg-white/85 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white/75 text-slate-600 border-slate-200/80 hover:bg-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredResources.map((res) => (
            <article
              key={res.resource_id}
              className="glass-panel rounded-2xl p-5 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="text-xs text-slate-500">
                  {res.publisher} · {res.publication_date}
                </div>
                <h3 className="text-sm font-semibold text-slate-900 leading-snug">{res.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{res.summary}</p>
              </div>

              <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 truncate">{res.evidence_note}</span>
                <a
                  href={res.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-800 hover:text-sky-950 font-medium inline-flex items-center gap-1 shrink-0"
                >
                  <span>Source</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};
