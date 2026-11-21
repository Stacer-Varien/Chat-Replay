import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { imageQueries, imageCacheKey } from "../src/lib/online-image-query.ts";
import { parseRichBlocks } from "../src/lib/rich-blocks.ts";
import { findOnlineImage, ImageRequestError } from "../src/lib/online-image-provider.ts";
const { createOnlineImageCache } = createRequire(import.meta.url)(
  "../electron/online-image-cache.cjs",
);

test("reads literal image groups safely and normalizes repeated cache keys", async () => {
  assert.deepEqual(imageQueries('["Alaska", "Ocean", "Alaska"]'), ["Alaska", "Ocean", "Alaska"]);
  assert.deepEqual(imageQueries("['Alaska', 'Ocean']"), ["Alaska", "Ocean"]);
  assert.deepEqual(imageQueries('["Alaska", run()]'), []);
  assert.equal(
    await imageCacheKey("  Alaska  Mountains "),
    await imageCacheKey("alaska mountains"),
  );
  const node = parseRichBlocks("<AsyncImage query={getSecret()} />")[0];
  assert.equal(node.attributes.query, undefined);
  assert.equal(parseRichBlocks('<AsyncImage query={"Alaska"} />')[0].attributes.query, "Alaska");
  const group = parseRichBlocks('<AsyncImageGroup query={["Mountains", "Ocean"]} />')[0];
  assert.equal(group.tag, "asyncimagegroup");
  assert.deepEqual(imageQueries(group.attributes.query), ["Mountains", "Ocean"]);
});
test("finds indented layout images while preserving actual code examples", () => {
  const n = parseRichBlocks(
    '<box>\n\n    <AsyncImage query="Mountains" aspectRatio="4:3" />\n\n</box>',
  );
  assert.equal(n[0].children.find((c) => c.tag === "asyncimage").attributes.query, "Mountains");
  for (const text of [
    '    <AsyncImage query="Code" />',
    '```jsx\n<AsyncImage query="Code" />\n```',
    '`<AsyncImage query="Code" />`',
  ])
    assert.equal(parseRichBlocks(text)[0].text, text);
});
const credit = {
  title: "Example",
  author: "Creator",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
};
test("disk cache persists preferences and bytes, evicts least recently used files, and rejects paths", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "chat-replay-image-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = createOnlineImageCache(root, 6);
  const record = (key) => ({
    key: key.repeat(64),
    bytes: new Uint8Array([1, 2, 3]).buffer,
    mime: "image/jpeg",
    credit,
    lastUsed: 0,
    missingUntil: 0,
  });
  await store.setEnabled(true);
  await store.write(record("a"));
  await store.write(record("b"));
  await new Promise((r) => setTimeout(r, 5));
  await store.read("a".repeat(64));
  await store.write(record("c"));
  assert.equal(await store.read("b".repeat(64)), null);
  assert.equal((await store.stats()).bytes, 6);
  const reopened = createOnlineImageCache(root, 6);
  assert.equal(await reopened.enabled(), true);
  assert.deepEqual([...new Uint8Array((await reopened.read("a".repeat(64))).bytes)], [1, 2, 3]);
  await assert.rejects(store.read("../outside"), /Invalid image cache key/);
  await assert.rejects(store.write({ ...record("d"), mime: "text/html" }), /Unsupported/);
  await reopened.clear();
  assert.deepEqual(await reopened.stats(), { bytes: 0, count: 0 });
  assert.equal(await reopened.enabled(), true);
});
test("provider downloads only supported thumbnails and keeps attribution as text", async (t) => {
  const calls = [];
  const mock = t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push([String(url), options]);
    if (String(url).includes("api.php"))
      return Response.json({
        query: {
          pages: {
            1: {
              index: 1,
              title: "File:Example.jpg",
              imageinfo: [
                {
                  thumburl: "https://upload.wikimedia.org/example.jpg",
                  thumbwidth: 640,
                  thumbheight: 480,
                  mime: "image/jpeg",
                  descriptionurl: credit.sourceUrl,
                  extmetadata: {
                    Artist: { value: "<b>A &amp; B</b>" },
                    LicenseShortName: { value: "CC BY 4.0" },
                    LicenseUrl: { value: credit.licenseUrl },
                  },
                },
              ],
            },
          },
        },
      });
    return new Response(new Uint8Array([255, 216, 255, 0]), {
      headers: { "content-type": "image/jpeg" },
    });
  });
  const record = await findOnlineImage("Mountains", "a".repeat(64), new AbortController().signal);
  assert.equal(record.credit.author, "A & B");
  assert.equal(record.bytes.byteLength, 4);
  assert.equal(calls[0][1].credentials, "omit");
  assert.equal(calls[1][1].headers, undefined);
  assert.equal(calls.length, 2);
  mock.mock.restore();
});
test("provider handles empty results, oversized images and rate limits", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ query: { pages: {} } }),
  );
  assert.equal(await findOnlineImage("Ocean", "a".repeat(64), new AbortController().signal), null);
  mock.mock.mockImplementation(
    async () => new Response("Busy", { status: 429, headers: { "retry-after": "60" } }),
  );
  await assert.rejects(
    findOnlineImage("Ocean", "a".repeat(64), new AbortController().signal),
    (e) => e instanceof ImageRequestError && e.retryAfter === 60000,
  );
  mock.mock.mockImplementation(async (url) =>
    String(url).includes("api.php")
      ? Response.json({
          query: {
            pages: {
              1: {
                imageinfo: [
                  {
                    thumburl: "https://upload.wikimedia.org/big.jpg",
                    descriptionurl: credit.sourceUrl,
                    mime: "image/jpeg",
                  },
                ],
              },
            },
          },
        })
      : new Response("large", {
          headers: { "content-type": "image/jpeg", "content-length": String(6 * 1024 * 1024) },
        }),
  );
  assert.equal(await findOnlineImage("Ocean", "a".repeat(64), new AbortController().signal), null);
});
