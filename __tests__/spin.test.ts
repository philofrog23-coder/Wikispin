import { seededRng } from '@/core/filters';
import type { PoolEntry } from '@/core/pools/types';
import { buildReel, MAX_ATTEMPTS, resolveAnything, resolveFromPool } from '@/core/spin';
import {
  indexAtMarker,
  jitterFrom,
  MAX_JITTER,
  offsetFor,
  REEL_LENGTH,
  startIndexFor,
  STEP,
  TILE_W,
  WINNER_INDEX,
} from '@/core/spinMath';
import type { ArticleService } from '@/core/wiki/service';
import { WikiError, type ArticleSummary, type WikiErrorKind } from '@/core/wiki/types';

const summary = (title: string): ArticleSummary => ({
  title,
  description: null,
  extract: `${title} is a thing.`,
  thumbnail: null,
  url: `https://en.m.wikipedia.org/wiki/${title}`,
});

const pool = (n: number): PoolEntry[] =>
  Array.from({ length: n }, (_, i) => ({ title: `A${i}`, sitelinks: 1, countries: [], year: null }));

/** Service whose responses are scripted per title; anything not listed succeeds. */
function scripted(failures: Record<string, WikiErrorKind>): ArticleService & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async summary(title) {
      calls.push(title);
      const kind = failures[title];
      if (kind) throw new WikiError(kind);
      return summary(title);
    },
    async random() {
      return summary('Random');
    },
  };
}

describe('spin math', () => {
  const widths = [320, 375, 390, 430, 768, 1024];

  it('lands the marker on the winner for every jitter and viewport', () => {
    for (const w of widths) {
      for (let r = 0; r <= 1; r += 0.05) {
        const x = offsetFor(w, WINNER_INDEX, jitterFrom(r));
        expect(indexAtMarker(x, w)).toBe(WINNER_INDEX);
      }
    }
  });

  it('keeps the stop point inside the tile (not in the gap)', () => {
    expect(MAX_JITTER).toBeLessThan(TILE_W / 2);
    expect(Math.abs(jitterFrom(0))).toBeLessThanOrEqual(MAX_JITTER);
    expect(Math.abs(jitterFrom(1))).toBeLessThanOrEqual(MAX_JITTER);
  });

  it('advances one index per STEP of travel', () => {
    const w = 390;
    const x0 = offsetFor(w, 5);
    expect(indexAtMarker(x0, w)).toBe(5);
    expect(indexAtMarker(x0 - STEP, w)).toBe(6);
    expect(indexAtMarker(x0 + STEP, w)).toBe(4);
  });

  it('fills the reel edge to edge before a spin, on narrow and wide screens', () => {
    for (const w of [320, 390, 840, 1150]) {
      const start = startIndexFor(w);
      const x = offsetFor(w, start);
      expect(x).toBeLessThanOrEqual(0); // tile 0 begins at or left of the viewport edge
      expect(start).toBeLessThan(WINNER_INDEX);
      // tiles after the winner still cover the right half when the reel stops
      expect((REEL_LENGTH - WINNER_INDEX) * STEP).toBeGreaterThanOrEqual(w / 2);
    }
  });

  it('puts the winner at the winner index of the reel', () => {
    const reel = buildReel({ winner: 'W', length: REEL_LENGTH, winnerIndex: WINNER_INDEX, decoySource: pool(30), rng: seededRng(9) });
    expect(reel).toHaveLength(REEL_LENGTH);
    expect(reel[WINNER_INDEX]).toBe('W');
    expect(reel.filter((t) => t === 'W')).toHaveLength(1);
  });

  it('builds a reel even from a one-entry pool', () => {
    const reel = buildReel({ winner: 'A0', length: 10, winnerIndex: 7, decoySource: pool(1), rng: seededRng(1) });
    expect(reel).toHaveLength(10);
    expect(reel[7]).toBe('A0');
  });
});

describe('resolveFromPool', () => {
  it('returns the first loadable article', async () => {
    const service = scripted({});
    const out = await resolveFromPool({ entries: pool(10), recent: [], rng: seededRng(3), service });
    expect(out.kind).toBe('article');
    expect(service.calls).toHaveLength(1);
  });

  it('silently skips 404s and disambiguation pages', async () => {
    const entries = pool(3);
    const service = scripted({ A0: 'notFound', A1: 'disambiguation' });
    const out = await resolveFromPool({ entries, recent: [], rng: seededRng(4), service });
    expect(out).toMatchObject({ kind: 'article', title: 'A2' });
    expect(new Set(service.calls).size).toBe(service.calls.length); // never retries the same title
  });

  it(`gives up after ${MAX_ATTEMPTS} unusable pages`, async () => {
    const entries = pool(20);
    const failures = Object.fromEntries(entries.map((e) => [e.title, 'noExtract' as WikiErrorKind]));
    const service = scripted(failures);
    await expect(resolveFromPool({ entries, recent: [], rng: seededRng(5), service })).rejects.toMatchObject({ kind: 'exhausted' });
    expect(service.calls).toHaveLength(MAX_ATTEMPTS);
  });

  it('keeps the pick but marks it unloaded when offline', async () => {
    const entries = pool(5);
    const failures = Object.fromEntries(entries.map((e) => [e.title, 'offline' as WikiErrorKind]));
    const out = await resolveFromPool({ entries, recent: [], rng: seededRng(6), service: scripted(failures) });
    expect(out.kind).toBe('unloaded');
    if (out.kind === 'unloaded') expect(out.reason).toBe('offline');
  });

  it('rejects an empty pool', async () => {
    await expect(resolveFromPool({ entries: [], recent: [], rng: seededRng(7), service: scripted({}) })).rejects.toMatchObject({
      kind: 'emptyPool',
    });
  });
});

describe('resolveAnything', () => {
  it('retries random pages that are disambiguations', async () => {
    let n = 0;
    const service: ArticleService = {
      summary: async (t) => summary(t),
      random: async () => {
        n += 1;
        if (n < 3) throw new WikiError('disambiguation');
        return summary('Third');
      },
    };
    await expect(resolveAnything({ service })).resolves.toMatchObject({ title: 'Third' });
  });

  it('surfaces network errors (there is no offline fallback for Anything)', async () => {
    const service: ArticleService = {
      summary: async (t) => summary(t),
      random: async () => {
        throw new WikiError('offline');
      },
    };
    await expect(resolveAnything({ service })).rejects.toMatchObject({ kind: 'offline' });
  });
});
