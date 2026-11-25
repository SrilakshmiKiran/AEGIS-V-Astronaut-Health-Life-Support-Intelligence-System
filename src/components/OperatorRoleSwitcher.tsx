import React from "react";
import { KeyRound, UserCheck } from "lucide-react";
import { ActorRole } from "../types/aegisContracts";
import { OperatorSession } from "../services/apiClient";

interface OperatorRoleSwitcherProps {
  operator: OperatorSession;
  onChange: (next: OperatorSession) => void;
}

export const OperatorRoleSwitcher: React.FC<OperatorRoleSwitcherProps> = ({
  operator,
  onChange,
}) => {
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "UNAUTHENTICATED") {
      onChange({ actorId: "", actorRole: null, authPin: "" });
    } else if (val === "CREW_MEDICAL_OFFICER") {
      onChange({
        actorId: "CMO-DR-PATEL",
        actorRole: "CREW_MEDICAL_OFFICER",
        authPin: operator.authPin,
      });
    } else if (val === "CREW_MEMBER") {
      onChange({
        actorId: "AST-01-COMMANDER",
        actorRole: "CREW_MEMBER",
        authPin: operator.authPin,
      });
    } else {
      onChange({
        actorId: "OBS-FLIGHT-SURGEON",
        actorRole: "MISSION_OBSERVER",
        authPin: operator.authPin,
      });
    }
  };

  return (
    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1 text-xs">
      <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
      <label htmlFor="aegis-operator-role" className="text-slate-400 font-mono text-[11px] sr-only">
        Active Operator Role
      </label>
      <select
        id="aegis-operator-role"
        aria-label="Active Operator Role"
        value={operator.actorRole ?? "UNAUTHENTICATED"}
        onChange={handleRoleChange}
        className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
      >
        <option value="CREW_MEDICAL_OFFICER" className="bg-slate-900 text-slate-100">
          Role: CREW_MEDICAL_OFFICER (CMO)
        </option>
        <option value="CREW_MEMBER" className="bg-slate-900 text-slate-100">
          Role: CREW_MEMBER
        </option>
        <option value="MISSION_OBSERVER" className="bg-slate-900 text-slate-100">
          Role: MISSION_OBSERVER (Read-Only)
        </option>
        <option value="UNAUTHENTICATED" className="bg-slate-900 text-rose-300">
          Role: UNAUTHENTICATED (Test 401)
        </option>
      </select>

      <span className="text-slate-700" aria-hidden="true">
        |
      </span>

      <div className="flex items-center gap-1">
        <KeyRound className="w-3 h-3 text-slate-400 shrink-0" />
        <label htmlFor="aegis-cmo-pin" className="text-[11px] font-mono text-slate-400">
          PIN:
        </label>
        <input
          id="aegis-cmo-pin"
          aria-label="CMO Authentication PIN"
          type="password"
          value={operator.authPin}
          onChange={(e) => onChange({ ...operator, authPin: e.target.value })}
          placeholder="PIN"
          className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
        />
      </div>
    </div>
  );
};
