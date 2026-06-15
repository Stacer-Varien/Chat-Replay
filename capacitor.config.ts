import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.chatreplay.viewer",
  appName: "Chat Replay",
  webDir: "dist/client",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: "disable",
    },
  },
};

export default config;
