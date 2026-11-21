import { computeChain } from "./chatgpt-import.ts";
import type { SearchHit, SearchOptions } from "./chat-search";
import type { ArchiveSearchIndex, SearchIndexEntry } from "./chat-search-index";

type Term = { text: string; excluded: boolean };
function compile(query: string): Term[][] {
  return query
    .toLowerCase()
    .split(/\s+\bor\b\s+/i)
    .map((group) =>
      (group.match(/(?:-?(?:not:)?"[^"]+")|\S+/g) ?? [])
        .map((raw) => ({
          excluded: /^(?:-|not:)/i.test(raw),
          text: raw
            .replace(/^(?:-|not:)/i, "")
            .replace(/^"|"$/g, "")
            .trim(),
        }))
        .filter((term) => term.text),
    );
}
function matches(text: string, groups: Term[][]) {
  return groups.some((group) => group.every((term) => text.includes(term.text) !== term.excluded));
}
function grams(text: string) {
  const set = new Set<number>();
  for (let i = 0; i < text.length - 2; i++)
    set.add(
      ((text.charCodeAt(i) * 31 + text.charCodeAt(i + 1)) * 31 + text.charCodeAt(i + 2)) >>> 0,
    );
  return set;
}
function inRange(time: number | null, o: SearchOptions) {
  return !(
    (o.fromTs !== null && (time === null || time < o.fromTs)) ||
    (o.toTs !== null && (time === null || time > o.toTs))
  );
}

export class SearchEngine {
  private grouped = new Map<string, SearchIndexEntry[]>();
  private parents = new Map<string, SearchIndexEntry>();
  private postings = new Map<number, Uint32Array>();
  private paths = new Map<string, { key: string; ids: Set<string> }>();
  private prepared = false;
  private ordinals = new Map<SearchIndexEntry, number>();
  readonly index: ArchiveSearchIndex;
  constructor(index: ArchiveSearchIndex) {
    this.index = index;
    for (const [ordinal, entry] of index.entries.entries()) {
      this.ordinals.set(entry, ordinal);
      const list = this.grouped.get(entry.conversationId) ?? [];
      list.push(entry);
      this.grouped.set(entry.conversationId, list);
      this.parents.set(`${entry.conversationId}:${entry.nodeId}`, entry);
    }
  }
  async prepare() {
    if (!this.index.terms) {
      const terms: Record<string, number[]> = Object.create(null);
      for (const [ordinal, entry] of this.index.entries.entries()) {
        for (const word of new Set(entry.text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []))
          if (word.length >= 3) (terms[word] ??= []).push(ordinal);
        if (ordinal % 200 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      this.index.terms = terms;
    }
    const width = Math.ceil(this.index.conversations.length / 32);
    if (this.index.trigrams) {
      const words = Uint32Array.from(this.index.trigrams.words);
      this.index.trigrams.keys.forEach((gram, i) =>
        this.postings.set(gram, words.subarray(i * width, (i + 1) * width)),
      );
      this.prepared = true;
      return;
    }
    let processed = 0;
    for (const [ordinal, conversation] of this.index.conversations.entries()) {
      const unique = new Set<number>();
      for (const entry of this.grouped.get(conversation.id) ?? [])
        for (const gram of grams(entry.text.toLowerCase())) unique.add(gram);
      for (const gram of unique) {
        const bits = this.postings.get(gram) ?? new Uint32Array(width);
        bits[ordinal >>> 5] |= 1 << (ordinal & 31);
        this.postings.set(gram, bits);
      }
      if (++processed % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    this.index.trigrams = {
      keys: [...this.postings.keys()],
      words: [...this.postings.values()].flatMap((bits) => [...bits]),
    };
    this.prepared = true;
  }
  resolve(conversationId: string, nodeId: string) {
    const selection: Record<string, number> = {};
    let current = this.parents.get(`${conversationId}:${nodeId}`);
    let guard = 0;
    while (current && guard++ < this.index.entries.length) {
      selection[current.parentId] = current.siblingIndex;
      if (current.parentId === "__root__") break;
      current = this.parents.get(`${conversationId}:${current.parentId}`);
    }
    return selection;
  }
  async search(
    options: SearchOptions,
    obsolete: () => boolean = () => false,
  ): Promise<SearchHit[]> {
    const query = options.query.trim(),
      groups = compile(query),
      hits: SearchHit[] = [];
    const candidate = (ordinal: number) =>
      !this.prepared ||
      !query ||
      groups.some((group) =>
        group.every(
          (term) =>
            term.excluded ||
            term.text.length < 3 ||
            [...grams(term.text)].every((gram) =>
              Boolean((this.postings.get(gram)?.[ordinal >>> 5] ?? 0) & (1 << (ordinal & 31))),
            ),
        ),
      );
    const max = options.maxResults ?? 100;
    let candidateEntries: Set<number> | null = null;
    if (query && this.index.terms) {
      const union = new Set<number>();
      let unrestricted = false;
      for (const group of groups) {
        const needle = group
          .filter((term) => !term.excluded)
          .flatMap((term) => term.text.match(/[\p{L}\p{N}_]{3,}/gu) ?? [])
          .sort((a, b) => b.length - a.length)[0];
        if (!needle) {
          unrestricted = true;
          break;
        }
        for (const [word, ordinals] of Object.entries(this.index.terms))
          if (word.includes(needle)) for (const ordinal of ordinals) union.add(ordinal);
      }
      if (!unrestricted) candidateEntries = union;
    }
    let checked = 0;
    for (const [ordinal, conversation] of this.index.conversations.entries()) {
      if (obsolete()) return [];
      const date = conversation.updateTime ?? conversation.createTime;
      if (query && matches(conversation.title.toLowerCase(), groups) && inRange(date, options))
        hits.push({
          key: `${conversation.id}:title`,
          conversationId: conversation.id,
          conversationTitle: conversation.title,
          nodeId: null,
          role: "title",
          preview: conversation.title,
          label: "Title match",
          selection: {},
          createTime: date,
          isVariant: false,
        });
      if (!candidate(ordinal)) continue;
      const selection = options.selections?.[conversation.id] ?? {};
      const pathKey = JSON.stringify(selection);
      let visible = this.paths.get(conversation.id);
      if (!visible || visible.key !== pathKey) {
        visible = {
          key: pathKey,
          ids: new Set(computeChain(conversation, selection).map((item) => item.node.id)),
        };
        this.paths.set(conversation.id, visible);
      }
      for (const entry of this.grouped.get(conversation.id) ?? []) {
        if (candidateEntries && !candidateEntries.has(this.ordinals.get(entry)!)) continue;
        if (options.author !== "all" && entry.role !== options.author) continue;
        if (options.mode === "visible" && !visible.ids.has(entry.nodeId)) continue;
        const time = entry.createTime ?? date;
        if (!inRange(time, options)) continue;
        if (query && !matches(entry.text.toLowerCase(), groups)) continue;
        const label = entry.role === "user" ? "Prompt" : "Response";
        const term = groups.flat().find((t) => !t.excluded)?.text ?? "";
        const at = entry.text.toLowerCase().indexOf(term);
        const start = Math.max(0, at - 34);
        hits.push({
          key: `${conversation.id}:${entry.nodeId}`,
          conversationId: conversation.id,
          conversationTitle: conversation.title,
          nodeId: entry.nodeId,
          role: entry.role,
          preview: `${start ? "…" : ""}${entry.text.slice(start, start + 170).replace(/\s+/g, " ")}`,
          label:
            entry.siblingCount > 1
              ? `${label} ${entry.siblingIndex + 1}/${entry.siblingCount}`
              : label,
          selection: {},
          createTime: time,
          isVariant: !visible.ids.has(entry.nodeId),
        });
        if (hits.length >= max) break;
      }
      if (hits.length >= max) break;
      if (++checked % 16 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return hits.sort((a, b) => (b.createTime ?? 0) - (a.createTime ?? 0)).slice(0, max);
  }
}
