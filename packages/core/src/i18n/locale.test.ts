import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LOCALITY_IDS } from '../constants/index.ts';
import { LocaleSchema } from '../schema/index.ts';
import { DEFAULT_LOCALE, localizedUrl, splitLocalePrefix } from './locale.ts';

describe('localizedUrl: English is the unprefixed default', () => {
  it('returns the url unchanged for en', () => {
    for (const url of [
      '/',
      '/pune/',
      '/pune/hinjewadi/waterproofing/',
      '/pune',
      '/pune/wakad/?q=1#top',
      'https://food.marketmindai.com/pune/baner/',
      'https://food.marketmindai.com',
      'https://FOOD.marketmindai.com:8443/pune/',
    ]) {
      expect(localizedUrl(url, 'en')).toBe(url);
    }
  });

  it('names en as the default locale', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });
});

describe('localizedUrl: mr and hi get a /{locale} prefix on the same host', () => {
  it.each(['mr', 'hi'] as const)('prefixes a path with /%s', (locale) => {
    expect(localizedUrl('/pune/hinjewadi/', locale)).toBe(`/${locale}/pune/hinjewadi/`);
    expect(localizedUrl('/pune/hinjewadi/waterproofing/', locale)).toBe(
      `/${locale}/pune/hinjewadi/waterproofing/`,
    );
  });

  it('maps the root to the locale root', () => {
    expect(localizedUrl('/', 'mr')).toBe('/mr/');
    expect(localizedUrl('/', 'hi')).toBe('/hi/');
  });

  it('keeps a missing trailing slash as it was', () => {
    expect(localizedUrl('/pune', 'mr')).toBe('/mr/pune');
  });

  it('keeps the query string and the fragment', () => {
    expect(localizedUrl('/pune/wakad/?q=1&r=2#top', 'hi')).toBe('/hi/pune/wakad/?q=1&r=2#top');
    expect(localizedUrl('/pune/wakad/#top', 'mr')).toBe('/mr/pune/wakad/#top');
    expect(localizedUrl('/#top', 'mr')).toBe('/mr/#top');
  });

  it('prefixes an absolute url on its own host and leaves the origin alone', () => {
    expect(localizedUrl('https://food.marketmindai.com/pune/baner/', 'mr')).toBe(
      'https://food.marketmindai.com/mr/pune/baner/',
    );
    expect(localizedUrl('https://construction.marketmindai.com/pune/', 'hi')).toBe(
      'https://construction.marketmindai.com/hi/pune/',
    );
    expect(localizedUrl('https://marketmindai.com', 'mr')).toBe('https://marketmindai.com/mr/');
    expect(localizedUrl('https://marketmindai.com/?a=1', 'hi')).toBe('https://marketmindai.com/hi/?a=1');
    expect(localizedUrl('http://localhost:4321/pune/', 'mr')).toBe('http://localhost:4321/mr/pune/');
  });

  it('never translates a slug: every locality id survives unchanged', () => {
    for (const id of LOCALITY_IDS) {
      for (const locale of ['mr', 'hi'] as const) {
        expect(localizedUrl(`/pune/${id}/`, locale)).toBe(`/${locale}/pune/${id}/`);
      }
    }
  });

  it('property: for any slug path, the result is the prefix plus the path', () => {
    const slug = fc
      .stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .filter((s) => s !== 'mr' && s !== 'hi' && s !== 'api');
    const segments = fc.array(slug, { minLength: 1, maxLength: 4 });
    fc.assert(
      fc.property(segments, fc.constantFrom('mr', 'hi'), (segs, locale) => {
        const path = `/${segs.join('/')}/`;
        expect(localizedUrl(path, locale)).toBe(`/${locale}${path}`);
      }),
    );
  });
});

describe('localizedUrl: a url that already carries a locale prefix is re-based, never double-prefixed', () => {
  it('is idempotent', () => {
    expect(localizedUrl('/mr/pune/', 'mr')).toBe('/mr/pune/');
    expect(localizedUrl(localizedUrl('/pune/wakad/', 'hi'), 'hi')).toBe('/hi/pune/wakad/');
  });

  it('switches locale', () => {
    expect(localizedUrl('/mr/pune/wakad/', 'hi')).toBe('/hi/pune/wakad/');
    expect(localizedUrl('/hi/pune/wakad/', 'en')).toBe('/pune/wakad/');
    expect(localizedUrl('/mr/', 'en')).toBe('/');
    expect(localizedUrl('/mr', 'en')).toBe('/');
    expect(localizedUrl('/mr', 'hi')).toBe('/hi/');
    expect(localizedUrl('https://food.marketmindai.com/mr/pune/', 'en')).toBe(
      'https://food.marketmindai.com/pune/',
    );
  });

  it('only a whole first segment counts as a prefix', () => {
    expect(localizedUrl('/mrs/pune/', 'mr')).toBe('/mr/mrs/pune/');
    expect(localizedUrl('/pune/mr/', 'hi')).toBe('/hi/pune/mr/');
    expect(localizedUrl('/history/', 'mr')).toBe('/mr/history/');
  });
});

describe('localizedUrl: routes that exist once per host are never prefixed', () => {
  it.each([
    '/api/lead',
    '/api/ask/stream',
    '/sitemap.xml',
    '/robots.txt',
    '/llms.txt',
    '/photos/abc-640.webp',
  ])('%s is returned unchanged for every locale', (url) => {
    for (const locale of LocaleSchema.options) {
      expect(localizedUrl(url, locale)).toBe(url);
    }
  });

  it('does not mistake a slug that merely starts with "api" for the api route', () => {
    expect(localizedUrl('/apiary/', 'mr')).toBe('/mr/apiary/');
  });
});

describe('localizedUrl: bad input fails loudly', () => {
  it.each([
    '',
    'pune/',
    '//evil.example/pune/',
    'javascript:alert(1)',
    'ftp://food.marketmindai.com/pune/',
    'https://',
    '/pune/ wakad/',
    '/pune\\wakad/',
    'mailto:a@b.co',
  ])('rejects %j', (url) => {
    expect(() => localizedUrl(url, 'mr')).toThrow(RangeError);
    expect(() => localizedUrl(url, 'en')).toThrow(RangeError);
  });
});

describe('splitLocalePrefix', () => {
  it('reads the locale and returns the unprefixed url', () => {
    expect(splitLocalePrefix('/mr/pune/wakad/')).toEqual({ locale: 'mr', url: '/pune/wakad/' });
    expect(splitLocalePrefix('/hi/')).toEqual({ locale: 'hi', url: '/' });
    expect(splitLocalePrefix('/hi')).toEqual({ locale: 'hi', url: '/' });
    expect(splitLocalePrefix('/mr/pune/?q=1#a')).toEqual({ locale: 'mr', url: '/pune/?q=1#a' });
    expect(splitLocalePrefix('https://food.marketmindai.com/hi/pune/')).toEqual({
      locale: 'hi',
      url: 'https://food.marketmindai.com/pune/',
    });
  });

  it('treats an unprefixed url as English and returns it unchanged', () => {
    expect(splitLocalePrefix('/pune/wakad/')).toEqual({ locale: 'en', url: '/pune/wakad/' });
    expect(splitLocalePrefix('/')).toEqual({ locale: 'en', url: '/' });
    expect(splitLocalePrefix('/mrs/pune/')).toEqual({ locale: 'en', url: '/mrs/pune/' });
  });

  it('round-trips with localizedUrl', () => {
    for (const locale of LocaleSchema.options) {
      for (const url of [
        '/',
        '/pune/',
        '/pune/baner/waterproofing/',
        'https://marketmindai.com/pune/baner/',
      ]) {
        expect(splitLocalePrefix(localizedUrl(url, locale))).toEqual({ locale, url });
      }
    }
  });

  it('rejects the same bad input', () => {
    expect(() => splitLocalePrefix('pune/')).toThrow(RangeError);
    expect(() => splitLocalePrefix('//evil.example/')).toThrow(RangeError);
  });
});
