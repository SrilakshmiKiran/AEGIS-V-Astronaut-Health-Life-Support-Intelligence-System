import { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import {
  ActorRole,
  AUTHORIZED_PROTOTYPE_PROCEDURES,
  BaselineProfile,
  ConsultationQueueItem,
  DataSourceType,
  DemoSceneId,
  DeterministicFinding,
  IncidentRecord,
  IncidentState,
  PARAMETER_METADATA,
  ParameterName,
  PROTOTYPE_DISCLAIMER,
  QualityStatus,
  SCHEMA_VERSION,
  SyncStatus,
  TelemetryLatestResponse,
  TelemetryObservation,
} from "../types/aegisContracts";
import {
  ALL_18_PARAMETERS,
} from "../types/aegisContracts";
import {
  EXTENDED_BIO_BANDS,
  ExtendedBioSummary,
  LIGHT_DELAY_META,
  MISSION_ENVIRONMENT_META,
  MissionEnvironmentId,
  OpsStateDoc,
} from "../types/opsContracts";
import {
  DEFAULT_CONTINUITY_STATE,
  SCENE_7_CONTINUITY_INITIAL_STATE,
} from "../types/continuityContracts";
import {
  SEEDED_BASELINE_PROFILE,
  buildConsultationQueueItem,
  buildDemoIncidents,
  buildIncidentFromFinding,
  buildSceneObservations,
} from "../mocks/cloudPreviewFixtures";
import {
  computeAuditEntryHash,
  deriveOverallPostActionDirection,
  evaluatePostResponseTrend,
  evaluateTelemetryWindow,
  sha256Hex,
  validateRoleAndPin,
} from "../utils/aegisPureEngine";

export interface WorkspaceProfileDoc {
  ownerId: string;
  astronautId: string;
  astronautName: string;
  missionName: string;
  activeScene: DemoSceneId;
  earthWanConnected: boolean;
  dataSourceMode: DataSourceType;
  optionalLlmEnabled: boolean;
  operatorRole: ActorRole;
}

export interface SnapshotSummary {
  snapshot_id: string;
  filename: string;
  created_at: string;
  reason: string;
  observation_count: number;
  incident_count: number;
  report_count: number;
  checksum: string;
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 120);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

function buildObservationPayload(uid: string, obs: TelemetryObservation) {
  const obsId = sanitizeId(obs.observation_id);
  const payload: Record<string, unknown> = {
    ownerId: uid,
    observationId: obsId,
    astronautId: (obs.astronaut_id || "AST-01-COMMANDER").slice(0, 64),
    timestamp: (obs.timestamp || new Date().toISOString()).slice(0, 64),
    parameter: String(obs.parameter).slice(0, 64),
    value: obs.value === undefined ? null : obs.value,
    unit: (obs.unit || "unit").slice(0, 32),
    sourceType: obs.source_type || "SIMULATED",
    deviceId: (obs.device_id || "SIM-ENGINE-01").slice(0, 64),
    deviceHmacVerified: Boolean(obs.device_hmac_verified),
    infoLabel: obs.info_label || "MEASURED",
    qualityStatus: obs.quality_status || "VALID",
    qualityNotes: (obs.quality_notes || "").slice(0, 400),
    isQuarantined: Boolean(obs.is_quarantined),
    createdAt: serverTimestamp(),
  };
  const phase = obs.context_metadata?.phase;
  if (typeof phase === "string" && phase.length > 0) {
    payload.phase = phase.slice(0, 64);
  }
  return { obsId, payload };
}

function buildIncidentPayload(uid: string, inc: IncidentRecord) {
  const incidentId = sanitizeId(inc.incident_id);
  const cleanRecord = stripUndefinedDeep({
    ...inc,
    incident_id: incidentId,
  });
  return {
    incidentId,
    payload: {
      ownerId: uid,
      incidentId,
      astronautId: (inc.astronaut_id || "AST-01-COMMANDER").slice(0, 64),
      title: (inc.title || "Health Telemetry Alert").slice(0, 240),
      ruleId: String(inc.rule_id).slice(0, 64),
      severity:
        inc.severity === "HIGH" || inc.severity === "MODERATE" || inc.severity === "ADVISORY"
          ? inc.severity
          : "MODERATE",
      state: inc.state,
      syncStatus: inc.sync_status,
      record: cleanRecord,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  };
}

function buildConsultationPayload(uid: string, item: ConsultationQueueItem) {
  const packageId = sanitizeId(item.package_id);
  const incidentId = sanitizeId(item.incident_id);
  const cleanItem = stripUndefinedDeep({
    ...item,
    package_id: packageId,
    incident_id: incidentId,
  });
  const payload: Record<string, unknown> = {
    ownerId: uid,
    packageId,
    incidentId,
    syncStatus: item.sync_status,
    markdownReport: (item.payload?.markdown_report || "").slice(0, 16000),
    questions: (item.payload?.flight_surgeon_questions || [])
      .slice(0, 12)
      .map((q) => String(q).slice(0, 500)),
    item: cleanItem,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (item.last_attempt_at) {
    payload.lastAttemptAt = String(item.last_attempt_at).slice(0, 64);
  }
  if (item.error_message) {
    payload.errorMessage = String(item.error_message).slice(0, 400);
  }
  return { packageId, payload };
}

const inFlightWorkspaceInit = new Map<string, Promise<void>>();

export async function ensureUserWorkspace(user: User): Promise<void> {
  const uid = sanitizeId(user.uid);
  const existingPromise = inFlightWorkspaceInit.get(uid);
  if (existingPromise) {
    return existingPromise;
  }

  const run = (async () => {
    const workspacePath = `users/${uid}`;
    const workspaceRef = doc(db, "users", uid);

    let existingSnap;
    try {
      existingSnap = await getDoc(workspaceRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, workspacePath);
    }

    if (existingSnap && existingSnap.exists()) {
      return;
    }

  const initialScene: DemoSceneId = "SCENE_2_GRADUAL_ANOMALY";
  const initialObservations = buildSceneObservations(initialScene);
  const initialIncidents = buildDemoIncidents(initialScene, initialObservations, false);
  const initialConsultations =
    initialIncidents.length > 0
      ? [buildConsultationQueueItem(initialIncidents[0], "PENDING")]
      : [];

  const batch = writeBatch(db);

  batch.set(workspaceRef, {
    ownerId: uid,
    astronautId: SEEDED_BASELINE_PROFILE.astronaut_id,
    astronautName: SEEDED_BASELINE_PROFILE.full_name,
    missionName: "Lunar Gateway Habitat Prototype",
    activeScene: initialScene,
    earthWanConnected: true,
    dataSourceMode: "SIMULATED",
    optionalLlmEnabled: false,
    operatorRole: "CREW_MEDICAL_OFFICER",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const privateRef = doc(db, "users", uid, "private", "info");
  batch.set(privateRef, {
    ownerId: uid,
    email: (user.email || "").slice(0, 200),
    displayName: (user.displayName || "Crew Operator").slice(0, 120),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const obs of initialObservations) {
    const { obsId, payload } = buildObservationPayload(uid, obs);
    batch.set(doc(db, "users", uid, "observations", obsId), payload);
  }

  for (const inc of initialIncidents) {
    const { incidentId, payload } = buildIncidentPayload(uid, inc);
    batch.set(doc(db, "users", uid, "incidents", incidentId), payload);
  }

  for (const pkg of initialConsultations) {
    const { packageId, payload } = buildConsultationPayload(uid, pkg);
    batch.set(doc(db, "users", uid, "consultations", packageId), payload);
  }

  const initSnapId = "SNAP_INITIAL_WORKSPACE";
  batch.set(doc(db, "users", uid, "snapshots", initSnapId), {
    ownerId: uid,
    snapshotId: initSnapId,
    filename: "aegis_workspace_initial.json",
    reason: "Initial private workspace created",
    observationCount: initialObservations.length,
    incidentCount: initialIncidents.length,
    reportCount: initialConsultations.length,
    checksum: "sha256_init_" + uid.slice(0, 10),
    createdAtIso: new Date().toISOString(),
    createdAt: serverTimestamp(),
  });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, workspacePath);
    }
  })();

  inFlightWorkspaceInit.set(uid, run);
  try {
    await run;
  } finally {
    inFlightWorkspaceInit.delete(uid);
  }
}

export function subscribeWorkspace(
  uidRaw: string,
  callbacks: {
    onWorkspace: (ws: WorkspaceProfileDoc | null) => void;
    onObservations: (obs: TelemetryObservation[]) => void;
    onIncidents: (incidents: IncidentRecord[]) => void;
    onConsultations: (items: ConsultationQueueItem[]) => void;
    onSnapshots: (snaps: SnapshotSummary[]) => void;
    onError: (err: Error) => void;
  }
): () => void {
  const uid = sanitizeId(uidRaw);

  const unsubWorkspace = onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        callbacks.onWorkspace({
          ownerId: d.ownerId,
          astronautId: d.astronautId,
          astronautName: d.astronautName,
          missionName: d.missionName,
          activeScene: d.activeScene,
          earthWanConnected: Boolean(d.earthWanConnected),
          dataSourceMode: d.dataSourceMode,
          optionalLlmEnabled: Boolean(d.optionalLlmEnabled),
          operatorRole: d.operatorRole || "CREW_MEDICAL_OFFICER",
        });
      } else {
        callbacks.onWorkspace(null);
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const obsQuery = query(
    collection(db, "users", uid, "observations"),
    where("ownerId", "==", uid)
  );
  const unsubObs = onSnapshot(
    obsQuery,
    (snap) => {
      const list: TelemetryObservation[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          observation_id: data.observationId,
          astronaut_id: data.astronautId,
          timestamp: data.timestamp,
          parameter: data.parameter as ParameterName,
          value: data.value ?? null,
          unit: data.unit,
          source_type: data.sourceType,
          device_id: data.deviceId,
          device_hmac_verified: Boolean(data.deviceHmacVerified),
          info_label: data.infoLabel,
          quality_status: data.qualityStatus,
          quality_notes: data.qualityNotes || "",
          is_quarantined: Boolean(data.isQuarantined),
          context_metadata: data.phase ? { phase: data.phase } : undefined,
        };
      });
      list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      callbacks.onObservations(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/observations`);
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const incQuery = query(
    collection(db, "users", uid, "incidents"),
    where("ownerId", "==", uid)
  );
  const unsubInc = onSnapshot(
    incQuery,
    (snap) => {
      const list: IncidentRecord[] = snap.docs
        .map((d) => d.data().record as IncidentRecord)
        .filter(Boolean)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      callbacks.onIncidents(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/incidents`);
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const conQuery = query(
    collection(db, "users", uid, "consultations"),
    where("ownerId", "==", uid)
  );
  const unsubCon = onSnapshot(
    conQuery,
    (snap) => {
      const list: ConsultationQueueItem[] = snap.docs
        .map((d) => d.data().item as ConsultationQueueItem)
        .filter(Boolean)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      callbacks.onConsultations(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/consultations`);
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const snapQuery = query(
    collection(db, "users", uid, "snapshots"),
    where("ownerId", "==", uid)
  );
  const unsubSnap = onSnapshot(
    snapQuery,
    (snap) => {
      const list: SnapshotSummary[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            snapshot_id: data.snapshotId,
            filename: data.filename,
            created_at: data.createdAtIso,
            reason: data.reason,
            observation_count: Number(data.observationCount || 0),
            incident_count: Number(data.incidentCount || 0),
            report_count: Number(data.reportCount || 0),
            checksum: data.checksum,
          };
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      callbacks.onSnapshots(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/snapshots`);
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  return () => {
    unsubWorkspace();
    unsubObs();
    unsubInc();
    unsubCon();
    unsubSnap();
  };
}

export async function switchScenarioInCloud(
  uidRaw: string,
  sceneId: DemoSceneId,
  optionalLlmEnabled: boolean
): Promise<{ ok: boolean; message: string }> {
  const uid = sanitizeId(uidRaw);
  const path = `users/${uid}`;

  // Fetch existing subcollections to replace cleanly
  const continuityRef = doc(db, "users", uid, "opsRecords", "REC_CONTINUITY_STATE");
  const [obsSnap, incSnap, conSnap, continuitySnap] = await Promise.all([
    getDocs(query(collection(db, "users", uid, "observations"), where("ownerId", "==", uid))),
    getDocs(query(collection(db, "users", uid, "incidents"), where("ownerId", "==", uid))),
    getDocs(query(collection(db, "users", uid, "consultations"), where("ownerId", "==", uid))),
    getDoc(continuityRef),
  ]).catch((err) => handleFirestoreError(err, OperationType.LIST, path));

  // Commit deletions first so recreating deterministic IDs (e.g., OBS-*, INC-DEMO-001)
  // always evaluates `allow create` rather than `allow update` on existing docs.
  const docsToDelete = [...obsSnap.docs, ...incSnap.docs, ...conSnap.docs];
  if (continuitySnap.exists()) {
    docsToDelete.push(continuitySnap as unknown as (typeof docsToDelete)[number]);
  }
  for (let i = 0; i < docsToDelete.length; i += 400) {
    const deleteBatch = writeBatch(db);
    docsToDelete.slice(i, i + 400).forEach((d) => deleteBatch.delete(d.ref));
    try {
      await deleteBatch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  const newObs = buildSceneObservations(sceneId);
  const newIncidents = buildDemoIncidents(sceneId, newObs, optionalLlmEnabled);
  const newConsultations =
    newIncidents.length > 0
      ? [
          buildConsultationQueueItem(
            newIncidents[0],
            sceneId === "SCENE_6_CONNECTIVITY_RESTORED" ? "SYNCED" : "PENDING"
          ),
        ]
      : [];

  const isEarthOffline =
    sceneId === "SCENE_4_EARTH_UNAVAILABLE" || sceneId === "SCENE_7_CONTINUITY_CMO_UNAVAILABLE";
  const nextOperatorRole: ActorRole =
    sceneId === "SCENE_7_CONTINUITY_CMO_UNAVAILABLE" ? "CREW_MEMBER" : "CREW_MEDICAL_OFFICER";
  const nextContinuityState =
    sceneId === "SCENE_7_CONTINUITY_CMO_UNAVAILABLE"
      ? { ...SCENE_7_CONTINUITY_INITIAL_STATE, updatedAtIso: new Date().toISOString() }
      : { ...DEFAULT_CONTINUITY_STATE, updatedAtIso: new Date().toISOString() };

  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid), {
    activeScene: sceneId,
    earthWanConnected: !isEarthOffline,
    operatorRole: nextOperatorRole,
    updatedAt: serverTimestamp(),
  });

  batch.set(continuityRef, {
    ownerId: uid,
    recordId: "REC_CONTINUITY_STATE",
    recordType: "CHECKLIST_LOG",
    crewId: "AST-01-COMMANDER",
    title: "AEGIS Continuity Mode State",
    status: nextContinuityState.continuityActive ? "CONTINUITY_ACTIVE" : "NOMINAL",
    timestampIso: nextContinuityState.updatedAtIso,
    payload: stripUndefinedDeep(nextContinuityState),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const obs of newObs) {
    const { obsId, payload } = buildObservationPayload(uid, obs);
    batch.set(doc(db, "users", uid, "observations", obsId), payload);
  }

  for (const inc of newIncidents) {
    const { incidentId, payload } = buildIncidentPayload(uid, inc);
    batch.set(doc(db, "users", uid, "incidents", incidentId), payload);
  }

  for (const pkg of newConsultations) {
    const { packageId, payload } = buildConsultationPayload(uid, pkg);
    batch.set(doc(db, "users", uid, "consultations", packageId), payload);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }

  return {
    ok: true,
    message: `Loaded scenario and saved ${newObs.length} readings to your private cloud storage.`,
  };
}

export async function saveCheckinObservations(
  uidRaw: string,
  entries: Array<{
    parameter: ParameterName;
    value: number;
    quality_status?: QualityStatus;
    notes?: string;
  }>,
  existingObservations: TelemetryObservation[],
  baseline: BaselineProfile,
  actorId: string,
  options?: {
    existingIncidents?: IncidentRecord[];
    optionalLlmEnabled?: boolean;
    earthWanConnected?: boolean;
  }
): Promise<{
  ok: boolean;
  message: string;
  triggeredRules: DeterministicFinding[];
  newIncidentsCreated?: number;
}> {
  const uid = sanitizeId(uidRaw);
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  const addedObs: TelemetryObservation[] = [];

  entries.forEach((e, idx) => {
    const metric = baseline.metrics[e.parameter];
    const obs: TelemetryObservation = {
      observation_id: sanitizeId(`OBS_CHK_${Date.now()}_${idx}`),
      astronaut_id: baseline.astronaut_id,
      timestamp: now,
      parameter: e.parameter,
      value: e.value,
      unit: metric.unit,
      source_type: "MANUAL_ENTRY",
      device_id:
        e.parameter === "intraocular_pressure_mmhg" ? "CLINICAL-TONOMETER-01" : "CREW-MANUAL-LOG",
      device_hmac_verified: false,
      info_label: "MEASURED",
      quality_status:
        e.quality_status || (e.parameter === "caloric_intake_kcal" ? "ESTIMATED" : "VALID"),
      quality_notes: e.notes || "Manual crew check-in saved to cloud storage",
      reference_target: metric.authorized_target ?? null,
      context_metadata: { manual_entry_by: actorId },
      is_quarantined: false,
    };
    addedObs.push(obs);
    const { obsId, payload } = buildObservationPayload(uid, obs);
    batch.set(doc(db, "users", uid, "observations", obsId), payload);
  });

  const allObs = [...existingObservations, ...addedObs];
  const findings = evaluateTelemetryWindow(allObs, baseline);
  let newIncidentsCreated = 0;

  if (options?.existingIncidents) {
    const openRuleIds = new Set(
      options.existingIncidents
        .filter((i) => i.state !== "CLOSED_RETAINED")
        .map((i) => i.rule_id)
    );
    for (const finding of findings) {
      if (!openRuleIds.has(finding.rule_id)) {
        const newInc = buildIncidentFromFinding(
          finding,
          allObs,
          baseline,
          options.optionalLlmEnabled ?? false,
          options.earthWanConnected ?? true
        );
        const { incidentId, payload } = buildIncidentPayload(uid, newInc);
        batch.set(doc(db, "users", uid, "incidents", incidentId), payload);
        openRuleIds.add(finding.rule_id);
        newIncidentsCreated += 1;
      }
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/observations`);
  }

  const incidentSuffix =
    newIncidentsCreated > 0
      ? ` Raised ${newIncidentsCreated} new alert(s) in Alerts & Response.`
      : "";

  return {
    ok: true,
    message: `Saved ${addedObs.length} check-in reading(s) to private cloud storage (${findings.length} rule flag(s) active).${incidentSuffix}`,
    triggeredRules: findings,
    newIncidentsCreated,
  };
}

export async function injectTestObservationToCloud(
  uidRaw: string,
  testType: "VALID" | "STALE" | "IMPOSSIBLE" | "SPOOFED_HMAC"
): Promise<{ ok: boolean; message: string }> {
  const uid = sanitizeId(uidRaw);
  const now = new Date();
  const suffix = `${Date.now().toString().slice(-6)}`;
  let obs: TelemetryObservation;

  if (testType === "VALID") {
    obs = {
      observation_id: `OBS_TEST_VALID_${suffix}`,
      astronaut_id: "AST-01-COMMANDER",
      timestamp: now.toISOString(),
      parameter: "heart_rate_bpm",
      value: 71.0,
      unit: "bpm",
      source_type: "SIMULATED",
      device_id: "SIM-ENGINE-01",
      device_hmac_verified: false,
      info_label: "MEASURED",
      quality_status: "VALID",
      quality_notes: "Valid test reading passed data quality check",
      is_quarantined: false,
    };
  } else if (testType === "STALE") {
    obs = {
      observation_id: `OBS_TEST_STALE_${suffix}`,
      astronaut_id: "AST-01-COMMANDER",
      timestamp: new Date(now.getTime() - 28 * 60000).toISOString(),
      parameter: "respiration_rpm",
      value: 15.2,
      unit: "rpm",
      source_type: "SIMULATED",
      device_id: "SIM-ENGINE-01",
      device_hmac_verified: false,
      info_label: "MEASURED",
      quality_status: "STALE",
      quality_notes: "Reading is 28 minutes old (>15 min limit); flagged as stale",
      is_quarantined: false,
    };
  } else if (testType === "IMPOSSIBLE") {
    obs = {
      observation_id: `OBS_TEST_IMPOSSIBLE_${suffix}`,
      astronaut_id: "AST-01-COMMANDER",
      timestamp: now.toISOString(),
      parameter: "heart_rate_bpm",
      value: -10.0,
      unit: "bpm",
      source_type: "SIMULATED",
      device_id: "SIM-ENGINE-01",
      device_hmac_verified: false,
      info_label: "MEASURED",
      quality_status: "IMPOSSIBLE",
      quality_notes: "Impossible negative heart rate (-10 bpm); automatically quarantined",
      is_quarantined: true,
    };
  } else {
    obs = {
      observation_id: `OBS_TEST_UNSIGNED_${suffix}`,
      astronaut_id: "AST-01-COMMANDER",
      timestamp: now.toISOString(),
      parameter: "heart_rate_bpm",
      value: 75.0,
      unit: "bpm",
      source_type: "VERIFIED_DEVICE",
      device_id: "CSA-BIOMONITOR-HEXOSKIN-01",
      device_hmac_verified: false,
      info_label: "MEASURED",
      quality_status: "CORRUPTED",
      quality_notes: "Unverified hardware signature rejected and quarantined",
      is_quarantined: true,
    };
  }

  const { obsId, payload } = buildObservationPayload(uid, obs);
  try {
    await setDoc(doc(db, "users", uid, "observations", obsId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${uid}/observations/${obsId}`);
  }

  return {
    ok: true,
    message: `Saved ${testType.toLowerCase()} test reading (${obs.value} ${obs.unit}) to cloud storage.`,
  };
}

export async function transitionIncidentInCloud(
  uidRaw: string,
  incident: IncidentRecord,
  observations: TelemetryObservation[],
  baseline: BaselineProfile,
  action: "review" | "acknowledge" | "record-response" | "evaluate-followup" | "close",
  actorId: string,
  actorRole: ActorRole,
  payloadInput?: {
    authorized_action?: string;
    procedure_reference?: string;
    closure_notes?: string;
    auth_pin?: string;
    includeSimulatedFollowup?: boolean;
  }
): Promise<{ ok: boolean; message: string }> {
  const uid = sanitizeId(uidRaw);
  const requiresPin =
    action === "acknowledge" || action === "record-response" || action === "close";
  const allowedRoles: ActorRole[] = requiresPin
    ? ["CREW_MEDICAL_OFFICER"]
    : ["CREW_MEDICAL_OFFICER", "CREW_MEMBER"];

  const authCheck = validateRoleAndPin(
    actorRole,
    payloadInput?.auth_pin ?? "",
    allowedRoles,
    requiresPin
  );
  if (!authCheck.authorized) {
    return {
      ok: false,
      message: authCheck.message,
    };
  }
  if (incident.state === "CLOSED_RETAINED") {
    return {
      ok: false,
      message: "This alert is already closed and locked in your audit record.",
    };
  }

  const now = new Date().toISOString();
  const incCopy: IncidentRecord = JSON.parse(JSON.stringify(incident));
  const prevState = incCopy.state;
  let nextState: IncidentState = incCopy.state;
  let note = "";
  const extraPostObs: TelemetryObservation[] = [];

  const trackedParams = Array.from(
    new Set<ParameterName>([
      "heart_rate_bpm",
      "spo2_pct",
      "respiration_rpm",
      "cabin_co2_mmhg",
      ...(Object.keys(incCopy.baseline_comparison || {}) as ParameterName[]),
    ])
  );

  const computeTrends = (
    obsList: TelemetryObservation[],
    actionRecordedAt: string | null
  ) => {
    const actionTs = actionRecordedAt ? new Date(actionRecordedAt).getTime() : Infinity;
    trackedParams.forEach((param) => {
      const isPostReading = (o: TelemetryObservation) =>
        o.context_metadata?.phase === "POST_RESPONSE_FOLLOWUP" ||
        new Date(o.timestamp).getTime() > actionTs;

      const pre = obsList.filter(
        (o) => o.parameter === param && !o.is_quarantined && !isPostReading(o)
      );
      const post = obsList.filter(
        (o) => o.parameter === param && !o.is_quarantined && isPostReading(o)
      );
      incCopy.post_action_comparisons[param] = evaluatePostResponseTrend(
        pre,
        post,
        param,
        baseline
      );
    });
    incCopy.post_action_direction = deriveOverallPostActionDirection(
      incCopy.post_action_comparisons
    );
  };

  if (action === "review") {
    nextState = "REVIEWED";
    note = "Reviewed 7-part alert evidence and personal baseline comparisons.";
  } else if (action === "acknowledge") {
    nextState = "ACKNOWLEDGED";
    incCopy.acknowledged_by = actorId;
    incCopy.acknowledged_role = actorRole;
    incCopy.acknowledged_at = now;
    note = "CMO PIN-verified acknowledgment recorded.";
  } else if (action === "record-response") {
    const procCode = payloadInput?.procedure_reference || "PROC-ENV-CO2-01";
    nextState = "MONITORING";
    incCopy.procedure_reference = procCode;
    incCopy.authorized_action =
      payloadInput?.authorized_action || AUTHORIZED_PROTOTYPE_PROCEDURES[procCode] || procCode;
    incCopy.action_recorded_at = now;

    let workingObs = observations;
    const hasPost = observations.some(
      (o) =>
        o.context_metadata?.phase === "POST_RESPONSE_FOLLOWUP" ||
        new Date(o.timestamp).getTime() > new Date(now).getTime()
    );
    if (!hasPost && payloadInput?.includeSimulatedFollowup) {
      const scene5Obs = buildSceneObservations("SCENE_5_RESPONSE_FOLLOWUP");
      const postOnly = scene5Obs
        .filter((o) => o.context_metadata?.phase === "POST_RESPONSE_FOLLOWUP")
        .map((o) => ({
          ...o,
          quality_notes: `[Simulated Post-Action Recovery Demo] ${o.quality_notes || ""}`.slice(
            0,
            390
          ),
        }));
      extraPostObs.push(...postOnly);
      workingObs = [...observations, ...postOnly];
    }

    computeTrends(workingObs, incCopy.action_recorded_at);
    note = `Recorded response (${procCode}) and evaluated post-action trend (${incCopy.post_action_direction}).`;
  } else if (action === "evaluate-followup") {
    nextState = "MONITORING";
    let workingObs = observations;
    const actionAt = incCopy.action_recorded_at || now;
    const hasPost = observations.some(
      (o) =>
        o.context_metadata?.phase === "POST_RESPONSE_FOLLOWUP" ||
        new Date(o.timestamp).getTime() > new Date(actionAt).getTime()
    );
    if (!hasPost && payloadInput?.includeSimulatedFollowup) {
      const scene5Obs = buildSceneObservations("SCENE_5_RESPONSE_FOLLOWUP");
      const postOnly = scene5Obs
        .filter((o) => o.context_metadata?.phase === "POST_RESPONSE_FOLLOWUP")
        .map((o) => ({
          ...o,
          quality_notes: `[Simulated Post-Action Recovery Demo] ${o.quality_notes || ""}`.slice(
            0,
            390
          ),
        }));
      extraPostObs.push(...postOnly);
      workingObs = [...observations, ...postOnly];
    }
    computeTrends(workingObs, actionAt);
    note =
      incCopy.post_action_direction === "INSUFFICIENT_DATA"
        ? "Re-checked follow-up readings: insufficient post-action observations (< 2 valid readings after action) to classify direction."
        : `Re-evaluated post-action follow-up readings; computed direction: ${incCopy.post_action_direction}.`;
  } else if (action === "close") {
    nextState = "CLOSED_RETAINED";
    note =
      payloadInput?.closure_notes ||
      "Post-action follow-up reviewed; incident closed and retained in cloud archive.";
  }

  incCopy.state = nextState;
  incCopy.updated_at = now;
  const prevHash =
    incCopy.audit_log.length > 0
      ? incCopy.audit_log[incCopy.audit_log.length - 1].entry_hash
      : "0".repeat(64);
  const logId = `AUD-${String(incCopy.audit_log.length + 1).padStart(3, "0")}`;
  const unsignedAudit = {
    log_id: logId,
    incident_id: incCopy.incident_id,
    timestamp: now,
    from_state: prevState,
    to_state: nextState,
    actor_id: actorId,
    actor_role: actorRole,
    notes: note,
    prev_hash: prevHash,
  };
  const newHash = computeAuditEntryHash(unsignedAudit);

  incCopy.audit_log.push({
    ...unsignedAudit,
    entry_hash: newHash,
  });

  incCopy.replay_timeline.push({
    step: incCopy.replay_timeline.length + 1,
    timestamp: now,
    event_type: `INCIDENT_STATE_${nextState}`,
    label: "COMPUTED",
    state: nextState,
    title: `Step ${incCopy.replay_timeline.length + 1}: ${note}`,
    detail: `Updated by ${actorId} (${actorRole})`,
  });

  const incidentId = sanitizeId(incCopy.incident_id);
  const batch = writeBatch(db);

  for (const postObs of extraPostObs) {
    const { obsId, payload } = buildObservationPayload(uid, postObs);
    batch.set(doc(db, "users", uid, "observations", obsId), payload);
  }

  batch.update(doc(db, "users", uid, "incidents", incidentId), {
    state: incCopy.state,
    syncStatus: incCopy.sync_status,
    record: stripUndefinedDeep(incCopy),
    updatedAt: serverTimestamp(),
  });

  // Update consultation package if present
  const pkg = buildConsultationQueueItem(incCopy, incCopy.sync_status);
  const { packageId, payload: pkgPayload } = buildConsultationPayload(uid, pkg);
  const consultRef = doc(db, "users", uid, "consultations", packageId);
  let consultExists = false;
  try {
    const existingConsult = await getDoc(consultRef);
    consultExists = existingConsult.exists();
  } catch {
    consultExists = false;
  }

  if (consultExists) {
    batch.update(consultRef, {
      syncStatus: pkg.sync_status,
      markdownReport: pkgPayload.markdownReport,
      questions: pkgPayload.questions,
      item: pkgPayload.item,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(consultRef, pkgPayload);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/incidents/${incidentId}`);
  }

  return {
    ok: true,
    message: `Alert updated (${note}) and saved to cloud storage.`,
  };
}

export async function generateReportInCloud(
  uidRaw: string,
  incident: IncidentRecord
): Promise<{ ok: boolean; message: string }> {
  const uid = sanitizeId(uidRaw);
  const pkg = buildConsultationQueueItem(incident, "PENDING");
  const { packageId, payload } = buildConsultationPayload(uid, pkg);
  const consultRef = doc(db, "users", uid, "consultations", packageId);

  try {
    const snap = await getDoc(consultRef);
    if (snap.exists()) {
      await updateDoc(consultRef, {
        syncStatus: pkg.sync_status,
        markdownReport: payload.markdownReport,
        questions: payload.questions,
        item: payload.item,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(consultRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/consultations/${packageId}`);
  }

  return {
    ok: true,
    message: `Saved doctor report (${packageId}) to your private cloud queue.`,
  };
}

export async function syncReportsInCloud(
  uidRaw: string,
  earthWanConnected: boolean,
  queue: ConsultationQueueItem[],
  incidents: IncidentRecord[]
): Promise<{ ok: boolean; message: string }> {
  const uid = sanitizeId(uidRaw);
  const now = new Date().toISOString();
  const batch = writeBatch(db);

  if (!earthWanConnected) {
    for (const item of queue) {
      const nextStatus: SyncStatus = item.sync_status === "SYNCED" ? "SYNCED" : "ERROR";
      const updatedItem: ConsultationQueueItem = {
        ...item,
        sync_status: nextStatus,
        last_attempt_at: now,
        error_message:
          "Earth connection is offline. Report remains safely stored in your cloud queue.",
      };
      const packageId = sanitizeId(item.package_id);
      batch.update(doc(db, "users", uid, "consultations", packageId), {
        syncStatus: nextStatus,
        lastAttemptAt: now,
        errorMessage: updatedItem.error_message,
        item: stripUndefinedDeep(updatedItem),
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/consultations`);
    }
    return {
      ok: false,
      message: "Earth link is currently offline. Your report is safely saved and will sync once back online.",
    };
  }

  for (const item of queue) {
    const updatedItem: ConsultationQueueItem = {
      ...item,
      sync_status: "SYNCED",
      last_attempt_at: now,
      error_message: null,
    };
    const packageId = sanitizeId(item.package_id);
    batch.update(doc(db, "users", uid, "consultations", packageId), {
      syncStatus: "SYNCED",
      lastAttemptAt: now,
      errorMessage: "",
      item: stripUndefinedDeep(updatedItem),
      updatedAt: serverTimestamp(),
    });
  }

  for (const inc of incidents) {
    if (inc.state !== "CLOSED_RETAINED") {
      const updatedInc: IncidentRecord = { ...inc, sync_status: "SYNCED" };
      const incidentId = sanitizeId(inc.incident_id);
      batch.update(doc(db, "users", uid, "incidents", incidentId), {
        state: updatedInc.state,
        syncStatus: "SYNCED",
        record: stripUndefinedDeep(updatedInc),
        updatedAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/consultations`);
  }

  return {
    ok: true,
    message: "Earth link active — all queued reports marked Synced. Your private records remain stored.",
  };
}

export async function updateWorkspaceSettingsInCloud(
  uidRaw: string,
  currentWs: WorkspaceProfileDoc,
  updates: Partial<{
    astronautName: string;
    missionName: string;
    earthWanConnected: boolean;
    dataSourceMode: DataSourceType;
    optionalLlmEnabled: boolean;
    operatorRole: ActorRole;
  }>
): Promise<{ ok: boolean; message: string }> {
  const uid = sanitizeId(uidRaw);
  const nextPayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.astronautName !== undefined) {
    nextPayload.astronautName = updates.astronautName.trim().slice(0, 100) || currentWs.astronautName;
  }
  if (updates.missionName !== undefined) {
    nextPayload.missionName = updates.missionName.trim().slice(0, 140) || currentWs.missionName;
  }
  if (updates.earthWanConnected !== undefined) {
    nextPayload.earthWanConnected = updates.earthWanConnected;
  }
  if (updates.dataSourceMode !== undefined) {
    nextPayload.dataSourceMode = updates.dataSourceMode;
  }
  if (updates.optionalLlmEnabled !== undefined) {
    nextPayload.optionalLlmEnabled = updates.optionalLlmEnabled;
  }
  if (updates.operatorRole !== undefined) {
    nextPayload.operatorRole = updates.operatorRole;
  }

  try {
    await updateDoc(doc(db, "users", uid), nextPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }

  return {
    ok: true,
    message: "Settings saved to your private cloud workspace.",
  };
}

export async function createSnapshotInCloud(
  uidRaw: string,
  reason: string,
  counts: { observations: number; incidents: number; reports: number }
): Promise<{ ok: boolean; message: string }> {
  const uid = sanitizeId(uidRaw);
  const now = new Date();
  const iso = now.toISOString();
  const compact = iso.replace(/[-:]/g, "").slice(0, 15) + "Z";
  const snapshotId = sanitizeId(`SNAP_${Date.now()}`);
  const filename = `aegis_memory_${compact}.json`;

  try {
    await setDoc(doc(db, "users", uid, "snapshots", snapshotId), {
      ownerId: uid,
      snapshotId,
      filename,
      reason: reason.slice(0, 200),
      observationCount: counts.observations,
      incidentCount: counts.incidents,
      reportCount: counts.reports,
      checksum: sha256Hex(JSON.stringify({ uid, iso, reason, counts })),
      createdAtIso: iso,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${uid}/snapshots/${snapshotId}`);
  }

  return {
    ok: true,
    message: `Saved cloud memory snapshot (${filename}).`,
  };
}

export async function deleteSnapshotInCloud(
  uidRaw: string,
  snapshotId: string
): Promise<void> {
  const uid = sanitizeId(uidRaw);
  const cleanId = sanitizeId(snapshotId);
  try {
    await deleteDoc(doc(db, "users", uid, "snapshots", cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}/snapshots/${cleanId}`);
  }
}

export async function recordVerifiedDeviceObservationInCloud(
  uidRaw: string,
  crewId: string,
  bpm: number,
  deviceLabel: string,
  options?: {
    existingObservations?: TelemetryObservation[];
    existingIncidents?: IncidentRecord[];
    baseline?: BaselineProfile;
    optionalLlmEnabled?: boolean;
    earthWanConnected?: boolean;
  }
): Promise<{ ok: boolean; message: string }> {
  const uid = sanitizeId(uidRaw);
  const now = new Date();
  const obs: TelemetryObservation = {
    observation_id: `OBS_DEV_${Date.now().toString().slice(-7)}`,
    astronaut_id: crewId.slice(0, 64),
    timestamp: now.toISOString(),
    parameter: "heart_rate_bpm",
    value: bpm,
    unit: "bpm",
    source_type: "VERIFIED_DEVICE",
    device_id: deviceLabel.slice(0, 64),
    device_hmac_verified: true,
    info_label: "MEASURED",
    quality_status: "VALID",
    quality_notes: `Signed hardware reading accepted from ${deviceLabel}`,
    is_quarantined: false,
  };
  const { obsId, payload } = buildObservationPayload(uid, obs);
  const batch = writeBatch(db);
  batch.set(doc(db, "users", uid, "observations", obsId), payload);

  let newIncidentsCreated = 0;
  if (options?.existingObservations && options?.existingIncidents && options?.baseline) {
    const allObs = [...options.existingObservations, obs];
    const findings = evaluateTelemetryWindow(allObs, options.baseline);
    const openRuleIds = new Set(
      options.existingIncidents
        .filter((i) => i.state !== "CLOSED_RETAINED")
        .map((i) => i.rule_id)
    );
    for (const finding of findings) {
      if (!openRuleIds.has(finding.rule_id)) {
        const newInc = buildIncidentFromFinding(
          finding,
          allObs,
          options.baseline,
          options.optionalLlmEnabled ?? false,
          options.earthWanConnected ?? true
        );
        const { incidentId, payload: incPayload } = buildIncidentPayload(uid, newInc);
        batch.set(doc(db, "users", uid, "incidents", incidentId), incPayload);
        openRuleIds.add(finding.rule_id);
        newIncidentsCreated += 1;
      }
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${uid}/observations/${obsId}`);
  }
  return {
    ok: true,
    message: `Recorded signed heart rate (${bpm} bpm) from ${deviceLabel}.${
      newIncidentsCreated > 0 ? ` Raised ${newIncidentsCreated} new alert(s).` : ""
    }`,
  };
}

export async function generateBaseHealthReportInCloud(
  uidRaw: string,
  input: {
    workspace: WorkspaceProfileDoc;
    baseline: BaselineProfile;
    latest: TelemetryLatestResponse;
    incidents: IncidentRecord[];
    opsState: OpsStateDoc;
    environmentMode: MissionEnvironmentId;
    extendedBio: ExtendedBioSummary | null;
    voiceMemoCount: number;
    scanCount: number;
    baseDestination: string;
    crewNote?: string;
    transmitNow: boolean;
  }
): Promise<{ ok: boolean; message: string; packageId: string }> {
  const uid = sanitizeId(uidRaw);
  const nowIso = new Date().toISOString();
  const packageId = sanitizeId(`BASE_RPT_${Date.now()}`);
  const envMeta = MISSION_ENVIRONMENT_META[input.environmentMode];
  const lightMeta = LIGHT_DELAY_META[input.opsState.lightDelayMode];

  const openIncidents = input.incidents.filter((i) => i.state !== "CLOSED_RETAINED");
  const primaryIncident = openIncidents[0] || input.incidents[0];
  const incidentIdRef = sanitizeId(primaryIncident?.incident_id || "BASE_ROUTINE_CHECK");

  const drifting: string[] = [];
  const metricLines: string[] = [];
  let normalCount = 0;

  for (const param of ALL_18_PARAMETERS) {
    const comp = input.latest.baseline_comparisons[param];
    const meta = PARAMETER_METADATA[param];
    const band = input.baseline.metrics[param];
    if (!comp || !meta || !band) continue;
    const valStr = `${comp.current_value.toFixed(meta.decimals)} ${meta.unit}`;
    const bandStr = `${band.p05}–${band.p95} ${meta.unit}`;
    if (comp.outside_p05_p95_band) {
      drifting.push(`${meta.label} (${valStr}, z=${comp.z_score.toFixed(1)}σ)`);
      metricLines.push(`- **${meta.label}**: \`${valStr}\` — OUTSIDE personal range [${bandStr}]`);
    } else {
      normalCount += 1;
      metricLines.push(`- **${meta.label}**: \`${valStr}\` — Normal [${bandStr}]`);
    }
  }

  let extendedAlerts = 0;
  const glucose = input.extendedBio?.bloodGlucoseMgDl;
  const coreTemp = input.extendedBio?.coreTempC;
  if (
    glucose !== undefined &&
    (glucose < EXTENDED_BIO_BANDS.bloodGlucoseMgDl.p05 ||
      glucose > EXTENDED_BIO_BANDS.bloodGlucoseMgDl.p95)
  ) {
    extendedAlerts += 1;
    drifting.push(`Blood Sugar (${glucose.toFixed(0)} mg/dL)`);
  }
  if (
    coreTemp !== undefined &&
    (coreTemp < EXTENDED_BIO_BANDS.coreTempC.p05 ||
      coreTemp > EXTENDED_BIO_BANDS.coreTempC.p95)
  ) {
    extendedAlerts += 1;
    drifting.push(`Core Body Temp (${coreTemp.toFixed(1)} °C)`);
  }

  const hasHighAlert = openIncidents.some((i) => i.severity === "HIGH");
  const readinessVerdict =
    hasHighAlert || input.opsState.solarStormActive || drifting.length >= 3
      ? "MEDICAL REVIEW RECOMMENDED — BASE CONSULTATION"
      : openIncidents.length > 0 || drifting.length > 0 || extendedAlerts > 0
      ? "ADVISORY WATCH — MONITOR & HYDRATE"
      : "NOMINAL — FIT FOR MISSION DUTY";

  const canTransmit = input.transmitNow && input.workspace.earthWanConnected;
  const syncStatus: SyncStatus = canTransmit ? "SYNCED" : "PENDING";

  const questions: string[] =
    drifting.length > 0 || openIncidents.length > 0
      ? [
          `1. Astronaut ${input.workspace.astronautName} presents ${drifting.length} parameter(s) outside 14-day personal P05–P95 range (${drifting.slice(0, 3).join("; ")}); please confirm whether duty modifications are advised at ${envMeta.shortLabel}.`,
          `2. Cumulative radiation dose is ${input.opsState.cumulativeRadiationMsv.toFixed(1)} mSv (solar storm active: ${input.opsState.solarStormActive ? "YES" : "NO"}); confirm current ALARA shielding schedule.`,
          `3. ${input.voiceMemoCount} audio check-in memo(s) and ${input.scanCount} diagnostic capture(s) are logged onboard; advise if additional ultrasound/OCT views are needed for Base Flight Surgeon review.`,
        ]
      : [
          `1. Routine Astronaut-to-Base health report confirms ${normalCount}/${ALL_18_PARAMETERS.length} telemetry metrics within personal P05–P95 range; request Base confirmation for standard EVA/ARED duty clearance.`,
          `2. Cumulative mission radiation stands at ${input.opsState.cumulativeRadiationMsv.toFixed(1)} / 600 mSv with ECLSS CO2 scrubber at ${input.opsState.eclss.scrubberBedPct}%; confirm next scheduled Earth medical check-in.`,
        ];

  const trimmedNote = (input.crewNote || "").trim().slice(0, 600);
  const markdownReport = `# AEGIS-V ASTRONAUT HEALTH REPORT TO BASE (${packageId})
> **PROTOTYPE SAFETY NOTICE:** ${PROTOTYPE_DISCLAIMER}
> **Schema Version:** \`${SCHEMA_VERSION}\`

## 1. Mission & Base Transmission Summary
- **Receiving Base:** ${input.baseDestination}
- **Astronaut:** ${input.workspace.astronautName} (\`${input.baseline.astronaut_id}\`)
- **Mission / Habitat:** ${input.workspace.missionName} (${envMeta.label} · ${envMeta.gravityLabel})
- **Earth / Base Signal Delay:** ${lightMeta.label} (${lightMeta.roundTripText})
- **Generated At:** ${nowIso}
- **Transmission Status:** \`${syncStatus}\` (${input.workspace.earthWanConnected ? "Base link online" : "Base link offline — queued safely"})
- **Overall Crew Readiness:** **${readinessVerdict}**

## 2. Astronaut Self-Check & Status Summary
- **Baseline Check:** \`${normalCount} / ${ALL_18_PARAMETERS.length}\` parameters within 14-day personal normal band.
- **Open Alerts:** ${openIncidents.length > 0 ? openIncidents.map((i) => `${i.title} (${i.state})`).join("; ") : "None — all clear"}
- **Astronaut Note to Base:** ${trimmedNote || "No acute symptoms reported; routine self-monitoring complete."}

## 3. Extended Biometrics & Onboard Diagnostics
- **Blood Sugar (Glucose):** ${glucose !== undefined ? `${glucose.toFixed(0)} mg/dL (normal 70–115 mg/dL)` : "Not logged yet"}
- **Core Body Temperature:** ${coreTemp !== undefined ? `${coreTemp.toFixed(1)} °C (normal 36.3–37.4 °C)` : "Not logged yet"}
- **Saved Voice Observation Memos:** ${input.voiceMemoCount}
- **Saved Diagnostic Camera / Ultrasound Scans:** ${input.scanCount}

## 4. Cabin Life Support (ECLSS) & Radiation Exposure
- **Cumulative Mission Radiation Dose:** ${input.opsState.cumulativeRadiationMsv.toFixed(1)} / 600 mSv
- **Solar Particle Event Alert:** ${input.opsState.solarStormActive ? "ACTIVE — Shelter Protocol" : "Nominal"}
- **Cabin ppO2 / Pressure:** ${input.opsState.eclss.ppO2MmHg.toFixed(1)} mmHg · ${input.opsState.eclss.cabinPressureKpa.toFixed(1)} kPa
- **CO2 Scrubber Bed / Trace CO:** ${input.opsState.eclss.scrubberBedPct}% remaining · ${input.opsState.eclss.traceCoPpm.toFixed(1)} ppm
- **Cabin Temp / Humidity:** ${input.opsState.eclss.cabinTempC.toFixed(1)} °C · ${input.opsState.eclss.relativeHumidityPct.toFixed(0)}% RH

## 5. Complete 18-Parameter Personal Baseline Readout
${metricLines.join("\n")}

## 6. Questions for Base Flight Surgeon
${questions.join("\n")}
`.slice(0, 15900);

  const fallbackIncident = primaryIncident || buildDemoIncidents("SCENE_1_NORMAL", [], false)[0];
  const basePackage: ConsultationQueueItem = {
    package_id: packageId,
    incident_id: incidentIdRef,
    created_at: nowIso,
    sync_status: syncStatus,
    last_attempt_at: canTransmit ? nowIso : null,
    error_message: canTransmit
      ? `Delivered to ${input.baseDestination}.`
      : "Base communication link offline or deferred — queued safely for downlink.",
    payload: {
      prototype_notice:
        "ASTRONAUT-TO-BASE HEALTH REPORT · PROTOTYPE DECISION SUPPORT",
      schema_version: SCHEMA_VERSION,
      generated_at: nowIso,
      astronaut_profile: {
        astronaut_id: input.baseline.astronaut_id,
        full_name: input.workspace.astronautName,
        mission: `${input.workspace.missionName} → ${input.baseDestination}`,
        role: input.workspace.operatorRole,
      },
      baseline_profile: input.baseline,
      incident_summary: {
        incident_id: incidentIdRef,
        title: `Base Health Report — ${readinessVerdict}`,
        rule_id: fallbackIncident?.rule_id || "RULE-DATA-QUALITY-04",
        severity: hasHighAlert ? "HIGH" : drifting.length > 0 ? "MODERATE" : "ADVISORY",
        state: primaryIncident?.state || "CLOSED_RETAINED",
        created_at: nowIso,
        updated_at: nowIso,
        authorized_action: `Transmitted to ${input.baseDestination}`,
        procedure_reference: "BASE-HEALTH-DOWNLINK",
        post_action_direction: primaryIncident?.post_action_direction ?? null,
      },
      contributing_observations: Object.values(input.latest.latest_by_parameter).slice(0, 8),
      data_quality_summary: {
        normalCount,
        totalParameters: ALL_18_PARAMETERS.length,
        driftingParameters: drifting,
        readinessVerdict,
      },
      explanation: fallbackIncident?.explanation || {
        rule_id: "RULE-DATA-QUALITY-04",
        threshold_authority: "PROTOTYPE_DEMO_RULE_NOT_CLINICAL_STANDARD",
        prototype_disclaimer: PROTOTYPE_DISCLAIMER,
        evidence_block: [],
        comparison_block: {},
        context_block: { environment: envMeta.label, baseDestination: input.baseDestination },
        reasoning_block: { summary: readinessVerdict },
        data_quality_block: {},
        uncertainty_block: PROTOTYPE_DISCLAIMER,
        references_block: [],
        ai_narrative_summary: {
          text: readinessVerdict,
          mode: "TEMPLATE_OFFLINE",
          info_label: "AI_ASSISTED",
          disclaimer: PROTOTYPE_DISCLAIMER,
        },
      },
      post_action_comparisons: primaryIncident?.post_action_comparisons || {},
      audit_log: primaryIncident?.audit_log || [],
      flight_surgeon_questions: questions,
      markdown_report: markdownReport,
    },
  };

  const { payload } = buildConsultationPayload(uid, basePackage);
  try {
    await setDoc(doc(db, "users", uid, "consultations", packageId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${uid}/consultations/${packageId}`);
  }

  return {
    ok: true,
    packageId,
    message: canTransmit
      ? `Astronaut health report (${packageId}) generated and transmitted to ${input.baseDestination}.`
      : `Astronaut health report (${packageId}) saved and queued for ${input.baseDestination}.`,
  };
}

export async function saveEarthHandoffPackageInCloud(
  uidRaw: string,
  pkgItem: ConsultationQueueItem
): Promise<{ ok: boolean; packageId: string; message: string }> {
  const uid = sanitizeId(uidRaw);
  const { packageId, payload } = buildConsultationPayload(uid, pkgItem);
  const consultRef = doc(db, "users", uid, "consultations", packageId);
  try {
    const snap = await getDoc(consultRef);
    if (snap.exists()) {
      await updateDoc(consultRef, {
        syncStatus: pkgItem.sync_status,
        markdownReport: payload.markdownReport,
        questions: payload.questions,
        item: payload.item,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(consultRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/consultations/${packageId}`);
  }
  return {
    ok: true,
    packageId,
    message: `Earth Handoff Package (${packageId}) saved to local/cloud queue with status ${pkgItem.sync_status}.`,
  };
}


