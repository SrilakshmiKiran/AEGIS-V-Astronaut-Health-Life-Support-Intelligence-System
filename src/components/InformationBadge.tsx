import React from "react";
import {
  DataSourceType,
  InformationLabel,
  QualityStatus,
  SyncStatus,
} from "../types/aegisContracts";

interface InformationBadgeProps {
  type: InformationLabel;
  tone?: "dark" | "light";
  className?: string;
}

export const InformationBadge: React.FC<InformationBadgeProps> = ({
  type,
  tone = "dark",
  className = "",
}) => {
  const darkConfig: Record<
    InformationLabel,
    { symbol: string; label: string; style: string; title: string }
  > = {
    MEASURED: {
      symbol: "●",
      label: "MEASURED",
      style: "text-cyan-300 border-cyan-500/30 bg-cyan-950/40",
      title: "Raw sensor, manual check-in, or simulated observation",
    },
    COMPUTED: {
      symbol: "◆",
      label: "COMPUTED",
      style: "text-blue-300 border-blue-500/30 bg-blue-950/40",
      title: "Personal baseline comparison, statistical deviation, or deterministic rule output",
    },
    AI_ASSISTED: {
      symbol: "◇",
      label: "AI_ASSISTED",
      style: "text-emerald-300 border-emerald-500/30 bg-emerald-950/40",
      title: "Optional AI-assisted or deterministic template narrative summary",
    },
  };

  const lightConfig: Record<
    InformationLabel,
    { symbol: string; label: string; style: string; title: string }
  > = {
    MEASURED: {
      symbol: "●",
      label: "MEASURED",
      style: "text-slate-800 border-slate-300/90 bg-white/80",
      title: "Raw sensor, manual check-in, or simulated observation",
    },
    COMPUTED: {
      symbol: "◆",
      label: "COMPUTED",
      style: "text-sky-900 border-sky-200 bg-sky-50/90",
      title: "Personal baseline comparison, statistical deviation, or deterministic rule output",
    },
    AI_ASSISTED: {
      symbol: "◇",
      label: "AI_ASSISTED",
      style: "text-emerald-900 border-emerald-200 bg-emerald-50/90",
      title: "Optional AI-assisted or deterministic template narrative summary",
    },
  };

  const item = tone === "light" ? lightConfig[type] : darkConfig[type];
  return (
    <span
      title={item.title}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono font-semibold tracking-tight border rounded whitespace-nowrap shrink-0 ${item.style} ${className}`}
    >
      <span aria-hidden="true">{item.symbol}</span>
      <span>{item.label}</span>
    </span>
  );
};

interface DataSourceBadgeProps {
  source: DataSourceType;
  hmacVerified?: boolean;
  tone?: "dark" | "light";
  className?: string;
}

export const DataSourceBadge: React.FC<DataSourceBadgeProps> = ({
  source,
  hmacVerified = false,
  tone = "dark",
  className = "",
}) => {
  if (source === "VERIFIED_DEVICE") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono border rounded whitespace-nowrap shrink-0 ${
          tone === "light"
            ? hmacVerified
              ? "text-emerald-800 border-emerald-200 bg-emerald-50/85"
              : "text-rose-800 border-rose-200 bg-rose-50/85"
            : hmacVerified
            ? "text-emerald-300 border-emerald-500/30 bg-emerald-950/30"
            : "text-rose-300 border-rose-500/40 bg-rose-950/40"
        } ${className}`}
      >
        <span>{hmacVerified ? "✓ VERIFIED_DEVICE [HMAC]" : "✖ VERIFIED_DEVICE [UNSIGNED]"}</span>
      </span>
    );
  }

  const labelMap: Record<DataSourceType, { text: string; dark: string; light: string }> = {
    SIMULATED: {
      text: "SIMULATED",
      dark: "text-amber-300 border-amber-500/30 bg-amber-950/30",
      light: "text-amber-800 border-amber-200 bg-amber-50/85",
    },
    VERIFIED_DEVICE: {
      text: "VERIFIED_DEVICE",
      dark: "text-emerald-300 border-emerald-500/30 bg-emerald-950/30",
      light: "text-emerald-800 border-emerald-200 bg-emerald-50/85",
    },
    MANUAL_ENTRY: {
      text: "MANUAL_ENTRY",
      dark: "text-sky-300 border-sky-500/30 bg-sky-950/30",
      light: "text-sky-800 border-sky-200 bg-sky-50/85",
    },
    IMPORTED_RECORD: {
      text: "IMPORTED_RECORD",
      dark: "text-slate-300 border-slate-600 bg-slate-800/60",
      light: "text-slate-700 border-slate-300 bg-slate-100/85",
    },
  };

  const item = labelMap[source];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono border rounded whitespace-nowrap shrink-0 ${
        tone === "light" ? item.light : item.dark
      } ${className}`}
    >
      {item.text}
    </span>
  );
};

interface QualityBadgeProps {
  status: QualityStatus;
  quarantined?: boolean;
  className?: string;
}

export const QualityBadge: React.FC<QualityBadgeProps> = ({
  status,
  quarantined = false,
  className = "",
}) => {
  const styles: Record<QualityStatus, { prefix: string; cls: string }> = {
    VALID: {
      prefix: "●",
      cls: "text-emerald-300",
    },
    ESTIMATED: {
      prefix: "◆",
      cls: "text-cyan-300",
    },
    STALE: {
      prefix: "▲",
      cls: "text-amber-300",
    },
    MISSING: {
      prefix: "▲",
      cls: "text-amber-300",
    },
    IMPOSSIBLE: {
      prefix: "✖",
      cls: "text-rose-300",
    },
    CORRUPTED: {
      prefix: "✖",
      cls: "text-rose-300",
    },
  };

  const item = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-mono font-medium whitespace-nowrap shrink-0 ${item.cls} ${className}`}
    >
      <span aria-hidden="true">{item.prefix}</span>
      <span>{status}</span>
      {quarantined && <span className="text-rose-400 font-semibold">[QUARANTINED]</span>}
    </span>
  );
};

interface SyncBadgeProps {
  status: SyncStatus;
}

export const SyncBadge: React.FC<SyncBadgeProps> = ({ status }) => {
  const map: Record<SyncStatus, { symbol: string; cls: string }> = {
    SYNCED: { symbol: "●", cls: "text-emerald-300" },
    PENDING: { symbol: "▲", cls: "text-amber-300" },
    LOCAL_ONLY: { symbol: "◆", cls: "text-cyan-300" },
    ERROR: { symbol: "✖", cls: "text-rose-300" },
  };
  const item = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono font-semibold ${item.cls}`}>
      <span aria-hidden="true">{item.symbol}</span>
      <span>{status}</span>
    </span>
  );
};
