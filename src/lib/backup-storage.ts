import type { Conversation, ImportHealthReport } from "./chatgpt-import";
import { conversationSummary, type SavedSearchIndex } from "./chat-search-index";
import type { InstalledBackupSummary } from "../types/installed-app";

const NAMES = [
  "backups",
  "backup-summaries",
  "collection-documents",
  "collection-archives",
  "collection-indexes",
  "collection-info",
];
let opened: Promise<IDBDatabase> | undefined;
function database() {
  if (!opened) void navigator.storage?.persist?.().catch(() => false);
  return (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("chat-replay", 3);
    request.onupgradeneeded = () => {
      const needsSummaries = !request.result.objectStoreNames.contains("backup-summaries");
      for (const name of NAMES)
        if (!request.result.objectStoreNames.contains(name))
          request.result.createObjectStore(name, { keyPath: "id" });
      if (needsSummaries) {
        const cursor = request.transaction!.objectStore("backups").openCursor();
        cursor.onsuccess = () => {
          const item = cursor.result;
          if (!item) return;
          if (item.value.backup)
            request.transaction!.objectStore("backup-summaries").put(item.value.backup);
          item.continue();
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opened = undefined;
      reject(request.error);
    };
  }));
}
async function get<T>(store: string, id: string): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function write(stores: string[], action: (tx: IDBTransaction) => void) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    try {
      action(tx);
    } catch (error) {
      tx.abort();
      reject(error);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () =>
      reject(
        tx.error ?? new Error("Could not save collection. Its previous data is still available."),
      );
  });
}
interface Info {
  id: string;
  conversations: Conversation[];
  report: ImportHealthReport | null;
}
interface RecordData {
  backup: InstalledBackupSummary;
  conversations: Conversation[];
  archiveData: Blob | ArrayBuffer | null;
  report?: ImportHealthReport | null;
  searchIndex?: SavedSearchIndex | null;
}
export async function readSummary(id: string) {
  return get<InstalledBackupSummary>("backup-summaries", id);
}
export async function listSummaries() {
  const db = await database();
  return new Promise<InstalledBackupSummary[]>((resolve, reject) => {
    const r = db.transaction("backup-summaries").objectStore("backup-summaries").getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function storeCollection(record: RecordData) {
  const id = record.backup.id;
  await write(NAMES, (tx) => {
    tx.objectStore("backup-summaries").put(record.backup);
    tx.objectStore("collection-info").put({
      id,
      conversations: record.conversations.map(conversationSummary),
      report: record.report ?? null,
    });
    tx.objectStore("collection-documents").delete(IDBKeyRange.bound(`${id}:`, `${id}:\uffff`));
    for (const conversation of record.conversations)
      tx.objectStore("collection-documents").put({
        id: `${id}:${conversation.id}`,
        backupId: id,
        conversation,
      });
    tx.objectStore("collection-archives").put({
      id,
      value:
        record.archiveData instanceof ArrayBuffer
          ? new Blob([record.archiveData])
          : record.archiveData,
    });
    tx.objectStore("collection-indexes").put({ id, value: record.searchIndex ?? null });
    // Deletion and replacement commit atomically. A quota or interruption leaves the old record intact.
    tx.objectStore("backups").delete(id);
  });
}
async function ensureCollection(id: string) {
  const existing = await get<Info>("collection-info", id);
  if (existing) return existing;
  const legacy = await get<RecordData>("backups", id);
  if (!legacy) throw new Error("This saved collection could not be found.");
  const backup = (await readSummary(id)) ?? legacy.backup;
  await storeCollection({ ...legacy, backup });
  return {
    id,
    conversations: legacy.conversations.map(conversationSummary),
    report: legacy.report ?? null,
  };
}
export async function readCollection(id: string) {
  const info = await ensureCollection(id);
  const backup = await readSummary(id);
  if (!backup) throw new Error("Collection missing.");
  return {
    backup,
    conversations: info.conversations,
    report: info.report,
    searchIndex:
      (await get<{ value: SavedSearchIndex | null }>("collection-indexes", id))?.value ?? null,
  };
}
export async function readConversation(id: string, conversationId: string) {
  await ensureCollection(id);
  const record = await get<{ conversation: Conversation }>(
    "collection-documents",
    `${id}:${conversationId}`,
  );
  if (!record) throw new Error("Conversation missing.");
  return record.conversation;
}
export async function readArchive(id: string) {
  await ensureCollection(id);
  const record = await get<{ value: Blob | ArrayBuffer | null }>("collection-archives", id);
  return record?.value instanceof Blob ? record.value.arrayBuffer() : (record?.value ?? null);
}
export async function putIndex(id: string, value: SavedSearchIndex) {
  await write(["collection-indexes"], (tx) =>
    tx.objectStore("collection-indexes").put({ id, value }),
  );
}
export async function updateSummary(id: string, changes: Partial<InstalledBackupSummary>) {
  const current = await readSummary(id);
  if (!current) throw new Error("Collection missing.");
  const next = { ...current, ...changes };
  await write(["backup-summaries"], (tx) => tx.objectStore("backup-summaries").put(next));
  return next;
}
export async function removeCollection(id: string) {
  await write(NAMES, (tx) => {
    for (const name of NAMES.filter((n) => n !== "collection-documents"))
      tx.objectStore(name).delete(id);
    const range = IDBKeyRange.bound(`${id}:`, `${id}:\uffff`);
    tx.objectStore("collection-documents").delete(range);
  });
}
export async function clearCollections() {
  await write(NAMES, (tx) => {
    for (const name of NAMES) tx.objectStore(name).clear();
  });
}
