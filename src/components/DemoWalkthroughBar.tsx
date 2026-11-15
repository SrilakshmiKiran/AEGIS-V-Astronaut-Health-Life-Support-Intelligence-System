import React, { useState } from "react";
import { Play, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle } from "lucide-react";
import { DemoSceneId } from "../types/aegisContracts";

interface DemoWalkthroughBarProps {
  activeScene: DemoSceneId;
  onActivateScene: (sceneId: DemoSceneId) => Promise<void>;
  isLoading: boolean;
  statusMessage: string | null;
}

const DEMO_SCENES: Array<{
  id: DemoSceneId;
  number: number;
  shortTitle: string;
  subtitle: string;
  requiresCmoPin?: boolean;
}> = [
  {
    id: "SCENE_1_NORMAL",
    number: 1,
    shortTitle: "NORMAL",
    subtitle: "Nominal 18-param readings & baseline",
  },
  {
    id: "SCENE_2_GRADUAL_ANOMALY",
    number: 2,
    shortTitle: "GRADUAL ANOMALY",
    subtitle: "45m CO2/SpO2 shift + 3d HRP & Quarantine",
  },
  {
    id: "SCENE_3_EXPLAIN",
    number: 3,
    shortTitle: "EXPLAIN",
    subtitle: "7-part evidence & NASA/CSA citations",
  },
  {
    id: "SCENE_4_EARTH_UNAVAILABLE",
    number: 4,
    shortTitle: "EARTH UNAVAILABLE",
    subtitle: "Disconnect WAN — full local continuity",
  },
  {
    id: "SCENE_5_RESPONSE_FOLLOWUP",
    number: 5,
    shortTitle: "RESPONSE FOLLOW-UP",
    subtitle: "Record PROC-ENV-CO2-01 & IMPROVING trend",
    requiresCmoPin: true,
  },
  {
    id: "SCENE_6_CONNECTIVITY_RESTORED",
    number: 6,
    shortTitle: "CONNECTIVITY RESTORED",
    subtitle: "Close incident & sync PENDING → SYNCED",
    requiresCmoPin: true,
  },
  {
    id: "SCENE_7_CONTINUITY_CMO_UNAVAILABLE",
    number: 7,
    shortTitle: "CMO UNAVAILABLE",
    subtitle: "Earth off & CMO off — crew Continuity workflow",
  },
];

export const DemoWalkthroughBar: React.FC<DemoWalkthroughBarProps> = ({
  activeScene,
  onActivateScene,
  isLoading,
  statusMessage,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-[#0f172a] border-t border-slate-800 px-4 py-2 shrink-0 z-30">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-cyan-400 uppercase tracking-wider">
            <Play className="w-3.5 h-3.5" />
            7-Scene Demo Simulator
          </span>
          {statusMessage && (
            <span className="text-xs font-mono text-slate-300 truncate max-w-xl">
              · {statusMessage}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          className="inline-flex items-center gap-1 text-xs font-mono text-slate-400 hover:text-slate-200 px-2 py-1 rounded border border-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <span>{collapsed ? "Expand Simulator Bar" : "Collapse Bar"}</span>
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mt-2">
          {DEMO_SCENES.map((scene) => {
            const isActive = activeScene === scene.id;
            return (
              <button
                key={scene.id}
                type="button"
                disabled={isLoading}
                onClick={() => onActivateScene(scene.id)}
                className={`text-left p-2 rounded border transition-colors flex flex-col justify-between ${
                  isActive
                    ? "bg-cyan-950/60 border-cyan-500/70 text-slate-100"
                    : "bg-[#111827] border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="text-[11px] font-mono font-semibold tracking-tight text-cyan-400 whitespace-nowrap">
                    Scene {scene.number}: {scene.shortTitle}
                  </span>
                  {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                  {scene.subtitle}
                </div>
                {scene.requiresCmoPin && (
                  <div className="text-[10px] font-mono text-amber-400/90 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                    <span>Requires CMO + PIN 2026</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
