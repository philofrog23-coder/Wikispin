import {
  applyHardFilters,
  applyObscurity,
  filterPool,
  pickDecoys,
  pickRandom,
  pushRecent,
  RECENT_LIMIT,
  seededRng,
} from '@/core/filters';
import type { PoolEntry } from '@/core/pools/types';

const FRANCE = 142;
const JAPAN = 17;

function makePool(n: number): PoolEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    title: `Article ${i}`,
    sitelinks: i + 1, // 1..n
    countries: i % 2 === 0 ? [FRANCE] : [JAPAN],
    year: 1500 + i,
  }));
}

describe('hard filters', () => {
  const pool = makePool(400);

  it('keeps only entries from the selected country', () => {
    const out = applyHardFilters(pool, { country: FRANCE, era: null, obscurity: 'balanced' });
    expect(out.length).toBe(200);
    expect(out.every((e) => e.countries.includes(FRANCE))).toBe(true);
  });

  it('filters by era using the inclusive century range', () => {
    const out = applyHardFilters(pool, { country: null, era: '1700s', obscurity: 'balanced' });
    expect(out.length).toBe(100);
    expect(out.every((e) => e.year !== null && e.year >= 1700 && e.year <= 1799)).toBe(true);
  });

  it('drops entries without a year when an era or maxYear is set', () => {
    const withNull = [...pool, { title: 'No year', sitelinks: 5, countries: [], year: null }];
    expect(applyHardFilters(withNull, { country: null, era: '1500s', obscurity: 'balanced' }).some((e) => e.title === 'No year')).toBe(
      false,
    );
    expect(applyHardFilters(withNull, { country: null, era: null, obscurity: 'balanced', maxYear: 1899 }).some((e) => e.title === 'No year')).toBe(
      false,
    );
  });

  it('combines country and era', () => {
    const out = applyHardFilters(pool, { country: JAPAN, era: '1500s', obscurity: 'balanced' });
    expect(out.length).toBe(50);
  });
});

describe('obscurity percentiles', () => {
  const pool = makePool(100); // sitelinks 1..100

  it('famous is the top 20%', () => {
    const out = applyObscurity(pool, 'famous');
    expect(out.length).toBe(20);
    expect(Math.min(...out.map((e) => e.sitelinks))).toBe(81);
  });

  it('balanced is the middle 60%', () => {
    const out = applyObscurity(pool, 'balanced');
    expect(out.length).toBe(60);
    expect(Math.max(...out.map((e) => e.sitelinks))).toBe(80);
    expect(Math.min(...out.map((e) => e.sitelinks))).toBe(21);
  });

  it('obscure is the bottom 20% without single-sitelink entries', () => {
    const out = applyObscurity(pool, 'obscure');
    expect(out.map((e) => e.sitelinks).sort((a, b) => a - b)).toEqual(Array.from({ length: 19 }, (_, i) => i + 2));
  });

  it('is ignored for tiny pools', () => {
    expect(applyObscurity(makePool(5), 'famous').length).toBe(5);
  });

  it('applies after the hard filters (percentiles are relative)', () => {
    const out = filterPool(makePool(400), { country: FRANCE, era: null, obscurity: 'famous' });
    expect(out.length).toBe(40);
  });
});

describe('random pick', () => {
  it('returns null for an empty pool', () => {
    expect(pickRandom([], Math.random)).toBeNull();
  });

  it('avoids recent titles when the pool is large', () => {
    const pool = makePool(200);
    const recent = pool.slice(0, 150).map((e) => e.title);
    const rng = seededRng(1);
    for (let i = 0; i < 200; i++) {
      const pick = pickRandom(pool, rng, recent);
      expect(recent).not.toContain(pick?.title);
    }
  });

  it('allows repeats when the pool is small', () => {
    const pool = makePool(50);
    const recent = pool.map((e) => e.title);
    expect(pickRandom(pool, seededRng(2), recent)).not.toBeNull();
  });

  it('never returns excluded titles', () => {
    const pool = makePool(3);
    const exclude = new Set(['Article 0', 'Article 1']);
    expect(pickRandom(pool, seededRng(3), [], exclude)?.title).toBe('Article 2');
    expect(pickRandom(pool, seededRng(3), [], new Set(pool.map((e) => e.title)))).toBeNull();
  });

  it('is roughly uniform', () => {
    const pool = makePool(4);
    const counts: Record<string, number> = {};
    const rng = seededRng(42);
    for (let i = 0; i < 8000; i++) {
      const t = pickRandom(pool, rng)?.title ?? '';
      counts[t] = (counts[t] ?? 0) + 1;
    }
    for (const c of Object.values(counts)) expect(Math.abs(c - 2000)).toBeLessThan(200);
  });

  it('decoys never include the winner when alternatives exist', () => {
    const decoys = pickDecoys(makePool(10), 40, seededRng(5), 'Article 3');
    expect(decoys).toHaveLength(40);
    expect(decoys).not.toContain('Article 3');
  });

  it('keeps the recent list short and de-duplicated', () => {
    let recent: string[] = [];
    for (let i = 0; i < 80; i++) recent = pushRecent(recent, `T${i % 60}`);
    expect(recent.length).toBe(RECENT_LIMIT);
    expect(new Set(recent).size).toBe(recent.length);
    expect(recent[0]).toBe('T19');
  });
});
