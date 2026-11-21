const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.CHAT_REPLAY_PLAYWRIGHT || "playwright");
const base = process.env.CHAT_REPLAY_URL || "http://127.0.0.1:5173";
const actual = process.env.CHAT_REPLAY_EXPORT;
const output = process.env.CHAT_REPLAY_QA_OUTPUT || "release";
const rich =
  'Before the card.\n\n<box background="black" radius="lg" padding={3} gap={2}><title color="#D6B56D" size="2xl" textAlign="center">THE CURSE OF RAH</title><text color="#FFFFFF">Adam did not want the curse of Rah.</text><row gap={2}><badge>New</badge><text>Normal **Markdown** inside</text></row></box>\n\n<WritingBlock title="A reusable draft" variant="social_post">**Copy this draft**</WritingBlock>\n\n:::writing{variant="email" subject="Hello"}\nAnother draft\n:::\n\n~~~html\n<box>Code example</box>\n~~~\n\nAfter the card.';
function chat(id, text) {
  return {
    id,
    title: id,
    current_node: "a",
    mapping: {
      u: {
        parent: null,
        children: ["a"],
        message: { author: { role: "user" }, content: { parts: ["Please format this reply."] } },
      },
      a: {
        parent: "u",
        children: [],
        message: { author: { role: "assistant" }, content: { parts: [text] } },
      },
    },
  };
}
let runningBrowser;
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  runningBrowser = browser;
  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("Page error", e.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("Browser console", msg.text());
  });
  await page.goto(base);
  await page.getByRole("button", { name: "Try a sample archive" }).waitFor();
  console.log("Picker ready");
  await page.locator("input[type=file]").setInputFiles({
    name: "rich-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([chat("Rich layout fixture", rich), chat("Older fixture", "Other text")]),
    ),
  });
  await page
    .getByRole("heading", { name: "Rich layout fixture", exact: true })
    .waitFor({ timeout: 60000 });
  console.log("Fixture open");
  await page.getByText("THE CURSE OF RAH", { exact: true }).waitFor();
  assert.equal(await page.locator(".rich-box").count(), 1);
  assert.equal(await page.getByRole("button", { name: "Copy draft" }).count(), 2);
  await page.getByRole("button", { name: "Copy draft" }).first().click();
  await page.getByText("Draft copied.", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "**Copy this draft**");
  page.once("dialog", (dialog) => dialog.accept());
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Export PDF" }).click();
  const popup = await popupPromise;
  await popup.getByText("After the card.", { exact: true }).waitFor();
  assert.equal(await popup.locator(".rich-box").count(), 1);
  await popup.pdf({ path: output + "/rich-reply.pdf" });
  await popup.close();
  await page.screenshot({ path: output + "/reader-desktop.png" });
  const search = page.getByRole("textbox", { name: "Search messages and titles" });
  await search.fill("curse");
  await page
    .getByText(/result/)
    .first()
    .waitFor();
  await page.getByRole("button").filter({ hasText: "Adam did not want" }).first().waitFor();
  await search.fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByLabel("More conversation options", { exact: true }).click();
  await page.getByRole("button", { name: "Branch map", exact: true }).click();
  await page.getByText("Current path", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Branch map", exact: true }).click();
  await page.getByLabel("More conversation options", { exact: true }).click();
  await page.screenshot({ path: output + "/reader-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.getByRole("button", { name: "Close archive", exact: true }).click();
  if (actual) {
    await page.locator("input[type=file]").setInputFiles(actual);
    await page.getByRole("button", { name: "Cancel import", exact: true }).click();
    await page.getByRole("button", { name: "Choose export file", exact: true }).waitFor();
    assert.equal(await page.locator('[id^="message-"]').count(), 0);
    console.log("Cancelled import returned to the picker without a partial collection");
    await page.evaluate(() => {
      window.qaTicks = [];
      let last = performance.now();
      window.qaHeartbeat = setInterval(() => {
        const now = performance.now();
        window.qaTicks.push(now - last);
        last = now;
      }, 50);
    });
    const started = Date.now();
    await page.locator("input[type=file]").setInputFiles(actual);
    await page.locator("main h1").waitFor({ timeout: 120000 });
    await page.locator('[id^="message-"]').first().waitFor({ timeout: 120000 });
    console.log(JSON.stringify({ actualImportMs: Date.now() - started }));
    console.log(
      JSON.stringify(
        await page.evaluate(() => {
          clearInterval(window.qaHeartbeat);
          return {
            mainThreadLongestTickMs: Math.round(Math.max(...window.qaTicks)),
            heartbeatTicks: window.qaTicks.length,
          };
        }),
      ),
    );
    await page.getByText("187 chats", { exact: true }).waitFor();
    const input = page.getByRole("textbox", { name: "Search messages and titles" });
    const measures = [];
    for (const query of ["checklist", "curse", "absent_9ff34", "roadmap"]) {
      const t = Date.now();
      await input.fill(query);
      await page.getByText("Searching…", { exact: true }).waitFor({ timeout: 10000 });
      await page
        .getByText("Searching…", { exact: true })
        .waitFor({ state: "hidden", timeout: 120000 });
      measures.push({ query, ms: Date.now() - t });
    }
    console.log(JSON.stringify({ searches: measures }));
    await input.fill('"THE CURSE OF RAH"');
    await page.getByText("Searching…", { exact: true }).waitFor();
    await page
      .getByText("Searching…", { exact: true })
      .waitFor({ state: "hidden", timeout: 120000 });
    await page
      .locator("aside button")
      .filter({ hasText: /Vegas GP: Adam Johnson discovers/i })
      .first()
      .click();
    const caption = page.getByRole("heading", { name: "THE CURSE OF RAH", exact: true }).first();
    await caption.waitFor();
    await caption.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await page.screenshot({ path: output + "/actual-export-card.png" });
  }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log("Browser smoke checks passed");
})().catch(async (error) => {
  console.error(error);
  await runningBrowser?.close();
  process.exitCode = 1;
});
