import { fromMarkdown } from "mdast-util-from-markdown";
export function messageSegments(text: string): string[] {
  if (text.length < 18000 || /<(?:box|writingblock)\b|:::writing/i.test(text)) return [text];
  const blocks = fromMarkdown(text).children;
  const segments: string[] = [];
  let start = 0;
  let end = 0;
  for (const block of blocks) {
    const at = block.position?.end.offset ?? end;
    if (end - start > 12000) {
      segments.push(text.slice(start, end));
      start = end;
    }
    end = at;
  }
  if (start < text.length) segments.push(text.slice(start));
  return segments.length ? segments : [text];
}
