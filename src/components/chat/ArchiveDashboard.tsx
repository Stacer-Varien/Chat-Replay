import { useMemo, useState } from "react";
import {
  Archive,
  ChevronLeft,
  FileImage,
  FileWarning,
  Lock,
  MessageSquare,
  Paperclip,
} from "lucide-react";
import type { Conversation, ImportHealthReport } from "@/lib/chatgpt-import";
import { archiveAttachments, getArchiveInsights } from "@/lib/archive-insights";
import type { InstalledBackupSummary } from "@/types/installed-app";

interface Props {
  conversations: Conversation[];
  report?: ImportHealthReport | null;
  savedBackups?: InstalledBackupSummary[];
  onClose: () => void;
  onSelect: (conversationId: string, nodeId?: string) => void;
}

function date(value: number | null) {
  return value ? new Date(value * 1000).toLocaleDateString() : "Unknown";
}

export function ArchiveDashboard({
  conversations,
  report,
  savedBackups = [],
  onClose,
  onSelect,
}: Props) {
  const [attachmentsOnly, setAttachmentsOnly] = useState<"all" | "images" | "missing">("all");
  const insights = useMemo(() => getArchiveInsights(conversations), [conversations]);
  const attachments = useMemo(() => archiveAttachments(conversations), [conversations]);
  const visibleAttachments = attachments.filter((attachment) =>
    attachmentsOnly === "images"
      ? attachment.isImage
      : attachmentsOnly === "missing"
        ? Boolean(attachment.unavailableReason)
        : true,
  );
  const activityMax = Math.max(1, ...insights.monthlyActivity.map((item) => item.messages));

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm hover:bg-accent"
        >
          <ChevronLeft className="h-4 w-4" /> Back to chat
        </button>
        <div>
          <h1 className="text-base font-semibold">Archive dashboard</h1>
          <p className="text-xs text-muted-foreground">
            Local archive activity, imports, attachments, and privacy status
          </p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl space-y-7 p-4 sm:p-6">
        <section>
          <h2 className="text-sm font-semibold">Your archive at a glance</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Conversations", insights.conversationCount, Archive],
              ["Messages", insights.messageCount, MessageSquare],
              ["Attachments", insights.attachmentCount, Paperclip],
              ["Images", insights.imageAttachmentCount, FileImage],
            ].map(([label, value, Icon]) => {
              const IconComponent = Icon as typeof Archive;
              return (
                <div key={String(label)} className="rounded-xl border bg-card p-4">
                  <IconComponent className="h-4 w-4 text-primary" />
                  <div className="mt-3 text-2xl font-semibold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Archive range: {date(insights.earliestTime)} – {date(insights.latestTime)} ·{" "}
            {insights.userMessageCount} prompts · {insights.assistantMessageCount} responses
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold">Activity timeline</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Messages by month, calculated only in this browser.
            </p>
            <div className="mt-5 flex h-32 items-end gap-2">
              {insights.monthlyActivity.length ? (
                insights.monthlyActivity.map((item) => (
                  <div key={item.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div
                      title={`${item.month}: ${item.messages} messages`}
                      className="w-full rounded-t bg-primary/80"
                      style={{ height: `${Math.max(8, (item.messages / activityMax) * 100)}%` }}
                    />
                    <span className="truncate text-[10px] text-muted-foreground">
                      {item.month.split(" ")[0]}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No dated messages are available.</p>
              )}
            </div>
          </section>
          <section className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold">Longest conversations</h2>
            <div className="mt-3 space-y-1">
              {insights.longestConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className="min-w-0 truncate">{conversation.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {conversation.messageCount} messages
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold">Import center</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Review the current import and saved collections before replacing an archive.
            </p>
            {report && (
              <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
                <div className="font-medium">Current: {report.sourceName}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {report.sourceLabel} · {report.conversationCount} chats · {report.messageCount}{" "}
                  messages · {report.warnings.length} warnings
                </div>
                {report.warnings.slice(0, 2).map((warning) => (
                  <p key={warning.code} className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    {warning.message}
                  </p>
                ))}
              </div>
            )}
            <div className="mt-3 space-y-2">
              {savedBackups.length ? (
                savedBackups.slice(0, 4).map((backup) => (
                  <div
                    key={backup.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="truncate">{backup.displayName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {backup.conversationCount} chats
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  This temporary import has not been saved as a collection.
                </p>
              )}
            </div>
          </section>
          <section className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Privacy status</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Chat Replay keeps parsing, search, archive insights, and attachment browsing on this
              device. It does not upload the conversations shown here.
            </p>
            <p className="mt-3 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Before sharing a PDF or source export, review it for private prompts, names,
              attachments, and credentials. Use the installed app’s App lock to protect saved
              collections.
            </p>
          </section>
        </div>

        <section className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Attachment browser</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Jump directly from an attachment to its source message.
              </p>
            </div>
            <div className="flex gap-1">
              {(["all", "images", "missing"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setAttachmentsOnly(filter)}
                  className={`rounded-md border px-2 py-1 text-xs capitalize ${attachmentsOnly === filter ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visibleAttachments.length ? (
              visibleAttachments.map((attachment) => (
                <button
                  key={`${attachment.nodeId}:${attachment.id}`}
                  type="button"
                  onClick={() => onSelect(attachment.conversationId, attachment.nodeId)}
                  className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted">
                    {attachment.isImage ? (
                      <FileImage className="h-4 w-4" />
                    ) : attachment.unavailableReason ? (
                      <FileWarning className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                  </div>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{attachment.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {attachment.conversationTitle} ·{" "}
                      {attachment.unavailableReason ?? attachment.mimeType ?? "File"}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No matching attachments.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
