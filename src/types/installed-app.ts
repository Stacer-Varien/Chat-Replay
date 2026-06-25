import type { Conversation, ExportBackupMetadata } from "@/lib/chatgpt-import";

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
  archiveData: ArrayBuffer | null;
}

export interface InstalledSavePayload {
  displayName: string;
  fileName: string;
  archiveData: ArrayBuffer;
  conversations: Conversation[];
  permissionConfirmed: boolean;
  metadata: ExportBackupMetadata;
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
  saveBackup: (payload: InstalledSavePayload) => Promise<InstalledSaveResult>;
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
