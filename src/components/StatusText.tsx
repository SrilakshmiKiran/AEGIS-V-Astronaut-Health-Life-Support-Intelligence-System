import React from "react";
import { DataSourceType, QualityStatus, SyncStatus } from "../types/aegisContracts";

export const SourceLabelText: React.FC<{ source: DataSourceType; hmacVerified?: boolean }> = ({
  source,
  hmacVerified = false,
}) => {
  if (source === "VERIFIED_DEVICE") {
    return (
      <span className={hmacVerified ? "text-emerald-700 font-medium" : "text-rose-700 font-medium"}>
        {hmacVerified ? "Verified sensor" : "Unsigned sensor"}
      </span>
    );
  }
  const map: Record<DataSourceType, string> = {
    SIMULATED: "Sample feed",
    VERIFIED_DEVICE: "Verified sensor",
    MANUAL_ENTRY: "Manual check-in",
    IMPORTED_RECORD: "Imported log",
  };
  return <span className="text-slate-500">{map[source]}</span>;
};

export const QualityStatusText: React.FC<{ status: QualityStatus; quarantined?: boolean }> = ({
  status,
  quarantined = false,
}) => {
  const config: Record<QualityStatus, { symbol: string; text: string; cls: string }> = {
    VALID: { symbol: "●", text: "Valid", cls: "text-emerald-700" },
    ESTIMATED: { symbol: "◆", text: "Estimated", cls: "text-sky-700" },
    STALE: { symbol: "▲", text: "Outdated (>15m)", cls: "text-amber-700" },
    MISSING: { symbol: "▲", text: "Missing", cls: "text-amber-700" },
    IMPOSSIBLE: { symbol: "✖", text: "Impossible value", cls: "text-rose-700" },
    CORRUPTED: { symbol: "✖", text: "Unverified", cls: "text-rose-700" },
  };
  const item = config[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap ${item.cls}`}>
      <span aria-hidden="true">{item.symbol}</span>
      <span>{item.text}</span>
      {quarantined && <span className="text-rose-700">(Quarantined)</span>}
    </span>
  );
};

export const SyncStatusText: React.FC<{ status: SyncStatus }> = ({ status }) => {
  const map: Record<SyncStatus, { symbol: string; text: string; cls: string }> = {
    SYNCED: { symbol: "●", text: "Synced to Earth", cls: "text-emerald-700" },
    PENDING: { symbol: "▲", text: "Waiting to sync", cls: "text-amber-700" },
    LOCAL_ONLY: { symbol: "◆", text: "Saved locally", cls: "text-sky-700" },
    ERROR: { symbol: "✖", text: "Earth link offline", cls: "text-rose-700" },
  };
  const item = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap ${item.cls}`}>
      <span aria-hidden="true">{item.symbol}</span>
      <span>{item.text}</span>
    </span>
  );
};
