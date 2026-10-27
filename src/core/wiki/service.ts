import { DEFAULT_WIKI_LANG } from '@/core/config';
import { wikimediaHeaders } from '@/core/net';
import { decodeSummary } from './decode';
import { WikiError, type ArticleSummary } from './types';

export interface ArticleService {
  summary(title: string, signal?: AbortSignal): Promise<ArticleSummary>;
  random(signal?: AbortSignal): Promise<ArticleSummary>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 10_000;
const CACHE_SIZE = 100;

/** Wikipedia REST API client with a small in-memory LRU cache. */
export class WikipediaArticleService implements ArticleService {
  private cache = new Map<string, ArticleSummary>();

  constructor(
    private lang: string = DEFAULT_WIKI_LANG,
    private fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  private get base() {
    return `https://${this.lang}.wikipedia.org/api/rest_v1`;
  }

  async summary(title: string, signal?: AbortSignal): Promise<ArticleSummary> {
    const hit = this.cache.get(title);
    if (hit) {
      // refresh LRU position
      this.cache.delete(title);
      this.cache.set(title, hit);
      return hit;
    }
    const path = encodeURIComponent(title.replace(/ /g, '_'));
    const result = await this.get(`${this.base}/page/summary/${path}`, signal);
    this.remember(title, result);
    return result;
  }

  async random(signal?: AbortSignal): Promise<ArticleSummary> {
    const result = await this.get(`${this.base}/page/random/summary`, signal);
    this.remember(result.title, result);
    return result;
  }

  private remember(key: string, value: ArticleSummary) {
    this.cache.set(key, value);
    if (this.cache.size > CACHE_SIZE) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
  }

  private async get(url: string, outer?: AbortSignal): Promise<ArticleSummary> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const onOuterAbort = () => controller.abort();
    outer?.addEventListener('abort', onOuterAbort);

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        signal: controller.signal,
        headers: wikimediaHeaders({ Accept: 'application/json; charset=utf-8' }),
      });
    } catch (e) {
      if (outer?.aborted) throw e; // caller cancelled: let it propagate as an abort
      throw new WikiError('offline', e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onOuterAbort);
    }

    if (res.status === 404) throw new WikiError('notFound');
    if (res.status === 429) throw new WikiError('rateLimited');
    if (!res.ok) throw new WikiError('server', `HTTP ${res.status}`);

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new WikiError('server', 'Invalid JSON');
    }
    return decodeSummary(json, this.lang);
  }
}
