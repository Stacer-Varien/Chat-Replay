import { openAsBlob } from "node:fs";
import { performance } from "node:perf_hooks";
import { parseExportFile } from "../src/lib/chatgpt-import-parser.ts";
import {
  buildArchiveSearchIndex,
  encodeSearchIndex,
  decodeSearchIndex,
} from "../src/lib/chat-search-index.ts";
import { SearchEngine } from "../src/lib/search-engine.ts";
const path = process.argv[2];
if (!path) throw new Error("Pass a local export ZIP path.");
let started = performance.now();
let loads = 0;
const assets = [];
const parsed = await parseExportFile(
  new File([await openAsBlob(path)], "export.zip"),
  () => {},
  (load) =>
    String(
      assets.push(async () => {
        loads++;
        return load();
      }) - 1,
    ),
);
const parseMs = Math.round(performance.now() - started);
started = performance.now();
const index = buildArchiveSearchIndex(parsed.conversations);
const buildMs = Math.round(performance.now() - started);
const engine = new SearchEngine(index);
started = performance.now();
await engine.prepare();
const prepareMs = Math.round(performance.now() - started);
const compressed = await encodeSearchIndex(index);
started = performance.now();
const decoded = await decodeSearchIndex(compressed);
const reopenMs = Math.round(performance.now() - started);
const results = [];
for (const mode of ["visible", "all-variants"])
  for (const query of ["the", "curse", "checklist", "absent_9ff34"]) {
    const timings = [];
    let hits = [];
    for (let i = 0; i < 3; i++) {
      started = performance.now();
      hits = await engine.search({ query, mode, author: "all", fromTs: null, toTs: null });
      timings.push(Math.round(performance.now() - started));
    }
    results.push({ mode, query, timings, hits: hits.length });
  }
console.log(
  JSON.stringify(
    {
      chats: parsed.report.conversationCount,
      messages: parsed.report.messageCount,
      available: parsed.report.availableAttachmentCount,
      missing: parsed.report.missingAttachmentCount,
      branchChoices: parsed.report.branchChoiceCount,
      parseMs,
      buildMs,
      prepareMs,
      indexMiB: +(compressed.size / 1048576).toFixed(2),
      reopenMs,
      attachmentExtractionsBeforeOpen: loads,
      results,
      peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
    },
    null,
    2,
  ),
);
if (decoded.entries.length !== index.entries.length) throw new Error("Index roundtrip mismatch");
if (assets[0]) {
  const blob = await assets[0]();
  if (!blob.size) throw new Error("Attachment extraction failed");
  console.log("Deferred attachment opened successfully");
}
