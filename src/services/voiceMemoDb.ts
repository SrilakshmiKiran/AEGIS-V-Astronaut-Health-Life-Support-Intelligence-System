import { VoiceMemoEntry } from "../types/opsContracts";

export interface StoredVoiceMemoRecord extends VoiceMemoEntry {
  audioBlob: Blob;
}

const DB_NAME = "aegis_v_voice_memos_v1";
const STORE_NAME = "voice_memos";
const LS_FALLBACK_KEY = "aegis_v_voice_memos_fallback_v1";

interface SerializedFallbackMemo extends VoiceMemoEntry {
  audioDataUrl: string;
}

function openVoiceDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "memoId" });
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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string, mimeType: string): Blob {
  const parts = dataUrl.split(",");
  const bstr = window.atob(parts[1] || "");
  const bytes = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i += 1) {
    bytes[i] = bstr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || "audio/webm" });
}

function readLsFallback(ownerId: string): StoredVoiceMemoRecord[] {
  try {
    const raw = window.localStorage.getItem(LS_FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SerializedFallbackMemo[];
    return parsed
      .filter((m) => m.ownerId === ownerId)
      .map(({ audioDataUrl, ...meta }) => ({
        ...meta,
        audioBlob: dataUrlToBlob(audioDataUrl, meta.mimeType),
      }));
  } catch {
    return [];
  }
}

async function writeLsFallback(record: StoredVoiceMemoRecord): Promise<void> {
  try {
    const raw = window.localStorage.getItem(LS_FALLBACK_KEY);
    const existing: SerializedFallbackMemo[] = raw ? JSON.parse(raw) : [];
    const audioDataUrl = await blobToDataUrl(record.audioBlob);
    const { audioBlob: _ignored, ...meta } = record;
    const next = [...existing.filter((m) => m.memoId !== record.memoId), { ...meta, audioDataUrl }];
    window.localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(next));
  } catch {
    // Ignore localStorage quota overflow
  }
}

function removeLsFallback(ownerId: string, memoId: string): void {
  try {
    const raw = window.localStorage.getItem(LS_FALLBACK_KEY);
    if (!raw) return;
    const existing = JSON.parse(raw) as SerializedFallbackMemo[];
    const next = existing.filter((m) => !(m.ownerId === ownerId && m.memoId === memoId));
    window.localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(next));
  } catch {
    // Ignore error
  }
}

export async function saveVoiceMemoBlob(record: StoredVoiceMemoRecord): Promise<void> {
  const db = await openVoiceDb();
  if (!db) {
    await writeLsFallback(record);
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = async () => {
        await writeLsFallback(record);
        resolve();
      };
    } catch {
      void writeLsFallback(record).then(resolve);
    }
  });
}

export async function getVoiceMemosForOwner(ownerId: string): Promise<StoredVoiceMemoRecord[]> {
  const db = await openVoiceDb();
  if (!db) {
    return readLsFallback(ownerId).sort((a, b) =>
      b.createdAtIso.localeCompare(a.createdAtIso)
    );
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const index = tx.objectStore(STORE_NAME).index("ownerId");
      const req = index.getAll(ownerId);
      req.onsuccess = () => {
        const list = ((req.result || []) as StoredVoiceMemoRecord[]).sort((a, b) =>
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

export async function deleteVoiceMemoBlob(ownerId: string, memoId: string): Promise<void> {
  removeLsFallback(ownerId, memoId);
  const db = await openVoiceDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(memoId);
      getReq.onsuccess = () => {
        const found = getReq.result as StoredVoiceMemoRecord | undefined;
        if (found && found.ownerId === ownerId) {
          store.delete(memoId);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
