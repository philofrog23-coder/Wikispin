export interface ArticleSummary {
  title: string;
  description: string | null;
  extract: string;
  thumbnail: { url: string; width: number; height: number } | null;
  /** Mobile article URL, opened in the in-app browser. */
  url: string;
}

export type WikiErrorKind =
  | 'offline' // no connection / timeout
  | 'rateLimited' // HTTP 429
  | 'server' // 5xx or malformed response
  | 'notFound' // 404 (deleted or renamed page)
  | 'disambiguation' // page is a disambiguation list
  | 'noExtract' // nothing readable to show
  | 'exhausted' // every retry inside one spin failed
  | 'emptyPool'; // filters leave nothing to pick

/** Errors that mean "this particular article is unusable, try another one". */
export const SKIPPABLE: ReadonlySet<WikiErrorKind> = new Set(['notFound', 'disambiguation', 'noExtract']);

export class WikiError extends Error {
  constructor(
    public readonly kind: WikiErrorKind,
    message?: string,
  ) {
    super(message ?? kind);
    this.name = 'WikiError';
  }
}

export function userMessage(kind: WikiErrorKind): string {
  switch (kind) {
    case 'offline':
      return 'Connect to the internet to load the article.';
    case 'rateLimited':
      return 'Wikipedia asked us to slow down. Try again in a moment.';
    case 'server':
      return 'Wikipedia is having trouble right now. Try again in a moment.';
    case 'emptyPool':
      return 'No articles match these filters.';
    case 'exhausted':
    case 'notFound':
    case 'disambiguation':
    case 'noExtract':
      return "Couldn't find a readable article this time. Spin again!";
  }
}
