"""Comprehensive Python test suite (unittest & pytest compatible) for AEGIS-V Python Edition."""

from __future__ import annotations

import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from python_aegis.aegis_engine import (
    build_earth_handoff_package,
    compare_to_baseline,
    compute_audit_entry_hash,
    evaluate_deterministic_rules,
    evaluate_parameter_telemetry_status,
    is_observation_degraded,
    is_procedure_authorized,
    validate_role_and_pin,
    verify_audit_chain,
)
from python_aegis.api_server import dispatch_request
from python_aegis.contracts import (
    ALL_18_PARAMETERS,
    AuditLogEntry,
    EclssSnapshot,
    GUIDANCE_CATEGORIES,
    MedicalGuidanceScreenInput,
    RED_FLAG_SIGNS,
    TelemetryObservation,
)
from python_aegis.firebase_store import AegisFirestoreStore
from python_aegis.life_safety_engine import (
    evaluate_checkin_schedule,
    evaluate_environment_life_safety,
    filter_emergency_resources,
)
from python_aegis.medical_guidance_engine import (
    evaluate_emergency_screening,
    resolve_protocol_for_intake,
    search_guidance_library,
)


class TestAegisPythonEdition(unittest.TestCase):
    def test_18_parameters_and_catalog_counts(self) -> None:
        self.assertEqual(len(ALL_18_PARAMETERS), 18)
        self.assertEqual(len(GUIDANCE_CATEGORIES), 22)
        self.assertEqual(len(RED_FLAG_SIGNS), 10)

    def test_audit_chain_integrity_and_tamper_detection(self) -> None:
        e1 = AuditLogEntry(
            log_id="LOG-1",
            incident_id="INC-1",
            timestamp="2026-04-12T10:00:00Z",
            from_state="DETECTED",
            to_state="ACKNOWLEDGED",
            actor_id="AST-02",
            actor_role="CREW_MEDICAL_OFFICER",
            notes="Verified cabin telemetry",
            prev_hash="GENESIS",
        )
        e1.entry_hash = compute_audit_entry_hash(e1)

        e2 = AuditLogEntry(
            log_id="LOG-2",
            incident_id="INC-1",
            timestamp="2026-04-12T10:05:00Z",
            from_state="ACKNOWLEDGED",
            to_state="RESPONSE_RECORDED",
            actor_id="AST-02",
            actor_role="CREW_MEDICAL_OFFICER",
            notes="Executed bypass procedure",
            prev_hash=e1.entry_hash,
        )
        e2.entry_hash = compute_audit_entry_hash(e2)

        self.assertTrue(verify_audit_chain([e1, e2])["valid"])
        e2.notes = "Tampered note"
        tampered = verify_audit_chain([e1, e2])
        self.assertFalse(tampered["valid"])
        self.assertEqual(tampered["brokenAtLogId"], "LOG-2")

    def test_quarantine_stale_and_baseline_comparison(self) -> None:
        now = datetime(2026, 4, 12, 12, 0, 0, tzinfo=timezone.utc)
        obs_bad = TelemetryObservation(
            observation_id="O-BAD",
            astronaut_id="AST-01",
            timestamp=(now - timedelta(minutes=1)).isoformat(),
            parameter="spo2_pct",
            value=135.0,
            unit="%",
            quality_status="IMPOSSIBLE",
            is_quarantined=True,
        )
        self.assertTrue(is_observation_degraded(obs_bad))

        obs_old = TelemetryObservation(
            observation_id="O-OLD",
            astronaut_id="AST-01",
            timestamp=(now - timedelta(minutes=50)).isoformat(),
            parameter="heart_rate_bpm",
            value=72.0,
            unit="bpm",
            quality_status="VALID",
        )
        status = evaluate_parameter_telemetry_status([obs_old], "heart_rate_bpm", reference_iso=now.isoformat())
        self.assertEqual(status["freshness"], "STALE")
        self.assertIsNone(status["liveValue"])
        self.assertEqual(status["lastValidValue"], 72.0)

        comp = compare_to_baseline(obs_old)
        self.assertFalse(comp["outside_p05_p95_band"])
        self.assertEqual(comp["info_label"], "COMPUTED")

    def test_deterministic_rules_co2_hypoxia_and_data_quality(self) -> None:
        now = datetime.now(timezone.utc).isoformat()
        observations = [
            TelemetryObservation("O1", "AST-01", now, "cabin_co2_mmhg", 4.5, "mmHg", quality_status="VALID"),
            TelemetryObservation("O2", "AST-01", now, "spo2_pct", 93.2, "%", quality_status="VALID"),
            TelemetryObservation("O3", "AST-01", now, "radiation_msv_hr", 0.09, "mSv/hr", quality_status="VALID"),
            TelemetryObservation("O4", "AST-01", now, "skin_temp_c", None, "degC", quality_status="MISSING", is_quarantined=True),
        ]
        rules = {f["rule_id"]: f for f in evaluate_deterministic_rules(observations)}
        self.assertIn("RULE-HYPOXIA-CO2-MULTI-02", rules)
        self.assertIn("RULE-RAD-EXPOSURE-03", rules)
        self.assertIn("RULE-DATA-QUALITY-04", rules)

    def test_rbac_and_continuity_procedure_locks(self) -> None:
        ok_obs, _ = validate_role_and_pin("MISSION_OBSERVER", required_cmo=False)
        self.assertFalse(ok_obs)

        ok_wrong_pin, _ = validate_role_and_pin("CREW_MEDICAL_OFFICER", required_cmo=True, auth_pin="0000")
        self.assertFalse(ok_wrong_pin)

        ok_cmo, _ = validate_role_and_pin("CREW_MEDICAL_OFFICER", required_cmo=True, auth_pin="2026")
        self.assertTrue(ok_cmo)

        locked = is_procedure_authorized("PROC-CMO-ONLY", True, "CREW_MEMBER", cmo_available=False)
        self.assertFalse(locked["allowed"])

        crew_safe = is_procedure_authorized("PROC-ENV-CO2-01", False, "CREW_MEMBER", cmo_available=False)
        self.assertTrue(crew_safe["allowed"])

    def test_life_safety_eclss_and_checkin_escalation(self) -> None:
        snap = EclssSnapshot(cabin_pressure_kpa=92.5, smoke_fire_status="ALARM", trace_co_ppm=11.0)
        res = evaluate_environment_life_safety(snap, solar_storm_active=True)
        self.assertEqual(res["overallLevel"], "URGENT")
        self.assertEqual(len(res["findings"]), 8)

        now = datetime(2026, 4, 12, 18, 0, 0, tzinfo=timezone.utc)
        last = now - timedelta(hours=14)
        chk = evaluate_checkin_schedule(last.isoformat(), now.isoformat(), interval_minutes=720, grace_minutes=60)
        self.assertEqual(chk["statusCode"], "MISSED_OVERDUE")

        avail = filter_emergency_resources(available_only=True)
        self.assertTrue(all(item["operationalStatus"] != "UNAVAILABLE" for item in avail))

    def test_medical_guidance_screening_and_non_fabrication(self) -> None:
        urgent_in = MedicalGuidanceScreenInput(conscious="NO", breathing_normally="UNSURE")
        screening = evaluate_emergency_screening(urgent_in)
        self.assertTrue(screening["isEmergency"])
        self.assertEqual(screening["priorityLevel"], "URGENT_RED_FLAG")

        resolved = resolve_protocol_for_intake(urgent_in)
        self.assertTrue(resolved["matched"])
        self.assertEqual(resolved["protocol"]["protocolId"], "PROTO-URGENT-AIRWAY-UNRESPONSIVE")

        unknown_in = MedicalGuidanceScreenInput(what_happened="Rare unverified space rash")
        refused = resolve_protocol_for_intake(unknown_in)
        self.assertFalse(refused["matched"])
        self.assertIn("refusing to fabricate", refused["refusalNotice"].lower())

        lib = search_guidance_library("bleeding")
        self.assertTrue(any(c["id"] == "BLEEDING" for c in lib["categories"]))

    def test_firestore_offline_store_and_api_dispatch(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = str(Path(tmpdir) / "offline_test.json")
            fs = AegisFirestoreStore(offline_cache_path=cache)
            mode = fs.save_ops_record("uid-test-1", "REC-01", {"note": "Check-in OK"})
            self.assertEqual(mode, "OFFLINE_LOCAL_CACHE")
            recs = fs.list_ops_records("uid-test-1")
            self.assertEqual(len(recs), 1)
            self.assertEqual(recs[0]["ownerId"], "uid-test-1")

        code, health = dispatch_request("GET", "/api/health")
        self.assertEqual(code, 200)
        self.assertTrue(health["ok"])

        code_handoff, pkg = dispatch_request(
            "POST",
            "/api/handoff/build",
            {"astronaut_name": "Cdr. Elena Vance", "earth_comms_available": False, "cmo_available": False},
        )
        self.assertEqual(code_handoff, 200)
        self.assertIn("OFFLINE BUFFER", pkg["markdownDocument"])
        self.assertGreaterEqual(pkg["trackedParametersCount"], 18)


if __name__ == "__main__":
    unittest.main()
