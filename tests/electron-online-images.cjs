const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { _electron } = require(process.env.CHAT_REPLAY_PLAYWRIGHT || "playwright");
let app;
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "chat-replay-image-electron-"));
  const png = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#0f766e" } })
    .png()
    .toBuffer();
  let calls = 0;
  const launch = async () => {
    app = await _electron.launch({
      executablePath:
        process.env.CHAT_REPLAY_WINDOWS_EXE || path.resolve("release/win-unpacked/Chat Replay.exe"),
      args: ["--user-data-dir=" + profile],
      timeout: 60000,
    });
    const context = app.context();
    await context.route("https://commons.wikimedia.org/**", async (route) => {
      calls++;
      await route.fulfill({
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
                    mime: "image/png",
                    thumbwidth: 32,
                    thumbheight: 24,
                    descriptionurl: "https://commons.wikimedia.org/wiki/File:Fixture.png",
                    extmetadata: {
                      Artist: { value: "QA Creator" },
                      LicenseShortName: { value: "CC BY 4.0" },
                    },
                  },
                ],
              },
            },
          },
        }),
      });
    });
    await context.route("https://upload.wikimedia.org/**", (route) => {
      calls++;
      return route.fulfill({ contentType: "image/png", body: png });
    });
    return app.firstWindow();
  };
  let page = await launch();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator("input[type=file]").setInputFiles({
    name: "desktop-image.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        {
          id: "image",
          title: "Cached desktop image",
          current_node: "a",
          mapping: {
            a: {
              parent: null,
              children: [],
              message: {
                author: { role: "assistant" },
                content: { parts: ['<AsyncImageGroup query={["Mountains"]} />'] },
              },
            },
          },
        },
      ]),
    ),
  });
  const openSettings = async () => {
    await page.getByLabel("More conversation options", { exact: true }).click();
    await page.getByRole("button", { name: "Online images", exact: true }).click();
  };
  await openSettings();
  assert.equal(await page.getByRole("switch").isChecked(), false);
  assert.equal(calls, 0);
  await page.getByRole("switch").check();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.locator(".online-image img").waitFor();
  await page.waitForFunction(() => document.querySelector(".online-image img")?.naturalWidth > 0);
  assert.equal(calls, 2);
  assert.equal((await page.evaluate(() => window.chatReplayDesktop.onlineImages.stats())).count, 1);
  await page.getByRole("button", { name: "Save chats", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Image cache check");
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("dialog").getByRole("button", { name: "Save chats", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const oldOrigin = new URL(page.url()).origin;
  await app.close();
  calls = 0;
  page = await launch();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "Choose export file", exact: true }).waitFor();
  assert.notEqual(new URL(page.url()).origin, oldOrigin);
  await page.getByRole("button").filter({ hasText: "Continue reading" }).click();
  await page.locator(".online-image img").waitFor();
  await page.waitForFunction(() => document.querySelector(".online-image img")?.naturalWidth > 0);
  assert.equal(calls, 0);
  assert.equal(await page.evaluate(() => window.chatReplayDesktop.onlineImages.enabled()), true);
  await page.screenshot({ path: "release/windows-online-images.png" });
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
  await popup.locator('.online-image img[src^="data:"]').waitFor();
  assert.equal(calls, 0);
  const pdf = await app.evaluate(async ({ BrowserWindow }) => {
    const child = BrowserWindow.getAllWindows().find(
      (w) => w.getTitle() === "Cached desktop image",
    );
    return Array.from(await child.webContents.printToPDF({}));
  });
  assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), "%PDF-");
  await fs.writeFile("release/windows-online-images.pdf", Buffer.from(pdf));
  await popup.close();
  await openSettings();
  await page.getByRole("button", { name: "Clear cache and turn off", exact: true }).click();
  await page.getByText(/Cached images: 0/).waitFor();
  assert.equal(await page.getByRole("switch").isChecked(), false);
  assert.deepEqual(await page.evaluate(() => window.chatReplayDesktop.onlineImages.stats()), {
    bytes: 0,
    count: 0,
  });
  assert.deepEqual(errors, []);
  await app.close();
  console.log(
    "Packaged Windows online-image opt-in, native disk cache, saved collection, persistence across port changes and clearing passed",
  );
})().catch(async (e) => {
  console.error(e);
  await app?.close();
  process.exitCode = 1;
});
