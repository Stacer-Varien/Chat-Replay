import type { InstalledBackupApi } from "@/types/installed-app";

declare global {
  interface Window {
    chatReplayDesktop?: InstalledBackupApi & {
      isElectron: true;
      platform: "electron";
    };
  }
}

export {};
