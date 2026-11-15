import { ParameterName, QualityStatus } from "../types/aegisContracts";
import { OpsRecordDoc, OpsStateDoc } from "../types/opsContracts";

export type OfflineQueueAction =
  | {
      queueId: string;
      ownerId: string;
      createdAtIso: string;
      kind: "CHECKIN_BATCH";
      label: string;
      entries: Array<{
        parameter: ParameterName;
        value: number;
        quality_status?: QualityStatus;
        notes?: string;
      }>;
    }
  | {
      queueId: string;
      ownerId: string;
      createdAtIso: string;
      kind: "UPSERT_OPS_RECORD";
      label: string;
      record: OpsRecordDoc;
    }
  | {
      queueId: string;
      ownerId: string;
      createdAtIso: string;
      kind: "UPDATE_OPS_STATE";
      label: string;
      updates: Partial<Omit<OpsStateDoc, "ownerId">>;
    };

const DB_NAME = "aegis_v_offline_queue_v1";
const STORE_NAME = "pending_actions";
const LS_FALLBACK_KEY = "aegis_v_offline_queue_fallback";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "queueId" });
          store.createIndex("ownerId", "ownerId", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readLsFallback(ownerId: string): OfflineQueueAction[] {
  try {
    const raw = window.localStorage.getItem(LS_FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineQueueAction[];
    return parsed.filter((item) => item.ownerId === ownerId);
  } catch {
    return [];
  }
}

function writeLsFallback(items: OfflineQueueAction[]) {
  try {
    window.localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

export async function getQueuedOfflineActions(ownerId: string): Promise<OfflineQueueAction[]> {
  const db = await openDb();
  if (!db) {
    return readLsFallback(ownerId);
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("ownerId");
      const req = index.getAll(ownerId);
      req.onsuccess = () => {
        const res = ((req.result || []) as OfflineQueueAction[]).sort((a, b) =>
          a.createdAtIso.localeCompare(b.createdAtIso)
        );
        resolve(res);
      };
      req.onerror = () => resolve(readLsFallback(ownerId));
    } catch {
      resolve(readLsFallback(ownerId));
    }
  });
}

export async function enqueueOfflineAction(action: OfflineQueueAction): Promise<void> {
  const db = await openDb();
  if (!db) {
    const all = readLsFallback(action.ownerId);
    writeLsFallback([...all, action]);
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(action);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        const all = readLsFallback(action.ownerId);
        writeLsFallback([...all, action]);
        resolve();
      };
    } catch {
      const all = readLsFallback(action.ownerId);
      writeLsFallback([...all, action]);
      resolve();
    }
  });
}

export async function removeQueuedOfflineAction(ownerId: string, queueId: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    const remaining = readLsFallback(ownerId).filter((a) => a.queueId !== queueId);
    writeLsFallback(remaining);
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(queueId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
