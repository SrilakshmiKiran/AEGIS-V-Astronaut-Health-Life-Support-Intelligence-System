import React, { useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Database,
  HeartPulse,
  Lock,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { VISUAL_ASSETS } from "../assets/visualCatalog";
import { SafeImage } from "../components/SafeImage";

interface LandingPageProps {
  isAuthenticated: boolean;
  userEmail: string | null;
  isSigningIn: boolean;
  authError: string | null;
  onSignIn: () => Promise<void>;
  onEnterHomeDashboard: () => void;
}

const OPERATIONAL_JOURNEY = [
  { step: "01", label: "MONITOR" },
  { step: "02", label: "VALIDATE" },
  { step: "03", label: "ANALYZE" },
  { step: "04", label: "EXPLAIN" },
  { step: "05", label: "RESPOND" },
  { step: "06", label: "ESCALATE" },
  { step: "07", label: "FOLLOW UP" },
  { step: "08", label: "PRESERVE HISTORY" },
];

const CORE_PILLARS = [
  {
    number: "01",
    title: "Astronaut Health Intelligence",
    subtitle: "Personal 14-Day Baselines & Quality Filter",
    body: "Monitors 18 continuous vitals, cabin air, radiation, sleep, vision comfort (SANS), and hydration against personal P05–P95 bands while isolating stale or corrupted sensor telemetry.",
    image: VISUAL_ASSETS.liveVitals,
    alt: "Wearable biometric monitor and pulse oximetry sensors in spacecraft workstation",
    icon: Activity,
  },
  {
    number: "02",
    title: "Emergency Response",
    subtitle: "Stress-Ready Aid & Instant Escalation",
    body: "Provides instant triage guidance, red-flag checks, offline curated protocols, equipment location hints, and non-dismissible Urgent Emergency escalation when crew are distressed.",
    image: VISUAL_ASSETS.medicalHelp,
    alt: "Crew medical guidance tablet beside organized spaceflight emergency kit",
    icon: HeartPulse,
  },
  {
    number: "03",
    title: "Crew Continuity",
    subtitle: "Earth-Independent Operations & Role Bounds",
    body: "Preserves safe crew operations when Earth communications drop or the Crew Medical Officer is unavailable—showing training boundaries, equipment gaps, and offline procedure steppers.",
    image: VISUAL_ASSETS.continuityMode,
    alt: "Spacecraft continuity workstation displaying offline checklists",
    icon: Shield,
  },
  {
    number: "04",
    title: "Evidence & Accountability",
    subtitle: "7-Part Explanations & SHA-256 Audit Chain",
    body: "Separates raw sensor measurements from deterministic rules, AI-assisted plain-English summaries, and human approvals—retaining every decision in a verifiable audit trail and handoff record.",
    image: VISUAL_ASSETS.cardEarth,
    alt: "Earth horizon seen from sunlit orbital cupola above telemetry archive",
    icon: ShieldCheck,
  },
];

const PREVIEW_STEPS = [
  {
    id: 0,
    tabLabel: "1. Monitor astronaut health",
    eyebrow: "MONITOR & VALIDATE",
    heading: "Track 18 physiological & habitat channels against a personal 14-day normal range",
    body: "Instead of generic population averages, AEGIS-V checks heart rate, SpO2, cabin CO2, radiation dose, sleep, intraocular pressure, and hydration against each crew member's personal P05–P95 band—automatically flagging and quarantining stale or impossible readings before they distort trends.",
    sampleTelemetry: "Heart Rate 68 bpm (Normal 60.6–75.4) · Cabin CO2 3.1 mmHg · Validated Quality Gate",
    boundaries: "Provenance: Verified / Simulated telemetry separated from computed baseline comparisons.",
    image: VISUAL_ASSETS.liveVitals,
    imageAlt: "Orbital biomedical telemetry harness and oximetry monitor",
  },
  {
    id: 1,
    tabLabel: "2. Understand an emerging incident",
    eyebrow: "ANALYZE & EXPLAIN",
    heading: "Inspect 7-part plain-English alert evidence with clear clinical boundaries",
    body: "When multiple indicators drift together—such as rising cabin CO2 paired with dipping SpO2 and elevated fatigue—deterministic rule logic opens a structured incident showing exact measured values, z-scores, data-quality counts, uncertainty limits, and linked NASA/CSA research context.",
    sampleTelemetry: "INCIDENT OPEN · Rule RULE-HYPOXIA-CO2-MULTI-02 · Cabin CO2 5.4 mmHg · SpO2 92.4%",
    boundaries: "Prototype decision-support rule logic — not a validated clinical diagnosis.",
    image: VISUAL_ASSETS.cardVitals,
    imageAlt: "Crew health workstation displaying multi-parameter anomaly analysis",
  },
  {
    id: 2,
    tabLabel: "3. Respond when support is unavailable",
    eyebrow: "RESPOND & ESCALATE",
    heading: "Guide injured or non-medical crew safely when Earth or CMO is offline",
    body: "Launch I NEED MEDICAL HELP or Continuity Mode directly without fighting deep menus. Crew see which non-invasive procedures they are authorized to run, locate onboard medical hardware, follow step-by-step checklists, and respect locked CMO-only gates without impersonation.",
    sampleTelemetry: "Earth Comms: UNAVAILABLE · CMO: UNAVAILABLE · Continuity Operator: CREW_MEMBER",
    boundaries: "Offline approved checklists only — AI never invents medical steps or prescriptions.",
    image: VISUAL_ASSETS.continuityMode,
    imageAlt: "Crew continuity checklist and equipment readiness screen",
  },
  {
    id: 3,
    tabLabel: "4. Preserve the incident and follow-up record",
    eyebrow: "FOLLOW UP & PRESERVE HISTORY",
    heading: "Record actions, inspect before/after direction, and sync Earth handoffs",
    body: "Every crew note, equipment check, post-action telemetry direction, and unanswered question compiles automatically into a structured Markdown/JSON Earth Handoff Package buffered locally offline in IndexedDB and synced cleanly to private Firestore once communication restores.",
    sampleTelemetry: "SHA-256 Chain Verified · Handoff Package HANDOFF_001 → SYNCED to Base",
    boundaries: "Post-action charts show observed direction only; incidents never auto-close without human sign-off.",
    image: VISUAL_ASSETS.envHabitat,
    imageAlt: "Surface and orbital mission habitat communications console",
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  isAuthenticated,
  userEmail,
  isSigningIn,
  authError,
  onSignIn,
  onEnterHomeDashboard,
}) => {
  const [selectedStep, setSelectedStep] = useState(0);
  const currentPreview = PREVIEW_STEPS[selectedStep] || PREVIEW_STEPS[0];

  const handlePrimaryAction = () => {
    if (isAuthenticated) {
      onEnterHomeDashboard();
    } else {
      void onSignIn();
    }
  };

  return (
    <div className="space-y-12 pb-8">
      {/* HERO: Deep-Navy Aerospace Habitat Showcase */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#060B18] via-[#0B162C] to-[#0E2042] border border-slate-800/80 shadow-2xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 20%, rgba(56, 189, 248, 0.18), transparent 45%), radial-gradient(circle at 85% 75%, rgba(14, 165, 233, 0.14), transparent 50%)",
          }}
        />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 p-7 sm:p-10 lg:p-12 items-center">
          {/* Hero Narrative & Workspace Entry */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-3">
              <div className="font-mono text-[11px] font-semibold tracking-[0.18em] text-cyan-300 uppercase">
                LUNAR GATEWAY HABITAT PROTOTYPE
              </div>

              <h1
                className="font-bold tracking-tight text-white leading-[1.08] [text-wrap:balance]"
                style={{ fontSize: "clamp(2.2rem, 3.8vw, 3.55rem)" }}
              >
                When Earth is far away, every decision matters.
              </h1>

              <p className="text-sm sm:text-base font-medium text-cyan-200/95">
                Protecting the people who explore beyond Earth.
              </p>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
                An integrated astronaut health, emergency response, and Earth-independent crew
                continuity decision-support system—built for high-stakes human spaceflight when
                signal delay or communication blackouts limit ground support.
              </p>
            </div>

            {authError && (
              <div className="p-3.5 rounded-xl bg-rose-950/75 border border-rose-500/50 text-xs text-rose-200">
                {authError}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                disabled={isSigningIn}
                onClick={handlePrimaryAction}
                className="px-6 py-3 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 text-slate-950 text-sm font-bold rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/15"
              >
                <span>
                  {isAuthenticated
                    ? "Enter Mission Workspace"
                    : isSigningIn
                    ? "Entering Workspace..."
                    : "Enter Mission Workspace"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href="#how-it-works"
                className="px-5 py-3 bg-slate-900/70 hover:bg-slate-800/90 text-slate-100 border border-slate-700/90 text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2"
              >
                <span>Explore How It Works</span>
              </a>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
              {isAuthenticated ? (
                <span className="text-emerald-300 font-medium inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Private workspace active for {userEmail || "Crew Operator"}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <Lock className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                  <span>Sign in with Google to launch your private owner-isolated Firestore workspace</span>
                </span>
              )}
            </div>
          </div>

          {/* Right Hero Frame: Orbital Cupola Looking at Earth */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl bg-[#040812]">
              <div className="aspect-[16/9] w-full relative">
                <SafeImage
                  src={VISUAL_ASSETS.gatewayHero}
                  alt="Astronaut inside Lunar Gateway cupola looking out at the sunlit Earth horizon"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#060B18]/90 via-[#060B18]/45 to-transparent p-5">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-cyan-300">
                    Gateway Habitat Cupola · Autonomous Readiness
                  </div>
                  <p className="text-xs sm:text-sm text-slate-100 font-medium mt-0.5">
                    Continuous vitals supervision, offline emergency aid, and verifiable handoffs
                    even when Earth links fade.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Central Operational Journey Strip */}
        <div
          id="how-it-works"
          className="relative border-t border-slate-800/90 bg-[#050914]/90 px-6 sm:px-10 py-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Central End-to-End Mission Loop
            </span>
            <span className="text-[11px] text-slate-400">
              Research &amp; decision-support prototype · Non-diagnostic
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {OPERATIONAL_JOURNEY.map((stage) => (
              <div
                key={stage.step}
                className="rounded-xl bg-slate-900/75 border border-slate-800/90 px-3 py-2.5 flex flex-col justify-between"
              >
                <span className="font-mono text-[10px] text-cyan-300/90">{stage.step}</span>
                <span className="font-mono text-[11px] font-semibold text-slate-100 tracking-wide mt-0.5">
                  {stage.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 Core Aerospace Safety Pillars (Clean High-Contrast Editorial Surface) */}
      <section id="capabilities" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 px-1">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
              SYSTEM ARCHITECTURE
            </p>
            <h2 className="text-2xl font-bold text-white tracking-tight mt-0.5">
              Four Pillars of Deep-Space Crew Decision Support
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-md">
            Designed to keep every clinical limit explicit while supporting stressed crew with clear,
            offline-resilient action.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CORE_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.number}
                className="rounded-2xl overflow-hidden bg-white text-slate-900 border border-slate-200/90 shadow-xl flex flex-col"
              >
                <div className="aspect-[16/9] w-full overflow-hidden border-b border-slate-200/80">
                  <SafeImage src={pillar.image} alt={pillar.alt} />
                </div>
                <div className="p-6 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-sky-800">
                        PILLAR {pillar.number} · {pillar.subtitle}
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                      {pillar.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{pillar.body}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Interactive 4-Step Guided Product Preview */}
      <section
        id="preview"
        className="rounded-3xl bg-white text-slate-900 border border-slate-200/90 shadow-xl p-6 sm:p-8 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-sky-800">
              INTERACTIVE WORKFLOW PREVIEW
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              See How AEGIS-V Responds From Nominal Orbit to Blackout Recovery
            </h2>
          </div>

          <button
            type="button"
            disabled={isSigningIn}
            onClick={handlePrimaryAction}
            className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>
              {isAuthenticated ? "Open Live Workspace" : "Launch Mission Workspace"}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {PREVIEW_STEPS.map((st) => {
            const active = selectedStep === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStep(st.id)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border text-left transition-colors cursor-pointer ${
                  active
                    ? "bg-slate-950 text-white border-slate-950"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {st.tabLabel}
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl bg-slate-50/90 border border-slate-200/90 p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="font-mono text-[11px] font-semibold text-sky-800">
              {currentPreview.eyebrow}
            </div>
            <h3 className="text-lg font-bold text-slate-900 leading-snug">
              {currentPreview.heading}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">{currentPreview.body}</p>

            <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-1">
              <div className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                {currentPreview.sampleTelemetry}
              </div>
              <div className="text-[11px] text-slate-500">{currentPreview.boundaries}</div>
            </div>
          </div>

          <div className="lg:col-span-5 aspect-[16/10] rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            <SafeImage src={currentPreview.image} alt={currentPreview.imageAlt} />
          </div>
        </div>
      </section>

      {/* Account Isolation & Scientific Honesty Strip */}
      <section
        id="privacy"
        className="rounded-2xl bg-[#0B152A] border border-slate-800 p-6 sm:p-8 text-slate-200"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Database className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Owner-Isolated Cloud &amp; Offline Sync</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every observation, check-in, and emergency timeline is protected by Firebase Auth
              and owner-only Firestore security rules—with automatic local IndexedDB buffering when
              connectivity drops.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Deterministic Truth, Never AI Guesswork</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Alerts, thresholds, and emergency guidance come strictly from deterministic rules and
              approved static protocols. AI only assists optional plain-English summaries and never
              invents clinical steps.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Human-Controlled Escalation &amp; Closure</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Non-medical crew permissions cannot impersonate a Crew Medical Officer, and active
              alerts or emergencies never auto-close without explicit human verification.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
