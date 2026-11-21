import type { Conversation, TreeMessage } from "./chatgpt-import";
import { richPlainText } from "./rich-blocks.ts";

export const SEARCH_INDEX_VERSION = 2;
export interface SearchIndexEntry {
  conversationId: string;
  nodeId: string;
  role: TreeMessage["role"];
  text: string;
  createTime: number | null;
  parentId: string;
  siblingIndex: number;
  siblingCount: number;
}
export interface ArchiveSearchIndex {
  version: typeof SEARCH_INDEX_VERSION;
  conversations: Conversation[];
  entries: SearchIndexEntry[];
  trigrams?: { keys: number[]; words: number[] };
  terms?: Record<string, number[]>;
}
export type SavedSearchIndex = ArchiveSearchIndex | Blob | ArrayBuffer;
export function conversationSummary(conversation: Conversation): Conversation {
  return {
    ...conversation,
    nodes: {},
    messageCount: conversation.messageCount ?? Object.keys(conversation.nodes).length,
  };
}
export function buildArchiveSearchIndex(conversations: Conversation[]): ArchiveSearchIndex {
  const entries: SearchIndexEntry[] = [];
  const graphs = conversations.map((conversation) => {
    const parents = new Map<string, [string, number, number]>();
    const siblings = (ids: string[], parent: string) =>
      ids.forEach((id, index) => parents.set(id, [parent, index, ids.length]));
    siblings(conversation.rootIds, "__root__");
    for (const node of Object.values(conversation.nodes)) siblings(node.childrenIds, node.id);
    const nodes: Conversation["nodes"] = {};
    for (const node of Object.values(conversation.nodes)) {
      const [parentId, siblingIndex, siblingCount] = parents.get(node.id) ?? ["__root__", 0, 1];
      entries.push({
        conversationId: conversation.id,
        nodeId: node.id,
        role: node.role,
        text: richPlainText(node.text),
        createTime: node.createTime,
        parentId,
        siblingIndex,
        siblingCount,
      });
      nodes[node.id] = { ...node, text: "", attachments: [] };
    }
    return { ...conversationSummary(conversation), nodes };
  });
  return { version: SEARCH_INDEX_VERSION, conversations: graphs, entries };
}
export function isArchiveSearchIndex(value: unknown): value is ArchiveSearchIndex {
  if (!value || typeof value !== "object") return false;
  const index = value as Partial<ArchiveSearchIndex>;
  return (
    index.version === SEARCH_INDEX_VERSION &&
    Array.isArray(index.entries) &&
    Array.isArray(index.conversations)
  );
}
export async function encodeSearchIndex(index: ArchiveSearchIndex): Promise<Blob> {
  const texts: string[] = [];
  const ids = new Map<string, number>();
  const entries = index.entries.map(({ text, ...entry }) => {
    let textId = ids.get(text);
    if (textId === undefined) {
      textId = texts.length;
      texts.push(text);
      ids.set(text, textId);
    }
    return { ...entry, textId };
  });
  return new Response(
    new Blob([JSON.stringify({ ...index, entries, texts })])
      .stream()
      .pipeThrough(new CompressionStream("gzip")),
  ).blob();
}
export async function decodeSearchIndex(
  value: SavedSearchIndex,
): Promise<ArchiveSearchIndex | null> {
  try {
    const data = value instanceof ArrayBuffer ? new Blob([value]) : value;
    const decoded =
      data instanceof Blob
        ? JSON.parse(
            await new Response(data.stream().pipeThrough(new DecompressionStream("gzip"))).text(),
          )
        : data;
    if (decoded?.texts && Array.isArray(decoded.texts))
      decoded.entries = decoded.entries.map(({ textId, ...entry }: { textId: number }) => ({
        ...entry,
        text: decoded.texts[textId],
      }));
    if (decoded?.texts) delete decoded.texts;
    return isArchiveSearchIndex(decoded) ? decoded : null;
  } catch {
    return null;
  }
}
