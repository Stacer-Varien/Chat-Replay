import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArchiveSearchIndex,
  encodeSearchIndex,
  decodeSearchIndex,
} from "../src/lib/chat-search-index.ts";
import { SearchEngine } from "../src/lib/search-engine.ts";
const node = (id, text, childrenIds = []) => ({
  id,
  text,
  role: "assistant",
  childrenIds,
  createTime: 12,
  attachments: [],
});
const conversation = {
  id: "c",
  title: "Example title",
  createTime: 10,
  updateTime: 20,
  rootIds: ["a"],
  defaultSelection: { a: 1 },
  nodes: {
    a: node("a", "Starting prompt", ["b", "d"]),
    b: node("b", "Older blue checklist"),
    d: node("d", "Current green roadmap"),
  },
};
test("compressed index retains searchable text once and excludes attachment payloads", async () => {
  const index = buildArchiveSearchIndex([conversation]);
  assert.equal(index.version, 2);
  assert.equal("textLower" in index.entries[0], false);
  assert.equal(index.conversations[0].nodes.a.text, "");
  const decoded = await decodeSearchIndex(await encodeSearchIndex(index));
  assert.deepEqual(decoded, index);
  assert.equal(await decodeSearchIndex({ version: 1, entries: [] }), null);
  assert.equal(await decodeSearchIndex(new Blob(["broken"])), null);
});
test("indexed search preserves branches, phrases, OR, substrings, and exclusions", async () => {
  const engine = new SearchEngine(buildArchiveSearchIndex([conversation]));
  await engine.prepare();
  const search = (query, mode = "visible") =>
    engine.search({ query, mode, author: "all", fromTs: null, toTs: null });
  assert.equal((await search("blue")).length, 0);
  const older = await search("blue", "all-variants");
  assert.equal(older[0].nodeId, "b");
  assert.equal(older[0].isVariant, true);
  assert.equal(engine.resolve("c", "b").a, 0);
  assert.equal((await search('"green roadmap" -blue'))[0].nodeId, "d");
  assert.equal((await search("checklist OR roadmap", "all-variants")).length, 2);
  assert.equal((await search("een"))[0].nodeId, "d");
  assert.equal((await search("roadmap -green")).length, 0);
});
