"""Firebase Firestore Admin SDK adapter with local JSON offline fallback for AEGIS-V Python Edition."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional


class AegisFirestoreStore:
    """Owner-isolated Firestore client matching /users/{uid}/... with offline JSON queue fallback."""

    def __init__(self, offline_cache_path: str = ".aegis_python_offline.json") -> None:
        self._cache_path = Path(offline_cache_path)
        self._db: Any = None
        try:
            import firebase_admin  # type: ignore
            from firebase_admin import firestore  # type: ignore

            if not firebase_admin._apps:
                firebase_admin.initialize_app()
            self._db = firestore.client()
        except Exception:
            self._db = None

    @property
    def cloud_connected(self) -> bool:
        return self._db is not None

    def _read_local(self) -> Dict[str, Any]:
        if not self._cache_path.exists():
            return {"users": {}}
        try:
            return json.loads(self._cache_path.read_text(encoding="utf-8"))
        except Exception:
            return {"users": {}}

    def _write_local(self, data: Dict[str, Any]) -> None:
        self._cache_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def save_ops_record(self, uid: str, record_id: str, payload: Dict[str, Any]) -> str:
        if self._db is not None:
            self._db.collection("users").document(uid).collection("opsRecords").document(record_id).set(
                {"ownerId": uid, "recordId": record_id, **payload}, merge=True
            )
            return "CLOUD_FIRESTORE"

        store = self._read_local()
        user_bucket = store.setdefault("users", {}).setdefault(uid, {})
        user_bucket.setdefault("opsRecords", {})[record_id] = {"ownerId": uid, "recordId": record_id, **payload}
        self._write_local(store)
        return "OFFLINE_LOCAL_CACHE"

    def list_ops_records(self, uid: str) -> List[Dict[str, Any]]:
        if self._db is not None:
            docs = self._db.collection("users").document(uid).collection("opsRecords").stream()
            return [d.to_dict() for d in docs]

        store = self._read_local()
        return list(store.get("users", {}).get(uid, {}).get("opsRecords", {}).values())
