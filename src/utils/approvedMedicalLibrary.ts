import {
  ApprovedGuidanceProtocol,
  GuidanceCategoryMeta,
  RedFlagSignMeta,
} from "../types/medicalGuidanceContracts";

export const GUIDANCE_CATEGORIES: GuidanceCategoryMeta[] = [
  // 1. Injuries (8)
  {
    id: "CUTS_WOUNDS",
    group: "INJURIES",
    label: "Cuts and wounds",
    shortDesc: "Minor skin lacerations, abrasions, or hardware-edge scrapes",
    keywords: ["cut", "wound", "scrape", "abrasion", "laceration", "skin", "gauze", "bandage"],
    defaultRedFlagEligible: false,
  },
  {
    id: "BLEEDING",
    group: "INJURIES",
    label: "Bleeding",
    shortDesc: "Active or heavy bleeding requiring direct pressure and control",
    keywords: ["bleeding", "blood", "hemorrhage", "pressure", "dressing", "gash"],
    defaultRedFlagEligible: true,
  },
  {
    id: "BURNS",
    group: "INJURIES",
    label: "Burns",
    shortDesc: "Thermal, electrical, or chemical contact burns",
    keywords: ["burn", "scald", "heat", "hot", "blister", "thermal", "hydrogel"],
    defaultRedFlagEligible: true,
  },
  {
    id: "BRUISES",
    group: "INJURIES",
    label: "Bruises",
    shortDesc: "Blunt impact contusions from habitat racks or translation bumpers",
    keywords: ["bruise", "contusion", "bump", "impact", "swelling", "cold pack"],
    defaultRedFlagEligible: false,
  },
  {
    id: "SUSPECTED_FRACTURES",
    group: "INJURIES",
    label: "Suspected fractures",
    shortDesc: "Limb deformity, severe bone pain, or inability to bear/translate load",
    keywords: ["fracture", "broken", "bone", "deformity", "splint", "limb", "arm", "leg"],
    defaultRedFlagEligible: true,
  },
  {
    id: "SPRAINS",
    group: "INJURIES",
    label: "Sprains",
    shortDesc: "Joint twist, tendon strain, or microgravity restraint-strap pull",
    keywords: ["sprain", "strain", "joint", "ankle", "wrist", "twist", "wrap"],
    defaultRedFlagEligible: false,
  },
  {
    id: "EYE_INJURIES",
    group: "INJURIES",
    label: "Eye injuries",
    shortDesc: "Floating debris, chemical splash, or impact to eye/eyelid",
    keywords: ["eye", "ocular", "debris", "particle", "vision", "flush", "eyewash", "shield"],
    defaultRedFlagEligible: true,
  },
  {
    id: "HEAD_INJURIES",
    group: "INJURIES",
    label: "Head injuries",
    shortDesc: "Head impact, scalp bump, confusion, or dizziness after impact",
    keywords: ["head", "concussion", "bump", "skull", "impact", "drowsy", "confused"],
    defaultRedFlagEligible: true,
  },
  // 2. Sudden health problems (8)
  {
    id: "BREATHING_DIFFICULTIES",
    group: "SUDDEN_HEALTH",
    label: "Breathing difficulties",
    shortDesc: "Shortness of breath, air hunger, wheezing, or low SpO2",
    keywords: ["breathing", "breath", "shortness", "air", "spo2", "oxygen", "wheeze", "choking"],
    defaultRedFlagEligible: true,
  },
  {
    id: "CHEST_DISCOMFORT",
    group: "SUDDEN_HEALTH",
    label: "Chest discomfort",
    shortDesc: "Chest tightness, pressure, or unexplained upper-torso pain",
    keywords: ["chest", "heart", "pressure", "tightness", "pain", "cardiac"],
    defaultRedFlagEligible: true,
  },
  {
    id: "DIZZINESS_FAINTING",
    group: "SUDDEN_HEALTH",
    label: "Dizziness or fainting",
    shortDesc: "Lightheadedness, spinning sensation, near-fainting, or orthostatic drop",
    keywords: ["dizzy", "dizziness", "faint", "vertigo", "lightheaded", "orthostatic", "balance"],
    defaultRedFlagEligible: true,
  },
  {
    id: "SEVERE_HEADACHE",
    group: "SUDDEN_HEALTH",
    label: "Severe headache",
    shortDesc: "Sudden or worsening headache (check cabin CO2 & neuro red flags)",
    keywords: ["headache", "migraine", "head pain", "co2", "throbbing"],
    defaultRedFlagEligible: true,
  },
  {
    id: "NAUSEA_VOMITING",
    group: "SUDDEN_HEALTH",
    label: "Nausea and vomiting",
    shortDesc: "Stomach upset, persistent vomiting, and microgravity airway/hydration risk",
    keywords: ["nausea", "vomit", "sick", "stomach", "emesis", "hydration"],
    defaultRedFlagEligible: false,
  },
  {
    id: "ABDOMINAL_PAIN",
    group: "SUDDEN_HEALTH",
    label: "Abdominal pain",
    shortDesc: "Sudden or persistent belly pain, cramping, or tenderness",
    keywords: ["abdomen", "abdominal", "stomach", "belly", "cramp", "pain"],
    defaultRedFlagEligible: true,
  },
  {
    id: "ALLERGIC_REACTIONS",
    group: "SUDDEN_HEALTH",
    label: "Allergic reactions",
    shortDesc: "Hives, swelling of face/lips/throat, or sudden breathing tightness",
    keywords: ["allergy", "allergic", "hive", "rash", "swelling", "anaphylaxis", "throat"],
    defaultRedFlagEligible: true,
  },
  {
    id: "FEVER_INFECTION",
    group: "SUDDEN_HEALTH",
    label: "Fever or suspected infection",
    shortDesc: "Elevated temperature, chills, wound redness, or malaise",
    keywords: ["fever", "infection", "temp", "chills", "redness", "warmth", "malaise"],
    defaultRedFlagEligible: false,
  },
  // 3. Spaceflight-specific concerns (6)
  {
    id: "SPACE_MOTION_SICKNESS",
    group: "SPACEFLIGHT",
    label: "Space motion sickness",
    shortDesc: "Vestibular disorientation, nausea, or head-movement sensitivity in microgravity",
    keywords: ["space motion", "vestibular", "motion sickness", "floating", "spin", "nausea"],
    defaultRedFlagEligible: false,
  },
  {
    id: "FLUID_SHIFTS_VISUAL",
    group: "SPACEFLIGHT",
    label: "Fluid shifts and visual symptoms",
    shortDesc: "Cephalad fluid shift, head fullness, blurred near vision, or eye pressure",
    keywords: ["fluid shift", "visual", "vision", "sans", "eye pressure", "iop", "blurred"],
    defaultRedFlagEligible: false,
  },
  {
    id: "DECOMPRESSION_CONCERNS",
    group: "SPACEFLIGHT",
    label: "Decompression-related concerns",
    shortDesc: "Post-EVA joint ache, cabin pressure drop, or neurological signs",
    keywords: ["decompression", "dcs", "bends", "eva", "pressure", "cabin leak", "joint ache"],
    defaultRedFlagEligible: true,
  },
  {
    id: "RADIATION_EXPOSURE",
    group: "SPACEFLIGHT",
    label: "Radiation exposure concerns",
    shortDesc: "Solar particle alert, elevated dosimeter reading, or shelter verification",
    keywords: ["radiation", "solar", "spe", "dosimeter", "msv", "shelter"],
    defaultRedFlagEligible: false,
  },
  {
    id: "TOXIC_ATMOSPHERE",
    group: "SPACEFLIGHT",
    label: "Possible toxic atmosphere exposure",
    shortDesc: "Smoke, CO, ammonia/coolant odor, or elevated cabin CO2",
    keywords: ["toxic", "smoke", "fire", "co2", "co", "ammonia", "fumes", "odor", "contaminant"],
    defaultRedFlagEligible: true,
  },
  {
    id: "HEAT_COLD_EMERGENCIES",
    group: "SPACEFLIGHT",
    label: "Heat or cold-related emergencies",
    shortDesc: "Suit cooling failure, overheating, hyperthermia, or hypothermia",
    keywords: ["heat", "cold", "thermal", "overheat", "hypothermia", "lcg", "sweat", "shiver"],
    defaultRedFlagEligible: true,
  },
];

export const RED_FLAG_SIGNS: RedFlagSignMeta[] = [
  {
    id: "UNCONSCIOUS_UNRESPONSIVE",
    label: "Unconsciousness or unresponsiveness",
    urgentWarningText: "Person is unresponsive or cannot stay awake.",
    defaultProtocolId: "PROTO-URGENT-AIRWAY-UNRESPONSIVE",
  },
  {
    id: "ABNORMAL_ABSENT_BREATHING",
    label: "Abnormal or absent breathing",
    urgentWarningText: "Breathing is absent, gasping, or severely labored.",
    defaultProtocolId: "PROTO-URGENT-BREATHING-TOXIC",
  },
  {
    id: "SEVERE_UNCONTROLLED_BLEEDING",
    label: "Severe or uncontrolled bleeding",
    urgentWarningText: "Active heavy bleeding that does not slow immediately.",
    defaultProtocolId: "PROTO-URGENT-SEVERE-BLEEDING",
  },
  {
    id: "SEVERE_CHEST_PAIN",
    label: "Severe chest pain",
    urgentWarningText: "Chest pain, pressure, or tightness reported.",
    defaultProtocolId: "PROTO-URGENT-CHEST-DISCOMFORT",
  },
  {
    id: "SUDDEN_NEURO_CHANGES",
    label: "Sudden neurological changes (slurred speech, weakness, confusion)",
    urgentWarningText: "Sudden confusion, weakness, vision loss, or speech change.",
    defaultProtocolId: "PROTO-URGENT-HEAD-NEURO",
  },
  {
    id: "SEVERE_ALLERGIC_REACTION",
    label: "Severe allergic reaction (facial/throat swelling or wheezing)",
    urgentWarningText: "Possible severe allergic reaction affecting breathing or swelling.",
    defaultProtocolId: "PROTO-URGENT-ALLERGIC-REACTION",
  },
  {
    id: "SERIOUS_BURNS",
    label: "Serious burns (large area, face/airway, electrical, or chemical)",
    urgentWarningText: "Significant thermal, chemical, or electrical burn reported.",
    defaultProtocolId: "PROTO-URGENT-BURNS",
  },
  {
    id: "SUSPECTED_FRACTURE_MAJOR_TRAUMA",
    label: "Suspected fracture or major trauma",
    urgentWarningText: "Possible bone fracture, visible deformity, or high-force trauma.",
    defaultProtocolId: "PROTO-URGENT-FRACTURE-TRAUMA",
  },
  {
    id: "SEVERE_EYE_INJURY",
    label: "Severe eye injury or chemical/debris in eye",
    urgentWarningText: "Eye trauma, sudden vision change, or foreign substance in eye.",
    defaultProtocolId: "PROTO-URGENT-EYE-INJURY",
  },
  {
    id: "SUDDEN_DETERIORATION",
    label: "Sudden deterioration in condition",
    urgentWarningText: "Condition is rapidly getting worse.",
    defaultProtocolId: "PROTO-URGENT-AIRWAY-UNRESPONSIVE",
  },
];

export const APPROVED_GUIDANCE_PROTOCOLS: ApprovedGuidanceProtocol[] = [
  // 1. Severe Bleeding (Urgent)
  {
    protocolId: "PROTO-URGENT-SEVERE-BLEEDING",
    title: "Severe Bleeding Control & First-Response Stabilization",
    categoryIds: ["BLEEDING"],
    source: "AEGIS-V Approved First-Response Pack (Microgravity Trauma Control Basis)",
    version: "v1.4-OFFLINE-2026",
    isUrgent: true,
    allowedForNonCmo: true,
    requiresCmoForAdvanced: false,
    overviewNotice:
      "Immediate physical bleeding control takes top priority. Do not delay direct pressure to fill out extra forms.",
    steps: [
      {
        stepNumber: 1,
        heading: "STEP 1 — DO THIS NOW",
        whatToDo: "Apply firm, continuous direct pressure directly over the bleeding site.",
        howToDoIt:
          "Put on nitrile gloves if immediately within reach. Place sterile gauze or a clean absorbent pad directly on the wound and press firmly with both hands. In microgravity, contain floating droplets with absorbent towel/gauze around the pad.",
        equipmentIds: ["EQ-TRAUMA-KIT-10"],
        whatNotToDo:
          "Do NOT remove the first blood-soaked gauze pad (lifting breaks forming clots); instead stack fresh gauze on top and press harder.",
        whenToStopAndEscalate:
          "Stop and call immediately if bleeding spurts, pools rapidly, or soaks through stacked dressings within 2–3 minutes.",
      },
      {
        stepNumber: 2,
        heading: "STEP 2 — NEXT ACTION",
        whatToDo: "Secure a tight pressure bandage and position the injured crew member safely.",
        howToDoIt:
          "Wrap a roller pressure bandage snugly over the stacked gauze so continuous pressure holds without your hands slipping. Restrain/seat the injured crew member in a crew restraint station.",
        equipmentIds: ["EQ-TRAUMA-KIT-10"],
        whatNotToDo:
          "Do NOT apply a makeshift wire or thin cord around a limb, and do NOT probe deep into the wound.",
        whenToStopAndEscalate:
          "Escalate immediately if limb distal skin turns cold/blue or bleeding continues unabated under pressure.",
      },
      {
        stepNumber: 3,
        heading: "STEP 3 — CHECK",
        whatToDo: "Check responsiveness, breathing, heart rate, and blood oxygen (SpO2).",
        howToDoIt:
          "Ask the person simple orientation questions (name, module). Place the secondary finger pulse oximeter and check skin warmth/sweating for early shock signs.",
        equipmentIds: ["EQ-OXIMETER-02", "EQ-BIOMONITOR-01"],
        whatNotToDo:
          "Do NOT give food or drink to someone who is drowsy, nauseated, or severely injured.",
        whenToStopAndEscalate:
          "Escalate as critical if responsiveness drops, heart rate climbs rapidly, or SpO2 falls below 94%.",
      },
      {
        stepNumber: 4,
        heading: "STEP 4 — GET HELP",
        whatToDo: "Alert the Crew Medical Officer (or backup crew responder) and queue Earth Flight Surgeon packet.",
        howToDoIt:
          "Ensure the emergency escalation banner has notified the primary responder. If CMO is unavailable, assign a second crew member to manage the checklist and Earth handoff while one person maintains pressure.",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT leave an actively bleeding or unstable crew member alone.",
        whenToStopAndEscalate:
          "Keep human responder engaged continuously; escalate to backup responder automatically if primary does not acknowledge.",
      },
      {
        stepNumber: 5,
        heading: "STEP 5 — CONTINUE MONITORING",
        whatToDo: "Log bleeding status, vitals, pain, and time of every dressing check every 5–10 minutes.",
        howToDoIt:
          "Use Live Condition Tracking in this workspace to record whether bleeding has slowed, stays unchanged, or is worsening, along with latest valid vitals.",
        equipmentIds: ["EQ-BIOMONITOR-01", "EQ-OXIMETER-02"],
        whatNotToDo:
          "Do NOT assume the emergency is resolved just because a single reading stabilizes or an alert is silenced.",
        whenToStopAndEscalate:
          "Raise urgent escalation immediately if any vital worsens or dizziness/confusion appears.",
      },
    ],
    equipmentAlternatives: {
      "EQ-TRAUMA-KIT-10":
        "If Med Bay Drawer M1 trauma pouch is depleted, use clean compressed cabin washcloths or sterile spare dressing packs from EVA Emergency Pouch; verify cleanliness before contact.",
      "EQ-OXIMETER-02":
        "Use CSA Bio-Monitor smart shirt SpO2/HR stream or manually count radial pulse for 30 seconds × 2.",
    },
    supportedResourceIds: ["RES-NASA-MED-CHECKLIST", "RES-CSA-BIOMONITOR"],
    searchKeywords: ["bleeding", "blood", "hemorrhage", "pressure", "gauze", "cut", "severe"],
    isSimulatedPrototype: true,
  },

  // 2. Minor Cuts, Wounds, and Bruises (Non-urgent)
  {
    protocolId: "PROTO-MINOR-WOUND-CARE",
    title: "Minor Cut, Abrasion & Contusion First-Response Care",
    categoryIds: ["CUTS_WOUNDS", "BRUISES"],
    source: "AEGIS-V Approved First-Response Pack (Crew Minor Injury Guide)",
    version: "v1.3-OFFLINE-2026",
    isUrgent: false,
    allowedForNonCmo: true,
    requiresCmoForAdvanced: false,
    overviewNotice:
      "For small, superficial cuts or bruises without heavy bleeding, deep gaping edges, numbness, or metal/chemical contamination.",
    steps: [
      {
        stepNumber: 1,
        heading: "STEP 1 — DO THIS NOW",
        whatToDo: "Control light oozing with gentle clean pressure and inspect the area.",
        howToDoIt:
          "Wash or sanitize hands and don nitrile gloves. Press a sterile gauze pad gently against the minor cut for 2–5 minutes until oozing stops. For a closed bruise without broken skin, rest the area and apply a wrapped cold pack for up to 15 minutes.",
        equipmentIds: ["EQ-TRAUMA-KIT-10", "EQ-SPLINT-BRACE-11"],
        whatNotToDo:
          "Do NOT scrub embedded debris aggressively or apply unapproved habitat solvents/cleaners to open skin.",
        whenToStopAndEscalate:
          "Escalate immediately to Urgent Bleeding if bleeding does not stop after 5 minutes of steady pressure or if the cut is deep/gaping.",
      },
      {
        stepNumber: 2,
        heading: "STEP 2 — NEXT ACTION",
        whatToDo: "Flush gently with sterile saline (for open skin) and apply a clean dressing.",
        howToDoIt:
          "Use sterile saline flush from the trauma pack over an absorbent towel to capture microgravity droplets. Pat dry with sterile gauze and cover with a clean adhesive bandage or non-stick pad + medical tape.",
        equipmentIds: ["EQ-TRAUMA-KIT-10"],
        whatNotToDo:
          "Do NOT seal dirt inside the wound, and do NOT take or give unapproved prescription medications.",
        whenToStopAndEscalate:
          "Seek CMO or Flight Surgeon review if wound edges gape, appear contaminated, or involve a joint/tendon.",
      },
      {
        stepNumber: 3,
        heading: "STEP 3 — CHECK",
        whatToDo: "Check sensation, movement beyond the injury, and baseline comfort.",
        howToDoIt:
          "Confirm normal feeling and finger/toe movement past the cut or bruise. Note whether tetanus/hardware metal contamination occurred.",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT ignore tingling, numbness, or inability to move a joint near the wound.",
        whenToStopAndEscalate:
          "Escalate if numbness, severe swelling, or restricted motion is present.",
      },
      {
        stepNumber: 4,
        heading: "STEP 4 — GET HELP",
        whatToDo: "Log the injury for Crew Medical Officer / Flight Surgeon awareness.",
        howToDoIt:
          "Record what hardware or activity caused the cut/bruise and save the incident summary. If CMO is unavailable, queue the report for next CMO shift or Earth review.",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT skip documentation even for minor spaceflight wounds (microgravity wound healing is monitored closely).",
        whenToStopAndEscalate:
          "Contact medical authority if you are unsure whether closure strips or sutures are needed.",
      },
      {
        stepNumber: 5,
        heading: "STEP 5 — CONTINUE MONITORING",
        whatToDo: "Watch over the next 24–48 hours for redness, warmth, pus, fever, or increasing pain.",
        howToDoIt:
          "Inspect the dressing at shift change and log skin temperature/symptom status in Condition Tracking.",
        equipmentIds: ["EQ-TRAUMA-KIT-10"],
        whatNotToDo:
          "Do NOT leave a damp or soiled dressing on the skin.",
        whenToStopAndEscalate:
          "Escalate promptly if spreading redness, throbbing pain, drainage, or fever develops.",
      },
    ],
    equipmentAlternatives: {
      "EQ-TRAUMA-KIT-10":
        "Potable drinking water bag + clean sterile gauze square may be used for gentle rinse if sterile saline pouch is depleted; document alternative used.",
      "EQ-SPLINT-BRACE-11":
        "Use a chilled potable water pouch wrapped in a clean dry cloth if instant cold pack is unavailable (never place bare freezing pack on skin).",
    },
    supportedResourceIds: ["RES-NASA-MED-CHECKLIST"],
    searchKeywords: ["cut", "minor cut", "scrape", "abrasion", "bruise", "contusion", "wound"],
    isSimulatedPrototype: true,
  },

  // 3. Unconscious / Unresponsive / Sudden Collapse (Urgent)
  {
    protocolId: "PROTO-URGENT-AIRWAY-UNRESPONSIVE",
    title: "Unresponsive Crew Member & Airway/Breathing Urgent Check",
    categoryIds: ["DIZZINESS_FAINTING"],
    source: "AEGIS-V Approved First-Response Pack (Emergency Basic Life Support Basis)",
    version: "v1.4-OFFLINE-2026",
    isUrgent: true,
    allowedForNonCmo: true,
    requiresCmoForAdvanced: false,
    overviewNotice:
      "CRITICAL EMERGENCY: Check scene safety (smoke, electrical hazard, toxic air) before approaching.",
    steps: [
      {
        stepNumber: 1,
        heading: "STEP 1 — DO THIS NOW",
        whatToDo: "Verify cabin safety, tap & shout to check responsiveness, and inspect breathing.",
        howToDoIt:
          "Scan for smoke, sparks, or pressure alarm first. Tap shoulders firmly and shout the crew member's name. Look at chest/abdomen rise and listen for normal breathing for no more than 10 seconds.",
        equipmentIds: ["EQ-O2-PBA-07"],
        whatNotToDo:
          "Do NOT enter an unverified toxic/smoke compartment without a Portable Breathing Apparatus (PBA).",
        whenToStopAndEscalate:
          "If unresponsive and NOT breathing normally (or only gasping), immediately retrieve AED and summon all available crew.",
      },
      {
        stepNumber: 2,
        heading: "STEP 2 — NEXT ACTION",
        whatToDo: "Restrain the crew member for airway safety and deploy AED if breathing is absent.",
        howToDoIt:
          "If breathing normally while unresponsive, gently tilt chin to keep airway open and restrain in side-recovery posture. If NOT breathing normally, secure crew member to flat restraint surface, power on AED, and follow AED voice prompts.",
        equipmentIds: ["EQ-AED-DEFIB-14", "EQ-TRAUMA-KIT-10"],
        whatNotToDo:
          "Do NOT place pillows under the head or put anything in an unresponsive person's mouth.",
        whenToStopAndEscalate:
          "Continue AED prompts and basic chest compressions with microgravity crew restraint until responder/CMO takes over or normal breathing returns.",
      },
      {
        stepNumber: 3,
        heading: "STEP 3 — CHECK",
        whatToDo: "Check cabin CO2, oxygen (ppO2), smoke/toxic alarms, and wearable vitals.",
        howToDoIt:
          "Inspect Life-Safety Sentinel cabin metrics (CO2, ppO2, CO, pressure) and apply secondary finger pulse oximeter once airway/breathing is verified.",
        equipmentIds: ["EQ-OXIMETER-02", "EQ-CDRA-TEST-03"],
        whatNotToDo:
          "Do NOT delay airway or AED action to search software menus.",
        whenToStopAndEscalate:
          "If cabin CO2/smoke/pressure is abnormal, don PBA emergency oxygen and relocate crew to safe module.",
      },
      {
        stepNumber: 4,
        heading: "STEP 4 — GET HELP",
        whatToDo: "Broadcast all-crew emergency call and notify Flight Surgeon / CMO immediately.",
        howToDoIt:
          "Trigger escalation to both primary and backup crew responders and prepare priority Earth Flight Surgeon downlink.",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT leave an unresponsive crew member unattended.",
        whenToStopAndEscalate:
          "Maintain continuous urgent priority status regardless of temporary awakening.",
      },
      {
        stepNumber: 5,
        heading: "STEP 5 — CONTINUE MONITORING",
        whatToDo: "Track breathing, responsiveness, SpO2, heart rate, and time of every change.",
        howToDoIt:
          "Log continuous observations every 2–5 minutes in Condition Tracking and preserve full timeline for Flight Surgeon review.",
        equipmentIds: ["EQ-BIOMONITOR-01", "EQ-OXIMETER-02"],
        whatNotToDo:
          "Do NOT close the emergency even if the person wakes up — delayed neurological/cardiac evaluation is required.",
        whenToStopAndEscalate:
          "Re-activate AED/BLS immediately if responsiveness or breathing deteriorates again.",
      },
    ],
    equipmentAlternatives: {
      "EQ-AED-DEFIB-14":
        "If AED is unreachable within 60 seconds, begin/continue chest compressions anchored against bulkhead or crew restraint belt while second crew retrieves AED.",
      "EQ-O2-PBA-07":
        "Translate injured crew member immediately to an adjacent ventilated module if PBA is not immediately at hand.",
    },
    supportedResourceIds: ["RES-NASA-MED-CHECKLIST", "RES-ISS-CO2-HYPOXIA"],
    searchKeywords: ["unconscious", "unresponsive", "faint", "collapse", "airway", "cpr", "aed"],
    isSimulatedPrototype: true,
  },

  // 4. Breathing Difficulties & Possible Toxic Atmosphere (Urgent)
  {
    protocolId: "PROTO-URGENT-BREATHING-TOXIC",
    title: "Breathing Difficulty & Cabin Atmosphere First-Response",
    categoryIds: ["BREATHING_DIFFICULTIES", "TOXIC_ATMOSPHERE"],
    source: "AEGIS-V Approved First-Response Pack (ISS ECLSS & Respiratory Context)",
    version: "v1.4-OFFLINE-2026",
    isUrgent: true,
    allowedForNonCmo: true,
    requiresCmoForAdvanced: false,
    overviewNotice:
      "In spaceflight, breathing difficulty may involve personal illness OR cabin air/CO2/toxic contaminant hazard. Protect crew airway first.",
    steps: [
      {
        stepNumber: 1,
        heading: "STEP 1 — DO THIS NOW",
        whatToDo: "Stop exertion, check for smoke/chemical odor/alarms, and supply clean breathing air if contaminated.",
        howToDoIt:
          "Pause activity immediately. Check smoke/fire/CO/CO2 indicators. If ANY smoke, unusual chemical odor, or elevated CO/CO2 is suspected, don Portable Breathing Apparatus (PBA) or move crew to a clean isolated module.",
        equipmentIds: ["EQ-O2-PBA-07", "EQ-CDRA-TEST-03"],
        whatNotToDo:
          "Do NOT stay inside a smoky or suspect module to finish equipment checks without breathing protection.",
        whenToStopAndEscalate:
          "Escalate immediately if crew cannot speak full sentences, lips look bluish, or cabin toxic/smoke alarm is active.",
      },
      {
        stepNumber: 2,
        heading: "STEP 2 — NEXT ACTION",
        whatToDo: "Position crew member in comfortable upright/seated posture and verify airflow.",
        howToDoIt:
          "Restrain in an upright seated rest position near an unobstructed ventilation outlet (if cabin air is verified clean). Loosen tight harness/collar straps.",
        equipmentIds: ["EQ-CDRA-TEST-03"],
        whatNotToDo:
          "Do NOT force the person to lie flat if upright positioning eases breathing, and do NOT give unprescribed inhalers/medications.",
        whenToStopAndEscalate:
          "Escalate immediately if breathing effort increases or chest pain/wheezing develops.",
      },
      {
        stepNumber: 3,
        heading: "STEP 3 — CHECK",
        whatToDo: "Cross-check SpO2, respiration rate, heart rate, and cabin CO2/ppO2.",
        howToDoIt:
          "Use the secondary finger pulse oximeter for 60 seconds and compare with Bio-Monitor readings and Life-Safety Sentinel cabin gas values.",
        equipmentIds: ["EQ-OXIMETER-02", "EQ-BIOMONITOR-01"],
        whatNotToDo:
          "Do NOT clear a breathing complaint based solely on a single stale or noisy sensor reading.",
        whenToStopAndEscalate:
          "Escalate urgently if SpO2 < 94%, respiration rate > 24 rpm, or CO2 > 4.5 mmHg.",
      },
      {
        stepNumber: 4,
        heading: "STEP 4 — GET HELP",
        whatToDo: "Notify CMO / Flight Director / Flight Surgeon with measured SpO2 and cabin air readings.",
        howToDoIt:
          "Ensure emergency escalation is active and include whether cabin atmosphere indicators were normal or degraded.",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT delay human notification while waiting for Earth comms to return.",
        whenToStopAndEscalate:
          "Maintain backup responder watch if primary responder has not acknowledged.",
      },
      {
        stepNumber: 5,
        heading: "STEP 5 — CONTINUE MONITORING",
        whatToDo: "Re-check breathing effort, SpO2, and consciousness every 5 minutes.",
        howToDoIt:
          "Log every reading and symptom note in Condition Tracking. Keep PBA nearby until air quality and breathing stability are confirmed by human authority.",
        equipmentIds: ["EQ-OXIMETER-02", "EQ-O2-PBA-07"],
        whatNotToDo:
          "Do NOT resume physical exercise or EVA prep without formal medical clearance.",
        whenToStopAndEscalate:
          "Move directly to Unresponsive/AED protocol if consciousness or breathing fails.",
      },
    ],
    equipmentAlternatives: {
      "EQ-O2-PBA-07":
        "Move immediately to an isolated clean module with verified nominal ventilation if PBA bottle pressure is low.",
      "EQ-OXIMETER-02":
        "Count visible chest breaths over 30 seconds × 2 and check Bio-Monitor wearable SpO2.",
    },
    supportedResourceIds: ["RES-ISS-CO2-HYPOXIA", "RES-NASA-MED-CHECKLIST"],
    searchKeywords: ["breathing", "shortness of breath", "spo2", "toxic", "smoke", "fumes", "co2"],
    isSimulatedPrototype: true,
  },

  // 5. Chest Discomfort (Urgent)
  {
    protocolId: "PROTO-URGENT-CHEST-DISCOMFORT",
    title: "Chest Discomfort & Cardiac Safety First-Response",
    categoryIds: ["CHEST_DISCOMFORT"],
    source: "AEGIS-V Approved First-Response Pack (Acute Chest Symptom Safety Guide)",
    version: "v1.3-OFFLINE-2026",
    isUrgent: true,
    allowedForNonCmo: true,
    requiresCmoForAdvanced: false,
    overviewNotice:
      "Chest pain, tightness, or pressure requires immediate rest, monitoring, and human medical escalation. Never attempt to self-diagnose cause.",
    steps: [
      {
        stepNumber: 1,
        heading: "STEP 1 — DO THIS NOW",
        whatToDo: "Stop all physical effort immediately and place the crew member at calm seated rest.",
        howToDoIt:
          "Halt ARED/work immediately, secure the person in a supported seated restraint, and bring the AED and Bio-Monitor within arm's reach.",
        equipmentIds: ["EQ-AED-DEFIB-14", "EQ-BIOMONITOR-01"],
        whatNotToDo:
          "Do NOT allow the crew member to walk/translate unassisted or continue physical tasks to 'test' the pain.",
        whenToStopAndEscalate:
          "Escalate immediately if discomfort spreads to arm/jaw/back, causes sweating/nausea, or impairs breathing.",
      },
      {
        stepNumber: 2,
        heading: "STEP 2 — NEXT ACTION",
        whatToDo: "Check airway/breathing comfort and loosen restrictive straps or clothing.",
        howToDoIt:
          "Unclip EVA/exercise harnesses and ensure calm, unobstructed cabin ventilation.",
        equipmentIds: ["EQ-OXIMETER-02"],
        whatNotToDo:
          "Do NOT administer prescription cardiac drugs, aspirin, or controlled medications unless explicitly authorized by CMO/Flight Surgeon.",
        whenToStopAndEscalate:
          "Any fainting, severe shortness of breath, or collapse triggers immediate AED/Unresponsive protocol.",
      },
      {
        stepNumber: 3,
        heading: "STEP 3 — CHECK",
        whatToDo: "Measure heart rate, blood pressure, SpO2, and capture an ECG trace if Bio-Monitor is available.",
        howToDoIt:
          "Record current Bio-Monitor vitals and finger pulse oximeter SpO2. Ask when discomfort started and pain level (0–10).",
        equipmentIds: ["EQ-BIOMONITOR-01", "EQ-OXIMETER-02"],
        whatNotToDo:
          "Do NOT reassure or dismiss chest discomfort based solely on a single normal heart rate value.",
        whenToStopAndEscalate:
          "Escalate urgently for any blood pressure drop, abnormal heart rate, or SpO2 < 94%.",
      },
      {
        stepNumber: 4,
        heading: "STEP 4 — GET HELP",
        whatToDo: "Notify CMO immediately and prepare high-priority Earth Flight Surgeon consultation packet.",
        howToDoIt:
          "Trigger immediate responder notification and ensure a crew companion remains beside the person continuously.",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT leave the person unattended while waiting for a response.",
        whenToStopAndEscalate:
          "If CMO is unavailable, alert Commander/backup first responder and queue urgent Earth handoff.",
      },
      {
        stepNumber: 5,
        heading: "STEP 5 — CONTINUE MONITORING",
        whatToDo: "Re-assess pain score (0–10), alertness, and vitals every 5 minutes.",
        howToDoIt:
          "Log every update in Condition Tracking so Earth Flight Surgeon has a complete timeline of onset, vitals, and changes.",
        equipmentIds: ["EQ-BIOMONITOR-01", "EQ-AED-DEFIB-14"],
        whatNotToDo:
          "Do NOT auto-close if discomfort eases temporarily.",
        whenToStopAndEscalate:
          "Escalate immediately if pain returns, rises, or dizziness begins.",
      },
    ],
    equipmentAlternatives: {
      "EQ-BIOMONITOR-01":
        "Use finger pulse oximeter for heart rate + SpO2 and manual cuff/observer check if wearable shirt is not worn.",
    },
    supportedResourceIds: ["RES-CSA-BIOMONITOR", "RES-NASA-MED-CHECKLIST"],
    searchKeywords: ["chest", "chest pain", "tightness", "pressure", "heart", "angina"],
    isSimulatedPrototype: true,
  },

  // 6. Burns (Urgent)
  {
    protocolId: "PROTO-URGENT-BURNS",
    title: "Thermal, Electrical & Chemical Burn First-Response",
    categoryIds: ["BURNS"],
    source: "AEGIS-V Approved First-Response Pack (Onboard Burn Stabilization Guide)",
    version: "v1.3-OFFLINE-2026",
    isUrgent: true,
    allowedForNonCmo: true,
    requiresCmoForAdvanced: false,
    overviewNotice:
      "Electrical burns require power isolation first; chemical burns require immediate cautious flushing/containment in microgravity.",
    steps: [
      {
        stepNumber: 1,
        heading: "STEP 1 — DO THIS NOW",
        whatToDo: "Stop the burning source safely and cool the burn without ice.",
        howToDoIt:
          "Verify power is isolated before touching an electrical burn victim. Gently cool thermal burn area with cool (not freezing) potable water-moistened clean gauze or hydrogel burn sheet for 10–20 minutes, containing runoff with absorbent towels.",
        equipmentIds: ["EQ-BURN-DRESSING-13", "EQ-TRAUMA-KIT-10"],
        whatNotToDo:
          "Do NOT apply ice, butter, toothpaste, habitat grease, or break blisters, and do NOT peel off stuck fabric/gear.",
        whenToStopAndEscalate:
          "Escalate urgently if burn covers face/neck/hands/groin, is deeper/charred, involves airway smoke, or exceeds palm-size area.",
      },
      {
        stepNumber: 2,
        heading: "STEP 2 — NEXT ACTION",
        whatToDo: "Cover cleanly with sterile hydrogel burn sheet or dry non-adherent dressing.",
        howToDoIt:
          "Remove rings/watches/tight straps near the area before swelling develops. Lay sterile hydrogel dressing or non-stick gauze loosely over the burn and secure lightly.",
        equipmentIds: ["EQ-BURN-DRESSING-13", "EQ-TRAUMA-KIT-10"],
        whatNotToDo:
          "Do NOT wrap adhesive tape tightly around a limb or directly onto burned skin.",
        whenToStopAndEscalate:
          "Escalate immediately if swelling tightens around fingers or breathing becomes hoarse.",
      },
      {
        stepNumber: 3,
        heading: "STEP 3 — CHECK",
        whatToDo: "Check breathing/airway (for smoke inhalation), pain level, and circulation.",
        howToDoIt:
          "Check nose/mouth for soot, check voice clarity, measure SpO2 and heart rate, and ask pain score (0–10).",
        equipmentIds: ["EQ-OXIMETER-02"],
        whatNotToDo:
          "Do NOT overlook airway/smoke exposure when a thermal or electrical incident occurred.",
        whenToStopAndEscalate:
          "Escalate immediately if voice is hoarse, coughing soot, or SpO2 drops.",
      },
      {
        stepNumber: 4,
        heading: "STEP 4 — GET HELP",
        whatToDo: "Notify CMO and Earth Flight Surgeon with burn size/location estimate and cause.",
        howToDoIt:
          "Document whether burn was thermal, electrical, or chemical and request human medical review for pain/infection guidance.",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT administer controlled pain medication without CMO/Flight Surgeon authorization.",
        whenToStopAndEscalate:
          "Keep urgent escalation open until Flight Surgeon / CMO confirms plan.",
      },
      {
        stepNumber: 5,
        heading: "STEP 5 — CONTINUE MONITORING",
        whatToDo: "Monitor pain, swelling, shivering/temperature, and dressing integrity.",
        howToDoIt:
          "Keep the crew member warm (cooling only the burn, not the whole body) and log updates every 15 minutes in Condition Tracking.",
        equipmentIds: ["EQ-BURN-DRESSING-13"],
        whatNotToDo:
          "Do NOT leave a burn uncovered in cabin airflow.",
        whenToStopAndEscalate:
          "Escalate immediately if shivering, fever, numbness, or increasing pain develops.",
      },
    ],
    equipmentAlternatives: {
      "EQ-BURN-DRESSING-13":
        "Hydrogel stock is LIMITED (2 sheets). If depleted, cover cleanly with sterile non-stick gauze moistened lightly with sterile saline or clean dry non-stick pad from Med Bay Drawer M1.",
    },
    supportedResourceIds: ["RES-NASA-MED-CHECKLIST"],
    searchKeywords: ["burn", "burns", "scald", "thermal", "hydrogel", "blister", "chemical burn"],
    isSimulatedPrototype: true,
  },

  // 7. Eye Injuries & Ocular Debris (Urgent)
  {
    protocolId: "PROTO-URGENT-EYE-INJURY",
    title: "Eye Injury, Floating Debris & Chemical Splash First-Response",
    categoryIds: ["EYE_INJURIES"],
    source: "AEGIS-V Approved First-Response Pack (Microgravity Ocular Emergency Guide)",
    version: "v1.3-OFFLINE-2026",
    isUrgent: true,
    allowedForNonCmo: true,
    requiresCmoForAdvanced: false,
    overviewNotice:
      "Floating particles and droplets behave differently in microgravity. Never rub an injured eye or press on the eyeball.",
    steps: [
      {
        stepNumber: 1,
        heading: "STEP 1 — DO THIS NOW",
        whatToDo: "Stop rubbing the eye immediately and distinguish chemical/loose dust vs. sharp/penetrating trauma.",
        howToDoIt:
          "Restrain hands away from the face. If chemical splash or fine dust entered the eye (and NO penetrating object is sticking out), begin gentle sterile eyewash irrigation using the zero-gravity eye-flush cup.",
        equipmentIds: ["EQ-EYE-WASH-12"],
        whatNotToDo:
          "Do NOT rub the eye, do NOT use tweezers to pull out an embedded object, and do NOT flush if the eyeball looks cut/penetrated.",
        whenToStopAndEscalate:
          "Escalate immediately for vision loss, penetrating injury, severe pain, blood inside the eye, or chemical exposure.",
      },
      {
        stepNumber: 2,
        heading: "STEP 2 — NEXT ACTION",
        whatToDo: "Shield the eye safely after flushing (or immediately without flushing if impact/cut trauma).",
        howToDoIt:
          "Place the rigid Fox eye shield gently over the orbital bone (resting on forehead and cheek, NOT pressing on the eyelid) and tape edges securely.",
        equipmentIds: ["EQ-EYE-WASH-12", "EQ-TRAUMA-KIT-10"],
        whatNotToDo:
          "Do NOT pack soft cotton or apply tight pressure bandages directly onto an injured eye.",
        whenToStopAndEscalate:
          "Escalate urgently if double vision, severe light sensitivity, or worsening pain persists after gentle flush.",
      },
      {
        stepNumber: 3,
        heading: "STEP 3 — CHECK",
        whatToDo: "Check basic visual clarity (finger counting/text reading) in the uninjured and affected eye gently.",
        howToDoIt:
          "Without removing a protective shield placed for trauma, note pupil symmetry (if safely visible prior to shielding) and ask if vision is blurry, darkened, or painful.",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT force eyelids open if significant impact swelling or suspected rupture exists.",
        whenToStopAndEscalate:
          "Escalate immediately if any vision reduction or sudden flashes/floaters are reported.",
      },
      {
        stepNumber: 4,
        heading: "STEP 4 — GET HELP",
        whatToDo: "Contact CMO and Earth Flight Surgeon; document exact substance or debris material.",
        howToDoIt:
          "Record what task was underway (e.g., rack maintenance, chemical handling) and attach eye shield status in the Earth handoff.",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT insert medicated eye drops unless explicitly authorized for that specific condition.",
        whenToStopAndEscalate:
          "Await human medical clearance before removing rigid eye shield after trauma.",
      },
      {
        stepNumber: 5,
        heading: "STEP 5 — CONTINUE MONITORING",
        whatToDo: "Monitor pain, redness, tearing, and visual changes every 15 minutes.",
        howToDoIt:
          "Log updates in Condition Tracking and keep crew member seated calmly to avoid translation bumps.",
        equipmentIds: ["EQ-EYE-WASH-12"],
        whatNotToDo:
          "Do NOT resume EVA or fine visual operations with an acute eye injury.",
        whenToStopAndEscalate:
          "Escalate immediately if pain spikes or new vision changes appear.",
      },
    ],
    equipmentAlternatives: {
      "EQ-EYE-WASH-12":
        "If ocular irrigation tray is unreachable, use sterile isotonic saline ampoules from Med Bay Drawer M1; if rigid Fox shield is unavailable, tape a clean rigid cup rim gently over the orbital bone as a non-contact shield.",
    },
    supportedResourceIds: ["RES-NASA-SANS-2024", "RES-NASA-MED-CHECKLIST"],
    searchKeywords: ["eye", "eye injury", "debris", "particle", "eyewash", "shield", "splash"],
    isSimulatedPrototype: true,
  },

  // 8. Fractures & Sprains (Urgent / Priority)
  {
    protocolId: "PROTO-URGENT-FRACTURE-TRAUMA",
    title: "Suspected Fracture, Joint Sprain & Limb Immobilization Guide",
    categoryIds: ["SUSPECTED_FRACTURES", "SPRAINS"],
    source: "AEGIS-V Approved First-Response Pack (Orthopedic Stabilization Guide)",
    version: "v1.3-OFFLINE-2026",
    isUrgent: true,
    allowedForNonCmo: true,
    requiresCmoForAdvanced: false,
    overviewNotice:
      "Treat visible deformity, severe focal bone pain, inability to move a limb, or grinding sensation as a suspected fracture until evaluated by medical authority.",
    steps: [
      {
        stepNumber: 1,
        heading: "STEP 1 — DO THIS NOW",
        whatToDo: "Immobilize the injured limb in the position found and check for bleeding.",
        howToDoIt:
          "Keep the crew member still and restrained. Support the limb gently above and below the injury with hands or padded cushions. If bone pierces skin or bleeding is present, cover lightly with sterile gauze.",
        equipmentIds: ["EQ-SPLINT-BRACE-11", "EQ-TRAUMA-KIT-10"],
        whatNotToDo:
          "Do NOT try to straighten, push back, or realign a deformed bone or joint.",
        whenToStopAndEscalate:
          "Escalate immediately for open fracture (bone visible), pale/cold/numb fingers or toes, or spine/neck/hip involvement.",
      },
      {
        stepNumber: 2,
        heading: "STEP 2 — NEXT ACTION",
        whatToDo: "Apply a padded moldable splint or sling and wrapped cold compress.",
        howToDoIt:
          "Shape the moldable splint outside the limb (bridging the joints above and below a suspected bone break) and secure snugly with elastic wrap. Apply a cloth-wrapped cold pack for 15 minutes to reduce swelling.",
        equipmentIds: ["EQ-SPLINT-BRACE-11"],
        whatNotToDo:
          "Do NOT wrap elastic bandages tightly enough to cut off pulse or cause tingling.",
        whenToStopAndEscalate:
          "Loosen wrap immediately and escalate if fingers/toes tingle, swell rapidly, or change color.",
      },
      {
        stepNumber: 3,
        heading: "STEP 3 — CHECK",
        whatToDo: "Check circulation, sensation, and movement (CSM) beyond the splint.",
        howToDoIt:
          "Verify warm skin, normal capillary refill (<2 sec press on nailbed), and sensation in fingers/toes beyond the splint. Record pain score (0–10).",
        equipmentIds: ["EQ-OXIMETER-02"],
        whatNotToDo:
          "Do NOT remove the splint to test whether the bone still hurts.",
        whenToStopAndEscalate:
          "Escalate urgently if capillary refill slows, numbness appears, or pulse cannot be felt.",
      },
      {
        stepNumber: 4,
        heading: "STEP 4 — GET HELP",
        whatToDo: "Alert CMO and Earth Flight Surgeon for imaging/orthopedic review.",
        howToDoIt:
          "Document mechanism of injury (e.g., ARED load, hatch impact), splint placement, and CSM check results in the incident report.",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT dispense prescription analgesics without CMO/Flight Surgeon authorization.",
        whenToStopAndEscalate:
          "Request Flight Surgeon guidance before any movement/transfer if neck, back, or pelvis is involved.",
      },
      {
        stepNumber: 5,
        heading: "STEP 5 — CONTINUE MONITORING",
        whatToDo: "Re-check circulation/sensation beyond the splint and pain score every 15 minutes.",
        howToDoIt:
          "Log CSM results and swelling changes in Condition Tracking.",
        equipmentIds: ["EQ-SPLINT-BRACE-11"],
        whatNotToDo:
          "Do NOT allow weight-bearing or ARED/EVA exertion on an injured joint/limb.",
        whenToStopAndEscalate:
          "Escalate immediately if numbness, coldness, or severe pain develops.",
      },
    ],
    equipmentAlternatives: {
      "EQ-SPLINT-BRACE-11":
        "If moldable splint is unavailable, immobilize limb using rolled foam padding/towels + triangular sling or buddy-tape an injured finger/toe with gauze padding between digits.",
    },
    supportedResourceIds: ["RES-NASA-MED-CHECKLIST"],
    searchKeywords: ["fracture", "broken bone", "sprain", "strain", "splint", "joint", "sling"],
    isSimulatedPrototype: true,
  },

  // 9. Head Injury & Neurological Red Flags (Urgent)
  {
    protocolId: "PROTO-URGENT-HEAD-NEURO",
    title: "Head Injury, Severe Headache & Neurological Red-Flag Response",
    categoryIds: ["HEAD_INJURIES", "SEVERE_HEADACHE"],
    source: "AEGIS-V Approved First-Response Pack (Neurological & CO2 Safety Check)",
    version: "v1.3-OFFLINE-2026",
    isUrgent: true,
    allowedForNonCmo: true,
    requiresCmoForAdvanced: false,
    overviewNotice:
      "In a spacecraft, severe headache or sudden confusion may involve head trauma, stroke/neurological event, OR elevated cabin CO2. Screen both crew and cabin air.",
    steps: [
      {
        stepNumber: 1,
        heading: "STEP 1 — DO THIS NOW",
        whatToDo: "Keep the person still at seated/supported rest and check responsiveness + neck comfort.",
        howToDoIt:
          "Stop translation/work immediately. Ask name, location, and what happened. If a forceful head/neck impact occurred, keep head and neck aligned and still. Inspect for scalp bleeding.",
        equipmentIds: ["EQ-TRAUMA-KIT-10"],
        whatNotToDo:
          "Do NOT shake the person, allow strenuous motion, or give sedating medications.",
        whenToStopAndEscalate:
          "Escalate immediately for any loss of consciousness, slurred speech, facial droop, one-sided weakness, seizure, repeated vomiting, or severe sudden 'worst' headache.",
      },
      {
        stepNumber: 2,
        heading: "STEP 2 — NEXT ACTION",
        whatToDo: "Verify cabin CO2 / ventilation and hydrate gently ONLY if fully alert and not vomiting.",
        howToDoIt:
          "Check Life-Safety Sentinel cabin CO2 (target < 3.0 mmHg) and CDRA airflow. Offer small sips of water only if alert with normal swallowing.",
        equipmentIds: ["EQ-CDRA-TEST-03"],
        whatNotToDo:
          "Do NOT give fluids if drowsy, nauseated, or confused, and do NOT give pain relievers before medical screening if trauma/neuro changes exist.",
        whenToStopAndEscalate:
          "Relocate to well-ventilated module and escalate if CO2 > 4.5 mmHg or symptoms do not ease.",
      },
      {
        stepNumber: 3,
        heading: "STEP 3 — CHECK",
        whatToDo: "Perform rapid orientation check, balance/speech check, and record vitals.",
        howToDoIt:
          "Check equal smile, equal arm lift, clear speech, pupil reaction if trained, and record Bio-Monitor HR, BP, and SpO2.",
        equipmentIds: ["EQ-BIOMONITOR-01", "EQ-OXIMETER-02"],
        whatNotToDo:
          "Do NOT assume a normal pulse oximeter rules out head trauma or neurological change.",
        whenToStopAndEscalate:
          "Any asymmetry in speech, smile, grip, or worsening drowsiness requires urgent escalation.",
      },
      {
        stepNumber: 4,
        heading: "STEP 4 — GET HELP",
        whatToDo: "Notify CMO and Flight Surgeon immediately; assign a crew buddy to stay present.",
        howToDoIt:
          "Record exact time of symptom onset or head impact (critical for Flight Surgeon decisions) and keep the emergency record open.",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT leave a crew member with head trauma or neurological changes alone to 'sleep it off'.",
        whenToStopAndEscalate:
          "Maintain continuous human observation.",
      },
      {
        stepNumber: 5,
        heading: "STEP 5 — CONTINUE MONITORING",
        whatToDo: "Re-check responsiveness, speech, pain (0–10), and vitals every 10–15 minutes.",
        howToDoIt:
          "Log every check in Condition Tracking and watch closely for delayed vomiting or worsening confusion.",
        equipmentIds: ["EQ-BIOMONITOR-01"],
        whatNotToDo:
          "Do NOT close incident until cleared by CMO or Flight Surgeon.",
        whenToStopAndEscalate:
          "Trigger immediate urgent life-support escalation if responsiveness drops.",
      },
    ],
    equipmentAlternatives: {
      "EQ-CDRA-TEST-03":
        "Use dashboard cabin CO2 sensor readout and physically feel personal vent grille airflow if handheld airflow wand is unavailable.",
    },
    supportedResourceIds: ["RES-ISS-CO2-HYPOXIA", "RES-NASA-MED-CHECKLIST"],
    searchKeywords: ["head", "head injury", "headache", "concussion", "neurological", "confusion", "speech"],
    isSimulatedPrototype: true,
  },

  // 10. Allergic Reactions (Urgent)
  {
    protocolId: "PROTO-URGENT-ALLERGIC-REACTION",
    title: "Allergic Reaction & Airway Swelling First-Response",
    categoryIds: ["ALLERGIC_REACTIONS"],
    source: "AEGIS-V Approved First-Response Pack (Acute Allergic Reaction Guide)",
    version: "v1.2-OFFLINE-2026",
    isUrgent: true,
    allowedForNonCmo: true,
    requiresCmoForAdvanced: true,
    cmoRestrictedNote:
      "Medication administration (including epinephrine or antihistamines) requires CMO/Flight Surgeon authorization or pre-authorized emergency medical kit protocol.",
    overviewNotice:
      "Watch carefully for lip, tongue, or throat swelling, hoarse voice, wheezing, or dizziness — these are emergency warning signs.",
    steps: [
      {
        stepNumber: 1,
        heading: "STEP 1 — DO THIS NOW",
        whatToDo: "Remove suspected trigger exposure and assess airway, voice, and breathing immediately.",
        howToDoIt:
          "Stop contact with suspected food, wipe/chemical, or payload material. Ask the crew member to speak and check for throat tightness, wheezing, or lip/tongue swelling.",
        equipmentIds: ["EQ-OXIMETER-02"],
        whatNotToDo:
          "Do NOT wait to see if throat tightness or wheezing improves on its own, and do NOT invent medication dosages.",
        whenToStopAndEscalate:
          "Escalate immediately as critical emergency if voice changes, swallowing difficulty, wheezing, or dizziness occurs.",
      },
      {
        stepNumber: 2,
        heading: "STEP 2 — NEXT ACTION",
        whatToDo: "Position comfortably (upright if breathing difficulty; flat/elevated legs if dizzy) and summon CMO.",
        howToDoIt:
          "Restrain in a safe posture, loosen tight clothing, and bring the Emergency Medical Kit / AED within reach while alerting CMO or Flight Surgeon.",
        equipmentIds: ["EQ-AED-DEFIB-14", "EQ-O2-PBA-07"],
        whatNotToDo:
          "Do NOT force someone with severe dizziness to stand or translate upright.",
        whenToStopAndEscalate:
          "Follow direct CMO or Flight Surgeon verbal/written authorization for onboard anaphylaxis kit use.",
      },
      {
        stepNumber: 3,
        heading: "STEP 3 — CHECK",
        whatToDo: "Monitor SpO2, blood pressure, heart rate, and spread of hives/swelling.",
        howToDoIt:
          "Record Bio-Monitor blood pressure, heart rate, and secondary pulse oximeter SpO2; note any known allergy history if recorded.",
        equipmentIds: ["EQ-BIOMONITOR-01", "EQ-OXIMETER-02"],
        whatNotToDo:
          "Do NOT assume unknown allergy status means 'no allergies'.",
        whenToStopAndEscalate:
          "Escalate urgently if blood pressure drops, SpO2 falls below 94%, or swelling advances.",
      },
      {
        stepNumber: 4,
        heading: "STEP 4 — GET HELP",
        whatToDo: "Keep CMO and Flight Surgeon consultation active continuously.",
        howToDoIt:
          "Ensure a second crew member stays beside the affected astronaut and records trigger details and timeline.",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT leave the crew member alone.",
        whenToStopAndEscalate:
          "Escalate to backup responder automatically if primary responder fails to acknowledge.",
      },
      {
        stepNumber: 5,
        heading: "STEP 5 — CONTINUE MONITORING",
        whatToDo: "Track breathing, skin symptoms, and vitals every 5–10 minutes (watch for rebound waves).",
        howToDoIt:
          "Log continuous Condition Tracking entries for at least several hours under medical authority guidance.",
        equipmentIds: ["EQ-BIOMONITOR-01"],
        whatNotToDo:
          "Do NOT close the incident early even if skin rash fades.",
        whenToStopAndEscalate:
          "Move immediately to Unresponsive/Airway protocol if breathing fails.",
      },
    ],
    equipmentAlternatives: {
      "EQ-OXIMETER-02":
        "Monitor breathing count visually and listen for wheezing/stridor while checking wearable Bio-Monitor HR/BP.",
    },
    supportedResourceIds: ["RES-NASA-MED-CHECKLIST"],
    searchKeywords: ["allergy", "allergic", "hives", "swelling", "throat", "anaphylaxis", "rash"],
    isSimulatedPrototype: true,
  },

  // 11. Dizziness, Fainting, Fluid Shifts & Space Motion Sickness
  {
    protocolId: "PROTO-DIZZINESS-VESTIBULAR-FLUID",
    title: "Dizziness, Space Motion Sickness & Fluid-Shift First-Response",
    categoryIds: ["DIZZINESS_FAINTING", "SPACE_MOTION_SICKNESS", "FLUID_SHIFTS_VISUAL"],
    source: "AEGIS-V Approved First-Response Pack (NASA HRP Vestibular & SANS Context)",
    version: "v1.3-OFFLINE-2026",
    isUrgent: false,
    allowedForNonCmo: true,
    requiresCmoForAdvanced: false,
    overviewNotice:
      "Dizziness or visual symptoms may reflect benign microgravity adaptation OR urgent hypoxia, CO2 buildup, dehydration, cardiac change, or neurological event. Check vitals & cabin air.",
    steps: [
      {
        stepNumber: 1,
        heading: "STEP 1 — DO THIS NOW",
        whatToDo: "Secure the crew member in a stable seated/anchored position and check for red flags.",
        howToDoIt:
          "Stabilize translation immediately and clip into a crew restraint. Keep head movements slow and gentle. Ask whether speech, vision, or limb strength feels abnormal, or if chest pain is present.",
        equipmentIds: ["EQ-TRAUMA-KIT-10"],
        whatNotToDo:
          "Do NOT perform EVA, ARED, or complex rack operations while dizzy or visually impaired.",
        whenToStopAndEscalate:
          "Escalate immediately as URGENT if fainting occurred, chest pain is present, or speech/vision/strength suddenly changes.",
      },
      {
        stepNumber: 2,
        heading: "STEP 2 — NEXT ACTION",
        whatToDo: "Inspect cabin CO2 / ventilation, offer small sips of water if not vomiting, and reduce visual strain.",
        howToDoIt:
          "Verify Life-Safety Sentinel CO2 and airflow. If alert and without active vomiting, take small sips of potable water (250 mL). For dry ocular discomfort, verify preservative-free ocular drop schedule if appropriate.",
        equipmentIds: ["EQ-CDRA-TEST-03"],
        whatNotToDo:
          "Do NOT diagnose 'normal space adaptation' without checking vitals, cabin CO2, and baseline comparisons.",
        whenToStopAndEscalate:
          "Escalate if CO2 > 4.5 mmHg or if symptoms fail to settle with rest.",
      },
      {
        stepNumber: 3,
        heading: "STEP 3 — CHECK",
        whatToDo: "Check latest valid vitals vs 14-day baseline and screen ocular/hydration history.",
        howToDoIt:
          "Compare heart rate, blood pressure, SpO2, cabin CO2, and recent hydration/sleep against personal 14-day P05–P95 bands. Cross-check SpO2 with secondary pulse oximeter.",
        equipmentIds: ["EQ-BIOMONITOR-01", "EQ-OXIMETER-02", "EQ-TONOMETER-04"],
        whatNotToDo:
          "Do NOT rely on stale or quarantined telemetry, and do NOT interpret single-operator tonometer readings without noting limitations.",
        whenToStopAndEscalate:
          "Escalate to CMO/Flight Surgeon if vitals fall outside baseline, visual symptoms progress, or IOP is elevated.",
      },
      {
        stepNumber: 4,
        heading: "STEP 4 — GET HELP",
        whatToDo: "Notify CMO (or designated Continuity responder) and prepare Earth Flight Surgeon summary.",
        howToDoIt:
          "Record onset time, triggers (e.g., head motion, post-exercise, cabin zone), and current telemetry deviations. Queue handoff if Earth comms are offline.",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT administer prescription anti-motion or controlled drugs without CMO/Flight Surgeon approval.",
        whenToStopAndEscalate:
          "Escalate immediately if condition worsens or another crew member develops similar symptoms (suggesting environmental issue).",
      },
      {
        stepNumber: 5,
        heading: "STEP 5 — CONTINUE MONITORING",
        whatToDo: "Re-assess dizziness, nausea, visual clarity, and vitals after 15–30 minutes of rest.",
        howToDoIt:
          "Log Condition Tracking updates and note explicitly whether symptoms improved, stayed unchanged, or worsened.",
        equipmentIds: ["EQ-BIOMONITOR-01", "EQ-OXIMETER-02"],
        whatNotToDo:
          "Do NOT claim an intervention worked simply because one subsequent reading moved closer to baseline.",
        whenToStopAndEscalate:
          "Raise escalation warning automatically if symptoms worsen or responsiveness drops.",
      },
    ],
    equipmentAlternatives: {
      "EQ-TONOMETER-04":
        "Handheld tonometer status is LIMITED and requires a trained two-crew spotter; if unavailable or single-operator, skip tonometry and document visual symptom severity score (0–10) + fundoscope image if available.",
      "EQ-OXIMETER-02":
        "Cross-check with wearable Bio-Monitor SpO2 and note sensor confidence.",
    },
    supportedResourceIds: ["RES-NASA-SANS-2024", "RES-ISS-CO2-HYPOXIA", "RES-NASA-ARCHER-2023"],
    searchKeywords: ["dizziness", "dizzy", "fainting", "vestibular", "motion sickness", "fluid shift", "visual", "sans"],
    isSimulatedPrototype: true,
  },

  // 12. Nausea, Vomiting, Abdominal Pain & Fever/Infection
  {
    protocolId: "PROTO-GI-FEVER-SUPPORT",
    title: "Nausea, Vomiting, Abdominal Pain & Fever Support Guide",
    categoryIds: ["NAUSEA_VOMITING", "ABDOMINAL_PAIN", "FEVER_INFECTION"],
    source: "AEGIS-V Approved First-Response Pack (Crew GI & Febrile Monitoring Guide)",
    version: "v1.2-OFFLINE-2026",
    isUrgent: false,
    allowedForNonCmo: true,
    requiresCmoForAdvanced: true,
    cmoRestrictedNote:
      "Antibiotics, antiemetics, and abdominal diagnostic exams require CMO or Earth Flight Surgeon authorization.",
    overviewNotice:
      "In microgravity, vomiting presents an airway and cabin contamination risk; keep an emesis containment bag and suction/towels immediately ready.",
    steps: [
      {
        stepNumber: 1,
        heading: "STEP 1 — DO THIS NOW",
        whatToDo: "Position safely with airway/emesis containment and check for severe warning signs.",
        howToDoIt:
          "Restrain crew member upright or on their side (never flat on back while nauseated). Keep emesis bag and clean towels ready. Ask pain location and severity (0–10).",
        equipmentIds: ["EQ-TRAUMA-KIT-10"],
        whatNotToDo:
          "Do NOT force large amounts of water or food during active vomiting, and do NOT give unapproved pain/anti-nausea medications.",
        whenToStopAndEscalate:
          "Escalate immediately as URGENT if abdominal pain is severe/rigid, vomit contains blood, fever > 38.5 °C, or crew becomes confused/unable to keep fluids down.",
      },
      {
        stepNumber: 2,
        heading: "STEP 2 — NEXT ACTION",
        whatToDo: "Maintain calm rest and attempt small sips of water ONLY after vomiting pauses for 20–30 minutes.",
        howToDoIt:
          "Offer 15–30 mL sips every 10–15 minutes once nausea settles to track hydration tolerance.",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT apply heat pads over acute unexplained lower-right abdominal pain.",
        whenToStopAndEscalate:
          "Escalate if fluids cannot be tolerated for more than 4–6 hours or dizziness occurs.",
      },
      {
        stepNumber: 3,
        heading: "STEP 3 — CHECK",
        whatToDo: "Measure temperature, heart rate, blood pressure, and review recent nutrition/hydration logs.",
        howToDoIt:
          "Record skin/core temperature, Bio-Monitor vitals, and last valid hydration/calorie metrics. Note whether other crew share symptoms.",
        equipmentIds: ["EQ-BIOMONITOR-01", "EQ-OXIMETER-02"],
        whatNotToDo:
          "Do NOT guess fever without a thermometer reading; explicitly record temperature as unavailable if not measured.",
        whenToStopAndEscalate:
          "Escalate urgently for high fever, rapid resting heart rate (> 100 bpm), or low blood pressure.",
      },
      {
        stepNumber: 4,
        heading: "STEP 4 — GET HELP",
        whatToDo: "Contact CMO / Flight Surgeon with symptom timeline, pain location, and vital trends.",
        howToDoIt:
          "Compile unanswered questions for CMO/Flight Surgeon (e.g., whether oral rehydration or antiemetic protocol is authorized).",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT issue antibiotics or controlled medications without medical officer authorization.",
        whenToStopAndEscalate:
          "Escalate to priority Earth handoff if CMO is unavailable.",
      },
      {
        stepNumber: 5,
        heading: "STEP 5 — CONTINUE MONITORING",
        whatToDo: "Track temperature, hydration sips, pain score (0–10), and vitals every 30 minutes.",
        howToDoIt:
          "Log every check in Condition Tracking so dehydration or abdominal worsening is caught early.",
        equipmentIds: ["EQ-BIOMONITOR-01"],
        whatNotToDo:
          "Do NOT clear the case silently while fever or pain remains active.",
        whenToStopAndEscalate:
          "Trigger immediate urgent escalation if pain localizes intensely, fever rises, or weakness/dizziness develops.",
      },
    ],
    equipmentAlternatives: {
      "EQ-BIOMONITOR-01":
        "Use Daily Check-In manual thermometer/extended bio entry and finger pulse oximeter if smart shirt is removed for comfort.",
    },
    supportedResourceIds: ["RES-NASA-MED-CHECKLIST", "RES-NASA-HRP-NUTRITION"],
    searchKeywords: ["nausea", "vomiting", "abdominal", "stomach", "belly pain", "fever", "infection"],
    isSimulatedPrototype: true,
  },

  // 13. Spaceflight: Decompression, Radiation, Heat/Cold Emergencies
  {
    protocolId: "PROTO-SPACEFLIGHT-ENV-EMERGENCY",
    title: "Decompression, Radiation & Thermal Suit/Cabin Emergency Guide",
    categoryIds: ["DECOMPRESSION_CONCERNS", "RADIATION_EXPOSURE", "HEAT_COLD_EMERGENCIES"],
    source: "AEGIS-V Approved First-Response Pack (EVA / ALARA / Thermal Contingency Context)",
    version: "v1.3-OFFLINE-2026",
    isUrgent: true,
    allowedForNonCmo: true,
    requiresCmoForAdvanced: true,
    cmoRestrictedNote:
      "Hyperbaric / suit-repressurization medical orders and prescription therapies require Flight Surgeon / CMO authorization.",
    overviewNotice:
      "Covers spaceflight environmental contingencies: post-EVA joint/neuro symptoms (DCS concern), solar particle radiation spikes, and suit/cabin overheating or cold injury.",
    steps: [
      {
        stepNumber: 1,
        heading: "STEP 1 — DO THIS NOW",
        whatToDo: "Stop EVA/exertion, secure pressurized habitat/shelter safety, and verify life-support gauges.",
        howToDoIt:
          "For decompression/cabin pressure drop: inspect hatch seals, keep crew restrained, and verify ppO2/cabin pressure. For radiation event: move non-essential crew into designated water/polyethylene storm shelter with personal dosimeters. For heat/cold: remove overheated suit/layers or warm gently with dry thermal blankets.",
        equipmentIds: ["EQ-LEAK-PATCH-09", "EQ-DOSIMETER-05", "EQ-O2-PBA-07"],
        whatNotToDo:
          "Do NOT ignore post-EVA joint aches or tingling, do NOT rub frostbitten tissue, and do NOT expose overheated crew to ice water shock.",
        whenToStopAndEscalate:
          "Escalate immediately as critical emergency for cabin pressure loss <= -0.5 kPa/hr, DCS neurological signs, or core temp < 35.5 °C / > 38.5 °C.",
      },
      {
        stepNumber: 2,
        heading: "STEP 2 — NEXT ACTION",
        whatToDo: "Stabilize oxygen/thermal comfort and verify environmental readings.",
        howToDoIt:
          "Provide cool drinking water for heat strain (if alert) or warm dry blankets for cold exposure. Verify shelter dosimeter reading or leak-detector seal status.",
        equipmentIds: ["EQ-DOSIMETER-05", "EQ-LEAK-PATCH-09"],
        whatNotToDo:
          "Do NOT attempt autonomous spacecraft valve/venting overrides from this medical assistant.",
        whenToStopAndEscalate:
          "Follow Flight Director / habitat emergency procedures if module isolation is required.",
      },
      {
        stepNumber: 3,
        heading: "STEP 3 — CHECK",
        whatToDo: "Record core/skin temperature, SpO2, heart rate, neurological status, and dosimeter/pressure metrics.",
        howToDoIt:
          "Compare valid telemetry against personal 14-day baseline and attach recent EVA suit pre-breathe / leak-check records if relevant.",
        equipmentIds: ["EQ-BIOMONITOR-01", "EQ-OXIMETER-02", "EQ-DOSIMETER-05"],
        whatNotToDo:
          "Do NOT assume missing dosimeter or pressure readings mean safe exposure.",
        whenToStopAndEscalate:
          "Escalate urgently if any neurological symptoms, chest tightness, or persistent joint pain occur post-EVA.",
      },
      {
        stepNumber: 4,
        heading: "STEP 4 — GET HELP",
        whatToDo: "Alert CMO, Mission Commander, and Earth Flight Surgeon immediately.",
        howToDoIt:
          "Queue Earth consultation with full environmental log (ppO2, cabin pressure rate, radiation mSv/hr, suit telemetry).",
        equipmentIds: [],
        whatNotToDo:
          "Do NOT clear a crew member for subsequent EVA after suspected decompression or thermal injury without Flight Surgeon clearance.",
        whenToStopAndEscalate:
          "Escalate to backup responder automatically on timeout.",
      },
      {
        stepNumber: 5,
        heading: "STEP 5 — CONTINUE MONITORING",
        whatToDo: "Track symptom evolution, temperature, and environment stability every 10–15 minutes.",
        howToDoIt:
          "Log Condition Tracking updates and keep shelter/monitoring records intact until Earth comms sync.",
        equipmentIds: ["EQ-DOSIMETER-05", "EQ-BIOMONITOR-01"],
        whatNotToDo:
          "Do NOT exit storm shelter or depressurize/re-enter airlock prematurely.",
        whenToStopAndEscalate:
          "Escalate immediately on any worsening symptom or environmental fault.",
      },
    ],
    equipmentAlternatives: {
      "EQ-DOSIMETER-05":
        "If Storm Shelter area dosimeter is unavailable, use individual wearable crew dosimeter badges and habitat cumulative log; note unverified area shielding.",
      "EQ-LEAK-PATCH-09":
        "Follow physical module hatch isolation checklist per Commander if leak patch kit cannot seal drop.",
    },
    supportedResourceIds: ["RES-CSA-RADIATION-ALARA", "RES-ISS-CO2-HYPOXIA", "RES-NASA-MED-CHECKLIST"],
    searchKeywords: ["decompression", "dcs", "eva", "radiation", "solar", "heat", "cold", "hypothermia", "hyperthermia"],
    isSimulatedPrototype: true,
  },
];
