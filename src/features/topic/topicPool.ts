import { create } from 'zustand';
import type { PoolEntry } from '@/core/pools/types';
import type { TopicKind, TopicSource } from '@/core/wiki/topics';
import { WikiError, type WikiErrorKind } from '@/core/wiki/types';

export type TopicStatus = 'idle' | 'loading' | 'ready' | 'error';

interface TopicPoolState {
  status: TopicStatus;
  /** `${kind}:${query}` of the loaded (or loading) topic. */
  key: string | null;
  entries: PoolEntry[];
  total: number;
  suggestion: string | null;
  error: WikiErrorKind | null;
  load(source: TopicSource, kind: TopicKind, query: string): Promise<void>;
}

export const topicKey = (kind: TopicKind, query: string) => `${kind}:${query.trim().toLowerCase()}`;

let inFlight: AbortController | null = null;

/** The live pool for "Any topic". Session-only: results are fetched fresh each time. */
export const useTopicPool = create<TopicPoolState>()((set) => ({
  status: 'idle',
  key: null,
  entries: [],
  total: 0,
  suggestion: null,
  error: null,
  async load(source, kind, query) {
    const q = query.trim();
    if (!q) return;
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    const key = topicKey(kind, q);
    set({ status: 'loading', key, error: null, suggestion: null });
    try {
      const result = kind === 'search' ? await source.search(q, controller.signal) : await source.category(q, controller.signal);
      if (controller.signal.aborted) return;
      set({
        status: result.entries.length ? 'ready' : 'error',
        entries: result.entries,
        total: result.total,
        suggestion: result.suggestion,
        error: result.entries.length ? null : 'emptyPool',
      });
    } catch (e) {
      if (controller.signal.aborted) return;
      set({ status: 'error', entries: [], total: 0, error: e instanceof WikiError ? e.kind : 'server' });
    }
  },
}));
