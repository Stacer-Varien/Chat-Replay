import assert from "node:assert/strict";
import test from "node:test";
import { parseRichBlocks, richPlainText } from "../src/lib/rich-blocks.ts";
test("renders nested export layouts and literal JSX attributes", () => {
  const source =
    'Before\n<box background="black" padding={3} border={{size:1,color:"#64748b"}}><title color="#D6B56D">THE CURSE OF RAH</title><row gap={2}><text>**Readable**</text><badge>New</badge></row></box>\nAfter';
  const nodes = parseRichBlocks(source);
  assert.equal(nodes[1].tag, "box");
  assert.equal(nodes[1].attributes.padding, "3");
  assert.equal(nodes[1].children[0].tag, "title");
  assert.match(richPlainText(source), /THE CURSE OF RAH/);
  assert.doesNotMatch(richPlainText(source), /<box/);
});
test("preserves code examples and malformed containers", () => {
  for (const source of [
    "```html\n<box><text>Example</text></box>\n```",
    "`<box>literal</box>`",
    "<box><text>Unclosed</text>",
  ])
    assert.equal(
      parseRichBlocks(source)
        .map((n) => n.text ?? "element")
        .join(""),
      source,
    );
});
test("keeps imported event handlers inert and writing blocks nested", () => {
  const nodes = parseRichBlocks(
    '<box onClick={steal()}><WritingBlock title="Draft">Hello</WritingBlock><input onChange={x} value={7}/></box>',
  );
  assert.equal(nodes[0].attributes.onclick, undefined);
  assert.equal(nodes[0].children[0].tag, "writingblock");
  assert.equal(nodes[0].children[1].attributes.onchange, undefined);
});
