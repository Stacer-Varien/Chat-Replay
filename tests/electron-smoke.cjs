const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { _electron } = require(process.env.CHAT_REPLAY_PLAYWRIGHT || "playwright");
const rich =
  '<box background="black" padding={3}><title color="#D6B56D">Windows rich card</title><text>Searchable checklist</text></box>\n\n:::writing{variant="social_post" title="An update"}\n**Copy this draft**\n:::\n\nAfter the card.';
let app;
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "chat-replay-release-"));
  const id = "b".repeat(64);
  const saved = path.join(profile, "backups", id);
  await fs.mkdir(saved, { recursive: true });
  await fs.writeFile(
    path.join(saved, "manifest.json"),
    JSON.stringify({
      id,
      displayName: "Legacy Windows fixture",
      originalFileName: "prior.json",
      sourceKind: "conversations-json",
      importedAt: 1700000000,
      conversationCount: 1,
    }),
  );
  await fs.writeFile(
    path.join(saved, "conversations.json"),
    JSON.stringify([
      {
        id: "legacy",
        title: "Existing saved chat",
        createTime: null,
        updateTime: null,
        rootIds: ["a"],
        defaultSelection: {},
        nodes: {
          a: {
            id: "a",
            role: "assistant",
            text: rich,
            createTime: null,
            childrenIds: [],
            attachments: [],
          },
        },
      },
    ]),
  );
  app = await _electron.launch({
    executablePath:
      process.env.CHAT_REPLAY_WINDOWS_EXE || path.resolve("release/win-unpacked/Chat Replay.exe"),
    args: ["--user-data-dir=" + profile],
    timeout: 60000,
  });
  assert.equal(await app.evaluate(({ app }) => app.getVersion()), "1.6.0");
  assert.equal(await app.evaluate(({ app }) => app.getPath("userData")), profile);
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button").filter({ hasText: "Legacy Windows fixture" }).last().click();
  await page.getByText("Windows rich card", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Copy draft", exact: true }).click();
  await page.getByText("Draft copied.", { exact: true }).waitFor();
  assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), "**Copy this draft**");
  const search = page.getByRole("textbox", { name: "Search messages and titles" });
  await search.fill("checklist");
  await page.getByText("Searching…", { exact: true }).waitFor();
  await page.getByText("Searching…", { exact: true }).waitFor({ state: "hidden" });
  await page.locator("aside button").filter({ hasText: "Searchable checklist" }).waitFor();
  await fs.access(path.join(saved, "collection-summary.json"));
  await fs.access(path.join(saved, "conversations.json"));
  const summary = await page.evaluate((id) => window.chatReplayDesktop.loadBackup(id), id);
  assert.deepEqual(summary.conversations[0].nodes, {});
  assert.equal((await fs.readdir(path.join(saved, "documents"))).length, 1);
  await page.evaluate(() => {
    const open = window.open.bind(window);
    window.open = (...args) => {
      const child = open(...args);
      if (child) child.print = () => {};
      return child;
    };
  });
  page.once("dialog", (dialog) => dialog.accept());
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const popup = await popupPromise;
  await popup.getByText("After the card.", { exact: true }).waitFor();
  assert.equal(await popup.locator(".rich-box").count(), 1);
  const pdf = await app.evaluate(async ({ BrowserWindow }) => {
    const child = BrowserWindow.getAllWindows().find((w) => w.getTitle() === "Existing saved chat");
    return Array.from(await child.webContents.printToPDF({}));
  });
  assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), "%PDF-");
  await fs.writeFile("release/windows-rich-reply.pdf", Buffer.from(pdf));
  await popup.close();
  await page.screenshot({ path: "release/windows-reader.png" });
  await page.getByRole("button", { name: "Back to library", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "Continue reading" }).click();
  await page.getByText("Windows rich card", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Back to library", exact: true }).click();
  const input = [
    {
      id: "new",
      title: "New Windows import",
      current_node: "a",
      mapping: {
        a: {
          parent: null,
          children: [],
          message: { author: { role: "assistant" }, content: { parts: [rich] } },
        },
      },
    },
  ];
  await page.locator("input[type=file]").setInputFiles({
    name: "windows-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(input)),
  });
  await page.getByRole("heading", { name: "New Windows import", exact: true }).waitFor();
  await page.getByRole("button", { name: "Save chats", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("New Windows collection");
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("dialog").getByRole("button", { name: "Save chats", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 60000 });
  await page.getByRole("button", { name: "Back to library", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "Continue reading" }).click();
  await page.getByRole("heading", { name: "New Windows import", exact: true }).waitFor();
  await page.getByText("Windows rich card", { exact: true }).waitFor();
  if (process.env.CHAT_REPLAY_EXPORT) {
    await page.getByRole("button", { name: "Back to library", exact: true }).click();
    const started = Date.now();
    await page.locator("input[type=file]").setInputFiles(process.env.CHAT_REPLAY_EXPORT);
    await page.getByText("187 chats", { exact: true }).waitFor({ timeout: 120000 });
    await page.locator('[id^="message-"]').first().waitFor();
    console.log(JSON.stringify({ windowsActualImportMs: Date.now() - started }));
    await search.fill('"THE CURSE OF RAH"');
    await page.getByText("Searching…", { exact: true }).waitFor();
    await page
      .getByText("Searching…", { exact: true })
      .waitFor({ state: "hidden", timeout: 120000 });
    await page
      .locator("aside button")
      .filter({ hasText: /Vegas GP: Adam Johnson discovers/i })
      .first()
      .click();
    const title = page.getByRole("heading", { name: "THE CURSE OF RAH", exact: true }).first();
    await title.waitFor();
    await title.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.screenshot({ path: "release/windows-actual-card.png" });
    console.log("Real export rendered in packaged Windows app");
  }
  assert.deepEqual(errors, []);
  console.log(
    "Packaged Windows 1.6.0: legacy migration, lazy chat loading, saved search, copying, PDF, import, save and reopen passed",
  );
  await app.close();
})().catch(async (error) => {
  console.error(error);
  await app?.close();
  process.exitCode = 1;
});
