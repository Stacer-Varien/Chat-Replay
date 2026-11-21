import { decodeNamedCharacterReference } from "decode-named-character-reference";
import {
  IMAGE_DOWNLOAD_LIMIT,
  IMAGE_MIME_TYPES,
  type OnlineImageRecord,
} from "./online-image-types.ts";

export class ImageRequestError extends Error {
  readonly retryAfter: number;
  constructor(message: string, retryAfter = 0) {
    super(message);
    this.retryAfter = retryAfter;
  }
}
function plain(value: unknown): string {
  return typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, "")
        .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (whole, name: string) => {
          if (!name.startsWith("#")) return decodeNamedCharacterReference(name) || whole;
          const n =
            name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
          return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
        })
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600)
    : "";
}
function safeUrl(value: unknown, hosts?: string[]) {
  try {
    const u = new URL(String(value));
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!hosts || hosts.includes(u.hostname))
      ? u.href
      : "";
  } catch {
    return "";
  }
}
async function request(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    headers:
      new URL(url).hostname === "commons.wikimedia.org"
        ? { "Api-User-Agent": "ChatReplay/1.6.0 (local chat export viewer)" }
        : undefined,
  });
  if (!response.ok) {
    const delay = response.headers.get("retry-after");
    const seconds = delay
      ? Number(delay) || Math.max(0, (Date.parse(delay) - Date.now()) / 1000)
      : 30;
    throw new ImageRequestError(
      response.status === 429
        ? "Image search is busy. Try again shortly."
        : "Could not download this image.",
      response.status === 429 ? Math.min(300, seconds) * 1000 : 0,
    );
  }
  return response;
}
export async function findOnlineImage(
  query: string,
  key: string,
  signal: AbortSignal,
): Promise<OnlineImageRecord | null> {
  const words = query
    .split(/\s+/)
    .filter(
      (w) =>
        !/^(?:a|an|the|of|in|on|with|and|for|at|photography|photo|image|realistic|resolution)$/i.test(
          w,
        ),
    );
  const fallback = [...new Set(words)].slice(0, 6).join(" ");
  for (const search of [...new Set([query, ...(words.length > 6 ? [fallback] : [])])]) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrnamespace: "6",
      gsrsearch: search,
      gsrlimit: "5",
      prop: "imageinfo",
      iiprop: "url|mime|thumbmime|size|extmetadata",
      iiurlwidth: "960",
      iiurlheight: "960",
      iiextmetadatafilter: "Artist|Credit|LicenseShortName|LicenseUrl",
    }).toString();
    const data = await (await request(url.href, signal)).json();
    if (data.error) throw new ImageRequestError("Image search is temporarily unavailable.");
    const pages = Object.values(data.query?.pages ?? {}) as {
      index?: number;
      title?: string;
      imageinfo?: Record<string, unknown>[];
    }[];
    for (const page of pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const sourceUrl = safeUrl(info.descriptionurl, ["commons.wikimedia.org"]);
      const thumbnail = safeUrl(info.thumburl, ["upload.wikimedia.org", "thumb.wikimedia.org"]);
      const mime = String(info.thumbmime ?? info.mime);
      if (
        !thumbnail ||
        !sourceUrl ||
        !IMAGE_MIME_TYPES.includes(mime) ||
        Number(info.thumbwidth) > 4096 ||
        Number(info.thumbheight) > 4096
      )
        continue;
      const response = await request(thumbnail, signal);
      const type = response.headers.get("content-type")?.split(";")[0].toLowerCase() ?? "";
      if (
        !IMAGE_MIME_TYPES.includes(type) ||
        Number(response.headers.get("content-length")) > IMAGE_DOWNLOAD_LIMIT
      ) {
        await response.body?.cancel();
        continue;
      }
      const reader = response.body?.getReader();
      if (!reader) continue;
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > IMAGE_DOWNLOAD_LIMIT) {
            await reader.cancel();
            break;
          }
          chunks.push(part.value as Uint8Array<ArrayBuffer>);
        }
      } finally {
        reader.releaseLock();
      }
      if (!size || size > IMAGE_DOWNLOAD_LIMIT) continue;
      const blob = new Blob(chunks, { type });
      if (typeof createImageBitmap === "function") {
        try {
          const bitmap = await createImageBitmap(blob);
          const valid = bitmap.width <= 4096 && bitmap.height <= 4096;
          bitmap.close();
          if (!valid) continue;
        } catch {
          continue;
        }
      }
      const meta = info.extmetadata as Record<string, { value?: string }> | undefined;
      const value = (name: string) => plain(meta?.[name]?.value);
      return {
        key,
        bytes: await blob.arrayBuffer(),
        mime: type,
        lastUsed: Date.now(),
        missingUntil: 0,
        credit: {
          title: plain(page.title).replace(/^File:/, ""),
          author: value("Artist") || value("Credit") || "Creator listed on source",
          license: value("LicenseShortName") || "Licence listed on source",
          licenseUrl: safeUrl(meta?.LicenseUrl?.value),
          sourceUrl,
        },
      };
    }
  }
  return null;
}
