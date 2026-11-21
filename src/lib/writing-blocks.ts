import { fromMarkdown } from "mdast-util-from-markdown";

interface MarkdownNode {
  type: string;
  position?: { start: { offset?: number }; end: { offset?: number } };
  children?: MarkdownNode[];
}

export type WritingPart =
  | { kind: "markdown"; text: string }
  | { kind: "draft"; text: string; attributes: Record<string, string> };

function codeRanges(node: MarkdownNode, ranges: Array<[number, number]>) {
  if (node.type === "code" || node.type === "inlineCode") {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start !== undefined && end !== undefined) ranges.push([start, end]);
  }
  node.children?.forEach((child) => codeRanges(child, ranges));
}

function parseAttributes(source: string): Record<string, string> | null {
  const attributes = Array.from(
    source.trim().matchAll(/\s*([a-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')\s*/giy),
  );
  if (attributes.map(([matched]) => matched).join("") !== source.trim()) return null;
  return Object.fromEntries(
    attributes.map(([, name, doubleQuoted, singleQuoted]) => [
      name.toLowerCase(),
      doubleQuoted ?? singleQuoted,
    ]),
  );
}

export function splitWritingBlocks(source: string, includeTags = true): WritingPart[] {
  const tokens = Array.from(
    source.matchAll(
      /^ {0,3}<writingblock(?=[ \t>])(?<tagAttributes>(?:[^<>"'\r\n]|"[^"\r\n]*"|'[^'\r\n]*')*)>|(?<tagEnd><\/writingblock[ \t]*>)|^ {0,3}:::writing\{(?<directiveAttributes>(?:[^}"'\r\n]|"[^"\r\n]*"|'[^'\r\n]*')*)\}[ \t]*\r?$|^(?<directiveEnd> {0,3}:::[ \t]*\r?)$/gim,
    ),
  ).filter(
    (token) =>
      includeTags ||
      token.groups?.directiveAttributes !== undefined ||
      token.groups?.directiveEnd !== undefined,
  );
  if (
    !tokens.some(
      ({ groups }) => groups?.tagAttributes != null || groups?.directiveAttributes != null,
    )
  ) {
    return [{ kind: "markdown", text: source }];
  }

  // Make the custom tags ordinary text for Markdown's code detection. Keep source offsets
  // identical so code inside a draft can still protect a literal closing marker.
  const markdown = source.replace(/<(?=\/?writingblock(?:[ \t]|>))/gi, "‹");
  const ranges: Array<[number, number]> = [];
  codeRanges(fromMarkdown(markdown), ranges);

  const parts: WritingPart[] = [];
  let cursor = 0;
  let rangeIndex = 0;
  let open: {
    style: "tag" | "directive";
    start: number;
    end: number;
    attributes: Record<string, string>;
  } | null = null;
  for (const token of tokens) {
    const start = token.index;
    while (rangeIndex < ranges.length && ranges[rangeIndex][1] <= start) rangeIndex++;
    const range = ranges[rangeIndex];
    if (range && range[0] <= start && start < range[1]) continue;

    const { tagAttributes, directiveAttributes, tagEnd, directiveEnd } = token.groups!;
    const attributesSource = tagAttributes ?? directiveAttributes;
    if (attributesSource !== undefined) {
      const attributes = parseAttributes(attributesSource);
      open = attributes
        ? {
            style: tagAttributes !== undefined ? "tag" : "directive",
            start,
            end: start + token[0].length,
            attributes,
          }
        : null;
      continue;
    }
    if (!open || (open.style === "tag" ? !tagEnd : !directiveEnd)) continue;

    if (open.start > cursor)
      parts.push({ kind: "markdown", text: source.slice(cursor, open.start) });
    parts.push({
      kind: "draft",
      text: source
        .slice(open.end, start)
        .replace(/^[ \t]*\r?\n/, "")
        .replace(/\r?\n[ \t]*$/, ""),
      attributes: open.attributes,
    });
    cursor = start + token[0].length;
    open = null;
  }
  if (cursor < source.length) parts.push({ kind: "markdown", text: source.slice(cursor) });
  return parts;
}
