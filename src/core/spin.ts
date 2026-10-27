import { pickDecoys, pickRandom, type Rng } from './filters';
import type { PoolEntry } from './pools/types';
import type { ArticleService } from './wiki/service';
import { SKIPPABLE, WikiError, type ArticleSummary, type WikiErrorKind } from './wiki/types';

export const MAX_ATTEMPTS = 5;

export type SpinOutcome =
  | { kind: 'article'; title: string; summary: ArticleSummary }
  /** The pick is known (from the bundled pool) but its article couldn't be loaded, e.g. offline. */
  | { kind: 'unloaded'; title: string; reason: WikiErrorKind };

/**
 * Picks a winner from an already-filtered pool and loads its summary.
 * Pages that can't be shown (404, disambiguation, no extract) are skipped silently,
 * up to MAX_ATTEMPTS. Network problems don't trigger new picks: the winner is kept
 * and returned as "unloaded" so the spin still works offline.
 */
export async function resolveFromPool(opts: {
  entries: PoolEntry[];
  recent: readonly string[];
  rng: Rng;
  service: ArticleService;
  signal?: AbortSignal;
}): Promise<SpinOutcome> {
  const { entries, recent, rng, service, signal } = opts;
  if (!entries.length) throw new WikiError('emptyPool');

  const tried = new Set<string>();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const pick = pickRandom(entries, rng, recent, tried);
    if (!pick) break;
    tried.add(pick.title);
    try {
      const summary = await service.summary(pick.title, signal);
      return { kind: 'article', title: summary.title, summary };
    } catch (e) {
      if (e instanceof WikiError && SKIPPABLE.has(e.kind)) continue;
      if (e instanceof WikiError) return { kind: 'unloaded', title: pick.title, reason: e.kind };
      throw e; // aborts and programming errors
    }
  }
  throw new WikiError('exhausted');
}

/** "Anything" mode: Wikipedia's own random article endpoint (needs a connection). */
export async function resolveAnything(opts: { service: ArticleService; signal?: AbortSignal }): Promise<SpinOutcome> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const summary = await opts.service.random(opts.signal);
      return { kind: 'article', title: summary.title, summary };
    } catch (e) {
      if (e instanceof WikiError && SKIPPABLE.has(e.kind)) continue;
      throw e;
    }
  }
  throw new WikiError('exhausted');
}

/** Builds the reel: decoys everywhere, the winner at `winnerIndex`. */
export function buildReel(opts: {
  winner: string;
  length: number;
  winnerIndex: number;
  decoySource: PoolEntry[] | string[];
  rng: Rng;
}): string[] {
  const { winner, length, winnerIndex, decoySource, rng } = opts;
  const decoys =
    decoySource.length && typeof decoySource[0] === 'string'
      ? pickFromStrings(decoySource as string[], length, rng, winner)
      : pickDecoys(decoySource as PoolEntry[], length, rng, winner);
  const reel = decoys.slice(0, length);
  while (reel.length < length) reel.push(winner);
  reel[winnerIndex] = winner;
  return reel;
}

function pickFromStrings(source: string[], count: number, rng: Rng, avoid: string): string[] {
  const pool = source.filter((t) => t !== avoid);
  if (!pool.length) return [];
  return Array.from({ length: count }, () => pool[Math.floor(rng() * pool.length)] ?? avoid);
}
