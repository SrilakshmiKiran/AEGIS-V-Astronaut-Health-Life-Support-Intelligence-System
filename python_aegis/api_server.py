"""AEGIS-V Python Backend API Server (FastAPI + Google GenAI + Firebase Admin).

Designed for standard ASGI execution:
    uvicorn python_aegis.api_server:app --reload --port 8000

Also includes a stdlib ThreadingHTTPServer fallback (`python3 -m python_aegis.api_server`)
so all deterministic endpoints can be inspected or tested even before installing FastAPI.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List, Optional, Tuple

from . import PROTOTYPE_DISCLAIMER, SCHEMA_VERSION
from .aegis_engine import (
    build_earth_handoff_package,
    compare_to_baseline,
    evaluate_deterministic_rules,
    evaluate_parameter_telemetry_status,
    is_procedure_authorized,
    validate_role_and_pin,
    verify_audit_chain,
)
from .contracts import (
    ALL_18_PARAMETERS,
    AuditLogEntry,
    EclssSnapshot,
    MedicalGuidanceScreenInput,
    TelemetryObservation,
)
from .firebase_store import AegisFirestoreStore
from .life_safety_engine import (
    evaluate_checkin_schedule,
    evaluate_environment_life_safety,
    filter_emergency_resources,
)
from .medical_guidance_engine import (
    evaluate_emergency_screening,
    resolve_protocol_for_intake,
    search_guidance_library,
)

store = AegisFirestoreStore()


def _observations_from_payload(raw_list: List[Dict[str, Any]]) -> List[TelemetryObservation]:
    out: List[TelemetryObservation] = []
    for i, item in enumerate(raw_list):
        out.append(
            TelemetryObservation(
                observation_id=str(item.get("observation_id") or f"OBS-{i+1}"),
                astronaut_id=str(item.get("astronaut_id") or "AST-01-COMMANDER"),
                timestamp=str(item.get("timestamp") or datetime.now(timezone.utc).isoformat()),
                parameter=str(item.get("parameter") or "heart_rate_bpm"),
                value=float(item["value"]) if item.get("value") is not None else None,
                unit=str(item.get("unit") or ""),
                source_type=item.get("source_type", "SIMULATED"),
                device_id=item.get("device_id"),
                device_hmac_verified=bool(item.get("device_hmac_verified", True)),
                info_label=str(item.get("info_label") or "MEASURED"),
                quality_status=item.get("quality_status", "VALID"),
                quality_notes=str(item.get("quality_notes") or ""),
                reference_target=item.get("reference_target"),
                is_quarantined=bool(item.get("is_quarantined", False)),
            )
        )
    return out


def handle_health() -> Tuple[int, Dict[str, Any]]:
    return 200, {
        "ok": True,
        "service": "aegis-v-python-api",
        "schemaVersion": SCHEMA_VERSION,
        "geminiConfigured": bool(os.getenv("GEMINI_API_KEY")),
        "firestoreConnected": store.cloud_connected,
        "disclaimer": PROTOTYPE_DISCLAIMER,
    }


def handle_telemetry_evaluate(body: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    raw_obs = body.get("observations") or []
    observations = _observations_from_payload(raw_obs)
    ref_iso = body.get("referenceIso")
    findings = evaluate_deterministic_rules(observations)
    statuses = [
        evaluate_parameter_telemetry_status(observations, param, reference_iso=ref_iso)
        for param in (body.get("parameters") or ALL_18_PARAMETERS)
        if param in ALL_18_PARAMETERS
    ]
    comparisons = [compare_to_baseline(o) for o in observations if o.parameter in ALL_18_PARAMETERS and o.value is not None]
    return 200, {
        "ok": True,
        "findings": findings,
        "parameterStatuses": statuses,
        "baselineComparisons": comparisons,
    }


def handle_life_safety_evaluate(body: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    snap = EclssSnapshot(
        cabin_pressure_kpa=float(body.get("cabin_pressure_kpa", 101.3)),
        cabin_pressure_rate_kpa_hr=float(body.get("cabin_pressure_rate_kpa_hr", 0.0)),
        pp_o2_mmhg=float(body.get("pp_o2_mmhg", 159.0)),
        o2_supply_pct=float(body.get("o2_supply_pct", 92.0)),
        smoke_fire_status=str(body.get("smoke_fire_status", "CLEAR")),
        contaminant_status=str(body.get("contaminant_status", "NOMINAL")),
        trace_co_ppm=float(body.get("trace_co_ppm", 1.2)),
        ventilation_status=str(body.get("ventilation_status", "NOMINAL_FLOW")),
        life_support_health_status=str(body.get("life_support_health_status", "OPERATIONAL")),
        scrubber_bed_pct=int(body.get("scrubber_bed_pct", 88)),
        env_data_source=body.get("env_data_source", "SIMULATED"),
    )
    result = evaluate_environment_life_safety(snap, solar_storm_active=bool(body.get("solar_storm_active", False)))
    return 200, {"ok": True, **result}


def handle_medical_guidance_screen(body: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    intake = MedicalGuidanceScreenInput(
        what_happened=str(body.get("what_happened", "")),
        who_needs_help=body.get("who_needs_help", "ME"),
        subject_crew_id=str(body.get("subject_crew_id", "AST-01-COMMANDER")),
        conscious=body.get("conscious", "YES"),
        breathing_normally=body.get("breathing_normally", "YES"),
        severe_bleeding=body.get("severe_bleeding", "NO"),
        when_began=str(body.get("when_began", "Just now (< 10 min)")),
        selected_categories=list(body.get("selected_categories") or []),
        selected_red_flags=list(body.get("selected_red_flags") or []),
        urgent_bypass_triggered=bool(body.get("urgent_bypass_triggered", False)),
    )
    return 200, {"ok": True, **resolve_protocol_for_intake(intake)}


def handle_handoff_build(body: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    observations = _observations_from_payload(body.get("observations") or [])
    pkg = build_earth_handoff_package(
        astronaut_id=str(body.get("astronaut_id", "AST-01-COMMANDER")),
        astronaut_name=str(body.get("astronaut_name", "Cdr. Elena Vance")),
        mission_name=str(body.get("mission_name", "Artemis Transit Sim")),
        observations=observations,
        earth_comms_available=bool(body.get("earth_comms_available", False)),
        cmo_available=bool(body.get("cmo_available", False)),
        operator_role=body.get("operator_role", "CREW_MEMBER"),
        incident_title=str(body.get("incident_title", "Active Crew Health Review")),
    )
    return 200, {"ok": True, **pkg}


def handle_rbac_check(body: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    allowed, reason = validate_role_and_pin(
        operator_role=body.get("operator_role", "CREW_MEMBER"),
        required_cmo=bool(body.get("required_cmo", False)),
        auth_pin=body.get("auth_pin"),
    )
    proc_check = is_procedure_authorized(
        procedure_id=str(body.get("procedure_id", "PROC-ENV-CO2-01")),
        requires_cmo=bool(body.get("required_cmo", False)),
        operator_role=body.get("operator_role", "CREW_MEMBER"),
        cmo_available=bool(body.get("cmo_available", True)),
    )
    return (200 if allowed else 403), {
        "ok": allowed,
        "reason": reason,
        "procedureAuthorization": proc_check,
    }


def handle_audit_verify(body: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    raw_entries = body.get("entries") or []
    entries = [
        AuditLogEntry(
            log_id=str(e["log_id"]),
            incident_id=str(e["incident_id"]),
            timestamp=str(e["timestamp"]),
            from_state=str(e["from_state"]),
            to_state=str(e["to_state"]),
            actor_id=str(e["actor_id"]),
            actor_role=e["actor_role"],
            notes=str(e.get("notes", "")),
            prev_hash=str(e["prev_hash"]),
            entry_hash=str(e["entry_hash"]),
        )
        for e in raw_entries
    ]
    return 200, {"ok": True, **verify_audit_chain(entries)}


def handle_triage_summary(body: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return 503, {
            "ok": False,
            "error": "Server GEMINI_API_KEY is not configured for live AI triage.",
        }

    try:
        from google import genai  # type: ignore
        from google.genai import types  # type: ignore

        client = genai.Client(api_key=api_key)
        question = str(body.get("question") or "Summarize current readings and suggest safe crew actions.")[:600]
        metrics = body.get("latestMetrics") or []
        metrics_lines = "\n".join(
            f"- {m.get('parameter')}: {m.get('value')} {m.get('unit')} (Normal: {m.get('normalRange')}, Status: {m.get('status')})"
            for m in metrics[:20]
        ) or "No telemetry metrics provided."

        prompt_text = (
            f"Astronaut: {body.get('astronautName', 'Crew Member')}\n"
            f"Mission Environment: {body.get('missionEnvironment', 'ISS LEO')}\n"
            f"Latest Verified Telemetry:\n{metrics_lines}\n\n"
            f"Crew Question: {question}"
        )

        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt_text,
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are AEGIS-V's onboard spaceflight health decision-support helper. "
                    "Do NOT diagnose or prescribe controlled drugs; ground answers strictly in supplied readings."
                ),
                response_mime_type="application/json",
            ),
        )
        parsed = json.loads((resp.text or "{}").strip())
        return 200, {
            "ok": True,
            "model": "gemini-2.5-flash",
            "generatedAtIso": datetime.now(timezone.utc).isoformat(),
            "disclaimer": PROTOTYPE_DISCLAIMER,
            "guidance": parsed,
        }
    except Exception as exc:
        return 502, {"ok": False, "error": f"Onboard AI triage failed: {exc}"}


def handle_assistant_chat(body: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    api_key = os.getenv("GEMINI_API_KEY")
    message = str(body.get("message") or "").strip()[:800]
    if not message:
        return 400, {"ok": False, "error": "Message is required."}
    if not api_key:
        return 503, {"ok": False, "error": "Server GEMINI_API_KEY is not configured."}

    try:
        from google import genai  # type: ignore

        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"AEGIS-V Crew Assistant Query: {message}",
        )
        return 200, {
            "ok": True,
            "reply": (resp.text or "").strip(),
            "disclaimer": PROTOTYPE_DISCLAIMER,
        }
    except Exception as exc:
        return 502, {"ok": False, "error": f"Assistant query failed: {exc}"}


def dispatch_request(method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Tuple[int, Dict[str, Any]]:
    payload = body or {}
    if method == "GET" and path == "/api/health":
        return handle_health()
    if method == "GET" and path.startswith("/api/guidance/search"):
        q = path.split("q=", 1)[1] if "q=" in path else ""
        return 200, {"ok": True, **search_guidance_library(q)}
    if method == "POST" and path == "/api/telemetry/evaluate":
        return handle_telemetry_evaluate(payload)
    if method == "POST" and path == "/api/life-safety/evaluate":
        return handle_life_safety_evaluate(payload)
    if method == "POST" and path == "/api/checkin/evaluate":
        return 200, {
            "ok": True,
            **evaluate_checkin_schedule(
                str(payload.get("last_checkin_iso", datetime.now(timezone.utc).isoformat())),
                str(payload.get("now_iso", datetime.now(timezone.utc).isoformat())),
                int(payload.get("interval_minutes", 720)),
                int(payload.get("grace_minutes", 60)),
            ),
        }
    if method == "POST" and path == "/api/medical-guidance/screen":
        return handle_medical_guidance_screen(payload)
    if method == "POST" and path == "/api/medical-guidance/emergency-check":
        intake = MedicalGuidanceScreenInput(
            conscious=payload.get("conscious", "YES"),
            breathing_normally=payload.get("breathing_normally", "YES"),
            severe_bleeding=payload.get("severe_bleeding", "NO"),
            selected_red_flags=list(payload.get("selected_red_flags") or []),
            urgent_bypass_triggered=bool(payload.get("urgent_bypass_triggered", False)),
        )
        return 200, {"ok": True, **evaluate_emergency_screening(intake)}
    if method == "POST" and path == "/api/handoff/build":
        return handle_handoff_build(payload)
    if method == "POST" and path == "/api/rbac/verify":
        return handle_rbac_check(payload)
    if method == "POST" and path == "/api/audit/verify":
        return handle_audit_verify(payload)
    if method == "POST" and path == "/api/ops/records":
        uid = str(payload.get("uid") or "demo-user")
        record_id = str(payload.get("record_id") or f"REC-{int(datetime.now(timezone.utc).timestamp())}")
        mode = store.save_ops_record(uid, record_id, dict(payload.get("data") or {}))
        return 200, {"ok": True, "storageMode": mode, "recordId": record_id}
    if method == "GET" and path.startswith("/api/ops/records"):
        uid = path.split("uid=", 1)[1] if "uid=" in path else "demo-user"
        return 200, {"ok": True, "records": store.list_ops_records(uid)}
    if method == "GET" and path.startswith("/api/resources"):
        q = path.split("q=", 1)[1] if "q=" in path else ""
        return 200, {"ok": True, "resources": filter_emergency_resources(q)}
    if method == "POST" and path == "/api/triage-summary":
        return handle_triage_summary(payload)
    if method == "POST" and path == "/api/assistant-chat":
        return handle_assistant_chat(payload)
    return 404, {"ok": False, "error": f"Unknown route: {method} {path}"}


# Build FastAPI ASGI app when fastapi is installed; remain importable under stdlib-only Python.
app: Any = None
try:
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse

    app = FastAPI(title="AEGIS-V Python API", version=SCHEMA_VERSION)

    @app.get("/api/health")
    def _health() -> JSONResponse:
        code, data = dispatch_request("GET", "/api/health")
        return JSONResponse(content=data, status_code=code)

    @app.post("/api/telemetry/evaluate")
    async def _telemetry_eval(req: Request) -> JSONResponse:
        code, data = dispatch_request("POST", "/api/telemetry/evaluate", await req.json())
        return JSONResponse(content=data, status_code=code)

    @app.post("/api/life-safety/evaluate")
    async def _life_safety_eval(req: Request) -> JSONResponse:
        code, data = dispatch_request("POST", "/api/life-safety/evaluate", await req.json())
        return JSONResponse(content=data, status_code=code)

    @app.post("/api/medical-guidance/screen")
    async def _med_screen(req: Request) -> JSONResponse:
        code, data = dispatch_request("POST", "/api/medical-guidance/screen", await req.json())
        return JSONResponse(content=data, status_code=code)

    @app.post("/api/handoff/build")
    async def _handoff(req: Request) -> JSONResponse:
        code, data = dispatch_request("POST", "/api/handoff/build", await req.json())
        return JSONResponse(content=data, status_code=code)

    @app.post("/api/rbac/verify")
    async def _rbac(req: Request) -> JSONResponse:
        code, data = dispatch_request("POST", "/api/rbac/verify", await req.json())
        return JSONResponse(content=data, status_code=code)

    @app.post("/api/triage-summary")
    async def _triage(req: Request) -> JSONResponse:
        code, data = dispatch_request("POST", "/api/triage-summary", await req.json())
        return JSONResponse(content=data, status_code=code)

    @app.post("/api/assistant-chat")
    async def _chat(req: Request) -> JSONResponse:
        code, data = dispatch_request("POST", "/api/assistant-chat", await req.json())
        return JSONResponse(content=data, status_code=code)

except ImportError:
    app = None


class _StdlibHandler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: Dict[str, Any]) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:  # noqa: N802
        code, data = dispatch_request("GET", self.path)
        self._send(code, data)

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length).decode("utf-8")) if length > 0 else {}
        code, data = dispatch_request("POST", self.path, body)
        self._send(code, data)


def serve_stdlib(port: int = 8000) -> None:
    server = ThreadingHTTPServer(("0.0.0.0", port), _StdlibHandler)
    print(f"AEGIS-V Python stdlib API listening on http://0.0.0.0:{port}")
    server.serve_forever()


if __name__ == "__main__":
    serve_stdlib(int(os.getenv("AEGIS_PY_PORT", "8000")))
