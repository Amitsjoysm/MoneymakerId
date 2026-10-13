import { describe, expect, it } from 'vitest';
import type { ManifestEntry } from '../schema/index.ts';
import { SITEMAP_MAX_URLS, sitemapIndexXml, sitemapXml } from './sitemap.ts';

const FOOD = 'https://food.marketmindai.com';
const HEADER =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

function entry(url: string, over: Partial<ManifestEntry> = {}): ManifestEntry {
  return {
    url,
    host: 'food',
    locale: 'en',
    page_type: 'dish_locality',
    indexable: true,
    content_hash: 'a'.repeat(64),
    hash_changed_at: '2026-10-12T06:00:00.000Z',
    gate: {
      gate_key: 'food:dish_locality',
      scores: { evidence: 6, entities: 3, relevance: 1, unique: 1, seo: 0.8 },
      passed: true,
      reasons: [],
    },
    noindex_since: null,
    redirect_to: null,
    ...over,
  };
}

describe('sitemapXml', () => {
  it('lists an indexable entry with its canonical URL and lastmod = hash_changed_at', () => {
    expect(sitemapXml([entry('/pune/hinjewadi/biryani/')], FOOD)).toBe(
      `${HEADER}  <url>\n    <loc>https://food.marketmindai.com/pune/hinjewadi/biryani/</loc>\n    <lastmod>2026-10-12T06:00:00.000Z</lastmod>\n  </url>\n</urlset>\n`,
    );
  });

  it('lists only indexable entries: noindex, redirected and skipped pages are left out', () => {
    const xml = sitemapXml(
      [
        entry('/pune/', { hash_changed_at: '2026-10-01T00:00:00.000Z' }),
        entry('/pune/wakad/biryani/', { indexable: false, noindex_since: '2026-10-05T00:00:00.000Z' }),
        entry('/pune/old/', { indexable: false, redirect_to: '/pune/' }),
        entry('/pune/never/', { indexable: false }),
        entry('/pune/baner/biryani/', { hash_changed_at: '2026-10-09T10:30:00.000Z' }),
      ],
      FOOD,
    );
    expect(xml.match(/<loc>(.*?)<\/loc>/g)).toEqual([
      '<loc>https://food.marketmindai.com/pune/</loc>',
      '<loc>https://food.marketmindai.com/pune/baner/biryani/</loc>',
    ]);
    expect(xml).toContain('<lastmod>2026-10-01T00:00:00.000Z</lastmod>');
    expect(xml).toContain('<lastmod>2026-10-09T10:30:00.000Z</lastmod>');
    expect(xml).not.toContain('wakad');
    expect(xml).not.toContain('/pune/old/');
    expect(xml).not.toContain('/pune/never/');
  });

  it('keeps the order of the manifest', () => {
    const urls = ['/pune/c/', '/pune/a/', '/pune/b/'];
    const xml = sitemapXml(
      urls.map((u) => entry(u)),
      FOOD,
    );
    expect([...xml.matchAll(/\/pune\/(\w)\//g)].map((m) => m[1])).toEqual(['c', 'a', 'b']);
  });

  it('writes the canonical form even if the manifest path lacks the trailing slash', () => {
    expect(sitemapXml([entry('/pune/wakad')], `${FOOD}/`)).toContain(
      '<loc>https://food.marketmindai.com/pune/wakad/</loc>',
    );
  });

  it('escapes XML special characters', () => {
    const xml = sitemapXml([entry('/pune/a&b/')], FOOD);
    expect(xml).toContain('<loc>https://food.marketmindai.com/pune/a&amp;b/</loc>');
    expect(xml).not.toMatch(/&(?!amp;)/);
  });

  it('is a valid empty urlset when nothing is indexable', () => {
    expect(sitemapXml([], FOOD)).toBe(`${HEADER}</urlset>\n`);
    expect(sitemapXml([entry('/pune/x/', { indexable: false })], FOOD)).toBe(`${HEADER}</urlset>\n`);
  });

  it('refuses a duplicate URL: a sign that two hosts were mixed', () => {
    expect(() => sitemapXml([entry('/pune/'), entry('/pune/', { host: 'main' })], FOOD)).toThrow(RangeError);
  });

  it('refuses an http site URL and a lastmod that is not a date', () => {
    expect(() => sitemapXml([entry('/pune/')], 'http://food.marketmindai.com')).toThrow(RangeError);
    expect(() => sitemapXml([entry('/pune/', { hash_changed_at: 'soon' })], FOOD)).toThrow(RangeError);
  });

  it('guards the 50,000 URL limit of the sitemap protocol', () => {
    expect(SITEMAP_MAX_URLS).toBe(50_000);
    const make = (n: number): ManifestEntry[] => Array.from({ length: n }, (_, i) => entry(`/pune/p${i}/`));
    expect(() => sitemapXml(make(SITEMAP_MAX_URLS), FOOD)).not.toThrow();
    expect(() => sitemapXml(make(SITEMAP_MAX_URLS + 1), FOOD)).toThrow(RangeError);
  });

  it('does not count non-indexable entries toward the limit', () => {
    const many = Array.from({ length: SITEMAP_MAX_URLS + 5 }, (_, i) =>
      entry(`/pune/p${i}/`, { indexable: false }),
    );
    expect(() => sitemapXml(many, FOOD)).not.toThrow();
  });
});

describe('sitemapIndexXml', () => {
  it('lists the per-type sitemaps of a host', () => {
    expect(
      sitemapIndexXml(FOOD, [
        { path: '/sitemap-dish_locality.xml', lastmod: '2026-10-12T06:00:00.000Z' },
        { path: '/sitemap-place.xml' },
      ]),
    ).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '  <sitemap>\n    <loc>https://food.marketmindai.com/sitemap-dish_locality.xml</loc>\n    <lastmod>2026-10-12T06:00:00.000Z</lastmod>\n  </sitemap>\n' +
        '  <sitemap>\n    <loc>https://food.marketmindai.com/sitemap-place.xml</loc>\n  </sitemap>\n' +
        '</sitemapindex>\n',
    );
  });

  it('rejects a lastmod that is not a date and a duplicate sitemap', () => {
    expect(() => sitemapIndexXml(FOOD, [{ path: '/sitemap-a.xml', lastmod: 'x' }])).toThrow(RangeError);
    expect(() => sitemapIndexXml(FOOD, [{ path: '/sitemap-a.xml' }, { path: '/sitemap-a.xml' }])).toThrow(
      RangeError,
    );
  });
});
