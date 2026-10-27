import { DEFAULT_WIKI_LANG } from '@/core/config';
import { fetchJson, type FetchLike } from '@/core/net';
import type { PoolEntry } from '@/core/pools/types';
import { WikiError } from './types';

export type TopicKind = 'search' | 'category';

export interface TopicResult {
  entries: PoolEntry[];
  /** Wikipedia's "did you mean" for searches, if any. */
  suggestion: string | null;
  /** Total matches Wikipedia reports (search) or pages collected (category). */
  total: number;
}

/** Live topic pools: any search query or any Wikipedia category becomes a reel. */
export interface TopicSource {
  search(query: string, signal?: AbortSignal): Promise<TopicResult>;
  category(name: string, signal?: AbortSignal): Promise<TopicResult>;
  suggestCategories(prefix: string, signal?: AbortSignal): Promise<string[]>;
}

const SEARCH_LIMIT = 500; // the API maximum for anonymous clients
const CATEGORY_MAX_REQUESTS = 6;
const CATEGORY_MAX_PAGES = 1500;
const CATEGORY_MAX_DEPTH = 2;

/** Lists, indexes and disambiguations make poor spins. */
export function isSpinnableTitle(title: string): boolean {
  return !/^(List of|Lists of|Index of|Outline of|Timeline of|Glossary of)\b/i.test(title) && !/\(disambiguation\)$/i.test(title);
}

const toEntry = (title: string): PoolEntry => ({ title, sitelinks: 0, countries: [], year: null });

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Parses action=query&list=search (formatversion=2). */
export function parseSearch(json: unknown): TopicResult {
  if (!isObject(json) || !isObject(json.query)) throw new WikiError('server', 'Unexpected search response');
  const q = json.query;
  const hits = Array.isArray(q.search) ? q.search : [];
  const titles = hits
    .map((h) => (isObject(h) && typeof h.title === 'string' ? h.title : null))
    .filter((t): t is string => !!t && isSpinnableTitle(t));
  const info = isObject(q.searchinfo) ? q.searchinfo : {};
  return {
    entries: [...new Set(titles)].map(toEntry),
    suggestion: typeof info.suggestion === 'string' ? info.suggestion : null,
    total: typeof info.totalhits === 'number' ? info.totalhits : titles.length,
  };
}

/** Parses action=query&list=categorymembers (formatversion=2) into pages and subcategories. */
export function parseCategoryMembers(json: unknown): { pages: string[]; subcats: string[]; next: string | null } {
  if (!isObject(json) || !isObject(json.query)) throw new WikiError('server', 'Unexpected category response');
  const members = Array.isArray(json.query.categorymembers) ? json.query.categorymembers : [];
  const pages: string[] = [];
  const subcats: string[] = [];
  for (const m of members) {
    if (!isObject(m) || typeof m.title !== 'string') continue;
    if (m.ns === 0) pages.push(m.title);
    else if (m.ns === 14) subcats.push(m.title);
  }
  const cont = isObject(json.continue) && typeof json.continue.cmcontinue === 'string' ? json.continue.cmcontinue : null;
  return { pages, subcats, next: cont };
}

/** Parses action=opensearch in the Category namespace. */
export function parseCategorySuggestions(json: unknown): string[] {
  if (!Array.isArray(json) || !Array.isArray(json[1])) return [];
  return (json[1] as unknown[])
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.replace(/^Category:/, ''));
}

/** "category:impressionist painters" → "Category:Impressionist painters" */
export function normalizeCategory(name: string): string {
  const bare = name.trim().replace(/^category:\s*/i, '');
  return `Category:${bare.charAt(0).toUpperCase()}${bare.slice(1)}`;
}

export class WikipediaTopicSource implements TopicSource {
  constructor(
    private lang: string = DEFAULT_WIKI_LANG,
    private fetchImpl?: FetchLike,
  ) {}

  private api(params: Record<string, string>): string {
    const qs = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
    return `https://${this.lang}.wikipedia.org/w/api.php?${qs.toString()}`;
  }

  async search(query: string, signal?: AbortSignal): Promise<TopicResult> {
    const json = await fetchJson(
      this.api({ action: 'query', list: 'search', srsearch: query, srnamespace: '0', srlimit: String(SEARCH_LIMIT), srprop: '' }),
      { signal, fetchImpl: this.fetchImpl },
    );
    return parseSearch(json);
  }

  /** Pages of a category and its subcategories (breadth-first, bounded). */
  async category(name: string, signal?: AbortSignal): Promise<TopicResult> {
    const queue: { title: string; depth: number; cont: string | null }[] = [{ title: normalizeCategory(name), depth: 0, cont: null }];
    const seenCats = new Set<string>();
    const pages = new Set<string>();
    let requests = 0;
    while (queue.length && requests < CATEGORY_MAX_REQUESTS && pages.size < CATEGORY_MAX_PAGES) {
      const item = queue.shift();
      if (!item) break;
      const key = `${item.title}|${item.cont ?? ''}`;
      if (seenCats.has(key)) continue;
      seenCats.add(key);
      requests += 1;
      const params: Record<string, string> = {
        action: 'query',
        list: 'categorymembers',
        cmtitle: item.title,
        cmtype: 'page|subcat',
        cmlimit: '500',
      };
      if (item.cont) params.cmcontinue = item.cont;
      const { pages: found, subcats, next } = parseCategoryMembers(await fetchJson(this.api(params), { signal, fetchImpl: this.fetchImpl }));
      for (const p of found) if (isSpinnableTitle(p)) pages.add(p);
      if (next) queue.unshift({ title: item.title, depth: item.depth, cont: next });
      if (item.depth < CATEGORY_MAX_DEPTH) for (const sc of subcats) queue.push({ title: sc, depth: item.depth + 1, cont: null });
    }
    if (requests === 1 && pages.size === 0 && queue.length === 0) throw new WikiError('notFound', 'Empty or missing category');
    return { entries: [...pages].map(toEntry), suggestion: null, total: pages.size };
  }

  async suggestCategories(prefix: string, signal?: AbortSignal): Promise<string[]> {
    if (prefix.trim().length < 2) return [];
    const json = await fetchJson(this.api({ action: 'opensearch', namespace: '14', search: prefix.trim(), limit: '8' }), {
      signal,
      fetchImpl: this.fetchImpl,
      timeoutMs: 6000,
    });
    return parseCategorySuggestions(json);
  }
}
