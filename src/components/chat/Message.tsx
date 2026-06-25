import { useState } from "react";
import type { ChainItem, MessageAttachment } from "@/lib/chatgpt-import";
import { User, Sparkles, ChevronLeft, ChevronRight, FileText, Download, X } from "lucide-react";
import { Markdown } from "./Markdown";

interface Props {
  item: ChainItem;
  onPrev: () => void;
  onNext: () => void;
  highlighted?: boolean;
}

function formatBytes(size: number | null) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function isMediaType(mimeType: string | null, prefix: "audio" | "video") {
  return mimeType?.startsWith(`${prefix}/`) ?? false;
}

function attachmentMeta(attachment: MessageAttachment): string {
  return [attachment.mimeType, formatBytes(attachment.size)].filter(Boolean).join(" · ");
}

function AttachmentPreview({
  attachment,
  onClose,
}: {
  attachment: MessageAttachment;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={attachment.name}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/40 p-3 backdrop-blur-sm sm:p-6"
    >
      <div className="flex max-h-[min(42rem,calc(100dvh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-lg border bg-background text-foreground shadow-2xl">
        <div className="flex min-h-12 items-center gap-3 border-b px-3 py-2 sm:px-4">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{attachment.name}</div>
            {attachmentMeta(attachment) && (
              <div className="truncate text-xs text-muted-foreground">
                {attachmentMeta(attachment)}
              </div>
            )}
          </div>
          {attachment.url && (
            <a
              href={attachment.url}
              download={attachment.name}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" />
              Save
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close attachment"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-muted/20 p-3 sm:p-4">
          {!attachment.url ? (
            <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
              {attachment.unavailableReason ??
                "This file was referenced in the conversation but was not included in the export."}
            </div>
          ) : attachment.isImage ? (
            <img
              src={attachment.url}
              alt={attachment.name}
              className="mx-auto max-h-[calc(100dvh-10rem)] max-w-full rounded-md object-contain"
            />
          ) : isMediaType(attachment.mimeType, "video") ? (
            <video
              src={attachment.url}
              controls
              className="mx-auto max-h-[calc(100dvh-10rem)] max-w-full rounded-md bg-black"
            />
          ) : isMediaType(attachment.mimeType, "audio") ? (
            <audio src={attachment.url} controls className="w-full" />
          ) : attachment.mimeType === "application/pdf" ? (
            <iframe
              title={attachment.name}
              src={attachment.url}
              className="h-[70dvh] w-full rounded-md border bg-background"
            />
          ) : (
            <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
              Preview is not available for this file type, but the saved file can be downloaded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Message({ item, onPrev, onNext, highlighted = false }: Props) {
  const { node, index, total } = item;
  const isUser = node.role === "user";
  const hasBranches = total > 1;
  const attachments = node.attachments ?? [];
  const [previewAttachment, setPreviewAttachment] = useState<MessageAttachment | null>(null);

  return (
    <div
      id={`message-${node.id}`}
      className={`w-full min-w-0 overflow-hidden transition-colors ${
        highlighted ? "bg-primary/10" : ""
      }`}
    >
      <div className="mx-auto w-full max-w-3xl min-w-0 px-3 py-4 sm:px-4">
        <div className={`flex min-w-0 gap-2 sm:gap-4 ${isUser ? "justify-end" : "justify-start"}`}>
          {!isUser && (
            <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground sm:h-8 sm:w-8">
              <Sparkles className="h-4 w-4" />
            </div>
          )}
          <div
            className={
              isUser
                ? "flex min-w-0 max-w-[calc(100%-2.25rem)] flex-col items-end gap-1 sm:max-w-[80%]"
                : "flex min-w-0 max-w-[calc(100%-2.25rem)] flex-col items-start gap-1 sm:max-w-[85%]"
            }
          >
            <div
              className={
                isUser
                  ? "max-w-full overflow-hidden rounded-2xl bg-user-bubble px-4 py-2.5 text-user-bubble-foreground"
                  : "max-w-full overflow-hidden text-foreground"
              }
            >
              {isUser ? (
                node.text ? (
                  <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed [overflow-wrap:anywhere]">
                    {node.text}
                  </div>
                ) : null
              ) : node.text ? (
                <Markdown>{node.text}</Markdown>
              ) : null}
              {attachments.length > 0 && (
                <div className={node.text ? "mt-3 space-y-2" : "space-y-2"}>
                  {attachments.map((attachment) => {
                    if (attachment.isImage && attachment.url) {
                      return (
                        <button
                          type="button"
                          key={attachment.id}
                          onClick={() => setPreviewAttachment(attachment)}
                          className="block max-w-full overflow-hidden rounded-lg border bg-background/80 text-left"
                        >
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="max-h-80 max-w-full object-contain"
                          />
                          <span className="flex min-w-0 items-center justify-between gap-2 border-t px-3 py-2 text-xs">
                            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                            <span className="shrink-0 text-muted-foreground">
                              {attachmentMeta(attachment) || "Image"}
                            </span>
                          </span>
                        </button>
                      );
                    }
                    if (attachment.url && isMediaType(attachment.mimeType, "video")) {
                      return (
                        <div
                          key={attachment.id}
                          className="space-y-2 rounded-lg border bg-background/80 p-2"
                        >
                          <video
                            src={attachment.url}
                            controls
                            className="max-h-96 max-w-full rounded bg-black"
                          />
                          <button
                            type="button"
                            onClick={() => setPreviewAttachment(attachment)}
                            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          >
                            Open attachment details
                          </button>
                        </div>
                      );
                    }
                    if (attachment.url && isMediaType(attachment.mimeType, "audio")) {
                      return (
                        <div
                          key={attachment.id}
                          className="space-y-2 rounded-lg border bg-background/80 p-2"
                        >
                          <audio src={attachment.url} controls className="max-w-full" />
                          <button
                            type="button"
                            onClick={() => setPreviewAttachment(attachment)}
                            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          >
                            Open attachment details
                          </button>
                        </div>
                      );
                    }
                    if (!attachment.url) {
                      return (
                        <div
                          key={attachment.id}
                          className="flex items-start gap-2 rounded-lg border bg-muted/60 px-3 py-2 text-sm"
                        >
                          <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{attachment.name}</span>
                            <span className="block text-xs leading-5 text-muted-foreground">
                              {attachment.unavailableReason ??
                                "This file was referenced in the conversation but was not included in the export."}
                            </span>
                          </span>
                          {formatBytes(attachment.size) && (
                            <span className="shrink-0 text-xs opacity-70">
                              {formatBytes(attachment.size)}
                            </span>
                          )}
                        </div>
                      );
                    }
                    return (
                      <button
                        key={attachment.id}
                        type="button"
                        onClick={() => setPreviewAttachment(attachment)}
                        className="flex max-w-full items-center gap-2 rounded-lg border bg-background/80 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                        {formatBytes(attachment.size) && (
                          <span className="shrink-0 text-xs opacity-70">
                            {formatBytes(attachment.size)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {hasBranches && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <button
                  onClick={onPrev}
                  disabled={index === 0}
                  aria-label="Previous version"
                  className="rounded p-0.5 hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="tabular-nums">
                  {index + 1}/{total}
                </span>
                <button
                  onClick={onNext}
                  disabled={index === total - 1}
                  aria-label="Next version"
                  className="rounded p-0.5 hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          {isUser && (
            <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground sm:h-8 sm:w-8">
              <User className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>
      {previewAttachment && (
        <AttachmentPreview
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
}
