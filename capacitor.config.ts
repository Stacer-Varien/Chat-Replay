import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.chatreplay.viewer",
  appName: "Chat Replay",
  webDir: "dist/client",
  android: {
    allowMixedContent: false,
  },
};

export default config;
