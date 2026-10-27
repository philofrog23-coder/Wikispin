import { Platform } from 'react-native';
import { USER_AGENT } from '@/core/config';
import { fetchJson, type FetchLike } from '@/core/net';
import type { PoolItem } from '@/core/pools/types';

/**
 * Live library top-up: small, randomly sampled Wikidata queries that add fresh articles to
 * the bundled pools in the background. These mirror tools/build-pools.mjs (keep the two in
 * sync), but each request is deliberately small so it finishes in seconds and stays polite.
 */

const ENWIKI = `?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .`;

const OCCUPATIONS: Record<string, string[]> = {
  'people.politicians': ['Q82955'],
  'people.writers': ['Q36180', 'Q49757', 'Q6625963'],
  'people.scientists': ['Q901', 'Q169470', 'Q593644', 'Q170790'],
  'people.artists': ['Q1028181', 'Q1281618'],
  'people.musicians': ['Q639669', 'Q177220', 'Q36834'],
  'people.actors': ['Q33999', 'Q10800557'],
  'people.athletes': ['Q2066131', 'Q937857', 'Q3665646', 'Q10833314'],
  'people.military': ['Q189290', 'Q47064'],
};

const PLANT_FAMILIES: Record<string, string[]> = {
  'plants.flowers': ['Orchidaceae', 'Rosaceae', 'Asteraceae', 'Liliaceae', 'Ranunculaceae', 'Iridaceae', 'Amaryllidaceae', 'Ericaceae'],
  'plants.trees': ['Pinaceae', 'Fagaceae', 'Betulaceae', 'Sapindaceae', 'Cupressaceae', 'Arecaceae', 'Myrtaceae', 'Salicaceae'],
  'plants.edible': ['Solanaceae', 'Brassicaceae', 'Cucurbitaceae', 'Apiaceae', 'Lamiaceae', 'Rutaceae', 'Musaceae', 'Amaranthaceae'],
  'plants.succulents': ['Cactaceae', 'Crassulaceae', 'Aizoaceae', 'Asphodelaceae'],
};

/** Rough sizes of the event classes, so a random OFFSET lands inside the result set. */
const EVENT_CLASSES: Record<string, { qid: string; approxCount: number }> = {
  'wars.wars': { qid: 'Q198', approxCount: 2000 },
  'wars.battles': { qid: 'Q178561', approxCount: 13000 },
};

const pick = <T,>(list: T[], rng: () => number): T | undefined => list[Math.floor(rng() * list.length)];

/** A small random query for a pool, or null when that pool isn't topped up live. */
export function liveQueryFor(poolId: string, rng: () => number = Math.random): string | null {
  const occ = OCCUPATIONS[poolId];
  if (occ) {
    const qid = pick(occ, rng);
    return `SELECT ?item ?title ?s ?c ?date WHERE {
  SERVICE bd:sample { ?item wdt:P106 wd:${qid} . bd:serviceParam bd:sample.limit 2500 . bd:serviceParam bd:sample.sampleType "RANDOM" . }
  ?item wdt:P31 wd:Q5 ; wikibase:sitelinks ?s .
  ${ENWIKI}
  OPTIONAL { ?item wdt:P27 ?c }
  OPTIONAL { ?item wdt:P569 ?date }
}`;
  }
  const families = PLANT_FAMILIES[poolId];
  if (families) {
    const family = pick(families, rng);
    return `SELECT ?item ?title ?s WHERE {
  ?root wdt:P225 "${family}" ; wdt:P105 wd:Q35409 .
  ?item wdt:P171+ ?root ; wdt:P105 wd:Q7432 ; wikibase:sitelinks ?s .
  ${ENWIKI}
} LIMIT 1500`;
  }
  const ev = EVENT_CLASSES[poolId];
  if (ev) {
    const offset = Math.floor(rng() * Math.max(0, ev.approxCount - 800));
    return `SELECT ?item ?title ?s ?c ?date WHERE {
  { SELECT ?item ?s WHERE { ?item wdt:P31/wdt:P279* wd:${ev.qid} ; wikibase:sitelinks ?s . } LIMIT 800 OFFSET ${offset} }
  ${ENWIKI}
  OPTIONAL { ?item wdt:P17|wdt:P710 ?c }
  OPTIONAL { ?item wdt:P580|wdt:P585 ?date }
}`;
  }
  return null;
}

export const isLivePool = (poolId: string) => liveQueryFor(poolId, () => 0) !== null;

type Binding = Record<string, { value: string } | undefined>;

const qidNum = (uri: string) => Number(uri.slice(uri.lastIndexOf('/Q') + 2));

function parseYear(value: string | undefined): number | null {
  const m = /^(-?)0*(\d+)-/.exec(value ?? '');
  if (!m) return null;
  const y = Number(m[2]) * (m[1] ? -1 : 1);
  return Number.isFinite(y) ? y : null;
}

const JUNK = /^(List of|Lists of|Index of|Outline of|Timeline of)\b|^\d{1,4}s? in |\(disambiguation\)$/i;

/** SPARQL JSON rows (one per item × country × date) → compact pool items, one per article. */
export function parseLiveRows(json: unknown): PoolItem[] {
  const bindings = (json as { results?: { bindings?: Binding[] } } | null)?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  const byItem = new Map<number, { t: string; s: number; c: Set<number>; y: number | null }>();
  for (const b of bindings) {
    const item = b.item?.value;
    const title = b.title?.value;
    if (!item || !title || JUNK.test(title)) continue;
    const q = qidNum(item);
    let e = byItem.get(q);
    if (!e) {
      e = { t: title, s: Number(b.s?.value ?? 0) || 0, c: new Set(), y: null };
      byItem.set(q, e);
    }
    const c = b.c?.value;
    if (c?.includes('/entity/Q')) e.c.add(qidNum(c));
    const y = parseYear(b.date?.value);
    if (y !== null && (e.y === null || y < e.y)) e.y = y;
  }
  return [...byItem.values()].map((e) => [e.t, e.s, [...e.c], e.y] as PoolItem);
}

export async function fetchLiveItems(poolId: string, opts: { signal?: AbortSignal; fetchImpl?: FetchLike } = {}): Promise<PoolItem[]> {
  const query = liveQueryFor(poolId);
  if (!query) return [];
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  // Only CORS-safe headers on the web, so the browser sends a simple request with no preflight.
  const headers: Record<string, string> =
    Platform.OS === 'web' ? { Accept: 'application/sparql-results+json' } : { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT };
  const json = await fetchJson(url, { signal: opts.signal, headers, timeoutMs: 45_000, fetchImpl: opts.fetchImpl });
  return parseLiveRows(json);
}
