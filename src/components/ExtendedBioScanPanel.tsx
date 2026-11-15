import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Droplets,
  ImagePlus,
  Thermometer,
  Trash2,
} from "lucide-react";
import {
  BODY_SYSTEM_ATLAS,
  BodyRegionId,
  DiagnosticScanEntry,
  EXTENDED_BIO_BANDS,
  ExtendedBioSummary,
} from "../types/opsContracts";
import { StoredDiagnosticScan } from "../services/diagnosticScanDb";

interface ExtendedBioScanPanelProps {
  extendedBio: ExtendedBioSummary | null;
  storedScans: StoredDiagnosticScan[];
  isBusy: boolean;
  onSaveExtendedBio: (input: {
    bloodGlucoseMgDl: number;
    coreTempC: number;
    notes: string;
  }) => Promise<void>;
  onSaveDiagnosticScan: (input: {
    bodyRegion: BodyRegionId;
    modality: DiagnosticScanEntry["modality"];
    caption: string;
    imageDataUrl: string;
    mimeType: string;
    sizeBytes: number;
  }) => Promise<void>;
  onDeleteDiagnosticScan: (scanId: string) => Promise<void>;
}

function getGlucoseStatus(val: number): { label: string; cls: string } {
  const b = EXTENDED_BIO_BANDS.bloodGlucoseMgDl;
  if (Number.isNaN(val)) return { label: "Enter value", cls: "text-slate-500" };
  if (val < b.criticalLow || val > b.criticalHigh) {
    return { label: "✖ Attention (critical band)", cls: "text-rose-700" };
  }
  if (val < b.p05 || val > b.p95) {
    return { label: "▲ Outside normal band", cls: "text-amber-700" };
  }
  return { label: "● Within normal band", cls: "text-emerald-700" };
}

function getTempStatus(val: number): { label: string; cls: string } {
  const b = EXTENDED_BIO_BANDS.coreTempC;
  if (Number.isNaN(val)) return { label: "Enter value", cls: "text-slate-500" };
  if (val < b.criticalLow || val >= b.criticalHigh) {
    return { label: "✖ Attention (fever / hypothermia)", cls: "text-rose-700" };
  }
  if (val < b.p05 || val > b.p95) {
    return { label: "▲ Outside normal band", cls: "text-amber-700" };
  }
  return { label: "● Within normal band", cls: "text-emerald-700" };
}

export const ExtendedBioScanPanel: React.FC<ExtendedBioScanPanelProps> = ({
  extendedBio,
  storedScans,
  isBusy,
  onSaveExtendedBio,
  onSaveDiagnosticScan,
  onDeleteDiagnosticScan,
}) => {
  const [glucose, setGlucose] = useState(
    extendedBio ? String(extendedBio.bloodGlucoseMgDl) : "94"
  );
  const [coreTemp, setCoreTemp] = useState(
    extendedBio ? String(extendedBio.coreTempC) : "36.8"
  );
  const [bioNotes, setBioNotes] = useState(extendedBio?.notes || "");
  const [bioSavedNotice, setBioSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!extendedBio) return;
    setGlucose(String(extendedBio.bloodGlucoseMgDl));
    setCoreTemp(String(extendedBio.coreTempC));
    if (extendedBio.notes) setBioNotes(extendedBio.notes);
  }, [extendedBio]);

  const [bodyRegion, setBodyRegion] = useState<BodyRegionId>("eyes");
  const [modality, setModality] = useState<DiagnosticScanEntry["modality"]>("OCULAR_SCAN");
  const [caption, setCaption] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [capturedMime, setCapturedMime] = useState("image/jpeg");
  const [capturedBytes, setCapturedBytes] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleStartCamera = async () => {
    setCameraError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraError("Live camera is unavailable here. Use the Upload Scan / Photo button below.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 40);
    } catch (err) {
      stopCamera();
      setCameraError(
        err instanceof Error
          ? `Camera permission unavailable (${err.message}). You can still upload an image file.`
          : "Camera permission unavailable. You can still upload an image file."
      );
    }
  };

  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    const targetWidth = Math.min(640, video.videoWidth);
    const scale = targetWidth / video.videoWidth;
    canvas.width = targetWidth;
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    setCapturedPreviewUrl(dataUrl);
    setCapturedMime("image/jpeg");
    setCapturedBytes(Math.round((dataUrl.length * 3) / 4));
    stopCamera();
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      if (result.startsWith("data:image/")) {
        setCapturedPreviewUrl(result);
        setCapturedMime(file.type || "image/png");
        setCapturedBytes(file.size);
      }
    };
    reader.readAsDataURL(file);
  };

  const glucoseStatus = getGlucoseStatus(Number(glucose));
  const tempStatus = getTempStatus(Number(coreTemp));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Blood Sugar & Core Body Temperature */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSaveExtendedBio({
            bloodGlucoseMgDl: Number(glucose),
            coreTempC: Number(coreTemp),
            notes: bioNotes.trim(),
          });
          setBioSavedNotice("Blood sugar and core body temperature saved to your private profile.");
        }}
        className="lg:col-span-5 glass-panel rounded-2xl p-6 space-y-4"
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Droplets className="w-4 h-4 text-sky-700" />
            <span>Blood Sugar &amp; Core Body Temperature</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track metabolic fuel stability and infection/thermal shifts alongside the 18 core metrics.
          </p>
        </div>

        <div className="space-y-3 text-xs">
          <div className="glass-subtle rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="bio-glucose" className="font-medium text-slate-800">
                Blood Sugar (mg/dL)
              </label>
              <span className={`font-medium ${glucoseStatus.cls}`}>{glucoseStatus.label}</span>
            </div>
            <input
              id="bio-glucose"
              type="number"
              step="1"
              min="30"
              max="350"
              value={glucose}
              onChange={(e) => setGlucose(e.target.value)}
              className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 font-mono text-slate-900"
            />
            <div className="text-[11px] text-slate-500 tabular-nums">
              Normal fasting range: 70–115 mg/dL
            </div>
          </div>

          <div className="glass-subtle rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="bio-core-temp"
                className="font-medium text-slate-800 inline-flex items-center gap-1"
              >
                <Thermometer className="w-3.5 h-3.5 text-sky-700" />
                <span>Core Body Temperature (°C)</span>
              </label>
              <span className={`font-medium ${tempStatus.cls}`}>{tempStatus.label}</span>
            </div>
            <input
              id="bio-core-temp"
              type="number"
              step="0.1"
              min="33"
              max="42"
              value={coreTemp}
              onChange={(e) => setCoreTemp(e.target.value)}
              className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 font-mono text-slate-900"
            />
            <div className="text-[11px] text-slate-500 tabular-nums">
              Normal oral/core range: 36.3–37.4 °C
            </div>
          </div>

          <div>
            <label htmlFor="bio-notes" className="block text-slate-600 mb-1">
              Symptom / Meal Context Note
            </label>
            <input
              id="bio-notes"
              type="text"
              maxLength={200}
              value={bioNotes}
              onChange={(e) => setBioNotes(e.target.value)}
              placeholder="e.g., Fasting morning check before ARED workout"
              className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-3 py-2 text-slate-900"
            />
          </div>
        </div>

        {bioSavedNotice && (
          <div className="text-xs text-emerald-800 bg-emerald-50/90 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{bioSavedNotice}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isBusy}
          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
        >
          Save Blood Sugar &amp; Core Temp
        </button>
      </form>

      {/* Right: Camera / Ultrasound / Ocular Image Capture */}
      <div className="lg:col-span-7 glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Camera className="w-4 h-4 text-sky-700" />
              <span>Diagnostic Camera &amp; Ultrasound Image Capture</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Capture live camera photos or upload ocular/ultrasound/skin scans stored privately on
              your device (metadata synced to Firestore).
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {storedScans.length} saved
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div>
            <label htmlFor="scan-region" className="block text-slate-600 mb-1">
              Body System
            </label>
            <select
              id="scan-region"
              value={bodyRegion}
              onChange={(e) => setBodyRegion(e.target.value as BodyRegionId)}
              className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-2.5 py-2 text-slate-900"
            >
              {BODY_SYSTEM_ATLAS.map((b) => (
                <option key={b.regionId} value={b.regionId}>
                  {b.shortLabel}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="scan-modality" className="block text-slate-600 mb-1">
              Scan Type
            </label>
            <select
              id="scan-modality"
              value={modality}
              onChange={(e) => setModality(e.target.value as DiagnosticScanEntry["modality"])}
              className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-2.5 py-2 text-slate-900"
            >
              <option value="OCULAR_SCAN">Ocular / Fundoscope</option>
              <option value="ULTRASOUND">Ultrasound Capture</option>
              <option value="SKIN_CHECK">Skin / Rash Photo</option>
              <option value="CAMERA_PHOTO">General Camera Photo</option>
            </select>
          </div>
          <div>
            <label htmlFor="scan-caption" className="block text-slate-600 mb-1">
              Observation Caption
            </label>
            <input
              id="scan-caption"
              type="text"
              maxLength={120}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g., Right eye post-sleep check"
              className="w-full bg-white/85 border border-slate-300/80 rounded-xl px-2.5 py-2 text-slate-900"
            />
          </div>
        </div>

        {/* Camera / Upload Action Row */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {!cameraActive ? (
            <button
              type="button"
              onClick={handleStartCamera}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Open Live Camera</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCaptureFrame}
                className="px-3.5 py-2 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Capture Snapshot</span>
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <CameraOff className="w-3.5 h-3.5" />
                <span>Close Camera</span>
              </button>
            </>
          )}

          <label className="px-3.5 py-2 bg-white/85 hover:bg-white border border-slate-300/80 rounded-xl text-slate-800 font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
            <ImagePlus className="w-3.5 h-3.5 text-sky-700" />
            <span>Upload Ultrasound / Photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadFile} />
          </label>
        </div>

        {cameraError && (
          <div className="text-xs text-amber-800 bg-amber-50/90 border border-amber-200 rounded-xl px-3 py-2">
            {cameraError}
          </div>
        )}

        {cameraActive && (
          <div className="glass-subtle rounded-xl p-3">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-h-60 rounded-lg bg-slate-900 object-cover"
            />
          </div>
        )}

        {capturedPreviewUrl && (
          <div className="glass-subtle rounded-xl p-3.5 flex flex-col sm:flex-row items-center gap-4">
            <img
              src={capturedPreviewUrl}
              alt="Captured diagnostic preview"
              referrerPolicy="no-referrer"
              className="w-36 h-24 rounded-lg object-cover border border-slate-200 shrink-0"
            />
            <div className="flex-1 space-y-2 text-xs w-full">
              <div className="font-medium text-slate-900">
                Ready to save ({modality.replace(/_/g, " ")})
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={async () => {
                    await onSaveDiagnosticScan({
                      bodyRegion,
                      modality,
                      caption: caption.trim() || `${modality.replace(/_/g, " ")} check`,
                      imageDataUrl: capturedPreviewUrl,
                      mimeType: capturedMime,
                      sizeBytes: capturedBytes,
                    });
                    setCapturedPreviewUrl(null);
                    setCaption("");
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl cursor-pointer whitespace-nowrap"
                >
                  Save Diagnostic Scan
                </button>
                <button
                  type="button"
                  onClick={() => setCapturedPreviewUrl(null)}
                  className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl cursor-pointer whitespace-nowrap"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Saved Scans Gallery */}
        {storedScans.length > 0 && (
          <div className="pt-2 border-t border-slate-200/70 space-y-2">
            <div className="text-xs font-semibold text-slate-800">Private Saved Scans</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {storedScans.slice(0, 4).map((scan) => (
                <div
                  key={scan.scanId}
                  className="glass-subtle rounded-xl p-2.5 flex items-center gap-3 text-xs"
                >
                  <img
                    src={scan.imageDataUrl}
                    alt={scan.caption}
                    referrerPolicy="no-referrer"
                    className="w-16 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">{scan.caption}</div>
                    <div className="text-[11px] text-slate-500">
                      {scan.bodyRegion} · {scan.createdAtIso.slice(0, 10)}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${scan.caption}`}
                    onClick={() => onDeleteDiagnosticScan(scan.scanId)}
                    className="p-1.5 text-slate-400 hover:text-rose-700 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
