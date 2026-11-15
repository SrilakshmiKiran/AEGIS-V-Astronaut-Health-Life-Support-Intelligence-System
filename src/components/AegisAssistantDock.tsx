import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  ChevronDown,
  ChevronUp,
  Ear,
  Eye,
  EyeOff,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Save,
  ScanFace,
  Send,
  Settings2,
  SwitchCamera,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { AegisBrandIcon } from "./AegisBrandIcon";
import {
  BaselineProfile,
  IncidentRecord,
  PARAMETER_METADATA,
  TelemetryLatestResponse,
} from "../types/aegisContracts";
import { PageId } from "../types/navigation";
import {
  ActivityMode,
  BodyRegionId,
  DiagnosticScanEntry,
  ExtendedBioSummary,
  LIGHT_DELAY_META,
  LightDelayMode,
  MISSION_ENVIRONMENT_META,
  MISSION_ROUTINE_TASKS,
  RoutineGamificationState,
} from "../types/opsContracts";

export interface AssistantActionRequest {
  type: "NONE" | "NAVIGATE" | "ENVIRONMENT" | "SCENARIO" | "START_TOUR" | "CAMERA";
  target: string;
  label: string;
}

type AssistantViewMode = "collapsed" | "drawer" | "pip" | "fullscreen";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  visualObservation?: string;
  capturedThumbUrl?: string;
  source?: "voice-wake" | "voice-ptt" | "text" | "camera";
  actionLabel?: string;
  followUps?: string[];
  timestampLabel: string;
}

interface AegisAssistantDockProps {
  isAuthenticated: boolean;
  activePage: PageId;
  astronautName: string;
  baseline: BaselineProfile;
  latest: TelemetryLatestResponse;
  incidents: IncidentRecord[];
  earthWanConnected: boolean;
  activityMode: ActivityMode;
  lightDelayMode: LightDelayMode;
  routineState: RoutineGamificationState;
  extendedBio: ExtendedBioSummary | null;
  storedScansCount: number;
  onExecuteAction: (action: AssistantActionRequest) => Promise<string | null>;
  onSaveCameraScan?: (input: {
    bodyRegion: BodyRegionId;
    modality: DiagnosticScanEntry["modality"];
    caption: string;
    imageDataUrl: string;
    mimeType: string;
    sizeBytes: number;
  }) => Promise<void>;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function getWakeAliases(agentName: string): string[] {
  const clean = agentName.trim().toLowerCase();
  if (!clean) return ["aegis", "ages", "egis", "aejis", "ajis"];
  if (clean === "aegis") {
    return ["aegis-v", "aegis v", "aegis", "ages", "egis", "aejis", "ajis"];
  }
  return [clean];
}

function extractWakeCommand(
  transcript: string,
  agentName: string
): { matched: boolean; trailingCommand: string } {
  const normalized = transcript
    .toLowerCase()
    .replace(/[.,!?;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return { matched: false, trailingCommand: "" };

  const aliases = getWakeAliases(agentName);
  for (const alias of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `(?:^|\\b)(?:hey\\s+|ok\\s+|okay\\s+|hi\\s+|hello\\s+)?${escaped}(?:\\b|$)(.*)`,
      "i"
    );
    const match = normalized.match(pattern);
    if (match) {
      const trailing = (match[1] || "").trim();
      return { matched: true, trailingCommand: trailing };
    }
  }
  return { matched: false, trailingCommand: "" };
}

function detectLocalCameraUiCommand(
  text: string
): { kind: "minimize_pip" | "fullscreen" | "close_camera" | "hide_hud" | "show_hud"; reply: string } | null {
  const q = text.toLowerCase().trim();
  if (
    q.includes("minimize camera") ||
    q.includes("minimize to corner") ||
    q.includes("picture in picture") ||
    q.includes("shrink camera") ||
    q === "minimize" ||
    q === "minimize it"
  ) {
    return {
      kind: "minimize_pip",
      reply: "Minimizing camera to the corner window so you can keep navigating while I stay active.",
    };
  }
  if (q.includes("hide panel") || q.includes("minimize panel") || q.includes("hide hud") || q.includes("hide chat")) {
    return {
      kind: "hide_hud",
      reply: "Minimizing the overlay controls so you have a clear full-screen camera view.",
    };
  }
  if (q.includes("show panel") || q.includes("expand panel") || q.includes("show hud")) {
    return {
      kind: "show_hud",
      reply: "Restoring the examination controls.",
    };
  }
  if (q.includes("full screen") || q.includes("fullscreen") || q.includes("expand camera")) {
    return {
      kind: "fullscreen",
      reply: "Expanding camera examination back to full screen.",
    };
  }
  if (q.includes("close camera") || q.includes("stop camera") || q.includes("turn off camera")) {
    return {
      kind: "close_camera",
      reply: "Closing the camera stream and minimizing back to the assistant bar.",
    };
  }
  return null;
}

function playWakeChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.14);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);
  } catch {
    // ignore audio chime errors if autoplay blocked
  }
}

function buildLocalFallbackResponse(
  message: string,
  opts: {
    agentName: string;
    isAuthenticated: boolean;
    cameraActive: boolean;
    hasFrame: boolean;
    baseline: BaselineProfile;
    latest: TelemetryLatestResponse;
    incidents: IncidentRecord[];
    routineState: RoutineGamificationState;
    extendedBio: ExtendedBioSummary | null;
  }
): {
  reply: string;
  visualObservation: string;
  followUps: string[];
  action: AssistantActionRequest;
} {
  const q = message.toLowerCase();

  if (!opts.isAuthenticated) {
    if (q.includes("hazard") || q.includes("nasa") || q.includes("space")) {
      return {
        reply:
          "AEGIS-V maps NASA's 5 human spaceflight hazards—Space Radiation, Isolation & Confinement, Distance from Earth, Altered Gravity, and Closed Environments—to 18 live health metrics, a clickable Body Atlas, and preventive checklists. Sign in with Google to ask about personal readings.",
        visualObservation: opts.hasFrame
          ? "Camera frame captured while signed out; live telemetry context requires Google Sign-In."
          : "",
        followUps: ["What does AEGIS-V monitor?", "Minimize camera"],
        action: { type: "NONE", target: "", label: "" },
      };
    }
    return {
      reply: `I am ${opts.agentName}, your onboard AEGIS-V camera and voice health assistant.${
        opts.hasFrame
          ? " I captured your live camera frame, and once you sign in with Google I can combine visual inspection with your 18 vitals and NASA baseline."
          : " Sign in with Google to connect personal telemetry with visual and voice checks."
      }`,
      visualObservation: opts.hasFrame ? "Live camera frame captured locally." : "",
      followUps: ["What are NASA's 5 hazards?", "Minimize camera"],
      action: { type: "NONE", target: "", label: "" },
    };
  }

  // Action matching
  if (q.includes("mars")) {
    return {
      reply: "Switching your mission environment to Mars Surface / Rover Ops (0.38g) with extended signal delay simulation.",
      visualObservation: "",
      followUps: ["What changes on Mars?", "Check my vitals"],
      action: { type: "ENVIRONMENT", target: "MARS_ROVER", label: "Switched to Mars Base (0.38g)" },
    };
  }
  if (q.includes("lunar") || q.includes("moon") || q.includes("gateway")) {
    return {
      reply: "Switching your mission environment to Lunar Base / Gateway (0.16g).",
      visualObservation: "",
      followUps: ["Open Body Map", "Check radiation dose"],
      action: { type: "ENVIRONMENT", target: "LUNAR_BASE", label: "Switched to Lunar Base (0.16g)" },
    };
  }
  if (q.includes("transit") || q.includes("deep space") || q.includes("spacecraft")) {
    return {
      reply: "Switching your mission environment to Deep-Space Transit Spacecraft.",
      visualObservation: "",
      followUps: ["Check radiation dose", "Open Body Map"],
      action: { type: "ENVIRONMENT", target: "TRANSIT_SPACECRAFT", label: "Switched to Transit Spacecraft" },
    };
  }
  if (q.includes("station") || q.includes("iss") || q.includes("leo")) {
    return {
      reply: "Switching your mission environment back to Space Station (LEO, 0g).",
      visualObservation: "",
      followUps: ["Show my vitals", "Check active alerts"],
      action: { type: "ENVIRONMENT", target: "ISS_LEO", label: "Switched to Space Station (LEO)" },
    };
  }
  if (q.includes("simulate") && (q.includes("co2") || q.includes("drift") || q.includes("fatigue"))) {
    return {
      reply: "Activating CO2 & Fatigue Drift scenario so you can observe rising cabin CO2, oxygen dip, and alert explanations.",
      visualObservation: "",
      followUps: ["Open Alerts", "Reset to normal scenario"],
      action: { type: "SCENARIO", target: "SCENE_2_GRADUAL_ANOMALY", label: "Simulated CO2 & Fatigue Drift" },
    };
  }
  if (q.includes("reset") && (q.includes("normal") || q.includes("scenario"))) {
    return {
      reply: "Restoring normal mission telemetry inside your 14-day personal baseline.",
      visualObservation: "",
      followUps: ["Check my vitals", "Open Body Map"],
      action: { type: "SCENARIO", target: "SCENE_1_NORMAL", label: "Reset to Normal Scenario" },
    };
  }
  if (q.includes("tour") || q.includes("guide") || q.includes("walkthrough")) {
    return {
      reply: "Opening the interactive onboarding tour now.",
      visualObservation: "",
      followUps: ["Open Body Map", "Check my vitals"],
      action: { type: "START_TOUR", target: "start", label: "Started Interactive Tour" },
    };
  }
  if (q.includes("body") || q.includes("atlas") || q.includes("sans") || q.includes("organ")) {
    return {
      reply: "Opening the Crew Body Atlas & NASA 5 Hazards Explorer so you can inspect each body system.",
      visualObservation: "",
      followUps: ["Why check eye pressure?", "Show my vitals"],
      action: { type: "NAVIGATE", target: "body-map", label: "Opened Body Atlas" },
    };
  }
  if (q.includes("alert") || q.includes("warning") || q.includes("incident")) {
    const active = opts.incidents.filter((i) => i.state !== "CLOSED_RETAINED");
    return {
      reply:
        active.length > 0
          ? `There ${active.length === 1 ? "is 1 active alert" : `are ${active.length} active alerts`}: ${active
              .slice(0, 2)
              .map((a) => a.title)
              .join("; ")}. Opening Alerts & Response now.`
          : "All systems are currently clear with zero active health alerts. Opening Alerts & Response.",
      visualObservation: "",
      followUps: ["Check my vitals", "Open Cabin Air & Radiation"],
      action: { type: "NAVIGATE", target: "alerts-response", label: "Opened Alerts & Response" },
    };
  }
  if (q.includes("check-in") || q.includes("checkin") || q.includes("blood sugar") || q.includes("voice memo")) {
    return {
      reply: "Opening Daily Check-In where you can log Blood Sugar, Core Temp, 45s Voice Memos, and Camera/Ultrasound scans.",
      visualObservation: "",
      followUps: ["Check my vitals", "Open Home Dashboard"],
      action: { type: "NAVIGATE", target: "daily-checkin", label: "Opened Daily Check-In" },
    };
  }
  if (q.includes("cabin") || q.includes("co2") || q.includes("radiation")) {
    const co2 = opts.latest.latest_by_parameter.cabin_co2_mmhg;
    const rad = opts.latest.latest_by_parameter.radiation_msv_hr;
    return {
      reply: `Cabin CO2 is ${co2 ? `${co2.value} ${co2.unit}` : "unavailable"} and radiation dose rate is ${
        rad ? `${rad.value} ${rad.unit}` : "unavailable"
      }. Opening Cabin Air & Radiation details.`,
      visualObservation: "",
      followUps: ["Any active alerts?", "Open Body Map"],
      action: { type: "NAVIGATE", target: "cabin-radiation", label: "Opened Cabin Air & Radiation" },
    };
  }
  if (q.includes("eva") || q.includes("suit") || q.includes("spacewalk")) {
    return {
      reply: "Opening EVA & Suit Readiness so you can review suit oxygen pressure and pre-breathe status.",
      visualObservation: "",
      followUps: ["Check my vitals", "Open Med Kit"],
      action: { type: "NAVIGATE", target: "eva-readiness", label: "Opened EVA & Suit Readiness" },
    };
  }
  if (q.includes("med") || q.includes("kit") || q.includes("supply")) {
    return {
      reply: "Opening Med Kit & Countermeasures inventory.",
      visualObservation: "",
      followUps: ["Open Cognitive Check", "Return Home"],
      action: { type: "NAVIGATE", target: "med-kit", label: "Opened Med Kit" },
    };
  }
  if (q.includes("cognitive") || q.includes("pvt") || q.includes("reaction")) {
    return {
      reply: "Opening Cognitive & Behavioral Readiness for the Psychomotor Vigilance reaction test.",
      visualObservation: "",
      followUps: ["Check my sleep hours", "Return Home"],
      action: { type: "NAVIGATE", target: "cognitive-readiness", label: "Opened Cognitive Readiness" },
    };
  }
  if (q.includes("report") || q.includes("triage") || q.includes("doctor") || q.includes("library")) {
    return {
      reply: "Opening Doctor Reports & Autonomous AI Triage Helper.",
      visualObservation: "",
      followUps: ["Check active alerts", "Return Home"],
      action: { type: "NAVIGATE", target: "reports-library", label: "Opened Reports & AI Triage" },
    };
  }
  if (q.includes("home") || q.includes("dashboard")) {
    return {
      reply: "Returning to your Home Dashboard.",
      visualObservation: "",
      followUps: ["Check my vitals", "Show mission routine progress"],
      action: { type: "NAVIGATE", target: "home", label: "Returned to Home Dashboard" },
    };
  }

  // Telemetry summary fallback
  const hr = opts.latest.latest_by_parameter.heart_rate_bpm;
  const spo2 = opts.latest.latest_by_parameter.spo2_pct;
  const co2 = opts.latest.latest_by_parameter.cabin_co2_mmhg;
  const sleep = opts.latest.latest_by_parameter.sleep_duration_hrs;
  const activeAlerts = opts.incidents.filter((i) => i.state !== "CLOSED_RETAINED");
  const envLabel = MISSION_ENVIRONMENT_META[opts.routineState.environmentMode].label;

  return {
    reply: `${
      opts.hasFrame
        ? "Camera frame captured locally (onboard AI vision server is currently offline, so I am grounding this check in your live telemetry). "
        : ""
    }Under ${envLabel}, Heart Rate is ${hr ? `${hr.value} bpm` : "N/A"}, SpO2 is ${
      spo2 ? `${spo2.value}%` : "N/A"
    }, Cabin CO2 is ${co2 ? `${co2.value} mmHg` : "N/A"}, and Sleep is ${
      sleep ? `${sleep.value} hrs` : "N/A"
    }${
      opts.extendedBio
        ? ` (Glucose ${opts.extendedBio.bloodGlucoseMgDl} mg/dL, Temp ${opts.extendedBio.coreTempC.toFixed(1)} °C)`
        : ""
    }. There ${activeAlerts.length === 1 ? "is 1 active alert" : `are ${activeAlerts.length} active alerts`}, and you have completed ${
      opts.routineState.completedTaskIds.length
    }/${MISSION_ROUTINE_TASKS.length} daily routine items.`,
    visualObservation: opts.hasFrame
      ? "Frame captured; live AI vision requires active server Gemini connection."
      : "",
    followUps: ["Any active alerts?", "Open Body Map", "Minimize camera"],
    action: { type: "NONE", target: "", label: "" },
  };
}

export const AegisAssistantDock: React.FC<AegisAssistantDockProps> = ({
  isAuthenticated,
  activePage,
  astronautName,
  baseline,
  latest,
  incidents,
  earthWanConnected,
  activityMode,
  lightDelayMode,
  routineState,
  extendedBio,
  storedScansCount,
  onExecuteAction,
  onSaveCameraScan,
}) => {
  const [viewMode, setViewMode] = useState<AssistantViewMode>("collapsed");
  const [hudMinimized, setHudMinimized] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [agentName, setAgentName] = useState<string>(() => {
    try {
      return window.localStorage.getItem("aegis_v_voice_agent_name") || "Aegis";
    } catch {
      return "Aegis";
    }
  });
  const [openCameraOnWake, setOpenCameraOnWake] = useState<boolean>(true);
  const [speakReplies, setSpeakReplies] = useState(true);

  const [wakeModeEnabled, setWakeModeEnabled] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [uploadedFrameDataUrl, setUploadedFrameDataUrl] = useState<string | null>(null);
  const [lastCapturedThumb, setLastCapturedThumb] = useState<string | null>(null);
  const [savingScan, setSavingScan] = useState(false);
  const [scanSavedNote, setScanSavedNote] = useState<string | null>(null);

  const [micState, setMicState] = useState<
    "idle" | "standby" | "awake" | "recording" | "transcribing"
  >("idle");
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "MSG_WELCOME",
      role: "assistant",
      text: 'Hello! I am Aegis, your onboard visual & voice health assistant. Turn on "Call Aegis" and say "Hey Aegis" to open full-screen camera examination automatically, or tap Camera Exam anytime. You can minimize me to a corner window or bar whenever you like.',
      followUps: isAuthenticated
        ? ["Analyze how I look right now", "Summarize my current vitals", "Any active alerts?"]
        : ["What does AEGIS-V monitor?", "Explain NASA's 5 spaceflight hazards"],
      timestampLabel: "Ready",
    },
  ]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const wakeArmedRef = useRef(false);
  const wakeArmedTimerRef = useRef<number | null>(null);
  const isSpeakingRef = useRef(false);
  const wakeEnabledRef = useRef(false);
  const cameraActiveRef = useRef(false);
  const viewModeRef = useRef<AssistantViewMode>("collapsed");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const latestSendRef = useRef<
    (
      text: string,
      source: "voice-wake" | "voice-ptt" | "text" | "camera",
      overrideImageDataUrl?: string | null
    ) => Promise<void>
  >(async () => {});

  useEffect(() => {
    wakeEnabledRef.current = wakeModeEnabled;
  }, [wakeModeEnabled]);

  useEffect(() => {
    cameraActiveRef.current = cameraActive;
  }, [cameraActive]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem("aegis_v_voice_agent_name", agentName.trim() || "Aegis");
    } catch {
      // ignore
    }
  }, [agentName]);

  useEffect(() => {
    if (viewMode === "drawer" || (viewMode === "fullscreen" && !hudMinimized)) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, viewMode, hudMinimized]);

  // Re-attach live MediaStream whenever viewMode switches between fullscreen and pip
  useEffect(() => {
    const videoEl = videoRef.current;
    const stream = cameraStreamRef.current;
    if (videoEl && stream && cameraActive && (viewMode === "fullscreen" || viewMode === "pip")) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      void videoEl.play().catch(() => {
        // autoplay may require mute, already muted
      });
    }
  }, [viewMode, cameraActive, hudMinimized]);

  const speechApiSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);

  const stopCameraStream = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraLoading(false);
  }, []);

  const startCameraStream = useCallback(
    async (requestedFacing: "user" | "environment" = facingMode): Promise<boolean> => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Live camera API is unavailable in this browser. You can upload a photo frame below for visual analysis."
        );
        return false;
      }

      setCameraLoading(true);
      setCameraError(null);
      setUploadedFrameDataUrl(null);

      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: requestedFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        cameraStreamRef.current = stream;
        setCameraActive(true);
        setCameraLoading(false);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        return true;
      } catch (err) {
        setCameraLoading(false);
        setCameraActive(false);
        const msg =
          err instanceof Error && err.name === "NotAllowedError"
            ? "Camera permission was blocked or not yet granted. Tap 'Allow Camera' below to start visual analysis."
            : err instanceof Error && err.name === "NotFoundError"
            ? "No camera hardware was found on this device. Upload a photo frame below to run visual analysis."
            : "Could not start live camera feed. Tap 'Allow Camera' or upload a photo frame.";
        setCameraError(msg);
        return false;
      }
    },
    [facingMode]
  );

  const captureLiveFrameDataUrl = useCallback((): string | null => {
    const video = videoRef.current;
    if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      const maxDim = 960;
      const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.max(160, Math.round(video.videoWidth * scale));
      const h = Math.max(120, Math.round(video.videoHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.84);
        setLastCapturedThumb(dataUrl);
        return dataUrl;
      }
    }
    if (uploadedFrameDataUrl) {
      setLastCapturedThumb(uploadedFrameDataUrl);
      return uploadedFrameDataUrl;
    }
    return null;
  }, [uploadedFrameDataUrl]);

  const waitForVideoFrameAndCapture = useCallback(async (): Promise<string | null> => {
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const snap = captureLiveFrameDataUrl();
      if (snap) return snap;
      await new Promise((r) => window.setTimeout(r, 150));
    }
    return null;
  }, [captureLiveFrameDataUrl]);

  const speakText = useCallback(
    (text: string, onDone?: () => void) => {
      if (!speakReplies || typeof window === "undefined" || !("speechSynthesis" in window)) {
        onDone?.();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.02;
        utterance.pitch = 1.0;
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(
          (v) => v.lang.startsWith("en") && !v.name.toLowerCase().includes("novelty")
        );
        if (preferred) utterance.voice = preferred;

        isSpeakingRef.current = true;
        utterance.onend = () => {
          window.setTimeout(() => {
            isSpeakingRef.current = false;
            onDone?.();
          }, 260);
        };
        utterance.onerror = () => {
          isSpeakingRef.current = false;
          onDone?.();
        };
        window.speechSynthesis.speak(utterance);
      } catch {
        isSpeakingRef.current = false;
        onDone?.();
      }
    },
    [speakReplies]
  );

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
  };

  const closeCameraAndMinimize = useCallback(() => {
    stopCameraStream();
    setUploadedFrameDataUrl(null);
    setCameraError(null);
    setHudMinimized(false);
    setViewMode("collapsed");
  }, [stopCameraStream]);

  const sendMessage = useCallback(
    async (
      rawText: string,
      source: "voice-wake" | "voice-ptt" | "text" | "camera",
      overrideImageDataUrl?: string | null
    ) => {
      const trimmed = rawText.trim();
      if (!trimmed || isSending) return;

      // Handle instant local camera/window UI voice commands cleanly
      const localUiCmd = detectLocalCameraUiCommand(trimmed);
      if (localUiCmd) {
        const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setMessages((prev) => [
          ...prev,
          { id: `USR_${Date.now()}`, role: "user", text: trimmed, source, timestampLabel: ts },
          {
            id: `BOT_${Date.now() + 1}`,
            role: "assistant",
            text: localUiCmd.reply,
            timestampLabel: ts,
          },
        ]);
        if (source === "text") setInputText("");

        if (localUiCmd.kind === "minimize_pip") {
          setHudMinimized(false);
          setViewMode("pip");
        } else if (localUiCmd.kind === "hide_hud") {
          setHudMinimized(true);
        } else if (localUiCmd.kind === "show_hud") {
          setHudMinimized(false);
        } else if (localUiCmd.kind === "fullscreen") {
          setViewMode("fullscreen");
          if (!cameraActiveRef.current) void startCameraStream();
        } else if (localUiCmd.kind === "close_camera") {
          closeCameraAndMinimize();
        }
        speakText(localUiCmd.reply);
        return;
      }

      // Capture live frame if camera mode is active or an image was supplied
      let frameDataUrl = overrideImageDataUrl ?? null;
      if (
        !frameDataUrl &&
        (viewModeRef.current === "fullscreen" ||
          viewModeRef.current === "pip" ||
          cameraActiveRef.current)
      ) {
        frameDataUrl = await waitForVideoFrameAndCapture();
      }

      const imageMimeType = frameDataUrl?.startsWith("data:image/png")
        ? "image/png"
        : frameDataUrl?.startsWith("data:image/webp")
        ? "image/webp"
        : "image/jpeg";
      const imageBase64 = frameDataUrl ? frameDataUrl.split(",")[1] || "" : "";

      const userMsg: ChatMessage = {
        id: `USR_${Date.now()}`,
        role: "user",
        text: trimmed,
        capturedThumbUrl: frameDataUrl || undefined,
        source,
        timestampLabel: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, userMsg]);
      if (source === "text") setInputText("");
      if (viewModeRef.current === "collapsed") {
        setViewMode("drawer");
      }
      setIsSending(true);
      setVoiceError(null);

      try {
        const latestMetrics = Object.values(latest.latest_by_parameter).map((obs) => {
          const cmp = latest.baseline_comparisons[obs.parameter];
          const meta = PARAMETER_METADATA[obs.parameter];
          const band = baseline.metrics[obs.parameter];
          return {
            parameter: meta?.label || obs.parameter,
            value: obs.value ?? "N/A",
            unit: obs.unit,
            status: cmp?.outside_p05_p95_band ? "OUTSIDE_NORMAL_BAND" : "NORMAL",
            normalRange: `${band.p05}-${band.p95} ${band.unit}`,
          };
        });

        const activeAlerts = incidents
          .filter((i) => i.state !== "CLOSED_RETAINED")
          .map((i) => ({
            title: i.title,
            severity: i.severity,
            state: i.state,
            ruleId: i.rule_id,
          }));

        const historyPayload = messages.slice(-8).map((m) => ({ role: m.role, text: m.text }));
        const envMeta = MISSION_ENVIRONMENT_META[routineState.environmentMode];
        const delayMeta = LIGHT_DELAY_META[lightDelayMode];

        let replyText = "";
        let visualObservation = "";
        let followUps: string[] = [];
        let requestedAction: AssistantActionRequest = { type: "NONE", target: "", label: "" };

        try {
          const response = await fetch("/api/assistant-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentName: agentName.trim() || "Aegis",
              message: trimmed,
              wakeTriggered: source === "voice-wake",
              cameraActive: Boolean(
                cameraActiveRef.current ||
                  viewModeRef.current === "fullscreen" ||
                  viewModeRef.current === "pip"
              ),
              imageBase64: imageBase64 || undefined,
              imageMimeType: imageBase64 ? imageMimeType : undefined,
              isAuthenticated,
              history: historyPayload,
              context: isAuthenticated
                ? {
                    astronautName,
                    activePage,
                    missionEnvironment: envMeta.label,
                    gravityLabel: envMeta.gravityLabel,
                    lightDelayLabel: delayMeta.roundTripText,
                    activityMode,
                    earthWanConnected,
                    routineProgress: `${routineState.completedTaskIds.length}/${MISSION_ROUTINE_TASKS.length} tasks (${routineState.readinessPoints} pts)`,
                    latestMetrics,
                    extendedBio: {
                      bloodGlucoseMgDl: extendedBio?.bloodGlucoseMgDl ?? null,
                      coreTempC: extendedBio?.coreTempC ?? null,
                      recentScanCount: storedScansCount,
                    },
                    activeAlerts,
                  }
                : { activePage },
            }),
          });

          const json = (await response.json()) as {
            ok: boolean;
            data?: {
              reply?: string;
              visualObservation?: string;
              suggestedFollowUps?: string[];
              appAction?: AssistantActionRequest;
            };
          };

          if (response.ok && json.ok && json.data?.reply) {
            replyText = json.data.reply;
            visualObservation = json.data.visualObservation || "";
            followUps = Array.isArray(json.data.suggestedFollowUps)
              ? json.data.suggestedFollowUps.slice(0, 3)
              : [];
            if (json.data.appAction && json.data.appAction.type) {
              requestedAction = json.data.appAction;
            }
          } else {
            throw new Error("Fallback to onboard engine");
          }
        } catch {
          const fallback = buildLocalFallbackResponse(trimmed, {
            agentName: agentName.trim() || "Aegis",
            isAuthenticated,
            cameraActive: cameraActiveRef.current,
            hasFrame: Boolean(imageBase64),
            baseline,
            latest,
            incidents,
            routineState,
            extendedBio,
          });
          replyText = fallback.reply;
          visualObservation = fallback.visualObservation;
          followUps = fallback.followUps;
          requestedAction = fallback.action;
        }

        let executedLabel: string | undefined;
        if (requestedAction.type === "CAMERA") {
          if (requestedAction.target === "minimize_pip") {
            setHudMinimized(false);
            setViewMode("pip");
            executedLabel = requestedAction.label || "Minimized camera to corner";
          } else if (requestedAction.target === "fullscreen") {
            setViewMode("fullscreen");
            if (!cameraActiveRef.current) void startCameraStream();
            executedLabel = requestedAction.label || "Expanded camera full screen";
          } else if (requestedAction.target === "close") {
            closeCameraAndMinimize();
            executedLabel = requestedAction.label || "Closed camera";
          }
        } else if (isAuthenticated && requestedAction.type !== "NONE" && requestedAction.target) {
          // If navigating away while in fullscreen, automatically minimize to PiP so user sees the page!
          if (requestedAction.type === "NAVIGATE" && viewModeRef.current === "fullscreen") {
            setViewMode("pip");
          }
          const resultLabel = await onExecuteAction(requestedAction);
          if (resultLabel) executedLabel = resultLabel;
        }

        const botMsg: ChatMessage = {
          id: `BOT_${Date.now()}`,
          role: "assistant",
          text: replyText,
          visualObservation: visualObservation || undefined,
          actionLabel: executedLabel,
          followUps,
          timestampLabel: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botMsg]);

        const shouldSpeak =
          source === "voice-wake" ||
          source === "voice-ptt" ||
          source === "camera" ||
          speakReplies;

        if (shouldSpeak) {
          speakText(replyText, () => {
            // While camera exam is open and wake/continuous listening is active, keep session ready
            if (
              wakeEnabledRef.current &&
              (viewModeRef.current === "fullscreen" || viewModeRef.current === "pip")
            ) {
              wakeArmedRef.current = true;
              setMicState("awake");
              setLiveTranscript(`Listening — speak to ${agentName.trim() || "Aegis"}...`);
            }
          });
        }
      } finally {
        setIsSending(false);
      }
    },
    [
      isSending,
      latest,
      baseline,
      incidents,
      messages,
      routineState,
      lightDelayMode,
      agentName,
      isAuthenticated,
      astronautName,
      activePage,
      activityMode,
      earthWanConnected,
      extendedBio,
      storedScansCount,
      onExecuteAction,
      speakReplies,
      speakText,
      startCameraStream,
      closeCameraAndMinimize,
      waitForVideoFrameAndCapture,
    ]
  );

  useEffect(() => {
    latestSendRef.current = sendMessage;
  }, [sendMessage]);

  const stopContinuousRecognition = useCallback(() => {
    if (wakeArmedTimerRef.current) {
      window.clearTimeout(wakeArmedTimerRef.current);
      wakeArmedTimerRef.current = null;
    }
    wakeArmedRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setMicState("idle");
    setLiveTranscript("");
  }, []);

  const startContinuousWakeRecognition = useCallback(
    (startArmed = false) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        setVoiceError(
          "Continuous wake-word listening requires Chrome, Edge, or Safari SpeechRecognition. Use 'Speak' or 'Analyze Now' for Gemini audio & vision."
        );
        setWakeModeEnabled(false);
        return;
      }

      stopContinuousRecognition();
      setVoiceError(null);

      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      if (startArmed) {
        wakeArmedRef.current = true;
      }

      rec.onresult = (event: SpeechRecognitionEventLike) => {
        if (isSpeakingRef.current) return;

        let interim = "";
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const chunk = event.results[i]?.[0]?.transcript || "";
          if (event.results[i]?.isFinal) {
            finalChunk += ` ${chunk}`;
          } else {
            interim += ` ${chunk}`;
          }
        }

        const displayText = (finalChunk || interim).trim();
        if (displayText) setLiveTranscript(displayText);

        // Immediate interim wake-word visual cue so user knows their name was heard
        if (interim && !wakeArmedRef.current) {
          const interimWake = extractWakeCommand(interim, agentName);
          if (interimWake.matched) {
            setMicState("awake");
          }
        }

        const finalClean = finalChunk.trim();
        if (!finalClean) return;

        // Case 1: Already awake (either right after calling name or inside active camera exam)
        if (wakeArmedRef.current) {
          if (wakeArmedTimerRef.current) {
            window.clearTimeout(wakeArmedTimerRef.current);
            wakeArmedTimerRef.current = null;
          }
          // Strip wake prefix if the user repeated the agent's name
          const repeatedWake = extractWakeCommand(finalClean, agentName);
          const cleanPrompt =
            repeatedWake.matched && repeatedWake.trailingCommand
              ? repeatedWake.trailingCommand
              : finalClean;

          // Keep armed automatically while camera exam is open; return to standby if closed
          const inCameraExam =
            viewModeRef.current === "fullscreen" || viewModeRef.current === "pip";
          wakeArmedRef.current = inCameraExam;
          setMicState(inCameraExam ? "awake" : "standby");
          setLiveTranscript("");
          void latestSendRef.current(cleanPrompt, "voice-wake");
          return;
        }

        // Case 2: User called the agent's name ("Hey Aegis" / "Aegis ...")
        const wakeCheck = extractWakeCommand(finalClean, agentName);
        if (wakeCheck.matched) {
          playWakeChime();

          if (openCameraOnWake) {
            // Open full-screen camera immediately when called by name!
            setViewMode("fullscreen");
            setHudMinimized(false);
            void startCameraStream().then((camOk) => {
              if (wakeCheck.trailingCommand.length >= 3) {
                setMicState("awake");
                wakeArmedRef.current = true;
                setLiveTranscript("");
                void latestSendRef.current(wakeCheck.trailingCommand, "voice-wake");
              } else {
                wakeArmedRef.current = true;
                setMicState("awake");
                setLiveTranscript(`"${agentName}" is looking — speak what you want checked...`);
                speakText(
                  camOk
                    ? "I'm here and have the camera open. Tell me what you'd like me to analyze."
                    : "I'm here. Allow camera access if prompted, and tell me how I can help."
                );
              }
            });
          } else {
            setViewMode("drawer");
            if (wakeCheck.trailingCommand.length >= 3) {
              setMicState("standby");
              setLiveTranscript("");
              void latestSendRef.current(wakeCheck.trailingCommand, "voice-wake");
            } else {
              wakeArmedRef.current = true;
              setMicState("awake");
              setLiveTranscript(`"${agentName}" heard — speak your command...`);
              speakText("Listening.");
              wakeArmedTimerRef.current = window.setTimeout(() => {
                wakeArmedRef.current = false;
                if (wakeEnabledRef.current) {
                  setMicState("standby");
                  setLiveTranscript("");
                }
              }, 12000);
            }
          }
        }
      };

      rec.onerror = (ev) => {
        const code = ev?.error || "";
        if (code === "not-allowed" || code === "service-not-allowed") {
          setVoiceError(
            "Microphone permission denied. Allow microphone access to use wake-word mode."
          );
          setWakeModeEnabled(false);
          stopContinuousRecognition();
        }
      };

      rec.onend = () => {
        if (wakeEnabledRef.current) {
          window.setTimeout(() => {
            if (wakeEnabledRef.current) {
              try {
                rec.start();
                setMicState(wakeArmedRef.current ? "awake" : "standby");
              } catch {
                // ignore restart error
              }
            }
          }, 350);
        } else {
          setMicState("idle");
        }
      };

      try {
        rec.start();
        recognitionRef.current = rec;
        setMicState(startArmed ? "awake" : "standby");
      } catch (err) {
        setVoiceError(
          err instanceof Error ? err.message : "Could not start microphone wake-word listener."
        );
        setWakeModeEnabled(false);
        setMicState("idle");
      }
    },
    [agentName, openCameraOnWake, speakText, startCameraStream, stopContinuousRecognition]
  );

  const openFullScreenExam = useCallback(
    async (opts?: { greet?: boolean; initialPrompt?: string }) => {
      setViewMode("fullscreen");
      setHudMinimized(false);
      setVoiceError(null);
      if (speechApiSupported && !wakeEnabledRef.current) {
        setWakeModeEnabled(true);
        wakeEnabledRef.current = true;
        startContinuousWakeRecognition(true);
      } else if (wakeEnabledRef.current) {
        wakeArmedRef.current = true;
        setMicState("awake");
      }

      const started = await startCameraStream();
      const name = agentName.trim() || "Aegis";
      if (opts?.initialPrompt) {
        void latestSendRef.current(opts.initialPrompt, "voice-wake");
        return;
      }

      if (opts?.greet !== false) {
        const greeting = started
          ? `I'm here and have eyes on you. Tell me what you'd like me to inspect—fatigue, eyes, skin, or your vitals.`
          : `I'm here. Allow camera access or attach a frame so I can inspect you alongside your telemetry.`;
        speakText(greeting, () => {
          if (wakeEnabledRef.current) {
            wakeArmedRef.current = true;
            setMicState("awake");
            setLiveTranscript(`"${name}" active — speak what you want analyzed...`);
          }
        });
      }
    },
    [agentName, speakText, speechApiSupported, startCameraStream, startContinuousWakeRecognition]
  );

  const toggleWakeMode = () => {
    if (wakeModeEnabled) {
      setWakeModeEnabled(false);
      stopContinuousRecognition();
    } else {
      setWakeModeEnabled(true);
      if (viewMode === "collapsed") {
        setViewMode("drawer");
      }
      startContinuousWakeRecognition(
        viewMode === "fullscreen" || viewMode === "pip"
      );
    }
  };

  // Re-bind continuous listener if agentName or openCameraOnWake changes while active
  useEffect(() => {
    if (wakeModeEnabled && speechApiSupported) {
      startContinuousWakeRecognition(
        viewModeRef.current === "fullscreen" || viewModeRef.current === "pip"
      );
    }
    return () => {
      if (!wakeEnabledRef.current) return;
      stopContinuousRecognition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentName, openCameraOnWake]);

  useEffect(() => {
    return () => {
      stopContinuousRecognition();
      stopCameraStream();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [stopContinuousRecognition, stopCameraStream]);

  // One-shot Push-to-Talk via SpeechRecognition OR MediaRecorder + /api/voice-transcribe
  const handlePushToTalk = async () => {
    setVoiceError(null);
    if (viewMode === "collapsed") {
      setViewMode("drawer");
    }

    if (micState === "recording" && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (Ctor && !wakeModeEnabled) {
      try {
        const rec = new Ctor();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = "en-US";
        setMicState("recording");
        setLiveTranscript("Listening for your question...");

        let captured = "";
        rec.onresult = (ev) => {
          let txt = "";
          for (let i = 0; i < ev.results.length; i++) {
            txt += ` ${ev.results[i]?.[0]?.transcript || ""}`;
          }
          captured = txt.trim();
          setLiveTranscript(captured);
        };
        rec.onerror = () => {
          setMicState("idle");
        };
        rec.onend = () => {
          setMicState(wakeEnabledRef.current ? "standby" : "idle");
          setLiveTranscript("");
          if (captured) {
            const stripped = extractWakeCommand(captured, agentName);
            const finalText =
              stripped.matched && stripped.trailingCommand ? stripped.trailingCommand : captured;
            void latestSendRef.current(finalText, "voice-ptt");
          }
        };
        rec.start();
        return;
      } catch {
        setMicState("idle");
      }
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Voice recording is not supported in this browser. You can type below.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
        const blob = new Blob(chunks, { type: mimeType });
        setMicState("transcribing");
        setLiveTranscript("Transcribing voice command...");

        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const str = typeof reader.result === "string" ? reader.result : "";
              resolve(str.split(",")[1] || "");
            };
            reader.onerror = () => reject(new Error("Could not read audio clip."));
            reader.readAsDataURL(blob);
          });

          const resp = await fetch("/api/voice-transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: base64, mimeType }),
          });
          const data = (await resp.json()) as { ok: boolean; transcript?: string; error?: string };
          if (resp.ok && data.ok && data.transcript) {
            const stripped = extractWakeCommand(data.transcript, agentName);
            const finalText =
              stripped.matched && stripped.trailingCommand
                ? stripped.trailingCommand
                : data.transcript;
            await latestSendRef.current(finalText, "voice-ptt");
          } else {
            setVoiceError(data.error || "Could not hear a spoken command. Try again or type below.");
          }
        } catch (err) {
          setVoiceError(err instanceof Error ? err.message : "Voice transcription error.");
        } finally {
          setMicState(wakeEnabledRef.current ? "standby" : "idle");
          setLiveTranscript("");
        }
      };

      recorder.start();
      setMicState("recording");
      setLiveTranscript("Recording voice command... tap Stop & Send when finished.");
    } catch {
      setVoiceError("Microphone permission is needed to capture voice commands.");
      setMicState(wakeEnabledRef.current ? "standby" : "idle");
    }
  };

  const handleAnalyzeFrameNow = async (customPrompt?: string) => {
    const prompt =
      customPrompt ||
      "Look closely at my camera frame and compare with my current telemetry. How do I appear right now (alertness, fatigue cues, posture, eyes, or lighting), and what should I keep in mind?";
    const snap = captureLiveFrameDataUrl();
    await sendMessage(prompt, "camera", snap);
  };

  const handleUploadFrameFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (result) {
        stopCameraStream();
        setUploadedFrameDataUrl(result);
        setLastCapturedThumb(result);
        setCameraError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCurrentSnapshotToCheckin = async () => {
    if (!onSaveCameraScan || !isAuthenticated || savingScan) return;
    const snap = captureLiveFrameDataUrl() || lastCapturedThumb;
    if (!snap) return;
    setSavingScan(true);
    setScanSavedNote(null);
    try {
      const approxBytes = Math.round((snap.length * 3) / 4);
      await onSaveCameraScan({
        bodyRegion: "eyes",
        modality: "CAMERA_PHOTO",
        caption: `${agentName.trim() || "Aegis"} voice-camera visual exam frame`,
        imageDataUrl: snap,
        mimeType: "image/jpeg",
        sizeBytes: approxBytes,
      });
      setScanSavedNote("Saved frame to Daily Check-In scans");
      window.setTimeout(() => setScanSavedNote(null), 4000);
    } finally {
      setSavingScan(false);
    }
  };

  const handleSwitchCameraLens = async () => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacing);
    await startCameraStream(nextFacing);
  };

  const displayAgentName = agentName.trim() || "Aegis";
  const latestBotMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return messages[i];
    }
    return null;
  }, [messages]);

  const hrObs = latest.latest_by_parameter.heart_rate_bpm;
  const spo2Obs = latest.latest_by_parameter.spo2_pct;
  const co2Obs = latest.latest_by_parameter.cabin_co2_mmhg;
  const openAlertsCount = incidents.filter((i) => i.state !== "CLOSED_RETAINED").length;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleUploadFrameFile}
        className="hidden"
      />

      {/* 1. FULL-SCREEN CAMERA & VOICE EXAMINATION MODE */}
      {viewMode === "fullscreen" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${displayAgentName} Full-Screen Camera & Voice Examination`}
          className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col overflow-hidden"
        >
          {/* Full-screen live camera or uploaded image backdrop */}
          <div className="absolute inset-0 bg-slate-950">
            {cameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  facingMode === "user" ? "-scale-x-100" : ""
                }`}
              />
            ) : uploadedFrameDataUrl ? (
              <img
                src={uploadedFrameDataUrl}
                alt="Uploaded visual examination frame"
                className="w-full h-full object-contain bg-slate-950"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-950 p-6">
                <div className="max-w-md w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-6 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center mx-auto">
                    <Camera className="w-6 h-6 text-sky-300" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-base font-bold text-white">
                      {cameraLoading
                        ? "Starting Full-Screen Camera..."
                        : `${displayAgentName} Camera Ready`}
                    </h2>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {cameraError ||
                        "Grant camera permission so Aegis can inspect fatigue cues, eyes, skin, or posture in real time alongside your telemetry."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void startCameraStream()}
                      className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Allow Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Use Photo Frame</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Subtle optical framing brackets (non-intrusive, 1px hairline) */}
            {(cameraActive || uploadedFrameDataUrl) && (
              <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
                <div className="w-[min(72vw,440px)] h-[min(52vh,400px)] relative">
                  <span className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-white/55 rounded-tl-xl" />
                  <span className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-white/55 rounded-tr-xl" />
                  <span className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-white/55 rounded-bl-xl" />
                  <span className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-white/55 rounded-br-xl" />
                </div>
              </div>
            )}
          </div>

          {/* Top Translucent Telemetry & Minimize Controls Header */}
          <header className="relative z-10 px-4 sm:px-6 py-3 bg-slate-950/75 backdrop-blur-md border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <AegisBrandIcon className="w-8 h-8 shrink-0" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-semibold text-white">
                  <span>{displayAgentName} · Live Visual &amp; Voice Exam</span>
                  <span aria-hidden="true" className="text-slate-500">
                    ·
                  </span>
                  <span
                    className={
                      isSending
                        ? "text-amber-300"
                        : micState === "awake" || micState === "recording"
                        ? "text-emerald-300"
                        : cameraActive
                        ? "text-sky-300"
                        : "text-slate-300"
                    }
                  >
                    {isSending
                      ? "Analyzing camera frame..."
                      : micState === "awake"
                      ? `Listening ("${displayAgentName}" active)`
                      : micState === "recording"
                      ? "Recording voice..."
                      : cameraActive
                      ? "Camera live"
                      : "Standby"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 truncate">
                  {isAuthenticated
                    ? `${astronautName} · HR ${hrObs?.value ?? "N/A"} ${hrObs?.unit ?? ""} · SpO2 ${
                        spo2Obs?.value ?? "N/A"
                      }% · CO2 ${co2Obs?.value ?? "N/A"} mmHg · ${openAlertsCount} active alert${
                        openAlertsCount === 1 ? "" : "s"
                      }`
                    : "Public showcase preview · Sign in with Google to attach personal 18-parameter telemetry"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {cameraActive && (
                <button
                  type="button"
                  onClick={() => void handleSwitchCameraLens()}
                  title="Switch front/rear camera"
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <SwitchCamera className="w-4 h-4" />
                  <span className="hidden sm:inline">Flip Camera</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (speakReplies) stopSpeaking();
                  setSpeakReplies(!speakReplies);
                }}
                title={speakReplies ? "Mute voice replies" : "Speak replies aloud"}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                {speakReplies ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span className="hidden sm:inline">{speakReplies ? "Voice On" : "Muted"}</span>
              </button>

              <button
                type="button"
                onClick={() => setHudMinimized(!hudMinimized)}
                title={hudMinimized ? "Show overlay chat & controls" : "Minimize overlay panels"}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                {hudMinimized ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span>{hudMinimized ? "Show Panels" : "Hide Panels"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHudMinimized(false);
                  setViewMode("pip");
                }}
                title="Minimize camera to corner window"
                className="px-3 py-2 bg-sky-600/90 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Minimize2 className="w-4 h-4" />
                <span>Minimize to Corner</span>
              </button>

              <button
                type="button"
                onClick={closeCameraAndMinimize}
                title="Close camera and minimize to assistant bar"
                className="px-3 py-2 bg-rose-600/90 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Close Camera</span>
              </button>
            </div>
          </header>

          {/* Spacer pushing bottom HUD down cleanly */}
          <div className="flex-1 pointer-events-none" />

          {/* Bottom Minimizable Examination HUD */}
          {hudMinimized ? (
            <div className="relative z-10 px-4 pb-5 flex justify-center">
              <div className="bg-slate-950/80 backdrop-blur-xl border border-white/15 rounded-2xl px-3 py-2 flex flex-wrap items-center gap-2 shadow-2xl">
                <button
                  type="button"
                  onClick={() => void handleAnalyzeFrameNow()}
                  disabled={isSending || (!cameraActive && !uploadedFrameDataUrl)}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ScanFace className="w-4 h-4" />
                  <span>{isSending ? "Analyzing..." : "Analyze Me"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handlePushToTalk()}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                    micState === "recording"
                      ? "bg-rose-600 text-white"
                      : "bg-white/15 hover:bg-white/25 text-white"
                  }`}
                >
                  {micState === "recording" ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>Speak</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setHudMinimized(false)}
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronUp className="w-4 h-4" />
                  <span>Restore Panel</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="relative z-10 px-4 sm:px-6 pb-4 sm:pb-6 flex justify-center">
              <div className="w-full max-w-4xl bg-slate-950/82 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* Live status & quick actions row */}
                <div className="px-4 py-2.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleAnalyzeFrameNow()}
                      disabled={isSending || (!cameraActive && !uploadedFrameDataUrl)}
                      className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ScanFace className="w-4 h-4" />
                      <span>{isSending ? "Analyzing Frame..." : "Capture & Analyze Now"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleWakeMode}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer border ${
                        wakeModeEnabled
                          ? "bg-emerald-600 border-emerald-500 text-white"
                          : "bg-white/10 hover:bg-white/15 border-white/15 text-slate-100"
                      }`}
                    >
                      <Ear className="w-4 h-4" />
                      <span>
                        {wakeModeEnabled
                          ? micState === "awake"
                            ? "Hands-Free Mic On"
                            : `Wake: "${displayAgentName}"`
                          : "Hands-Free Voice"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handlePushToTalk()}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer border ${
                        micState === "recording"
                          ? "bg-rose-600 border-rose-500 text-white"
                          : "bg-white/10 hover:bg-white/15 border-white/15 text-slate-100"
                      }`}
                    >
                      {micState === "recording" ? (
                        <>
                          <MicOff className="w-4 h-4" />
                          <span>Stop &amp; Send</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4" />
                          <span>Push to Talk</span>
                        </>
                      )}
                    </button>

                    {isAuthenticated && onSaveCameraScan && (cameraActive || lastCapturedThumb) && (
                      <button
                        type="button"
                        disabled={savingScan}
                        onClick={() => void handleSaveCurrentSnapshotToCheckin()}
                        className="px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/15 text-slate-100 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingScan ? "Saving..." : "Save Scan"}</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setHudMinimized(true)}
                    className="px-2.5 py-1.5 text-xs text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4" />
                    <span>Minimize Panel</span>
                  </button>
                </div>

                {/* Live transcript / error / saved toast */}
                {(liveTranscript || voiceError || scanSavedNote) && (
                  <div
                    className={`px-4 py-2 text-xs border-b border-white/10 ${
                      voiceError
                        ? "bg-rose-950/80 text-rose-200"
                        : scanSavedNote
                        ? "bg-emerald-950/80 text-emerald-200"
                        : "bg-sky-950/60 text-sky-200"
                    }`}
                  >
                    {voiceError || scanSavedNote || `Heard: ${liveTranscript}`}
                  </div>
                )}

                {/* Conversation & Visual Observations */}
                <div className="px-4 py-3 max-h-48 sm:max-h-56 overflow-y-auto space-y-2.5">
                  {messages.slice(-6).map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-1 ${
                        msg.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`max-w-[90%] rounded-xl px-3.5 py-2 text-xs sm:text-[13px] leading-relaxed flex items-start gap-2.5 ${
                          msg.role === "user"
                            ? "bg-sky-600 text-white"
                            : "bg-white/10 text-slate-100 border border-white/10"
                        }`}
                      >
                        {msg.capturedThumbUrl && (
                          <img
                            src={msg.capturedThumbUrl}
                            alt="Captured frame"
                            className="w-12 h-12 rounded-lg object-cover border border-white/25 shrink-0"
                          />
                        )}
                        <div className="space-y-1 min-w-0">
                          {msg.visualObservation && (
                            <p className="text-[11px] font-medium text-sky-300">
                              Visual Check: {msg.visualObservation}
                            </p>
                          )}
                          <p>{msg.text}</p>
                          {msg.actionLabel && (
                            <p className="text-[11px] font-semibold text-emerald-300">
                              Action: {msg.actionLabel}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isSending && (
                    <p className="text-xs text-sky-300">
                      {displayAgentName} is inspecting your camera frame and telemetry...
                    </p>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick visual exam prompts */}
                <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                  {[
                    "Check me for fatigue or eyestrain",
                    "Inspect my facial color and posture",
                    "Summarize my vitals and alerts",
                    "Minimize camera to corner",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={isSending}
                      onClick={() => void sendMessage(prompt, "camera")}
                      className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg text-[11px] text-slate-100 cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                {/* Text input inside fullscreen HUD */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendMessage(inputText, "text");
                  }}
                  className="px-4 py-3 border-t border-white/10 bg-slate-900/70 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Ask ${displayAgentName} about what's on camera or say a command...`}
                    className="flex-1 min-w-0 px-3 py-2 text-xs sm:text-sm bg-slate-950/80 border border-white/20 rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !inputText.trim()}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Ask</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. MINIMIZED CORNER PICTURE-IN-PICTURE & FLOATING DOCK */}
      {viewMode !== "fullscreen" && (
        <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2.5 max-w-[calc(100vw-2rem)]">
          {/* Minimized Corner Camera PiP Window */}
          {viewMode === "pip" && (
            <section
              aria-label={`${displayAgentName} Minimized Camera Window`}
              className="w-[min(360px,calc(100vw-2rem))] bg-slate-950 text-white border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* PiP Header */}
              <div className="px-3 py-2 bg-slate-900/95 border-b border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <AegisBrandIcon className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-semibold truncate">
                    {displayAgentName} · Camera Active
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="Expand to full-screen camera"
                    onClick={() => setViewMode("fullscreen")}
                    className="p-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Stop camera and switch to chat drawer"
                    onClick={() => {
                      stopCameraStream();
                      setViewMode("drawer");
                    }}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
                  >
                    <CameraOff className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Close camera and minimize to bar"
                    onClick={closeCameraAndMinimize}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-rose-600 text-slate-200 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Mini Video Feed */}
              <div className="relative h-44 bg-slate-900">
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      facingMode === "user" ? "-scale-x-100" : ""
                    }`}
                  />
                ) : uploadedFrameDataUrl ? (
                  <img
                    src={uploadedFrameDataUrl}
                    alt="Visual examination frame"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center gap-2">
                    <p className="text-xs text-slate-300">Camera paused or needs permission</p>
                    <button
                      type="button"
                      onClick={() => void startCameraStream()}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Enable Camera
                    </button>
                  </div>
                )}
              </div>

              {/* Latest response + PiP action strip */}
              <div className="p-3 space-y-2.5 bg-slate-950">
                {latestBotMsg && (
                  <p className="text-xs text-slate-200 line-clamp-3 leading-relaxed">
                    {latestBotMsg.text}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isSending || (!cameraActive && !uploadedFrameDataUrl)}
                    onClick={() => void handleAnalyzeFrameNow()}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ScanFace className="w-3.5 h-3.5" />
                    <span>{isSending ? "Analyzing..." : "Analyze"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePushToTalk()}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                      micState === "recording"
                        ? "bg-rose-600 text-white"
                        : "bg-white/10 hover:bg-white/20 text-white"
                    }`}
                  >
                    {micState === "recording" ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{micState === "recording" ? "Stop" : "Speak"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("fullscreen")}
                    className="ml-auto px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Full Screen</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Standard Compact Chat Drawer */}
          {viewMode === "drawer" && (
            <section
              aria-label="AEGIS-V Voice Agent and Chatbot"
              className="w-[min(420px,calc(100vw-2rem))] max-h-[76vh] bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between gap-2 bg-sky-50/70">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <AegisBrandIcon className="w-7 h-7 shrink-0" />
                    <h2 className="text-sm font-bold text-slate-900 truncate">
                      {displayAgentName} · Voice &amp; Visual Exam
                    </h2>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate">
                    {micState === "awake"
                      ? `Wake word "${displayAgentName}" active — speak now`
                      : micState === "standby"
                      ? `Listening for "Hey ${displayAgentName}" (opens camera)`
                      : micState === "recording"
                      ? "Capturing your voice..."
                      : micState === "transcribing"
                      ? "Transcribing voice..."
                      : `Say "Hey ${displayAgentName}" to open full-screen camera`}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="Open Full-Screen Camera & Voice Exam"
                    onClick={() => void openFullScreenExam({ greet: true })}
                    className="p-2 rounded-lg text-sky-700 hover:bg-sky-100 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title={speakReplies ? "Mute spoken replies" : "Speak replies aloud"}
                    onClick={() => {
                      if (speakReplies) stopSpeaking();
                      setSpeakReplies(!speakReplies);
                    }}
                    className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/80 cursor-pointer"
                  >
                    {speakReplies ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    title="Voice agent wake name & camera settings"
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className={`p-2 rounded-lg cursor-pointer ${
                      settingsOpen
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                    }`}
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Minimize Assistant"
                    onClick={() => setViewMode("collapsed")}
                    className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/80 cursor-pointer"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Wake Name & Camera Auto-Launch Customization */}
              {settingsOpen && (
                <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="wake-name-input" className="text-xs font-semibold text-slate-800">
                      Assistant Wake Name
                    </label>
                    <div className="flex items-center gap-1">
                      {["Aegis", "Nova", "Vega", "Orion"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAgentName(preset)}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer border ${
                            agentName === preset
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-sky-50"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    id="wake-name-input"
                    type="text"
                    maxLength={20}
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="Type custom wake name (e.g. Aegis)"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={openCameraOnWake}
                      onChange={(e) => setOpenCameraOnWake(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span>
                      Open full-screen camera automatically when calling &ldquo;{displayAgentName}&rdquo;
                    </span>
                  </label>
                </div>
              )}

              {/* Voice & Camera Controls Bar */}
              <div className="px-4 py-2.5 border-b border-slate-200/70 bg-white/75 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={toggleWakeMode}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer border whitespace-nowrap ${
                    wakeModeEnabled
                      ? micState === "awake"
                        ? "bg-emerald-700 text-white border-emerald-700"
                        : "bg-sky-700 text-white border-sky-700"
                      : "bg-white text-slate-800 border-slate-300 hover:bg-sky-50"
                  }`}
                >
                  <Ear className="w-3.5 h-3.5" />
                  <span>
                    {wakeModeEnabled
                      ? micState === "awake"
                        ? `Awake: Speak to ${displayAgentName}`
                        : `Wake Listening: "${displayAgentName}"`
                      : `Call "${displayAgentName}"`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void openFullScreenExam({ greet: true })}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 whitespace-nowrap"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Full-Screen Camera</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handlePushToTalk()}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer border whitespace-nowrap ${
                    micState === "recording"
                      ? "bg-rose-700 text-white border-rose-700"
                      : "bg-white text-slate-800 border-slate-300 hover:bg-sky-50"
                  }`}
                >
                  {micState === "recording" ? (
                    <>
                      <MicOff className="w-3.5 h-3.5" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      <span>Voice</span>
                    </>
                  )}
                </button>
              </div>

              {(liveTranscript || voiceError) && (
                <div
                  className={`px-4 py-2 text-xs border-b ${
                    voiceError
                      ? "bg-rose-50 text-rose-800 border-rose-200"
                      : micState === "awake"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                      : "bg-sky-50/80 text-sky-900 border-sky-200"
                  }`}
                >
                  {voiceError ? voiceError : `Heard: ${liveTranscript}`}
                </div>
              )}

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[220px] max-h-[42vh]">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-1 ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100/90 text-slate-800 border border-slate-200/80"
                      }`}
                    >
                      {msg.capturedThumbUrl && (
                        <img
                          src={msg.capturedThumbUrl}
                          alt="Camera frame"
                          className="w-28 h-20 object-cover rounded-lg mb-2 border border-white/25"
                        />
                      )}
                      {msg.visualObservation && (
                        <p className="text-[11px] font-semibold text-sky-800 mb-1">
                          Visual Check: {msg.visualObservation}
                        </p>
                      )}
                      <p>{msg.text}</p>
                      {msg.actionLabel && (
                        <p className="mt-1.5 pt-1.5 border-t border-slate-200/80 text-[11px] font-semibold text-sky-800">
                          Action: {msg.actionLabel}
                        </p>
                      )}
                    </div>

                    {msg.followUps && msg.followUps.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {msg.followUps.map((f) => (
                          <button
                            key={f}
                            type="button"
                            disabled={isSending}
                            onClick={() => void sendMessage(f, "text")}
                            className="px-2.5 py-1 bg-white hover:bg-sky-50 border border-slate-200 rounded-lg text-[11px] font-medium text-sky-900 cursor-pointer text-left"
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    )}

                    <span className="text-[10px] text-slate-400 px-1">
                      {msg.role === "user"
                        ? msg.source === "voice-wake"
                          ? `Voice (Wake: ${displayAgentName}) · ${msg.timestampLabel}`
                          : msg.source === "camera"
                          ? `Camera Exam · ${msg.timestampLabel}`
                          : msg.source === "voice-ptt"
                          ? `Voice · ${msg.timestampLabel}`
                          : msg.timestampLabel
                        : `${displayAgentName} · ${msg.timestampLabel}`}
                    </span>
                  </div>
                ))}

                {isSending && (
                  <div className="text-xs text-slate-500 px-1">{displayAgentName} is thinking...</div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Text Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage(inputText, "text");
                }}
                className="p-3 border-t border-slate-200/80 bg-white/90 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Ask ${displayAgentName} or type a command...`}
                  className="flex-1 min-w-0 px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300/90 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  disabled={isSending || !inputText.trim()}
                  aria-label="Send message"
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </section>
          )}

          {/* Compact Collapsed Dock Bar */}
          {viewMode !== "pip" && (
            <div className="bg-white/92 backdrop-blur-xl border border-slate-200/90 shadow-lg rounded-2xl p-1.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleWakeMode}
                title={`Listen for "Hey ${displayAgentName}" to open full-screen camera & voice analysis`}
                className={`px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                  wakeModeEnabled
                    ? micState === "awake"
                      ? "bg-emerald-700 text-white"
                      : "bg-sky-700 text-white"
                    : "bg-slate-100 hover:bg-sky-50 text-slate-800"
                }`}
              >
                <Mic className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {wakeModeEnabled
                    ? micState === "awake"
                      ? `${displayAgentName}: Listening...`
                      : `Listening: "${displayAgentName}"`
                    : `Call "${displayAgentName}"`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => void openFullScreenExam({ greet: true })}
                title="Open Full-Screen Camera & Voice Examination"
                className="px-3 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Camera className="w-3.5 h-3.5 shrink-0" />
                <span>Camera Exam</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode(viewMode === "drawer" ? "collapsed" : "drawer")}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <AegisBrandIcon className="w-4 h-4 shrink-0" />
                <span>{viewMode === "drawer" ? "Minimize" : `${displayAgentName} Chat`}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};
