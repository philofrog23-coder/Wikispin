import { BundledPoolRepository } from '@/core/pools/repository';
import type { PoolFile } from '@/core/pools/types';

const file = (id: string, items: PoolFile['items']): (() => PoolFile) => () => ({ id, generatedAt: '', count: items.length, items });

describe('BundledPoolRepository', () => {
  const repo = new BundledPoolRepository({
    'people.writers': file('people.writers', [
      ['Leo Tolstoy', 150, [159], 1828],
      ['Jane Austen', 140, [174193], 1775],
    ]),
    'people.military': file('people.military', [['Leo Tolstoy', 150, [34266], 1828]]),
  });

  it('merges pools, de-duplicating titles and combining countries', () => {
    const entries = repo.entries(['people.writers', 'people.military']);
    expect(entries.map((e) => e.title).sort()).toEqual(['Jane Austen', 'Leo Tolstoy']);
    expect(entries.find((e) => e.title === 'Leo Tolstoy')?.countries.sort()).toEqual([159, 34266]);
  });

  it('skips missing pools and reports availability', () => {
    expect(repo.entries(['plants.trees'])).toEqual([]);
    expect(repo.has(['plants.trees'])).toBe(false);
    expect(repo.has(['plants.trees', 'people.writers'])).toBe(true);
  });
});
