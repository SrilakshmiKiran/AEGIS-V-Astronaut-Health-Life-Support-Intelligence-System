import {
  ALL_18_PARAMETERS,
  ActorRole,
  AUTHORIZED_PROTOTYPE_PROCEDURES,
  BaselineComparison,
  BaselineProfile,
  ConsultationQueueItem,
  DataSourceType,
  DemoSceneId,
  DeterministicFinding,
  IncidentRecord,
  IncidentState,
  KnowledgeResource,
  NavigationTabId,
  NutritionCatalogueItem,
  ParameterName,
  QualityStatus,
  SCHEMA_VERSION,
  SimulatorStatusResponse,
  SyncStatus,
  SystemHealthResponse,
  TelemetryHistoryResponse,
  TelemetryLatestResponse,
  TelemetryObservation,
} from "../types/aegisContracts";
import {
  CURATED_NASA_CSA_RESOURCES,
  NUTRITION_CATALOGUE,
  SEEDED_BASELINE_PROFILE,
  buildConsultationQueueItem,
  buildDemoIncidents,
  buildSceneObservations,
} from "../mocks/cloudPreviewFixtures";
import {
  compareToBaseline,
  computeAuditEntryHash,
  deriveOverallPostActionDirection,
  evaluatePostResponseTrend,
  evaluateTelemetryWindow,
  retrieveRelevantResources,
  validateRoleAndPin,
} from "../utils/aegisPureEngine";

export type BackendConnectionMode = "LIVE_LOCAL_BACKEND" | "CLOUD_SANDBOX_FIXTURE_PREVIEW";

export interface OperatorSession {
  actorId: string;
  actorRole: ActorRole | null; // null when testing unauthenticated 401 behavior
  authPin: string;
}

const API_BASE_URL = "http://127.0.0.1:8000/api";

// Ephemeral in-memory state for Cloud Preview Fallback (NEVER persisted to localStorage or IndexedDB)
interface InMemoryPreviewState {
  activeScene: DemoSceneId;
  earthWanConnected: boolean;
  optionalLlmEnabled: boolean;
  dataSourceMode: DataSourceType;
  observations: TelemetryObservation[];
  incidents: IncidentRecord[];
  consultationQueue: ConsultationQueueItem[];
  backups: Array<{
    backup_id: string;
    filename: string;
    created_at: string;
    reason: string;
    sha256_checksum: string;
  }>;
}

const initialScene: DemoSceneId = "SCENE_2_GRADUAL_ANOMALY";
const initialObservations = buildSceneObservations(initialScene);
const initialIncidents = buildDemoIncidents(initialScene, initialObservations, false);

const memoryState: InMemoryPreviewState = {
  activeScene: initialScene,
  earthWanConnected: true,
  optionalLlmEnabled: false,
  dataSourceMode: "SIMULATED",
  observations: initialObservations,
  incidents: initialIncidents,
  consultationQueue:
    initialIncidents.length > 0
      ? [buildConsultationQueueItem(initialIncidents[0], "PENDING")]
      : [],
  backups: [
    {
      backup_id: "BKP-INIT-001",
      filename: "aegis_v_backup_20261114T120000Z.db",
      created_at: "2026-11-14T12:00:00Z",
      reason: "startup_wal_checkpoint_verified",
      sha256_checksum: "8f93b42a10c7e65d9182f34b76c01d23e45f6789a01b23c45d67e89f01a23b45",
    },
  ],
};

let currentConnectionMode: BackendConnectionMode = "CLOUD_SANDBOX_FIXTURE_PREVIEW";
let localBackendProbeFailed = false;

export function getConnectionMode(): BackendConnectionMode {
  return currentConnectionMode;
}

function shouldAttemptLocalBackend(): boolean {
  if (localBackendProbeFailed) return false;
  if (typeof window === "undefined") return false;
  const { hostname, port } = window.location;
  // Auto-connect to 127.0.0.1:8000 when running on local Vite dev (:5173) or PWA preview (:4173)
  return (hostname === "127.0.0.1" || hostname === "localhost") && (port === "5173" || port === "4173");
}

function buildHeaders(operator: OperatorSession): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (operator.actorRole) {
    headers["X-AEGIS-Actor-Id"] = operator.actorId;
    headers["X-AEGIS-Actor-Role"] = operator.actorRole;
  }
  if (operator.authPin) {
    headers["X-AEGIS-Auth-Pin"] = operator.authPin;
  }
  return headers;
}

async function tryFetchLocalBackend<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 450
): Promise<{ ok: true; data: T } | { ok: false; status?: number; errorText?: string }> {
  if (!shouldAttemptLocalBackend()) {
    currentConnectionMode = "CLOUD_SANDBOX_FIXTURE_PREVIEW";
    return { ok: false };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const errBody = await res.text().catch(() => res.statusText);
      currentConnectionMode = "LIVE_LOCAL_BACKEND";
      return { ok: false, status: res.status, errorText: errBody };
    }
    const data = (await res.json()) as T;
    currentConnectionMode = "LIVE_LOCAL_BACKEND";
    return { ok: true, data };
  } catch {
    clearTimeout(timer);
    localBackendProbeFailed = true;
    currentConnectionMode = "CLOUD_SANDBOX_FIXTURE_PREVIEW";
    return { ok: false };
  }
}

export async function fetchSystemHealth(): Promise<SystemHealthResponse> {
  const live = await tryFetchLocalBackend<SystemHealthResponse>("/health");
  if (live.ok) return live.data;

  return {
    onboard_node_status: "CLOUD_SANDBOX_FIXTURE_PREVIEW (127.0.0.1:8000 Unreachable)",
    earth_wan_connected: memoryState.earthWanConnected,
    active_scene: memoryState.activeScene,
    optional_llm_enabled: memoryState.optionalLlmEnabled,
    wal_mode_active: true,
    audit_chain_valid: true,
    db_counts: {
      system_state: 4,
      verified_hardware_registry: 1,
      astronaut_profiles: 1,
      telemetry_observations: memoryState.observations.length,
      incidents: memoryState.incidents.length,
      incident_audit_log: memoryState.incidents.reduce((acc, i) => acc + i.audit_log.length, 0),
      knowledge_resources: CURATED_NASA_CSA_RESOURCES.length,
      sync_export_queue: memoryState.consultationQueue.length,
    },
    schema_version: SCHEMA_VERSION,
  };
}

export async function fetchBaselineProfile(): Promise<BaselineProfile> {
  const live = await tryFetchLocalBackend<BaselineProfile>(
    "/profile/baseline?astronaut_id=AST-01-COMMANDER"
  );
  if (live.ok) return live.data;
  return SEEDED_BASELINE_PROFILE;
}

export async function fetchTelemetryLatest(): Promise<TelemetryLatestResponse> {
  const live = await tryFetchLocalBackend<TelemetryLatestResponse>(
    "/telemetry/latest?astronaut_id=AST-01-COMMANDER"
  );
  if (live.ok) return live.data;

  const latestByParameter = {} as Record<ParameterName, TelemetryObservation>;
  const baselineComparisons = {} as Record<ParameterName, BaselineComparison>;

  ALL_18_PARAMETERS.forEach((param) => {
    const validForParam = memoryState.observations.filter(
      (o) => o.parameter === param && !o.is_quarantined && o.quality_status !== "STALE"
    );
    const fallbackAll = memoryState.observations.filter((o) => o.parameter === param);
    const chosen =
      validForParam.length > 0
        ? validForParam[validForParam.length - 1]
        : fallbackAll[fallbackAll.length - 1];
    if (chosen) {
      latestByParameter[param] = chosen;
      baselineComparisons[param] = compareToBaseline(chosen, SEEDED_BASELINE_PROFILE);
    }
  });

  const qualityCounts: Record<QualityStatus, number> = {
    VALID: memoryState.observations.filter((o) => o.quality_status === "VALID").length,
    ESTIMATED: memoryState.observations.filter((o) => o.quality_status === "ESTIMATED").length,
    MISSING: memoryState.observations.filter((o) => o.quality_status === "MISSING").length,
    STALE: memoryState.observations.filter((o) => o.quality_status === "STALE").length,
    IMPOSSIBLE: memoryState.observations.filter((o) => o.quality_status === "IMPOSSIBLE").length,
    CORRUPTED: memoryState.observations.filter((o) => o.quality_status === "CORRUPTED").length,
  };

  const quarantinedRecent = memoryState.observations.filter(
    (o) =>
      o.is_quarantined ||
      o.quality_status === "STALE" ||
      o.quality_status === "MISSING" ||
      o.quality_status === "IMPOSSIBLE" ||
      o.quality_status === "CORRUPTED"
  );

  return {
    astronaut_id: "AST-01-COMMANDER",
    as_of_timestamp: new Date().toISOString(),
    latest_by_parameter: latestByParameter,
    baseline_comparisons: baselineComparisons,
    quality_counts: qualityCounts,
    quarantined_recent: quarantinedRecent,
  };
}

export async function fetchTelemetryHistory(
  parameter: ParameterName,
  includeQuarantined = false
): Promise<TelemetryHistoryResponse> {
  const live = await tryFetchLocalBackend<TelemetryHistoryResponse>(
    `/telemetry/history?astronaut_id=AST-01-COMMANDER&parameter=${parameter}&limit=100&include_quarantined=${includeQuarantined}`
  );
  if (live.ok) return live.data;

  const metric = SEEDED_BASELINE_PROFILE.metrics[parameter];
  const filtered = memoryState.observations
    .filter(
      (o) =>
        o.parameter === parameter &&
        (includeQuarantined || (!o.is_quarantined && o.quality_status !== "STALE"))
    )
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return {
    parameter,
    unit: metric.unit,
    baseline_metric: metric,
    observations: filtered,
  };
}

export async function fetchIncidents(operator: OperatorSession): Promise<IncidentRecord[]> {
  const live = await tryFetchLocalBackend<IncidentRecord[]>(
    "/incidents?astronaut_id=AST-01-COMMANDER",
    { headers: buildHeaders(operator) }
  );
  if (live.ok) return live.data;
  return memoryState.incidents;
}

export async function fetchLibraryResources(
  topicTag?: string,
  query?: string
): Promise<KnowledgeResource[]> {
  const params = new URLSearchParams();
  if (topicTag && topicTag !== "ALL") params.set("topic_tag", topicTag);
  if (query) params.set("q", query);
  const live = await tryFetchLocalBackend<KnowledgeResource[]>(
    `/library/resources?${params.toString()}`
  );
  if (live.ok) return live.data;

  return retrieveRelevantResources(
    CURATED_NASA_CSA_RESOURCES,
    topicTag && topicTag !== "ALL" ? [topicTag] : undefined,
    query
  );
}

export async function fetchNutritionCatalogue(): Promise<NutritionCatalogueItem[]> {
  const live = await tryFetchLocalBackend<NutritionCatalogueItem[]>("/nutrition/catalogue");
  if (live.ok) return live.data;
  return NUTRITION_CATALOGUE;
}

export async function fetchConsultationQueue(): Promise<ConsultationQueueItem[]> {
  const live = await tryFetchLocalBackend<ConsultationQueueItem[]>("/consultation/queue");
  if (live.ok) return live.data;
  return memoryState.consultationQueue;
}

export async function fetchSimulatorStatus(): Promise<SimulatorStatusResponse> {
  const live = await tryFetchLocalBackend<SimulatorStatusResponse>("/simulator/status");
  if (live.ok) return live.data;

  return {
    active_scene: memoryState.activeScene,
    earth_wan_connected: memoryState.earthWanConnected,
    optional_llm_enabled: memoryState.optionalLlmEnabled,
    data_source_mode: memoryState.dataSourceMode,
    total_observations: memoryState.observations.length,
    quarantined_observations: memoryState.observations.filter((o) => o.is_quarantined).length,
  };
}

export async function fetchAuditIntegrity(): Promise<{
  chain_valid: boolean;
  entry_count: number;
  latest_hash: string;
  wal_mode_active: boolean;
  triggers_active: boolean;
}> {
  const live = await tryFetchLocalBackend<{
    chain_valid: boolean;
    entry_count: number;
    latest_hash: string;
    wal_mode_active: boolean;
    triggers_active: boolean;
  }>("/system/audit-integrity");
  if (live.ok) return live.data;

  const allLogs = memoryState.incidents.flatMap((i) => i.audit_log);
  return {
    chain_valid: true,
    entry_count: allLogs.length,
    latest_hash:
      allLogs.length > 0
        ? allLogs[allLogs.length - 1].entry_hash
        : "0000000000000000000000000000000000000000000000000000000000000000",
    wal_mode_active: true,
    triggers_active: true,
  };
}

export async function fetchSystemBackups(): Promise<
  Array<{
    backup_id: string;
    filename: string;
    created_at: string;
    reason: string;
    sha256_checksum: string;
  }>
> {
  const live = await tryFetchLocalBackend<
    Array<{
      backup_id: string;
      filename: string;
      created_at: string;
      reason: string;
      sha256_checksum: string;
    }>
  >("/system/backups");
  if (live.ok) return live.data;
  return memoryState.backups;
}

export async function activateDemoScene(
  sceneId: DemoSceneId,
  operator: OperatorSession
): Promise<{
  ok: boolean;
  status: number;
  message: string;
  recommendedRoute?: NavigationTabId;
  activeScene?: DemoSceneId;
}> {
  // Enforce RBAC policy matching Backend Step 5
  const requiresPin =
    sceneId === "SCENE_5_RESPONSE_FOLLOWUP" || sceneId === "SCENE_6_CONNECTIVITY_RESTORED";
  const allowedRoles: ActorRole[] = requiresPin
    ? ["CREW_MEDICAL_OFFICER"]
    : ["CREW_MEDICAL_OFFICER", "CREW_MEMBER"];

  const authCheck = validateRoleAndPin(
    operator.actorRole,
    operator.authPin,
    allowedRoles,
    requiresPin
  );
  if (!authCheck.authorized) {
    return {
      ok: false,
      status: authCheck.status,
      message: authCheck.message,
    };
  }

  const live = await tryFetchLocalBackend<{
    active_scene: DemoSceneId;
    recommended_route: string;
    message?: string;
  }>(`/simulator/activate-scene/${sceneId}`, {
    method: "POST",
    headers: buildHeaders(operator),
  });

  const routeMap: Record<DemoSceneId, NavigationTabId> = {
    SCENE_1_NORMAL: "overview",
    SCENE_2_GRADUAL_ANOMALY: "live-monitor",
    SCENE_3_EXPLAIN: "incident-detail",
    SCENE_4_EARTH_UNAVAILABLE: "library",
    SCENE_5_RESPONSE_FOLLOWUP: "incident-detail",
    SCENE_6_CONNECTIVITY_RESTORED: "consultation",
    SCENE_7_CONTINUITY_CMO_UNAVAILABLE: "incident-detail",
  };

  if (live.ok) {
    return {
      ok: true,
      status: 200,
      message: live.data.message || `Activated ${sceneId} on local FastAPI backend.`,
      recommendedRoute: routeMap[sceneId],
      activeScene: sceneId,
    };
  }

  if (live.status && live.status >= 400) {
    return {
      ok: false,
      status: live.status,
      message: live.errorText || `Backend returned HTTP ${live.status}`,
    };
  }

  // In-memory simulation for Cloud Preview Fallback
  memoryState.activeScene = sceneId;
  memoryState.earthWanConnected = sceneId !== "SCENE_4_EARTH_UNAVAILABLE";
  memoryState.observations = buildSceneObservations(sceneId);
  memoryState.incidents = buildDemoIncidents(
    sceneId,
    memoryState.observations,
    memoryState.optionalLlmEnabled
  );

  if (sceneId === "SCENE_1_NORMAL") {
    memoryState.consultationQueue = [];
  } else if (memoryState.incidents.length > 0) {
    const syncStatus: SyncStatus =
      sceneId === "SCENE_6_CONNECTIVITY_RESTORED" ? "SYNCED" : "PENDING";
    memoryState.consultationQueue = [
      buildConsultationQueueItem(memoryState.incidents[0], syncStatus),
    ];
  }

  return {
    ok: true,
    status: 200,
    message: `[In-Memory Demo Preview — Local FastAPI 127.0.0.1:8000 Unreachable] Transitioned simulator to ${sceneId}.`,
    recommendedRoute: routeMap[sceneId],
    activeScene: sceneId,
  };
}

export async function transitionIncidentState(
  incidentId: string,
  action: "review" | "acknowledge" | "record-response" | "evaluate-followup" | "close",
  operator: OperatorSession,
  payload?: {
    authorized_action?: string;
    procedure_reference?: string;
    closure_notes?: string;
  }
): Promise<{ ok: boolean; status: number; message: string; incident?: IncidentRecord }> {
  const requiresPin =
    action === "acknowledge" || action === "record-response" || action === "close";
  const allowedRoles: ActorRole[] = requiresPin
    ? ["CREW_MEDICAL_OFFICER"]
    : ["CREW_MEDICAL_OFFICER", "CREW_MEMBER"];

  const authCheck = validateRoleAndPin(
    operator.actorRole,
    operator.authPin,
    allowedRoles,
    requiresPin
  );
  if (!authCheck.authorized) {
    return {
      ok: false,
      status: authCheck.status,
      message: authCheck.message,
    };
  }

  const live = await tryFetchLocalBackend<IncidentRecord>(
    `/incidents/${incidentId}/${action}`,
    {
      method: "POST",
      headers: buildHeaders(operator),
      body: payload ? JSON.stringify(payload) : undefined,
    }
  );

  if (live.ok) {
    return {
      ok: true,
      status: 200,
      message: `Incident ${incidentId} transitioned via ${action} on local FastAPI backend.`,
      incident: live.data,
    };
  }

  // Ephemeral in-memory state transition for preview demonstration
  const inc = memoryState.incidents.find((i) => i.incident_id === incidentId);
  if (!inc) {
    return { ok: false, status: 404, message: `Incident ${incidentId} not found.` };
  }

  const now = new Date().toISOString();
  const prevState = inc.state;
  let nextState: IncidentState = inc.state;
  let note = "";

  if (action === "review") {
    nextState = "REVIEWED";
    note = "Reviewed 7-part evidence explanation and personal baseline comparisons.";
  } else if (action === "acknowledge") {
    nextState = "ACKNOWLEDGED";
    inc.acknowledged_by = operator.actorId;
    inc.acknowledged_role = operator.actorRole;
    inc.acknowledged_at = now;
    note = "CMO PIN-authenticated acknowledgment recorded.";
  } else if (action === "record-response") {
    const procCode = payload?.procedure_reference || "PROC-ENV-CO2-01";
    if (!AUTHORIZED_PROTOTYPE_PROCEDURES[procCode]) {
      return {
        ok: false,
        status: 400,
        message: `Invalid procedure code '${procCode}'. Must be in AUTHORIZED_PROTOTYPE_PROCEDURES.`,
      };
    }
    nextState = "MONITORING";
    inc.procedure_reference = procCode;
    inc.authorized_action =
      payload?.authorized_action || AUTHORIZED_PROTOTYPE_PROCEDURES[procCode];
    inc.action_recorded_at = now;
    note = `Recorded authorized prototype response (${procCode}) and transitioned ACKNOWLEDGED → RESPONSE_RECORDED → MONITORING.`;

    // Ensure post-action observations exist in memory so Before/After chart renders immediately
    const hasPost = memoryState.observations.some(
      (o) => o.context_metadata?.phase === "POST_RESPONSE_FOLLOWUP"
    );
    if (!hasPost) {
      memoryState.observations = buildSceneObservations("SCENE_5_RESPONSE_FOLLOWUP");
    }
    const actionTs = new Date(now).getTime();
    (["heart_rate_bpm", "spo2_pct", "respiration_rpm", "cabin_co2_mmhg"] as ParameterName[]).forEach(
      (param) => {
        const pre = memoryState.observations.filter(
          (o) =>
            o.parameter === param &&
            !o.is_quarantined &&
            o.context_metadata?.phase !== "POST_RESPONSE_FOLLOWUP" &&
            new Date(o.timestamp).getTime() <= actionTs
        );
        const post = memoryState.observations.filter(
          (o) =>
            o.parameter === param &&
            !o.is_quarantined &&
            (o.context_metadata?.phase === "POST_RESPONSE_FOLLOWUP" ||
              new Date(o.timestamp).getTime() > actionTs)
        );
        inc.post_action_comparisons[param] = evaluatePostResponseTrend(
          pre,
          post,
          param,
          SEEDED_BASELINE_PROFILE
        );
      }
    );
    inc.post_action_direction = deriveOverallPostActionDirection(inc.post_action_comparisons);
  } else if (action === "evaluate-followup") {
    nextState = "MONITORING";
    const actionTs = inc.action_recorded_at ? new Date(inc.action_recorded_at).getTime() : new Date(now).getTime();
    (["heart_rate_bpm", "spo2_pct", "respiration_rpm", "cabin_co2_mmhg"] as ParameterName[]).forEach(
      (param) => {
        const pre = memoryState.observations.filter(
          (o) =>
            o.parameter === param &&
            !o.is_quarantined &&
            o.context_metadata?.phase !== "POST_RESPONSE_FOLLOWUP" &&
            new Date(o.timestamp).getTime() <= actionTs
        );
        const post = memoryState.observations.filter(
          (o) =>
            o.parameter === param &&
            !o.is_quarantined &&
            (o.context_metadata?.phase === "POST_RESPONSE_FOLLOWUP" ||
              new Date(o.timestamp).getTime() > actionTs)
        );
        inc.post_action_comparisons[param] = evaluatePostResponseTrend(
          pre,
          post,
          param,
          SEEDED_BASELINE_PROFILE
        );
      }
    );
    inc.post_action_direction = deriveOverallPostActionDirection(inc.post_action_comparisons);
    note = `Re-evaluated post-action follow-up readings; computed direction: ${inc.post_action_direction}.`;
  } else if (action === "close") {
    nextState = "CLOSED_RETAINED";
    note =
      payload?.closure_notes ||
      "Post-action recovery trend verified; incident closed and retained in archive.";
  }

  inc.state = nextState;
  inc.updated_at = now;
  const prevHash =
    inc.audit_log.length > 0
      ? inc.audit_log[inc.audit_log.length - 1].entry_hash
      : "0".repeat(64);
  const logId = `AUD-${String(inc.audit_log.length + 1).padStart(3, "0")}`;
  const unsignedEntry = {
    log_id: logId,
    incident_id: inc.incident_id,
    timestamp: now,
    from_state: prevState,
    to_state: nextState,
    actor_id: operator.actorId,
    actor_role: operator.actorRole || "CREW_MEDICAL_OFFICER",
    notes: note,
    prev_hash: prevHash,
  };
  const newHash = computeAuditEntryHash(unsignedEntry);

  inc.audit_log.push({
    ...unsignedEntry,
    entry_hash: newHash,
  });

  inc.replay_timeline.push({
    step: inc.replay_timeline.length + 1,
    timestamp: now,
    event_type: `INCIDENT_STATE_${nextState}`,
    label: "COMPUTED",
    state: nextState,
    title: `State Transition: ${prevState} → ${nextState} (${operator.actorId})`,
    detail: note,
  });

  memoryState.consultationQueue = [buildConsultationQueueItem(inc, inc.sync_status)];

  return {
    ok: true,
    status: 200,
    message: `[In-Memory Demo Preview] Transitioned ${incidentId} from ${prevState} to ${nextState}.`,
    incident: { ...inc },
  };
}

export async function submitHrpCheckin(
  entries: Array<{
    parameter: ParameterName;
    value: number;
    quality_status?: QualityStatus;
    notes?: string;
  }>,
  operator: OperatorSession
): Promise<{
  ok: boolean;
  status: number;
  message: string;
  triggeredRules?: DeterministicFinding[];
}> {
  const includesIop = entries.some((e) => e.parameter === "intraocular_pressure_mmhg");
  const allowedRoles: ActorRole[] = includesIop
    ? ["CREW_MEDICAL_OFFICER"]
    : ["CREW_MEDICAL_OFFICER", "CREW_MEMBER"];

  const authCheck = validateRoleAndPin(
    operator.actorRole,
    operator.authPin,
    allowedRoles,
    includesIop
  );
  if (!authCheck.authorized) {
    return {
      ok: false,
      status: authCheck.status,
      message: authCheck.message,
    };
  }

  const now = new Date().toISOString();
  const newObs: TelemetryObservation[] = entries.map((e, idx) => {
    const metric = SEEDED_BASELINE_PROFILE.metrics[e.parameter];
    return {
      observation_id: `OBS-CHK-${Date.now()}-${idx}`,
      astronaut_id: "AST-01-COMMANDER",
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
      quality_notes: e.notes || "Manual crew HRP check-in entry",
      reference_target: metric.authorized_target ?? null,
      context_metadata: { manual_entry_by: operator.actorId },
      is_quarantined: false,
    };
  });

  const live = await tryFetchLocalBackend<{ triggered_rules?: DeterministicFinding[] }>(
    "/checkins/log",
    {
      method: "POST",
      headers: buildHeaders(operator),
      body: JSON.stringify({ observations: newObs }),
    }
  );

  if (live.ok) {
    return {
      ok: true,
      status: 200,
      message: `Logged ${newObs.length} HRP check-in parameter(s) to local FastAPI SQLite.`,
      triggeredRules: live.data.triggered_rules,
    };
  }

  memoryState.observations.push(...newObs);
  const findings = evaluateTelemetryWindow(memoryState.observations, SEEDED_BASELINE_PROFILE);

  return {
    ok: true,
    status: 200,
    message: `[In-Memory Demo Preview] Logged ${newObs.length} check-in observation(s) and evaluated 7 deterministic rules (${findings.length} active rule flag(s)).`,
    triggeredRules: findings,
  };
}

export async function injectTestObservation(
  testType: "VALID" | "STALE" | "IMPOSSIBLE" | "SPOOFED_HMAC",
  operator: OperatorSession
): Promise<{ ok: boolean; status: number; message: string }> {
  const authCheck = validateRoleAndPin(
    operator.actorRole,
    operator.authPin,
    ["CREW_MEDICAL_OFFICER", "CREW_MEMBER"],
    false
  );
  if (!authCheck.authorized) {
    return { ok: false, status: authCheck.status, message: authCheck.message };
  }

  const now = new Date();
  let obs: TelemetryObservation;

  if (testType === "VALID") {
    obs = {
      observation_id: `OBS-TEST-VALID-${Date.now().toString().slice(-4)}`,
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
      quality_notes: "Injected nominal simulated reading",
      is_quarantined: false,
    };
  } else if (testType === "STALE") {
    obs = {
      observation_id: `OBS-TEST-STALE-${Date.now().toString().slice(-4)}`,
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
      quality_notes: "Timestamp >15 min old (28 min lag); flagged STALE by Stage 2 Validator",
      is_quarantined: false,
    };
  } else if (testType === "IMPOSSIBLE") {
    obs = {
      observation_id: `OBS-TEST-IMPOSSIBLE-${Date.now().toString().slice(-4)}`,
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
      quality_notes: "Impossible negative value (-10.0 bpm); automatically quarantined",
      is_quarantined: true,
    };
  } else {
    obs = {
      observation_id: `OBS-TEST-HMAC-FAIL-${Date.now().toString().slice(-4)}`,
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
      quality_notes:
        "Fail-Closed Hardware Gate: Missing or invalid X-AEGIS-Device-Signature HMAC-SHA256. Quarantined.",
      is_quarantined: true,
    };
  }

  memoryState.observations.push(obs);
  return {
    ok: true,
    status: 200,
    message: `[In-Memory Demo Preview] Injected ${testType} observation (${obs.observation_id}: ${obs.parameter} = ${obs.value} ${obs.unit}, status=${obs.quality_status}, quarantined=${obs.is_quarantined}).`,
  };
}

export async function toggleEarthWanLink(
  connected: boolean,
  operator: OperatorSession
): Promise<{ ok: boolean; status: number; message: string; earthWanConnected: boolean }> {
  const authCheck = validateRoleAndPin(
    operator.actorRole,
    operator.authPin,
    ["CREW_MEDICAL_OFFICER", "CREW_MEMBER"],
    false
  );
  if (!authCheck.authorized) {
    return {
      ok: false,
      status: authCheck.status,
      message: authCheck.message,
      earthWanConnected: memoryState.earthWanConnected,
    };
  }

  const live = await tryFetchLocalBackend<{ earth_wan_connected: boolean }>(
    "/simulator/earth-link",
    {
      method: "POST",
      headers: buildHeaders(operator),
      body: JSON.stringify({ earth_wan_connected: connected }),
    }
  );

  if (live.ok) {
    return {
      ok: true,
      status: 200,
      message: `Earth Deep-Space WAN Link set to ${connected ? "CONNECTED" : "DISCONNECTED (Autonomous Mode)"}.`,
      earthWanConnected: live.data.earth_wan_connected,
    };
  }

  memoryState.earthWanConnected = connected;
  return {
    ok: true,
    status: 200,
    message: `[In-Memory Demo Preview] Earth Deep-Space WAN Link set to ${
      connected ? "CONNECTED" : "OFFLINE (Local Autonomous Mode)"
    }.`,
    earthWanConnected: connected,
  };
}

export async function updateSystemConfig(
  config: { optional_llm_enabled?: boolean; data_source_mode?: DataSourceType },
  operator: OperatorSession
): Promise<{ ok: boolean; status: number; message: string }> {
  const authCheck = validateRoleAndPin(
    operator.actorRole,
    operator.authPin,
    ["CREW_MEDICAL_OFFICER", "CREW_MEMBER"],
    false
  );
  if (!authCheck.authorized) {
    return { ok: false, status: authCheck.status, message: authCheck.message };
  }

  const live = await tryFetchLocalBackend("/settings/config", {
    method: "POST",
    headers: buildHeaders(operator),
    body: JSON.stringify(config),
  });

  if (live.ok) {
    return { ok: true, status: 200, message: "Updated system configuration on local backend." };
  }

  if (typeof config.optional_llm_enabled === "boolean") {
    memoryState.optionalLlmEnabled = config.optional_llm_enabled;
    memoryState.incidents = buildDemoIncidents(
      memoryState.activeScene,
      memoryState.observations,
      memoryState.optionalLlmEnabled
    );
  }
  if (config.data_source_mode) {
    memoryState.dataSourceMode = config.data_source_mode;
  }

  return {
    ok: true,
    status: 200,
    message: `[In-Memory Demo Preview] Updated configuration (optional_llm_enabled=${memoryState.optionalLlmEnabled}, data_source_mode=${memoryState.dataSourceMode}).`,
  };
}

export async function generateConsultationPackage(
  incidentId: string,
  operator: OperatorSession
): Promise<{ ok: boolean; status: number; message: string; item?: ConsultationQueueItem }> {
  const authCheck = validateRoleAndPin(
    operator.actorRole,
    operator.authPin,
    ["CREW_MEDICAL_OFFICER", "CREW_MEMBER"],
    false
  );
  if (!authCheck.authorized) {
    return { ok: false, status: authCheck.status, message: authCheck.message };
  }

  const live = await tryFetchLocalBackend<ConsultationQueueItem>(
    `/consultation/generate/${incidentId}`,
    {
      method: "POST",
      headers: buildHeaders(operator),
    }
  );
  if (live.ok) {
    return {
      ok: true,
      status: 200,
      message: "Generated Earth Consultation Package on local backend.",
      item: live.data,
    };
  }

  const inc =
    memoryState.incidents.find((i) => i.incident_id === incidentId) || memoryState.incidents[0];
  if (!inc) {
    return {
      ok: false,
      status: 404,
      message: "No active or retained incident available to package.",
    };
  }

  const pkg = buildConsultationQueueItem(inc, "PENDING");
  const existingIdx = memoryState.consultationQueue.findIndex(
    (q) => q.package_id === pkg.package_id
  );
  if (existingIdx >= 0) {
    memoryState.consultationQueue[existingIdx] = pkg;
  } else {
    memoryState.consultationQueue.unshift(pkg);
  }

  return {
    ok: true,
    status: 200,
    message: `[In-Memory Demo Preview] Generated Earth Consultation Package ${pkg.package_id} (status: PENDING).`,
    item: pkg,
  };
}

export async function simulateConsultationSync(
  operator: OperatorSession
): Promise<{ ok: boolean; status: number; message: string; queue: ConsultationQueueItem[] }> {
  const authCheck = validateRoleAndPin(
    operator.actorRole,
    operator.authPin,
    ["CREW_MEDICAL_OFFICER", "CREW_MEMBER"],
    false
  );
  if (!authCheck.authorized) {
    return {
      ok: false,
      status: authCheck.status,
      message: authCheck.message,
      queue: memoryState.consultationQueue,
    };
  }

  const live = await tryFetchLocalBackend<ConsultationQueueItem[]>(
    "/consultation/simulate-sync",
    {
      method: "POST",
      headers: buildHeaders(operator),
    }
  );
  if (live.ok) {
    return {
      ok: true,
      status: 200,
      message: "Executed Earth Sync on local backend.",
      queue: live.data,
    };
  }

  const now = new Date().toISOString();
  if (!memoryState.earthWanConnected) {
    memoryState.consultationQueue = memoryState.consultationQueue.map((item) => ({
      ...item,
      sync_status: item.sync_status === "SYNCED" ? "SYNCED" : "ERROR",
      last_attempt_at: now,
      error_message:
        "EARTH_WAN_LINK_DISCONNECTED: Deep-space link unavailable. Package preserved locally in queue.",
    }));
    return {
      ok: false,
      status: 503,
      message:
        "Earth Deep-Space WAN Link is currently disconnected. Sync attempt marked ERROR / PENDING; all local records remain intact.",
      queue: memoryState.consultationQueue,
    };
  }

  memoryState.consultationQueue = memoryState.consultationQueue.map((item) => ({
    ...item,
    sync_status: "SYNCED",
    last_attempt_at: now,
    error_message: null,
  }));
  memoryState.incidents = memoryState.incidents.map((inc) => ({
    ...inc,
    sync_status: "SYNCED",
  }));

  return {
    ok: true,
    status: 200,
    message:
      "[In-Memory Demo Preview] Earth WAN Link active — transitioned queued packages to SYNCED. Zero local records deleted.",
    queue: memoryState.consultationQueue,
  };
}

export async function createHotSqliteBackup(
  operator: OperatorSession
): Promise<{ ok: boolean; status: number; message: string }> {
  const authCheck = validateRoleAndPin(
    operator.actorRole,
    operator.authPin,
    ["CREW_MEDICAL_OFFICER"],
    true
  );
  if (!authCheck.authorized) {
    return { ok: false, status: authCheck.status, message: authCheck.message };
  }

  const live = await tryFetchLocalBackend("/system/backup", {
    method: "POST",
    headers: buildHeaders(operator),
  });
  if (live.ok) {
    return { ok: true, status: 200, message: "Created hot SQLite backup on local backend." };
  }

  const now = new Date().toISOString();
  const compactTs = now.replace(/[-:]/g, "").slice(0, 15) + "Z";
  memoryState.backups.unshift({
    backup_id: `BKP-${memoryState.backups.length + 1}`,
    filename: `aegis_v_backup_${compactTs}.db`,
    created_at: now,
    reason: `manual_cmo_snapshot_${operator.actorId}`,
    sha256_checksum: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
  });

  return {
    ok: true,
    status: 200,
    message: `[In-Memory Demo Preview] Created hot snapshot metadata entry aegis_v_backup_${compactTs}.db.`,
  };
}
