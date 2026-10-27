import countriesJson from '@/data/countries.json';
import type { PoolEntry } from './pools/types';

export interface Country {
  id: number;
  name: string;
  flag: string;
}

type CountryRecord = { n: string; iso?: string | null; f?: string };
const TABLE = countriesJson as Record<string, CountryRecord>;

/** Neutral flag for historical states without an ISO code. */
const FALLBACK_FLAG = '🏳️';

export function getCountry(id: number): Country | null {
  const rec = TABLE[String(id)];
  return rec ? { id, name: rec.n, flag: rec.f || FALLBACK_FLAG } : null;
}

export interface CountryOption extends Country {
  count: number;
}

/** Countries that actually occur in the given entries, with entry counts, sorted by name. */
export function countriesIn(entries: PoolEntry[]): CountryOption[] {
  const counts = new Map<number, number>();
  for (const e of entries) for (const c of e.countries) counts.set(c, (counts.get(c) ?? 0) + 1);
  const out: CountryOption[] = [];
  for (const [id, count] of counts) {
    const c = getCountry(id);
    if (c) out.push({ ...c, count });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
