# AEGIS-V Python Edition (`python_aegis`)

Full Python port of AEGIS-V's deterministic telemetry engine, Continuity Mode, Life-Safety Sentinel, Emergency Medical Guidance, Gemini AI Triage API, and Firestore owner-isolated persistence — built with familiar Python tech stacks.

> Note for AI Studio Build preview: The live web preview in this workspace continues running the React + Vite + Express (`server.ts`) stack on port `3000`. All Python source modules live cleanly in `python_aegis/` so both versions work without breaking each other.

## Familiar Python Tech Stack Mapping

| Original Web Module (TS / Node / React) | Python Stack Equivalent (`python_aegis/`) | Library / Framework |
| --- | --- | --- |
| `src/types/*` (`CORE_8`, `ALL_18`, Roster, Kits, 22 Categories, 10 Red Flags) | `contracts.py` | Python `dataclasses` & typing |
| `src/utils/aegisPureEngine.ts` (Baselines, Rules, SHA-256 Audit Chain, RBAC, Handoff) | `aegis_engine.py` | Pure Python stdlib (`hashlib`, `json`, `datetime`) |
| `src/utils/lifeSafetyEngine.ts` (8-Channel ECLSS, Check-In Escalation, Resource Filter) | `life_safety_engine.py` | Pure Python stdlib |
| `src/utils/approvedMedicalLibrary.ts` (Urgent Screening, Non-Fabrication Guardrails) | `medical_guidance_engine.py` | Pure Python stdlib |
| Firebase Web SDK (`firestore.rules` `/users/{uid}/opsRecords`) | `firebase_store.py` | `firebase-admin` + local JSON offline queue fallback |
| `server.ts` (Express + `@google/genai`) | `api_server.py` | **FastAPI** + **google-genai** (with stdlib HTTP fallback) |
| `src/pages/*` (Card-first mission workspace) | `streamlit_app.py` | **Streamlit** |
| `src/utils/*.test.ts` | `test_aegis_python.py` | `unittest` / **pytest** |

## Local Setup & Run Commands

```bash
# 1. Install familiar Python packages
python -m venv .venv
source .venv/bin/activate
pip install -r python_aegis/requirements.txt

# 2. Run the FastAPI + Google GenAI API server
export GEMINI_API_KEY="your-key"
uvicorn python_aegis.api_server:app --reload --port 8000

# 3. Run the Streamlit interactive frontend
streamlit run python_aegis/streamlit_app.py --server.port 8501

# 4. Run Python unit & API integration tests (also runs cleanly with stdlib unittest)
python -m unittest discover -s python_aegis -v
# or with pytest:
pytest python_aegis/test_aegis_python.py -v
```
