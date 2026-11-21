import assert from "node:assert/strict";
import test from "node:test";
import { splitWritingBlocks } from "../src/lib/writing-blocks.ts";

test("splits both export formats while preserving the surrounding reply and Markdown", () => {
  const text = [
    "Before the drafts.",
    '<writingblock id="1" variant="social_post">**First** draft</writingblock>',
    "",
    "Between the drafts.",
    ":::writing{variant='document' title=\"Plan } notes\"}",
    "",
    "# Heading",
    "",
    "- [Link](https://example.com)",
    ":::",
    "After the drafts.",
  ].join("\n");
  assert.deepEqual(splitWritingBlocks(text), [
    { kind: "markdown", text: "Before the drafts.\n" },
    { kind: "draft", text: "**First** draft", attributes: { id: "1", variant: "social_post" } },
    { kind: "markdown", text: "\n\nBetween the drafts.\n" },
    {
      kind: "draft",
      text: "\n# Heading\n\n- [Link](https://example.com)",
      attributes: { variant: "document", title: "Plan } notes" },
    },
    { kind: "markdown", text: "\nAfter the drafts." },
  ]);
});

test("preserves email fields, angles in quoted attributes, and CRLF Markdown", () => {
  const text =
    '<writingblock variant="email" recipient="test@example.com" subject="A > B">\r\nA line\r\nSecond line\r\n</writingblock>';
  assert.deepEqual(splitWritingBlocks(text), [
    {
      kind: "draft",
      text: "A line\r\nSecond line",
      attributes: { variant: "email", recipient: "test@example.com", subject: "A > B" },
    },
  ]);
});

test("keeps malformed writing markers and code examples in ordinary Markdown", () => {
  const text = [
    '`<writingblock variant="email">a draft example</writingblock>`',
    "",
    "~~~markdown",
    ':::writing{variant="document"}',
    "A sample",
    ":::",
    "~~~",
    "",
    '    <writingblock variant="document">another sample</writingblock>',
    "",
    ":::writing{variant=unquoted}",
    "Malformed draft",
    ":::",
    "",
    '<writingblock variant="document">Unclosed draft',
  ].join("\n");
  assert.deepEqual(splitWritingBlocks(text), [{ kind: "markdown", text }]);
});

test("ignores closing markers inside a draft's code", () => {
  const text = [
    '<writingblock variant="document">',
    "Example `</writingblock>`",
    "",
    "```html",
    "</writingblock>",
    "```",
    "</writingblock>",
    "",
    ':::writing{variant="standard"}',
    "~~~",
    ":::",
    "~~~",
    ":::",
  ].join("\n");
  assert.deepEqual(
    splitWritingBlocks(text).filter((part) => part.kind === "draft"),
    [
      {
        kind: "draft",
        text: "Example `</writingblock>`\n\n```html\n</writingblock>\n```",
        attributes: { variant: "document" },
      },
      { kind: "draft", text: "~~~\n:::\n~~~", attributes: { variant: "standard" } },
    ],
  );
});
