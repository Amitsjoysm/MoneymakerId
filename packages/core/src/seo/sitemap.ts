// Sitemap XML (CONTRACTS §6, plan §5 and §12). A sitemap lists only the pages the build manifest marks indexable,
// with `lastmod = hash_changed_at` (when the page's data last changed). Pure: the manifest entries and the host's
// site URL come in as arguments.
import type { ManifestEntry } from '../schema/index.ts';
import { canonicalUrl } from './url.ts';

/** The sitemap protocol allows 50,000 URLs per file. Splitting is not built: the build fails before a host gets there. */
export const SITEMAP_MAX_URLS = 50_000;

const NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>\n';

/** What a sitemap needs from a manifest entry. A full `ManifestEntry` fits. */
export type SitemapEntry = Pick<ManifestEntry, 'url' | 'indexable' | 'hash_changed_at'>;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function lastmodOf(value: string): string {
  if (Number.isNaN(Date.parse(value)))
    throw new RangeError(`sitemap: lastmod must be a date or timestamp, got "${value}"`);
  return escapeXml(value);
}

function element(tag: 'url' | 'sitemap', loc: string, lastmod: string | undefined): string {
  const lines = [`  <${tag}>`, `    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod !== undefined) lines.push(`    <lastmod>${lastmodOf(lastmod)}</lastmod>`);
  lines.push(`  </${tag}>`);
  return lines.join('\n');
}

function document(root: 'urlset' | 'sitemapindex', elements: readonly string[]): string {
  const body = elements.length > 0 ? `${elements.join('\n')}\n` : '';
  return `${DECLARATION}<${root} xmlns="${NAMESPACE}">\n${body}</${root}>\n`;
}

/**
 * The sitemap of one host. Pass that host's manifest entries and its `SITE_URL_*` value. Entries that are not
 * indexable (noindex, redirected, skipped) are left out; the order of the manifest is kept. Throws `RangeError`
 * for a duplicate URL (two hosts' entries mixed), a `lastmod` that is not a date, or more than
 * `SITEMAP_MAX_URLS` indexable pages.
 */
export function sitemapXml(entries: readonly SitemapEntry[], siteUrl: string): string {
  const indexable = entries.filter((entry) => entry.indexable);
  if (indexable.length > SITEMAP_MAX_URLS) {
    throw new RangeError(
      `sitemap: ${indexable.length} indexable URLs exceed the limit of ${SITEMAP_MAX_URLS}`,
    );
  }
  const seen = new Set<string>();
  const elements = indexable.map((entry) => {
    const loc = canonicalUrl(siteUrl, entry.url);
    if (seen.has(loc)) throw new RangeError(`sitemap: duplicate URL ${loc}`);
    seen.add(loc);
    return element('url', loc, entry.hash_changed_at);
  });
  return document('urlset', elements);
}

/** The sitemap index of a host: one entry per sitemap file, by path (`/sitemap-place.xml`), with an optional lastmod. */
export function sitemapIndexXml(
  siteUrl: string,
  sitemaps: readonly { path: string; lastmod?: string }[],
): string {
  if (sitemaps.length > SITEMAP_MAX_URLS) {
    throw new RangeError(
      `sitemap index: ${sitemaps.length} sitemaps exceed the limit of ${SITEMAP_MAX_URLS}`,
    );
  }
  const seen = new Set<string>();
  const elements = sitemaps.map((sitemap) => {
    const loc = canonicalUrl(siteUrl, sitemap.path);
    if (seen.has(loc)) throw new RangeError(`sitemap index: duplicate sitemap ${loc}`);
    seen.add(loc);
    return element('sitemap', loc, sitemap.lastmod);
  });
  return document('sitemapindex', elements);
}
