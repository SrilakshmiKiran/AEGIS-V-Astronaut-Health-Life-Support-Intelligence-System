# AEGIS-V 🚀
### Astronaut Health & Life-Support Intelligence System

**When Earth is far away, every decision matters.**

AEGIS-V is a research-informed astronaut health monitoring and mission-support platform designed to help crew members monitor health indicators, identify potential risks, understand alerts, access emergency guidance, and maintain operational continuity during space missions.

Developed by **Team VITRAXIS** for the **NASA Space Apps Challenge 2026**.

<p align="center">
  <a href="https://aegis-v.ai.studio"><strong>🌐 Live Prototype</strong></a> •
  <a href="https://github.com/SrilakshmiKiran/AEGIS-V-Astronaut-Health-Life-Support-Intelligence-System"><strong>💻 GitHub Repository</strong></a>
</p>

---

## 🌌 The Problem

Human spaceflight exposes astronauts to five major hazards:

- **Space Radiation:** Exposure to radiation beyond Earth's protective atmosphere.
- **Isolation and Confinement:** Extended separation and restricted living conditions can affect physical and psychological well-being.
- **Distance from Earth:** Communication delays can make immediate ground support difficult.
- **Altered Gravity:** Microgravity can affect cardiovascular function, fluid distribution, vision, and physical performance.
- **Hostile and Closed Environments:** Spacecraft environments require continuous attention to crew health and environmental conditions.

Monitoring individual readings is not enough. Astronauts also need to understand changing health patterns, recognise warning signs, and access useful information when communication with Earth is delayed or unavailable.

## 💡 Our Solution

AEGIS-V brings astronaut health monitoring, deterministic risk analysis, AI-assisted explanations, emergency guidance, and mission-continuity workflows into one integrated application.

It is designed to help answer three important questions:

1. What is changing?
2. Why might it matter?
3. What information or response steps should the crew consider next?

## 🛰️ Key Features

### 1. Health Intelligence
- Centralised astronaut health dashboard.
- Monitoring of 18 health and environmental indicators.
- Personal-baseline comparisons and trend visualisation.
- Data-quality checks for missing, stale, implausible, or unreliable readings.
- Daily health check-ins and subjective symptom reporting.

### 2. Explainable Risk Analysis
- Deterministic rule-based analysis of selected health and environmental patterns.
- Alert severity and incident tracking.
- Explanations linked to the readings and rules that triggered an alert.
- Post-response monitoring and incident follow-up.

### 3. AI-Assisted Astronaut Support
- Gemini-powered health summaries and explanations.
- Conversational onboard assistant.
- Voice transcription support.
- Optional camera-image interaction.
- Context-aware responses using available mission and health information.

AI-assisted output is kept separate from deterministic alert generation. The assistant is intended to explain information, not independently establish a medical diagnosis.

### 4. Emergency Medical Guidance
- Structured first-response guidance.
- Symptom and incident documentation.
- Emergency checklists.
- Medical knowledge resources.
- Consultation and handoff information.

### 5. Life-Safety Sentinel
- Environmental and health-related safety awareness.
- Emergency event recording.
- Crew acknowledgement and escalation workflows.
- Monitoring of unresolved concerns and communication status.

### 6. Mission Continuity
- Continuity workflows for simulated Earth-communication interruptions.
- Crew availability and role-awareness features.
- Medical equipment inventory and readiness tracking.
- Guided procedure catalogues with role-based restrictions.
- Local queuing of selected actions while disconnected.
- Structured Earth handoff packages in Markdown and JSON.
- Synchronisation workflows when connectivity returns.

### 7. Additional Mission Modules
- Cabin radiation and air monitoring.
- EVA and spacesuit readiness.
- Medical kit and countermeasure inventory.
- Cognitive readiness and performance tracking.
- Body atlas and spaceflight hazard information.
- Shift routines and handover summaries.
- Reports, storage, and incident history.
- Voice memos and diagnostic scan storage.

## 🫀 Health and Environmental Parameters

The prototype organises 18 indicators across four categories.

| Category | Parameters |
|---|---|
| Core physiology and environment | Heart rate, SpO₂, systolic blood pressure, diastolic blood pressure, skin temperature, respiration rate, radiation exposure, cabin CO₂ |
| Sleep and activity | Sleep duration, sleep quality, exercise completion, fatigue |
| Vision and fluid-related indicators | Visual symptom severity, intraocular pressure, thigh-cuff adherence |
| Nutrition and hydration | Caloric intake, hydration, appetite |

The platform compares available readings with a personal reference baseline and evaluates data quality before using observations in its analysis.

## 🔄 System Workflow

```text
MONITOR
   ↓
VALIDATE
   ↓
COMPARE WITH BASELINE
   ↓
ANALYZE
   ↓
EXPLAIN
   ↓
RESPOND
   ↓
ESCALATE
   ↓
FOLLOW UP
   ↓
PRESERVE HISTORY
```

1. **Monitor:** Collect or organise available health and environmental observations.
2. **Validate:** Check data quality, timestamps, and reliability.
3. **Compare:** Evaluate readings against the configured personal baseline.
4. **Analyze:** Apply deterministic rules to identify selected risk patterns.
5. **Explain:** Present the context and evidence behind alerts.
6. **Respond:** Provide relevant emergency information and checklists.
7. **Escalate:** Support acknowledgement and consultation workflows.
8. **Follow up:** Record subsequent observations and response progress.
9. **Preserve history:** Maintain records and prepare information for handover.

## 🧠 Technology Stack

| Technology | Role |
|---|---|
| React | User interface |
| TypeScript | Application logic and type safety |
| Firebase Authentication | User authentication |
| Cloud Firestore | Cloud-backed workspace and records |
| IndexedDB | Local persistence for selected data and offline queues |
| Google Gemini API | AI-assisted summaries, chat, and voice-related capabilities |
| Express | Server-side API endpoints |
| Vite | Development and production build tooling |
| Bun | Dependency and script management |

### Intelligence Architecture

AEGIS-V uses two complementary approaches:

**Deterministic intelligence**
- Evaluates configured rules and telemetry conditions.
- Performs baseline comparisons and data-quality checks.
- Generates structured findings and alerts.

**AI-assisted intelligence**
- Uses Gemini to explain available health and mission context.
- Supports conversational assistance and summaries.
- Can process supported camera-image and voice inputs.

This separation helps ensure that AI-generated explanations are not mistaken for the underlying deterministic alert logic.

## 📡 Offline and Data Continuity

The application uses IndexedDB for selected locally stored information, including offline action queues, voice memos, and diagnostic scan images.

Its continuity workflows support recording selected actions locally and preparing information for synchronisation when connectivity returns.

**Important:** This does not mean every application feature works without a network connection. Firebase cloud services and Gemini-powered functions require connectivity.

## 🔬 Research and Scientific Context

AEGIS-V uses publicly available NASA and Canadian Space Agency resources to inform its research and design approach.

Selected references:

- [NASA — Five Hazards of Human Spaceflight](https://www.nasa.gov/hrp/5-hazards-of-human-spaceflight/)
- [NASA — Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/)
- [NASA — Ongoing Human Research Program Research](https://www.nasa.gov/hrp/ongoing-hrp-research/)
- [NASA — ARCHeR](https://www.nasa.gov/reference/archer/)
- [NASA — Thigh Cuff](https://www.nasa.gov/reference/thigh-cuff/)
- [NASA — Food and Nutrition in Spaceflight](https://www.nasa.gov/wp-content/uploads/2023/03/food-and-nutrition-technical-brief-ochmo.pdf)
- [Canadian Space Agency — Radiation Monitoring and Astronaut Health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp)
- [Canadian Space Agency — International Space Station Science](https://www.asc-csa.gc.ca/eng/iss/science/)

These references provide scientific context. They should not be interpreted as evidence that AEGIS-V directly ingests live NASA or CSA datasets.

## 🛠️ Getting Started

### Prerequisites
- Bun installed.
- Access to the Firebase project configuration.
- A Gemini API key for AI-powered server features.

### Installation

Clone the repository:

```bash
git clone https://github.com/SrilakshmiKiran/AEGIS-V-Astronaut-Health-Life-Support-Intelligence-System.git

cd AEGIS-V-Astronaut-Health-Life-Support-Intelligence-System
```

Install dependencies:

```bash
bun install
```

Configure environment variables using `.env.example` as a reference.

At minimum, configure `GEMINI_API_KEY` for the server-side Gemini features. Never commit private API keys or credentials to the repository.

Start the development server:

```bash
bun run dev
```

Create a production build:

```bash
bun run build
```

## ⚠️ Prototype Scope and Limitations

AEGIS-V is a hackathon prototype and research-informed demonstration. It is not a certified medical or spacecraft safety system.

- The seeded 14-day personal baseline and demonstration telemetry are synthetic.
- The application data model includes simulated, manual-entry, imported, and verified-device source types. However, actual integration with operational spacecraft sensors has not been demonstrated.
- No live NASA telemetry or astronaut medical-record feed is connected.
- AI-generated information is not a medical diagnosis.
- Prototype thresholds and alerts have not been clinically validated for astronaut care.
- Emergency guidance does not replace approved mission medical procedures or professional medical judgement.
- Offline continuity applies to selected local workflows; the entire application is not guaranteed to operate offline.
- The application does not autonomously control spacecraft life-support systems.
- AEGIS-V is not flight-certified.

## 🚀 Future Scope

Potential future development includes:

- Integration with validated wearable and biomedical monitoring hardware.
- Secure ingestion of real-time health and environmental telemetry.
- More advanced personalised trend analysis.
- Improved radiation and environmental exposure modelling.
- Mission-specific medical protocols reviewed by domain experts.
- More robust offline synchronisation and fault tolerance.
- Testing against appropriate datasets and expert-reviewed procedures.
- Integration with authorised mission systems, subject to validation and certification.

## 👥 Team

**Team VITRAXIS**

**Project:** AEGIS-V — Astronaut Health & Life-Support Intelligence System

NASA Space Apps Challenge 2026  
Mysore, India

## 🔗 Project Links

- **Live Prototype:** https://aegis-v.ai.studio
- **GitHub Repository:** https://github.com/SrilakshmiKiran/AEGIS-V-Astronaut-Health-Life-Support-Intelligence-System

---

<p align="center">
  <strong>AEGIS-V</strong><br>
  <em>When Earth is far away, every decision matters.</em>
</p>

*Building toward a future where astronaut health information is more understandable, actionable, and resilient during humanity's journey beyond Earth.*
