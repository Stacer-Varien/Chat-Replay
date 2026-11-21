import { useContext, useEffect, useRef, useState, type CSSProperties } from "react";
import { ImageOff } from "lucide-react";
import { loadOnlineImage } from "@/lib/online-images";
import { normalizeImageQuery } from "@/lib/online-image-query";
import type { ImageCredit } from "@/lib/online-image-types";
import {
  PrintOnlineImagesContext,
  useImageSettings,
  useOpenImageSettings,
} from "@/lib/online-image-context";
type Result = { url: string; credit: ImageCredit | null; status: string };
function Credit({ credit }: { credit: ImageCredit }) {
  return (
    <figcaption className="break-words px-2 py-2 text-xs leading-relaxed text-muted-foreground">
      <span className="font-medium">Online replacement</span>
      {" · "}
      {credit.author}
      {" · "}
      {credit.licenseUrl ? (
        <a
          href={credit.licenseUrl}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          className="underline"
        >
          {credit.license}
        </a>
      ) : (
        credit.license
      )}
      {" · "}
      <a
        href={credit.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className="underline"
      >
        Source
      </a>
    </figcaption>
  );
}
export function OnlineImage({
  query,
  aspectRatio,
  localUrl,
  pending = false,
}: {
  query: string;
  aspectRatio?: string;
  localUrl?: string | null;
  pending?: boolean;
}) {
  const frame = useRef<HTMLElement>(null),
    retry = useRef(false);
  const [visible, setVisible] = useState(false),
    [attempt, setAttempt] = useState(0),
    [connection, setConnection] = useState(0);
  const [result, setResult] = useState<Result>({
    url: "",
    credit: null,
    status: "Image not included in export",
  });
  const settings = useImageSettings(),
    openSettings = useOpenImageSettings(),
    print = useContext(PrintOnlineImagesContext);
  const parts = (aspectRatio ?? "4:3").split(/[:/]/).map(Number),
    ratio = parts.length === 2 ? parts[0] / parts[1] : parts[0];
  const style: CSSProperties = {
    aspectRatio: Number.isFinite(ratio) && ratio >= 0.2 && ratio <= 5 ? ratio : 4 / 3,
  };
  useEffect(() => {
    if (print !== null || !frame.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setVisible(entries.some((e) => e.isIntersecting));
      },
      { rootMargin: "300px" },
    );
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, [print]);
  useEffect(() => {
    const online = () => setConnection((v) => v + 1);
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);
  useEffect(() => {
    if (print !== null || !visible || !settings.loaded || localUrl || pending || !query) return;
    let disposed = false,
      url = "";
    const force = retry.current;
    retry.current = false;
    setResult({
      url: "",
      credit: null,
      status: settings.enabled ? "Finding image…" : "Online images are off",
    });
    void loadOnlineImage(query, force)
      .then((record) => {
        if (disposed) return;
        if (record.bytes) {
          url = URL.createObjectURL(new Blob([record.bytes], { type: record.mime }));
          setResult({ url, credit: record.credit, status: "" });
        } else setResult({ url: "", credit: null, status: "No matching image found" });
      })
      .catch((error) => {
        if (!disposed)
          setResult({
            url: "",
            credit: null,
            status: error instanceof Error ? error.message : "Could not load image.",
          });
      });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [
    query,
    visible,
    settings.loaded,
    settings.enabled,
    settings.revision,
    attempt,
    connection,
    localUrl,
    pending,
    print,
  ]);
  const cached = print?.get(normalizeImageQuery(query));
  const image = localUrl
    ? { url: localUrl, credit: null }
    : print !== null
      ? cached
      : result.url
        ? result
        : null;
  return (
    <figure
      ref={frame}
      className="online-image min-w-0 overflow-hidden rounded-lg border bg-background/60"
    >
      <div className="flex w-full items-center justify-center bg-muted/30" style={style}>
        {image ? (
          <img
            src={image.url}
            alt={query}
            loading={print !== null ? undefined : "lazy"}
            decoding="async"
            className="h-full w-full object-contain"
            style={style}
            onError={() =>
              setResult({ url: "", credit: null, status: "This image could not be displayed." })
            }
          />
        ) : (
          <div className="flex min-w-0 flex-col items-center gap-2 p-3 text-center text-xs text-muted-foreground">
            <ImageOff className="h-5 w-5 shrink-0" />
            <span role={print !== null ? undefined : "status"}>
              {pending ? "Preparing image…" : print !== null ? "Image not cached" : result.status}
            </span>
            <span className="line-clamp-3 break-words">
              {query || "Image description unavailable"}
            </span>
            {print === null && !pending && query && (
              <button
                type="button"
                className="no-print rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
                onClick={() => {
                  if (!settings.enabled) openSettings();
                  else {
                    retry.current = true;
                    setAttempt((v) => v + 1);
                  }
                }}
              >
                {settings.enabled ? "Retry" : "Enable online images"}
              </button>
            )}
          </div>
        )}
      </div>
      {!localUrl && (
        <div className="min-h-14">{image?.credit && <Credit credit={image.credit} />}</div>
      )}
    </figure>
  );
}
