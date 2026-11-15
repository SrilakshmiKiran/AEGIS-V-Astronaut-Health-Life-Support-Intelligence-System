import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, Type } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === "production";

interface TriageTelemetrySnapshot {
  parameter: string;
  value: number | string;
  unit: string;
  status: string;
  normalRange: string;
}

interface TriageRequestBody {
  astronautName?: string;
  missionEnvironment?: string;
  gravityLabel?: string;
  lightDelayLabel?: string;
  activityMode?: string;
  question?: string;
  latestMetrics?: TriageTelemetrySnapshot[];
  extendedBio?: {
    bloodGlucoseMgDl?: number | null;
    coreTempC?: number | null;
    recentScanCount?: number;
  };
  activeAlerts?: Array<{
    title: string;
    severity: string;
    state: string;
    ruleId: string;
  }>;
  earthWanConnected?: boolean;
}

interface AssistantChatRequestBody {
  agentName?: string;
  message?: string;
  wakeTriggered?: boolean;
  cameraActive?: boolean;
  imageBase64?: string;
  imageMimeType?: string;
  isAuthenticated?: boolean;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  context?: {
    astronautName?: string;
    activePage?: string;
    missionEnvironment?: string;
    gravityLabel?: string;
    lightDelayLabel?: string;
    activityMode?: string;
    earthWanConnected?: boolean;
    routineProgress?: string;
    latestMetrics?: TriageTelemetrySnapshot[];
    extendedBio?: {
      bloodGlucoseMgDl?: number | null;
      coreTempC?: number | null;
      recentScanCount?: number;
    };
    activeAlerts?: Array<{
      title: string;
      severity: string;
      state: string;
      ruleId: string;
    }>;
  };
}

interface VoiceTranscribeRequestBody {
  audioBase64?: string;
  mimeType?: string;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: "4mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      service: "aegis-v-onboard-node",
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.post("/api/triage-summary", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        ok: false,
        error: "Server Gemini key is not configured for live AI triage.",
      });
      return;
    }

    const body = (req.body || {}) as TriageRequestBody;
    const question =
      typeof body.question === "string" && body.question.trim().length > 0
        ? body.question.trim().slice(0, 600)
        : "Summarize current health readings, explain any outside-range trends in plain English, and suggest safe preventive crew actions.";

    const metricsLines = Array.isArray(body.latestMetrics)
      ? body.latestMetrics
          .slice(0, 20)
          .map(
            (m) =>
              `- ${m.parameter}: ${m.value} ${m.unit} (Personal normal: ${m.normalRange}, Status: ${m.status})`
          )
          .join("\n")
      : "No telemetry metrics provided.";

    const alertsLines =
      Array.isArray(body.activeAlerts) && body.activeAlerts.length > 0
        ? body.activeAlerts
            .slice(0, 8)
            .map((a) => `- [${a.severity}] ${a.title} (${a.ruleId}, State: ${a.state})`)
            .join("\n")
        : "None active.";

    const extendedBioText = body.extendedBio
      ? `Blood Glucose: ${
          body.extendedBio.bloodGlucoseMgDl !== null &&
          body.extendedBio.bloodGlucoseMgDl !== undefined
            ? `${body.extendedBio.bloodGlucoseMgDl} mg/dL`
            : "Not logged today"
        }; Core Body Temp: ${
          body.extendedBio.coreTempC !== null && body.extendedBio.coreTempC !== undefined
            ? `${body.extendedBio.coreTempC} °C`
            : "Not logged today"
        }; Saved Diagnostic Scans: ${Number(body.extendedBio.recentScanCount || 0)}`
      : "No extended bio check-in logged yet.";

    const promptText = [
      `Astronaut: ${body.astronautName || "Crew Member"}`,
      `Mission Environment: ${body.missionEnvironment || "Space Station (LEO)"} (${
        body.gravityLabel || "0g Microgravity"
      })`,
      `Activity Context: ${body.activityMode || "RESTING"}`,
      `Earth Link & Light Delay: ${
        body.earthWanConnected === false ? "Earth Link Offline" : "Earth Link Online"
      } · ${body.lightDelayLabel || "~3 sec round-trip"}`,
      `Extended Bio Check-In: ${extendedBioText}`,
      "",
      "Latest Verified Telemetry vs 14-Day Personal Normal Range:",
      metricsLines,
      "",
      "Active Alerts:",
      alertsLines,
      "",
      `Crew Question: ${question}`,
    ].join("\n");

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: promptText,
        config: {
          systemInstruction: [
            "You are AEGIS-V's onboard spaceflight health decision-support helper for astronauts.",
            "Always remember this is a prototype educational/operational decision-support tool, NOT a medical diagnosis or replacement for a NASA Flight Surgeon.",
            "Write in calm, clear, plain English that an astronaut under stress or communications delay can follow immediately.",
            "Ground EVERY observation strictly in the provided measurements, active alerts, and NASA Human Research Program 5 spaceflight hazards (Radiation, Isolation/Confinement, Distance from Earth, Altered Gravity, Closed Environments).",
            "Do NOT invent values or cite sensors not present in the prompt.",
          ].join(" "),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description:
                  "Concise 2-3 sentence plain-English assessment of current astronaut status grounded in the provided numbers.",
              },
              hazardContext: {
                type: Type.STRING,
                description:
                  "Brief explanation of how NASA's 5 spaceflight hazards relate to these readings in the current mission environment.",
              },
              suggestedActions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  "3 to 4 concrete, safe preventive self-care or cabin check actions the crew member can perform onboard.",
              },
              whenToEscalate: {
                type: Type.STRING,
                description:
                  "Clear criteria for when this warrants Crew Medical Officer or Ground Flight Surgeon attention.",
              },
              citedMetrics: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Exact metric values from the input that support this guidance.",
              },
            },
            required: [
              "summary",
              "hazardContext",
              "suggestedActions",
              "whenToEscalate",
              "citedMetrics",
            ],
          },
        },
      });

      const raw = (response.text || "{}").trim();
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      res.json({
        ok: true,
        model: "gemini-4-hydrogen",
        generatedAtIso: new Date().toISOString(),
        disclaimer:
          "AI-Assisted Prototype Decision Support — grounded in onboard telemetry; consult Crew Medical Officer or Flight Surgeon for clinical decisions.",
        guidance: parsed,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Gemini request failed.";
      res.status(502).json({
        ok: false,
        error: `Onboard AI triage failed: ${msg}`,
      });
    }
  });

  app.post("/api/assistant-chat", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        ok: false,
        error: "Server Gemini key is not configured.",
      });
      return;
    }

    const body = (req.body || {}) as AssistantChatRequestBody;
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 800) : "";
    if (!message) {
      res.status(400).json({ ok: false, error: "Message is required." });
      return;
    }

    const agentName =
      typeof body.agentName === "string" && body.agentName.trim()
        ? body.agentName.trim().slice(0, 24)
        : "Aegis";
    const isAuthenticated = Boolean(body.isAuthenticated);
    const ctx = body.context || {};

    const historyText = Array.isArray(body.history)
      ? body.history
          .slice(-8)
          .map((h) => `${h.role === "user" ? "Astronaut" : agentName}: ${String(h.text || "").slice(0, 300)}`)
          .join("\n")
      : "";

    const metricsSummary =
      isAuthenticated && Array.isArray(ctx.latestMetrics) && ctx.latestMetrics.length > 0
        ? ctx.latestMetrics
            .slice(0, 18)
            .map((m) => `- ${m.parameter}: ${m.value} ${m.unit} (Normal: ${m.normalRange}, Status: ${m.status})`)
            .join("\n")
        : "No signed-in personal telemetry attached.";

    const alertsSummary =
      isAuthenticated && Array.isArray(ctx.activeAlerts) && ctx.activeAlerts.length > 0
        ? ctx.activeAlerts
            .slice(0, 8)
            .map((a) => `- [${a.severity}] ${a.title} (${a.state})`)
            .join("\n")
        : "None active.";

    const bioSummary =
      isAuthenticated && ctx.extendedBio
        ? `Blood Glucose: ${ctx.extendedBio.bloodGlucoseMgDl ?? "Not logged"} mg/dL; Core Temp: ${
            ctx.extendedBio.coreTempC ?? "Not logged"
          } °C; Diagnostic Scans Saved: ${ctx.extendedBio.recentScanCount ?? 0}`
        : "Not logged or signed out.";

    const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const rawImageBase64 =
      typeof body.imageBase64 === "string" ? body.imageBase64.trim() : "";
    const cleanImageBase64 = rawImageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
    const hasValidImage = cleanImageBase64.length > 64 && cleanImageBase64.length <= 3_500_000;
    const imageMimeType =
      typeof body.imageMimeType === "string" && allowedImageTypes.has(body.imageMimeType)
        ? body.imageMimeType
        : "image/jpeg";

    const promptText = [
      `Assistant Wake Name: ${agentName}`,
      `Session Signed In: ${isAuthenticated ? "YES" : "NO (Public Landing Page)"}`,
      `Live Camera Examination Active: ${body.cameraActive ? "YES" : "NO"}`,
      `Camera Frame Attached: ${hasValidImage ? "YES — inspect the attached live camera frame carefully." : "NO"}`,
      `Current Screen: ${ctx.activePage || "home"}`,
      isAuthenticated
        ? [
            `Crew Member: ${ctx.astronautName || "Crew Operator"}`,
            `Mission Environment: ${ctx.missionEnvironment || "ISS_LEO"} (${ctx.gravityLabel || "0g"})`,
            `Activity Mode: ${ctx.activityMode || "RESTING"}`,
            `Earth Link: ${ctx.earthWanConnected === false ? "Offline" : "Online"} · ${ctx.lightDelayLabel || "~3 sec"}`,
            `Routine Progress: ${ctx.routineProgress || "0/5 tasks"}`,
            `Extended Bio: ${bioSummary}`,
            "Latest Telemetry:",
            metricsSummary,
            "Active Alerts:",
            alertsSummary,
          ].join("\n")
        : "Note: The user is currently on the public Page 1 showcase before Google Sign-In. You may still describe what you see in the attached camera frame if one is present, and explain how AEGIS-V works, while noting personal telemetry requires Google Sign-In.",
      "",
      historyText ? `Recent Conversation:\n${historyText}\n` : "",
      `User Request (${body.wakeTriggered ? "Spoken via Wake Word" : "Voice/Chat"}): ${message}`,
    ].join("\n");

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const contents = hasValidImage
        ? {
            parts: [
              {
                inlineData: {
                  mimeType: imageMimeType,
                  data: cleanImageBase64,
                },
              },
              { text: promptText },
            ],
          }
        : promptText;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents,
        config: {
          systemInstruction: [
            `You are ${agentName}, the onboard AI multimodal camera & voice health assistant inside AEGIS-V (an astronaut health monitoring web app built for the NASA Space Apps Challenge).`,
            "Respond concisely (2 to 4 crisp, conversational, spoken-ready sentences unless more detail is asked) in plain, calm human language.",
            "Remember AEGIS-V is educational/operational decision support, NOT a clinical diagnosis or replacement for a NASA Flight Surgeon.",
            hasValidImage
              ? "A live camera image from the astronaut is attached. Describe clearly and honestly what is visible (for example: facial alertness or fatigue cues, posture, eye/skin appearance if clearly visible, lighting/surroundings, or anything held to the camera), and correlate it with their onboard telemetry and NASA's 5 Spaceflight Hazards. If visibility is dark, blurry, or obscured, tell them kindly how to adjust framing or lighting. NEVER fabricate numeric vitals (such as heart rate or blood pressure) from a photo alone."
              : "Ground all numeric claims strictly in the provided telemetry and NASA HRP 5 Spaceflight Hazards (Space Radiation, Isolation & Confinement, Distance from Earth, Gravity Fields, Closed Environments). Never invent sensor values.",
            "If the user asks to navigate to a screen, switch mission environment, run a demo scenario, launch the tour, or minimize/close the camera, populate appAction accordingly:",
            "- NAVIGATE targets: 'home', 'body-map', 'live-vitals', 'daily-checkin', 'alerts-response', 'cabin-radiation', 'reports-library', 'storage-history', 'eva-readiness', 'med-kit', 'cognitive-readiness', 'landing'",
            "- ENVIRONMENT targets: 'ISS_LEO', 'TRANSIT_SPACECRAFT', 'LUNAR_BASE', 'MARS_ROVER'",
            "- SCENARIO targets: 'SCENE_1_NORMAL', 'SCENE_2_GRADUAL_ANOMALY', 'SCENE_3_EXPLAIN', 'SCENE_4_EARTH_UNAVAILABLE'",
            "- START_TOUR target: 'start'",
            "- CAMERA targets: 'minimize_pip' (shrink camera to corner), 'fullscreen' (expand camera), 'close' (stop camera and minimize to bar)",
            "- Otherwise set type to 'NONE' and target to ''.",
          ].join(" "),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: "Direct, clear, spoken-ready answer combining visual observations and telemetry.",
              },
              visualObservation: {
                type: Type.STRING,
                description:
                  "Short 1-sentence summary of what is visible in the camera frame, or empty string if no camera frame was attached.",
              },
              suggestedFollowUps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "2 to 3 short follow-up questions the user can tap or say next.",
              },
              appAction: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description: "One of: NONE, NAVIGATE, ENVIRONMENT, SCENARIO, START_TOUR, CAMERA",
                  },
                  target: {
                    type: Type.STRING,
                    description: "Exact target ID or empty string if NONE.",
                  },
                  label: {
                    type: Type.STRING,
                    description: "Short human label of the executed action, or empty string.",
                  },
                },
                required: ["type", "target", "label"],
              },
            },
            required: ["reply", "visualObservation", "suggestedFollowUps", "appAction"],
          },
        },
      });

      const parsed = JSON.parse((response.text || "{}").trim()) as Record<string, unknown>;
      res.json({
        ok: true,
        model: "gemini-4-hydrogen",
        data: parsed,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Assistant request failed.";
      res.status(502).json({
        ok: false,
        error: `Assistant failed: ${msg}`,
      });
    }
  });

  app.post("/api/voice-transcribe", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ ok: false, error: "Server Gemini key is not configured." });
      return;
    }

    const body = (req.body || {}) as VoiceTranscribeRequestBody;
    const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64.trim() : "";
    const mimeType =
      typeof body.mimeType === "string" && body.mimeType.startsWith("audio/")
        ? body.mimeType.split(";")[0]
        : "audio/webm";

    if (!audioBase64) {
      res.status(400).json({ ok: false, error: "audioBase64 is required." });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-transcribe",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: "Transcribe the spoken astronaut voice command cleanly in English. Output only the spoken words without extra commentary.",
            },
          ],
        },
      });

      res.json({
        ok: true,
        transcript: (response.text || "").trim(),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Voice transcription failed.";
      res.status(502).json({
        ok: false,
        error: `Voice transcription failed: ${msg}`,
      });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AEGIS-V server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
