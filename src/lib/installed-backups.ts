import { Capacitor } from "@capacitor/core";

import type { Conversation, ExportBackupMetadata } from "@/lib/chatgpt-import";
import type {
  InstalledBackupApi,
  InstalledBackupPayload,
  InstalledBackupSummary,
  InstalledSavePayload,
  InstalledSaveResult,
} from "@/types/installed-app";

interface StoredBackup {
  id: string;
  backup: InstalledBackupSummary;
  conversations: Conversation[];
  archiveData: ArrayBuffer | null;
}

const DB_NAME = "chat-replay";
const STORE_NAME = "backups";
const DB_VERSION = 1;
const VALID_BACKUP_ID = /^[a-f0-9]{16,96}$/i;

let databasePromise: Promise<IDBDatabase> | null = null;
let persistenceRequested = false;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open Android app storage."));
  });

  return databasePromise;
}

async function requestPersistentStorage() {
  if (persistenceRequested) return;
  persistenceRequested = true;
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Android WebView app storage remains usable even when persistence cannot be requested.
  }
}

async function storeRequest<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  await requestPersistentStorage();
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    let result!: T;

    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Android app storage request failed."));
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Android app storage transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Android app storage transaction was cancelled."));
  });
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function backupVersion(metadata: ExportBackupMetadata): number {
  return (
    finiteNumber(metadata.exportedAt) ??
    finiteNumber(metadata.latestConversationUpdate) ??
    finiteNumber(metadata.sourceLastModified) ??
    Math.floor(Date.now() / 1000)
  );
}

function requestedDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, 80) : null;
}

function randomDisplayName(): string {
  const bytes = new Uint8Array(3);
  globalThis.crypto?.getRandomValues?.(bytes);
  const suffix = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `Saved Chats ${(suffix || Date.now().toString(16).slice(-6)).toUpperCase()}`;
}

function archiveExtension(name: string): ".json" | ".zip" {
  return name.toLowerCase().endsWith(".json") ? ".json" : ".zip";
}

function scrubConversationData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubConversationData);
  if (!value || typeof value !== "object") return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = key === "url" ? null : scrubConversationData(item);
  }
  return result;
}

function stableHash(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  const seeds = [
    2166136261, 2246822507, 3266489909, 668265263, 374761393, 2654435761, 1597334677, 3812015801,
  ];
  return seeds
    .map((seed) => {
      let hash = seed;
      for (const byte of bytes) {
        hash ^= byte;
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16).padStart(8, "0");
    })
    .join("");
}

async function archiveIdentity(metadata: ExportBackupMetadata, archiveData: ArrayBuffer) {
  if (VALID_BACKUP_ID.test(metadata.identityKey)) return metadata.identityKey.toLowerCase();
  if (globalThis.crypto?.subtle) {
    try {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", archiveData);
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fall through to the deterministic compatibility hash.
    }
  }
  return stableHash(archiveData);
}

async function getStoredBackup(id: string): Promise<StoredBackup | undefined> {
  if (!VALID_BACKUP_ID.test(id)) throw new Error("Invalid backup id.");
  return storeRequest("readonly", (store) => store.get(id.toLowerCase()));
}

async function listBackups(): Promise<InstalledBackupSummary[]> {
  const records = await storeRequest<StoredBackup[]>("readonly", (store) => store.getAll());
  return records
    .map((record) => record.backup)
    .sort((a, b) => (b.version ?? b.importedAt ?? 0) - (a.version ?? a.importedAt ?? 0));
}

async function loadBackup(id: string): Promise<InstalledBackupPayload> {
  const record = await getStoredBackup(id);
  if (!record) throw new Error("This saved backup could not be found.");
  return {
    backup: record.backup,
    conversations: record.conversations,
    archiveData: record.archiveData,
  };
}

async function saveBackup(payload: InstalledSavePayload): Promise<InstalledSaveResult> {
  if (!payload.permissionConfirmed) {
    throw new Error("Confirm that you own this backup or have permission before saving it.");
  }
  if (!payload.archiveData.byteLength) throw new Error("The selected backup is empty.");
  if (!payload.conversations.length) {
    throw new Error("No readable conversations were provided for this backup.");
  }

  const id = await archiveIdentity(payload.metadata, payload.archiveData);
  const existing = await getStoredBackup(id);
  const version = backupVersion(payload.metadata);
  const now = Math.floor(Date.now() / 1000);
  const requestedName = requestedDisplayName(payload.displayName);

  if (existing && version <= existing.backup.version) {
    if (requestedName && requestedName !== existing.backup.displayName) {
      existing.backup = { ...existing.backup, displayName: requestedName, updatedAt: now };
      await storeRequest("readwrite", (store) => store.put(existing));
    }
    return { action: "kept-existing", backup: existing.backup };
  }

  const backup: InstalledBackupSummary = {
    id,
    displayName: requestedName ?? existing?.backup.displayName ?? randomDisplayName(),
    originalFileName: payload.fileName || payload.metadata.sourceName || "backup.zip",
    archiveFileName: `source${archiveExtension(payload.fileName || payload.metadata.sourceName)}`,
    importedAt: existing?.backup.importedAt ?? now,
    updatedAt: now,
    exportedAt: finiteNumber(payload.metadata.exportedAt),
    version,
    conversationCount: payload.conversations.length,
    latestConversationUpdate: finiteNumber(payload.metadata.latestConversationUpdate),
  };
  const record: StoredBackup = {
    id,
    backup,
    conversations: scrubConversationData(payload.conversations) as Conversation[],
    archiveData: payload.archiveData,
  };

  await storeRequest("readwrite", (store) => store.put(record));
  return { action: existing ? "replaced" : "created", backup };
}

async function deleteBackup(id: string): Promise<{ ok: true }> {
  if (!VALID_BACKUP_ID.test(id)) throw new Error("Invalid backup id.");
  await storeRequest("readwrite", (store) => store.delete(id.toLowerCase()));
  return { ok: true };
}

const androidBackupApi: InstalledBackupApi = {
  platform: "android",
  listBackups,
  loadBackup,
  saveBackup,
  deleteBackup,
};

export function getInstalledBackupApi(): InstalledBackupApi | null {
  if (typeof window === "undefined") return null;
  if (window.chatReplayDesktop) return window.chatReplayDesktop;
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android")
    return androidBackupApi;
  return null;
}
