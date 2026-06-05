import JSZip from "jszip";

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
  id: string;
  title: string;
  createTime: number | null;
  updateTime: number | null;
  /** Top-level visible message ids (children of the root/system node) */
  rootIds: string[];
  /** Map of id -> visible message (user/assistant only) */
  nodes: Record<string, TreeMessage>;
  /** Default selected child index per parent id (last-edited branch — what ChatGPT shows by default) */
  defaultSelection: Record<string, number>;
}

export type ExportSourceKind = "chatgpt-export" | "openai-privacy-export" | "conversations-json";

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

export interface ParsedChatGPTExport {
  conversations: Conversation[];
  metadata: ExportBackupMetadata;
}

interface RawNode {
  id: string;
  message: {
    id: string;
    author?: { role?: ChatRole };
    create_time?: number | null;
    content?: {
      content_type?: string;
      parts?: Array<unknown>;
      text?: string;
    } | null;
    metadata?: {
      is_visually_hidden_from_conversation?: boolean;
      attachments?: unknown[] | null;
    } | null;
  } | null;
  parent: string | null;
  children?: string[] | null;
}

interface RawConversation {
  title?: string | null;
  conversation_id?: string;
  id?: string;
  create_time?: number | null;
  update_time?: number | null;
  mapping?: Record<string, RawNode> | null;
  current_node?: string | null;
}

interface AssetHint {
  id: string | null;
  name: string | null;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
}

interface AssetSource {
  entriesById: Map<string, JSZip.JSZipObject>;
  entriesByName: Map<string, JSZip.JSZipObject>;
  displayNamesByPath: Map<string, string>;
}

type AssetCatalog = Map<string, MessageAttachment>;

function extractTextFragment(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value !== "object") return "";

  if (Array.isArray(value)) {
    return value.map(extractTextFragment).filter(Boolean).join("\n");
  }

  const item = value as Record<string, unknown>;
  const chunks: string[] = [];

  // Direct text-bearing keys (string only — avoid recursing into nested
  // "content" objects that might re-traverse the whole tree).
  for (const key of [
    "text",
    "input",
    "summary",
    "title",
    "transcript",
    "result",
    "output",
    "value",
    "answer",
    "body",
    "markdown",
  ]) {
    const v = item[key];
    if (typeof v === "string" && v.trim()) chunks.push(v);
  }

  // Known nested shapes that hold arrays/objects of further content.
  for (const key of ["parts", "children", "thoughts", "content", "results", "messages"]) {
    const v = item[key];
    if (v && (Array.isArray(v) || typeof v === "object")) {
      const sub = extractTextFragment(v);
      if (sub) chunks.push(sub);
    }
  }

  return chunks.filter(Boolean).join("\n");
}

function extractText(
  content: RawNode["message"] extends infer M
    ? M extends { content: infer C }
      ? C
      : never
    : never,
): string {
  if (!content || typeof content !== "object") return "";
  const c = content as {
    text?: unknown;
    parts?: unknown;
    content_type?: string;
    thoughts?: unknown;
    input?: unknown;
    result?: unknown;
    summary?: unknown;
    transcript?: unknown;
  };

  const pieces: string[] = [];

  // content_type-specific direct fields
  if (typeof c.text === "string" && c.text.trim()) pieces.push(c.text);
  if (typeof c.input === "string" && c.input.trim()) pieces.push(c.input);
  if (typeof c.result === "string" && c.result.trim()) pieces.push(c.result);
  if (typeof c.summary === "string" && c.summary.trim()) pieces.push(c.summary);
  if (typeof c.transcript === "string" && c.transcript.trim()) pieces.push(c.transcript);

  if (Array.isArray(c.parts)) {
    const partsText = extractTextFragment(c.parts);
    if (partsText) pieces.push(partsText);
  }

  if (Array.isArray(c.thoughts) || (c.thoughts && typeof c.thoughts === "object")) {
    const t = extractTextFragment(c.thoughts);
    if (t) pieces.push(t);
  }

  // Last-resort full traversal if nothing direct matched.
  if (!pieces.length) {
    const fallback = extractTextFragment(content);
    if (fallback) pieces.push(fallback);
  }

  return pieces.join("\n").trim();
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeAssetId(value: unknown): string | null {
  const text = stringValue(value);
  if (!text) return null;
  const withoutScheme = text.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const id = withoutScheme.split(/[/?#]/)[0]?.trim();
  return id || text;
}

function normalizeArchivePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function basename(path: string): string {
  return normalizeArchivePath(path).split("/").filter(Boolean).pop() ?? path;
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function extensionOf(name: string): string {
  const match = /\.([^.]+)$/.exec(name.toLowerCase());
  return match?.[1] ?? "";
}

function lookupKey(value: string | null | undefined): string | null {
  return value ? value.trim().toLowerCase() : null;
}

function mimeFromName(name: string | null): string | null {
  if (!name) return null;
  switch (extensionOf(name)) {
    case "apng":
      return "image/apng";
    case "avif":
      return "image/avif";
    case "gif":
      return "image/gif";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "svg":
      return "image/svg+xml";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    case "pdf":
      return "application/pdf";
    case "csv":
      return "text/csv";
    case "json":
      return "application/json";
    case "md":
      return "text/markdown";
    case "txt":
      return "text/plain";
    case "html":
      return "text/html";
    default:
      return null;
  }
}

function isImageAsset(mimeType: string | null, name: string | null): boolean {
  return Boolean(mimeType?.startsWith("image/") || mimeFromName(name)?.startsWith("image/"));
}

function extractAssetHints(message: NonNullable<RawNode["message"]>): AssetHint[] {
  const hints: AssetHint[] = [];
  const attachments = Array.isArray(message.metadata?.attachments)
    ? message.metadata.attachments
    : [];

  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== "object") continue;
    const item = attachment as Record<string, unknown>;
    const id = normalizeAssetId(item.id ?? item.file_id ?? item.asset_pointer);
    const name = stringValue(item.name ?? item.file_name ?? item.filename);
    if (!id && !name) continue;
    hints.push({
      id,
      name,
      mimeType: stringValue(item.mime_type ?? item.mimeType),
      size: numberValue(item.size ?? item.size_bytes),
      width: numberValue(item.width),
      height: numberValue(item.height),
    });
  }

  const content = message.content;
  const parts =
    content && typeof content === "object" && Array.isArray(content.parts) ? content.parts : [];

  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const item = part as Record<string, unknown>;
    const id = normalizeAssetId(item.asset_pointer ?? item.id ?? item.file_id);
    if (!id) continue;
    hints.push({
      id,
      name: stringValue(item.name ?? item.file_name ?? item.filename),
      mimeType: stringValue(item.mime_type ?? item.mimeType),
      size: numberValue(item.size ?? item.size_bytes),
      width: numberValue(item.width),
      height: numberValue(item.height),
    });
  }

  return mergeAssetHints(hints);
}

function mergeAssetHints(hints: AssetHint[]): AssetHint[] {
  const merged = new Map<string, AssetHint>();
  for (const hint of hints) {
    const key = lookupKey(hint.id) ?? `name:${lookupKey(hint.name) ?? crypto.randomUUID()}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, hint);
      continue;
    }
    merged.set(key, {
      id: existing.id ?? hint.id,
      name: existing.name ?? hint.name,
      mimeType: existing.mimeType ?? hint.mimeType,
      size: existing.size ?? hint.size,
      width: existing.width ?? hint.width,
      height: existing.height ?? hint.height,
    });
  }
  return [...merged.values()];
}

function messageHasVisiblePayload(message: NonNullable<RawNode["message"]>): boolean {
  return (
    extractText(message.content as never).trim().length > 0 || extractAssetHints(message).length > 0
  );
}

function assetCatalogKeys(hint: AssetHint): string[] {
  const keys = new Set<string>();
  const id = lookupKey(hint.id);
  const name = lookupKey(hint.name);
  if (id) keys.add(`id:${id}`);
  if (name) keys.add(`name:${name}`);
  return [...keys];
}

function resolveMessageAttachments(
  message: NonNullable<RawNode["message"]>,
  assets: AssetCatalog,
): MessageAttachment[] {
  return extractAssetHints(message).map((hint) => {
    const resolved = assetCatalogKeys(hint)
      .map((key) => assets.get(key))
      .find(Boolean);
    const id = hint.id ?? resolved?.id ?? hint.name ?? crypto.randomUUID();
    const name = hint.name ?? resolved?.name ?? id;
    const mimeType = hint.mimeType ?? resolved?.mimeType ?? mimeFromName(name);
    return {
      id,
      name,
      mimeType,
      size: hint.size ?? resolved?.size ?? null,
      width: hint.width ?? resolved?.width ?? null,
      height: hint.height ?? resolved?.height ?? null,
      url: resolved?.url ?? null,
      isImage: isImageAsset(mimeType, name),
    };
  });
}

function buildTree(
  raw: RawConversation,
  assets: AssetCatalog,
): Pick<Conversation, "rootIds" | "nodes" | "defaultSelection"> {
  const mapping = raw.mapping;
  const nodes: Record<string, TreeMessage> = {};
  const defaultSelection: Record<string, number> = {};

  if (!mapping || typeof mapping !== "object") {
    return { rootIds: [], nodes, defaultSelection };
  }

  const childrenByParent = new Map<string, string[]>();
  for (const [id, node] of Object.entries(mapping)) {
    if (!node?.parent) continue;
    const siblings = childrenByParent.get(node.parent) ?? [];
    siblings.push(id);
    childrenByParent.set(node.parent, siblings);
  }

  function rawChildren(rawId: string): string[] {
    const explicit = mapping?.[rawId]?.children;
    if (Array.isArray(explicit) && explicit.length) return explicit;
    return childrenByParent.get(rawId) ?? [];
  }

  // Build visible-only children: skip system/tool/hidden, collapse chain
  function visibleChildren(rawId: string): string[] {
    const node = mapping?.[rawId];
    if (!node) return [];
    const out: string[] = [];
    const stack = [...rawChildren(rawId)];
    while (stack.length) {
      const childId = stack.shift()!;
      const child = mapping![childId];
      if (!child) continue;
      const m = child.message;
      const role = m?.author?.role;
      const hidden = m?.metadata?.is_visually_hidden_from_conversation;
      const visible =
        m && !hidden && (role === "user" || role === "assistant") && messageHasVisiblePayload(m);
      if (visible) {
        out.push(childId);
      } else {
        // Skip this node, but include its children in this level
        stack.unshift(...rawChildren(childId));
      }
    }
    return out;
  }

  // Materialize visible nodes
  for (const [id, node] of Object.entries(mapping)) {
    const m = node?.message;
    if (!m) continue;
    const role = m.author?.role;
    if (role !== "user" && role !== "assistant") continue;
    if (m.metadata?.is_visually_hidden_from_conversation) continue;
    const text = extractText(m.content as never).trim();
    const attachments = resolveMessageAttachments(m, assets);
    if (!text && !attachments.length) continue;
    nodes[id] = {
      id,
      role,
      text,
      createTime: m.create_time ?? null,
      childrenIds: [], // filled below
      attachments,
    };
  }

  // Wire childrenIds using visible-children flattening
  for (const id of Object.keys(nodes)) {
    nodes[id].childrenIds = visibleChildren(id).filter((cid) => nodes[cid]);
  }

  // Find roots: visible nodes whose nearest visible ancestor doesn't exist
  function nearestVisibleAncestor(rawId: string): string | null {
    let cur: string | null | undefined = mapping?.[rawId]?.parent ?? null;
    const seen = new Set<string>();
    while (cur && mapping?.[cur] && !seen.has(cur)) {
      seen.add(cur);
      if (nodes[cur]) return cur;
      cur = mapping?.[cur]?.parent ?? null;
    }
    return null;
  }

  const rootIds: string[] = [];
  for (const id of Object.keys(nodes)) {
    if (nearestVisibleAncestor(id) === null) rootIds.push(id);
  }

  // Determine default selection by walking from current_node up; mark the branch index for each parent.
  const currentNode = raw.current_node;
  if (currentNode) {
    // Walk up via visible nodes
    let curVisible: string | null = nodes[currentNode] ? currentNode : null;
    if (!curVisible) {
      // climb until we hit a visible node
      let p: string | null | undefined = currentNode;
      const seen = new Set<string>();
      while (p && !seen.has(p)) {
        seen.add(p);
        if (nodes[p]) {
          curVisible = p;
          break;
        }
        p = mapping?.[p]?.parent ?? null;
      }
    }
    while (curVisible) {
      const parent = nearestVisibleAncestor(curVisible);
      if (parent) {
        const idx = nodes[parent].childrenIds.indexOf(curVisible);
        if (idx >= 0) defaultSelection[parent] = idx;
        curVisible = parent;
      } else {
        const idx = rootIds.indexOf(curVisible);
        if (idx >= 0) defaultSelection["__root__"] = idx;
        break;
      }
    }
  }

  return { rootIds, nodes, defaultSelection };
}

export function normalizeConversations(
  raw: unknown,
  assets: AssetCatalog = new Map(),
): Conversation[] {
  if (!Array.isArray(raw)) {
    throw new Error("Unexpected format: conversations.json should be a JSON array");
  }
  const result: Conversation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const c = item as RawConversation;
    const tree = buildTree(c, assets);
    if (!tree.rootIds.length) continue;
    result.push({
      id: c.conversation_id || c.id || crypto.randomUUID(),
      title: (c.title || "").trim() || "Untitled conversation",
      createTime: c.create_time ?? null,
      updateTime: c.update_time ?? null,
      ...tree,
    });
  }
  result.sort((a, b) => (b.updateTime ?? 0) - (a.updateTime ?? 0));
  return result;
}

function zipEntries(zip: JSZip): JSZip.JSZipObject[] {
  return Object.values(zip.files).filter((entry) => !entry.dir);
}

function findEntryByPath(zip: JSZip, path: string): JSZip.JSZipObject | null {
  const wanted = lookupKey(normalizeArchivePath(path));
  if (!wanted) return null;
  const exact = zip.file(path);
  if (exact) return exact;
  return (
    zipEntries(zip).find((entry) => lookupKey(normalizeArchivePath(entry.name)) === wanted) ?? null
  );
}

function describeZip(zip: JSZip): string {
  const names = zipEntries(zip)
    .slice(0, 8)
    .map((entry) => entry.name)
    .join(", ");
  return names || "(empty zip)";
}

async function parseJsonEntry(entry: JSZip.JSZipObject, logicalName: string): Promise<unknown> {
  const text = await entry.async("string");
  if (!text.trim()) {
    throw new Error(`${logicalName} is empty`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(
      `${logicalName} isn't valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

function conversationArrayFromJson(data: unknown, logicalName: string): RawConversation[] {
  if (Array.isArray(data)) return data as RawConversation[];
  if (data && typeof data === "object") {
    const conversations = (data as { conversations?: unknown }).conversations;
    if (Array.isArray(conversations)) return conversations as RawConversation[];
  }
  throw new Error(`Unexpected format: ${logicalName} should contain a conversations array`);
}

async function conversationEntriesFromManifest(zip: JSZip): Promise<JSZip.JSZipObject[]> {
  const manifest = zip.file(/(^|\/)export_manifest\.json$/i)[0];
  if (!manifest) return [];
  const data = await parseJsonEntry(manifest, "export_manifest.json");
  const logicalFiles =
    data && typeof data === "object" ? (data as { logical_files?: unknown }).logical_files : null;
  const conversations =
    logicalFiles && typeof logicalFiles === "object"
      ? (logicalFiles as Record<string, unknown>)["conversations.json"]
      : null;
  const files =
    conversations && typeof conversations === "object"
      ? (conversations as { files?: unknown }).files
      : null;
  if (!Array.isArray(files)) return [];
  return files
    .map((path) => (typeof path === "string" ? findEntryByPath(zip, path) : null))
    .filter((entry): entry is JSZip.JSZipObject => Boolean(entry));
}

async function conversationJsonEntries(zip: JSZip): Promise<JSZip.JSZipObject[]> {
  const manifestEntries = await conversationEntriesFromManifest(zip);
  if (manifestEntries.length) return manifestEntries;

  const sharded = zip
    .file(/(^|\/)conversations-\d+\.json$/i)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (sharded.length) return sharded;

  return zip.file(/(^|\/)conversations\.json$/i);
}

async function readRawConversationsFromZip(zip: JSZip): Promise<RawConversation[]> {
  const entries = await conversationJsonEntries(zip);
  if (!entries.length) {
    throw new Error(
      `conversations.json or conversations-000.json not found inside the zip. Found: ${describeZip(zip)}`,
    );
  }

  const conversations: RawConversation[] = [];
  for (const entry of entries) {
    const data = await parseJsonEntry(entry, basename(entry.name));
    conversations.push(...conversationArrayFromJson(data, basename(entry.name)));
  }
  return conversations;
}

async function readDisplayNameMap(zip: JSZip): Promise<Map<string, string>> {
  const entry = zip.file(/(^|\/)conversation_asset_file_names\.json$/i)[0];
  const displayNames = new Map<string, string>();
  if (!entry) return displayNames;
  const data = await parseJsonEntry(entry, "conversation_asset_file_names.json");
  if (!data || typeof data !== "object" || Array.isArray(data)) return displayNames;

  for (const [path, name] of Object.entries(data as Record<string, unknown>)) {
    if (typeof name !== "string" || !name.trim()) continue;
    const normalizedPath = lookupKey(normalizeArchivePath(path));
    const normalizedName = lookupKey(basename(path));
    if (normalizedPath) displayNames.set(normalizedPath, name);
    if (normalizedName) displayNames.set(normalizedName, name);
  }
  return displayNames;
}

function inferIdsFromEntry(entryName: string): string[] {
  const base = stripExtension(basename(entryName));
  const ids = new Set<string>();
  if (/^file[-_]/i.test(base)) ids.add(base);
  if (/^file-.+_image$/i.test(base)) ids.add(base.replace(/_image$/i, ""));
  const dashedId = /^(file-[A-Za-z0-9]+)_/.exec(base);
  if (dashedId?.[1]) ids.add(dashedId[1]);
  return [...ids];
}

function shouldIndexAssetEntry(
  entry: JSZip.JSZipObject,
  displayNames: Map<string, string>,
): boolean {
  const path = lookupKey(normalizeArchivePath(entry.name));
  const name = lookupKey(basename(entry.name));
  if (!path || !name) return false;
  if (displayNames.has(path) || displayNames.has(name)) return true;
  if (path.startsWith("personal/files/")) return true;
  if (/^file[-_]/i.test(name) && !name.endsWith(".json")) return true;
  return false;
}

async function buildAssetSource(zip: JSZip): Promise<AssetSource> {
  const displayNamesByPath = await readDisplayNameMap(zip);
  const source: AssetSource = {
    entriesById: new Map(),
    entriesByName: new Map(),
    displayNamesByPath,
  };

  for (const entry of zipEntries(zip)) {
    if (!shouldIndexAssetEntry(entry, displayNamesByPath)) continue;

    const pathKey = lookupKey(normalizeArchivePath(entry.name));
    const baseKey = lookupKey(basename(entry.name));
    const displayName = pathKey
      ? (displayNamesByPath.get(pathKey) ?? displayNamesByPath.get(baseKey ?? ""))
      : null;

    for (const id of inferIdsFromEntry(entry.name)) {
      const key = lookupKey(id);
      if (key && !source.entriesById.has(key)) source.entriesById.set(key, entry);
    }
    for (const name of [entry.name, basename(entry.name), displayName]) {
      const key = lookupKey(name);
      if (key && !source.entriesByName.has(key)) source.entriesByName.set(key, entry);
    }
  }

  return source;
}

function collectAssetHints(conversations: RawConversation[]): AssetHint[] {
  const hints: AssetHint[] = [];
  for (const conversation of conversations) {
    const mapping = conversation.mapping;
    if (!mapping || typeof mapping !== "object") continue;
    for (const node of Object.values(mapping)) {
      const message = node?.message;
      if (!message) continue;
      hints.push(...extractAssetHints(message));
    }
  }
  return mergeAssetHints(hints);
}

function findAssetEntry(
  hint: AssetHint,
  sources: AssetSource[],
): { entry: JSZip.JSZipObject; source: AssetSource } | null {
  const id = lookupKey(hint.id);
  const name = lookupKey(hint.name);
  for (const source of sources) {
    const entry =
      (id ? source.entriesById.get(id) : null) ?? (name ? source.entriesByName.get(name) : null);
    if (entry) return { entry, source };
  }
  return null;
}

function displayNameForEntry(
  entry: JSZip.JSZipObject,
  source: AssetSource,
  hint: AssetHint,
): string {
  const pathKey = lookupKey(normalizeArchivePath(entry.name));
  const baseKey = lookupKey(basename(entry.name));
  return (
    hint.name ??
    (pathKey ? source.displayNamesByPath.get(pathKey) : null) ??
    (baseKey ? source.displayNamesByPath.get(baseKey) : null) ??
    basename(entry.name)
  );
}

async function buildAssetCatalog(
  conversations: RawConversation[],
  sources: AssetSource[],
): Promise<AssetCatalog> {
  const catalog: AssetCatalog = new Map();
  if (!sources.length) return catalog;

  for (const hint of collectAssetHints(conversations)) {
    const match = findAssetEntry(hint, sources);
    if (!match) continue;

    const name = displayNameForEntry(match.entry, match.source, hint);
    const mimeType = hint.mimeType ?? mimeFromName(name) ?? mimeFromName(match.entry.name);
    const data = await match.entry.async("arraybuffer");
    const blob = new Blob([data], mimeType ? { type: mimeType } : undefined);
    const attachment: MessageAttachment = {
      id: hint.id ?? inferIdsFromEntry(match.entry.name)[0] ?? name,
      name,
      mimeType,
      size: hint.size ?? data.byteLength,
      width: hint.width,
      height: hint.height,
      url: URL.createObjectURL(blob),
      isImage: isImageAsset(mimeType, name),
    };

    const keys = new Set([...assetCatalogKeys(hint), ...assetCatalogKeys(attachment)]);
    for (const key of keys) catalog.set(key, attachment);
  }

  return catalog;
}

async function conversationsFromRaw(
  raw: RawConversation[],
  sources: AssetSource[],
): Promise<Conversation[]> {
  const assets = await buildAssetCatalog(raw, sources);
  const convos = normalizeConversations(raw, assets);
  if (!convos.length) {
    throw new Error("No readable conversations found in this export");
  }
  return convos;
}

async function parseConversationZip(
  zip: JSZip,
  additionalSources: AssetSource[] = [],
): Promise<Conversation[]> {
  const raw = await readRawConversationsFromZip(zip);
  const ownSource = await buildAssetSource(zip);
  return conversationsFromRaw(raw, [ownSource, ...additionalSources]);
}

async function loadNestedZip(entry: JSZip.JSZipObject): Promise<JSZip> {
  return JSZip.loadAsync(await entry.async("arraybuffer"));
}

function isUserOnlineActivityPath(path: string): boolean {
  return lookupKey(normalizeArchivePath(path))?.startsWith("user online activity/") ?? false;
}

function isNamedNestedZip(entry: JSZip.JSZipObject, prefix: string): boolean {
  const name = basename(entry.name).toLowerCase();
  return name.startsWith(prefix.toLowerCase()) && name.endsWith(".zip");
}

async function parseOpenAIPrivacyExport(zip: JSZip): Promise<Conversation[]> {
  const onlineActivityEntries = zipEntries(zip).filter((entry) =>
    isUserOnlineActivityPath(entry.name),
  );
  const conversationZipEntries = onlineActivityEntries.filter((entry) =>
    isNamedNestedZip(entry, "Conversations__"),
  );
  if (!conversationZipEntries.length) {
    throw new Error("No Conversations__*.zip file found in User Online Activity");
  }

  const fileZipEntries = onlineActivityEntries.filter((entry) =>
    isNamedNestedZip(entry, "Files__"),
  );
  const raw: RawConversation[] = [];
  const sources: AssetSource[] = [];

  for (const entry of conversationZipEntries) {
    const conversationZip = await loadNestedZip(entry);
    raw.push(...(await readRawConversationsFromZip(conversationZip)));
    sources.push(await buildAssetSource(conversationZip));
  }

  for (const entry of fileZipEntries) {
    sources.push(await buildAssetSource(await loadNestedZip(entry)));
  }

  return conversationsFromRaw(raw, sources);
}

function secondsFromFileLastModified(file: File): number | null {
  return Number.isFinite(file.lastModified) && file.lastModified > 0
    ? Math.floor(file.lastModified / 1000)
    : null;
}

function timestampFromFileName(name: string): number | null {
  const match = /(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/.exec(name);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const timestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null;
}

function latestConversationUpdate(conversations: Conversation[]): number | null {
  let latest = 0;
  for (const conversation of conversations) {
    latest = Math.max(latest, conversation.updateTime ?? 0, conversation.createTime ?? 0);
  }
  return latest > 0 ? latest : null;
}

function hexFromBuffer(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Text(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  return hexFromBuffer(await crypto.subtle.digest("SHA-256", data));
}

async function userIdentityFromZip(
  zip: JSZip,
): Promise<{ kind: ExportBackupMetadata["identityKind"]; source: string } | null> {
  const entry = zip.file(/(^|\/)user\.json$/i)[0];
  if (!entry) return null;

  try {
    const data = await parseJsonEntry(entry, "user.json");
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const user = data as Record<string, unknown>;
    const stableValue =
      stringValue(user.id) ?? stringValue(user.email) ?? stringValue(user.phone_number);
    return stableValue ? { kind: "user", source: `user:${stableValue}` } : null;
  } catch {
    return null;
  }
}

function filenameIdentity(
  name: string,
): { kind: ExportBackupMetadata["identityKind"]; source: string } | null {
  const match =
    /^([a-f0-9]{32,96})-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}/i.exec(name) ??
    /^([a-f0-9]{32,96})/i.exec(name);
  return match?.[1] ? { kind: "filename", source: `filename:${match[1].toLowerCase()}` } : null;
}

async function buildBackupMetadata(
  file: File,
  conversations: Conversation[],
  sourceKind: ExportSourceKind,
  zip: JSZip | null,
): Promise<ExportBackupMetadata> {
  const identity =
    (zip ? await userIdentityFromZip(zip) : null) ??
    filenameIdentity(file.name) ??
    ({ kind: "file", source: `file:${file.name}:${file.size}` } as const);

  return {
    sourceName: file.name,
    sourceKind,
    sourceSize: file.size,
    sourceLastModified: secondsFromFileLastModified(file),
    identityKey: await sha256Text(`chat-replay:${identity.source}`),
    identityKind: identity.kind,
    exportedAt: timestampFromFileName(file.name),
    latestConversationUpdate: latestConversationUpdate(conversations),
    conversationCount: conversations.length,
  };
}

async function parseZipFileWithMetadata(file: File): Promise<ParsedChatGPTExport> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const hasUserOnlineActivity = zipEntries(zip).some((entry) =>
    isUserOnlineActivityPath(entry.name),
  );
  const conversations = hasUserOnlineActivity
    ? await parseOpenAIPrivacyExport(zip)
    : await parseConversationZip(zip);
  return {
    conversations,
    metadata: await buildBackupMetadata(
      file,
      conversations,
      hasUserOnlineActivity ? "openai-privacy-export" : "chatgpt-export",
      zip,
    ),
  };
}

async function parseZipFile(file: File): Promise<Conversation[]> {
  return (await parseZipFileWithMetadata(file)).conversations;
}

async function parseJsonFileWithMetadata(file: File): Promise<ParsedChatGPTExport> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch (e) {
    throw new Error(
      `conversations.json isn't valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const convos = normalizeConversations(data);
  if (!convos.length) {
    throw new Error("No readable conversations found in this export");
  }
  return {
    conversations: convos,
    metadata: await buildBackupMetadata(file, convos, "conversations-json", null),
  };
}

async function parseJsonFile(file: File): Promise<Conversation[]> {
  return (await parseJsonFileWithMetadata(file)).conversations;
}

export async function parseChatGPTExport(file: File): Promise<Conversation[]> {
  return (await parseChatGPTExportWithMetadata(file)).conversations;
}

export async function parseChatGPTExportWithMetadata(file: File): Promise<ParsedChatGPTExport> {
  const name = file.name.toLowerCase();
  const looksLikeZip = name.endsWith(".zip") || file.type.includes("zip");
  const looksLikeJson = name.endsWith(".json") || file.type.includes("json");

  try {
    if (looksLikeZip) return parseZipFileWithMetadata(file);
    if (looksLikeJson) return parseJsonFileWithMetadata(file);
    try {
      return await parseZipFileWithMetadata(file);
    } catch {
      return parseJsonFileWithMetadata(file);
    }
  } catch (e) {
    throw new Error(`Couldn't read the file: ${e instanceof Error ? e.message : String(e)}`);
  }
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
