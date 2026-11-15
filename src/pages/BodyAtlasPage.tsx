import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Compass,
  HeartPulse,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";
import {
  BaselineProfile,
  IncidentRecord,
  PARAMETER_METADATA,
  TelemetryLatestResponse,
} from "../types/aegisContracts";
import { PageId } from "../types/navigation";
import {
  BODY_SYSTEM_ATLAS,
  BodyRegionId,
  EXTENDED_BIO_BANDS,
  ExtendedBioSummary,
  HazardId,
  MISSION_ENVIRONMENT_META,
  MissionEnvironmentId,
  NASA_FIVE_HAZARDS,
  OpsStateDoc,
} from "../types/opsContracts";
import { SafeImage } from "../components/SafeImage";
import { VISUAL_ASSETS } from "../assets/visualCatalog";
import { CuratedReferencesStrip } from "../components/CuratedReferencesStrip";

interface BodyAtlasPageProps {
  baseline: BaselineProfile;
  latest: TelemetryLatestResponse;
  incidents: IncidentRecord[];
  opsState: OpsStateDoc;
  environmentMode: MissionEnvironmentId;
  extendedBio: ExtendedBioSummary | null;
  scanCountByRegion: Partial<Record<BodyRegionId, number>>;
  onChangeEnvironment: (env: MissionEnvironmentId) => Promise<void>;
  onNavigate: (page: PageId) => void;
  onBackHome: () => void;
  isBusy: boolean;
}

type RegionHealthStatus = "NOMINAL" | "WATCH" | "ATTENTION";

interface RegionAssessment {
  status: RegionHealthStatus;
  outsideCount: number;
  metrics: Array<{ label: string; valueText: string; isOut: boolean }>;
}

export const BodyAtlasPage: React.FC<BodyAtlasPageProps> = ({
  baseline,
  latest,
  incidents,
  opsState,
  environmentMode,
  extendedBio,
  scanCountByRegion,
  onChangeEnvironment,
  onNavigate,
  onBackHome,
  isBusy,
}) => {
  const [selectedRegionId, setSelectedRegionId] = useState<BodyRegionId>("eyes");
  const [selectedHazardId, setSelectedHazardId] = useState<HazardId>("GRAVITY");

  const envMeta = MISSION_ENVIRONMENT_META[environmentMode];
  const openIncidents = incidents.filter((i) => i.state !== "CLOSED_RETAINED");

  const assessments = useMemo(() => {
    const map = {} as Record<BodyRegionId, RegionAssessment>;

    for (const region of BODY_SYSTEM_ATLAS) {
      const metrics: Array<{ label: string; valueText: string; isOut: boolean }> = [];
      let outsideCount = 0;

      for (const param of region.linkedParameters) {
        const comp = latest.baseline_comparisons[param];
        const meta = PARAMETER_METADATA[param];
        if (!comp || !meta) continue;
        const isOut = comp.outside_p05_p95_band;
        if (isOut) outsideCount += 1;
        metrics.push({
          label: meta.label,
          valueText: `${comp.current_value.toFixed(meta.decimals)} ${meta.unit}`,
          isOut,
        });
      }

      if (region.usesBloodSugar && extendedBio) {
        const val = extendedBio.bloodGlucoseMgDl;
        const band = EXTENDED_BIO_BANDS.bloodGlucoseMgDl;
        const isOut = val < band.p05 || val > band.p95;
        if (isOut) outsideCount += 1;
        metrics.push({
          label: band.label,
          valueText: `${val.toFixed(0)} ${band.unit}`,
          isOut,
        });
      }

      if (region.usesCoreTemp && extendedBio) {
        const val = extendedBio.coreTempC;
        const band = EXTENDED_BIO_BANDS.coreTempC;
        const isOut = val < band.p05 || val > band.p95;
        if (isOut) outsideCount += 1;
        metrics.push({
          label: band.label,
          valueText: `${val.toFixed(1)} ${band.unit}`,
          isOut,
        });
      }

      if (region.usesRadiation) {
        const radOut = opsState.solarStormActive || opsState.cumulativeRadiationMsv >= 400;
        if (radOut) outsideCount += 1;
        metrics.push({
          label: "Cumulative Mission Dose",
          valueText: `${opsState.cumulativeRadiationMsv.toFixed(1)} / 600 mSv`,
          isOut: radOut,
        });
      }

      let status: RegionHealthStatus = "NOMINAL";
      if (outsideCount >= 2 || (region.regionId === "skin_immune" && opsState.solarStormActive)) {
        status = "ATTENTION";
      } else if (outsideCount === 1) {
        status = "WATCH";
      }

      map[region.regionId] = {
        status,
        outsideCount,
        metrics,
      };
    }

    return map;
  }, [latest, extendedBio, opsState.solarStormActive, opsState.cumulativeRadiationMsv]);

  const selectedRegion =
    BODY_SYSTEM_ATLAS.find((r) => r.regionId === selectedRegionId) || BODY_SYSTEM_ATLAS[0];
  const selectedAssessment = assessments[selectedRegion.regionId];
  const selectedHazard =
    NASA_FIVE_HAZARDS.find((h) => h.id === selectedHazardId) || NASA_FIVE_HAZARDS[0];

  const getRegionColors = (regionId: BodyRegionId) => {
    const st = assessments[regionId]?.status || "NOMINAL";
    const isSelected = selectedRegionId === regionId;
    if (st === "ATTENTION") {
      return {
        fill: isSelected ? "#fecdd3" : "#ffe4e6",
        stroke: "#be123c",
        textCls: "text-rose-700",
        label: "✖ Attention",
      };
    }
    if (st === "WATCH") {
      return {
        fill: isSelected ? "#fde68a" : "#fef3c7",
        stroke: "#b45309",
        textCls: "text-amber-700",
        label: "▲ Watch",
      };
    }
    return {
      fill: isSelected ? "#bae6fd" : "#e0f2fe",
      stroke: isSelected ? "#0369a1" : "#0284c7",
      textCls: "text-emerald-700",
      label: "● Normal",
    };
  };

  return (
    <div className="space-y-6">
      {/* Header & Mission Environment Bar */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-full sm:w-44 aspect-[16/10] rounded-xl overflow-hidden border border-white/80 shadow-sm shrink-0">
              <SafeImage
                src={
                  environmentMode === "LUNAR_BASE" || environmentMode === "MARS_ROVER"
                    ? VISUAL_ASSETS.envHabitat
                    : environmentMode === "TRANSIT_SPACECRAFT"
                    ? VISUAL_ASSETS.cardEarth
                    : VISUAL_ASSETS.bodyAtlas
                }
                alt={`${envMeta.label} crew body health atlas`}
                caption={envMeta.shortLabel}
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
                Interactive Crew Body Map &amp; NASA 5 Hazards
              </h1>
              <p className="text-sm text-slate-600">
                Click any body system on the anatomical diagram to understand what is measured, why
                spaceflight affects it, and what preventive steps to take.
              </p>
            </div>
          </div>

          <div className="glass-subtle rounded-xl px-4 py-3 text-xs space-y-1 shrink-0">
            <div className="text-slate-500">Active Environment · {envMeta.gravityLabel}</div>
            <div className="font-semibold text-slate-900">{envMeta.label}</div>
            <div className="text-slate-600">Earth link: {envMeta.earthDelayLabel}</div>
          </div>
        </div>

        {/* Mission Environment Switcher */}
        <div className="pt-3 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(MISSION_ENVIRONMENT_META) as MissionEnvironmentId[]).map((envKey) => {
              const item = MISSION_ENVIRONMENT_META[envKey];
              const active = environmentMode === envKey;
              return (
                <button
                  key={envKey}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onChangeEnvironment(envKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white/75 text-slate-700 border-slate-200 hover:bg-white"
                  }`}
                >
                  {item.shortLabel}
                </button>
              );
            })}
          </div>
          <span className="text-xs text-slate-600">
            Focus: <strong className="font-medium text-slate-900">{envMeta.primaryFocus}</strong>
          </span>
        </div>
      </div>

      {/* Interactive Anatomical SVG Body Atlas + Clinical Explanation Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Interactive SVG Body Diagram + Accessible Region Buttons */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-sky-700" />
                <span>Crew Body System Status</span>
              </h2>
              <p className="text-xs text-slate-500">
                Live status for {baseline.full_name} · Click a body region
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-500">7 Systems</span>
          </div>

          <div className="glass-subtle rounded-2xl p-4 flex items-center justify-center relative">
            <svg
              viewBox="0 0 280 430"
              className="w-full max-w-[260px] h-auto select-none"
              role="img"
              aria-label="Interactive astronaut anatomical body map"
            >
              {/* Subtle calibration grid */}
              <defs>
                <pattern id="atlasGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path
                    d="M 20 0 L 0 0 0 20"
                    fill="none"
                    stroke="rgba(148,163,184,0.18)"
                    strokeWidth="0.7"
                  />
                </pattern>
              </defs>
              <rect x="0" y="0" width="280" height="430" rx="14" fill="url(#atlasGrid)" />

              {/* Neutral human anatomical silhouette */}
              <g fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.6">
                {/* Head & Neck */}
                <circle cx="140" cy="48" r="27" />
                <rect x="130" y="74" width="20" height="16" rx="4" />
                {/* Torso */}
                <path d="M 94 94 Q 140 86 186 94 L 195 150 L 182 232 Q 140 242 98 232 L 85 150 Z" />
                {/* Arms */}
                <path d="M 92 98 L 62 158 L 52 224 Q 50 232 58 234 Q 67 236 70 225 L 82 166 L 94 132 Z" />
                <path d="M 188 98 L 218 158 L 228 224 Q 230 232 222 234 Q 213 236 210 225 L 198 166 L 186 132 Z" />
                {/* Legs */}
                <path d="M 101 232 L 95 322 L 91 398 Q 91 407 103 407 Q 114 407 115 398 L 125 320 L 136 238 Z" />
                <path d="M 179 232 L 185 322 L 189 398 Q 189 407 177 407 Q 166 407 165 398 L 155 320 L 144 238 Z" />
              </g>

              {/* Clickable Hotspots */}
              {/* 1. Brain */}
              <g
                onClick={() => setSelectedRegionId("brain")}
                className="cursor-pointer transition-opacity hover:opacity-90"
                role="button"
                tabIndex={0}
                aria-label="Inspect Brain and Neurovestibular system"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedRegionId("brain");
                }}
              >
                <ellipse
                  cx="140"
                  cy="38"
                  rx="18"
                  ry="11"
                  fill={getRegionColors("brain").fill}
                  stroke={getRegionColors("brain").stroke}
                  strokeWidth={selectedRegionId === "brain" ? "2.6" : "1.8"}
                />
                <text
                  x="140"
                  y="41"
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="700"
                  fill="#0f172a"
                >
                  BRAIN
                </text>
              </g>

              {/* 2. Eyes (SANS) */}
              <g
                onClick={() => setSelectedRegionId("eyes")}
                className="cursor-pointer transition-opacity hover:opacity-90"
                role="button"
                tabIndex={0}
                aria-label="Inspect Eyes and SANS fluid shift"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedRegionId("eyes");
                }}
              >
                <rect
                  x="119"
                  y="51"
                  width="42"
                  height="13"
                  rx="6.5"
                  fill={getRegionColors("eyes").fill}
                  stroke={getRegionColors("eyes").stroke}
                  strokeWidth={selectedRegionId === "eyes" ? "2.6" : "1.8"}
                />
                <circle cx="131" cy="57.5" r="2.8" fill="#0f172a" />
                <circle cx="149" cy="57.5" r="2.8" fill="#0f172a" />
              </g>

              {/* 3. Lungs & Airway */}
              <g
                onClick={() => setSelectedRegionId("lungs")}
                className="cursor-pointer transition-opacity hover:opacity-90"
                role="button"
                tabIndex={0}
                aria-label="Inspect Lungs and Respiratory Exchange"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedRegionId("lungs");
                }}
              >
                <path
                  d="M 106 112 Q 112 102 128 106 L 130 148 Q 112 152 102 142 Z"
                  fill={getRegionColors("lungs").fill}
                  stroke={getRegionColors("lungs").stroke}
                  strokeWidth={selectedRegionId === "lungs" ? "2.6" : "1.8"}
                />
                <path
                  d="M 174 112 Q 168 102 152 106 L 150 148 Q 168 152 178 142 Z"
                  fill={getRegionColors("lungs").fill}
                  stroke={getRegionColors("lungs").stroke}
                  strokeWidth={selectedRegionId === "lungs" ? "2.6" : "1.8"}
                />
              </g>

              {/* 4. Heart */}
              <g
                onClick={() => setSelectedRegionId("heart")}
                className="cursor-pointer transition-opacity hover:opacity-90"
                role="button"
                tabIndex={0}
                aria-label="Inspect Heart and Cardiovascular system"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedRegionId("heart");
                }}
              >
                <circle
                  cx="145"
                  cy="132"
                  r="15"
                  fill={getRegionColors("heart").fill}
                  stroke={getRegionColors("heart").stroke}
                  strokeWidth={selectedRegionId === "heart" ? "2.8" : "1.8"}
                />
                <text
                  x="145"
                  y="135"
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="700"
                  fill="#0f172a"
                >
                  HEART
                </text>
              </g>

              {/* 5. Kidneys & Fluids */}
              <g
                onClick={() => setSelectedRegionId("kidneys_fluids")}
                className="cursor-pointer transition-opacity hover:opacity-90"
                role="button"
                tabIndex={0}
                aria-label="Inspect Kidneys and Hydration Balance"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedRegionId("kidneys_fluids");
                }}
              >
                <rect
                  x="110"
                  y="174"
                  width="60"
                  height="26"
                  rx="10"
                  fill={getRegionColors("kidneys_fluids").fill}
                  stroke={getRegionColors("kidneys_fluids").stroke}
                  strokeWidth={selectedRegionId === "kidneys_fluids" ? "2.6" : "1.8"}
                />
                <text
                  x="140"
                  y="190"
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="700"
                  fill="#0f172a"
                >
                  FLUIDS / RENAL
                </text>
              </g>

              {/* 6. Skin & Immune (Right Arm Sensor Cuff Hotspot) */}
              <g
                onClick={() => setSelectedRegionId("skin_immune")}
                className="cursor-pointer transition-opacity hover:opacity-90"
                role="button"
                tabIndex={0}
                aria-label="Inspect Skin, Core Temp, and Radiation Immune Defense"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedRegionId("skin_immune");
                }}
              >
                <rect
                  x="194"
                  y="152"
                  width="32"
                  height="42"
                  rx="9"
                  fill={getRegionColors("skin_immune").fill}
                  stroke={getRegionColors("skin_immune").stroke}
                  strokeWidth={selectedRegionId === "skin_immune" ? "2.6" : "1.8"}
                />
                <text
                  x="210"
                  y="176"
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="700"
                  fill="#0f172a"
                >
                  SKIN
                </text>
              </g>

              {/* 7. Bones & Muscle (Left Femur & Thigh Cuff Hotspot) */}
              <g
                onClick={() => setSelectedRegionId("bones_muscle")}
                className="cursor-pointer transition-opacity hover:opacity-90"
                role="button"
                tabIndex={0}
                aria-label="Inspect Bones, Muscle, and Metabolic Fuel"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedRegionId("bones_muscle");
                }}
              >
                <rect
                  x="96"
                  y="258"
                  width="34"
                  height="74"
                  rx="11"
                  fill={getRegionColors("bones_muscle").fill}
                  stroke={getRegionColors("bones_muscle").stroke}
                  strokeWidth={selectedRegionId === "bones_muscle" ? "2.6" : "1.8"}
                />
                <rect
                  x="150"
                  y="258"
                  width="34"
                  height="74"
                  rx="11"
                  fill={getRegionColors("bones_muscle").fill}
                  stroke={getRegionColors("bones_muscle").stroke}
                  strokeWidth={selectedRegionId === "bones_muscle" ? "2.6" : "1.8"}
                />
                <text
                  x="113"
                  y="298"
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="700"
                  fill="#0f172a"
                >
                  BONE
                </text>
                <text
                  x="167"
                  y="298"
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="700"
                  fill="#0f172a"
                >
                  MUSCLE
                </text>
              </g>
            </svg>
          </div>

          {/* Accessible Quick-Select Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
            {BODY_SYSTEM_ATLAS.map((reg) => {
              const info = getRegionColors(reg.regionId);
              const isSelected = selectedRegionId === reg.regionId;
              return (
                <button
                  key={reg.regionId}
                  type="button"
                  onClick={() => setSelectedRegionId(reg.regionId)}
                  className={`px-3 py-2 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-sky-50/95 border-sky-400 text-slate-900"
                      : "bg-white/70 border-slate-200/80 hover:bg-white text-slate-700"
                  }`}
                >
                  <div className="font-semibold text-slate-900 truncate">{reg.shortLabel}</div>
                  <div className={`text-[11px] font-medium ${info.textCls}`}>{info.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Plain-English Assessment for Selected Organ/System */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 flex flex-col justify-between gap-5">
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200/70">
              <div>
                <div className="text-xs text-slate-500">
                  Selected Body System · {selectedRegion.hazardsInvolved.join(" / ")}
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">{selectedRegion.name}</h2>
                <p className="text-xs text-slate-600 mt-1">{selectedRegion.spaceCondition}</p>
              </div>
              <div className="text-right">
                <div
                  className={`text-xs font-semibold ${
                    getRegionColors(selectedRegion.regionId).textCls
                  }`}
                >
                  {getRegionColors(selectedRegion.regionId).label}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  {scanCountByRegion[selectedRegion.regionId] || 0} saved scan(s)
                </div>
              </div>
            </div>

            {/* Live Measurements Grid */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-800">
                Live Measurements Evaluating This System
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedAssessment.metrics.map((m) => (
                  <div
                    key={m.label}
                    className={`rounded-xl p-3 border text-xs flex items-center justify-between gap-2 ${
                      m.isOut
                        ? "bg-amber-50/80 border-amber-200 text-amber-950"
                        : "bg-white/75 border-slate-200/80 text-slate-900"
                    }`}
                  >
                    <span className="text-slate-600 truncate">{m.label}</span>
                    <span className="font-mono font-semibold tabular-nums whitespace-nowrap">
                      {m.valueText}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Challenge Q&A Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="glass-subtle rounded-xl p-4 space-y-1.5">
                <h3 className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-sky-700" />
                  <span>Why Is This Exam Needed in Space?</span>
                </h3>
                <p className="text-slate-600 leading-relaxed">{selectedRegion.whyExamNeeded}</p>
              </div>

              <div className="glass-subtle rounded-xl p-4 space-y-1.5">
                <h3 className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                  <span>When to Contact Ground / CMO</span>
                </h3>
                <p className="text-slate-600 leading-relaxed">{selectedRegion.whenToEscalate}</p>
              </div>
            </div>

            <div className="bg-sky-50/80 border border-sky-200/80 rounded-xl p-4 text-xs space-y-1">
              <div className="font-semibold text-sky-950">Recommended Preventive Crew Action</div>
              <p className="text-sky-900 leading-relaxed">{selectedRegion.preventiveAction}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {openIncidents.length > 0
                ? `▲ ${openIncidents.length} active alert(s) in Alerts & Response`
                : "● Prototype decision-support guide"}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate("reports-library")}
                className="px-3.5 py-2 bg-white/85 hover:bg-white border border-slate-300/80 text-slate-800 rounded-xl text-xs font-medium cursor-pointer whitespace-nowrap"
              >
                Ask AI Flight Helper
              </button>
              <button
                type="button"
                onClick={() => onNavigate(selectedRegion.recommendedPage)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <span>{selectedRegion.recommendedActionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* NASA 5 Hazards of Human Spaceflight Explorer */}
      <section className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Compass className="w-4 h-4 text-sky-700" />
              <span>NASA Human Research Program: 5 Hazards of Human Spaceflight</span>
            </h2>
            <p className="text-xs text-slate-500">
              Explore how each spaceflight hazard affects crew biology and jump straight to the
              matching AEGIS-V monitoring control.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {NASA_FIVE_HAZARDS.map((hz) => {
            const active = selectedHazardId === hz.id;
            return (
              <button
                key={hz.id}
                type="button"
                onClick={() => setSelectedHazardId(hz.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white/75 text-slate-700 border-slate-200 hover:bg-white"
                }`}
              >
                {hz.title}
              </button>
            );
          })}
        </div>

        <div className="glass-subtle rounded-2xl p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start text-xs">
          <div className="lg:col-span-5 space-y-2">
            <h3 className="text-base font-semibold text-slate-900">{selectedHazard.title}</h3>
            <p className="text-slate-600 leading-relaxed">{selectedHazard.plainSummary}</p>
            <div className="pt-2 flex flex-wrap items-center gap-2">
              {selectedHazard.affectedBodyRegions.map((regId) => {
                const reg = BODY_SYSTEM_ATLAS.find((b) => b.regionId === regId);
                if (!reg) return null;
                return (
                  <button
                    key={regId}
                    type="button"
                    onClick={() => setSelectedRegionId(regId)}
                    className="px-2.5 py-1 bg-white border border-sky-200 hover:border-sky-400 text-sky-900 rounded-lg font-medium cursor-pointer"
                  >
                    Highlight {reg.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-1.5">
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>Health Risks</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-600">
              {selectedHazard.keyHealthEffects.map((ef) => (
                <li key={ef}>{ef}</li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3 space-y-3">
            <div className="space-y-1">
              <div className="font-semibold text-slate-900">Indicators Tracked</div>
              <ul className="space-y-1 text-slate-600">
                {selectedHazard.monitoredIndicators.map((ind) => (
                  <li key={ind}>· {ind}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(selectedHazard.targetPage)}
              className="w-full px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>{selectedHazard.actionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      <CuratedReferencesStrip
        title={`Linked Research for ${selectedRegion.shortLabel} & ${selectedHazard.title}`}
        topicTags={(() => {
          const regionTagMap: Record<string, string[]> = {
            brain: ["sleep", "behavioural", "isolation"],
            eyes: ["vision", "fluid_shift"],
            lungs: ["environment", "cardiovascular"],
            heart: ["cardiovascular", "countermeasures"],
            kidneys_fluids: ["hydration", "nutrition", "fluid_shift"],
            skin_immune: ["radiation", "dosimetry"],
            bones_muscle: ["bone_muscle", "countermeasures", "microgravity"],
          };
          const hazardTagMap: Record<string, string[]> = {
            RADIATION: ["radiation", "dosimetry"],
            ISOLATION: ["isolation", "behavioural", "sleep"],
            DISTANCE: ["general_hazards", "countermeasures"],
            GRAVITY: ["gravity", "fluid_shift", "vision", "bone_muscle"],
            HOSTILE_ENVIRONMENT: ["environment", "radiation", "general_hazards"],
          };
          return Array.from(
            new Set([
              ...(regionTagMap[selectedRegion.regionId] || []),
              ...(hazardTagMap[selectedHazard.id] || []),
            ])
          );
        })()}
      />
    </div>
  );
};
