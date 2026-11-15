import React, { useState } from "react";
import { Activity, ArrowRight, Database, Lock, Shield } from "lucide-react";
import { VISUAL_ASSETS } from "../assets/visualCatalog";
import { SafeImage } from "../components/SafeImage";

const heroOrbitalImg = VISUAL_ASSETS.heroOrbital;
const cardVitalsImg = VISUAL_ASSETS.cardVitals;
const cardEarthImg = VISUAL_ASSETS.cardEarth;

interface LandingPageProps {
  isAuthenticated: boolean;
  userEmail: string | null;
  isSigningIn: boolean;
  authError: string | null;
  onSignIn: () => Promise<void>;
  onEnterHomeDashboard: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  isAuthenticated,
  userEmail,
  isSigningIn,
  authError,
  onSignIn,
  onEnterHomeDashboard,
}) => {
  const [heroImgError, setHeroImgError] = useState(false);
  const [vitalsImgError, setVitalsImgError] = useState(false);
  const [earthImgError, setEarthImgError] = useState(false);

  return (
    <div className="space-y-12 pb-6">
      {/* Hero Section: App Name, Clear Plain-English Purpose, Orbital Habitat Visual & Google Sign-In */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 glass-panel rounded-2xl p-7 sm:p-10 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <p className="text-xs font-medium text-sky-800">
              AEGIS-V · Astronaut Health &amp; Life Support Monitoring
            </p>
            <h1
              className="font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance]"
              style={{ fontSize: "clamp(2.15rem, 3.6vw, 3.35rem)" }}
            >
              Calm, clear crew health monitoring with private cloud memory.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
              AEGIS-V tracks 18 astronaut vitals, daily check-ins, and cabin air metrics against a
              personal 14-day normal range. Faulty sensor spikes are filtered out automatically,
              every alert explains its evidence in plain English, and your records remain private to
              your Google account.
            </p>
          </div>

          {/* Primary Action Card inside Hero */}
          <div className="glass-subtle rounded-xl p-5 space-y-4">
            {authError && (
              <div className="p-3 rounded-lg bg-rose-50/90 border border-rose-200 text-xs text-rose-800">
                {authError}
              </div>
            )}

            {isAuthenticated ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-emerald-800">
                    ● Signed in privately as {userEmail || "Crew Operator"}
                  </div>
                  <p className="text-xs text-slate-600">
                    Your personal Firestore workspace is active and isolated from other accounts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onEnterHomeDashboard}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Open Home Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-sky-700" />
                    <span>Private Per-User Workspace</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Sign in with Google to open your dashboard. One person&apos;s data can never be
                    read by another user.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSignIn}
                  disabled={isSigningIn}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>{isSigningIn ? "Signing in..." : "Sign in with Google"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Primary Orbital Habitat Photography / Visual */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-3 flex flex-col">
          <div className="relative flex-1 min-h-[280px] lg:min-h-full rounded-xl overflow-hidden bg-gradient-to-br from-sky-100 via-slate-100 to-blue-50">
            {!heroImgError ? (
              <img
                src={heroOrbitalImg}
                alt="Sunlit orbital habitat observation dome above Earth atmosphere"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-600">
                <Shield className="w-10 h-10 text-sky-600 mb-2" />
                <span className="text-sm font-semibold text-slate-800">
                  AEGIS-V Orbital Habitat Module
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Continuous Crew Vitals &amp; Environmental Support
                </span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/75 via-slate-900/35 to-transparent p-5 text-white">
              <p className="text-xs font-medium text-sky-100">Orbital Habitat Cupola</p>
              <p className="text-sm font-semibold mt-0.5">
                Designed for autonomous onboard clarity when Earth communication lags.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Showcase & Plain-English Walkthrough Cards */}
      <section id="capabilities" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Visual Card 1: Astronaut Vitals */}
        <article className="lg:col-span-6 glass-panel rounded-2xl overflow-hidden flex flex-col">
          <div className="aspect-[4/3] w-full overflow-hidden bg-sky-50">
            {!vitalsImgError ? (
              <img
                src={cardVitalsImg}
                alt="Calm medical health tablet displaying normal astronaut heart rate and baseline ranges"
                referrerPolicy="no-referrer"
                onError={() => setVitalsImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-600">
                <Activity className="w-8 h-8 text-sky-600 mb-2" />
                <span className="text-sm font-medium">Personal 14-Day Vitals Baseline</span>
              </div>
            )}
          </div>
          <div className="p-6 space-y-2">
            <p className="text-xs text-slate-500">01 · Personal Baseline &amp; Quality Filter</p>
            <h2 className="text-lg font-semibold text-slate-900">
              Every metric compared to your own normal range
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Instead of generic averages, AEGIS-V compares 18 vitals, sleep, vision comfort, and
              cabin air readings against a crew member&apos;s personal P05–P95 range while isolating
              stale or impossible sensor data.
            </p>
          </div>
        </article>

        {/* Visual Card 2: Earth Horizon & Private Cloud Memory */}
        <article className="lg:col-span-6 glass-panel rounded-2xl overflow-hidden flex flex-col">
          <div className="aspect-[4/3] w-full overflow-hidden bg-sky-50">
            {!earthImgError ? (
              <img
                src={cardEarthImg}
                alt="Calm Earth horizon from low Earth orbit with sunlit cabin interior"
                referrerPolicy="no-referrer"
                onError={() => setEarthImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-600">
                <Database className="w-8 h-8 text-sky-600 mb-2" />
                <span className="text-sm font-medium">Private Cloud Memory &amp; Earth Sync</span>
              </div>
            )}
          </div>
          <div className="p-6 space-y-2">
            <p className="text-xs text-slate-500">02 · Private Cloud Memory &amp; Earth Sync</p>
            <h2 className="text-lg font-semibold text-slate-900">
              Isolated storage with step-by-step response tracking
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every daily check-in, alert review step, Flight Surgeon report, and backup snapshot
              persists in your private Firestore storage space—protected so only your account can
              access it.
            </p>
          </div>
        </article>
      </section>

      {/* Interactive 4-Step How It Works Preview for First-Time Visitors */}
      <LandingWorkflowPreview
        isAuthenticated={isAuthenticated}
        isSigningIn={isSigningIn}
        onPrimaryAction={isAuthenticated ? onEnterHomeDashboard : onSignIn}
      />

      {/* Clear 3-Column Plain-English Summary Strip */}
      <section id="privacy" className="glass-panel rounded-2xl p-6 sm:p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Activity className="w-4 h-4 text-sky-700 shrink-0" />
              <span>18 Tracked Measurements</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              8 live vitals &amp; habitat sensors plus 10 daily check-in parameters across sleep, eye
              pressure, nutrition, and hydration.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Shield className="w-4 h-4 text-sky-700 shrink-0" />
              <span>7-Part Transparent Alerts</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every alert surfaces raw sensor values, baseline variance, rule math, limitations, and
              before/after recovery trends.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Database className="w-4 h-4 text-sky-700 shrink-0" />
              <span>Strict Google Account Isolation</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Firebase Authentication and owner-only Firestore security rules keep each user&apos;s
              records completely separate and persistent.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

const PREVIEW_STEPS = [
  {
    id: 0,
    tabLabel: "1. Sign In & Baseline",
    heading: "Start in your private workspace with your 14-day personal normal range",
    body: "Sign in with Google to initialize your own isolated Firestore memory space. Every heart rate, SpO2, cabin CO2, blood sugar, and core temperature reading is compared against your personal range rather than one-size-fits-all averages.",
    sampleStatus: "● Example: Resting HR 68 bpm (Normal band 60.6–75.4 bpm)",
    image: VISUAL_ASSETS.heroOrbital,
    imageAlt: "Orbital habitat cupola overlooking sunlit Earth",
  },
  {
    id: 1,
    tabLabel: "2. Click Body Map",
    heading: "Tap any body system to see how spaceflight hazards affect it",
    body: "Use the interactive Human Body Atlas to click Brain, Eyes (SANS), Heart, Lungs, Bones, Kidneys, or Skin. Each organ explains why the measurement matters, which of NASA's 5 hazards applies, and what preventive steps to take.",
    sampleStatus: "▲ Example: Eyes (SANS) monitors upward fluid shift & eye pressure (12.8–16.2 mmHg)",
    image: VISUAL_ASSETS.bodyAtlas,
    imageAlt: "Medical tablet showing translucent astronaut anatomy and ocular scan",
  },
  {
    id: 2,
    tabLabel: "3. Log Check-Ins & Scans",
    heading: "Save sleep, blood sugar, voice observations, and camera/ultrasound scans",
    body: "Record quick daily check-ins, attach 45-second voice memos, and capture live camera or ultrasound snapshots. Works offline in IndexedDB and syncs automatically when Earth link returns.",
    sampleStatus: "● Example: Blood Sugar 94 mg/dL · Core Temp 36.8 °C · 1 Voice Memo saved",
    image: VISUAL_ASSETS.dailyCheckin,
    imageAlt: "Handheld ultrasound probe, digital thermometer, and glucose meter on orbital desk",
  },
  {
    id: 3,
    tabLabel: "4. Autonomous AI Triage",
    heading: "Follow step-by-step alerts and get grounded summaries even on Mars delay",
    body: "When metrics drift, AEGIS-V guides you through emergency checklists, Flight Surgeon reports, and an onboard AI Triage Helper built for 14-minute Earth communication delays.",
    sampleStatus: "● Example: Mars 14m 20s async mode · Guided checklist & report ready",
    image: VISUAL_ASSETS.envHabitat,
    imageAlt: "Sunlit off-world surface research habitat domes with solar panels",
  },
];

const LandingWorkflowPreview: React.FC<{
  isAuthenticated: boolean;
  isSigningIn: boolean;
  onPrimaryAction: () => void;
}> = ({ isAuthenticated, isSigningIn, onPrimaryAction }) => {
  const [selectedStep, setSelectedStep] = useState(0);
  const current = PREVIEW_STEPS[selectedStep] || PREVIEW_STEPS[0];

  return (
    <section className="glass-panel rounded-2xl p-6 sm:p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            First Time Here? See How AEGIS-V Works in 4 Interactive Steps
          </h2>
          <p className="text-xs text-slate-500">
            Click any step below to preview the workflow—once signed in, a guided tour walks you
            through live controls inside the app.
          </p>
        </div>
        <button
          type="button"
          disabled={isSigningIn}
          onClick={onPrimaryAction}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
        >
          <span>
            {isAuthenticated
              ? "Open Dashboard & Interactive Tour"
              : isSigningIn
              ? "Signing in..."
              : "Sign in to Try Live"}
          </span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PREVIEW_STEPS.map((st) => {
          const active = selectedStep === st.id;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => setSelectedStep(st.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white/75 text-slate-700 border-slate-200 hover:bg-white"
              }`}
            >
              {st.tabLabel}
            </button>
          );
        })}
      </div>

      <div className="glass-subtle rounded-xl p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        <div className="md:col-span-7 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">{current.heading}</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{current.body}</p>
          <div className="text-xs font-mono text-sky-900 pt-1">{current.sampleStatus}</div>
        </div>
        <div className="md:col-span-5 aspect-[16/10] rounded-xl overflow-hidden border border-slate-200/80">
          <SafeImage src={current.image} alt={current.imageAlt} />
        </div>
      </div>
    </section>
  );
};
