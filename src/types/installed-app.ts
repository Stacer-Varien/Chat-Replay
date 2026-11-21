import type { Conversation, ExportBackupMetadata, ImportHealthReport } from "@/lib/chatgpt-import";
import type { SavedSearchIndex } from "@/lib/chat-search-index";

export interface InstalledBackupSummary {
  id: string;
  displayName: string;
  originalFileName: string;
  archiveFileName: string;
  sourceKind?: string | null;
  importedAt: number;
  updatedAt: number;
  lastOpenedAt?: number | null;
  exportedAt: number | null;
  version: number;
  conversationCount: number;
  latestConversationUpdate: number | null;
}

export interface InstalledBackupPayload {
  backup: InstalledBackupSummary;
  conversations: Conversation[];
  report: ImportHealthReport | null;
  searchIndex: SavedSearchIndex | null;
}

export interface InstalledSavePayload {
  displayName: string;
  fileName: string;
  archiveData: ArrayBuffer;
  conversations: Conversation[];
  report: ImportHealthReport;
  permissionConfirmed: boolean;
  metadata: ExportBackupMetadata;
  searchIndex?: SavedSearchIndex;
}

export interface InstalledSaveResult {
  action: "created" | "replaced" | "kept-existing";
  backup: InstalledBackupSummary;
}

export interface InstalledLockState {
  configured: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
}

export interface InstalledBackupApi {
  platform: "electron" | "android";
  listBackups: () => Promise<InstalledBackupSummary[]>;
  loadBackup: (id: string) => Promise<InstalledBackupPayload>;
  loadConversation: (id: string, conversationId: string) => Promise<Conversation>;
  loadBackupArchive: (id: string) => Promise<ArrayBuffer | null>;
  saveBackup: (payload: InstalledSavePayload) => Promise<InstalledSaveResult>;
  saveSearchIndex: (id: string, searchIndex: SavedSearchIndex) => Promise<void>;
  renameBackup: (id: string, displayName: string) => Promise<InstalledBackupSummary>;
  markBackupOpened: (id: string) => Promise<InstalledBackupSummary>;
  deleteBackup: (id: string) => Promise<{ ok: true }>;
  getLockState: () => Promise<InstalledLockState>;
  setupLock: (
    passcode: string,
    options?: { biometricEnabled?: boolean },
  ) => Promise<InstalledLockState>;
  verifyLock: (passcode: string) => Promise<{ ok: true }>;
  disableLock: (passcode: string) => Promise<InstalledLockState>;
  resetLockAndBackups: () => Promise<{ ok: true }>;
  unlockWithBiometric?: () => Promise<{ ok: true }>;
}
