export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface MessageAttachment {
  id: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  url: string | null;
  isImage: boolean;
  unavailableReason?: string;
}

export interface TreeMessage {
  id: string;
  role: ChatRole;
  text: string;
  createTime: number | null;
  childrenIds: string[];
  attachments: MessageAttachment[];
}

export interface Conversation {
  messageCount?: number;
  id: string;
  title: string;
  createTime: number | null;
  updateTime: number | null;
  /** Source conversation when this chat was created with ChatGPT's branch-in-new-chat feature. */
  branchSourceId?: string;
  branchSourceTitle?: string;
  /** Last inherited visible message before this chat's own branch continuation begins. */
  branchPointId?: string;
  inheritedMessageCount?: number;
  /** Separate conversations that were branched from this chat. */
  branchChildren?: Array<{ id: string; title: string }>;
  /** Top-level visible message ids (children of the root/system node) */
  rootIds: string[];
  /** Map of id -> visible message (user/assistant only) */
  nodes: Record<string, TreeMessage>;
  /** Default selected child index per parent id (last-edited branch — what ChatGPT shows by default) */
  defaultSelection: Record<string, number>;
}

export type ExportSourceKind =
  | "chatgpt-export"
  | "openai-privacy-export"
  | "claude-export"
  | "conversations-json"
  | "gemini-takeout";

export interface ExportBackupMetadata {
  sourceName: string;
  sourceKind: ExportSourceKind;
  sourceSize: number;
  sourceLastModified: number | null;
  identityKey: string;
  identityKind: "user" | "filename" | "file";
  exportedAt: number | null;
  latestConversationUpdate: number | null;
  conversationCount: number;
}

export interface ImportHealthWarning {
  code: string;
  message: string;
  count?: number;
}

export interface ImportHealthReport {
  sourceName: string;
  sourceKind: ExportSourceKind;
  sourceLabel: string;
  sourceSize: number;
  exportedAt: number | null;
  latestConversationUpdate: number | null;
  conversationCount: number;
  messageCount: number;
  assistantMessageCount: number;
  userMessageCount: number;
  attachmentCount: number;
  availableAttachmentCount: number;
  missingAttachmentCount: number;
  imageAttachmentCount: number;
  branchConversationCount: number;
  branchChoiceCount: number;
  alternateMessageCount: number;
  warnings: ImportHealthWarning[];
}

export interface ParsedChatGPTExport {
  conversations: Conversation[];
  metadata: ExportBackupMetadata;
  report: ImportHealthReport;
  searchIndex?: import("@/lib/chat-search-index").ArchiveSearchIndex;
  session?: import("./collection-session").CollectionSession;
}

export type ImportProgress = "opening" | "conversations" | "attachments";

export interface ImportWorkerResult extends ParsedChatGPTExport {
  assets: Blob[];
}

export type ImportWorkerMessage =
  | { type: "progress"; stage: ImportProgress }
  | { type: "complete"; result: ImportWorkerResult }
  | { type: "error"; message: string };

interface ImportOptions {
  signal?: AbortSignal;
  onProgress?: (stage: ImportProgress) => void;
}

function* attachmentsIn(conversations: Conversation[]) {
  for (const conversation of conversations) {
    for (const node of Object.values(conversation.nodes)) {
      yield* node.attachments ?? [];
    }
  }
}

export function releaseConversationAssets(conversations: Conversation[]) {
  import("./collection-session").then(({ closeCollection }) => closeCollection(conversations));
  const urls = new Set<string>();
  for (const attachment of attachmentsIn(conversations)) {
    if (attachment.url?.startsWith("blob:")) urls.add(attachment.url);
  }
  for (const url of urls) URL.revokeObjectURL(url);
}

export async function parseChatGPTExport(
  file: File,
  options?: ImportOptions,
): Promise<Conversation[]> {
  return (await parseChatGPTExportWithMetadata(file, options)).conversations;
}

export async function parseChatGPTExportWithMetadata(
  file: File,
  { signal, onProgress }: ImportOptions = {},
): Promise<ParsedChatGPTExport> {
  const { openCollectionFile } = await import("./collection-session");
  return openCollectionFile(file, { signal, onProgress });
  /* Legacy implementation retained below only until all callers use collection sessions. */
  /* c8 ignore start */
  /*
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./chatgpt-import.worker.ts", import.meta.url), {
      type: "module",
    });

    function finish() {
      signal?.removeEventListener("abort", abort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    }

    function abort() {
      finish();
      reject(signal?.reason);
    }

    function fail(message: string) {
      finish();
      reject(new Error(message));
    }

    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<ImportWorkerMessage>) => {
      switch (data.type) {
        case "progress":
          onProgress?.(data.stage);
          break;
        case "error":
          fail(data.message);
          break;
        case "complete":
          finish();
          try {
            resolve(materializeAssets(data.result));
          } catch (error) {
            reject(error);
          }
          break;
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      fail("The background importer stopped. Try opening the export again.");
    };
    worker.onmessageerror = () => fail("Could not read the result from the background importer.");
    try {
      worker.postMessage(file);
    } catch (error) {
      finish();
      reject(error);
    }
  }); */
  /* c8 ignore stop */
}

/* ----------------- Branch navigation helpers ----------------- */

export interface ChainItem {
  node: TreeMessage;
  /** index of this node among its siblings */
  index: number;
  /** total siblings at this point */
  total: number;
  /** key to use when updating selection (parent id, or "__root__") */
  selectionKey: string;
}

export function computeChain(conv: Conversation, selection: Record<string, number>): ChainItem[] {
  const chain: ChainItem[] = [];
  const sel = (key: string, fallback: number) => {
    const v = selection[key];
    return typeof v === "number" ? v : fallback;
  };

  // Pick root
  if (!conv.rootIds.length) return chain;
  const rootSelKey = "__root__";
  const rootIdx = Math.min(
    Math.max(sel(rootSelKey, conv.defaultSelection[rootSelKey] ?? 0), 0),
    conv.rootIds.length - 1,
  );
  let currentId: string | undefined = conv.rootIds[rootIdx];
  chain.push({
    node: conv.nodes[currentId],
    index: rootIdx,
    total: conv.rootIds.length,
    selectionKey: rootSelKey,
  });

  while (currentId) {
    const node: TreeMessage = conv.nodes[currentId];
    const kids: string[] = node.childrenIds;
    if (!kids.length) break;
    const key: string = node.id;
    const idx: number = Math.min(
      Math.max(sel(key, conv.defaultSelection[key] ?? kids.length - 1), 0),
      kids.length - 1,
    );
    const nextId: string = kids[idx];
    chain.push({
      node: conv.nodes[nextId],
      index: idx,
      total: kids.length,
      selectionKey: key,
    });
    currentId = nextId;
  }
  return chain;
}
