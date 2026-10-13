import { describe, expect, it } from 'vitest';
import { ROBOTS_INDEX, ROBOTS_NOINDEX, canonicalUrl, normaliseUrl, robotsMeta, siteOrigin } from './url.ts';

const FOOD = 'https://food.marketmindai.com';

describe('siteOrigin', () => {
  it('returns the origin without a trailing slash', () => {
    expect(siteOrigin(FOOD)).toBe(FOOD);
    expect(siteOrigin(`${FOOD}/`)).toBe(FOOD);
    expect(siteOrigin('https://marketmindai.com')).toBe('https://marketmindai.com');
  });

  it('lowercases the host and drops the default port', () => {
    expect(siteOrigin('https://Food.MarketMindAI.com:443/')).toBe(FOOD);
  });

  it.each([
    ['http://food.marketmindai.com', 'plain http'],
    ['food.marketmindai.com', 'no scheme'],
    ['', 'empty'],
    ['https://food.marketmindai.com/pune/', 'a path'],
    ['https://food.marketmindai.com/?a=1', 'a query'],
    ['https://user:pw@food.marketmindai.com', 'credentials'],
  ])('rejects %s (%s)', (bad) => {
    expect(() => siteOrigin(bad)).toThrow(RangeError);
  });
});

describe('canonicalUrl', () => {
  it('joins the site URL and a manifest path: absolute, https, trailing slash', () => {
    expect(canonicalUrl(FOOD, '/pune/hinjewadi/biryani/')).toBe(
      'https://food.marketmindai.com/pune/hinjewadi/biryani/',
    );
  });

  it('adds the trailing slash when the path lacks one', () => {
    expect(canonicalUrl(FOOD, '/pune/hinjewadi/biryani')).toBe(
      'https://food.marketmindai.com/pune/hinjewadi/biryani/',
    );
  });

  it('accepts a site URL with a trailing slash', () => {
    expect(canonicalUrl(`${FOOD}/`, '/pune/')).toBe('https://food.marketmindai.com/pune/');
  });

  it('maps the root path to the origin plus a slash', () => {
    expect(canonicalUrl(FOOD, '/')).toBe('https://food.marketmindai.com/');
  });

  it('drops query strings and fragments: parameters never create canonical URLs', () => {
    expect(canonicalUrl(FOOD, '/pune/wakad/biryani/?utm_source=x&sort=price#top')).toBe(
      'https://food.marketmindai.com/pune/wakad/biryani/',
    );
  });

  it('leaves a file path such as /sitemap.xml without a trailing slash', () => {
    expect(canonicalUrl(FOOD, '/sitemap.xml')).toBe('https://food.marketmindai.com/sitemap.xml');
    expect(canonicalUrl(FOOD, '/llms.txt')).toBe('https://food.marketmindai.com/llms.txt');
  });

  it('keeps the Marathi and Hindi prefixes', () => {
    expect(canonicalUrl(FOOD, '/mr/pune/')).toBe('https://food.marketmindai.com/mr/pune/');
  });

  it.each([
    ['pune/', 'no leading slash'],
    ['//evil.example/', 'protocol-relative'],
    ['/pune//wakad/', 'empty segment'],
    ['/pune/ wakad/', 'whitespace'],
    ['/pune\\wakad/', 'backslash'],
    ['https://evil.example/', 'absolute URL'],
    ['', 'empty'],
  ])('rejects the path %s (%s)', (bad) => {
    expect(() => canonicalUrl(FOOD, bad)).toThrow(RangeError);
  });

  it('rejects an http site URL', () => {
    expect(() => canonicalUrl('http://food.marketmindai.com', '/pune/')).toThrow(RangeError);
  });
});

describe('normaliseUrl', () => {
  it('puts an absolute https URL in canonical form', () => {
    expect(normaliseUrl('https://marketmindai.com/pune/hinjewadi?x=1#y')).toBe(
      'https://marketmindai.com/pune/hinjewadi/',
    );
    expect(normaliseUrl('https://marketmindai.com')).toBe('https://marketmindai.com/');
  });

  it('rejects http and relative URLs', () => {
    expect(() => normaliseUrl('http://marketmindai.com/')).toThrow(RangeError);
    expect(() => normaliseUrl('/pune/')).toThrow(RangeError);
  });
});

describe('robotsMeta', () => {
  it('is index,follow for an indexable entry', () => {
    expect(robotsMeta({ indexable: true })).toBe('index,follow');
    expect(ROBOTS_INDEX).toBe('index,follow');
  });

  it('is noindex,follow for a page in its noindex period (build_noindex)', () => {
    expect(robotsMeta({ indexable: false })).toBe('noindex,follow');
    expect(ROBOTS_NOINDEX).toBe('noindex,follow');
  });
});
