/**
 * Compact pool entry as written by tools/build-pools.mjs:
 * [enwiki title, Wikidata sitelink count, country QID numbers, year (birth / start) or null]
 */
export type PoolItem = [title: string, sitelinks: number, countries: number[], year: number | null];

export interface PoolFile {
  id: string;
  generatedAt: string;
  count: number;
  items: PoolItem[];
}

export interface PoolEntry {
  title: string;
  sitelinks: number;
  countries: number[];
  year: number | null;
}

export const toEntry = ([title, sitelinks, countries, year]: PoolItem): PoolEntry => ({
  title,
  sitelinks,
  countries,
  year,
});
