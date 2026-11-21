import {
  Children,
  cloneElement,
  isValidElement,
  useRef,
  type ReactNode,
  type ReactElement,
  type HTMLAttributes,
  type Ref,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export function VirtualList({ children }: { children: ReactNode }) {
  const parent = useRef<HTMLDivElement>(null);
  const rows = Children.toArray(children).filter(isValidElement) as ReactElement<
    HTMLAttributes<HTMLLIElement> & { ref?: Ref<HTMLLIElement>; "data-index"?: number }
  >[];
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 86,
    overscan: 5,
    getItemKey: (index) => rows[index].key ?? index,
  });
  return (
    <div ref={parent} className="min-h-0 flex-1 overflow-auto">
      <ul
        style={{
          height: virtual.getTotalSize(),
          position: "relative",
          margin: 0,
          padding: 0,
          listStyle: "none",
        }}
      >
        {virtual.getVirtualItems().map((row) =>
          cloneElement(rows[row.index], {
            ref: virtual.measureElement,
            "data-index": row.index,
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${row.start}px)`,
            },
          }),
        )}
      </ul>
    </div>
  );
}
