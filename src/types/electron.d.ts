import type { Conversation, ExportBackupMetadata } from "@/lib/chatgpt-import";

export interface DesktopBackupSummary {
  id: string;
  originalFileName: string;
  archiveFileName: string;
  importedAt: number;
  updatedAt: number;
  exportedAt: number | null;
  version: number;
  conversationCount: number;
  latestConversationUpdate: number | null;
}

export interface DesktopBackupPayload {
  backup: DesktopBackupSummary;
  conversations: Conversation[];
}

export interface DesktopImportPayload {
  fileName: string;
  archiveData: ArrayBuffer;
  conversations: Conversation[];
  permissionConfirmed: boolean;
  metadata: ExportBackupMetadata;
}

export interface DesktopImportResult {
  action: "created" | "replaced" | "kept-existing";
  backup: DesktopBackupSummary;
}

declare global {
  interface Window {
    chatReplayDesktop?: {
      isElectron: true;
      listBackups: () => Promise<DesktopBackupSummary[]>;
      loadBackup: (id: string) => Promise<DesktopBackupPayload>;
      importBackup: (payload: DesktopImportPayload) => Promise<DesktopImportResult>;
      deleteBackup: (id: string) => Promise<{ ok: true }>;
    };
  }
}

export {};
