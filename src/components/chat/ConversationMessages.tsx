import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ChainItem } from "@/lib/chatgpt-import";
import { messageSegments } from "@/lib/message-segments";
import { Message } from "./Message";

export function ConversationMessages({
  chain,
  focusNodeId,
  viewKey,
  onChange,
}: {
  chain: ChainItem[];
  focusNodeId?: string | null;
  viewKey?: string;
  onChange: (key: string, delta: number, total: number) => void;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () =>
      chain.flatMap((item) =>
        messageSegments(item.node.text).map((text, index, segments) => ({
          key: `${item.node.id}:${index}`,
          original: item,
          item: {
            ...item,
            node: {
              ...item.node,
              text,
              attachments: index === segments.length - 1 ? item.node.attachments : [],
            },
          },
          continuation: index > 0,
          last: index === segments.length - 1,
        })),
      ),
    [chain],
  );
  let offset = 0;
  try {
    if (viewKey) offset = Number(localStorage.getItem(`scroll:${viewKey}`) ?? 0);
  } catch {
    /* Private browsing may disable session storage. */
  }
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parent.current,
    estimateSize: (index) => Math.min(1600, 100 + rows[index].item.node.text.length * 0.25),
    overscan: 3,
    getItemKey: (index) => rows[index].key,
    initialOffset: offset,
  });
  useEffect(() => {
    if (!focusNodeId) return;
    const index = rows.findIndex((row) => row.original.node.id === focusNodeId);
    if (index >= 0) {
      virtual.scrollToIndex(index, { align: "start" });
      const timer = setTimeout(() => virtual.scrollToIndex(index, { align: "start" }), 120);
      return () => clearTimeout(timer);
    }
  }, [focusNodeId, rows, virtual]);
  return (
    <div
      ref={parent}
      className="min-h-0 flex-1 overflow-auto"
      onScroll={() => {
        if (viewKey && parent.current)
          try {
            localStorage.setItem(`scroll:${viewKey}`, String(parent.current.scrollTop));
          } catch {
            /* Scrolling remains available without persisted position. */
          }
      }}
    >
      <div style={{ height: virtual.getTotalSize(), width: "100%", position: "relative" }}>
        {virtual.getVirtualItems().map((row) => {
          const value = rows[row.index];
          return (
            <div
              key={value.key}
              data-index={row.index}
              ref={virtual.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${row.start}px)`,
              }}
            >
              <Message
                item={value.item}
                continuation={value.continuation}
                hideBranches={!value.last}
                highlighted={value.original.node.id === focusNodeId}
                onPrev={() => onChange(value.original.selectionKey, -1, value.original.total)}
                onNext={() => onChange(value.original.selectionKey, 1, value.original.total)}
              />
            </div>
          );
        })}
      </div>
      <div className="h-16" />
    </div>
  );
}
