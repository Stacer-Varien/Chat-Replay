import { Capacitor } from "@capacitor/core";

import type { Conversation, ExportBackupMetadata, ImportHealthReport } from "@/lib/chatgpt-import";
import type { ArchiveSearchIndex, SavedSearchIndex } from "@/lib/chat-search-index";
import * as storage from "./backup-storage";
import { clearOnlineImageCache } from "./online-images";
import { canUseBiometricsOnAndroid, unlockWithBiometricsOnAndroid } from "@/lib/native-auth";
import type {
  InstalledBackupApi,
  InstalledBackupPayload,
  InstalledBackupSummary,
  InstalledSavePayload,
  InstalledSaveResult,
} from "@/types/installed-app";

const VALID_BACKUP_ID = /^[a-f0-9]{16,96}$/i;
const LOCK_KEY = "chat-replay-installed-lock";

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
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

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  const fallback = Date.now().toString(16);
  const value = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return value.replace(/^0+$/, "") || fallback;
}

function archiveExtension(name: string): ".json" | ".zip" {
  return name.toLowerCase().endsWith(".json") ? ".json" : ".zip";
}

function scrubConversationData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubConversationData);
  if (!value || typeof value !== "object") return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] =
      key === "url" && typeof item === "string" && item.startsWith("blob:")
        ? null
        : scrubConversationData(item);
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

async function hashPasscode(passcode: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${passcode}`);
  if (globalThis.crypto?.subtle) {
    try {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fall through to the deterministic compatibility hash.
    }
  }
  return stableHash(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
}

interface StoredLock {
  salt: string;
  passcodeHash: string;
  biometricEnabled: boolean;
}

function readLock(): StoredLock | null {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLock>;
    if (typeof parsed.salt !== "string" || typeof parsed.passcodeHash !== "string") return null;
    return {
      salt: parsed.salt,
      passcodeHash: parsed.passcodeHash,
      biometricEnabled: Boolean(parsed.biometricEnabled),
    };
  } catch {
    return null;
  }
}

function writeLock(lock: StoredLock | null) {
  if (!lock) localStorage.removeItem(LOCK_KEY);
  else localStorage.setItem(LOCK_KEY, JSON.stringify(lock));
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

async function listBackups(): Promise<InstalledBackupSummary[]> {
  const summaries = await storage.listSummaries();
  return summaries.sort(
    (a, b) =>
      (b.lastOpenedAt ?? b.version ?? b.importedAt ?? 0) -
      (a.lastOpenedAt ?? a.version ?? a.importedAt ?? 0),
  );
}

async function loadBackup(id: string): Promise<InstalledBackupPayload> {
  return storage.readCollection(id);
}

async function loadBackupArchive(id: string): Promise<ArrayBuffer | null> {
  return storage.readArchive(id);
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
  const saved = await storage.readSummary(id);
  const existing = saved ? { backup: saved } : undefined;
  const version = backupVersion(payload.metadata);
  const now = nowSeconds();
  const requestedName = requestedDisplayName(payload.displayName);

  if (existing && version <= existing.backup.version) {
    if (requestedName && requestedName !== existing.backup.displayName) {
      existing.backup = { ...existing.backup, displayName: requestedName, updatedAt: now };
    }
    await storage.updateSummary(id, existing.backup);
    return { action: "kept-existing", backup: existing.backup };
  }

  const backup: InstalledBackupSummary = {
    id,
    displayName: requestedName ?? existing?.backup.displayName ?? randomDisplayName(),
    originalFileName: payload.fileName || payload.metadata.sourceName || "backup.zip",
    archiveFileName: `source${archiveExtension(payload.fileName || payload.metadata.sourceName)}`,
    sourceKind: payload.metadata.sourceKind,
    importedAt: existing?.backup.importedAt ?? now,
    updatedAt: now,
    lastOpenedAt: existing?.backup.lastOpenedAt ?? null,
    exportedAt: finiteNumber(payload.metadata.exportedAt),
    version,
    conversationCount: payload.conversations.length,
    latestConversationUpdate: finiteNumber(payload.metadata.latestConversationUpdate),
  };
  const record = {
    id,
    backup,
    conversations: scrubConversationData(payload.conversations) as Conversation[],
    archiveData: new Blob([payload.archiveData]),
    report: payload.report,
    searchIndex: payload.searchIndex ?? null,
  };

  await storage.storeCollection(record);
  return { action: existing ? "replaced" : "created", backup };
}

async function saveSearchIndex(id: string, searchIndex: SavedSearchIndex): Promise<void> {
  await storage.putIndex(id, searchIndex);
}

async function renameBackup(id: string, displayName: string): Promise<InstalledBackupSummary> {
  const existing = await storage.readSummary(id);
  if (!existing) throw new Error("This saved backup could not be found.");
  const requestedName = requestedDisplayName(displayName);
  if (!requestedName) throw new Error("Enter a name for this saved collection.");
  return storage.updateSummary(id, { displayName: requestedName, updatedAt: nowSeconds() });
}

async function markBackupOpened(id: string): Promise<InstalledBackupSummary> {
  return storage.updateSummary(id, { lastOpenedAt: nowSeconds() });
}

async function deleteBackup(id: string): Promise<{ ok: true }> {
  if (!VALID_BACKUP_ID.test(id)) throw new Error("Invalid backup id.");
  await storage.removeCollection(id.toLowerCase());
  return { ok: true };
}

async function clearBackups(): Promise<void> {
  await storage.clearCollections();
}

async function getLockState() {
  const lock = readLock();
  return {
    configured: Boolean(lock),
    biometricAvailable: await canUseBiometricsOnAndroid(),
    biometricEnabled: Boolean(lock?.biometricEnabled),
  };
}

async function setupLock(
  passcode: string,
  options: { biometricEnabled?: boolean } = {},
): Promise<Awaited<ReturnType<typeof getLockState>>> {
  if (passcode.trim().length < 4) throw new Error("Use at least 4 characters for the passcode.");
  const salt = randomSalt();
  const biometricAvailable = await canUseBiometricsOnAndroid();
  writeLock({
    salt,
    passcodeHash: await hashPasscode(passcode, salt),
    biometricEnabled: Boolean(options.biometricEnabled && biometricAvailable),
  });
  return getLockState();
}

async function verifyLock(passcode: string): Promise<{ ok: true }> {
  const lock = readLock();
  if (!lock) return { ok: true };
  const hash = await hashPasscode(passcode, lock.salt);
  if (hash !== lock.passcodeHash) throw new Error("That passcode did not unlock Chat Replay.");
  return { ok: true };
}

async function disableLock(passcode: string) {
  await verifyLock(passcode);
  writeLock(null);
  return getLockState();
}

async function resetLockAndBackups(): Promise<{ ok: true }> {
  writeLock(null);
  await clearBackups();
  await clearOnlineImageCache();
  return { ok: true };
}

async function unlockWithBiometric(): Promise<{ ok: true }> {
  const lock = readLock();
  if (!lock?.biometricEnabled) throw new Error("Biometric unlock is not enabled.");
  return unlockWithBiometricsOnAndroid();
}

export const androidBackupApi: InstalledBackupApi = {
  platform: "android",
  listBackups,
  loadBackup,
  loadConversation: storage.readConversation,
  loadBackupArchive,
  saveBackup,
  saveSearchIndex,
  renameBackup,
  markBackupOpened,
  deleteBackup,
  getLockState,
  setupLock,
  verifyLock,
  disableLock,
  resetLockAndBackups,
  unlockWithBiometric,
};

export function getInstalledBackupApi(): InstalledBackupApi | null {
  if (typeof window === "undefined") return null;
  if (window.chatReplayDesktop) {
    const api = window.chatReplayDesktop;
    return {
      ...api,
      saveBackup: async (payload) =>
        api.saveBackup({
          ...payload,
          searchIndex:
            payload.searchIndex instanceof Blob
              ? await payload.searchIndex.arrayBuffer()
              : payload.searchIndex,
        }),
      saveSearchIndex: async (id, index) =>
        api.saveSearchIndex(id, index instanceof Blob ? await index.arrayBuffer() : index),
    };
  }
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android")
    return androidBackupApi;
  return null;
}
