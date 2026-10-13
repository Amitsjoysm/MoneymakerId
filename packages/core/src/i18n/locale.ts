// Locale-aware URLs (plan §1, §15; CONTRACTS §1 "Slugs are ASCII in every locale", §3 Locale, §4a reserved `mr`/`hi`).
// English lives at the root of each host; Marathi and Hindi live under `/mr/...` and `/hi/...` on the same host.
// Slugs are never translated, and `mr` / `hi` are reserved slugs, so a first segment of exactly `mr` or `hi` is always
// a locale prefix and never a locality, dish or service. Pure string work: no `URL`, no environment (Node and Workers).
import type { Locale } from '../schema/index.ts';

export const DEFAULT_LOCALE: Locale = 'en';

/** The locales that live under a path prefix: every locale except the default. */
type PrefixedLocale = Exclude<Locale, 'en'>;

export const PREFIXED_LOCALES: readonly PrefixedLocale[] = ['mr', 'hi'];

const PREFIXED: ReadonlySet<string> = new Set(PREFIXED_LOCALES);

interface Parts {
  /** `https://host[:port]` for an absolute url, `''` for a path. */
  origin: string;
  /** Starts with `/`. */
  pathname: string;
  /** Query string and fragment, as written (starts with `?` or `#`, or is empty). */
  suffix: string;
}

const ABSOLUTE = /^(https?:\/\/[^/?#\s\\]+)(.*)$/is;

function reject(url: string): never {
  throw new RangeError(
    `url must be a path starting with a single "/" or an absolute http(s) url, got "${url}"`,
  );
}

function parts(url: string): Parts {
  let origin = '';
  let rest = url;
  const absolute = ABSOLUTE.exec(url);
  if (absolute) {
    origin = absolute[1]!;
    rest = absolute[2]!;
    if (rest === '' || rest.startsWith('?') || rest.startsWith('#')) rest = `/${rest}`;
  }
  const cut = rest.search(/[?#]/);
  const pathname = cut === -1 ? rest : rest.slice(0, cut);
  const suffix = cut === -1 ? '' : rest.slice(cut);
  if (!pathname.startsWith('/') || pathname.startsWith('//') || /[\s\\]/.test(pathname)) reject(url);
  return { origin, pathname, suffix };
}

/** The locale prefix of a pathname (`/mr`, `/hi`) and what is left after it; `null` when there is none. */
function prefixOf(pathname: string): { locale: PrefixedLocale; rest: string } | null {
  const second = pathname.indexOf('/', 1);
  const first = pathname.slice(1, second === -1 ? undefined : second);
  if (!PREFIXED.has(first)) return null;
  return { locale: first as PrefixedLocale, rest: second === -1 ? '/' : pathname.slice(second) };
}

/**
 * Routes that exist once per host and are never prefixed: `/api/*` and files (`/sitemap.xml`, `/robots.txt`,
 * `/photos/x.webp`). Page slugs are lowercase ASCII with no dot (CONTRACTS §1), so a dot in the last segment is a file.
 */
function isUnlocalised(pathname: string): boolean {
  if (pathname === '/api' || pathname.startsWith('/api/')) return true;
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  return last.includes('.');
}

/**
 * The same page in another locale. `en` is the unprefixed default; `mr` and `hi` get a `/{locale}` prefix on the same
 * host. Accepts a path (`/pune/wakad/`) or an absolute http(s) url, and keeps the query string and the fragment.
 * Slugs are never translated.
 *
 * - A url that already carries a locale prefix is re-based, so the result is never double-prefixed and
 *   `localizedUrl(localizedUrl(u, l), l) === localizedUrl(u, l)`.
 * - `/api/*` and files are returned unchanged for every locale: they exist once per host.
 * - Anything that is not a path or an absolute http(s) url throws `RangeError` (a bad link must not ship quietly).
 */
export function localizedUrl(url: string, locale: Locale): string {
  const { origin, pathname, suffix } = parts(url);
  if (isUnlocalised(pathname)) return url;
  const prefix = prefixOf(pathname);
  const base = prefix ? prefix.rest : pathname;
  if (locale === DEFAULT_LOCALE) return prefix ? origin + base + suffix : url;
  return `${origin}/${locale}${base}${suffix}`;
}

/**
 * The locale a url is in, and the url with that locale's prefix removed. An unprefixed url is English and comes back
 * unchanged. The inverse of `localizedUrl`: `splitLocalePrefix(localizedUrl(u, l))` is `{ locale: l, url: u }`.
 */
export function splitLocalePrefix(url: string): { locale: Locale; url: string } {
  const { origin, pathname, suffix } = parts(url);
  const prefix = prefixOf(pathname);
  if (!prefix) return { locale: DEFAULT_LOCALE, url };
  return { locale: prefix.locale, url: origin + prefix.rest + suffix };
}
