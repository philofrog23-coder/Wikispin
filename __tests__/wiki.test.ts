import { decodeSummary } from '@/core/wiki/decode';
import { WikipediaArticleService } from '@/core/wiki/service';
import { WikiError } from '@/core/wiki/types';

const standard = {
  type: 'standard',
  title: 'Yanka Kupala',
  description: 'Belarusian poet and writer (1882–1942)',
  extract: 'Ivan Daminikavich Lutsevich, known by the pen name Yanka Kupala, was a Belarusian poet and writer.',
  thumbnail: { source: 'https://upload.wikimedia.org/thumb.jpg', width: 320, height: 427 },
  content_urls: {
    desktop: { page: 'https://en.wikipedia.org/wiki/Yanka_Kupala' },
    mobile: { page: 'https://en.m.wikipedia.org/wiki/Yanka_Kupala' },
  },
};

describe('decodeSummary', () => {
  it('decodes a standard page', () => {
    expect(decodeSummary(standard)).toEqual({
      title: 'Yanka Kupala',
      description: 'Belarusian poet and writer (1882–1942)',
      extract: standard.extract,
      thumbnail: { url: 'https://upload.wikimedia.org/thumb.jpg', width: 320, height: 427 },
      url: 'https://en.m.wikipedia.org/wiki/Yanka_Kupala',
    });
  });

  it('handles a missing thumbnail and description', () => {
    const { thumbnail, description, ...rest } = standard;
    const out = decodeSummary(rest);
    expect(out.thumbnail).toBeNull();
    expect(out.description).toBeNull();
  });

  it('falls back to a built URL when content_urls is missing', () => {
    const { content_urls, ...rest } = standard;
    expect(decodeSummary({ ...rest, title: 'A/B test' }).url).toBe('https://en.m.wikipedia.org/wiki/A%2FB_test');
  });

  it('rejects disambiguation pages', () => {
    expect(() => decodeSummary({ ...standard, type: 'disambiguation' })).toThrow(expect.objectContaining({ kind: 'disambiguation' }));
  });

  it('rejects pages without an extract', () => {
    expect(() => decodeSummary({ ...standard, extract: '   ' })).toThrow(expect.objectContaining({ kind: 'noExtract' }));
    expect(() => decodeSummary({ ...standard, type: 'no-extract' })).toThrow(expect.objectContaining({ kind: 'noExtract' }));
  });

  it('treats malformed payloads as server errors', () => {
    expect(() => decodeSummary(null)).toThrow(expect.objectContaining({ kind: 'server' }));
    expect(() => decodeSummary({ type: 'standard' })).toThrow(expect.objectContaining({ kind: 'server' }));
  });
});

describe('WikipediaArticleService', () => {
  const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

  it('requests the summary endpoint with an encoded title and a User-Agent', async () => {
    const fetchMock = jest.fn((_url: string, _init?: RequestInit) => ok(standard));
    const service = new WikipediaArticleService('en', fetchMock);
    await service.summary('AC/DC song');
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://en.wikipedia.org/api/rest_v1/page/summary/AC%2FDC_song');
    expect((init?.headers as Record<string, string>)['Api-User-Agent']).toMatch(/WikiSpin/);
  });

  it('caches summaries', async () => {
    const fetchMock = jest.fn(() => ok(standard));
    const service = new WikipediaArticleService('en', fetchMock);
    await service.summary('Yanka Kupala');
    await service.summary('Yanka Kupala');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps HTTP and network failures to typed errors', async () => {
    const status = (s: number) => new WikipediaArticleService('en', () => Promise.resolve(new Response('', { status: s })));
    await expect(status(404).summary('X')).rejects.toMatchObject({ kind: 'notFound' });
    await expect(status(429).summary('X')).rejects.toMatchObject({ kind: 'rateLimited' });
    await expect(status(503).summary('X')).rejects.toMatchObject({ kind: 'server' });
    const offline = new WikipediaArticleService('en', () => Promise.reject(new TypeError('Network request failed')));
    await expect(offline.summary('X')).rejects.toBeInstanceOf(WikiError);
    await expect(offline.summary('X')).rejects.toMatchObject({ kind: 'offline' });
  });
});
