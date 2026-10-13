import { describe, expect, it } from 'vitest';
import { ExperienceViewSchema, PlaceViewSchema, ProviderViewSchema } from '../schema/index.ts';
import type { ExperienceView, PlaceView, ProviderView } from '../schema/index.ts';
import { WHATSAPP_NUMBER } from '../leads/index.ts';
import { localBusinessJsonLd, restaurantJsonLd, reviewJsonLd } from './business-jsonld.ts';
import { serializeJsonLd } from './jsonld.ts';

const FOOD = 'https://food.marketmindai.com';
const CONSTRUCTION = 'https://construction.marketmindai.com';

// Every business below is invented and named "Example …" (wave 4 rules); none of this is data.
const PLACE: PlaceView = PlaceViewSchema.parse({
  id: '3f1c1b0e-6a5b-4d7e-9a53-0a1b2c3d4e5f',
  slug: 'example-biryani-house',
  name: 'Example Biryani House',
  locality_id: 'hinjewadi',
  address: 'Example Plaza, Phase 1, Hinjewadi, Pune 411057',
  geo: { lat: 18.5912, lng: 73.7389 },
  website: 'https://example-biryani-house.example/',
  price_level: 2,
  cuisines: ['Biryani', 'North Indian'],
  diet: 'both',
  service_modes: ['dine_in', 'takeaway'],
  opening_hours: {
    tue: [
      ['11:00', '15:00'],
      ['18:00', '23:00'],
    ],
    mon: [['11:00', '23:30']],
    sun: [],
  },
  tags: ['family'],
  verification_status: 'unverified',
  verified_at: null,
  last_verified_at: null,
  auto_published: false,
  reviewed_at: null,
  dishes: [],
});
const PLACE_CTX = { siteUrl: FOOD, path: '/place/example-biryani-house/' };

const EXPERIENCE: ExperienceView = ExperienceViewSchema.parse({
  id: '9d2f6c7a-1b3e-4c5d-8e9f-a0b1c2d3e4f5',
  business_id: PLACE.id,
  visited_at: '2026-09-20',
  dishes: [{ dish_id: 'biryani', price_paid_inr: 249, rating: 4, notes: 'Well spiced.' }],
  overall_rating: 4,
  would_recommend: true,
  tags: [],
  notes: 'Good dum biryani; one portion is enough for one person.',
  prose_status: 'reviewed',
  photos: [],
});

const PROVIDER: ProviderView = ProviderViewSchema.parse({
  id: '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
  slug: 'example-waterproofing-works',
  name: 'Example Waterproofing Works',
  locality_id: 'baner',
  service_localities: ['baner', 'aundh'],
  services: ['terrace-waterproofing'],
  specializations: ['terraces'],
  experience_years: 8,
  accepts_leads: true,
  verification_status: 'unverified',
  verified_at: null,
  founding_partner: false,
  auto_published: false,
  reviewed_at: null,
});
const PROVIDER_CTX = {
  siteUrl: CONSTRUCTION,
  path: '/provider/example-waterproofing-works/',
  address: 'Example Chambers, Baner, Pune 411045',
  serviceNames: ['Terrace Waterproofing'],
  areaServedNames: ['Baner', 'Aundh'],
};

const POSTAL = {
  '@type': 'PostalAddress',
  addressLocality: 'Pune',
  addressRegion: 'Maharashtra',
  addressCountry: 'IN',
};

describe('restaurantJsonLd', () => {
  it('writes the fields the view has, in schema.org shapes', () => {
    expect(restaurantJsonLd(PLACE, PLACE_CTX)).toStrictEqual({
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      '@id': 'https://food.marketmindai.com/place/example-biryani-house/#restaurant',
      name: 'Example Biryani House',
      url: 'https://food.marketmindai.com/place/example-biryani-house/',
      sameAs: ['https://example-biryani-house.example/'],
      address: { ...POSTAL, streetAddress: 'Example Plaza, Phase 1, Hinjewadi, Pune 411057' },
      geo: { '@type': 'GeoCoordinates', latitude: 18.5912, longitude: 73.7389 },
      servesCuisine: ['Biryani', 'North Indian'],
      priceRange: '₹₹',
      openingHoursSpecification: [
        { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Monday', opens: '11:00', closes: '23:30' },
        { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Tuesday', opens: '11:00', closes: '15:00' },
        { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Tuesday', opens: '18:00', closes: '23:00' },
      ],
    });
  });

  it('is null without an address: no Restaurant markup for an unlocated place', () => {
    expect(restaurantJsonLd({ ...PLACE, address: null }, PLACE_CTX)).toBeNull();
    expect(restaurantJsonLd({ ...PLACE, address: '   ' }, PLACE_CTX)).toBeNull();
  });

  it('carries only what the view has: nothing is invented to fill a gap', () => {
    const bare = restaurantJsonLd(
      { ...PLACE, website: null, geo: null, price_level: null, cuisines: [], opening_hours: null },
      PLACE_CTX,
    );
    expect(Object.keys(bare ?? {}).sort()).toEqual(['@context', '@id', '@type', 'address', 'name', 'url']);
  });

  it('has no telephone, contact point, rating or review unless evidence is passed in', () => {
    const node = restaurantJsonLd(PLACE, PLACE_CTX);
    for (const key of ['telephone', 'contactPoint', 'aggregateRating', 'review', 'image']) {
      expect(node).not.toHaveProperty(key);
    }
  });

  describe('aggregateRating: only from real evidence counts passed in', () => {
    it('is written from a value and a count', () => {
      const node = restaurantJsonLd(PLACE, { ...PLACE_CTX, rating: { value: 4.5, count: 4 } });
      expect(node?.aggregateRating).toStrictEqual({
        '@type': 'AggregateRating',
        ratingValue: 4.5,
        ratingCount: 4,
        bestRating: 5,
        worstRating: 1,
      });
    });

    it('is left out for no evidence, whether null, undefined or a count of zero', () => {
      for (const rating of [null, undefined, { value: 4.5, count: 0 }]) {
        expect(restaurantJsonLd(PLACE, { ...PLACE_CTX, rating })).not.toHaveProperty('aggregateRating');
      }
    });

    it('throws for a value off the 1 to 5 scale or a count that is not a whole number', () => {
      for (const rating of [
        { value: 5.5, count: 3 },
        { value: 0.5, count: 3 },
        { value: Number.NaN, count: 3 },
        { value: 4, count: 2.5 },
      ]) {
        expect(() => restaurantJsonLd(PLACE, { ...PLACE_CTX, rating })).toThrow(RangeError);
      }
    });
  });

  describe('review: only from first-hand experiences passed in', () => {
    it('writes one Review per experience of this place, with MarketMind AI as the author', () => {
      const node = restaurantJsonLd(PLACE, { ...PLACE_CTX, experiences: [EXPERIENCE] });
      expect(node?.review).toStrictEqual([
        {
          '@type': 'Review',
          author: { '@type': 'Organization', name: 'MarketMind AI' },
          datePublished: '2026-09-20',
          reviewRating: { '@type': 'Rating', ratingValue: 4, bestRating: 5, worstRating: 1 },
          reviewBody: 'Good dum biryani; one portion is enough for one person.',
        },
      ]);
    });

    it('skips an experience of another business', () => {
      const other = { ...EXPERIENCE, business_id: PROVIDER.id };
      expect(restaurantJsonLd(PLACE, { ...PLACE_CTX, experiences: [other] })).not.toHaveProperty('review');
    });

    it('keeps the rating but not the text of a draft experience', () => {
      const draft = { ...EXPERIENCE, prose_status: 'draft' as const };
      const review = (restaurantJsonLd(PLACE, { ...PLACE_CTX, experiences: [draft] })?.review ??
        []) as object[];
      expect(review).toHaveLength(1);
      expect(review[0]).not.toHaveProperty('reviewBody');
      expect(review[0]).toHaveProperty('reviewRating');
    });

    it('leaves out an empty review body', () => {
      const noNotes = { ...EXPERIENCE, notes: '  ' };
      const review = (restaurantJsonLd(PLACE, { ...PLACE_CTX, experiences: [noNotes] })?.review ??
        []) as object[];
      expect(review[0]).not.toHaveProperty('reviewBody');
    });
  });
});

describe('reviewJsonLd', () => {
  it('is a standalone Review of the named item', () => {
    expect(
      reviewJsonLd(EXPERIENCE, {
        type: 'Restaurant',
        name: 'Example Biryani House',
        url: 'https://food.marketmindai.com/place/example-biryani-house',
      }),
    ).toStrictEqual({
      '@context': 'https://schema.org',
      '@type': 'Review',
      itemReviewed: {
        '@type': 'Restaurant',
        name: 'Example Biryani House',
        url: 'https://food.marketmindai.com/place/example-biryani-house/',
      },
      author: { '@type': 'Organization', name: 'MarketMind AI' },
      datePublished: '2026-09-20',
      reviewRating: { '@type': 'Rating', ratingValue: 4, bestRating: 5, worstRating: 1 },
      reviewBody: 'Good dum biryani; one portion is enough for one person.',
    });
  });
});

describe('localBusinessJsonLd', () => {
  it('writes a provider as a LocalBusiness with the address it was given', () => {
    expect(localBusinessJsonLd(PROVIDER, PROVIDER_CTX)).toStrictEqual({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': 'https://construction.marketmindai.com/provider/example-waterproofing-works/#localbusiness',
      name: 'Example Waterproofing Works',
      url: 'https://construction.marketmindai.com/provider/example-waterproofing-works/',
      address: { ...POSTAL, streetAddress: 'Example Chambers, Baner, Pune 411045' },
      areaServed: [
        { '@type': 'Place', name: 'Baner' },
        { '@type': 'Place', name: 'Aundh' },
      ],
      makesOffer: [{ '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Terrace Waterproofing' } }],
    });
  });

  it('is null without an address (a provider view has none; the page passes one it can source)', () => {
    expect(localBusinessJsonLd(PROVIDER, { ...PROVIDER_CTX, address: null })).toBeNull();
    expect(localBusinessJsonLd(PROVIDER, { ...PROVIDER_CTX, address: '' })).toBeNull();
  });

  it('leaves out the area and offers when there are none, and never writes a rating, review or phone', () => {
    const node = localBusinessJsonLd(PROVIDER, { ...PROVIDER_CTX, serviceNames: [], areaServedNames: [] });
    expect(Object.keys(node ?? {}).sort()).toEqual(['@context', '@id', '@type', 'address', 'name', 'url']);
    for (const key of ['telephone', 'contactPoint', 'aggregateRating', 'review']) {
      expect(localBusinessJsonLd(PROVIDER, PROVIDER_CTX)).not.toHaveProperty(key);
    }
  });
});

describe('the MarketMind AI WhatsApp number never appears in business JSON-LD', () => {
  const local = WHATSAPP_NUMBER.slice(2);
  const digitsOf = (text: string): string => text.replace(/\D/g, '');

  it('is absent from every business node built from clean views, in any formatting', () => {
    const nodes = [
      restaurantJsonLd(PLACE, { ...PLACE_CTX, rating: { value: 4, count: 3 }, experiences: [EXPERIENCE] }),
      localBusinessJsonLd(PROVIDER, PROVIDER_CTX),
      reviewJsonLd(EXPERIENCE, {
        type: 'Restaurant',
        name: PLACE.name,
        url: 'https://food.marketmindai.com/place/x/',
      }),
    ];
    for (const node of nodes) {
      expect(node).not.toBeNull();
      const text = serializeJsonLd(node as NonNullable<typeof node>);
      expect(text).not.toContain(WHATSAPP_NUMBER);
      expect(text).not.toContain(local);
      expect(text).not.toContain('wa.me');
      expect(text).not.toMatch(/9834\D*3\D*4\D*6179/);
      expect(digitsOf(text)).not.toContain(local);
    }
  });

  it.each([
    ['digits', WHATSAPP_NUMBER],
    ['with a plus and spaces', '+91 98343 46179'],
    ['national, with dashes', '98343-46179'],
    ['as a wa.me link', `https://wa.me/${WHATSAPP_NUMBER}`],
  ])('refuses business data that carries it (%s)', (_label, value) => {
    expect(() => restaurantJsonLd({ ...PLACE, name: `Example Cafe ${value}` }, PLACE_CTX)).toThrow(
      RangeError,
    );
    expect(() => restaurantJsonLd({ ...PLACE, address: `Example Plaza ${value}` }, PLACE_CTX)).toThrow(
      RangeError,
    );
    expect(() =>
      restaurantJsonLd({ ...PLACE, website: `https://example.example/?c=${value}` }, PLACE_CTX),
    ).toThrow(RangeError);
    expect(() => restaurantJsonLd({ ...PLACE, cuisines: [value] }, PLACE_CTX)).toThrow(RangeError);
    expect(() =>
      restaurantJsonLd(PLACE, { ...PLACE_CTX, experiences: [{ ...EXPERIENCE, notes: value }] }),
    ).toThrow(RangeError);
    expect(() => localBusinessJsonLd({ ...PROVIDER, name: `Example Works ${value}` }, PROVIDER_CTX)).toThrow(
      RangeError,
    );
    expect(() =>
      localBusinessJsonLd(PROVIDER, { ...PROVIDER_CTX, address: `Example Chambers ${value}` }),
    ).toThrow(RangeError);
    expect(() =>
      reviewJsonLd({ ...EXPERIENCE, notes: value }, { type: 'Restaurant', name: 'Example', url: FOOD }),
    ).toThrow(RangeError);
  });
});
