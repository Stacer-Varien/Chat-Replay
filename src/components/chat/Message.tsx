import type { ChainItem } from "@/lib/chatgpt-import";
import { User, Sparkles, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Markdown } from "./Markdown";

interface Props {
  item: ChainItem;
  onPrev: () => void;
  onNext: () => void;
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

export function Message({ item, onPrev, onNext }: Props) {
  const { node, index, total } = item;
  const isUser = node.role === "user";
  const hasBranches = total > 1;
  const attachments = node.attachments ?? [];

  return (
    <div className="w-full min-w-0 overflow-hidden">
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
                        <a
                          key={attachment.id}
                          href={attachment.url}
                          download={attachment.name}
                          className="block overflow-hidden rounded-lg border bg-background/80"
                        >
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="max-h-80 max-w-full object-contain"
                          />
                        </a>
                      );
                    }
                    if (attachment.url && isMediaType(attachment.mimeType, "video")) {
                      return (
                        <video
                          key={attachment.id}
                          src={attachment.url}
                          controls
                          className="max-h-96 max-w-full rounded-lg border bg-black"
                        />
                      );
                    }
                    if (attachment.url && isMediaType(attachment.mimeType, "audio")) {
                      return (
                        <audio
                          key={attachment.id}
                          src={attachment.url}
                          controls
                          className="max-w-full"
                        />
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
                      <a
                        key={attachment.id}
                        href={attachment.url}
                        download={attachment.name}
                        className="flex items-center gap-2 rounded-lg border bg-background/80 px-3 py-2 text-sm hover:bg-accent"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                        {formatBytes(attachment.size) && (
                          <span className="shrink-0 text-xs opacity-70">
                            {formatBytes(attachment.size)}
                          </span>
                        )}
                      </a>
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
    </div>
  );
}
