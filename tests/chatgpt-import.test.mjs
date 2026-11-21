import assert from "node:assert/strict";
import test from "node:test";
import { BlobReader, BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { computeChain } from "../src/lib/chatgpt-import.ts";
import { parseExportFile } from "../src/lib/chatgpt-import-parser.ts";

class SeekableFile extends File {
  arrayBuffer() {
    throw new Error("Import must read ZIP ranges through Blob.slice()");
  }
}

async function zip(entries) {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false, level: 0 });
  for (const [path, value] of Object.entries(entries)) {
    const reader = value instanceof Blob ? new BlobReader(value) : new TextReader(value);
    await writer.add(path, reader);
  }
  return writer.close();
}

function chat(id) {
  const node = (role, text, parent, children = [], attachments = []) => ({
    parent,
    children,
    message: {
      author: { role },
      content: { parts: [text] },
      metadata: { attachments },
    },
  });
  return {
    id,
    title: `Chat ${id}`,
    current_node: "alternate",
    mapping: {
      prompt: node("user", "Prompt", null, ["answer", "alternate"]),
      answer: node("assistant", "First answer", "prompt"),
      alternate: node(
        "assistant",
        "Selected answer",
        "prompt",
        [],
        [
          { id: "file-sample", name: "sample.txt" },
          { id: "file-missing", name: "missing.txt" },
        ],
      ),
    },
  };
}

test("reads manifest shards and referenced attachments from ZIP ranges", async () => {
  const archive = await zip({
    "export_manifest.json": JSON.stringify({
      logical_files: { "conversations.json": { files: ["chat/a.json", "chat/b.json"] } },
    }),
    "chat/a.json": JSON.stringify([chat("a")]),
    "chat/b.json": JSON.stringify({ conversations: [chat("b")] }),
    "conversations-000.json": "Ignored because the manifest points elsewhere.",
    "file-sample.dat": "Attachment payload",
    "file-unused.dat": "Unreferenced attachment",
    "chat.html": ".".repeat(150_000),
  });
  const progress = [];
  const result = await parseExportFile(new SeekableFile([archive], "export.zip"), (stage) =>
    progress.push(stage),
  );
  assert.deepEqual(progress, ["opening", "conversations", "attachments"]);
  assert.deepEqual(
    result.conversations.map(({ id }) => id),
    ["a", "b"],
  );
  assert.equal(result.report.availableAttachmentCount, 2);
  assert.equal(result.report.missingAttachmentCount, 2);
  assert.equal(result.report.branchChoiceCount, 2);
  assert.equal(computeChain(result.conversations[0], {}).at(-1).node.text, "Selected answer");
  assert.equal(
    computeChain(result.conversations[0], { prompt: 0 }).at(-1).node.text,
    "First answer",
  );
  assert.equal(result.assets.length, 1);
  assert.equal(result.assets[0].type, "text/plain");
  assert.equal(await result.assets[0].text(), "Attachment payload");
});

test("opens legacy, numbered, and standalone ChatGPT exports", async () => {
  const data = JSON.stringify([chat("legacy")]);
  for (const name of ["conversations.json", "conversations-000.json"]) {
    const archive = await zip({ [name]: data });
    const result = await parseExportFile(new File([archive], "export.zip"));
    assert.equal(result.metadata.sourceKind, "chatgpt-export");
    assert.equal(result.conversations[0].id, "legacy");
  }
  const result = await parseExportFile(new File([data], "conversations.json"));
  assert.equal(result.metadata.sourceKind, "conversations-json");
  assert.equal(result.conversations[0].id, "legacy");
});

test("opens nested OpenAI Privacy archives and reads their attachments", async () => {
  const conversations = await zip({
    "conversations.json": JSON.stringify([chat("nested")]),
    "user.json": JSON.stringify({ id: "test-user" }),
  });
  const files = await zip({ "file-sample.dat": "Nested attachment" });
  const archive = await zip({
    "User Online Activity/Conversations__test.zip": conversations,
    "User Online Activity/Files__test.zip": files,
  });
  const result = await parseExportFile(new File([archive], "privacy.zip"));
  assert.equal(result.metadata.sourceKind, "openai-privacy-export");
  assert.equal(result.metadata.identityKind, "user");
  assert.equal(await result.assets[0].text(), "Nested attachment");
});

test("opens Claude and Gemini archives", async () => {
  const claude = await zip({
    "conversations.json": JSON.stringify([
      {
        uuid: "claude",
        name: "Claude test",
        chat_messages: [{ uuid: "message", sender: "human", text: "Claude prompt" }],
      },
    ]),
  });
  const claudeResult = await parseExportFile(new File([claude], "claude.zip"));
  assert.equal(claudeResult.metadata.sourceKind, "claude-export");
  assert.equal(claudeResult.report.messageCount, 1);

  const gemini = await zip({
    "Takeout/My Activity/Gemini Apps/MyActivity.html":
      '<div class="outer-cell"><div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">' +
      'Prompted Gemini prompt<br>Oct 16, 2026, 1:00:00 PM UTC<br>Gemini reply <a href="example.png">example.png</a>' +
      '</div><div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1 mdl-typography--text-right">',
    "Takeout/My Activity/Gemini Apps/example.png": "Synthetic image payload",
  });
  const geminiResult = await parseExportFile(new File([gemini], "takeout.zip"));
  assert.equal(geminiResult.metadata.sourceKind, "gemini-takeout");
  assert.equal(geminiResult.report.messageCount, 2);
  assert.equal(geminiResult.report.availableAttachmentCount, 1);
  assert.equal(geminiResult.assets[0].type, "image/png");
});

test("rejects corrupt archives and conversation files", async () => {
  await assert.rejects(parseExportFile(new File(["broken zip"], "export.zip")));
  const archive = await zip({ "conversations.json": "broken JSON" });
  await assert.rejects(
    parseExportFile(new File([archive], "export.zip")),
    /conversations\.json isn't valid JSON/,
  );
});
