import { Fingerprint, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { CopyrightLabel } from "@/components/CopyrightLabel";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { InstalledBackupApi, InstalledLockState } from "@/types/installed-app";

interface LockGateProps {
  platform: InstalledBackupApi["platform"];
  lockState: InstalledLockState;
  onUnlock: (passcode: string) => Promise<void>;
  onBiometricUnlock?: () => Promise<void>;
  onReset: () => Promise<void>;
}

export function LockGate({
  platform,
  lockState,
  onUnlock,
  onBiometricUnlock,
  onReset,
}: LockGateProps) {
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitPasscode() {
    if (!passcode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onUnlock(passcode);
      setPasscode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unlock Chat Replay.");
    } finally {
      setBusy(false);
    }
  }

  async function biometricUnlock() {
    setBusy(true);
    setError(null);
    try {
      await onBiometricUnlock?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Biometric unlock was cancelled.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm("Reset the app lock and delete saved chat collections from this device?")) return;
    setBusy(true);
    setError(null);
    try {
      await onReset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset saved chats.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background px-4 py-4 text-foreground sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl justify-end">
        <ThemeToggle />
      </div>
      <main className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-sm flex-1 flex-col items-center justify-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Unlock Chat Replay</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Saved collections are protected on this{" "}
          {platform === "android" ? "Android app" : "desktop app"}.
        </p>
        <form
          className="mt-6 w-full space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submitPasscode();
          }}
        >
          <input
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            placeholder="Passcode"
            autoFocus
            className="h-11 w-full rounded-md border bg-background px-3 text-center text-base outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={busy || !passcode.trim()}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Lock className="h-4 w-4" />
            Unlock
          </button>
        </form>
        {lockState.biometricEnabled && onBiometricUnlock && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void biometricUnlock()}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Fingerprint className="h-4 w-4" />
            Use Android unlock
          </button>
        )}
        {error && (
          <div className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void reset()}
          className="mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Forgotten passcode reset
        </button>
        <div className="mt-6">
          <CopyrightLabel />
        </div>
      </main>
    </div>
  );
}
