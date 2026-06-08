import type { Conversation, ExportBackupMetadata } from "@/lib/chatgpt-import";

export interface InstalledBackupSummary {
  id: string;
  displayName: string;
  originalFileName: string;
  archiveFileName: string;
  importedAt: number;
  updatedAt: number;
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

export interface InstalledBackupApi {
  platform: "electron" | "android";
  listBackups: () => Promise<InstalledBackupSummary[]>;
  loadBackup: (id: string) => Promise<InstalledBackupPayload>;
  saveBackup: (payload: InstalledSavePayload) => Promise<InstalledSaveResult>;
  deleteBackup: (id: string) => Promise<{ ok: true }>;
}
