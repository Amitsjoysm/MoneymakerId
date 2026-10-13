import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ALL_SERVICE_IDS,
  DISH_IDS,
  LOCALITY_IDS,
  RESERVED_SLUGS,
  SUB_LOCALITY_IDS,
  isReservedSlug,
} from '../constants/index.ts';
import { SERVICES } from '../locality/fixtures.ts';
import { findSlugCollisions, serviceIds, type SlugCollision } from './collisions.ts';

const REAL_IDS = {
  localities: [...LOCALITY_IDS, ...SUB_LOCALITY_IDS],
  dishes: [...DISH_IDS],
  services: [...ALL_SERVICE_IDS],
};
const none = { localities: [], dishes: [], services: [] };

const brief = (c: SlugCollision) => `${c.host} ${c.space} ${c.slug} ${c.kind} ${c.claimants.join(',')}`;

describe('serviceIds', () => {
  it('flattens the service tree, parents before their sub-services', () => {
    expect(serviceIds(SERVICES)).toEqual([
      'waterproofing',
      'terrace-waterproofing',
      'bathroom-waterproofing',
      'external-wall-waterproofing',
      'basement-waterproofing',
      'leakage-repair',
      'painting',
      'interior-painting',
      'exterior-painting',
      'bathroom-renovation',
      'modular-kitchen',
      'house-construction',
    ]);
  });
});

describe('findSlugCollisions: the CONTRACTS §4a reference ids', () => {
  it('finds none among the 23 localities, 16 dishes and 12 services', () => {
    expect(REAL_IDS.localities).toHaveLength(23);
    expect(findSlugCollisions(REAL_IDS)).toEqual([]);
  });

  it('finds none for empty input', () => {
    expect(findSlugCollisions(none)).toEqual([]);
  });

  it('property: ids that are valid, unreserved and unique never collide, however they are split', () => {
    const slug = fc
      .stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .filter((s) => !isReservedSlug(s) && !s.endsWith('-cost'));
    fc.assert(
      fc.property(fc.uniqueArray(slug, { minLength: 3, maxLength: 24 }), fc.nat(), fc.nat(), (ids, a, b) => {
        const i = a % (ids.length + 1);
        const j = i + (b % (ids.length - i + 1));
        const result = findSlugCollisions({
          localities: ids.slice(0, i),
          dishes: ids.slice(i, j),
          services: ids.slice(j),
        });
        expect(result.map(brief)).toEqual([]);
      }),
    );
  });
});

describe('findSlugCollisions: two things on one URL', () => {
  it('reports a locality and a service with one id on the construction site only', () => {
    const result = findSlugCollisions({ ...REAL_IDS, localities: [...REAL_IDS.localities, 'painting'] });
    expect(result).toEqual([
      {
        host: 'construction',
        space: '/pune/{slug}/',
        slug: 'painting',
        kind: 'duplicate',
        claimants: ['locality:painting', 'service:painting'],
      },
    ]);
  });

  it('reports a locality and a dish with one id on the food site only', () => {
    const result = findSlugCollisions({ ...REAL_IDS, dishes: [...REAL_IDS.dishes, 'wakad'] });
    expect(result).toEqual([
      {
        host: 'food',
        space: '/pune/{slug}/',
        slug: 'wakad',
        kind: 'duplicate',
        claimants: ['locality:wakad', 'dish:wakad'],
      },
    ]);
  });

  it('does not mind the same id on two sites: a dish and a service live on different hosts', () => {
    const result = findSlugCollisions({
      localities: [],
      dishes: ['thali', 'painting'],
      services: ['painting'],
    });
    expect(result).toEqual([]);
  });

  it('reports the same id twice in one list, once per URL space it appears in', () => {
    const result = findSlugCollisions({ ...none, localities: ['wakad', 'baner', 'wakad'] });
    expect(result.map(brief)).toEqual([
      'construction /pune/{slug}/ wakad duplicate locality:wakad,locality:wakad',
      'food /pune/{slug}/ wakad duplicate locality:wakad,locality:wakad',
      'main /pune/{slug}/ wakad duplicate locality:wakad,locality:wakad',
    ]);
  });

  it('reports a service twice in the list in both construction spaces', () => {
    const result = findSlugCollisions({ ...none, services: ['painting', 'painting'] });
    expect(result.map((c) => `${c.host} ${c.space} ${c.slug}`)).toEqual([
      'construction /pune/{locality}/{slug}/ painting',
      'construction /pune/{slug}/ painting',
      'construction /pune/{slug}/ painting-cost',
    ]);
  });

  it('knows the {service}-cost guide takes a slug of its own', () => {
    // A locality called "painting-cost" would sit on the cost guide's URL (it is reserved as well).
    const result = findSlugCollisions({ ...REAL_IDS, localities: [...REAL_IDS.localities, 'painting-cost'] });
    expect(result.map(brief)).toEqual([
      'construction /pune/{slug}/ painting-cost duplicate locality:painting-cost,service-cost:painting-cost',
      'construction /pune/{slug}/ painting-cost reserved locality:painting-cost',
      'food /pune/{slug}/ painting-cost reserved locality:painting-cost',
      'main /pune/{slug}/ painting-cost reserved locality:painting-cost',
    ]);
  });

  it('knows a dish may not take the name of a locality intent', () => {
    const result = findSlugCollisions({ ...REAL_IDS, dishes: [...REAL_IDS.dishes, 'late-night-food'] });
    expect(result.map(brief)).toEqual([
      'food /pune/{locality}/{slug}/ late-night-food duplicate dish:late-night-food,locality-food-intent:late-night-food',
      'food /pune/{locality}/{slug}/ late-night-food reserved dish:late-night-food',
      'food /pune/{slug}/ late-night-food reserved dish:late-night-food',
    ]);
  });
});

describe('findSlugCollisions: reserved slugs (CONTRACTS §4a)', () => {
  it.each([...RESERVED_SLUGS, 'under-500', 'under-150', 'terrace-waterproofing-cost', 'x-cost'])(
    'does not allow %s as a locality, dish or service id',
    (slug) => {
      for (const key of ['localities', 'dishes', 'services'] as const) {
        const result = findSlugCollisions({ ...none, [key]: [slug] });
        expect(result.length, `${key} ${slug}`).toBeGreaterThan(0);
        expect(
          result.some((c) => c.kind === 'reserved' && c.slug === slug),
          `${key} ${slug}`,
        ).toBe(true);
      }
    },
  );

  it('reports a reserved id in each URL space it would sit in', () => {
    const result = findSlugCollisions({ ...none, services: ['ask'] }).filter((c) => c.kind === 'reserved');
    expect(result.map((c) => `${c.host} ${c.space}`)).toEqual([
      'construction /pune/{locality}/{slug}/',
      'construction /pune/{slug}/',
    ]);
  });

  it('does not flag the fixed intents or the derived cost slugs themselves as reserved ids', () => {
    expect(findSlugCollisions(REAL_IDS).some((c) => c.kind === 'reserved')).toBe(false);
  });
});

describe('findSlugCollisions: slugs are lowercase ASCII', () => {
  it.each([
    'Wakad',
    'हिंजवडी',
    'wa kad',
    '-wakad',
    'wakad-',
    'a--b',
    'wakad_2',
    'wakad/',
    'wäkad',
    '',
    'WAKAD',
  ])('flags %j', (slug) => {
    const result = findSlugCollisions({ ...none, localities: [slug] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((c) => c.kind === 'invalid_slug' && c.claimants.join() === `locality:${slug}`)).toBe(
      true,
    );
    expect(result.map((c) => c.host)).toEqual(['construction', 'food', 'main']);
  });

  it('accepts digits and single hyphens', () => {
    expect(findSlugCollisions({ ...none, localities: ['sector-12', '3d-park', 'wakad2'] })).toEqual([]);
  });
});

describe('findSlugCollisions: output', () => {
  const messy = {
    localities: ['wakad', 'baner', 'painting', 'Bad', 'ask'],
    dishes: ['wakad', 'thali', 'budget-food'],
    services: ['painting', 'x-cost'],
  };

  it('does not depend on the order of the input', () => {
    const base = findSlugCollisions(messy);
    expect(base.length).toBeGreaterThan(5);
    const reversed = findSlugCollisions({
      localities: [...messy.localities].reverse(),
      dishes: [...messy.dishes].reverse(),
      services: [...messy.services].reverse(),
    });
    // Claimants within a collision keep the order localities, dishes, services; the list is otherwise identical.
    expect(reversed).toEqual(base);
  });

  it('is sorted by host, then URL space, then slug, then kind', () => {
    const keys = findSlugCollisions(messy).map((c) => [c.host, c.space, c.slug, c.kind].join('\u0000'));
    expect(keys).toEqual([...keys].sort());
  });

  it('does not change its input', () => {
    const frozen = {
      localities: Object.freeze([...messy.localities]),
      dishes: Object.freeze([...messy.dishes]),
      services: Object.freeze([...messy.services]),
    };
    expect(() => findSlugCollisions(frozen)).not.toThrow();
  });
});
