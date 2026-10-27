import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PoolRepository } from '@/core/pools/repository';
import { toEntry, type PoolEntry, type PoolItem } from '@/core/pools/types';
import { fetchLiveItems, isLivePool } from './wikidataLive';

/** Extra articles kept per pool on the device (keeps storage well under browser limits). */
export const LIVE_CAP_PER_POOL = 2000;
/** How long a pool waits before it is topped up again. */
export const LIVE_REFRESH_MS = 6 * 60 * 60 * 1000;
/** After a failed fetch, try again sooner than a full refresh. */
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;

/** Adds new items (not in the bundle, not already kept), newest first, capped. */
export function mergeExtras(existing: PoolItem[], incoming: PoolItem[], bundledTitles: ReadonlySet<string>, cap = LIVE_CAP_PER_POOL): PoolItem[] {
  const seen = new Set(existing.map((i) => i[0]));
  const fresh: PoolItem[] = [];
  for (const item of incoming) {
    const title = item[0];
    if (bundledTitles.has(title) || seen.has(title)) continue;
    seen.add(title);
    fresh.push(item);
  }
  return [...fresh, ...existing].slice(0, cap);
}

interface LiveState {
  extras: Record<string, PoolItem[]>;
  fetchedAt: Record<string, number>;
  /** Bumped on every change so memoized pools recompute. */
  version: number;
  add(poolId: string, incoming: PoolItem[], bundledTitles: ReadonlySet<string>): number;
  markFetched(poolId: string, at: number): void;
  clear(): void;
}

export const useLivePools = create<LiveState>()(
  persist(
    (set, get) => ({
      extras: {},
      fetchedAt: {},
      version: 0,
      add(poolId, incoming, bundledTitles) {
        const before = get().extras[poolId] ?? [];
        const after = mergeExtras(before, incoming, bundledTitles);
        const added = Math.max(0, after.length - before.length);
        set((s) => ({ extras: { ...s.extras, [poolId]: after }, version: s.version + 1 }));
        return added;
      },
      markFetched(poolId, at) {
        set((s) => ({ fetchedAt: { ...s.fetchedAt, [poolId]: at } }));
      },
      clear() {
        set((s) => ({ extras: {}, fetchedAt: {}, version: s.version + 1 }));
      },
    }),
    {
      name: 'wikispin-live',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ extras: s.extras, fetchedAt: s.fetchedAt }),
    },
  ),
);

/** Live extras for the given pools as entries. */
export function liveEntries(extras: Record<string, PoolItem[]>, poolIds: string[]): PoolEntry[] {
  const out: PoolEntry[] = [];
  for (const id of poolIds) for (const item of extras[id] ?? []) out.push(toEntry(item));
  return out;
}

const bundledTitleCache = new Map<string, Set<string>>();
let running = false;

/**
 * Tops up at most `max` stale pools, one request at a time. Failures are silent:
 * the bundled library always works, this only makes it bigger.
 */
export async function topUpPools(poolIds: string[], repo: PoolRepository, max = 2): Promise<number> {
  if (running) return 0;
  running = true;
  let total = 0;
  try {
    const state = useLivePools.getState();
    const now = Date.now();
    const stale = poolIds
      .filter((id) => isLivePool(id) && now - (state.fetchedAt[id] ?? 0) > LIVE_REFRESH_MS)
      .sort(() => Math.random() - 0.5)
      .slice(0, max);
    for (const id of stale) {
      try {
        const items = await fetchLiveItems(id);
        let bundled = bundledTitleCache.get(id);
        if (!bundled) {
          bundled = new Set(repo.entries([id]).map((e) => e.title));
          bundledTitleCache.set(id, bundled);
        }
        total += useLivePools.getState().add(id, items, bundled);
        useLivePools.getState().markFetched(id, Date.now());
      } catch {
        useLivePools.getState().markFetched(id, Date.now() - LIVE_REFRESH_MS + RETRY_AFTER_FAILURE_MS);
      }
    }
  } finally {
    running = false;
  }
  return total;
}
