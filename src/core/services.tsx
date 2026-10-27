import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { BundledPoolRepository, type PoolRepository } from './pools/repository';
import { soundPlayer, type SoundPlayer } from './sound';
import { WikipediaArticleService, type ArticleService } from './wiki/service';
import { WikipediaTopicSource, type TopicSource } from './wiki/topics';

export interface Services {
  articles: ArticleService;
  pools: PoolRepository;
  sound: SoundPlayer;
  topics: TopicSource;
}

const ServicesContext = createContext<Services | null>(null);

/** Dependency injection point: pass mocks here in tests or previews. */
export function ServicesProvider({ children, value }: { children: ReactNode; value?: Partial<Services> }) {
  const services = useMemo<Services>(
    () => ({
      articles: value?.articles ?? new WikipediaArticleService(),
      pools: value?.pools ?? new BundledPoolRepository(),
      sound: value?.sound ?? soundPlayer,
      topics: value?.topics ?? new WikipediaTopicSource(),
    }),
    [value?.articles, value?.pools, value?.sound, value?.topics],
  );
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices must be used inside <ServicesProvider>');
  return ctx;
}
