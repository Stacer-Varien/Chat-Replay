// Literal strings and arrays only. Never evaluate imported JSX expressions.
export function literalImageQueries(value: string): string[] | null {
  const input = value.trim();
  if (input.startsWith('"')) {
    try {
      const result: unknown = JSON.parse(input);
      return typeof result === "string" ? [result] : null;
    } catch {
      return null;
    }
  }
  const tokens = input.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[|\]|,/g);
  if (!tokens || tokens.join("").replace(/\s/g, "") !== input.replace(/\s/g, "")) return null;
  const decode = (token: string): string =>
    token.startsWith('"')
      ? JSON.parse(token)
      : token
          .slice(1, -1)
          .replace(/\\(u[\da-f]{4}|['"\\/bfnrt])/gi, (_, escape: string) =>
            escape.startsWith("u")
              ? String.fromCharCode(parseInt(escape.slice(1), 16))
              : ({ b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" }[escape] ?? escape),
          );
  if (tokens.length === 1 && tokens[0].startsWith("'")) return [decode(tokens[0])];
  if (tokens[0] !== "[" || tokens.at(-1) !== "]") return null;
  const result: string[] = [];
  let needsValue = true;
  try {
    for (const token of tokens.slice(1, -1)) {
      if (needsValue) {
        if (!/^["']/.test(token)) return null;
        result.push(decode(token));
      } else if (token !== ",") return null;
      needsValue = !needsValue;
    }
  } catch {
    return null;
  }
  return result;
}
export function imageQueries(value = ""): string[] {
  const raw = value.trim();
  const values = /^[\x5b"']/.test(raw) ? (literalImageQueries(raw) ?? []) : [raw];
  return values
    .map((v) => v.replace(/\s+/g, " ").trim())
    .filter((v) => v && v.length <= 500)
    .slice(0, 12);
}
export function normalizeImageQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}
export async function imageCacheKey(query: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`commons:960:v1:${normalizeImageQuery(query)}`),
  );
  return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, "0")).join("");
}
