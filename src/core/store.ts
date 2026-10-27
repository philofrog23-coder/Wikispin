import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CategoryId } from './categories';
import type { TopicKind } from './wiki/topics';
import { DEFAULT_WIKI_LANG } from './config';
import { DEFAULT_FILTERS, pushRecent, type Obscurity } from './filters';
import { EMPTY_STREAK, recordDiscovery, type StreakState } from './streak';
import type { ArticleSummary } from './wiki/types';

export interface StoredArticle {
  title: string;
  description: string | null;
  extract: string;
  thumbnail: string | null;
  url: string;
  categoryId: CategoryId;
  subcategoryLabel: string | null;
}

export interface SavedArticle extends StoredArticle {
  savedAt: number;
}

export interface HistoryItem extends StoredArticle {
  at: number;
}

export const HISTORY_LIMIT = 200;

/**
 * Reel animation. "system" follows the OS Reduce Motion setting. On desktop the default is
 * "always": Windows turns that setting on whenever "Animation effects" is off, which many
 * people have disabled without meaning to, and the reel then never spins.
 */
export type ReelMotion = 'system' | 'always' | 'reduced';

export function toStored(s: ArticleSummary, categoryId: CategoryId, subcategoryLabel: string | null): StoredArticle {
  return {
    title: s.title,
    description: s.description,
    extract: s.extract,
    thumbnail: s.thumbnail?.url ?? null,
    url: s.url,
    categoryId,
    subcategoryLabel,
  };
}

interface AppState {
  // Settings
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  wikiLang: string;
  reelMotion: ReelMotion;
  // Filters
  categoryId: CategoryId;
  subcategoryByCategory: Partial<Record<CategoryId, string>>;
  country: number | null;
  era: string | null;
  obscurity: Obscurity;
  topicKind: TopicKind;
  topicQuery: string;
  recentTopics: { kind: TopicKind; query: string }[];
  // Data
  favorites: SavedArticle[];
  history: HistoryItem[];
  recent: Record<string, string[]>;
  streak: StreakState;

  setSoundEnabled(v: boolean): void;
  setHapticsEnabled(v: boolean): void;
  setReelMotion(v: ReelMotion): void;
  setCategory(id: CategoryId): void;
  setSubcategory(categoryId: CategoryId, subId: string): void;
  setCountry(id: number | null): void;
  setEra(id: string | null): void;
  setObscurity(level: Obscurity): void;
  resetFilters(): void;
  setTopic(kind: TopicKind, query: string): void;
  rememberTopic(kind: TopicKind, query: string): void;
  toggleFavorite(article: StoredArticle): void;
  removeFavorite(title: string): void;
  recordSpin(poolKey: string, article: StoredArticle): void;
  removeHistoryItem(at: number): void;
  clearHistory(): void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      hapticsEnabled: true,
      wikiLang: DEFAULT_WIKI_LANG,
      reelMotion: Platform.OS === 'web' ? 'always' : 'system',
      categoryId: 'people',
      subcategoryByCategory: {},
      ...DEFAULT_FILTERS,
      topicKind: 'search',
      topicQuery: '',
      recentTopics: [],
      favorites: [],
      history: [],
      recent: {},
      streak: EMPTY_STREAK,

      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setReelMotion: (reelMotion) => set({ reelMotion }),
      setCategory: (categoryId) => set({ categoryId }),
      setSubcategory: (categoryId, subId) =>
        set((s) => ({ subcategoryByCategory: { ...s.subcategoryByCategory, [categoryId]: subId } })),
      setCountry: (country) => set({ country }),
      setEra: (era) => set({ era }),
      setObscurity: (obscurity) => set({ obscurity }),
      resetFilters: () => set({ ...DEFAULT_FILTERS }),
      setTopic: (topicKind, topicQuery) => set({ topicKind, topicQuery }),
      rememberTopic: (kind, query) =>
        set((s) => ({
          recentTopics: [
            { kind, query },
            ...s.recentTopics.filter((t) => !(t.kind === kind && t.query.toLowerCase() === query.toLowerCase())),
          ].slice(0, 8),
        })),

      toggleFavorite: (article) =>
        set((s) =>
          s.favorites.some((f) => f.title === article.title)
            ? { favorites: s.favorites.filter((f) => f.title !== article.title) }
            : { favorites: [{ ...article, savedAt: Date.now() }, ...s.favorites] },
        ),
      removeFavorite: (title) => set((s) => ({ favorites: s.favorites.filter((f) => f.title !== title) })),

      recordSpin: (poolKey, article) =>
        set((s) => ({
          history: [{ ...article, at: Date.now() }, ...s.history].slice(0, HISTORY_LIMIT),
          recent: { ...s.recent, [poolKey]: pushRecent(s.recent[poolKey] ?? [], article.title) },
          streak: recordDiscovery(s.streak, new Date()),
        })),
      removeHistoryItem: (at) => set((s) => ({ history: s.history.filter((h) => h.at !== at) })),
      clearHistory: () => set({ history: [], recent: {} }),
    }),
    {
      name: 'wikispin-store',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export const useIsFavorite = (title: string | undefined) =>
  useAppStore((s) => (title ? s.favorites.some((f) => f.title === title) : false));
