import { useMemo } from 'react';
import { getCategory, getSubcategory, type Category, type Subcategory } from '@/core/categories';
import { applyHardFilters, applyObscurity, type FilterValues } from '@/core/filters';
import type { PoolEntry } from '@/core/pools/types';
import { useServices } from '@/core/services';
import { useAppStore } from '@/core/store';
import { liveEntries, useLivePools } from '@/core/live/liveStore';
import { topicKey, useTopicPool } from '@/features/topic/topicPool';

export interface FilteredPool {
  category: Category;
  subcategory: Subcategory | undefined;
  /** Every entry of the subcategory before the user's filters. */
  all: PoolEntry[];
  /** Entries after the user's filters: what a spin can land on. */
  entries: PoolEntry[];
  filters: FilterValues;
  /** Key under which recently shown titles are remembered. */
  poolKey: string;
  /** Changes whenever the topic or any applied filter changes: the reel must be rebuilt. */
  reelKey: string;
  /** False when the pools for this subcategory have not been generated yet. */
  available: boolean;
  /** Label for results: the subcategory, or the typed topic. */
  label: string | null;
  /** Pool ids behind this selection (for the live top-up). */
  poolIds: string[];
  /** Articles added online on top of the bundled library. */
  liveAdded: number;
}

/** Current category + filters → the entries a spin can land on. */
export function useFilteredPool(): FilteredPool {
  const { pools } = useServices();
  const categoryId = useAppStore((s) => s.categoryId);
  const subId = useAppStore((s) => s.subcategoryByCategory[s.categoryId]);
  const country = useAppStore((s) => s.country);
  const era = useAppStore((s) => s.era);
  const obscurity = useAppStore((s) => s.obscurity);
  const topicKind = useAppStore((s) => s.topicKind);
  const topicQuery = useAppStore((s) => s.topicQuery);
  const topicStatus = useTopicPool((s) => s.status);
  const topicLoadedKey = useTopicPool((s) => s.key);
  const topicEntries = useTopicPool((s) => s.entries);
  const liveExtras = useLivePools((s) => s.extras);

  return useMemo(() => {
    const category = getCategory(categoryId);
    if (category.id === 'topic') {
      // Live pool: only the topic currently typed in counts, once it has loaded.
      const key = topicKey(topicKind, topicQuery);
      const entries = topicStatus === 'ready' && topicLoadedKey === key ? topicEntries : [];
      return {
        category,
        subcategory: undefined,
        all: entries,
        entries,
        filters: { country: null, era: null, obscurity },
        poolKey: `topic.${key}`,
        reelKey: `topic|${key}|${entries.length}`,
        available: true,
        label: topicQuery.trim() || null,
        poolIds: [],
        liveAdded: 0,
      };
    }
    const subcategory = getSubcategory(category, subId);
    const supports = new Set(category.filters);
    const filters: FilterValues = {
      // Filters a category doesn't offer are ignored rather than cleared, so they come back when you switch back.
      country: supports.has('country') ? country : null,
      era: supports.has('era') ? era : null,
      obscurity,
      maxYear: subcategory?.maxYear,
    };
    const poolIds = subcategory?.pools ?? [];
    const bundled = poolIds.length ? pools.entries(poolIds) : [];
    const live = liveEntries(liveExtras, poolIds);
    let all = bundled;
    if (live.length) {
      const seen = new Set(bundled.map((e) => e.title));
      all = [...bundled, ...live.filter((e) => !seen.has(e.title) && (seen.add(e.title), true))];
    }
    const hard = applyHardFilters(all, filters);
    const entries = supports.has('obscurity') ? applyObscurity(hard, obscurity) : hard;
    return {
      category,
      subcategory,
      all,
      entries,
      filters,
      poolKey: `${category.id}.${subcategory?.id ?? 'any'}`,
      reelKey: [category.id, subcategory?.id, filters.country, filters.era, supports.has('obscurity') ? obscurity : ''].join('|'),
      available: category.id === 'anything' || pools.has(poolIds),
      label: subcategory?.label ?? null,
      poolIds,
      liveAdded: all.length - bundled.length,
    };
  }, [pools, categoryId, subId, country, era, obscurity, topicKind, topicQuery, topicStatus, topicLoadedKey, topicEntries, liveExtras]);
}
