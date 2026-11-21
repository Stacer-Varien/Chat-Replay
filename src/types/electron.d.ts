import type { InstalledBackupApi } from "@/types/installed-app";
import type { OnlineImageStore } from "@/lib/online-image-types";

declare global {
  interface Window {
    chatReplayDesktop?: InstalledBackupApi & {
      isElectron: true;
      platform: "electron";
      onlineImages?: OnlineImageStore;
    };
  }
}

export {};
