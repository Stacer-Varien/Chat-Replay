const assert = require("node:assert/strict");
const { chromium } = require(process.env.CHAT_REPLAY_PLAYWRIGHT || "playwright");
let browser;
(async () => {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const invoke = async (method, args) => {
      const { androidBackupApi } = await import("/src/lib/installed-backups.ts");
      return androidBackupApi[method](...args);
    };
    window.chatReplayDesktop = { platform: "android" };
    for (const name of [
      "listBackups",
      "loadBackup",
      "loadConversation",
      "loadBackupArchive",
      "saveBackup",
      "saveSearchIndex",
      "renameBackup",
      "markBackupOpened",
      "deleteBackup",
      "getLockState",
      "setupLock",
      "verifyLock",
      "disableLock",
      "resetLockAndBackups",
    ])
      window.chatReplayDesktop[name] = (...args) => invoke(name, args);
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => console.error(error));
  await page.goto("http://127.0.0.1:5173");
  const data = [
    {
      id: "legacy-chat",
      title: "Saved fixture",
      current_node: "a",
      mapping: {
        a: {
          parent: null,
          children: [],
          message: {
            author: { role: "assistant" },
            content: {
              parts: [
                "<box padding={3}><title>Saved rich layout</title><text>Find the checklist.</text></box>",
              ],
            },
          },
        },
      },
    },
  ];
  await page.locator("input[type=file]").setInputFiles({
    name: "saved-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await page.getByRole("heading", { name: "Saved fixture", exact: true }).waitFor();
  await page.getByRole("button", { name: "Save chats", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("QA saved collection");
  await page.getByRole("checkbox").check();
  await page.getByRole("dialog").getByRole("button", { name: "Save chats", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 60000 });
  await page.getByRole("button", { name: "Back to library", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "Continue reading" }).click();
  await page.getByText("Saved rich layout", { exact: true }).waitFor();
  const search = page.getByRole("textbox", { name: "Search messages and titles" });
  await search.fill("checklist");
  await page.getByText("Searching…", { exact: true }).waitFor();
  await page.getByText("Searching…", { exact: true }).waitFor({ state: "hidden" });
  await page.getByRole("button").filter({ hasText: "Find the checklist" }).waitFor();
  await page.getByRole("button", { name: "Back to library", exact: true }).click();
  await page.screenshot({ path: "release/library-desktop.png" });
  // Convert the synthetic record to the old layout and a corrupt old index, then reopen.
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("chat-replay", 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const get = (store, id) =>
      new Promise((resolve) => {
        const request = db.transaction(store).objectStore(store).get(id);
        request.onsuccess = () => resolve(request.result);
      });
    const summaries = await new Promise((resolve) => {
      const r = db.transaction("backup-summaries").objectStore("backup-summaries").getAll();
      r.onsuccess = () => resolve(r.result);
    });
    const backup = summaries[0];
    const document = await get("collection-documents", backup.id + ":legacy-chat");
    const archive = await get("collection-archives", backup.id);
    const names = [
      "backups",
      "collection-info",
      "collection-documents",
      "collection-archives",
      "collection-indexes",
    ];
    await new Promise((resolve, reject) => {
      const tx = db.transaction(names, "readwrite");
      tx.objectStore("backups").put({
        id: backup.id,
        backup,
        conversations: [document.conversation],
        archiveData: archive.value,
        searchIndex: { version: 1, entries: [] },
      });
      for (const name of names.filter((n) => n !== "backups" && n !== "collection-documents"))
        tx.objectStore(name).delete(backup.id);
      tx.objectStore("collection-documents").delete(backup.id + ":legacy-chat");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.getByRole("button").filter({ hasText: "Continue reading" }).click();
  await page.getByText("Saved rich layout", { exact: true }).waitFor();
  await search.fill("checklist");
  await page.getByText("Searching…", { exact: true }).waitFor();
  await page.getByText("Searching…", { exact: true }).waitFor({ state: "hidden", timeout: 60000 });
  await page.getByRole("button").filter({ hasText: "Find the checklist" }).waitFor();
  console.log("Saved library, reopen, metadata, legacy migration, and index rebuilding passed");
  await browser.close();
})().catch(async (error) => {
  console.error(error);
  await browser?.close();
  process.exitCode = 1;
});
