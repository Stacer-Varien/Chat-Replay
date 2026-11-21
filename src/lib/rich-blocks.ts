import { fromMarkdown } from "mdast-util-from-markdown";
import { literalImageQueries } from "./online-image-query.ts";

export type RichNode =
  | { kind: "markdown"; text: string }
  | {
      kind: "element";
      tag: string;
      attributes: Record<string, string>;
      children: RichNode[];
    };
const tags = new Set([
  "box",
  "row",
  "grid",
  "grid-item",
  "title",
  "text",
  "caption",
  "badge",
  "divider",
  "spacer",
  "icon",
  "list",
  "list-item",
  "label",
  "input",
  "button",
  "radio",
  "radio-group",
  "asyncimage",
  "asyncimagegroup",
  "cite",
  "memorycite",
  "link",
  "writingblock",
]);
const voidTags = new Set([
  "divider",
  "spacer",
  "icon",
  "input",
  "asyncimage",
  "asyncimagegroup",
  "cite",
  "memorycite",
  "link",
]);

// Read literal attributes without evaluating JSX, JavaScript, or imported event handlers.
function attributes(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  let i = 0;
  while (i < source.length) {
    const match = /^[\s/]*([\w-]+)/.exec(source.slice(i));
    if (!match) break;
    const name = match[1].toLowerCase();
    i += match[0].length;
    while (/\s/.test(source[i] ?? "") && i < source.length) i++;
    let value = "true";
    let expression = false;
    if (source[i] === "=") {
      i++;
      while (/\s/.test(source[i] ?? "") && i < source.length) i++;
      const start = i;
      const quote = source[i];
      if (quote === '"' || quote === "'") {
        i++;
        const begin = i;
        while (i < source.length && source[i] !== quote) i++;
        value = source.slice(begin, i);
        i++;
      } else if (quote === "{") {
        expression = true;
        let depth = 0;
        let quoted = "";
        do {
          const c = source[i++];
          if (quoted) {
            if (c === quoted && source[i - 2] !== "\\") quoted = "";
          } else if (c === '"' || c === "'") quoted = c;
          else if (c === "{") depth++;
          else if (c === "}") depth--;
        } while (i < source.length && depth > 0);
        value = source.slice(start + 1, i - 1).trim();
      } else {
        while (i < source.length && !/[\s>]/.test(source[i])) i++;
        value = source.slice(start, i);
      }
    }
    if (name === "query" && expression) {
      const queries = literalImageQueries(value);
      if (!queries) continue;
      value = queries.length === 1 ? queries[0] : JSON.stringify(queries);
    }
    if (!name.startsWith("on") && name !== "style" && name !== "srcdoc") result[name] = value;
  }
  return result;
}

export function parseRichBlocks(source: string): RichNode[] {
  if (!/<(?:box|row|grid|title|text|badge|writingblock|asyncimage(?:group)?)\b/i.test(source))
    return [{ kind: "markdown", text: source }];
  const ranges: [number, number, boolean][] = [];
  const walk = (node: {
    type: string;
    position?: { start: { offset?: number }; end: { offset?: number } };
    children?: (typeof node)[];
  }) => {
    if (
      (node.type === "code" || node.type === "inlineCode") &&
      node.position?.start.offset !== undefined &&
      node.position?.end.offset !== undefined
    )
      ranges.push([
        node.position.start.offset,
        node.position.end.offset,
        node.type === "code" &&
          !/^\s*(?:`{3,}|~{3,})/.test(
            source.slice(node.position.start.offset, node.position.end.offset),
          ),
      ]);
    else node.children?.forEach(walk);
  };
  walk(fromMarkdown(source.replace(/</g, "‹")));
  const token = /<\/?([A-Za-z][\w-]*)\b/g;
  const root: RichNode[] = [];
  let current = root;
  const stack: {
    node: Extract<RichNode, { kind: "element" }>;
    parent: RichNode[];
    start: number;
  }[] = [];
  let cursor = 0;
  let rangeIndex = 0;
  let match: RegExpExecArray | null;
  const append = (text: string) => {
    if (text) current.push({ kind: "markdown", text });
  };
  while ((match = token.exec(source))) {
    const start = match.index;
    const tag = match[1].toLowerCase();
    if (!tags.has(tag)) continue;
    while (rangeIndex < ranges.length && ranges[rangeIndex][1] <= start) rangeIndex++;
    if (ranges[rangeIndex]?.[0] <= start && start < ranges[rangeIndex][1]) {
      // Indented layout children are not standalone Markdown code examples.
      if (
        !ranges[rangeIndex][2] ||
        !stack.length ||
        stack.some((s) => s.node.tag === "writingblock")
      )
        continue;
    }
    let end = token.lastIndex;
    let quote = "";
    let depth = 0;
    for (; end < source.length; end++) {
      const c = source[end];
      if (quote) {
        if (c === quote && source[end - 1] !== "\\") quote = "";
      } else if (c === '"' || c === "'") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
      if (end - start > 8192) break;
    }
    if (end >= source.length || source[end] !== ">" || depth !== 0 || stack.length > 40) continue;
    const closing = source[start + 1] === "/";
    if (closing && stack.at(-1)?.node.tag !== tag) continue;
    append(source.slice(cursor, start));
    if (closing) {
      current = stack.pop()!.parent;
    } else {
      const node: Extract<RichNode, { kind: "element" }> = {
        kind: "element",
        tag,
        attributes: attributes(source.slice(token.lastIndex, end)),
        children: [],
      };
      current.push(node);
      if (!voidTags.has(tag) && !/\/\s*$/.test(source.slice(token.lastIndex, end))) {
        stack.push({ node, parent: current, start });
        current = node.children;
      }
    }
    cursor = end + 1;
    token.lastIndex = cursor;
  }
  append(source.slice(cursor));
  // An incomplete container is preserved verbatim, including every nested child.
  if (stack.length) {
    const first = stack[0];
    const index = first.parent.indexOf(first.node);
    first.parent.splice(index, Infinity, { kind: "markdown", text: source.slice(first.start) });
  }
  return root;
}

export function richPlainText(source: string): string {
  // Keep code examples and unknown HTML intact. Only strip complete recognised layouts.
  const walk = (nodes: RichNode[]): string =>
    nodes
      .map((node) =>
        node.kind === "markdown"
          ? node.text
          : `${node.attributes.title ?? ""} ${node.tag.startsWith("asyncimage") ? (node.attributes.query ?? "Image unavailable") : ""} ${walk(node.children)}`,
      )
      .join("\n");
  return walk(parseRichBlocks(source));
}
