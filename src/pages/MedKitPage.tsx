import React, { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  PackageCheck,
  Pill,
  Plus,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { ActorRole } from "../types/aegisContracts";
import { OpsRecordDoc } from "../types/opsContracts";
import {
  ContinuityPersistedState,
  DEFAULT_CONTINUITY_STATE,
  EquipmentOperationalStatus,
  ONBOARD_MEDICAL_EQUIPMENT,
} from "../types/continuityContracts";
import { SafeImage } from "../components/SafeImage";
import { VISUAL_ASSETS } from "../assets/visualCatalog";
import {
  canConfirmEquipmentInventory,
  formatMissionTimeUtc,
  resolveEquipmentInventory,
} from "../utils/aegisPureEngine";

interface MedKitPageProps {
  activeCrewName: string;
  operatorRole: ActorRole;
  medRecords: OpsRecordDoc[];
  continuityState?: ContinuityPersistedState;
  equipmentOverrides?: Record<string, EquipmentOperationalStatus>;
  onConfirmEquipmentInventory?: (equipmentId: string) => Promise<void>;
  onOpenContinuity?: () => void;
  onLogDose: (record: OpsRecordDoc) => Promise<void>;
  onAddSupplyItem: (name: string, category: string, schedule: string, qty: number, unit: string, expiresOn: string) => Promise<void>;
  onBackHome: () => void;
  isBusy: boolean;
}

export const MedKitPage: React.FC<MedKitPageProps> = ({
  activeCrewName,
  operatorRole,
  medRecords,
  continuityState = DEFAULT_CONTINUITY_STATE,
  equipmentOverrides,
  onConfirmEquipmentInventory,
  onOpenContinuity,
  onLogDose,
  onAddSupplyItem,
  onBackHome,
  isBusy,
}) => {
  const canConfirm = canConfirmEquipmentInventory(operatorRole);
  const [newItemName, setNewItemName] = useState("");
  const [newCategory, setNewCategory] = useState("COUNTERMEASURE");
  const [newSchedule, setNewSchedule] = useState("1 dose daily");
  const [newQty, setNewQty] = useState(20);
  const [newUnit, setNewUnit] = useState("tabs");
  const [newExpiry, setNewExpiry] = useState("2027-10");
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleTakeDose = async (rec: OpsRecordDoc) => {
    await onLogDose(rec);
    setFeedback(`Logged dose for ${rec.title} and updated remaining medical kit stock.`);
  };

  const handleCreateSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    await onAddSupplyItem(newItemName.trim(), newCategory, newSchedule, newQty, newUnit, newExpiry);
    setFeedback(`Added ${newItemName.trim()} to onboard medical kit inventory.`);
    setNewItemName("");
  };

  const totalDosesToday = medRecords.reduce(
    (sum, r) => sum + Number(r.payload.dosesLoggedToday || 0),
    0
  );
  const lowOrSoonExpiring = medRecords.filter(
    (r) => Number(r.payload.stockQty || 0) <= 15 || String(r.payload.expiresOn || "") <= "2026-12"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-full sm:w-44 aspect-[16/10] rounded-xl overflow-hidden border border-white/80 shadow-sm shrink-0">
            <SafeImage
              src={VISUAL_ASSETS.medKit}
              alt="Orbital medical kit and daily countermeasure supplies"
              caption="Flight Med-Kit Stock"
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
              Medications, Countermeasures &amp; Medical Kit
            </h1>
            <p className="text-sm text-slate-600">
              Track daily bone/fluid-shift countermeasures, log onboard medication doses, and monitor
              remaining kit stock for {activeCrewName}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0 text-xs">
          <div className="glass-subtle rounded-xl px-4 py-2.5">
            <div className="text-slate-500">Doses Logged Today</div>
            <div className="text-lg font-mono font-bold text-slate-900 tabular-nums">
              {totalDosesToday}
            </div>
          </div>
          <div className="glass-subtle rounded-xl px-4 py-2.5">
            <div className="text-slate-500">Low Stock / Near Expiry</div>
            <div
              className={`text-lg font-mono font-bold tabular-nums ${
                lowOrSoonExpiring > 0 ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              {lowOrSoonExpiring}
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-2xl border bg-emerald-50/90 border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Integrated Onboard Medical Equipment & Continuity Readiness (Simulated Hardware Layer) */}
      {(() => {
        const mergedContinuity: ContinuityPersistedState = equipmentOverrides
          ? { ...continuityState, equipmentStatusOverrides: equipmentOverrides }
          : continuityState;
        const resolvedEq = resolveEquipmentInventory(ONBOARD_MEDICAL_EQUIPMENT, mergedContinuity);
        const opCount = resolvedEq.filter((e) => e.effectiveStatus === "OPERATIONAL").length;
        const limitedOrMissing = resolvedEq.filter((e) => e.effectiveStatus !== "OPERATIONAL");
        return (
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-sky-700" />
                  <span>Onboard Medical Equipment &amp; Reference Readiness</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Includes storage location, availability, operational status, and last inventory
                  confirmation. Seeded baselines are clearly labeled as simulated demo data until
                  crew-confirmed.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-mono font-semibold text-emerald-800">
                  ● {opCount} Operational
                </span>
                <span className="font-mono font-semibold text-amber-800">
                  ▲ {limitedOrMissing.length} Limited / Missing
                </span>
                {onOpenContinuity && (
                  <button
                    type="button"
                    onClick={onOpenContinuity}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    Open Continuity Mode →
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {resolvedEq.map((eq) => {
                const isOp = eq.effectiveStatus === "OPERATIONAL";
                const isUnavail = eq.effectiveStatus === "UNAVAILABLE";
                return (
                  <div
                    key={eq.equipmentId}
                    className={`rounded-xl p-3.5 border flex flex-col justify-between gap-2 ${
                      isUnavail
                        ? "bg-rose-50/85 border-rose-200 text-rose-950"
                        : isOp
                        ? "bg-white/75 border-slate-200/80 text-slate-900"
                        : "bg-amber-50/85 border-amber-200 text-amber-950"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono text-slate-500">{eq.equipmentId}</span>
                        <span
                          className={`font-mono font-semibold ${
                            isOp
                              ? "text-emerald-700"
                              : isUnavail
                              ? "text-rose-700"
                              : "text-amber-700"
                          }`}
                        >
                          {eq.availability} · {eq.effectiveStatus}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-900">{eq.name}</div>
                      <div className="text-[11px] text-slate-700">
                        <strong>Storage:</strong> {eq.location}
                      </div>
                      {eq.maintenanceOrExpiryInfo && (
                        <div className="text-[11px] text-slate-700">
                          <strong>Maint / Expiry:</strong> {eq.maintenanceOrExpiryInfo}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-600">
                        Offline Ref: {eq.referenceAvailableOffline ? "Available" : "Missing"}
                      </div>
                      <div className="text-[11px] text-slate-500 leading-snug">{eq.notes}</div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="font-mono text-slate-600">
                        <div>
                          Confirmed:{" "}
                          {eq.lastConfirmedAtIso
                            ? formatMissionTimeUtc(eq.lastConfirmedAtIso)
                            : "Unconfirmed"}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {eq.isSimulatedConfirmation
                            ? "[SIMULATED] Demo Default Inventory"
                            : `[CREW-CONFIRMED] By: ${eq.confirmedBy}`}
                        </div>
                      </div>
                      {onConfirmEquipmentInventory && (
                        <button
                          type="button"
                          disabled={isBusy || !canConfirm}
                          onClick={async () => {
                            await onConfirmEquipmentInventory(eq.equipmentId);
                            setFeedback(`Confirmed physical inventory location & status for ${eq.name}.`);
                          }}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white rounded-lg text-[11px] font-medium cursor-pointer whitespace-nowrap"
                        >
                          Confirm Check
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Countermeasures & Inventory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {medRecords.map((rec) => {
          const stock = Number(rec.payload.stockQty ?? 0);
          const unit = String(rec.payload.unit || "units");
          const exp = String(rec.payload.expiresOn || "2027-12");
          const dosesToday = Number(rec.payload.dosesLoggedToday || 0);
          const isLow = stock <= 15 || exp <= "2026-12";

          return (
            <div
              key={rec.recordId}
              className={`glass-panel rounded-2xl p-5 flex flex-col justify-between gap-4 ${
                isLow ? "ring-1 ring-amber-300/80" : ""
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {String(rec.payload.category || "MEDICATION") === "COUNTERMEASURE"
                      ? "Daily Countermeasure"
                      : "Onboard Medication"}
                  </span>
                  <span className="font-mono">Exp {exp}</span>
                </div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-sky-700 shrink-0" />
                  <span>{rec.title}</span>
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {String(rec.payload.dosageOrSchedule || "")}
                </p>
                {rec.recordId === "MED_MODAFINIL" && (
                  <div className="text-[11px] font-medium text-amber-900 inline-flex items-center gap-1">
                    <Lock className="w-3 h-3 shrink-0 text-amber-700" />
                    <span>CMO-Controlled · Requires CMO + Ground confirmation</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-200/70 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">
                    Stock:{" "}
                    <strong className="font-mono text-slate-900 tabular-nums">
                      {stock} {unit}
                    </strong>
                  </span>
                  <span className={dosesToday > 0 ? "text-emerald-700 font-medium" : "text-slate-500"}>
                    {dosesToday > 0 ? `● ${dosesToday} taken today` : "Not logged today"}
                  </span>
                </div>
                {isLow && (
                  <div className="text-[11px] text-amber-800 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>Include on next Cargo Resupply manifest</span>
                  </div>
                )}
                <button
                  type="button"
                  disabled={isBusy || stock <= 0}
                  onClick={() => handleTakeDose(rec)}
                  className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  Log Dose Taken (-1 {unit === "sets" ? "session" : unit})
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Supply Item */}
      <form onSubmit={handleCreateSupply} className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <PackageCheck className="w-4 h-4 text-sky-700" />
          <h2 className="text-sm font-semibold text-slate-900">
            Add Supply or Custom Countermeasure to Medical Kit
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <input
            aria-label="Supply Name"
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="e.g., Electrolyte Packet"
            className="bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
          />
          <select
            aria-label="Supply Category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
          >
            <option value="COUNTERMEASURE">Daily Countermeasure</option>
            <option value="MEDICATION">Medication</option>
          </select>
          <input
            aria-label="Dosage or Schedule"
            type="text"
            value={newSchedule}
            onChange={(e) => setNewSchedule(e.target.value)}
            placeholder="Schedule / Dose"
            className="bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
          />
          <div className="flex gap-2">
            <input
              aria-label="Stock Quantity"
              type="number"
              min={1}
              value={newQty}
              onChange={(e) => setNewQty(Number(e.target.value))}
              className="w-20 bg-white/85 border border-slate-300/80 rounded-xl px-2.5 py-2 font-mono text-slate-900"
            />
            <input
              aria-label="Unit"
              type="text"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              className="flex-1 bg-white/85 border border-slate-300/80 rounded-xl px-2.5 py-2 text-slate-900"
            />
          </div>
          <div className="flex gap-2">
            <input
              aria-label="Expiration Month"
              type="text"
              value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value)}
              placeholder="YYYY-MM"
              className="w-24 bg-white/85 border border-slate-300/80 rounded-xl px-2.5 py-2 font-mono text-slate-900"
            />
            <button
              type="submit"
              disabled={isBusy || !newItemName.trim()}
              className="flex-1 px-3 py-2 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-semibold rounded-xl inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
