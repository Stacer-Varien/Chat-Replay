import {
  computeChain,
  type ChainItem,
  type Conversation,
  type TreeMessage,
} from "@/lib/chatgpt-import";

export type SearchMode = "visible" | "all-variants";
export type SearchAuthor = "all" | "user" | "assistant";

export interface BranchPathItem {
  nodeId: string;
  index: number;
  total: number;
  selectionKey: string;
}

export interface BranchSelectionPath {
  selection: Record<string, number>;
  path: BranchPathItem[];
}

export interface SearchHit {
  key: string;
  conversationId: string;
  conversationTitle: string;
  nodeId: string | null;
  role: TreeMessage["role"] | "title";
  preview: string;
  label: string;
  selection: Record<string, number>;
  createTime: number | null;
  isVariant: boolean;
}

export interface SearchOptions {
  query: string;
  mode: SearchMode;
  author: SearchAuthor;
  fromTs: number | null;
  toTs: number | null;
  selections?: Record<string, Record<string, number>>;
  maxResults?: number;
}

function inDateRange(ts: number | null, fromTs: number | null, toTs: number | null): boolean {
  if (fromTs !== null && (ts === null || ts < fromTs)) return false;
  if (toTs !== null && (ts === null || ts > toTs)) return false;
  return true;
}

function makePreview(text: string, query: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!query) return normalized.slice(0, 150);
  const idx = normalized.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return normalized.slice(0, 150);
  const start = Math.max(0, idx - 34);
  const end = Math.min(normalized.length, idx + query.length + 84);
  return `${start > 0 ? "..." : ""}${normalized.slice(start, end)}${
    end < normalized.length ? "..." : ""
  }`;
}

function roleVariantName(role: TreeMessage["role"]): string {
  return role === "user" ? "Prompt" : role === "assistant" ? "Response" : "Message";
}

function variantLabel(node: TreeMessage, path: BranchPathItem[] | ChainItem[]): string {
  const item = path[path.length - 1];
  if (!item || item.total <= 1) return node.role === "user" ? "Prompt" : "Response";
  return `${roleVariantName(node.role)} variant ${item.index + 1} of ${item.total}`;
}

export function selectionForNode(
  conversation: Conversation,
  targetNodeId: string,
): BranchSelectionPath | null {
  const selection: Record<string, number> = {};
  const path: BranchPathItem[] = [];

  function visit(ids: string[], selectionKey: string): boolean {
    for (let index = 0; index < ids.length; index += 1) {
      const nodeId = ids[index];
      const node = conversation.nodes[nodeId];
      if (!node) continue;

      path.push({ nodeId, index, total: ids.length, selectionKey });
      selection[selectionKey] = index;

      if (nodeId === targetNodeId) return true;
      if (visit(node.childrenIds, nodeId)) return true;

      path.pop();
      delete selection[selectionKey];
    }
    return false;
  }

  return visit(conversation.rootIds, "__root__") ? { selection, path: [...path] } : null;
}

function visiblePathForNode(
  conversation: Conversation,
  nodeId: string,
  selection: Record<string, number>,
): ChainItem | null {
  return computeChain(conversation, selection).find((item) => item.node.id === nodeId) ?? null;
}

function nodeMatches(
  conversation: Conversation,
  node: TreeMessage,
  lowerQuery: string,
  options: SearchOptions,
): boolean {
  if (options.author !== "all" && node.role !== options.author) return false;
  if (
    !inDateRange(
      node.createTime ?? conversation.updateTime ?? conversation.createTime,
      options.fromTs,
      options.toTs,
    )
  ) {
    return false;
  }
  return lowerQuery === "" || node.text.toLowerCase().includes(lowerQuery);
}

export function searchConversations(
  conversations: Conversation[],
  options: SearchOptions,
): SearchHit[] {
  const query = options.query.trim();
  const lowerQuery = query.toLowerCase();
  const maxResults = options.maxResults ?? 500;
  const hits: SearchHit[] = [];

  for (const conversation of conversations) {
    if (hits.length >= maxResults) break;

    const convoDate = conversation.updateTime ?? conversation.createTime;
    if (
      query &&
      conversation.title.toLowerCase().includes(lowerQuery) &&
      inDateRange(convoDate, options.fromTs, options.toTs)
    ) {
      hits.push({
        key: `${conversation.id}:title`,
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        nodeId: null,
        role: "title",
        preview: conversation.title,
        label: "Title match",
        selection: {},
        createTime: convoDate,
        isVariant: false,
      });
    }

    const chainSelection = options.selections?.[conversation.id] ?? {};
    const visibleChain = computeChain(conversation, chainSelection);
    const visibleIds = new Set(visibleChain.map((item) => item.node.id));
    const nodes =
      options.mode === "visible"
        ? visibleChain.map((item) => item.node)
        : Object.values(conversation.nodes);

    for (const node of nodes) {
      if (hits.length >= maxResults) break;
      if (!nodeMatches(conversation, node, lowerQuery, options)) continue;

      const path = selectionForNode(conversation, node.id);
      if (!path) continue;
      const visibleItem = visiblePathForNode(conversation, node.id, path.selection);
      const isVariant = options.mode === "all-variants" && !visibleIds.has(node.id);
      hits.push({
        key: `${conversation.id}:${node.id}:${options.mode}`,
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        nodeId: node.id,
        role: node.role,
        preview: makePreview(node.text, query),
        label: visibleItem ? variantLabel(node, [visibleItem]) : variantLabel(node, path.path),
        selection: path.selection,
        createTime: node.createTime ?? convoDate,
        isVariant,
      });
    }
  }

  return hits.sort((a, b) => (b.createTime ?? 0) - (a.createTime ?? 0));
}
