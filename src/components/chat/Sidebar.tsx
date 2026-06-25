import type { Conversation } from "@/lib/chatgpt-import";
import { searchConversations, type SearchHit, type SearchMode } from "@/lib/chat-search";
import { CopyrightLabel } from "@/components/CopyrightLabel";
import { cn } from "@/lib/utils";
import {
  GitBranch,
  MessageSquare,
  Upload,
  Search,
  Trash2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  selections: Record<string, Record<string, number>>;
  onSelect: (id: string, selection?: Record<string, number>, nodeId?: string | null) => void;
  onReimport: () => void;
  onClear: () => void;
  onRequestClose?: () => void;
  className?: string;
}

type AuthorFilter = "all" | "user" | "assistant";

function dateInputToTs(value: string, endOfDay = false): number | null {
  if (!value) return null;
  const d = new Date(value + (endOfDay ? "T23:59:59" : "T00:00:00"));
  const t = d.getTime();
  return Number.isFinite(t) ? t / 1000 : null;
}

export function Sidebar({
  conversations,
  activeId,
  selections,
  onSelect,
  onReimport,
  onClear,
  onRequestClose,
  className,
}: Props) {
  const [q, setQ] = useState("");
  const [author, setAuthor] = useState<AuthorFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>("visible");

  const hasFilters = author !== "all" || dateFrom !== "" || dateTo !== "";
  const isSearching = q.trim() !== "" || hasFilters;

  const searchHits = useMemo<SearchHit[]>(() => {
    const query = q.trim();
    const fromTs = dateInputToTs(dateFrom, false);
    const toTs = dateInputToTs(dateTo, true);
    if (!isSearching) return [];
    return searchConversations(conversations, {
      query,
      mode: searchMode,
      author,
      fromTs,
      toTs,
      selections,
    });
  }, [q, author, dateFrom, dateTo, conversations, isSearching, searchMode, selections]);

  function resetFilters() {
    setAuthor("all");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <aside
      className={cn(
        "flex h-full w-72 flex-col border-r bg-sidebar text-sidebar-foreground",
        className,
      )}
      style={{
        paddingTop: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))",
      }}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold">
          C
        </div>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">Chat Replay</div>
        {onRequestClose && (
          <button
            type="button"
            onClick={onRequestClose}
            aria-label="Close conversation list"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-3">
        <button
          onClick={onReimport}
          className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-sidebar-accent transition-colors"
        >
          <Upload className="h-4 w-4" />
          Import new export
        </button>
      </div>

      <div className="px-3 pt-3 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search messages & titles"
            className="w-full rounded-md border bg-background py-2 pl-8 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
            hasFilters
              ? "border-primary/40 bg-primary/5 text-foreground"
              : "hover:bg-sidebar-accent"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {hasFilters && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                on
              </span>
            )}
          </span>
          {hasFilters && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                resetFilters();
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              reset
            </span>
          )}
        </button>

        {showFilters && (
          <div className="space-y-2 rounded-md border bg-background/50 p-2.5">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Search scope
              </label>
              <div className="grid grid-cols-2 gap-1">
                {(["visible", "all-variants"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSearchMode(mode)}
                    className={`rounded px-2 py-1 text-xs transition-colors ${
                      searchMode === mode
                        ? "bg-primary text-primary-foreground"
                        : "border hover:bg-sidebar-accent"
                    }`}
                  >
                    {mode === "visible" ? "Visible" : "All variants"}
                  </button>
                ))}
              </div>
              {searchMode === "all-variants" && (
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  Searches edited and regenerated paths too. Large exports can take longer.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Author
              </label>
              <div className="flex gap-1">
                {(["all", "user", "assistant"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAuthor(opt)}
                    className={`flex-1 rounded px-2 py-1 text-xs capitalize transition-colors ${
                      author === opt
                        ? "bg-primary text-primary-foreground"
                        : "border hover:bg-sidebar-accent"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-2 pb-3">
        <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {isSearching
            ? `${searchHits.length} result${searchHits.length === 1 ? "" : "s"}`
            : `${conversations.length} chat${conversations.length === 1 ? "" : "s"}`}
        </div>
        <ul className="space-y-0.5">
          {!isSearching &&
            conversations.map((convo) => {
              const dateLabel = convo.updateTime
                ? new Date(convo.updateTime * 1000).toLocaleDateString()
                : "";
              return (
                <li key={convo.id}>
                  <button
                    onClick={() => onSelect(convo.id)}
                    className={`flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                      activeId === convo.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{convo.title}</span>
                      {(convo.branchChildren?.length || convo.branchSourceId) && (
                        <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    {dateLabel && (
                      <div className="ml-6 truncate text-[11px] text-muted-foreground">
                        {dateLabel}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          {isSearching &&
            searchHits.map((hit) => {
              return (
                <li key={hit.key}>
                  <button
                    onClick={() => onSelect(hit.conversationId, hit.selection, hit.nodeId)}
                    className={`flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                      activeId === hit.conversationId
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {hit.isVariant ? (
                        <GitBranch className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate">{hit.conversationTitle}</span>
                      <span className="shrink-0 rounded-full bg-primary/15 px-1.5 text-[10px] font-medium text-primary">
                        {hit.label}
                      </span>
                    </div>
                    <div className="ml-6 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {hit.createTime && (
                        <span className="shrink-0">
                          {new Date(hit.createTime * 1000).toLocaleDateString()}
                        </span>
                      )}
                      <span className="truncate">{hit.preview}</span>
                    </div>
                    {hit.isVariant && (
                      <div className="ml-6 text-[11px] text-primary">
                        Opens the older edited/regenerated path.
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          {isSearching && searchHits.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              No matches. Try a different keyword or reset filters.
            </li>
          )}
        </ul>
      </div>

      <div
        className="border-t p-3"
        style={{
          paddingBottom: "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <button
          onClick={onClear}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Clear archive
        </button>
        <div className="mt-3 px-3">
          <CopyrightLabel />
        </div>
      </div>
    </aside>
  );
}
