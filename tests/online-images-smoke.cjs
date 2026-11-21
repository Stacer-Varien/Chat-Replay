const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { chromium } = require(process.env.CHAT_REPLAY_PLAYWRIGHT || "playwright");
const base = process.env.CHAT_REPLAY_URL || "http://127.0.0.1:5173";
let context;
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "chat-replay-image-browser-"));
  const png = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#0f766e" } })
    .png()
    .toBuffer();
  let requests = [],
    active = 0,
    maximum = 0;
  const errors = [];
  const text =
    '<box><title>Image fixture</title><AsyncImageGroup query={["Mountains", "Ocean", "Forest", "Mountains"]} aspectRatio="4:3" /></box>\n\n' +
    "A paragraph for scrolling.\n\n".repeat(100) +
    '<AsyncImage query="Distant uncached city" />\n\n```jsx\n<AsyncImage query="Code example" />\n```';
  const fixture = () => ({
    name: "images.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        {
          id: "images",
          title: "Online image fixture",
          current_node: "a",
          mapping: {
            a: {
              parent: null,
              children: [],
              message: { author: { role: "assistant" }, content: { parts: [text] } },
            },
          },
        },
      ]),
    ),
  });
  const launch = async () => {
    const c = await chromium.launchPersistentContext(profile, {
      channel: "msedge",
      headless: true,
      viewport: { width: 1280, height: 1200 },
    });
    await c.route("https://commons.wikimedia.org/**", async (route) => {
      const u = new URL(route.request().url());
      const query = u.searchParams.get("gsrsearch");
      requests.push({ type: "search", query });
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((r) => setTimeout(r, 100));
      active--;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          query: {
            pages: {
              1: {
                index: 1,
                title: "File:Fixture.png",
                imageinfo: [
                  {
                    thumburl: "https://upload.wikimedia.org/fixture.png",
                    thumbwidth: 32,
                    thumbheight: 24,
                    mime: "image/png",
                    descriptionurl: "https://commons.wikimedia.org/wiki/File:Fixture.png",
                    extmetadata: {
                      Artist: { value: "<b>Fixture Creator</b>" },
                      LicenseShortName: { value: "CC BY 4.0" },
                      LicenseUrl: { value: "https://creativecommons.org/licenses/by/4.0/" },
                    },
                  },
                ],
              },
            },
          },
        }),
      });
    });
    await c.route("https://upload.wikimedia.org/**", (route) => {
      requests.push({ type: "image" });
      return route.fulfill({ status: 200, contentType: "image/png", body: png });
    });
    return c;
  };
  context = await launch();
  let page = context.pages()[0];
  const openSettings = async () => {
    await page.getByLabel("More conversation options", { exact: true }).click();
    await page.getByRole("button", { name: "Online images", exact: true }).click();
  };
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.locator("input[type=file]").setInputFiles(fixture());
  await page.getByRole("heading", { name: "Image fixture", exact: true }).waitFor();
  await openSettings();
  const toggle = page.getByRole("switch");
  await toggle.waitFor();
  assert.equal(await toggle.isChecked(), false);
  assert.equal(requests.length, 0);
  await toggle.check();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".online-image img").length === 4 &&
      [...document.querySelectorAll(".online-image img")].every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
  );
  assert.equal(requests.filter((r) => r.type === "search").length, 3);
  assert.equal(requests.filter((r) => r.type === "image").length, 3);
  assert(maximum <= 2);
  assert(!requests.some((r) => r.query === "Distant uncached city"));
  assert(!requests.some((r) => r.query === "Code example"));
  await page.screenshot({ path: "release/online-images-desktop.png" });
  await page.evaluate(() => {
    const open = window.open.bind(window);
    window.open = (...args) => {
      const child = open(...args);
      if (child) child.print = () => {};
      return child;
    };
  });
  page.once("dialog", (d) => d.accept());
  const popupPromise = page.waitForEvent("popup");
  const beforePrint = requests.length;
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const print = await popupPromise;
  await print.locator('.online-image img[src^="data:"]').first().waitFor();
  assert.equal(await print.locator('.online-image img[src^="data:"]').count(), 4);
  assert.equal(requests.length, beforePrint);
  await print.pdf({ path: "release/online-images.pdf" });
  await print.close();
  await openSettings();
  await toggle.uncheck();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll(".online-image img").length === 4);
  await context.close();
  requests = [];
  context = await launch();
  page = context.pages()[0];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.locator("input[type=file]").setInputFiles(fixture());
  await page.locator(".online-image img").first().waitFor();
  await page.waitForFunction(() => document.querySelectorAll(".online-image img").length === 4);
  assert.equal(requests.length, 0);
  await context.setOffline(true);
  const city = page.getByText("Distant uncached city", { exact: true });
  await city.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await openSettings();
  await page.getByRole("switch").check();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.getByText("Connect to the internet to find this image.", { exact: true }).waitFor();
  assert.equal(requests.length, 0);
  await context.setOffline(false);
  await openSettings();
  await page.getByRole("button", { name: "Clear cache and turn off", exact: true }).click();
  await page.getByText(/Cached images: 0/).waitFor();
  assert.equal(await page.getByRole("switch").isChecked(), false);
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    "Online image opt-in, lazy requests, deduplication, cache persistence, offline handling, PDF and cache clearing passed",
  );
})().catch(async (e) => {
  console.error(e);
  await context?.close();
  process.exitCode = 1;
});
