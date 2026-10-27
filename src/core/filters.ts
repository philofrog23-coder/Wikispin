import type { PoolEntry } from './pools/types';

export type Obscurity = 'famous' | 'balanced' | 'obscure';

export interface Era {
  id: string;
  label: string;
  /** Inclusive range. */
  from: number;
  to: number;
}

export const ERAS: Era[] = [
  { id: 'pre1000', label: 'Before 1000', from: -100000, to: 999 },
  { id: '1000s', label: '1000–1499', from: 1000, to: 1499 },
  { id: '1500s', label: '1500s', from: 1500, to: 1599 },
  { id: '1600s', label: '1600s', from: 1600, to: 1699 },
  { id: '1700s', label: '1700s', from: 1700, to: 1799 },
  { id: '1800s', label: '1800s', from: 1800, to: 1899 },
  { id: '1900s', label: '1900s', from: 1900, to: 1999 },
  { id: '2000s', label: '2000s', from: 2000, to: 2999 },
];

export const OBSCURITY_LEVELS: { id: Obscurity; label: string; hint: string }[] = [
  { id: 'famous', label: 'Famous', hint: 'The best-known 20%' },
  { id: 'balanced', label: 'Balanced', hint: 'The broad middle' },
  { id: 'obscure', label: 'Obscure', hint: 'Hidden gems' },
];

export interface FilterValues {
  country: number | null;
  era: string | null;
  obscurity: Obscurity;
  /** Hard ceiling from the subcategory itself (e.g. "Historical figures"). */
  maxYear?: number;
}

export const DEFAULT_FILTERS: Omit<FilterValues, 'maxYear'> = { country: null, era: null, obscurity: 'balanced' };

/** Below this size the obscurity bands would be too thin to be meaningful, so they are ignored. */
const MIN_FOR_OBSCURITY = 10;

/** Country / era / maxYear filtering. Obscurity is applied separately because it's relative to this result. */
export function applyHardFilters(entries: PoolEntry[], f: FilterValues): PoolEntry[] {
  const era = f.era ? ERAS.find((e) => e.id === f.era) : undefined;
  return entries.filter((e) => {
    if (f.country !== null && !e.countries.includes(f.country)) return false;
    if (f.maxYear !== undefined && (e.year === null || e.year > f.maxYear)) return false;
    if (era && (e.year === null || e.year < era.from || e.year > era.to)) return false;
    return true;
  });
}

/**
 * Obscurity bands are sitelink-count percentiles inside the already-filtered pool:
 * famous = top 20 %, balanced = 20–80 %, obscure = bottom 20 % (excluding entries with
 * fewer than 2 sitelinks, which are often stubs).
 */
export function applyObscurity(entries: PoolEntry[], level: Obscurity): PoolEntry[] {
  if (entries.length < MIN_FOR_OBSCURITY) return entries;
  const sorted = [...entries].sort((a, b) => b.sitelinks - a.sitelinks);
  const n = sorted.length;
  const top = Math.max(1, Math.round(n * 0.2));
  const bottomStart = Math.min(n - 1, Math.round(n * 0.8));
  switch (level) {
    case 'famous':
      return sorted.slice(0, top);
    case 'balanced':
      return sorted.slice(top, bottomStart);
    case 'obscure': {
      const band = sorted.slice(bottomStart).filter((e) => e.sitelinks >= 2);
      return band.length > 0 ? band : sorted.slice(bottomStart);
    }
  }
}

export function filterPool(entries: PoolEntry[], f: FilterValues): PoolEntry[] {
  return applyObscurity(applyHardFilters(entries, f), f.obscurity);
}

export type Rng = () => number;

export const RECENT_LIMIT = 50;
/** Repeats are only avoided while the filtered pool is larger than this. */
export const REPEAT_GUARD_MIN_POOL = 100;

/**
 * Uniform random pick, avoiding recently shown titles (when the pool is big enough)
 * and any titles already tried in this spin (e.g. a summary that 404'd).
 */
export function pickRandom(
  entries: PoolEntry[],
  rng: Rng,
  recent: readonly string[] = [],
  exclude: ReadonlySet<string> = new Set(),
): PoolEntry | null {
  let candidates = exclude.size ? entries.filter((e) => !exclude.has(e.title)) : entries;
  if (candidates.length > REPEAT_GUARD_MIN_POOL && recent.length) {
    const recentSet = new Set(recent);
    const fresh = candidates.filter((e) => !recentSet.has(e.title));
    if (fresh.length) candidates = fresh;
  }
  if (!candidates.length) return null;
  return candidates[Math.floor(rng() * candidates.length)] ?? null;
}

/** Titles for the decoy reel tiles. Repeats are allowed when the pool is small. */
export function pickDecoys(entries: PoolEntry[], count: number, rng: Rng, avoidTitle?: string): string[] {
  const pool = entries.filter((e) => e.title !== avoidTitle);
  if (!pool.length) return Array.from({ length: count }, () => avoidTitle ?? '?');
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(pool[Math.floor(rng() * pool.length)]?.title ?? '?');
  return out;
}

export function pushRecent(recent: readonly string[], title: string): string[] {
  return [title, ...recent.filter((t) => t !== title)].slice(0, RECENT_LIMIT);
}

/** Small seeded RNG for tests and reproducible previews. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
