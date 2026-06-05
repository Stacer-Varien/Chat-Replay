import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Archive, Upload, FileArchive, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { CopyrightLabel } from "@/components/CopyrightLabel";
import { parseChatGPTExportWithMetadata, type ParsedChatGPTExport } from "@/lib/chatgpt-import";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { DesktopBackupSummary } from "@/types/electron";

interface ImportedFile extends ParsedChatGPTExport {
  file: File;
  permissionConfirmed: boolean;
}

interface ImportDropzoneProps {
  onLoaded: (imported: ImportedFile) => void | Promise<void>;
  desktop?: boolean;
  savedBackups?: DesktopBackupSummary[];
  onLoadBackup?: (id: string) => void | Promise<void>;
  importStatus?: string | null;
}

function formatBackupDate(backup: DesktopBackupSummary): string {
  const ts = backup.exportedAt ?? backup.latestConversationUpdate ?? backup.updatedAt;
  return ts ? new Date(ts * 1000).toLocaleDateString() : "Saved import";
}

export function ImportDropzone({
  onLoaded,
  desktop = false,
  savedBackups = [],
  onLoadBackup,
  importStatus,
}: ImportDropzoneProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    if (desktop && !permissionConfirmed) {
      setError("Confirm that you own this backup or have permission to view it first.");
      return;
    }

    setBusy(true);
    try {
      const parsed = await parseChatGPTExportWithMetadata(file);
      if (!parsed.conversations.length) throw new Error("No conversations found in this export");
      await onLoaded({ ...parsed, file, permissionConfirmed });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read export");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-4 text-foreground sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-end gap-2">
        <Link
          to="/help"
          className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          Help
        </Link>
        <ThemeToggle />
      </div>
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-xl items-center justify-center text-center">
        <main className="w-full">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileArchive className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Upload your ChatGPT Export ZIP file
          </h1>
          <p className="mt-2 text-muted-foreground">
            Choose the ZIP file you downloaded from ChatGPT or the OpenAI Privacy Portal. Nothing
            gets uploaded to the server.
          </p>

          {desktop && savedBackups.length > 0 && (
            <div className="mt-6 text-left">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Saved desktop backups
              </div>
              <div className="space-y-2">
                {savedBackups.map((backup) => (
                  <button
                    key={backup.id}
                    type="button"
                    onClick={() => void onLoadBackup?.(backup.id)}
                    className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left text-card-foreground transition-colors hover:bg-accent"
                  >
                    <Archive className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {backup.originalFileName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {backup.conversationCount} conversations · {formatBackupDate(backup)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {desktop && (
            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/30 px-3 py-3 text-left text-sm">
              <input
                type="checkbox"
                checked={permissionConfirmed}
                onChange={(e) => setPermissionConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span>
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  Permission confirmed
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  I own this backup or have permission from the owner to view it.
                </span>
              </span>
            </label>
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
                  ChatGPT Export ZIP, direct Conversations ZIP, or conversations JSON
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
            {desktop
              ? "Confirmed imports are saved locally inside this desktop app."
              : "Your data stays on this device and is read locally in your browser."}
          </p>
          <div className="mt-5">
            <CopyrightLabel />
          </div>
        </main>
      </div>
    </div>
  );
}
