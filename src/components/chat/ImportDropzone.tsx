import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Archive, Upload, FileArchive, Loader2, AlertCircle, Download } from "lucide-react";
import { CopyrightLabel } from "@/components/CopyrightLabel";
import { parseChatGPTExportWithMetadata, type ParsedChatGPTExport } from "@/lib/chatgpt-import";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { InstalledBackupSummary } from "@/types/installed-app";

interface ImportedFile extends ParsedChatGPTExport {
  file: File;
}

interface ImportDropzoneProps {
  onLoaded: (imported: ImportedFile) => void | Promise<void>;
  installed?: boolean;
  savedBackups?: InstalledBackupSummary[];
  onLoadBackup?: (id: string) => void | Promise<void>;
  importStatus?: string | null;
}

function formatBackupDate(backup: InstalledBackupSummary): string {
  const ts = backup.exportedAt ?? backup.latestConversationUpdate ?? backup.updatedAt;
  return ts ? new Date(ts * 1000).toLocaleDateString() : "Saved import";
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
  importStatus,
}: ImportDropzoneProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
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

  return (
    <div
      className="min-h-dvh bg-background px-4 py-4 text-foreground sm:px-6 sm:py-6"
      style={{
        paddingTop: "calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 1rem)",
      }}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-end gap-2">
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
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-xl items-center justify-center text-center">
        <main className="w-full">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileArchive className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Upload your chat export
          </h1>
          <p className="mt-2 text-muted-foreground">
            Choose a ChatGPT/OpenAI export, or a Google Takeout ZIP containing Gemini Apps activity.
            Nothing gets uploaded to the server.
          </p>

          {installed && savedBackups.length > 0 && (
            <div className="mt-6 text-left">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Saved chats
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
                        {backup.displayName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {backup.originalFileName} · {backup.conversationCount} conversations ·{" "}
                        {formatBackupDate(backup)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
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
                  ChatGPT/OpenAI ZIP, Gemini Google Takeout ZIP, or conversations JSON
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
