import { createContext, memo, useContext, useMemo, useState, type CSSProperties } from "react";
import type { MessageAttachment } from "@/lib/chatgpt-import";
import { Copy, Info, CircleCheck, Star, Trophy, AlertTriangle } from "lucide-react";
import { OnlineImage } from "./OnlineImage";
import { imageQueries } from "@/lib/online-image-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { splitWritingBlocks, type WritingPart } from "@/lib/writing-blocks";
import { parseRichBlocks, type RichNode } from "@/lib/rich-blocks";

export const Markdown = memo(function Markdown({ children }: { children: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});

const draftLabels = new Map([
  ["email", "Email draft"],
  ["chat_message", "Message draft"],
  ["social_post", "Social post"],
  ["document", "Document draft"],
]);

const emailFields = [
  ["recipient", "To"],
  ["cc", "Cc"],
  ["bcc", "Bcc"],
  ["subject", "Subject"],
] as const;
const AttachmentContext = createContext<MessageAttachment[]>([]);

function WritingDraft({ text, attributes }: Extract<WritingPart, { kind: "draft" }>) {
  const [copyStatus, setCopyStatus] = useState<"copied" | "unavailable" | null>(null);
  const variant = attributes.variant?.toLowerCase();
  const label = (variant && draftLabels.get(variant)) || "Draft";

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("unavailable");
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card text-card-foreground">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b px-3 py-2 sm:px-4">
        <h2 className="min-w-0 break-words text-sm font-semibold">
          {attributes.title?.trim() || label}
        </h2>
        <button
          type="button"
          onClick={() => void copyDraft()}
          className="no-print inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          Copy draft
        </button>
      </div>
      <div className="px-3 py-3 sm:px-4">
        {variant === "email" && emailFields.some(([key]) => attributes[key]) && (
          <dl className="mb-3 space-y-1 border-b pb-3 text-sm [overflow-wrap:anywhere]">
            {emailFields.map(([key, field]) =>
              attributes[key] ? (
                <div key={key} className="flex items-baseline gap-2">
                  <dt className="font-medium">{field}</dt>
                  <dd>{attributes[key]}</dd>
                </div>
              ) : null,
            )}
          </dl>
        )}
        <Markdown>{text}</Markdown>
        {copyStatus && (
          <div className="no-print mt-3 text-sm">
            <p role="status">
              {copyStatus === "copied"
                ? "Draft copied."
                : "Clipboard unavailable. Select and copy the Markdown below."}
            </p>
            {copyStatus === "unavailable" && (
              <textarea
                readOnly
                aria-label="Draft Markdown"
                value={text}
                onFocus={(event) => event.currentTarget.select()}
                className="mt-2 w-full rounded-md border bg-background p-2 font-mono text-xs"
                rows={5}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function colour(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^#[a-f\d]{3}(?:[a-f\d]{3})?(?:[a-f\d]{2})?$/i.test(value)) return value;
  return (
    {
      black: "#12151c",
      white: "#ffffff",
      default: "var(--foreground)",
      secondary: "var(--muted-foreground)",
      danger: "#dc525c",
      success: "#35ad82",
      warning: "#ce9b43",
      surface: "var(--card)",
      "surface-secondary": "var(--muted)",
      "surface-tertiary": "var(--accent)",
    } as Record<string, string>
  )[value];
}

function RichElement({ node }: { node: Extract<RichNode, { kind: "element" }> }) {
  const attachments = useContext(AttachmentContext);
  const a = node.attributes;
  const space = (value?: string) =>
    value && /^\d+(?:\.\d+)?$/.test(value) ? `${Math.min(Number(value), 8) * 0.3}rem` : undefined;
  const dimension = (value?: string) =>
    value && /^(?:\d{1,3}(?:\.\d+)?%|\d{1,3}px)$/.test(value) ? value : undefined;
  const style: CSSProperties = {
    background: colour(a.background),
    color: colour(a.color),
    padding: space(a.padding),
    gap: space(a.gap),
    borderRadius: ({ md: 8, lg: 12, xl: 18, full: 999 } as Record<string, number>)[a.radius],
    textAlign: ["left", "center", "right"].includes(a.textalign)
      ? (a.textalign as "left" | "center" | "right")
      : undefined,
    fontWeight: ({ medium: 500, semibold: 600, bold: 700 } as Record<string, number>)[a.weight],
    fontSize: (
      {
        xs: ".8rem",
        sm: ".9rem",
        md: "1rem",
        lg: "1.15rem",
        xl: "1.35rem",
        "2xl": "1.6rem",
      } as Record<string, string>
    )[a.size],
    width: dimension(a.width),
    minWidth: 0,
  };
  if (a.background && !a.color && /^#[a-f\d]{6}$/i.test(String(style.background ?? ""))) {
    const rgb = [1, 3, 5].map((i) => parseInt(String(style.background).slice(i, i + 2), 16));
    style.color = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 < 140 ? "#f5f7fc" : "#182235";
  }
  if (a.background === "black" && !a.color) style.color = "#f5f7fc";
  if (a.border) {
    style.border = "1px solid var(--border)";
    const border = /color\s*:\s*["'](#[a-f\d]{3,8})["']/i.exec(a.border);
    if (border) style.borderColor = border[1];
  }
  const children = <RichContent nodes={node.children} nested />;
  if (node.tag === "writingblock")
    return (
      <WritingDraft
        kind="draft"
        text={node.children
          .map((n) => (n.kind === "markdown" ? n.text : ""))
          .join("")
          .trim()}
        attributes={a}
      />
    );
  if (node.tag === "divider") return <hr className="my-3 opacity-40" />;
  if (node.tag === "spacer") return <div aria-hidden="true" style={{ height: 12 }} />;
  if (node.tag === "icon") {
    const Icon =
      (
        {
          check: CircleCheck,
          "check-circle": CircleCheck,
          star: Star,
          trophy: Trophy,
          warning: AlertTriangle,
        } as Record<string, typeof Info>
      )[a.name] ?? Info;
    return (
      <Icon
        aria-hidden="true"
        className="inline-block h-5 w-5 shrink-0"
        style={{ color: colour(a.color) }}
      />
    );
  }
  if (node.tag.startsWith("asyncimage")) {
    const requested = a.src ?? a.fileid ?? a.id;
    const queries = imageQueries(a.query);
    return (
      <div
        className={queries.length > 1 ? "grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2" : "min-w-0"}
        style={style}
      >
        {(queries.length ? queries : [""]).map((query, index) => {
          const image = attachments.find(
            (item) =>
              item.isImage &&
              (item.id === requested ||
                item.name === requested ||
                Boolean(query && query.includes(item.name))),
          );
          return (
            <OnlineImage
              key={`${index}:${query}`}
              query={query}
              aspectRatio={a.aspectratio}
              localUrl={image?.url && !image.url.startsWith("asset:") ? image.url : null}
              pending={image?.url?.startsWith("asset:")}
            />
          );
        })}
      </div>
    );
  }
  if (["cite", "memorycite", "link"].includes(node.tag))
    return (
      <span className="rich-citation">
        {a.title ||
          (node.tag === "memorycite" ? "Memory reference" : "Source reference unavailable")}
      </span>
    );
  if (node.tag === "input")
    return (
      <span className="rich-readonly">
        {a.value && !/[{}]/.test(a.value) ? a.value : "Input from original reply"}
      </span>
    );
  if (node.tag === "button" || node.tag === "radio")
    return <span className="rich-readonly">{children}</span>;
  if (node.tag === "badge")
    return (
      <span className="rich-badge" style={style}>
        {children}
      </span>
    );
  if (node.tag === "list")
    return (
      <ul className="rich-list" style={style}>
        {children}
      </ul>
    );
  if (node.tag === "list-item") return <li style={style}>{children}</li>;
  if (node.tag === "title")
    return (
      <div className="rich-title" role="heading" aria-level={3} style={style}>
        {children}
      </div>
    );
  if (node.tag === "caption")
    return (
      <div className="rich-caption" style={style}>
        {children}
      </div>
    );
  if (node.tag === "row" || node.tag === "radio-group")
    return (
      <div
        className="rich-row"
        style={{
          ...style,
          alignItems: a.align === "center" ? "center" : "flex-start",
          justifyContent: a.justify === "center" ? "center" : undefined,
        }}
      >
        {children}
      </div>
    );
  if (node.tag === "grid")
    return (
      <div
        className="rich-grid"
        style={{
          ...style,
          gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, Number(a.columns) || 2))}, minmax(0,1fr))`,
        }}
      >
        {children}
      </div>
    );
  return (
    <div className={node.tag === "box" ? "rich-box" : "rich-text"} style={style}>
      {children}
    </div>
  );
}

function RichContent({ nodes, nested = false }: { nodes: RichNode[]; nested?: boolean }) {
  return (
    <>
      {nodes.map((node, index) =>
        node.kind === "element" ? (
          <RichElement key={index} node={node} />
        ) : node.text.trim() ? (
          <Markdown key={index}>
            {nested
              ? node.text
                  .replace(/^\n/, "")
                  .replace(/^ {2,8}(?=\S)/gm, "")
                  .trim()
              : node.text}
          </Markdown>
        ) : null,
      )}
    </>
  );
}

const RichMarkdown = memo(function RichMarkdown({ text }: { text: string }) {
  const nodes = useMemo(() => parseRichBlocks(text), [text]);
  return <RichContent nodes={nodes} />;
});

export const AssistantMarkdown = memo(function AssistantMarkdown({
  children,
  attachments = [],
}: {
  children: string;
  attachments?: MessageAttachment[];
}) {
  const parts = useMemo(() => splitWritingBlocks(children, false), [children]);
  return (
    <AttachmentContext.Provider value={attachments}>
      <div className="space-y-3">
        {parts.map((part, index) =>
          part.kind === "draft" ? (
            <WritingDraft key={index} {...part} />
          ) : (
            part.text.trim() && <RichMarkdown key={index} text={part.text} />
          ),
        )}
      </div>
    </AttachmentContext.Provider>
  );
});
