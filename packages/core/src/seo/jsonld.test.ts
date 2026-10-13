import { describe, expect, it } from 'vitest';
import { WHATSAPP_NUMBER } from '../leads/index.ts';
import {
  breadcrumbListJsonLd,
  faqPageJsonLd,
  itemListJsonLd,
  jsonLdGraph,
  organizationId,
  organizationJsonLd,
  serializeJsonLd,
  webPageJsonLd,
  webSiteId,
  webSiteJsonLd,
  type JsonLdNode,
} from './jsonld.ts';

const MAIN = 'https://marketmindai.com';
const FOOD = 'https://food.marketmindai.com';

/** The checks every node must pass: a schema.org context and type, JSON-clean values, and absolute https links. */
function expectWellFormed(node: JsonLdNode): void {
  expect(node['@context']).toBe('https://schema.org');
  expect(typeof node['@type']).toBe('string');
  expect(JSON.parse(JSON.stringify(node))).toStrictEqual(node);
  const walk = (value: unknown, key: string): void => {
    if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
    if (typeof value === 'string' && ['url', 'item', '@id', 'sameAs'].includes(key)) {
      expect(value).toMatch(/^https:\/\/[^\s]+$/);
    }
    if (Array.isArray(value)) value.forEach((v) => walk(v, key));
    else if (value !== null && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, k);
    }
  };
  walk(node, '');
}

describe('organizationJsonLd', () => {
  it('is the one shared brand entity, with an id on the main site', () => {
    const node = organizationJsonLd({
      mainSiteUrl: MAIN,
      description: 'A Pune local decision engine.',
      logoUrl: `${MAIN}/logo.png`,
      sameAs: ['https://www.example.org/marketmind-ai'],
      contactPoint: {
        telephone: `+${WHATSAPP_NUMBER}`,
        contactType: 'customer support',
        availableLanguage: ['en', 'hi', 'mr'],
      },
    });
    expect(node).toStrictEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': 'https://marketmindai.com/#organization',
      name: 'MarketMind AI',
      url: 'https://marketmindai.com/',
      description: 'A Pune local decision engine.',
      logo: { '@type': 'ImageObject', url: 'https://marketmindai.com/logo.png' },
      sameAs: ['https://www.example.org/marketmind-ai'],
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+919834346179',
        contactType: 'customer support',
        availableLanguage: ['en', 'hi', 'mr'],
      },
    });
    expectWellFormed(node);
    expect(organizationId(MAIN)).toBe('https://marketmindai.com/#organization');
  });

  it('carries only what it is given', () => {
    expect(organizationJsonLd({ mainSiteUrl: `${MAIN}/` })).toStrictEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': 'https://marketmindai.com/#organization',
      name: 'MarketMind AI',
      url: 'https://marketmindai.com/',
    });
  });

  it('adds a plus sign to a bare WHATSAPP_NUMBER value', () => {
    const node = organizationJsonLd({
      mainSiteUrl: MAIN,
      contactPoint: { telephone: WHATSAPP_NUMBER, contactType: 'customer support' },
    });
    expect(node.contactPoint).toStrictEqual({
      '@type': 'ContactPoint',
      telephone: `+${WHATSAPP_NUMBER}`,
      contactType: 'customer support',
    });
  });

  it('rejects an http main site, an http sameAs and a malformed telephone', () => {
    expect(() => organizationJsonLd({ mainSiteUrl: 'http://marketmindai.com' })).toThrow(RangeError);
    expect(() => organizationJsonLd({ mainSiteUrl: MAIN, sameAs: ['http://example.org/x'] })).toThrow(
      RangeError,
    );
    expect(() =>
      organizationJsonLd({ mainSiteUrl: MAIN, contactPoint: { telephone: 'call us', contactType: 'sales' } }),
    ).toThrow(RangeError);
  });
});

describe('webSiteJsonLd', () => {
  it('names the site, links the shared publisher and has its own id', () => {
    const node = webSiteJsonLd({
      siteUrl: FOOD,
      mainSiteUrl: MAIN,
      name: 'MarketMind AI Food',
      description: 'Dishes in Pune by locality.',
      locale: 'en',
    });
    expect(node).toStrictEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': 'https://food.marketmindai.com/#website',
      url: 'https://food.marketmindai.com/',
      name: 'MarketMind AI Food',
      description: 'Dishes in Pune by locality.',
      inLanguage: 'en',
      publisher: { '@id': 'https://marketmindai.com/#organization' },
    });
    expectWellFormed(node);
    expect(webSiteId(FOOD)).toBe('https://food.marketmindai.com/#website');
  });

  it('has no search action: there is no search route to point at', () => {
    expect(
      webSiteJsonLd({ siteUrl: FOOD, mainSiteUrl: MAIN, name: 'MarketMind AI Food' }),
    ).not.toHaveProperty('potentialAction');
  });
});

describe('webPageJsonLd', () => {
  const base = {
    siteUrl: FOOD,
    path: '/pune/hinjewadi/biryani/',
    name: 'Best Biryani in Hinjewadi, Pune',
    description: 'Discover highly rated biryani options in Hinjewadi, Pune.',
    locale: 'en',
  } as const;

  it('describes the page with its canonical URL and a link to the site', () => {
    const node = webPageJsonLd({ ...base, dateModified: '2026-10-12T06:00:00.000Z', breadcrumb: true });
    expect(node).toStrictEqual({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': 'https://food.marketmindai.com/pune/hinjewadi/biryani/#webpage',
      url: 'https://food.marketmindai.com/pune/hinjewadi/biryani/',
      name: 'Best Biryani in Hinjewadi, Pune',
      description: 'Discover highly rated biryani options in Hinjewadi, Pune.',
      inLanguage: 'en',
      isPartOf: { '@id': 'https://food.marketmindai.com/#website' },
      dateModified: '2026-10-12T06:00:00.000Z',
      breadcrumb: { '@id': 'https://food.marketmindai.com/pune/hinjewadi/biryani/#breadcrumb' },
    });
    expectWellFormed(node);
  });

  it('leaves out the date and breadcrumb link when not given', () => {
    const node = webPageJsonLd(base);
    expect(node).not.toHaveProperty('dateModified');
    expect(node).not.toHaveProperty('breadcrumb');
  });

  it('can be a more specific page type', () => {
    expect(webPageJsonLd({ ...base, type: 'CollectionPage' })['@type']).toBe('CollectionPage');
    expect(webPageJsonLd({ ...base, type: 'AboutPage' })['@type']).toBe('AboutPage');
    expect(webPageJsonLd({ ...base, type: 'ContactPage' })['@type']).toBe('ContactPage');
  });

  it('rejects a date that is not a date', () => {
    expect(() => webPageJsonLd({ ...base, dateModified: 'yesterday' })).toThrow(RangeError);
  });
});

describe('breadcrumbListJsonLd', () => {
  const trail = [
    { name: 'Home', url: 'https://marketmindai.com/' },
    { name: 'Food', url: 'https://food.marketmindai.com/' },
    { name: 'Pune', url: 'https://food.marketmindai.com/pune/' },
    { name: 'Hinjewadi', url: 'https://food.marketmindai.com/pune/hinjewadi/' },
    { name: 'Biryani', url: 'https://food.marketmindai.com/pune/hinjewadi/biryani' },
  ];

  it('numbers the trail from 1, across hosts, and is identified by its last page', () => {
    const node = breadcrumbListJsonLd(trail);
    expect(node).toStrictEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      '@id': 'https://food.marketmindai.com/pune/hinjewadi/biryani/#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://marketmindai.com/' },
        { '@type': 'ListItem', position: 2, name: 'Food', item: 'https://food.marketmindai.com/' },
        { '@type': 'ListItem', position: 3, name: 'Pune', item: 'https://food.marketmindai.com/pune/' },
        {
          '@type': 'ListItem',
          position: 4,
          name: 'Hinjewadi',
          item: 'https://food.marketmindai.com/pune/hinjewadi/',
        },
        {
          '@type': 'ListItem',
          position: 5,
          name: 'Biryani',
          item: 'https://food.marketmindai.com/pune/hinjewadi/biryani/',
        },
      ],
    });
    expectWellFormed(node as JsonLdNode);
  });

  it('is null for an empty trail', () => {
    expect(breadcrumbListJsonLd([])).toBeNull();
  });

  it('rejects an item with no name or a relative URL', () => {
    expect(() => breadcrumbListJsonLd([{ name: ' ', url: 'https://marketmindai.com/' }])).toThrow(RangeError);
    expect(() => breadcrumbListJsonLd([{ name: 'Pune', url: '/pune/' }])).toThrow(RangeError);
  });
});

describe('itemListJsonLd', () => {
  it('lists the items in the order given, with a position, name and URL each', () => {
    const node = itemListJsonLd({
      name: 'Biryani in Hinjewadi',
      items: [
        { name: 'Example Biryani House', url: 'https://food.marketmindai.com/place/example-biryani-house/' },
        { name: 'Example Dum Kitchen', url: 'https://food.marketmindai.com/place/example-dum-kitchen' },
      ],
    });
    expect(node).toStrictEqual({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Biryani in Hinjewadi',
      numberOfItems: 2,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Example Biryani House',
          url: 'https://food.marketmindai.com/place/example-biryani-house/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Example Dum Kitchen',
          url: 'https://food.marketmindai.com/place/example-dum-kitchen/',
        },
      ],
    });
    expectWellFormed(node as JsonLdNode);
  });

  it('has no name when none is given, and is null for an empty list', () => {
    const node = itemListJsonLd({ items: [{ name: 'A', url: 'https://marketmindai.com/a/' }] });
    expect(node).not.toHaveProperty('name');
    expect(itemListJsonLd({ items: [] })).toBeNull();
  });
});

describe('faqPageJsonLd', () => {
  it('is plain schema.org Question and Answer pairs', () => {
    const node = faqPageJsonLd([
      { question: 'How long does terrace waterproofing last?', answer: 'It depends on the system used.' },
      { question: 'Is a site visit needed?', answer: 'Yes, for an exact quote.' },
    ]);
    expect(node).toStrictEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How long does terrace waterproofing last?',
          acceptedAnswer: { '@type': 'Answer', text: 'It depends on the system used.' },
        },
        {
          '@type': 'Question',
          name: 'Is a site visit needed?',
          acceptedAnswer: { '@type': 'Answer', text: 'Yes, for an exact quote.' },
        },
      ],
    });
    expectWellFormed(node as JsonLdNode);
  });

  it('is null for no questions and rejects a question without an answer', () => {
    expect(faqPageJsonLd([])).toBeNull();
    expect(() => faqPageJsonLd([{ question: 'Why?', answer: '  ' }])).toThrow(RangeError);
  });
});

describe('jsonLdGraph and serializeJsonLd', () => {
  const org = organizationJsonLd({ mainSiteUrl: MAIN });
  const site = webSiteJsonLd({ siteUrl: FOOD, mainSiteUrl: MAIN, name: 'MarketMind AI Food' });

  it('joins nodes under one context', () => {
    const { '@context': _orgContext, ...orgBody } = org;
    const { '@context': _siteContext, ...siteBody } = site;
    expect(jsonLdGraph([org, site])).toStrictEqual({
      '@context': 'https://schema.org',
      '@graph': [orgBody, siteBody],
    });
  });

  it('serialises one node as JSON and several nodes as a graph', () => {
    expect(JSON.parse(serializeJsonLd(org))).toStrictEqual(org);
    expect(JSON.parse(serializeJsonLd([org, site]))).toStrictEqual(jsonLdGraph([org, site]));
  });

  it('escapes < > & and the JavaScript line separators so the text cannot end the script element', () => {
    const hostile = organizationJsonLd({
      mainSiteUrl: MAIN,
      description: '</script><script>alert(1)</script> & <b>x</b>\u2028\u2029',
    });
    const text = serializeJsonLd(hostile);
    expect(text).not.toMatch(/[<>&\u2028\u2029]/);
    expect(text).toContain('\\u003c/script\\u003e');
    expect(JSON.parse(text)).toStrictEqual(hostile);
  });
});
