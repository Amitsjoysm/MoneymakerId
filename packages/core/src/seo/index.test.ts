import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as seo from './index.ts';

describe('@mm/core/seo public entry', () => {
  it('exports the functions the apps and the card promise', () => {
    const functions = [
      'pageMeta',
      'canonicalUrl',
      'normaliseUrl',
      'siteOrigin',
      'robotsMeta',
      'organizationJsonLd',
      'webSiteJsonLd',
      'webPageJsonLd',
      'breadcrumbListJsonLd',
      'itemListJsonLd',
      'faqPageJsonLd',
      'restaurantJsonLd',
      'localBusinessJsonLd',
      'reviewJsonLd',
      'jsonLdGraph',
      'serializeJsonLd',
      'sitemapXml',
      'sitemapIndexXml',
      'llmsTxt',
    ] as const;
    for (const name of functions) expect(typeof seo[name], name).toBe('function');
  });

  it('exports the constants', () => {
    expect(seo.BRAND_NAME).toBe('MarketMind AI');
    expect(seo.TITLE_MAX_LENGTH).toBe(60);
    expect(seo.DESCRIPTION_MAX_LENGTH).toBe(160);
    expect(seo.SITEMAP_MAX_URLS).toBe(50_000);
    expect(seo.ROBOTS_INDEX).toBe('index,follow');
    expect(seo.ROBOTS_NOINDEX).toBe('noindex,follow');
  });

  it('does not export the internal helpers', () => {
    for (const name of ['jsonLdNode', 'jsonLdPart', 'jsonLdText', 'jsonLdHttpsUrl']) {
      expect(seo, name).not.toHaveProperty(name);
    }
  });
});

describe('purity: @mm/core runs on Node and Cloudflare Workers', () => {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const sources = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  it('has source files to check', () => {
    expect(sources.length).toBeGreaterThanOrEqual(7);
  });

  it.each(sources)('%s reads no environment, clock or randomness and imports no node: module', (file) => {
    const code = readFileSync(`${dir}${file}`, 'utf8');
    expect(code).not.toMatch(/from\s+['"]node:/);
    expect(code).not.toMatch(/\bprocess\./);
    expect(code).not.toMatch(/import\.meta\.env/);
    expect(code).not.toMatch(/\bDate\.now\(|new Date\(\s*\)|Math\.random/);
    expect(code).not.toMatch(/\bfetch\(/);
  });
});
