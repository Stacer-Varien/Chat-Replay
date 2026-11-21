import type { Conversation } from "./chatgpt-import";
import { parseExportFile } from "./chatgpt-import-parser";
import {
  buildArchiveSearchIndex,
  conversationSummary,
  decodeSearchIndex,
  encodeSearchIndex,
} from "./chat-search-index";
import { SearchEngine } from "./search-engine";

let conversations: Conversation[] = [];
let engine: SearchEngine | null = null;
let indexPromise: Promise<void> = Promise.resolve();
let preparation: Promise<void> = Promise.resolve();
let assetLoads: (() => Promise<Blob>)[] = [];
let restoreReady: (() => void) | null = null;
let restorePromise: Promise<void> | null = null;
let latestSearch = 0;
const assetIds = new Map<string, string>();
const progress = (stage: string) => self.postMessage({ type: "progress", stage });
function prepareIndex() {
  indexPromise = (async () => {
    engine = new SearchEngine(buildArchiveSearchIndex(conversations));
    self.postMessage({ type: "indexed" });
    preparation = engine.prepare();
  })();
}
self.onmessage = async ({ data }: MessageEvent) => {
  const { type, value, requestId } = data;
  const reply = (value: unknown) => self.postMessage({ requestId, value });
  try {
    if (type === "open") {
      const result = await parseExportFile(value, progress, (load) =>
        String(assetLoads.push(load) - 1),
      );
      conversations = result.conversations;
      if (result.assets.length)
        assetLoads = result.assets.map((blob) => () => Promise.resolve(blob));
      reply({
        conversations: conversations.map(conversationSummary),
        metadata: result.metadata,
        report: result.report,
      });
      setTimeout(prepareIndex, 100);
    } else if (type === "conversation") reply(conversations.find((c) => c.id === value));
    else if (type === "all") reply(conversations);
    else if (type === "saved") {
      const index = value.index ? await decodeSearchIndex(value.index) : null;
      if (!index && !value.legacy) {
        reply({ rebuild: true });
        return;
      }
      if (index) {
        engine = new SearchEngine(index);
        preparation = engine.prepare();
        self.postMessage({ type: "indexed" });
      } else {
        conversations = value.legacy;
        prepareIndex();
      }
      reply({ rebuild: false });
    } else if (type === "search") {
      const generation = ++latestSearch;
      await indexPromise;
      reply(await engine!.search(value, () => generation !== latestSearch));
    } else if (type === "resolve") {
      await indexPromise;
      reply(engine!.resolve(value.conversationId, value.nodeId));
    } else if (type === "index") {
      await indexPromise;
      await preparation;
      reply(await encodeSearchIndex(engine!.index));
    } else if (type === "asset") {
      if (!assetLoads.length) {
        if (!restorePromise) {
          restorePromise = new Promise((resolve) => (restoreReady = resolve));
          self.postMessage({ type: "needArchive" });
        }
        await restorePromise;
      }
      const reference = String(value).startsWith("id:")
        ? assetIds.get(String(value).slice(3))
        : value;
      const load = assetLoads[Number(reference)];
      if (!load) throw new Error("The attachment could not be restored from the saved archive.");
      reply(await load());
    } else if (type === "restoreArchive") {
      if (value) {
        const result = await parseExportFile(
          value,
          () => {},
          (load) => String(assetLoads.push(load) - 1),
        );
        if (result.assets.length)
          assetLoads = result.assets.map((blob) => () => Promise.resolve(blob));
        for (const c of result.conversations)
          for (const n of Object.values(c.nodes))
            for (const a of n.attachments) if (a.url !== null) assetIds.set(a.id, a.url);
      }
      restoreReady?.();
    }
  } catch (error) {
    self.postMessage({ requestId, error: error instanceof Error ? error.message : String(error) });
    if (type === "restoreArchive") restoreReady?.();
  }
};
