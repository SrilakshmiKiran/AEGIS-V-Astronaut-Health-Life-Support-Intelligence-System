import React from "react";
import { ShieldAlert, Server } from "lucide-react";
import { PROTOTYPE_DISCLAIMER, SCHEMA_VERSION } from "../types/aegisContracts";
import { BackendConnectionMode } from "../services/apiClient";

interface PrototypeSafetyBannerProps {
  connectionMode: BackendConnectionMode;
}

export const PrototypeSafetyBanner: React.FC<PrototypeSafetyBannerProps> = ({
  connectionMode,
}) => {
  return (
    <div className="bg-slate-900/95 border-b border-slate-800 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2 text-amber-300/95">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
        <span className="font-medium">{PROTOTYPE_DISCLAIMER}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
        <span>SCHEMA: {SCHEMA_VERSION}</span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5">
          <Server className="w-3 h-3 text-cyan-400" />
          {connectionMode === "LIVE_LOCAL_BACKEND" ? (
            <span className="text-emerald-300">
              SOURCE: LIVE_LOCAL_BACKEND (127.0.0.1:8000 SQLite)
            </span>
          ) : (
            <span className="text-cyan-300">
              SOURCE: CLOUD_PREVIEW_IN_MEMORY_FALLBACK (127.0.0.1:8000 Offline)
            </span>
          )}
        </span>
      </div>
    </div>
  );
};
