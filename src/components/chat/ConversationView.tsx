import { useEffect, useMemo, useRef, useState } from "react";
import type { Conversation, ImportHealthReport } from "@/lib/chatgpt-import";
import { computeChain } from "@/lib/chatgpt-import";
import { Message } from "./Message";
import { ConversationMessages } from "./ConversationMessages";
import { resolveAttachment } from "@/lib/collection-session";
import { ThemeToggle } from "@/components/ThemeToggle";
import { canUseNativePrint, printHtmlOnAndroid } from "@/lib/native-print";
import { OnlineImageSettingsButton } from "./OnlineImageSettings";
import { PrintOnlineImagesContext } from "@/lib/online-image-context";
import { cachedImagesForPrint } from "@/lib/online-images";
import {
  Activity,
  Bot,
  Download,
  GitBranch,
  Menu,
  Route,
  Save,
  MoreHorizontal,
} from "lucide-react";

function fmtDate(ts: number | null) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString();
}

function fmtShortDate(ts: number | null) {
  return ts ? new Date(ts * 1000).toLocaleDateString() : "Unknown";
}

interface ConversationViewProps {
  conversation: Conversation | null;
  onOpenSidebar?: () => void;
  onSelectConversation?: (id: string) => void;
  onSave?: () => void;
  collectionName: string;
  collectionStatus: "Saved" | "Temporary";
  selection: Record<string, number>;
  onSelectionChange: (selection: Record<string, number>) => void;
  focusNodeId?: string | null;
  report?: ImportHealthReport | null;
  viewKey?: string;
}

export function ConversationView({
  conversation,
  onOpenSidebar,
  onSelectConversation,
  onSave,
  collectionName,
  collectionStatus,
  selection,
  onSelectionChange,
  focusNodeId,
  report,
  viewKey,
}: ConversationViewProps) {
  const [assistantOnly, setAssistantOnly] = useState(false);
  const [branchMapOpen, setBranchMapOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const rawChain = useMemo(() => {
    if (!conversation) return [];
    return computeChain(conversation, selection);
  }, [conversation, selection]);

  const chain = useMemo(() => {
    if (!assistantOnly) return rawChain;
    return rawChain.filter((item) => item.node.role === "assistant");
  }, [rawChain, assistantOnly]);
  useEffect(() => {
    if (focusNodeId && conversation?.nodes[focusNodeId]?.role !== "assistant")
      setAssistantOnly(false);
  }, [focusNodeId, conversation]);

  if (!conversation) {
    return (
      <div className="flex h-full flex-col">
        <header
          className="flex items-center justify-between gap-2 border-b bg-background/80 px-3 py-3 backdrop-blur sm:px-4 lg:px-6"
          style={{
            paddingTop: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))",
          }}
        >
          {onOpenSidebar ? (
            <button
              type="button"
              onClick={onOpenSidebar}
              aria-label="Open conversation list"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
          ) : (
            <span />
          )}
          <ThemeToggle />
        </header>
        <div className="flex flex-1 items-center justify-center px-4 text-center text-muted-foreground">
          Select a conversation from the list
        </div>
      </div>
    );
  }

  function updateSel(key: string, delta: number, total: number) {
    const current = selection[key] ?? 0;
    const next = Math.min(Math.max(current + delta, 0), total - 1);
    onSelectionChange({ ...selection, [key]: next });
  }

  function setSel(key: string, index: number) {
    onSelectionChange({ ...selection, [key]: index });
  }

  async function exportPdf() {
    if (!conversation) return;
    if (
      !window.confirm(
        "Privacy check: this PDF can include private prompts, responses, and attachments. Review the destination before sharing. Continue to export?",
      )
    ) {
      return;
    }
    const target = window.chatReplayDesktop ? "chat-replay-print" : "_blank";
    const win = canUseNativePrint() ? null : window.open("", target, "width=900,height=1000");
    if (win) win.document.write("<p>Preparing your complete conversation…</p>");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const printable = await Promise.all(
      chain.map(async (item) => ({
        ...item,
        node: {
          ...item.node,
          attachments: await Promise.all(
            item.node.attachments.map(async (a) => ({
              ...a,
              url: a.url?.startsWith("asset:")
                ? await resolveAttachment(a.url).catch(() => null)
                : a.url,
            })),
          ),
        },
      })),
    );
    const onlineImages = await cachedImagesForPrint(chain.map((item) => item.node.text));
    const content = renderToStaticMarkup(
      <PrintOnlineImagesContext.Provider value={onlineImages}>
        <div>
          {printable.map((item) => (
            <Message key={item.node.id} item={item} onPrev={() => {}} onNext={() => {}} />
          ))}
        </div>
      </PrintOnlineImagesContext.Provider>,
    );
    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join("\n");
        } catch {
          return "";
        }
      })
      .join("\n");
    const escapeHtml = (s: string) =>
      s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
    const title = conversation.title || "Conversation";
    const cssTitle = title.replace(/["\\<>\r\n\f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `);
    const printableHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${styles}</style>
<style>
  @page {
    margin: 20mm 16mm 22mm 16mm;
    @bottom-right {
      content: "Page " counter(page) " of " counter(pages);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 10px;
      color: #888;
    }
    @bottom-left {
      content: "${cssTitle}";
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 10px;
      color: #888;
    }
  }
  html, body {
    background: white !important;
    color: #111 !important;
  }
  body {
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 11pt;
    line-height: 1.55;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pdf-header {
    border-bottom: 2px solid #222;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .pdf-header h1 {
    font-size: 20pt;
    margin: 0 0 6px;
    font-weight: 700;
    color: #111;
  }
  .pdf-header .meta {
    font-size: 9pt;
    color: #666;
  }
  button, [role="button"], .no-print { display: none !important; }
  article {
    padding: 14px 0;
    border-bottom: 1px solid #e5e5e5;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  article:last-child { border-bottom: none; }
  h1, h2, h3, h4, h5, h6 {
    page-break-after: avoid;
    break-after: avoid;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  p, li { orphans: 3; widows: 3; }
  pre, blockquote, table, figure, img {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  pre {
    background: #f5f5f5 !important;
    color: #111 !important;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 12px 14px !important;
    margin: 12px 0 !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 9.5pt;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    overflow: visible !important;
  }
  pre code {
    background: transparent !important;
    color: inherit !important;
    padding: 0 !important;
    font-size: inherit !important;
  }
  :not(pre) > code {
    background: #f0f0f0 !important;
    color: #111 !important;
    padding: 1px 5px;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.9em;
  }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 10pt; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f5f5f5; }
  blockquote {
    margin: 10px 0;
    padding: 4px 0 4px 12px;
    border-left: 3px solid #ccc;
    color: #555;
  }
  img { max-width: 100%; height: auto; }
  a { color: #1a5cd6; text-decoration: underline; }
</style>
</head><body>
<div class="pdf-header">
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${chain.length} messages · ${fmtDate(conversation.createTime)}${assistantOnly ? " · Assistant only" : ""}</div>
</div>
${content}
</body></html>`;

    if (canUseNativePrint()) {
      void printHtmlOnAndroid(title, printableHtml).catch((error: unknown) => {
        alert(error instanceof Error ? error.message : "Android could not open the print dialog.");
      });
      return;
    }

    if (!win) return;
    win.document.open();
    win.document.write(printableHtml);
    win.document.close();
    const doPrint = () => {
      win.focus();
      win.print();
    };
    if (win.document.readyState === "complete") setTimeout(doPrint, 400);
    else win.addEventListener("load", () => setTimeout(doPrint, 400));
  }

  return (
    <div className="flex h-full flex-col">
      <header
        className="relative z-20 shrink-0 border-b bg-background/80 px-3 py-3 backdrop-blur sm:px-4 lg:px-6"
        style={{
          paddingTop: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            {onOpenSidebar && (
              <button
                type="button"
                onClick={onOpenSidebar}
                aria-label="Open conversation list"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h1
                className="truncate text-base font-semibold sm:text-lg"
                title={conversation.title}
              >
                {conversation.title.replace(/^(?:Branch\s*·\s*)+/i, "")}
              </h1>
              <div className="mt-1 text-xs text-muted-foreground">
                {chain.length} messages · {fmtDate(conversation.createTime)}
              </div>
              <div className="mt-1 hidden min-w-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
                <span className="min-w-0 truncate" title={collectionName}>
                  {collectionName}
                </span>
                <span className="shrink-0 rounded-full border bg-muted/50 px-2 py-0.5 font-medium">
                  {collectionStatus}
                </span>
              </div>
              {(conversation.branchSourceId || conversation.branchChildren?.length) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {conversation.branchSourceId && (
                    <button
                      type="button"
                      onClick={() => onSelectConversation?.(conversation.branchSourceId!)}
                      disabled={!onSelectConversation}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none"
                      title={`Open source chat: ${conversation.branchSourceTitle ?? "Original chat"}`}
                    >
                      <GitBranch className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        Branched from {conversation.branchSourceTitle ?? "original chat"}
                      </span>
                    </button>
                  )}
                  {conversation.branchChildren?.map((branch) => (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => onSelectConversation?.(branch.id)}
                      disabled={!onSelectConversation}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none"
                      title={`Open branched chat: ${branch.title}`}
                    >
                      <GitBranch className="h-3 w-3 shrink-0" />
                      <span className="truncate">{branch.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                aria-label="Save chats"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                title="Save these chats in the installed app"
              >
                <Save className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Save chats</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => exportPdf()}
              className="hidden h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors hover:bg-accent sm:inline-flex"
              title="Export current view to PDF"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>
            <details className="reader-menu relative">
              <summary
                className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border hover:bg-accent"
                aria-label="More conversation options"
              >
                <MoreHorizontal className="h-5 w-5" />
              </summary>
              <div className="absolute right-0 top-12 z-30 flex w-56 flex-col gap-2 rounded-xl border bg-popover p-3 shadow-xl">
                <div className="border-b pb-2 text-xs sm:hidden">
                  <div className="truncate font-medium" title={collectionName}>
                    {collectionName}
                  </div>
                  <div className="mt-1 text-muted-foreground">{collectionStatus} collection</div>
                </div>
                <ThemeToggle />
                <OnlineImageSettingsButton className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent" />
                <button
                  type="button"
                  onClick={() => void exportPdf()}
                  className="rounded-lg border px-3 py-2 text-left text-sm sm:hidden"
                >
                  Export PDF
                </button>
                <button
                  type="button"
                  onClick={() => setBranchMapOpen((open) => !open)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors hover:bg-accent"
                  title="Show branch map"
                >
                  <Route className="h-3.5 w-3.5" />
                  <span>Branch map</span>
                </button>
                {report && (
                  <button
                    type="button"
                    onClick={() => setReportOpen((open) => !open)}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors hover:bg-accent"
                    title="Show import health report"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    <span>Import report</span>
                  </button>
                )}
                <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-xs transition-colors hover:bg-accent">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={assistantOnly}
                    onChange={(e) => setAssistantOnly(e.target.checked)}
                  />
                  <Bot className="h-3.5 w-3.5" />
                  <span
                    className={
                      assistantOnly ? "font-medium text-foreground" : "text-muted-foreground"
                    }
                  >
                    Assistant only
                  </span>
                  <span
                    className={`relative inline-block h-4 w-7 rounded-full transition-colors ${
                      assistantOnly ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                        assistantOnly ? "translate-x-3" : "translate-x-0"
                      }`}
                    />
                  </span>
                </label>
              </div>
            </details>
          </div>
        </div>
      </header>
      {reportOpen && report && (
        <section className="border-b bg-muted/25 px-3 py-3 sm:px-4 lg:px-6">
          <div className="mx-auto grid max-w-5xl gap-3 text-sm md:grid-cols-4">
            {[
              ["Source", report.sourceLabel],
              ["Conversations", report.conversationCount.toLocaleString()],
              ["Messages", report.messageCount.toLocaleString()],
              ["Attachments", report.attachmentCount.toLocaleString()],
              ["Images", report.imageAttachmentCount.toLocaleString()],
              ["Missing files", report.missingAttachmentCount.toLocaleString()],
              ["Branch choices", report.branchChoiceCount.toLocaleString()],
              ["Latest chat", fmtShortDate(report.latestConversationUpdate)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border bg-background px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
                <div className="mt-1 truncate font-medium">{value}</div>
              </div>
            ))}
          </div>
          {report.warnings.length > 0 && (
            <div className="mx-auto mt-3 max-w-5xl space-y-2">
              {report.warnings.map((warning) => (
                <div
                  key={warning.code}
                  className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm leading-6 text-muted-foreground"
                >
                  {warning.message}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {branchMapOpen && (
        <section className="border-b bg-muted/25 px-3 py-3 text-sm sm:px-4 lg:px-6">
          <div className="mx-auto grid max-w-5xl gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.45fr)]">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Route className="h-3.5 w-3.5" />
                Current path
              </div>
              <div className="flex min-w-0 flex-wrap gap-2">
                {rawChain.map((item, pathIndex) => (
                  <div
                    key={item.node.id}
                    className="flex max-w-full items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs"
                  >
                    <span className="shrink-0 text-muted-foreground">{pathIndex + 1}</span>
                    <span className="max-w-[10rem] truncate">
                      {item.node.role === "user" ? "Prompt" : "Response"}
                    </span>
                    {item.total > 1 && (
                      <span className="rounded bg-primary/10 px-1.5 text-primary">
                        {item.index + 1}/{item.total}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              {rawChain
                .filter((item) => item.total > 1)
                .map((item) => (
                  <div
                    key={`${item.selectionKey}-${item.node.id}`}
                    className="rounded-md border bg-background p-2"
                  >
                    <div className="mb-2 truncate text-xs font-medium">
                      {item.node.role === "user" ? "Prompt variants" : "Response variants"}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: item.total }, (_, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setSel(item.selectionKey, index)}
                          className={`h-7 rounded border px-2 text-xs ${
                            index === item.index
                              ? "border-primary bg-primary text-primary-foreground"
                              : "hover:bg-accent"
                          }`}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              {conversation.branchSourceId && (
                <button
                  type="button"
                  onClick={() => onSelectConversation?.(conversation.branchSourceId!)}
                  className="flex w-full items-center gap-2 rounded-md border bg-background px-2 py-2 text-left text-xs hover:bg-accent"
                >
                  <GitBranch className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    Branched from {conversation.branchSourceTitle ?? "original chat"}
                  </span>
                </button>
              )}
              {conversation.branchChildren?.map((branch) => (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => onSelectConversation?.(branch.id)}
                  className="flex w-full items-center gap-2 rounded-md border bg-background px-2 py-2 text-left text-xs hover:bg-accent"
                >
                  <GitBranch className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{branch.title}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
      <ConversationMessages
        key={conversation.id}
        chain={chain}
        focusNodeId={focusNodeId}
        viewKey={viewKey}
        onChange={updateSel}
      />
    </div>
  );
}
