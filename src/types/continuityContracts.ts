import { ActorRole, ParameterName, RuleId } from "./aegisContracts";

export type CrewAvailabilityStatus = "AVAILABLE" | "BUSY" | "UNAVAILABLE";

export type MedicalQualificationTier =
  | "CMO_QUALIFIED"
  | "CREW_FIRST_RESPONDER"
  | "NON_MEDICAL_SPECIALIST";

export interface CrewCapabilityProfile {
  crewId: string;
  medicalTier: MedicalQualificationTier;
  recordedTraining: string[];
  assignedResponsibilities: string[];
  permittedTasks: string[];
  restrictedTasks: string[];
  defaultAvailability: CrewAvailabilityStatus;
  simulatedLabel: string;
}

export type EquipmentOperationalStatus = "OPERATIONAL" | "LIMITED" | "UNAVAILABLE";

export interface OnboardMedicalEquipment {
  equipmentId: string;
  name: string;
  category: "DIAGNOSTIC_HARDWARE" | "LIFE_SUPPORT_TEST" | "EMERGENCY_HARDWARE" | "REFERENCE_ARCHIVE";
  emergencyCategory?: "ENVIRONMENTAL" | "RESPIRATORY_MEDICAL" | "FIRE_PRESSURE" | "DIAGNOSTIC";
  operationalStatus: EquipmentOperationalStatus;
  location: string;
  requiresTraining: string;
  relevantRuleIds: RuleId[];
  referenceAvailableOffline: boolean;
  notes: string;
  maintenanceOrExpiryInfo?: string;
  defaultLastConfirmedIso: string | null;
  confirmationSourceNote: string;
  isSimulated: true;
}

export interface GuidedProcedureStep {
  stepNumber: number;
  title: string;
  instruction: string;
  verificationCue: string;
  cautionNote?: string;
}

export interface GuidedProcedure {
  procedureId: string;
  title: string;
  operationalContext: string;
  category: "CABIN_ENVIRONMENT" | "CARDIORESPIRATORY" | "RADIATION" | "CREW_WELLNESS" | "CMO_RESTRICTED";
  requiredEquipmentIds: string[];
  requiredConsumableIds: string[];
  requiredTraining: string;
  allowedRoles: ActorRole[];
  requiresCmo: boolean;
  relevantRuleIds: RuleId[];
  source: string;
  version: string;
  limitations: string[];
  steps: GuidedProcedureStep[];
  isSimulatedPrototype: true;
}

export interface EquipmentConfirmationRecord {
  confirmedAtIso: string;
  confirmedBy: string;
}

export interface ContinuityPersistedState {
  continuityActive: boolean;
  cmoAvailable: boolean;
  cmoStatusReason: string;
  replacementOperatorCrewId: string;
  crewAvailabilityOverrides: Record<string, CrewAvailabilityStatus>;
  equipmentStatusOverrides: Record<string, EquipmentOperationalStatus>;
  procedureStepsDone: Record<string, number[]>;
  accessedProcedureIds: string[];
  activeProcedureId?: string;
  procedureCurrentStep?: Record<string, number>;
  equipmentConfirmations?: Record<string, EquipmentConfirmationRecord>;
  walkthroughStep: number;
  updatedAtIso: string;
}

export interface ResourceReadinessMatch {
  incidentRuleId: RuleId | null;
  availableEquipment: OnboardMedicalEquipment[];
  unavailableOrLimitedEquipment: OnboardMedicalEquipment[];
  availableConsumables: Array<{
    recordId: string;
    name: string;
    stockQty: number;
    unit: string;
    expiresOn: string;
    isLowOrExpiring: boolean;
    cmoControlled: boolean;
  }>;
  missingOrDepletedConsumables: Array<{
    recordId: string;
    name: string;
    reason: string;
  }>;
  availableReferenceCount: number;
  relevantProcedureIds: string[];
}

export interface MissionSupportStatusSummary {
  earthCommsStatus: "AVAILABLE" | "UNAVAILABLE";
  cmoStatus: "AVAILABLE" | "UNAVAILABLE";
  continuityModeActive: boolean;
  activeOperatorRole: ActorRole;
  replacementOperatorName: string;
  availableCrewCount: number;
  unavailableCrewCount: number;
  availableTrainedResponders: string[];
  operationalEquipmentCount: number;
  unavailableEquipmentCount: number;
  offlineReferenceCount: number;
  accessibleProcedureCount: number;
  lockedProcedureCount: number;
  availableItems: string[];
  unavailableOrMissingItems: string[];
  uncertaintiesAndGaps: string[];
}

export interface EarthHandoffPackageData {
  packageId: string;
  generatedAtIso: string;
  astronautId: string;
  astronautName: string;
  missionName: string;
  continuityModeActive: boolean;
  earthCommsAtGeneration: "AVAILABLE" | "UNAVAILABLE";
  cmoAvailabilityAtGeneration: "AVAILABLE" | "UNAVAILABLE";
  preparedByCrewId: string;
  preparedByRole: ActorRole;
  incidentId: string;
  incidentTitle: string;
  incidentTimeline: Array<{ timestamp: string; title: string; detail: string }>;
  recordedObservationsSummary: Array<{
    parameter: ParameterName;
    label: string;
    value: string;
    qualityStatus: string;
    timestamp: string;
  }>;
  dataQualityWarnings: string[];
  baselineComparisonsSummary: string[];
  deterministicFindingsSummary: string[];
  crewRecordedActions: string[];
  availableResourcesSummary: string[];
  missingResourcesSummary: string[];
  proceduresAccessed: Array<{
    procedureId: string;
    title: string;
    version: string;
    completedSteps: number;
    totalSteps: number;
  }>;
  followUpObservations: string[];
  unansweredQuestions: string[];
  uncertaintyStatements: string[];
  markdownDocument: string;
}

export const SIMULATED_CREW_CAPABILITIES: Record<string, CrewCapabilityProfile> = {
  "AST-01-COMMANDER": {
    crewId: "AST-01-COMMANDER",
    medicalTier: "CREW_FIRST_RESPONDER",
    recordedTraining: [
      "Simulated Crew First-Responder Orientation (Non-Physician)",
      "ECLSS Cabin Air & CO2 Bypass Isolation",
      "Basic Wearable Sensor & SpO2 Fit Check",
    ],
    assignedResponsibilities: [
      "Mission Command & Continuity Coordinator",
      "Habitat ECLSS Verification",
      "Incident Evidence Review & Earth Handoff Packaging",
    ],
    permittedTasks: [
      "Review deterministic alert evidence and personal baseline trends",
      "Run crew-level non-invasive procedures (ECLSS check, seated rest, hydration, shelter verification)",
      "Log daily observations, check-ins, checklist steps, and prepare Earth handoff package",
    ],
    restrictedTasks: [
      "Cannot impersonate Crew Medical Officer or bypass CMO+PIN authorization",
      "Cannot authorize CMO-controlled pharmaceuticals (e.g., Modafinil) or invasive procedures",
      "Cannot issue medical diagnosis or close CMO-gated clinical incidents",
    ],
    defaultAvailability: "AVAILABLE",
    simulatedLabel: "Simulated Crew Training Profile",
  },
  "AST-02-FE-PILOT": {
    crewId: "AST-02-FE-PILOT",
    medicalTier: "CMO_QUALIFIED",
    recordedTraining: [
      "Designated Crew Medical Officer (CMO) — Simulated Flight Crew Medical Track",
      "Portable Ultrasound, Tonometry & Emergency Triage",
      "CMO Controlled Medication Stewardship",
    ],
    assignedResponsibilities: [
      "Primary Crew Medical Officer",
      "Clinical Authorization & Incident Closure (PIN-Gated)",
      "Controlled Pharmaceutical Release",
    ],
    permittedTasks: [
      "All crew-level tasks plus CMO-authorized response recording and incident closure",
      "CMO-restricted clinical assessment checklist and controlled medication release",
    ],
    restrictedTasks: [
      "Prototype system still requires Earth Flight Surgeon confirmation for definitive care",
    ],
    defaultAvailability: "AVAILABLE",
    simulatedLabel: "Simulated Crew Training Profile (Designated CMO)",
  },
  "AST-03-SPECIALIST": {
    crewId: "AST-03-SPECIALIST",
    medicalTier: "NON_MEDICAL_SPECIALIST",
    recordedTraining: [
      "EVA Suit & Airlock Safety Monitoring",
      "Radiation Dosimeter & Storm Shelter Verification",
      "Basic Vital Sensor Placement Helper",
    ],
    assignedResponsibilities: [
      "EVA Hardware & Habitat Shielding Operations",
      "Secondary Environmental Check Support",
    ],
    permittedTasks: [
      "Log habitat/suit checks and assist with non-invasive sensor placement",
      "Execute radiation storm shelter verification checklist",
    ],
    restrictedTasks: [
      "No medical officer authority; cannot authorize medical interventions or close incidents",
      "Limited to non-clinical hardware, environmental, and observation logging",
    ],
    defaultAvailability: "AVAILABLE",
    simulatedLabel: "Simulated Crew Training Profile",
  },
  "AST-04-SCIENTIST": {
    crewId: "AST-04-SCIENTIST",
    medicalTier: "CREW_FIRST_RESPONDER",
    recordedTraining: [
      "Bioastronautics Research & Ocular/OCT Capture Support",
      "Simulated Crew First-Responder Orientation (Non-Physician)",
      "Telemetry Data Quality & Baseline Documentation",
    ],
    assignedResponsibilities: [
      "Diagnostic Imaging & Telemetry Capture Support",
      "Follow-Up Observation & Trend Documentation",
    ],
    permittedTasks: [
      "Capture fundoscope/ocular ultrasound media and review data-quality quarantines",
      "Run crew-level non-invasive wellness and fluid-shift documentation checklists",
    ],
    restrictedTasks: [
      "Cannot authorize CMO-gated incident actions or dispense CMO-controlled medications",
      "Diagnostic captures require CMO or Earth Flight Surgeon interpretation",
    ],
    defaultAvailability: "BUSY",
    simulatedLabel: "Simulated Crew Training Profile",
  },
};

export const ONBOARD_MEDICAL_EQUIPMENT: OnboardMedicalEquipment[] = [
  {
    equipmentId: "EQ-BIOMONITOR-01",
    name: "CSA Bio-Monitor Wearable Smart Shirt",
    category: "DIAGNOSTIC_HARDWARE",
    emergencyCategory: "DIAGNOSTIC",
    operationalStatus: "OPERATIONAL",
    location: "Crew Quarters Locker A2",
    requiresTraining: "Basic Wearable Sensor & SpO2 Fit Check",
    relevantRuleIds: ["RULE-CARDIO-TREND-01", "RULE-HYPOXIA-CO2-MULTI-02", "RULE-DATA-QUALITY-04"],
    referenceAvailableOffline: true,
    notes: "Simulated hardware status: streaming HR, SpO2, BP estimate, skin temp, respiration.",
    maintenanceOrExpiryInfo: "Electrode gel pads exp 2027-09 · Battery check weekly",
    defaultLastConfirmedIso: "2026-11-14T08:00:00Z",
    confirmationSourceNote: "Simulated demo shift inventory check",
    isSimulated: true,
  },
  {
    equipmentId: "EQ-OXIMETER-02",
    name: "Secondary Finger Pulse Oximeter",
    category: "DIAGNOSTIC_HARDWARE",
    emergencyCategory: "RESPIRATORY_MEDICAL",
    operationalStatus: "OPERATIONAL",
    location: "Med Bay Drawer M1",
    requiresTraining: "Simulated Crew First-Responder Orientation (Non-Physician)",
    relevantRuleIds: ["RULE-HYPOXIA-CO2-MULTI-02", "RULE-DATA-QUALITY-04"],
    referenceAvailableOffline: true,
    notes: "Used to cross-check wearable SpO2 dips and rule out motion artifact.",
    maintenanceOrExpiryInfo: "Calibration verified 2026-11-01 · Lithium cells 94%",
    defaultLastConfirmedIso: "2026-11-14T08:00:00Z",
    confirmationSourceNote: "Simulated demo shift inventory check",
    isSimulated: true,
  },
  {
    equipmentId: "EQ-CDRA-TEST-03",
    name: "Cabin CO2 Scrubber Differential Gauge & Airflow Wand",
    category: "LIFE_SUPPORT_TEST",
    emergencyCategory: "ENVIRONMENTAL",
    operationalStatus: "OPERATIONAL",
    location: "Node-2 ECLSS Rack",
    requiresTraining: "ECLSS Cabin Air & CO2 Bypass Isolation",
    relevantRuleIds: ["RULE-HYPOXIA-CO2-MULTI-02"],
    referenceAvailableOffline: true,
    notes: "Confirms localized CO2 pocket ventilation and CDRA bypass valve position.",
    maintenanceOrExpiryInfo: "Zero-flow calibration due 2027-03",
    defaultLastConfirmedIso: "2026-11-14T08:00:00Z",
    confirmationSourceNote: "Simulated demo shift inventory check",
    isSimulated: true,
  },
  {
    equipmentId: "EQ-TONOMETER-04",
    name: "Portable Handheld Ocular Tonometer",
    category: "DIAGNOSTIC_HARDWARE",
    emergencyCategory: "DIAGNOSTIC",
    operationalStatus: "LIMITED",
    location: "Med Bay Drawer M2",
    requiresTraining: "Bioastronautics Research & Ocular/OCT Capture Support",
    relevantRuleIds: ["RULE-FLUID-EYE-SANS-06"],
    referenceAvailableOffline: true,
    notes: "Simulated limited status: single-operator calibration requires second crew spotter.",
    maintenanceOrExpiryInfo: "Probe tips exp 2027-01 · Requires 2-crew spotter",
    defaultLastConfirmedIso: "2026-11-13T18:30:00Z",
    confirmationSourceNote: "Simulated demo inventory (calibrated 14h ago)",
    isSimulated: true,
  },
  {
    equipmentId: "EQ-DOSIMETER-05",
    name: "Crew Personal & Habitat Area Dosimeter Kit",
    category: "LIFE_SUPPORT_TEST",
    emergencyCategory: "ENVIRONMENTAL",
    operationalStatus: "OPERATIONAL",
    location: "Storm Shelter Bulkhead",
    requiresTraining: "Radiation Dosimeter & Storm Shelter Verification",
    relevantRuleIds: ["RULE-RAD-EXPOSURE-03"],
    referenceAvailableOffline: true,
    notes: "Tracks ambient mSv/hr and cumulative shelter dose verification.",
    maintenanceOrExpiryInfo: "Dosimeter badge swap cycle 2027-02",
    defaultLastConfirmedIso: "2026-11-14T08:00:00Z",
    confirmationSourceNote: "Simulated demo shift inventory check",
    isSimulated: true,
  },
  {
    equipmentId: "EQ-CAPNOGRAPHY-06",
    name: "Portable Capnography & Blood-Gas Analyzer",
    category: "EMERGENCY_HARDWARE",
    emergencyCategory: "RESPIRATORY_MEDICAL",
    operationalStatus: "UNAVAILABLE",
    location: "Not Manifested on Current Flight Increment",
    requiresTraining: "Designated Crew Medical Officer (CMO)",
    relevantRuleIds: ["RULE-HYPOXIA-CO2-MULTI-02", "RULE-CARDIO-TREND-01"],
    referenceAvailableOffline: false,
    notes:
      "Missing/Unavailable in this prototype increment — arterial blood gas & end-tidal CO2 remain an information gap.",
    maintenanceOrExpiryInfo: "Not manifested · Ground resupply pending",
    defaultLastConfirmedIso: null,
    confirmationSourceNote: "Simulated demo manifest gap — not onboard",
    isSimulated: true,
  },
  {
    equipmentId: "EQ-O2-PBA-07",
    name: "Portable Breathing Apparatus (PBA) & Emergency O2 Mask",
    category: "EMERGENCY_HARDWARE",
    emergencyCategory: "FIRE_PRESSURE",
    operationalStatus: "OPERATIONAL",
    location: "Node-2 Forward Hatch Locker E1",
    requiresTraining: "EVA Suit & Airlock Safety Monitoring",
    relevantRuleIds: ["RULE-HYPOXIA-CO2-MULTI-02"],
    referenceAvailableOffline: true,
    notes: "Simulated emergency breathing air bottle (15-min crew transit supply) & full-face smoke seal.",
    maintenanceOrExpiryInfo: "Hydrostatic test due 2027-08 · Tamper seal intact",
    defaultLastConfirmedIso: "2026-11-14T08:00:00Z",
    confirmationSourceNote: "Simulated demo emergency readiness baseline",
    isSimulated: true,
  },
  {
    equipmentId: "EQ-EXTINGUISHER-08",
    name: "Fine-Water-Mist & CO2 Spacecraft Fire Extinguisher",
    category: "EMERGENCY_HARDWARE",
    emergencyCategory: "FIRE_PRESSURE",
    operationalStatus: "OPERATIONAL",
    location: "Galley & Node-2 Port Bracket F1",
    requiresTraining: "ECLSS Cabin Air & CO2 Bypass Isolation",
    relevantRuleIds: [],
    referenceAvailableOffline: true,
    notes: "Simulated fire-suppression canister rated for electrical & cabin avionics bays.",
    maintenanceOrExpiryInfo: "Pressure gauge in green zone · Inspection due 2027-05",
    defaultLastConfirmedIso: "2026-11-14T08:00:00Z",
    confirmationSourceNote: "Simulated demo emergency readiness baseline",
    isSimulated: true,
  },
  {
    equipmentId: "EQ-LEAK-PATCH-09",
    name: "Cabin Pressure-Loss & Hatch Seal Patch Kit",
    category: "LIFE_SUPPORT_TEST",
    emergencyCategory: "ENVIRONMENTAL",
    operationalStatus: "OPERATIONAL",
    location: "Airlock Crew Locker S2",
    requiresTraining: "EVA Suit & Airlock Safety Monitoring",
    relevantRuleIds: [],
    referenceAvailableOffline: true,
    notes: "Simulated ultrasonic leak detector wand, elastomeric patches, and hatch seal wipes.",
    maintenanceOrExpiryInfo: "Sealant compound exp 2028-02 · Ultrasonic cell 100%",
    defaultLastConfirmedIso: "2026-11-14T08:00:00Z",
    confirmationSourceNote: "Simulated demo emergency readiness baseline",
    isSimulated: true,
  },
  {
    equipmentId: "EQ-TRAUMA-KIT-10",
    name: "Trauma, Bleeding & Wound First-Aid Pack (Gauze, Saline, Pressure Bandage)",
    category: "EMERGENCY_HARDWARE",
    emergencyCategory: "RESPIRATORY_MEDICAL",
    operationalStatus: "OPERATIONAL",
    location: "Med Bay Drawer M1 (Red Trauma Pouch)",
    requiresTraining: "Simulated Crew First-Responder Orientation (Non-Physician)",
    relevantRuleIds: [],
    referenceAvailableOffline: true,
    notes: "Simulated emergency pack: sterile gauze pads, roller pressure bandage, medical tape, nitrile gloves, saline wound flush.",
    maintenanceOrExpiryInfo: "Sterile saline flushes exp 2027-07 · Tamper seal intact",
    defaultLastConfirmedIso: "2026-11-14T08:00:00Z",
    confirmationSourceNote: "Simulated demo shift inventory check",
    isSimulated: true,
  },
  {
    equipmentId: "EQ-SPLINT-BRACE-11",
    name: "Moldable Fracture Splint, Triangular Sling & Cold Pack",
    category: "EMERGENCY_HARDWARE",
    emergencyCategory: "RESPIRATORY_MEDICAL",
    operationalStatus: "OPERATIONAL",
    location: "Med Bay Drawer M3",
    requiresTraining: "Simulated Crew First-Responder Orientation (Non-Physician)",
    relevantRuleIds: [],
    referenceAvailableOffline: true,
    notes: "Simulated orthopedic immobilization kit: SAM-style aluminum foam splint, elastic wrap, sling, instant cold compress.",
    maintenanceOrExpiryInfo: "Cold packs inspected 2026-11-01 · 4 units stocked",
    defaultLastConfirmedIso: "2026-11-14T08:00:00Z",
    confirmationSourceNote: "Simulated demo shift inventory check",
    isSimulated: true,
  },
  {
    equipmentId: "EQ-EYE-WASH-12",
    name: "Sterile Ocular Irrigation Bottle & Rigid Eye Shield",
    category: "EMERGENCY_HARDWARE",
    emergencyCategory: "RESPIRATORY_MEDICAL",
    operationalStatus: "OPERATIONAL",
    location: "Med Bay Drawer M2 (Ocular Tray)",
    requiresTraining: "Simulated Crew First-Responder Orientation (Non-Physician)",
    relevantRuleIds: ["RULE-FLUID-EYE-SANS-06"],
    referenceAvailableOffline: true,
    notes: "Simulated zero-gravity eye-flush cup, sterile isotonic eyewash, and protective Fox eye shield.",
    maintenanceOrExpiryInfo: "Isotonic flush exp 2027-05 · Seal intact",
    defaultLastConfirmedIso: "2026-11-14T08:00:00Z",
    confirmationSourceNote: "Simulated demo shift inventory check",
    isSimulated: true,
  },
  {
    equipmentId: "EQ-BURN-DRESSING-13",
    name: "Sterile Hydrogel Burn Dressing & Non-Adherent Pads",
    category: "EMERGENCY_HARDWARE",
    emergencyCategory: "RESPIRATORY_MEDICAL",
    operationalStatus: "LIMITED",
    location: "Med Bay Drawer M1 (Upper Tray)",
    requiresTraining: "Simulated Crew First-Responder Orientation (Non-Physician)",
    relevantRuleIds: [],
    referenceAvailableOffline: true,
    notes: "Simulated limited stock: 2 sterile hydrogel sheets remaining; pair with clean dry non-stick gauze if depleted.",
    maintenanceOrExpiryInfo: "Hydrogel sheets exp 2027-02 · Low reserve (2 sheets)",
    defaultLastConfirmedIso: "2026-11-14T08:00:00Z",
    confirmationSourceNote: "Simulated demo inventory — low reserve noted",
    isSimulated: true,
  },
  {
    equipmentId: "EQ-AED-DEFIB-14",
    name: "Automated External Defibrillator (AED) & Chest Leads",
    category: "EMERGENCY_HARDWARE",
    emergencyCategory: "RESPIRATORY_MEDICAL",
    operationalStatus: "OPERATIONAL",
    location: "Node-2 Medical Bulkhead Wall Mount",
    requiresTraining: "Simulated Crew First-Responder Orientation (Non-Physician)",
    relevantRuleIds: ["RULE-CARDIO-TREND-01"],
    referenceAvailableOffline: true,
    notes: "Simulated onboard AED unit with microgravity restraint straps and voice prompts.",
    maintenanceOrExpiryInfo: "Self-test PASS 2026-11-14 · Pads exp 2027-10",
    defaultLastConfirmedIso: "2026-11-14T08:00:00Z",
    confirmationSourceNote: "Simulated daily self-test check",
    isSimulated: true,
  },
];

export const GUIDED_PROCEDURES: GuidedProcedure[] = [
  {
    procedureId: "PROC-ENV-CO2-01",
    title: "Crew-Permitted Cabin CO2 & Seated Rest Verification",
    operationalContext:
      "Elevated cabin CO2 (>4.5 mmHg) or SpO2 dip (<94.5%) when Earth link or CMO guidance is delayed/unavailable.",
    category: "CABIN_ENVIRONMENT",
    requiredEquipmentIds: ["EQ-OXIMETER-02", "EQ-CDRA-TEST-03"],
    requiredConsumableIds: [],
    requiredTraining: "ECLSS Cabin Air & CO2 Bypass Isolation / Crew First-Responder Orientation",
    allowedRoles: ["CREW_MEDICAL_OFFICER", "CREW_MEMBER"],
    requiresCmo: false,
    relevantRuleIds: ["RULE-HYPOXIA-CO2-MULTI-02", "RULE-DATA-QUALITY-04"],
    source: "AEGIS-V Prototype Continuity Reference Pack (Derived from ISS ECLSS / HRP Context)",
    version: "v1.2-SIM-PROTOTYPE",
    limitations: [
      "Simulated prototype checklist — NOT an official NASA Flight Rule or clinical treatment order.",
      "Does not measure arterial blood gas or carboxyhemoglobin (capnography unavailable).",
      "Escalate immediately to Earth Flight Surgeon when link restores or if SpO2 remains <94% after 15 min.",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Verify Sensor Contact & Cross-Check SpO2",
        instruction:
          "Inspect the wearable Bio-Monitor strap fit and take a 60-second resting reading with the secondary finger pulse oximeter.",
        verificationCue: "Confirm whether the secondary SpO2 reading matches the wearable value within +/-2%.",
        cautionNote: "Quarantined/stale telemetry must not be used to clear an active alert.",
      },
      {
        stepNumber: 2,
        title: "Inspect Node-2 CO2 Scrubber Airflow & Venting",
        instruction:
          "Check CDRA / CO2 scrubber fan differential gauge and confirm personal ventilation duct near crew station is unobstructed.",
        verificationCue: "Record whether airflow indicator is within nominal green arc and note any fan fault.",
      },
      {
        stepNumber: 3,
        title: "Move Crew Member to Ventilated Seated Rest & Hydrate",
        instruction:
          "Pause heavy physical exertion, move crew member to well-ventilated module zone, and provide 250 mL potable water if alert and able.",
        verificationCue: "Log seated rest start time and repeat SpO2 / HR / respiration check after 10–15 minutes.",
      },
      {
        stepNumber: 4,
        title: "Log Checklist & Prepare Earth Handoff Package",
        instruction:
          "Save completed checklist steps, record any residual symptoms, and build the structured Earth Handoff Package for delayed review.",
        verificationCue: "Verify handoff package appears as PENDING in the local queue until Earth link restores.",
      },
    ],
    isSimulatedPrototype: true,
  },
  {
    procedureId: "PROC-CARDIO-REST-02",
    title: "Crew-Permitted Exertion Pause & Repeat Vital Observation",
    operationalContext:
      "Sustained resting heart rate elevation (>95 bpm) outside personal 14-day P05–P95 band during autonomous operations.",
    category: "CARDIORESPIRATORY",
    requiredEquipmentIds: ["EQ-BIOMONITOR-01", "EQ-OXIMETER-02"],
    requiredConsumableIds: [],
    requiredTraining: "Basic Wearable Sensor & SpO2 Fit Check",
    allowedRoles: ["CREW_MEDICAL_OFFICER", "CREW_MEMBER"],
    requiresCmo: false,
    relevantRuleIds: ["RULE-CARDIO-TREND-01", "RULE-DATA-QUALITY-04"],
    source: "AEGIS-V Prototype Continuity Reference Pack (Cardiovascular Monitoring Context)",
    version: "v1.1-SIM-PROTOTYPE",
    limitations: [
      "Simulated prototype observation guide — does not diagnose arrhythmia or cardiac pathology.",
      "Cannot replace 12-lead ECG interpretation or Flight Surgeon review.",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Confirm Activity Context & Pause Exertion",
        instruction:
          "Verify whether ARED/EVA exercise occurred in the last 30 minutes. Pause strenuous activity and place crew member at seated rest.",
        verificationCue: "Confirm Activity Mode matches actual crew state on dashboard.",
      },
      {
        stepNumber: 2,
        title: "Check Thermal Load, Hydration & Core Temp",
        instruction:
          "Record skin/core temperature and review daily hydration volume (<2,250 mL/day increases orthostatic HR drift).",
        verificationCue: "Log Core Temp and Hydration in Daily Check-In if missing.",
      },
      {
        stepNumber: 3,
        title: "Capture 15-Minute Follow-Up Vitals & Export Handoff",
        instruction:
          "Observe heart rate and blood pressure trend after 15 minutes of rest and attach ECG strip or observation memo to Earth handoff.",
        verificationCue: "Document whether HR trend is IMPROVING, STABLE, or WORSENING.",
      },
    ],
    isSimulatedPrototype: true,
  },
  {
    procedureId: "PROC-RAD-SHELTER-03",
    title: "Solar Particle Event Shelter & Dosimetry Verification",
    operationalContext:
      "Ambient radiation rate exceeds 0.10 mSv/hr or solar particle storm flag becomes active during deep-space autonomy.",
    category: "RADIATION",
    requiredEquipmentIds: ["EQ-DOSIMETER-05"],
    requiredConsumableIds: [],
    requiredTraining: "Radiation Dosimeter & Storm Shelter Verification",
    allowedRoles: ["CREW_MEDICAL_OFFICER", "CREW_MEMBER"],
    requiresCmo: false,
    relevantRuleIds: ["RULE-RAD-EXPOSURE-03"],
    source: "AEGIS-V Prototype Continuity Reference Pack (CSA/NASA ALARA Context)",
    version: "v1.0-SIM-PROTOTYPE",
    limitations: [
      "Simulated prototype shelter verification checklist — does not compute organ-equivalent biological dose.",
      "Follow spacecraft/habitat flight director shelter boundaries whenever active.",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Verify Dosimeter Calibration & Crew Shelter Entry",
        instruction:
          "Confirm personal dosimeters are worn and direct non-essential crew to the designated water/polyethylene storm shelter bay.",
        verificationCue: "Log shelter entry timestamp and confirm area rate reading inside shelter.",
      },
      {
        stepNumber: 2,
        title: "Monitor Cumulative Dose Budget & Record Status",
        instruction:
          "Compare cumulative dose against 600 mSv mission prototype budget and queue status note in Earth handoff package.",
        verificationCue: "Confirm all crew members accounted for on Crew Capability Board.",
      },
    ],
    isSimulatedPrototype: true,
  },
  {
    procedureId: "PROC-HRP-WELLNESS-04",
    title: "Crew Wellness, Fluid-Shift & Hydration Support Checklist",
    operationalContext:
      "Multi-day ARCheR sleep/fatigue drift, sub-target hydration/calories, or persistent visual symptoms with CMO unavailable.",
    category: "CREW_WELLNESS",
    requiredEquipmentIds: ["EQ-TONOMETER-04"],
    requiredConsumableIds: ["MED_THIGH_CUFF", "MED_ARTIFICIAL_TEARS", "MED_POTASSIUM_CITRATE"],
    requiredTraining: "Crew First-Responder Orientation / Daily Countermeasure Training",
    allowedRoles: ["CREW_MEDICAL_OFFICER", "CREW_MEMBER"],
    requiresCmo: false,
    relevantRuleIds: [
      "RULE-ARCHER-SLEEP-FATIGUE-05",
      "RULE-FLUID-EYE-SANS-06",
      "RULE-NUTRITION-HYDRATION-07",
    ],
    source: "AEGIS-V Prototype Continuity Reference Pack (NASA HRP ARCheR / SANS / OCHMO Context)",
    version: "v1.1-SIM-PROTOTYPE",
    limitations: [
      "Simulated prototype coordination checklist — does not diagnose SANS, intracranial hypertension, or sleep disorders.",
      "Tonometer operational status is LIMITED without two-person stabilization; note measurement confidence in handoff.",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Verify Countermeasure Adherence & Med Kit Consumables",
        instruction:
          "Check Braslet-M thigh cuff schedule, hydration intake (>=2,500 mL target), and expiry/stock of preservative-free ocular drops.",
        verificationCue: "Confirm Med Kit stock levels and note any near-expiry items.",
      },
      {
        stepNumber: 2,
        title: "Adjust Non-Critical Workload & Log Visual/PVT Check",
        instruction:
          "Coordinate workload deferral with Commander, run a 5-trial cognitive PVT check, and capture a voice observation memo.",
        verificationCue: "Attach PVT score and visual symptom note to the Earth handoff package.",
      },
    ],
    isSimulatedPrototype: true,
  },
  {
    procedureId: "PROC-CMO-CLINICAL-05",
    title: "CMO-Restricted Controlled Medication & Clinical Authorization",
    operationalContext:
      "Controlled medication release (e.g., Modafinil) or formal clinical incident sign-off and closure.",
    category: "CMO_RESTRICTED",
    requiredEquipmentIds: ["EQ-BIOMONITOR-01", "EQ-CAPNOGRAPHY-06"],
    requiredConsumableIds: ["MED_MODAFINIL", "MED_IBUPROFEN"],
    requiredTraining: "Designated Crew Medical Officer (CMO) + PIN Verification",
    allowedRoles: ["CREW_MEDICAL_OFFICER"],
    requiresCmo: true,
    relevantRuleIds: [
      "RULE-HYPOXIA-CO2-MULTI-02",
      "RULE-CARDIO-TREND-01",
      "RULE-ARCHER-SLEEP-FATIGUE-05",
    ],
    source: "AEGIS-V Prototype Restricted Authorization Gate",
    version: "v1.0-SIM-PROTOTYPE",
    limitations: [
      "LOCKED when Crew Medical Officer is unavailable or active operator is non-CMO.",
      "Non-medical replacement operators must never bypass CMO PIN or administer controlled medications without Ground Flight Surgeon authorization.",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Verify CMO Credential & PIN Authorization",
        instruction:
          "Confirm active operator is designated Crew Medical Officer with verified CMO PIN authorization.",
        verificationCue: "Requires CREW_MEDICAL_OFFICER role and CMO availability.",
      },
      {
        stepNumber: 2,
        title: "Evaluate Contraindications & Record Clinical Response",
        instruction:
          "Review full telemetry, controlled stock status, and log authorized clinical intervention in tamper-evident audit chain.",
        verificationCue: "Sealed via SHA-256 audit entry.",
      },
    ],
    isSimulatedPrototype: true,
  },
];

export const DEFAULT_CONTINUITY_STATE: ContinuityPersistedState = {
  continuityActive: false,
  cmoAvailable: true,
  cmoStatusReason: "Designated CMO (Dr. Aris Chen) on normal shift.",
  replacementOperatorCrewId: "AST-01-COMMANDER",
  crewAvailabilityOverrides: {},
  equipmentStatusOverrides: {},
  procedureStepsDone: {},
  accessedProcedureIds: [],
  activeProcedureId: "PROC-ENV-CO2-01",
  procedureCurrentStep: {},
  equipmentConfirmations: {},
  walkthroughStep: 1,
  updatedAtIso: "2026-11-14T12:40:00Z",
};

export const SCENE_7_CONTINUITY_INITIAL_STATE: ContinuityPersistedState = {
  continuityActive: true,
  cmoAvailable: false,
  cmoStatusReason:
    "Simulated Contingency: Designated CMO (Dr. Aris Chen) marked UNAVAILABLE (acute vestibular symptoms / rest isolation).",
  replacementOperatorCrewId: "AST-01-COMMANDER",
  crewAvailabilityOverrides: {
    "AST-02-FE-PILOT": "UNAVAILABLE",
  },
  equipmentStatusOverrides: {},
  procedureStepsDone: {},
  accessedProcedureIds: ["PROC-ENV-CO2-01"],
  activeProcedureId: "PROC-ENV-CO2-01",
  procedureCurrentStep: {},
  equipmentConfirmations: {},
  walkthroughStep: 1,
  updatedAtIso: "2026-11-14T12:40:00Z",
};
