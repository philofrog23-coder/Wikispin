import { WikiError, type ArticleSummary } from './types';

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Decodes a Wikipedia REST `page/summary` response.
 * Throws WikiError('disambiguation' | 'noExtract' | 'server') for pages the app can't show.
 */
export function decodeSummary(json: unknown, lang = 'en'): ArticleSummary {
  if (!isObject(json)) throw new WikiError('server', 'Summary is not an object');

  const type = str(json.type);
  if (type === 'disambiguation') throw new WikiError('disambiguation');

  const title = str(json.title);
  if (!title) throw new WikiError('server', 'Summary has no title');

  const extract = str(json.extract);
  if (!extract || type === 'no-extract') throw new WikiError('noExtract');

  let thumbnail: ArticleSummary['thumbnail'] = null;
  if (isObject(json.thumbnail)) {
    const url = str(json.thumbnail.source);
    const width = num(json.thumbnail.width);
    const height = num(json.thumbnail.height);
    if (url && width && height) thumbnail = { url, width, height };
  }

  const urls = isObject(json.content_urls) ? json.content_urls : {};
  const mobile = isObject(urls.mobile) ? str(urls.mobile.page) : null;
  const desktop = isObject(urls.desktop) ? str(urls.desktop.page) : null;
  const url = mobile ?? desktop ?? articleUrl(title, lang);

  return { title, description: str(json.description), extract: extract.trim(), thumbnail, url };
}

export function articleUrl(title: string, lang = 'en'): string {
  return `https://${lang}.m.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}
