import { useEffect, useRef, useState } from "react";
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
import {
  parseChatGPTExportWithMetadata,
  releaseConversationAssets,
  type ImportProgress,
  type ParsedChatGPTExport,
} from "@/lib/chatgpt-import";
import { createSampleArchiveFile } from "@/lib/sample-archive";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OnlineImageSettingsButton } from "./OnlineImageSettings";
import type {
  InstalledBackupApi,
  InstalledBackupSummary,
  InstalledLockState,
} from "@/types/installed-app";

interface ImportDropzoneProps {
  onLoaded: (imported: ParsedChatGPTExport, file: File | null) => void;
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

const progressLabels: Record<ImportProgress, string> = {
  opening: "Opening your export…",
  conversations: "Reading conversations…",
  attachments: "Preparing attachments and conversations…",
};

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
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [openingBackup, setOpeningBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingBackupId, setDeletingBackupId] = useState<string | null>(null);
  const [lockPanelOpen, setLockPanelOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [lockPasscode, setLockPasscode] = useState("");
  const [lockBusy, setLockBusy] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeImport = useRef<AbortController | null>(null);
  const backupOpening = useRef(false);

  useEffect(() => {
    return () => {
      const controller = activeImport.current;
      activeImport.current = null;
      controller?.abort();
    };
  }, []);

  async function handleFile(file: File, isSample = false) {
    if (activeImport.current || backupOpening.current) return;
    const controller = new AbortController();
    activeImport.current = controller;
    setError(null);
    setProgress("opening");
    let parsed: ParsedChatGPTExport | undefined;
    try {
      parsed = await parseChatGPTExportWithMetadata(file, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      controller.signal.throwIfAborted();
      if (!parsed.conversations.length) throw new Error("No conversations found in this export");
      onLoaded(parsed, isSample ? null : file);
    } catch (e) {
      if (parsed) releaseConversationAssets(parsed.conversations);
      if (controller.signal.aborted) return;
      console.error("Chat export import failed", {
        fileName: file.name,
        fileSize: file.size,
        error: e,
      });
      setError(importErrorMessage(e, file));
    } finally {
      if (activeImport.current === controller) {
        activeImport.current = null;
        setProgress(null);
      }
    }
  }

  function cancelImport() {
    const controller = activeImport.current;
    activeImport.current = null;
    controller?.abort();
    setProgress(null);
  }

  async function openBackup(id: string) {
    if (activeImport.current || backupOpening.current) return;
    backupOpening.current = true;
    setOpeningBackup(true);
    setError(null);
    try {
      await onLoadBackup?.(id);
    } finally {
      backupOpening.current = false;
      setOpeningBackup(false);
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

  async function deleteBackup(backup: InstalledBackupSummary) {
    if (deletingBackupId) return;
    if (!confirm(`Delete "${backup.displayName}" from this device?`)) return;
    setDeletingBackupId(backup.id);
    setError(null);
    try {
      await onDeleteBackup?.(backup.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the saved collection.");
    } finally {
      setDeletingBackupId(null);
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
        <div className="mr-auto flex items-center gap-2 text-sm font-semibold">
          <img src="/icon.png" alt="" className="h-9 w-9 rounded-xl" />
          Chat Replay
        </div>
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
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-accent"
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
        <OnlineImageSettingsButton compact />
        <ThemeToggle />
      </div>
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-5xl items-start justify-center pt-12 text-center sm:pt-20">
        <main className="flex w-full flex-col">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            {installed ? "Your conversations,\nwithin reach." : "A home for your conversations."}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {installed
              ? "Open a saved collection or import a new ChatGPT, OpenAI, Claude, or Gemini export."
              : "Open a ChatGPT, OpenAI, Claude, or Gemini export. Your chats stay on this device."}
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

          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!activeImport.current && !backupOpening.current) setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
            className={`order-20 mt-8 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 transition-colors sm:px-6 ${
              drag ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            {progress || openingBackup ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div role="status" className="text-sm text-muted-foreground">
                  {progress ? progressLabels[progress] : "Opening saved collection…"}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  <Upload className="h-4 w-4" />
                  Choose export file
                </button>
                <p className="text-sm text-muted-foreground">Or drop a ZIP or JSON file here.</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".zip,.json,application/zip,application/json"
              disabled={progress !== null || openingBackup}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.currentTarget.value = "";
              }}
            />
          </div>

          {progress && (
            <button
              type="button"
              onClick={cancelImport}
              className="order-20 mt-3 inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-accent"
            >
              Cancel import
            </button>
          )}

          <div className="order-20 mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <Link
              to="/help"
              hash="get-your-export"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Where do I get my export?
            </Link>
            <button
              type="button"
              onClick={() => void handleFile(createSampleArchiveFile(), true)}
              disabled={progress !== null || openingBackup}
              className="text-primary underline underline-offset-4 hover:text-primary/80 disabled:opacity-50"
            >
              Try a sample archive
            </button>
          </div>

          {error && (
            <div className="order-20 mt-4 flex items-center justify-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {!error && importStatus && (
            <div className="order-20 mt-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
              {importStatus}
            </div>
          )}

          {installed && savedBackups.length > 0 && (
            <section className="order-10 mt-10 text-left">
              {!libraryQuery && savedBackups[0] && (
                <button
                  type="button"
                  onClick={() => void openBackup(savedBackups[0].id)}
                  disabled={openingBackup || progress !== null}
                  className="continue-reading mb-6 flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border p-5 text-left"
                >
                  <span>
                    <span className="block text-xs font-medium uppercase tracking-wider text-primary">
                      Continue reading
                    </span>
                    <span className="mt-2 block text-lg font-semibold">
                      {savedBackups[0].displayName}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {savedBackups[0].conversationCount} chats ·{" "}
                      {formatLastOpened(savedBackups[0])}
                    </span>
                  </span>
                  <span className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                    Open collection
                  </span>
                </button>
              )}
              <input
                aria-label="Find a saved collection"
                value={libraryQuery}
                onChange={(event) => setLibraryQuery(event.target.value)}
                placeholder="Find a saved collection…"
                className="mb-5 w-full rounded-xl border bg-card px-4 py-3 text-base"
              />
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
                {savedBackups
                  .filter((backup) =>
                    backup.displayName.toLowerCase().includes(libraryQuery.toLowerCase()),
                  )
                  .map((backup) => (
                    <div
                      key={backup.id}
                      className="group rounded-lg border bg-card p-3 text-card-foreground transition-colors hover:bg-accent/50"
                    >
                      <button
                        type="button"
                        onClick={() => void openBackup(backup.id)}
                        disabled={
                          progress !== null || openingBackup || deletingBackupId === backup.id
                        }
                        className="flex w-full items-start gap-3 text-left"
                      >
                        <Archive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {backup.displayName}
                            </span>
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
                            disabled={deletingBackupId === backup.id}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteBackup(backup)}
                            disabled={
                              progress !== null || openingBackup || deletingBackupId !== null
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Delete saved collection"
                            title="Delete saved collection"
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

          <p className="order-20 mt-6 text-xs text-muted-foreground">
            {installed
              ? "Imports open temporarily. Use Save chats after opening one to keep it in the installed app."
              : "Chats stay in this browser tab. If you enable online images, their replacements are cached on this device."}
          </p>
          <div className="order-20 mt-5">
            <CopyrightLabel />
          </div>
        </main>
      </div>
    </div>
  );
}
