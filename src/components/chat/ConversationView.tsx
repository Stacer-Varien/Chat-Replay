import { useMemo, useRef, useState } from "react";
import type { Conversation } from "@/lib/chatgpt-import";
import { computeChain } from "@/lib/chatgpt-import";
import { Message } from "./Message";
import { ThemeToggle } from "@/components/ThemeToggle";
import { canUseNativePrint, printHtmlOnAndroid } from "@/lib/native-print";
import { Bot, Download, GitBranch, Menu, Save } from "lucide-react";

function fmtDate(ts: number | null) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString();
}

interface ConversationViewProps {
  conversation: Conversation | null;
  onOpenSidebar?: () => void;
  onSelectConversation?: (id: string) => void;
  onSave?: () => void;
  savedName?: string;
}

export function ConversationView({
  conversation,
  onOpenSidebar,
  onSelectConversation,
  onSave,
  savedName,
}: ConversationViewProps) {
  const [selections, setSelections] = useState<Record<string, Record<string, number>>>({});
  const [assistantOnly, setAssistantOnly] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const rawChain = useMemo(() => {
    if (!conversation) return [];
    return computeChain(conversation, selections[conversation.id] ?? {});
  }, [conversation, selections]);

  const chain = useMemo(() => {
    if (!assistantOnly) return rawChain;
    return rawChain.filter((item) => item.node.role === "assistant");
  }, [rawChain, assistantOnly]);

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

  function updateSel(convId: string, key: string, delta: number, total: number) {
    setSelections((prev) => {
      const conv = { ...(prev[convId] ?? {}) };
      const current = conv[key] ?? 0;
      const next = Math.min(Math.max(current + delta, 0), total - 1);
      conv[key] = next;
      return { ...prev, [convId]: conv };
    });
  }

  function exportPdf() {
    if (!printRef.current || !conversation) return;
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
      content: "${escapeHtml(title).replace(/"/g, '\\"')}";
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
${printRef.current.innerHTML}
</body></html>`;

    if (canUseNativePrint()) {
      void printHtmlOnAndroid(title, printableHtml).catch((error: unknown) => {
        alert(error instanceof Error ? error.message : "Android could not open the print dialog.");
      });
      return;
    }

    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) return;
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
        className="border-b bg-background/80 px-3 py-3 backdrop-blur sm:px-4 lg:px-6"
        style={{
          paddingTop: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))",
        }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
              <h1 className="truncate text-sm font-semibold sm:text-base">{conversation.title}</h1>
              <div className="mt-1 text-xs text-muted-foreground">
                {chain.length} messages · {fmtDate(conversation.createTime)}
                {savedName && ` · Saved as ${savedName}`}
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
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <ThemeToggle />
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                title="Save these chats in the installed app"
              >
                <Save className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Save chats</span>
              </button>
            )}
            <button
              type="button"
              onClick={exportPdf}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors hover:bg-accent"
              title="Export current view to PDF"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>
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
                  assistantOnly
                    ? "hidden font-medium text-foreground sm:inline"
                    : "hidden text-muted-foreground sm:inline"
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
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div ref={printRef} className="divide-y divide-border/40">
          {chain.map((item) => (
            <Message
              key={item.node.id}
              item={item}
              onPrev={() => updateSel(conversation.id, item.selectionKey, -1, item.total)}
              onNext={() => updateSel(conversation.id, item.selectionKey, +1, item.total)}
            />
          ))}
        </div>
        <div className="h-24" />
      </div>
    </div>
  );
}
