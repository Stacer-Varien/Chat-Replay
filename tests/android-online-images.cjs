const assert = require("node:assert/strict");
const { chromium } = require(process.env.CHAT_REPLAY_PLAYWRIGHT || "playwright");
let browser, cdp;
(async () => {
  browser = await chromium.connectOverCDP("http://127.0.0.1:9225", { timeout: 20000 });
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url() === "https://localhost/");
  if (!page) throw Error("Preview page not found");
  assert.equal(await page.evaluate(() => window.Capacitor?.isNativePlatform?.()), true);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  const library = async () => {
    if (await page.getByRole("button", { name: "Open conversation list", exact: true }).count()) {
      await page.getByRole("button", { name: "Open conversation list", exact: true }).click();
      await page.getByRole("button", { name: "Back to library", exact: true }).click();
    }
  };
  await library();
  const saved = page.getByRole("button").filter({ hasText: "Continue reading" });
  assert((await saved.count()) > 0, "The previous saved collection should still be present");
  await saved.click();
  await page.locator('[id^="message-"]').first().waitFor({ timeout: 60000 });
  console.log("Existing phone saved collection preserved");
  await library();
  cdp = await page.context().newCDPSession(page);
  const importFixture = async () => {
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: "input[type=file]",
    });
    await cdp.send("DOM.setFileInputFiles", {
      nodeId,
      files: ["/data/user/0/com.chatreplay.viewer.preview/files/online-image-test.json"],
    });
    await page
      .getByRole("heading", { name: "Cached online images", exact: true })
      .waitFor({ timeout: 60000 });
  };
  await importFixture();
  const settings = async () => {
    await page.getByLabel("More conversation options", { exact: true }).click();
    await page.getByRole("button", { name: "Online images", exact: true }).click();
  };
  const close = async () =>
    page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  const checkImage = async (index) => {
    const card = page.locator(".online-image").nth(index);
    await card.waitFor();
    await card.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await card.locator("img").waitFor({ timeout: 60000 });
    await page.waitForFunction(
      (index) => {
        const i = document.querySelectorAll(".online-image")[index]?.querySelector("img");
        return i?.complete && i.naturalWidth > 0;
      },
      index,
      { timeout: 60000 },
    );
  };
  await checkImage(0);
  await checkImage(1);
  console.log("Phone image cache persisted across the Preview update");
  await settings();
  assert.equal(await page.getByRole("switch").isChecked(), false);
  await page.getByRole("switch").check();
  await close();
  for (let i = 0; i < 3; i++) await checkImage(i);
  await page.screenshot({ path: "release/android-online-images.png" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  console.log("Live Wikimedia images loaded on the phone");
  await settings();
  await page.getByRole("switch").uncheck();
  await close();
  let onlineRequests = 0;
  page.on("request", (r) => {
    if (/(?:commons|upload|thumb)\.wikimedia\.org/.test(r.url())) onlineRequests++;
  });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await settings();
  assert.equal(await page.getByRole("switch").isChecked(), false);
  await page.getByRole("switch").check();
  await close();
  for (let i = 0; i < 3; i++) await checkImage(i);
  assert.equal(onlineRequests, 0);
  console.log("Phone cached images rendered offline without requests");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await page.getByLabel("More conversation options", { exact: true }).click();
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await page.waitForTimeout(2000);
  assert.deepEqual(errors, []);
  console.log("Cached-image native print requested");
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  await cdp
    ?.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    })
    .catch(() => {});
  await browser?.close();
  process.exitCode = 1;
});
