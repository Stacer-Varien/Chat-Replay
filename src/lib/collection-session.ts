import type { Conversation, ImportProgress, ParsedChatGPTExport } from "./chatgpt-import";
import type { SearchHit, SearchOptions } from "./chat-search";
import type { SavedSearchIndex } from "./chat-search-index";

const sessions = new WeakMap<Conversation[], CollectionSession>();
const assetResolvers = new Map<string, () => Promise<string>>();
let sequence = 0;
export class CollectionSession {
  readonly id = ++sequence;
  private requestId = 0;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private cache = new Map<string, Conversation>();
  private urls = new Set<string>();
  private closed = false;
  private summaries: Conversation[] = [];
  private indexReady: Promise<void>;
  private ready!: () => void;
  constructor(
    readonly worker: Worker,
    private loader?: (id: string) => Promise<Conversation>,
  ) {
    this.indexReady = new Promise((resolve) => (this.ready = resolve));
    worker.onmessage = ({ data }) => {
      if (data.type === "indexed") this.ready();
      const entry = this.pending.get(data.requestId);
      if (entry) {
        this.pending.delete(data.requestId);
        if (data.error) entry.reject(new Error(data.error));
        else entry.resolve(data.value);
      }
    };
    worker.onerror = (event) => {
      console.error("Collection worker error", event.message, event.filename, event.lineno);
      for (const item of this.pending.values())
        item.reject(new Error("The collection stopped. Close it and try again."));
      this.pending.clear();
    };
  }
  bind(summaries: Conversation[]) {
    this.summaries = summaries;
    sessions.set(summaries, this);
    return summaries;
  }
  call<T>(type: string, value?: unknown): Promise<T> {
    if (this.closed) return Promise.reject(new Error("Collection closed."));
    const requestId = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve: (value) => resolve(value as T), reject });
      this.worker.postMessage({ type, requestId, value });
    });
  }
  async getConversation(id: string) {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const conversation = this.loader
      ? await this.loader(id)
      : await this.call<Conversation>("conversation", id);
    for (const node of Object.values(conversation.nodes))
      for (const attachment of node.attachments) {
        if (
          !attachment.unavailableReason &&
          !attachment.url?.startsWith("blob:") &&
          !attachment.url?.startsWith("asset:")
        ) {
          const reference = attachment.url ?? `id:${attachment.id}`;
          const token = `asset:${this.id}:${reference}`;
          attachment.url = token;
          let urlPromise: Promise<string> | undefined;
          assetResolvers.set(
            token,
            () =>
              (urlPromise ??= (async () => {
                const blob = await this.call<Blob>("asset", reference);
                if (this.closed) throw new Error("Collection closed");
                const url = URL.createObjectURL(blob);
                this.urls.add(url);
                return url;
              })()),
          );
        }
      }
    this.cache.set(id, conversation);
    // Retain a small working set, rather than every chat the reader has visited.
    if (this.cache.size > 5) this.cache.delete(this.cache.keys().next().value!);
    return conversation;
  }
  async search(options: SearchOptions) {
    await this.indexReady;
    return this.call<SearchHit[]>("search", options);
  }
  resolve(conversationId: string, nodeId: string) {
    return this.call<Record<string, number>>("resolve", { conversationId, nodeId });
  }
  async index() {
    await this.indexReady;
    return this.call<Blob>("index");
  }
  async all() {
    return this.loader
      ? Promise.all(this.summaries.map((c) => this.loader!(c.id)))
      : this.call<Conversation[]>("all");
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.ready();
    this.worker.terminate();
    for (const item of this.pending.values()) item.reject(new Error("Collection closed"));
    this.pending.clear();
    for (const url of this.urls) URL.revokeObjectURL(url);
    for (const token of assetResolvers.keys())
      if (token.startsWith(`asset:${this.id}:`)) assetResolvers.delete(token);
    this.cache.clear();
  }
}
export function getCollection(conversations: Conversation[]) {
  return sessions.get(conversations);
}
export function closeCollection(conversations: Conversation[]) {
  sessions.get(conversations)?.close();
}
export function resolveAttachment(url: string) {
  return assetResolvers.get(url)?.() ?? Promise.resolve(url);
}

export async function openCollectionFile(
  file: File,
  {
    signal,
    onProgress,
  }: { signal?: AbortSignal; onProgress?: (stage: ImportProgress) => void } = {},
): Promise<ParsedChatGPTExport> {
  signal?.throwIfAborted();
  const worker = new Worker(new URL("./chatgpt-import.worker.ts", import.meta.url), {
    type: "module",
  });
  const session = new CollectionSession(worker);
  const original = worker.onmessage!;
  worker.onmessage = (event) => {
    if (event.data.type === "progress") onProgress?.(event.data.stage);
    else original.call(worker, event);
  };
  const abort = () => session.close();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const result = await session.call<ParsedChatGPTExport>("open", file);
    return { ...result, conversations: session.bind(result.conversations), session };
  } catch (error) {
    session.close();
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}
export async function openSavedCollection(
  conversations: Conversation[],
  index: SavedSearchIndex | null,
  loader: (id: string) => Promise<Conversation>,
  archive?: () => Promise<File | null>,
  onRebuilt?: (index: Blob) => Promise<void>,
) {
  const worker = new Worker(new URL("./chatgpt-import.worker.ts", import.meta.url), {
    type: "module",
  });
  const session = new CollectionSession(worker, loader);
  session.bind(conversations);
  // A missing/corrupt legacy index is rebuilt inside the worker, once.
  void (async () => {
    const result = await session.call<{ rebuild: boolean }>("saved", { conversations, index });
    if (result.rebuild) {
      const legacy: Conversation[] = [];
      for (const conversation of conversations) legacy.push(await loader(conversation.id));
      await session.call("saved", { conversations, legacy });
      if (onRebuilt) await onRebuilt(await session.index());
    }
  })().catch(() => session.close());
  if (archive)
    worker.addEventListener("message", async ({ data }) => {
      if (data.type === "needArchive") {
        const file = await archive();
        worker.postMessage({ type: "restoreArchive", value: file });
      }
    });
  return session;
}
