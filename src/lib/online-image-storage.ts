import {
  IMAGE_CACHE_LIMIT,
  IMAGE_DOWNLOAD_LIMIT,
  type OnlineImageRecord,
  type OnlineImageStore,
} from "./online-image-types.ts";
type Meta = Omit<OnlineImageRecord, "bytes"> & { size: number };
let opened: Promise<IDBDatabase> | undefined;
function database() {
  return (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("chat-replay-online-images", 1);
    request.onupgradeneeded = () => {
      for (const name of ["meta", "data", "settings"])
        request.result.createObjectStore(name, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opened = undefined;
      reject(request.error);
    };
  }));
}
async function get<T>(store: string, key: string): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db.transaction(store).objectStore(store).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function transaction(stores: string[], action: (tx: IDBTransaction) => void) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("Could not update image cache."));
    try {
      action(tx);
    } catch (e) {
      tx.abort();
      reject(e);
    }
  });
}
async function metadata(): Promise<Meta[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db.transaction("meta").objectStore("meta").getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export const browserImageStore: OnlineImageStore = {
  async read(key) {
    const meta = await get<Meta>("meta", key);
    if (!meta) return null;
    const data = meta.size ? await get<{ bytes: ArrayBuffer }>("data", key) : null;
    if (meta.size && !data) return null;
    const touched = { ...meta, lastUsed: Date.now() };
    await transaction(["meta"], (tx) => tx.objectStore("meta").put(touched)).catch(() => {});
    const { size: _, ...record } = touched;
    return { ...record, bytes: data?.bytes ?? null };
  },
  async write(record) {
    const size = record.bytes?.byteLength ?? 0;
    if (size > IMAGE_DOWNLOAD_LIMIT) throw new Error("Image exceeds cache limit.");
    await transaction(["meta", "data"], (tx) => {
      const meta = tx.objectStore("meta"),
        data = tx.objectStore("data"),
        request = meta.getAll();
      request.onsuccess = () => {
        const previous = (request.result as Meta[])
          .filter((v) => v.key !== record.key)
          .sort((a, b) => a.lastUsed - b.lastUsed);
        let total = previous.reduce((n, v) => n + v.size, 0) + size;
        while (previous.length && (total > IMAGE_CACHE_LIMIT || previous.length >= 1000)) {
          const old = previous.shift()!;
          total -= old.size;
          meta.delete(old.key);
          data.delete(old.key);
        }
        const { bytes, ...rest } = record;
        meta.put({ ...rest, size });
        if (bytes) data.put({ key: record.key, bytes });
        else data.delete(record.key);
      };
    });
  },
  async clear() {
    await transaction(["meta", "data"], (tx) => {
      tx.objectStore("meta").clear();
      tx.objectStore("data").clear();
    });
  },
  async stats() {
    const records = await metadata();
    return {
      bytes: records.reduce((n, v) => n + v.size, 0),
      count: records.filter((v) => v.size > 0).length,
    };
  },
  async enabled() {
    return (await get<{ value: boolean }>("settings", "enabled"))?.value === true;
  },
  async setEnabled(value) {
    await transaction(["settings"], (tx) =>
      tx.objectStore("settings").put({ key: "enabled", value }),
    );
  },
};
export function imageStore(): OnlineImageStore {
  return (
    (typeof window !== "undefined" && window.chatReplayDesktop?.onlineImages) || browserImageStore
  );
}
