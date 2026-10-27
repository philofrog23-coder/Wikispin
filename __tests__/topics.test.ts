import { mergeExtras } from '@/core/live/liveStore';
import { liveQueryFor, parseLiveRows } from '@/core/live/wikidataLive';
import type { PoolItem } from '@/core/pools/types';
import {
  isSpinnableTitle,
  normalizeCategory,
  parseCategoryMembers,
  parseCategorySuggestions,
  parseSearch,
  WikipediaTopicSource,
} from '@/core/wiki/topics';

describe('topic search', () => {
  it('parses search hits, drops lists and duplicates, keeps the suggestion', () => {
    const out = parseSearch({
      query: {
        searchinfo: { totalhits: 29933, suggestion: 'volcano' },
        search: [{ title: 'Volcano' }, { title: 'List of volcanoes in Iceland' }, { title: 'Shield volcano' }, { title: 'Volcano' }],
      },
    });
    expect(out.entries.map((e) => e.title)).toEqual(['Volcano', 'Shield volcano']);
    expect(out.suggestion).toBe('volcano');
    expect(out.total).toBe(29933);
  });

  it('rejects malformed responses', () => {
    expect(() => parseSearch({ error: 'x' })).toThrow(expect.objectContaining({ kind: 'server' }));
  });

  it('filters titles that make poor spins', () => {
    expect(isSpinnableTitle('Mercury (disambiguation)')).toBe(false);
    expect(isSpinnableTitle('Glossary of botany')).toBe(false);
    expect(isSpinnableTitle('Claude Monet')).toBe(true);
  });
});

describe('categories', () => {
  it('normalizes category names', () => {
    expect(normalizeCategory('impressionist painters')).toBe('Category:Impressionist painters');
    expect(normalizeCategory('Category: Extinct birds')).toBe('Category:Extinct birds');
  });

  it('splits members into pages and subcategories', () => {
    const out = parseCategoryMembers({
      continue: { cmcontinue: 'page|abc' },
      query: {
        categorymembers: [
          { ns: 0, title: 'Claude Monet' },
          { ns: 14, title: 'Category:Paintings by Claude Monet' },
          { ns: 6, title: 'File:Water Lilies.jpg' },
        ],
      },
    });
    expect(out).toEqual({ pages: ['Claude Monet'], subcats: ['Category:Paintings by Claude Monet'], next: 'page|abc' });
  });

  it('parses category suggestions', () => {
    expect(parseCategorySuggestions(['Impressionist', ['Category:Impressionist painters', 'Category:Impressionist artists']])).toEqual([
      'Impressionist painters',
      'Impressionist artists',
    ]);
    expect(parseCategorySuggestions({})).toEqual([]);
  });

  it('walks subcategories breadth-first and follows continuation', async () => {
    const responses: Record<string, unknown> = {
      'Category:Painters|': {
        continue: { cmcontinue: 'next1' },
        query: { categorymembers: [{ ns: 0, title: 'A' }, { ns: 14, title: 'Category:Sub' }] },
      },
      'Category:Painters|next1': { query: { categorymembers: [{ ns: 0, title: 'B' }] } },
      'Category:Sub|': { query: { categorymembers: [{ ns: 0, title: 'C' }, { ns: 0, title: 'A' }] } },
    };
    const fetchImpl = async (url: string) => {
      const u = new URL(url);
      const key = `${u.searchParams.get('cmtitle')}|${u.searchParams.get('cmcontinue') ?? ''}`;
      return new Response(JSON.stringify(responses[key] ?? { query: { categorymembers: [] } }), { status: 200 });
    };
    const source = new WikipediaTopicSource('en', fetchImpl);
    const out = await source.category('painters');
    expect(out.entries.map((e) => e.title).sort()).toEqual(['A', 'B', 'C']);
  });

  it('reports an empty or missing category as not found', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ query: { categorymembers: [] } }), { status: 200 });
    await expect(new WikipediaTopicSource('en', fetchImpl).category('Nope nope')).rejects.toMatchObject({ kind: 'notFound' });
  });
});

describe('live Wikidata top-up', () => {
  it('builds a sampled query only for supported pools', () => {
    expect(liveQueryFor('people.writers', () => 0)).toContain('bd:sample');
    expect(liveQueryFor('plants.trees', () => 0)).toContain('"Pinaceae"');
    expect(liveQueryFor('wars.battles', () => 0.5)).toMatch(/OFFSET \d+/);
    expect(liveQueryFor('sports.competitions')).toBeNull();
  });

  it('collapses rows to one item per article with earliest year and all countries', () => {
    const row = (q: string, title: string, c?: string, date?: string) => ({
      item: { value: `http://www.wikidata.org/entity/${q}` },
      title: { value: title },
      s: { value: '12' },
      ...(c ? { c: { value: `http://www.wikidata.org/entity/${c}` } } : {}),
      ...(date ? { date: { value: date } } : {}),
    });
    const items = parseLiveRows({
      results: {
        bindings: [row('Q1', 'Ada', 'Q145', '1815-12-10T00:00:00Z'), row('Q1', 'Ada', 'Q30', '1816-01-01T00:00:00Z'), row('Q2', 'List of things'), row('Q3', 'Old', undefined, '-0500-01-01T00:00:00Z')],
      },
    });
    expect(items).toEqual([
      ['Ada', 12, [145, 30], 1815],
      ['Old', 12, [], -500],
    ]);
  });

  it('merges only new titles, newest first, within the cap', () => {
    const existing: PoolItem[] = [['Kept', 1, [], null]];
    const incoming: PoolItem[] = [
      ['Bundled', 1, [], null],
      ['New A', 1, [], null],
      ['Kept', 1, [], null],
      ['New B', 1, [], null],
    ];
    expect(mergeExtras(existing, incoming, new Set(['Bundled'])).map((i) => i[0])).toEqual(['New A', 'New B', 'Kept']);
    expect(mergeExtras(existing, incoming, new Set(), 2).map((i) => i[0])).toEqual(['Bundled', 'New A']);
  });
});
