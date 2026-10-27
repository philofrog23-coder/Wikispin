import { Platform } from 'react-native';
import { USER_AGENT } from './config';
import { WikiError } from './wiki/types';

/**
 * Headers for Wikimedia APIs. Native apps send a real User-Agent; browsers forbid that
 * header, so the web build relies on Api-User-Agent (Wikimedia's documented fallback).
 */
export function wikimediaHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return Platform.OS === 'web'
    ? { 'Api-User-Agent': USER_AGENT, ...extra }
    : { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT, ...extra };
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** GET JSON with a timeout, mapping failures to WikiError kinds. Caller aborts propagate as-is. */
export async function fetchJson(
  url: string,
  opts: { signal?: AbortSignal; timeoutMs?: number; headers?: Record<string, string>; fetchImpl?: FetchLike } = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);
  const doFetch = opts.fetchImpl ?? ((input: string, init?: RequestInit) => fetch(input, init));

  let res: Response;
  try {
    res = await doFetch(url, { signal: controller.signal, headers: opts.headers ?? wikimediaHeaders({ Accept: 'application/json' }) });
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    throw new WikiError('offline', e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }
  if (res.status === 404) throw new WikiError('notFound');
  if (res.status === 429) throw new WikiError('rateLimited');
  if (!res.ok) throw new WikiError('server', `HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new WikiError('server', 'Invalid JSON');
  }
}
