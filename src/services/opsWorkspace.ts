import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
  DEFAULT_ECLSS,
  DEFAULT_OPS_STATE,
  OpsRecordDoc,
  OpsRecordType,
  OpsStateDoc,
  SEEDED_CREW_ROSTER,
  SEEDED_MED_KIT_ITEMS,
} from "../types/opsContracts";

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

const inFlightOpsInit = new Map<string, Promise<void>>();

export async function ensureOpsWorkspace(uidRaw: string): Promise<void> {
  const uid = sanitizeId(uidRaw);
  const existingPromise = inFlightOpsInit.get(uid);
  if (existingPromise) {
    return existingPromise;
  }

  const run = (async () => {
    const statePath = `users/${uid}/opsState/current`;
    const stateRef = doc(db, "users", uid, "opsState", "current");

    let snap;
    try {
      snap = await getDoc(stateRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, statePath);
    }

    if (snap && snap.exists()) {
      return;
    }

  const batch = writeBatch(db);
  batch.set(stateRef, {
    ownerId: uid,
    ...DEFAULT_OPS_STATE,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const nowIso = new Date().toISOString();

  for (const crew of SEEDED_CREW_ROSTER) {
    const recId = sanitizeId(`CREW_${crew.crewId}`);
    batch.set(doc(db, "users", uid, "opsRecords", recId), {
      ownerId: uid,
      recordId: recId,
      recordType: "CREW_PROFILE",
      crewId: crew.crewId.slice(0, 64),
      title: crew.name.slice(0, 200),
      status: crew.crewId === "AST-01-COMMANDER" ? "ACTIVE_PRIMARY" : "READY",
      timestampIso: nowIso,
      payload: {
        role: crew.role,
        age: crew.age,
        restingHrMean: crew.restingHrMean,
        statusNote: crew.statusNote,
        activeAlertCount: crew.activeAlertCount,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const med of SEEDED_MED_KIT_ITEMS) {
    const recId = sanitizeId(med.itemId);
    batch.set(doc(db, "users", uid, "opsRecords", recId), {
      ownerId: uid,
      recordId: recId,
      recordType: "MED_LOG",
      crewId: "AST-01-COMMANDER",
      title: med.name.slice(0, 200),
      status: "STOCKED",
      timestampIso: nowIso,
      payload: {
        category: med.category,
        dosageOrSchedule: med.dosageOrSchedule,
        stockQty: med.stockQty,
        unit: med.unit,
        expiresOn: med.expiresOn,
        dosesLoggedToday: 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const seedConsultMsgId = sanitizeId("MSG_FS_WELCOME_01");
  batch.set(doc(db, "users", uid, "opsRecords", seedConsultMsgId), {
    ownerId: uid,
    recordId: seedConsultMsgId,
    recordType: "CONSULT_MSG",
    crewId: "AST-01-COMMANDER",
    title: "Flight Surgeon Async Channel Ready",
    status: "RECEIVED",
    timestampIso: nowIso,
    payload: {
      sender: "EARTH_FLIGHT_SURGEON",
      senderName: "Dr. M. Hollis (Mission Control Medical)",
      body: "Telemetry baseline received. Attach fundoscope or ECG strips to your package anytime; if Earth link drops, messages queue locally and deliver automatically.",
      attachmentLabel: "",
      attachmentKind: "",
      lightDelayLabel: "Lunar Gateway (~3 sec round-trip)",
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, statePath);
    }
  })();

  inFlightOpsInit.set(uid, run);
  try {
    await run;
  } finally {
    inFlightOpsInit.delete(uid);
  }
}

export function subscribeOpsWorkspace(
  uidRaw: string,
  callbacks: {
    onOpsState: (state: OpsStateDoc) => void;
    onOpsRecords: (records: OpsRecordDoc[]) => void;
    onError: (err: Error) => void;
  }
): () => void {
  const uid = sanitizeId(uidRaw);

  const unsubState = onSnapshot(
    doc(db, "users", uid, "opsState", "current"),
    (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        callbacks.onOpsState({
          ownerId: d.ownerId || uid,
          activityMode: d.activityMode || "RESTING",
          activeCrewId: d.activeCrewId || "AST-01-COMMANDER",
          lightDelayMode: d.lightDelayMode || "LUNAR_3S",
          cumulativeRadiationMsv: Number(d.cumulativeRadiationMsv ?? 84.6),
          solarStormActive: Boolean(d.solarStormActive),
          eclss: {
            ...DEFAULT_ECLSS,
            ...(d.eclss || {}),
          },
        });
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `users/${uid}/opsState/current`);
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  const recQuery = query(
    collection(db, "users", uid, "opsRecords"),
    where("ownerId", "==", uid)
  );
  const unsubRecords = onSnapshot(
    recQuery,
    (snap) => {
      const list: OpsRecordDoc[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            ownerId: data.ownerId,
            recordId: data.recordId,
            recordType: data.recordType as OpsRecordType,
            crewId: data.crewId,
            title: data.title,
            status: data.status,
            timestampIso: data.timestampIso,
            payload: (data.payload || {}) as Record<string, unknown>,
          };
        })
        .sort((a, b) => b.timestampIso.localeCompare(a.timestampIso));
      callbacks.onOpsRecords(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/opsRecords`);
      } catch (e) {
        callbacks.onError(e as Error);
      }
    }
  );

  return () => {
    unsubState();
    unsubRecords();
  };
}

export async function updateOpsStateInCloud(
  uidRaw: string,
  updates: Partial<Omit<OpsStateDoc, "ownerId">>
): Promise<void> {
  const uid = sanitizeId(uidRaw);
  const cleanUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.activityMode !== undefined) {
    cleanUpdates.activityMode = updates.activityMode;
  }
  if (updates.activeCrewId !== undefined) {
    cleanUpdates.activeCrewId = sanitizeId(updates.activeCrewId).slice(0, 64);
  }
  if (updates.lightDelayMode !== undefined) {
    cleanUpdates.lightDelayMode = updates.lightDelayMode;
  }
  if (updates.cumulativeRadiationMsv !== undefined) {
    cleanUpdates.cumulativeRadiationMsv = Math.max(0, Number(updates.cumulativeRadiationMsv));
  }
  if (updates.solarStormActive !== undefined) {
    cleanUpdates.solarStormActive = Boolean(updates.solarStormActive);
  }
  if (updates.eclss !== undefined) {
    cleanUpdates.eclss = stripUndefinedDeep(updates.eclss);
  }

  try {
    await updateDoc(doc(db, "users", uid, "opsState", "current"), cleanUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/opsState/current`);
  }
}

export async function upsertOpsRecordInCloud(
  uidRaw: string,
  input: Omit<OpsRecordDoc, "ownerId">
): Promise<void> {
  const uid = sanitizeId(uidRaw);
  const recordId = sanitizeId(input.recordId);
  const ref = doc(db, "users", uid, "opsRecords", recordId);
  const cleanPayload = stripUndefinedDeep(input.payload || {});

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch {
    exists = false;
  }

  if (exists) {
    try {
      await updateDoc(ref, {
        title: (input.title || "Record").slice(0, 200),
        status: (input.status || "SAVED").slice(0, 64),
        payload: cleanPayload,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/opsRecords/${recordId}`);
    }
    return;
  }

  try {
    await setDoc(ref, {
      ownerId: uid,
      recordId,
      recordType: input.recordType,
      crewId: (input.crewId || "AST-01-COMMANDER").slice(0, 64),
      title: (input.title || "Record").slice(0, 200),
      status: (input.status || "SAVED").slice(0, 64),
      timestampIso: (input.timestampIso || new Date().toISOString()).slice(0, 64),
      payload: cleanPayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${uid}/opsRecords/${recordId}`);
  }
}

export async function deleteOpsRecordInCloud(uidRaw: string, recordId: string): Promise<void> {
  const uid = sanitizeId(uidRaw);
  const cleanId = sanitizeId(recordId);
  try {
    await deleteDoc(doc(db, "users", uid, "opsRecords", cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}/opsRecords/${cleanId}`);
  }
}
