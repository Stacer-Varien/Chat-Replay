import { imageStore } from "./online-image-storage.ts";
import { findOnlineImage, ImageRequestError } from "./online-image-provider.ts";
import { imageCacheKey, imageQueries, normalizeImageQuery } from "./online-image-query.ts";
import { parseRichBlocks, type RichNode } from "./rich-blocks.ts";
import type { ImageCredit, OnlineImageRecord } from "./online-image-types.ts";

const initial = { enabled: false, loaded: false, bytes: 0, count: 0, revision: 0, error: "" };
let state = initial;
const listeners = new Set<() => void>();
export const imageSettings = {
  get: () => state,
  server: () => initial,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
function update(values: Partial<typeof state>) {
  state = { ...state, ...values };
  for (const listener of listeners) listener();
}
let initializing: Promise<void> | undefined;
export function initializeOnlineImages() {
  return (initializing ??= (async () => {
    try {
      const store = imageStore();
      const [enabled, stats] = await Promise.all([store.enabled(), store.stats()]);
      update({ enabled, loaded: true, ...stats });
    } catch {
      update({
        loaded: true,
        error: "Image preferences could not be loaded. Online downloads remain off.",
      });
    }
  })());
}
async function refreshStats() {
  try {
    update(await imageStore().stats());
  } catch {
    /* A cache failure must not interrupt reading. */
  }
}
type Job = {
  controller: AbortController;
  run: () => Promise<void>;
  reject: (error: Error) => void;
};
const queue: Job[] = [],
  controllers = new Set<AbortController>();
const requests = new Map<string, Promise<OnlineImageRecord>>();
let running = 0,
  generation = 0,
  cooldown = 0;
function pump() {
  while (running < 2 && queue.length) {
    const job = queue.shift()!;
    running++;
    void job.run().finally(() => {
      running--;
      controllers.delete(job.controller);
      pump();
    });
  }
}
export function stopOnlineImageRequests() {
  generation++;
  for (const c of controllers) c.abort();
  for (const j of queue.splice(0))
    j.reject(new DOMException("Image request cancelled.", "AbortError"));
  for (const c of [...controllers]) if (c.signal.aborted) controllers.delete(c);
}
export async function setOnlineImagesEnabled(enabled: boolean) {
  if (!enabled) stopOnlineImageRequests();
  update({ enabled, error: "" });
  try {
    await imageStore().setEnabled(enabled);
  } catch {
    update({ error: "This setting could not be saved. It applies until you close the app." });
  }
}
export async function clearOnlineImageCache() {
  await setOnlineImagesEnabled(false);
  await Promise.allSettled([...requests.values()]);
  try {
    await imageStore().clear();
    update({ bytes: 0, count: 0, revision: state.revision + 1, error: "" });
  } catch {
    update({ error: "Could not clear cached images. Try again." });
  }
}
export async function readCachedOnlineImage(query: string) {
  try {
    return await imageStore().read(await imageCacheKey(query));
  } catch {
    return null;
  }
}
export async function loadOnlineImage(query: string, retry = false): Promise<OnlineImageRecord> {
  const key = await imageCacheKey(query),
    current = generation;
  const cached = await readCachedOnlineImage(query);
  if (!retry && (cached?.bytes || (cached && cached.missingUntil > Date.now()))) return cached;
  if (current !== generation) throw new DOMException("Image request cancelled.", "AbortError");
  if (!state.enabled) throw new Error("Online images are off.");
  if (typeof navigator !== "undefined" && !navigator.onLine)
    throw new Error("Connect to the internet to find this image.");
  if (cooldown > Date.now()) throw new Error("Image search is busy. Try again shortly.");
  const requestKey = `${current}:${key}`;
  const existing = requests.get(requestKey);
  if (existing) return existing;
  const controller = new AbortController();
  controllers.add(controller);
  const promise = new Promise<OnlineImageRecord>((resolve, reject) => {
    queue.push({
      controller,
      reject,
      run: async () => {
        try {
          if (controller.signal.aborted)
            throw new DOMException("Image request cancelled.", "AbortError");
          if (cooldown > Date.now()) throw new Error("Image search is busy. Try again shortly.");
          const found = await findOnlineImage(query, key, controller.signal);
          if (controller.signal.aborted || current !== generation)
            throw new DOMException("Image request cancelled.", "AbortError");
          const record = found ?? {
            key,
            bytes: null,
            mime: "",
            credit: null,
            lastUsed: Date.now(),
            missingUntil: Date.now() + 86400000,
          };
          try {
            await imageStore().write(record);
            void refreshStats();
          } catch {
            update({
              error:
                "An image could not be cached. You can still view it until you close this chat.",
            });
          }
          resolve(record);
        } catch (error) {
          if (error instanceof ImageRequestError && error.retryAfter)
            cooldown = Date.now() + error.retryAfter;
          reject(error instanceof Error ? error : new Error("Could not load this image."));
        }
      },
    });
    pump();
  });
  requests.set(requestKey, promise);
  void promise.then(
    () => requests.delete(requestKey),
    () => requests.delete(requestKey),
  );
  return promise;
}
export type PrintableOnlineImage = { url: string; credit: ImageCredit };
export async function cachedImagesForPrint(
  texts: string[],
): Promise<Map<string, PrintableOnlineImage>> {
  const descriptions = new Set<string>();
  const walk = (nodes: RichNode[]) => {
    for (const n of nodes)
      if (n.kind === "element") {
        if (n.tag.startsWith("asyncimage"))
          for (const q of imageQueries(n.attributes.query)) descriptions.add(q);
        walk(n.children);
      }
  };
  for (const text of texts) walk(parseRichBlocks(text));
  const result = new Map<string, PrintableOnlineImage>();
  for (const query of descriptions) {
    const record = await readCachedOnlineImage(query);
    if (!record?.bytes || !record.credit) continue;
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(new Blob([record.bytes!], { type: record.mime }));
    });
    result.set(normalizeImageQuery(query), { url, credit: record.credit });
  }
  return result;
}
