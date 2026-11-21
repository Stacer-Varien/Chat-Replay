const assert = require("node:assert/strict");
const { chromium } = require(process.env.CHAT_REPLAY_PLAYWRIGHT || "playwright");
let browser;
(async () => {
  browser = await chromium.connectOverCDP("http://127.0.0.1:9225", { timeout: 20000 });
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().startsWith("https://localhost"));
  if (!page) throw new Error("Preview WebView was not found");
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  page.on("dialog", (dialog) => dialog.accept());
  if (!process.env.CHAT_REPLAY_RESUME_PHONE) {
    await page
      .getByRole("button", { name: "Choose export file", exact: true })
      .waitFor({ timeout: 30000 });
    await page.screenshot({ path: "release/phone-library-before.png" });
    const cdp = await page.context().newCDPSession(page);
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: "input[type=file]",
    });
    const started = Date.now();
    await cdp.send("DOM.setFileInputFiles", {
      nodeId,
      files: ["/data/user/0/com.chatreplay.viewer.preview/files/qa-export.zip"],
    });
    await page.locator('[id^="message-"]').first().waitFor({ timeout: 180000 });
    console.log(JSON.stringify({ phoneImportMs: Date.now() - started }));
  }
  if (
    (await page.getByRole("button", { name: "Close conversation list", exact: true }).count()) === 0
  )
    await page.getByRole("button", { name: "Open conversation list", exact: true }).click();
  const search = page.getByRole("textbox", { name: "Search messages and titles" });
  await search.fill("");
  await page.getByText("187 chats", { exact: true }).waitFor();
  const query = async (text) => {
    const started = Date.now();
    await search.fill(text);
    await page.getByText("Searching…", { exact: true }).waitFor({ timeout: 10000 });
    await page
      .getByText("Searching…", { exact: true })
      .waitFor({ state: "hidden", timeout: 180000 });
    return Date.now() - started;
  };
  console.log(JSON.stringify({ firstPhoneSearchMs: await query("checklist") }));
  await query('"THE CURSE OF RAH"');
  await page
    .locator("aside button")
    .filter({ hasText: /Vegas GP: Adam Johnson discovers/i })
    .first()
    .click();
  const title = page.getByRole("heading", { name: "THE CURSE OF RAH", exact: true }).first();
  await title.waitFor({ timeout: 30000 });
  await title.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.screenshot({ path: "release/phone-rich-reply.png" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole("button", { name: "Save chats", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("November 2026 export");
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("dialog").getByRole("button", { name: "Save chats", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 180000 });
  console.log("Phone collection saved");
  await page.getByRole("button", { name: "Open conversation list", exact: true }).click();
  await page.getByRole("button", { name: "Back to library", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "Continue reading" }).waitFor();
  await page.screenshot({ path: "release/phone-library-saved.png" });
  const reopen = Date.now();
  await page.getByRole("button").filter({ hasText: "Continue reading" }).click();
  await page.locator('[id^="message-"]').first().waitFor({ timeout: 30000 });
  console.log(JSON.stringify({ phoneSavedOpenMs: Date.now() - reopen }));
  await page.getByRole("button", { name: "Open conversation list", exact: true }).click();
  const measurements = [];
  for (const text of ["checklist", "curse", "absent_9ff34", "roadmap", "checklist"])
    measurements.push({ query: text, ms: await query(text) });
  console.log(JSON.stringify({ phoneSearches: measurements }));
  await search.fill("");
  await page.getByRole("button", { name: "Close conversation list", exact: true }).last().click();
  assert.deepEqual(errors, []);
  console.log("Android import, rich rendering, saved library, reopen, and search passed");
  await browser.close();
})().catch(async (error) => {
  console.error(error);
  await browser?.close();
  process.exitCode = 1;
});
