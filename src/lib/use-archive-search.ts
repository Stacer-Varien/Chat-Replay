import { useEffect, useRef, useState } from "react";
import type { Conversation } from "./chatgpt-import";
import type { SearchHit, SearchOptions } from "./chat-search";
import { getCollection } from "./collection-session";

export function useArchiveSearch(
  conversations: Conversation[],
  options: SearchOptions,
  enabled: boolean,
) {
  const [hits, setHits] = useState<SearchHit[]>([]),
    [searching, setSearching] = useState(false);
  const request = useRef(0);
  useEffect(() => {
    const id = ++request.current;
    if (!enabled) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      const session = getCollection(conversations);
      if (!session) {
        setSearching(false);
        return;
      }
      void session
        .search(options)
        .then((results) => {
          if (id === request.current) {
            setHits(results);
            setSearching(false);
          }
        })
        .catch(() => {
          if (id === request.current) {
            setHits([]);
            setSearching(false);
          }
        });
    }, 100);
    return () => {
      clearTimeout(timer);
      request.current++;
    };
  }, [conversations, options, enabled]);
  return { hits, ready: true, searching };
}
