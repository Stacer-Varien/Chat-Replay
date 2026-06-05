const { app, BrowserWindow, ipcMain, shell } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pathToFileURL } = require("node:url");

const IPC = {
  listBackups: "chat-replay:list-backups",
  loadBackup: "chat-replay:load-backup",
  importBackup: "chat-replay:import-backup",
  deleteBackup: "chat-replay:delete-backup",
};

let appServer;
let appServerUrl;

function appRoot() {
  return path.resolve(__dirname, "..");
}

function contentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

function resolveInside(baseDir, requestPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  const relativePath = decodedPath.replace(/^\/+/, "");
  const resolved = path.resolve(baseDir, relativePath);
  const normalizedBase = path.resolve(baseDir);
  if (resolved !== normalizedBase && !resolved.startsWith(normalizedBase + path.sep)) {
    return null;
  }
  return resolved;
}

async function serveStaticAsset(req, res, clientDir) {
  const url = new URL(req.url || "/", "http://localhost");
  const filePath = resolveInside(clientDir, url.pathname);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    if (url.pathname.startsWith("/assets/")) {
      res.writeHead(404);
      res.end("Not found");
      return true;
    }
    return false;
  }

  if (!stat.isFile()) return false;

  res.setHeader("content-type", contentType(filePath));
  if (url.pathname.startsWith("/assets/")) {
    res.setHeader("cache-control", "public, max-age=31536000, immutable");
  }
  res.end(await fs.readFile(filePath));
  return true;
}

function headersFromNode(headers) {
  const webHeaders = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) webHeaders.append(key, item);
    } else if (value != null) {
      webHeaders.set(key, value);
    }
  }
  return webHeaders;
}

function requestFromNode(req, origin) {
  const method = req.method || "GET";
  const init = {
    method,
    headers: headersFromNode(req.headers),
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = Readable.toWeb(req);
    init.duplex = "half";
  }

  return new Request(new URL(req.url || "/", origin), init);
}

async function writeFetchResponse(res, response, omitBody) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (omitBody) {
    res.end();
    return;
  }
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function createAppServer() {
  const root = appRoot();
  const clientDir = path.join(root, "dist", "client");
  const serverEntry = path.join(root, "dist", "server", "server.js");
  const serverModule = await import(pathToFileURL(serverEntry).href);
  const handler = serverModule.default;

  appServer = http.createServer(async (req, res) => {
    try {
      if (await serveStaticAsset(req, res, clientDir)) return;
      const request = requestFromNode(req, appServerUrl || "http://127.0.0.1");
      const response = await handler.fetch(request, {}, {});
      await writeFetchResponse(res, response, req.method === "HEAD");
    } catch (error) {
      console.error(error);
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("The local app server failed to respond.");
    }
  });

  await new Promise((resolve) => appServer.listen(0, "127.0.0.1", resolve));
  const address = appServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start the local Electron app server");
  }
  appServerUrl = `http://127.0.0.1:${address.port}`;
  return appServerUrl;
}

function backupRoot() {
  return path.join(app.getPath("userData"), "backups");
}

function normalizeBackupId(id) {
  return typeof id === "string" && /^[a-f0-9]{16,96}$/i.test(id) ? id.toLowerCase() : null;
}

function assertBackupId(id) {
  const normalized = normalizeBackupId(id);
  if (!normalized) throw new Error("Invalid backup id");
  return normalized;
}

function backupDir(id) {
  return path.join(backupRoot(), assertBackupId(id));
}

function archiveExtension(name) {
  const ext = path.extname(typeof name === "string" ? name : "").toLowerCase();
  return ext === ".json" ? ".json" : ".zip";
}

function bufferFromPayload(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new Error("Archive data was not provided");
}

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function backupVersion(metadata) {
  return (
    finiteNumber(metadata?.exportedAt) ??
    finiteNumber(metadata?.latestConversationUpdate) ??
    finiteNumber(metadata?.sourceLastModified) ??
    Math.floor(Date.now() / 1000)
  );
}

function scrubConversationData(value) {
  if (Array.isArray(value)) return value.map(scrubConversationData);
  if (!value || typeof value !== "object") return value;

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = key === "url" ? null : scrubConversationData(item);
  }
  return out;
}

function summaryFromManifest(manifest) {
  return {
    id: manifest.id,
    originalFileName: manifest.originalFileName,
    archiveFileName: manifest.archiveFileName,
    importedAt: manifest.importedAt,
    updatedAt: manifest.updatedAt,
    exportedAt: manifest.exportedAt,
    version: manifest.version,
    conversationCount: manifest.conversationCount,
    latestConversationUpdate: manifest.latestConversationUpdate,
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function readManifest(id) {
  try {
    return await readJson(path.join(backupDir(id), "manifest.json"));
  } catch {
    return null;
  }
}

async function listBackups() {
  await fs.mkdir(backupRoot(), { recursive: true });
  const entries = await fs.readdir(backupRoot(), { withFileTypes: true });
  const backups = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !normalizeBackupId(entry.name)) continue;
    try {
      backups.push(
        summaryFromManifest(await readJson(path.join(backupRoot(), entry.name, "manifest.json"))),
      );
    } catch {
      // Ignore incomplete folders; a future successful import will replace them.
    }
  }

  return backups.sort(
    (a, b) => (b.version ?? b.importedAt ?? 0) - (a.version ?? a.importedAt ?? 0),
  );
}

async function loadBackup(_event, id) {
  const normalized = assertBackupId(id);
  const dir = backupDir(normalized);
  const [manifest, conversations] = await Promise.all([
    readJson(path.join(dir, "manifest.json")),
    readJson(path.join(dir, "conversations.json")),
  ]);

  return {
    backup: summaryFromManifest(manifest),
    conversations,
  };
}

async function importBackup(_event, payload) {
  if (!payload?.permissionConfirmed) {
    throw new Error(
      "Confirm that you own this backup or have permission to view it before importing.",
    );
  }

  const archiveData = bufferFromPayload(payload.archiveData);
  if (archiveData.byteLength === 0) throw new Error("The selected backup is empty.");

  const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
  const id = normalizeBackupId(metadata.identityKey) || sha256Hex(archiveData);
  const normalizedId = assertBackupId(id);
  const version = backupVersion(metadata);
  const importedAt = Math.floor(Date.now() / 1000);
  const existing = await readManifest(normalizedId);

  if (existing && version <= (finiteNumber(existing.version) ?? 0)) {
    return {
      action: "kept-existing",
      backup: summaryFromManifest(existing),
    };
  }

  const root = backupRoot();
  await fs.mkdir(root, { recursive: true });

  const ext = archiveExtension(payload.fileName || metadata.sourceName);
  const archiveFileName = `source${ext}`;
  const tempDir = path.join(root, `.tmp-${normalizedId}-${Date.now()}`);
  const targetDir = backupDir(normalizedId);
  const conversations = Array.isArray(payload.conversations)
    ? scrubConversationData(payload.conversations)
    : [];

  if (!conversations.length) {
    throw new Error("No readable conversations were provided for this backup.");
  }

  const manifest = {
    id: normalizedId,
    originalFileName:
      typeof payload.fileName === "string" ? payload.fileName : (metadata.sourceName ?? "backup"),
    archiveFileName,
    importedAt: existing?.importedAt ?? importedAt,
    updatedAt: importedAt,
    exportedAt: finiteNumber(metadata.exportedAt),
    latestConversationUpdate: finiteNumber(metadata.latestConversationUpdate),
    version,
    conversationCount: conversations.length,
    permissionConfirmedAt: importedAt,
    metadata: {
      sourceKind: metadata.sourceKind ?? null,
      identityKind: metadata.identityKind ?? null,
      sourceSize: finiteNumber(metadata.sourceSize),
      sourceLastModified: finiteNumber(metadata.sourceLastModified),
    },
  };

  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(tempDir, { recursive: true });
  try {
    await Promise.all([
      fs.writeFile(path.join(tempDir, archiveFileName), archiveData),
      writeJson(path.join(tempDir, "manifest.json"), manifest),
      writeJson(path.join(tempDir, "conversations.json"), conversations),
    ]);

    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.rename(tempDir, targetDir);
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }

  return {
    action: existing ? "replaced" : "created",
    backup: summaryFromManifest(manifest),
  };
}

async function deleteBackup(_event, id) {
  await fs.rm(backupDir(id), { recursive: true, force: true });
  return { ok: true };
}

function registerIpc() {
  ipcMain.handle(IPC.listBackups, listBackups);
  ipcMain.handle(IPC.loadBackup, loadBackup);
  ipcMain.handle(IPC.importBackup, importBackup);
  ipcMain.handle(IPC.deleteBackup, deleteBackup);
}

async function createWindow() {
  const startUrl = process.env.ELECTRON_RENDERER_URL || (await createAppServer());
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 640,
    title: "Chat Replay",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(startUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  await win.loadURL(startUrl);
}

registerIpc();

app
  .whenReady()
  .then(createWindow)
  .catch((error) => {
    console.error(error);
    app.quit();
  });

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((error) => console.error(error));
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (appServer) appServer.close();
});
