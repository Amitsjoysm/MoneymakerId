// Canonical URLs and the robots meta value (CONTRACTS §6, §10). Pure: the site URL (`SITE_URL_*`) is an argument, never
// read from the environment here, so the same code runs in Node (builds, tests) and on Workers.
import type { ManifestEntry } from '../schema/index.ts';

export const ROBOTS_INDEX = 'index,follow';
export const ROBOTS_NOINDEX = 'noindex,follow';

/** The `<meta name="robots">` content of a page that is rendered. */
export type RobotsMeta = typeof ROBOTS_INDEX | typeof ROBOTS_NOINDEX;

function parseHttps(url: string, what: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new RangeError(`${what} must be an absolute https:// URL, got "${url}"`);
  }
  if (parsed.protocol !== 'https:') {
    throw new RangeError(`${what} must be an https:// URL, got "${url}"`);
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new RangeError(`${what} must not carry credentials`);
  }
  return parsed;
}

/**
 * The origin of a `SITE_URL_*` value, without a trailing slash (`https://food.marketmindai.com`). Throws
 * `RangeError` when the value is not an https origin: a canonical must never be built from a wrong base.
 */
export function siteOrigin(siteUrl: string): string {
  const parsed = parseHttps(siteUrl, 'siteUrl');
  if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
    throw new RangeError(`siteUrl must be an origin without a path, query or fragment, got "${siteUrl}"`);
  }
  return parsed.origin;
}

function hasForbiddenCharacter(path: string): boolean {
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f || path[i] === '\\') return true;
  }
  return false;
}

/** Leading slash, no query or fragment, and a trailing slash unless the last segment is a file name (`/sitemap.xml`). */
function canonicalPath(path: string): string {
  const cut = path.search(/[?#]/);
  const bare = cut === -1 ? path : path.slice(0, cut);
  if (!bare.startsWith('/') || bare.includes('//') || hasForbiddenCharacter(bare)) {
    throw new RangeError(
      `path must start with a single "/" and have no empty segment, space or backslash, got "${path}"`,
    );
  }
  const last = bare.slice(bare.lastIndexOf('/') + 1);
  return last === '' || last.includes('.') ? bare : `${bare}/`;
}

/**
 * The canonical URL of a page: `siteUrl` origin plus the page path, absolute, https, with a trailing slash. A query
 * string or fragment on `path` is dropped (parameters never make a canonical). Slugs are lowercase ASCII with no
 * dot, so only a file name such as `/sitemap.xml` is left without the slash.
 */
export function canonicalUrl(siteUrl: string, path: string): string {
  return siteOrigin(siteUrl) + canonicalPath(path);
}

/** An absolute https URL (a breadcrumb or a list item, possibly on another host) in the same canonical form. */
export function normaliseUrl(url: string): string {
  const parsed = parseHttps(url, 'url');
  return parsed.origin + canonicalPath(parsed.pathname);
}

/**
 * `index,follow` for an indexable manifest entry; `noindex,follow` for every other page that is rendered, which
 * is the `build_noindex` period of a page that fell below its threshold (plan §5). A page can never be indexed
 * by accident: anything not marked indexable is noindex.
 */
export function robotsMeta(entry: Pick<ManifestEntry, 'indexable'>): RobotsMeta {
  return entry.indexable ? ROBOTS_INDEX : ROBOTS_NOINDEX;
}
