import { DiagnosticScanEntry } from "../types/opsContracts";

export interface StoredDiagnosticScan extends DiagnosticScanEntry {
  imageDataUrl: string;
}

const DB_NAME = "aegis_v_diagnostic_scans_v1";
const STORE_NAME = "diagnostic_scans";
const LS_FALLBACK_KEY = "aegis_v_diagnostic_scans_fallback_v1";

function openScanDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "scanId" });
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

function readLsFallback(ownerId: string): StoredDiagnosticScan[] {
  try {
    const raw = window.localStorage.getItem(LS_FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredDiagnosticScan[];
    return parsed
      .filter((s) => s.ownerId === ownerId)
      .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
  } catch {
    return [];
  }
}

function writeLsFallback(record: StoredDiagnosticScan): void {
  try {
    const raw = window.localStorage.getItem(LS_FALLBACK_KEY);
    const existing: StoredDiagnosticScan[] = raw ? JSON.parse(raw) : [];
    const next = [...existing.filter((s) => s.scanId !== record.scanId), record];
    window.localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(next));
  } catch {
    // Ignore localStorage quota overflow
  }
}

function removeLsFallback(ownerId: string, scanId: string): void {
  try {
    const raw = window.localStorage.getItem(LS_FALLBACK_KEY);
    if (!raw) return;
    const existing = JSON.parse(raw) as StoredDiagnosticScan[];
    const next = existing.filter((s) => !(s.ownerId === ownerId && s.scanId === scanId));
    window.localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(next));
  } catch {
    // Ignore error
  }
}

export async function saveDiagnosticScanImage(record: StoredDiagnosticScan): Promise<void> {
  const db = await openScanDb();
  if (!db) {
    writeLsFallback(record);
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        writeLsFallback(record);
        resolve();
      };
    } catch {
      writeLsFallback(record);
      resolve();
    }
  });
}

export async function getDiagnosticScansForOwner(
  ownerId: string
): Promise<StoredDiagnosticScan[]> {
  const db = await openScanDb();
  if (!db) {
    return readLsFallback(ownerId);
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const index = tx.objectStore(STORE_NAME).index("ownerId");
      const req = index.getAll(ownerId);
      req.onsuccess = () => {
        const list = ((req.result || []) as StoredDiagnosticScan[]).sort((a, b) =>
          b.createdAtIso.localeCompare(a.createdAtIso)
        );
        resolve(list);
      };
      req.onerror = () => resolve(readLsFallback(ownerId));
    } catch {
      resolve(readLsFallback(ownerId));
    }
  });
}

export async function deleteDiagnosticScanImage(ownerId: string, scanId: string): Promise<void> {
  removeLsFallback(ownerId, scanId);
  const db = await openScanDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(scanId);
      getReq.onsuccess = () => {
        const found = getReq.result as StoredDiagnosticScan | undefined;
        if (found && found.ownerId === ownerId) {
          store.delete(scanId);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
