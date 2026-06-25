import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Archive,
  Download,
  Edit3,
  FileArchive,
  Loader2,
  Lock,
  Monitor,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { CopyrightLabel } from "@/components/CopyrightLabel";
import { parseChatGPTExportWithMetadata, type ParsedChatGPTExport } from "@/lib/chatgpt-import";
import { ThemeToggle } from "@/components/ThemeToggle";
import type {
  InstalledBackupApi,
  InstalledBackupSummary,
  InstalledLockState,
} from "@/types/installed-app";

interface ImportedFile extends ParsedChatGPTExport {
  file: File;
}

interface ImportDropzoneProps {
  onLoaded: (imported: ImportedFile) => void | Promise<void>;
  installed?: boolean;
  savedBackups?: InstalledBackupSummary[];
  onLoadBackup?: (id: string) => void | Promise<void>;
  onRenameBackup?: (id: string, displayName: string) => void | Promise<void>;
  onDeleteBackup?: (id: string) => void | Promise<void>;
  importStatus?: string | null;
  platform?: InstalledBackupApi["platform"] | null;
  lockState?: InstalledLockState | null;
  onSetupLock?: (passcode: string, biometricEnabled: boolean) => Promise<void>;
  onDisableLock?: (passcode: string) => Promise<void>;
  onResetLockAndBackups?: () => Promise<void>;
}

function formatBackupDate(backup: InstalledBackupSummary): string {
  const ts = backup.exportedAt ?? backup.latestConversationUpdate ?? backup.updatedAt;
  return ts ? new Date(ts * 1000).toLocaleDateString() : "Saved import";
}

function formatLastOpened(backup: InstalledBackupSummary): string {
  return backup.lastOpenedAt
    ? `Last opened ${new Date(backup.lastOpenedAt * 1000).toLocaleDateString()}`
    : "Not opened yet";
}

function sourceLabel(sourceKind?: string | null): string {
  switch (sourceKind) {
    case "chatgpt-export":
      return "ChatGPT";
    case "openai-privacy-export":
      return "OpenAI";
    case "claude-export":
      return "Claude";
    case "gemini-takeout":
      return "Gemini";
    case "conversations-json":
      return "JSON";
    default:
      return "Archive";
  }
}

function importErrorMessage(error: unknown, file: File): string {
  const detail = error instanceof Error ? error.message : String(error || "Unknown error");
  const readableDetail = detail.replace(/^Couldn't read the file:\s*/i, "");
  return `Couldn't import "${file.name}": ${readableDetail}`;
}

export function ImportDropzone({
  onLoaded,
  installed = false,
  savedBackups = [],
  onLoadBackup,
  onRenameBackup,
  onDeleteBackup,
  importStatus,
  platform = null,
  lockState = null,
  onSetupLock,
  onDisableLock,
  onResetLockAndBackups,
}: ImportDropzoneProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [lockPanelOpen, setLockPanelOpen] = useState(false);
  const [lockPasscode, setLockPasscode] = useState("");
  const [lockBusy, setLockBusy] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const parsed = await parseChatGPTExportWithMetadata(file);
      if (!parsed.conversations.length) throw new Error("No conversations found in this export");
      await onLoaded({ ...parsed, file });
    } catch (e) {
      console.error("Chat export import failed", {
        fileName: file.name,
        fileSize: file.size,
        error: e,
      });
      setError(importErrorMessage(e, file));
    } finally {
      setBusy(false);
    }
  }

  async function submitRename() {
    if (!renameId || !renameValue.trim()) return;
    setError(null);
    try {
      await onRenameBackup?.(renameId, renameValue);
      setRenameId(null);
      setRenameValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename saved chats.");
    }
  }

  async function submitLockAction(action: "setup" | "disable") {
    if (!lockPasscode.trim()) return;
    setLockBusy(true);
    setError(null);
    try {
      if (action === "setup") await onSetupLock?.(lockPasscode, biometricEnabled);
      else await onDisableLock?.(lockPasscode);
      setLockPasscode("");
      setLockPanelOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the app lock.");
    } finally {
      setLockBusy(false);
    }
  }

  async function resetLockAndBackups() {
    if (!confirm("Reset the app lock and delete all saved chat collections from this device?")) {
      return;
    }
    setLockBusy(true);
    setError(null);
    try {
      await onResetLockAndBackups?.();
      setLockPasscode("");
      setLockPanelOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset saved chats.");
    } finally {
      setLockBusy(false);
    }
  }

  return (
    <div
      className="min-h-dvh bg-background px-4 py-4 text-foreground sm:px-6 sm:py-6"
      style={{
        paddingTop: "calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 1rem)",
      }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-end gap-2">
        {installed && lockState && (
          <button
            type="button"
            onClick={() => setLockPanelOpen((open) => !open)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors hover:bg-accent"
          >
            <Lock className="h-4 w-4" />
            {lockState.configured ? "App lock on" : "App lock"}
          </button>
        )}
        {!installed && (
          <a
            href="https://github.com/Stacer-Varien/Chat-Replay/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download desktop app</span>
            <span className="sm:hidden">Download</span>
          </a>
        )}
        <Link
          to="/help"
          className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          Help
        </Link>
        <ThemeToggle />
      </div>
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-5xl items-center justify-center text-center">
        <main className="w-full">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileArchive className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {installed ? "Chat Replay library" : "Upload your chat export"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {installed
              ? "Open a saved collection or import a new ChatGPT, OpenAI, Claude, or Gemini export."
              : "Choose a ChatGPT/OpenAI or Claude export, or a Google Takeout ZIP containing Gemini Apps activity. Nothing gets uploaded to the server."}
          </p>

          {installed && lockPanelOpen && lockState && (
            <section className="mx-auto mt-6 max-w-xl rounded-lg border bg-card p-4 text-left text-card-foreground shadow-sm">
              <div className="mb-3 flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h2 className="text-sm font-semibold">Privacy lock</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Protect saved collections with an app gate. This does not encrypt files at rest.
                  </p>
                </div>
              </div>
              <input
                type="password"
                value={lockPasscode}
                onChange={(event) => setLockPasscode(event.target.value)}
                placeholder={lockState.configured ? "Current passcode" : "New passcode"}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              {platform === "android" && lockState.biometricAvailable && !lockState.configured && (
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={biometricEnabled}
                    onChange={(event) => setBiometricEnabled(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <span>Allow Android biometric or device-credential unlock.</span>
                </label>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {lockState.configured ? (
                  <button
                    type="button"
                    disabled={lockBusy || !lockPasscode.trim()}
                    onClick={() => void submitLockAction("disable")}
                    className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-accent disabled:opacity-50"
                  >
                    Disable lock
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={lockBusy || lockPasscode.trim().length < 4}
                    onClick={() => void submitLockAction("setup")}
                    className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Enable lock
                  </button>
                )}
                <button
                  type="button"
                  disabled={lockBusy}
                  onClick={() => void resetLockAndBackups()}
                  className="inline-flex h-9 items-center rounded-md border border-destructive/40 px-3 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  Forgotten passcode reset
                </button>
              </div>
            </section>
          )}

          {installed && savedBackups.length > 0 && (
            <section className="mt-8 text-left">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Saved collections
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {platform === "android" ? (
                    <Smartphone className="h-3.5 w-3.5" />
                  ) : (
                    <Monitor className="h-3.5 w-3.5" />
                  )}
                  {platform === "android" ? "APK library" : "EXE library"}
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {savedBackups.map((backup) => (
                  <div
                    key={backup.id}
                    className="group rounded-lg border bg-card p-3 text-card-foreground transition-colors hover:bg-accent/50"
                  >
                    <button
                      type="button"
                      onClick={() => void onLoadBackup?.(backup.id)}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <Archive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium">{backup.displayName}</span>
                          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {sourceLabel(backup.sourceKind)}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {backup.originalFileName}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {backup.conversationCount} conversations · {formatBackupDate(backup)} ·{" "}
                          {formatLastOpened(backup)}
                        </span>
                      </span>
                    </button>
                    {renameId === backup.id ? (
                      <div className="mt-3 flex gap-2">
                        <input
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => void submitRename()}
                          className="rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setRenameId(backup.id);
                            setRenameValue(backup.displayName);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                          aria-label="Rename saved collection"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete "${backup.displayName}" from this device?`)) {
                              void onDeleteBackup?.(backup.id);
                            }
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Delete saved collection"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
            className={`mt-8 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 transition-colors sm:px-6 sm:py-12 ${
              drag
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/60 hover:bg-accent/50"
            }`}
          >
            {busy ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-sm text-muted-foreground">Reading your archive…</div>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-sm">
                  <span className="font-medium text-foreground">Click to choose your export</span>{" "}
                  <span className="text-muted-foreground">or drag it here</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  ChatGPT/OpenAI, Claude, Gemini Google Takeout, or conversations JSON
                </div>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".zip,.json,application/zip,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.currentTarget.value = "";
              }}
            />
          </label>

          {error && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {!error && importStatus && (
            <div className="mt-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
              {importStatus}
            </div>
          )}

          <p className="mt-6 text-xs text-muted-foreground">
            {installed
              ? "Imports open temporarily. Use Save chats after opening one to keep it in the installed app."
              : "Your data stays in this browser tab and is not saved by Chat Replay."}
          </p>
          <div className="mt-5">
            <CopyrightLabel />
          </div>
        </main>
      </div>
    </div>
  );
}
