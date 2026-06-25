import { Capacitor, registerPlugin } from "@capacitor/core";

interface NativeAuthPlugin {
  canUseBiometrics(): Promise<{ available: boolean }>;
  authenticate(options: { title: string; subtitle?: string }): Promise<{ ok: true }>;
}

const nativeAuth = registerPlugin<NativeAuthPlugin>("NativeAuth");

export function canUseNativeBiometrics(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function canUseBiometricsOnAndroid(): Promise<boolean> {
  if (!canUseNativeBiometrics()) return false;
  try {
    return (await nativeAuth.canUseBiometrics()).available;
  } catch {
    return false;
  }
}

export function unlockWithBiometricsOnAndroid(): Promise<{ ok: true }> {
  return nativeAuth.authenticate({
    title: "Unlock Chat Replay",
    subtitle: "Use your device lock to open saved chats.",
  });
}
