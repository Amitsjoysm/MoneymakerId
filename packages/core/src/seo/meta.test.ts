import { describe, expect, it } from 'vitest';
import { DESC, TITLE } from '../constants/index.ts';
import type { PageType } from '../schema/index.ts';
import {
  BRAND_NAME,
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  pageMeta,
  type PageMetaInput,
} from './meta.ts';

describe('constants', () => {
  it('names the brand and sets the length budgets', () => {
    expect(BRAND_NAME).toBe('MarketMind AI');
    expect(TITLE_MAX_LENGTH).toBe(60);
    expect(DESCRIPTION_MAX_LENGTH).toBe(160);
  });
});

describe('CONTRACTS §8a literals (spec §38, §39): exact strings', () => {
  it('dish_locality title and description (food)', () => {
    expect(pageMeta({ page_type: 'dish_locality', dish: 'Biryani', locality: 'Hinjewadi' })).toEqual({
      title: 'Best Biryani in Hinjewadi, Pune | MarketMind AI',
      description:
        'Discover highly rated biryani options in Hinjewadi, Pune. Compare price, location, freshness and our latest recommendations.',
    });
    expect(pageMeta({ page_type: 'dish_locality', dish: 'Samosa', locality: 'Wakad' }).title).toBe(
      'Best Samosa in Wakad, Pune | MarketMind AI',
    );
  });

  it('lowercases the dish in the description only, and keeps the locality as given', () => {
    const m = pageMeta({ page_type: 'dish_locality', dish: 'Misal Pav', locality: 'Pimple Saudagar' });
    expect(m.title).toBe('Best Misal Pav in Pimple Saudagar, Pune | MarketMind AI');
    expect(m.description).toBe(
      'Discover highly rated misal pav options in Pimple Saudagar, Pune. Compare price, location, freshness and our latest recommendations.',
    );
  });

  it('locality_service title and description (construction)', () => {
    expect(pageMeta({ page_type: 'locality_service', service: 'Waterproofing', locality: 'Wakad' })).toEqual({
      title: 'Waterproofing Cost in Wakad, Pune | MarketMind AI',
      description:
        'Estimate waterproofing costs in Wakad, Pune, understand pricing factors and find local providers for quotes.',
    });
  });

  it('service_cost title and description (construction city guide)', () => {
    expect(
      pageMeta({
        page_type: 'service_cost',
        service: 'Terrace Waterproofing',
        service_id: 'terrace-waterproofing',
      }),
    ).toEqual({
      title: 'Terrace Waterproofing Cost in Pune | MarketMind AI',
      description:
        'Estimate terrace waterproofing costs in Pune, understand pricing factors and find local providers for quotes.',
    });
  });

  it('the house-construction guide, and only that guide, says "per Sq Ft"', () => {
    expect(
      pageMeta({
        page_type: 'service_cost',
        service: 'House Construction',
        service_id: 'house-construction',
      }),
    ).toEqual({
      title: 'House Construction Cost per Sq Ft in Pune | MarketMind AI',
      description:
        'Estimate house construction costs per sq ft in Pune, understand pricing factors and find local providers for quotes.',
    });
    for (const [service, service_id] of [
      ['Painting', 'painting'],
      ['Modular Kitchen', 'modular-kitchen'],
      ['Interior Painting', 'interior-painting'],
    ] as const) {
      const m = pageMeta({ page_type: 'service_cost', service, service_id });
      expect(m.title).toBe(`${service} Cost in Pune | MarketMind AI`);
      expect(m.title).not.toMatch(/sq ft/i);
      expect(m.description).not.toMatch(/sq ft/i);
    }
  });

  it('the constants and the generated text agree (a change to §8a shows up here)', () => {
    expect(TITLE.food.dish_locality).toBe('Best {Dish} in {Locality}, Pune | MarketMind AI');
    expect(DESC.food.endsWith('Compare price, location, freshness and our latest recommendations.')).toBe(
      true,
    );
    expect(TITLE.construction.service_cost_per_sqft).toBe('{Service} Cost per Sq Ft in Pune | MarketMind AI');
  });
});

describe('the same pattern for the other food pages', () => {
  it('dish_city is the dish_locality text without the locality', () => {
    const m = pageMeta({ page_type: 'dish_city', dish: 'Biryani' });
    expect(m.title).toBe('Best Biryani in Pune | MarketMind AI');
    expect(m.description).toBe(
      'Discover highly rated biryani options in Pune. Compare price, location, freshness and our latest recommendations.',
    );
  });

  it.each([
    [
      'under-200',
      'Biryani Under ₹200 in Hinjewadi, Pune | MarketMind AI',
      'options under ₹200 in Hinjewadi, Pune.',
    ],
    [
      'under-1500',
      'Biryani Under ₹1500 in Hinjewadi, Pune | MarketMind AI',
      'options under ₹1500 in Hinjewadi, Pune.',
    ],
    [
      'veg',
      'Veg Biryani in Hinjewadi, Pune | MarketMind AI',
      'vegetarian biryani options in Hinjewadi, Pune.',
    ],
    [
      'late-night',
      'Late-Night Biryani in Hinjewadi, Pune | MarketMind AI',
      'biryani options in Hinjewadi, Pune with late-night hours we have checked.',
    ],
    [
      'family',
      'Family-Friendly Biryani in Hinjewadi, Pune | MarketMind AI',
      'options in Hinjewadi, Pune that suit families.',
    ],
    [
      'office-lunch',
      'Biryani for Office Lunch in Hinjewadi, Pune | MarketMind AI',
      'options in Hinjewadi, Pune that work for an office lunch.',
    ],
  ] as const)('food_intent %s', (intent, title, fragment) => {
    const m = pageMeta({ page_type: 'food_intent', dish: 'Biryani', locality: 'Hinjewadi', intent });
    expect(m.title).toBe(title);
    expect(m.description).toContain(fragment);
    expect(m.description.endsWith('Compare price, location, freshness and our latest recommendations.')).toBe(
      true,
    );
  });

  it.each([
    ['late-night-food', 'Late-Night Food in Baner, Pune | MarketMind AI'],
    ['budget-food', 'Budget Food in Baner, Pune | MarketMind AI'],
    ['veg-food', 'Veg Food in Baner, Pune | MarketMind AI'],
  ] as const)('locality_food_intent %s', (intent, title) => {
    const m = pageMeta({ page_type: 'locality_food_intent', locality: 'Baner', intent });
    expect(m.title).toBe(title);
    expect(m.description).toContain('Baner, Pune');
  });

  it('place', () => {
    expect(pageMeta({ page_type: 'place', name: 'Example Biryani House', locality: 'Wakad' })).toEqual({
      title: 'Example Biryani House in Wakad, Pune | MarketMind AI',
      description:
        'What we know about Example Biryani House in Wakad, Pune, where each detail comes from and when we last checked it.',
    });
  });
});

describe('the same pattern for the other construction and brand pages', () => {
  it('service_city (providers)', () => {
    const m = pageMeta({ page_type: 'service_city', service: 'Waterproofing' });
    expect(m.title).toBe('Waterproofing Providers in Pune | MarketMind AI');
    expect(m.description).toContain('waterproofing providers in Pune');
  });

  it('provider', () => {
    const m = pageMeta({ page_type: 'provider', name: 'Example Waterproofing Works', locality: 'Baner' });
    expect(m.title).toBe('Example Waterproofing Works in Baner, Pune | MarketMind AI');
    expect(m.description).toContain('Example Waterproofing Works in Baner, Pune');
  });

  it('locality_hub differs by host', () => {
    expect(pageMeta({ page_type: 'locality_hub', host: 'food', locality: 'Kothrud' }).title).toBe(
      'Best Food in Kothrud, Pune | MarketMind AI',
    );
    expect(pageMeta({ page_type: 'locality_hub', host: 'construction', locality: 'Kothrud' }).title).toBe(
      'Construction Costs in Kothrud, Pune | MarketMind AI',
    );
  });

  it('locality_guide (main)', () => {
    expect(pageMeta({ page_type: 'locality_guide', locality: 'Kothrud' }).title).toBe(
      'Kothrud, Pune: Local Guide | MarketMind AI',
    );
  });

  it('home and city_hub differ by host', () => {
    const titles = (['main', 'food', 'construction'] as const).flatMap((host) => [
      pageMeta({ page_type: 'home', host }).title,
      pageMeta({ page_type: 'city_hub', host }).title,
    ]);
    expect(new Set(titles).size).toBe(6);
  });

  it('calculator carries the cost disclaimer', () => {
    expect(pageMeta({ page_type: 'calculator' }).description).toContain(
      'Cost estimates are indicative and should not be treated as quotations.',
    );
  });

  it('legal and business pages use the name and the description given by their page', () => {
    expect(
      pageMeta({ page_type: 'legal', name: 'Privacy Policy', description: 'How we handle your data.' }),
    ).toEqual({
      title: 'Privacy Policy | MarketMind AI',
      description: 'How we handle your data.',
    });
    expect(
      pageMeta({
        page_type: 'business',
        name: 'Feature Your Business',
        description: 'Paid placement, labelled.',
      }).title,
    ).toBe('Feature Your Business | MarketMind AI');
  });
});

// One input per page type: the Record type makes a new PageType a compile error here until it has a sample.
const SAMPLES: Record<PageType, PageMetaInput> = {
  home: { page_type: 'home', host: 'main' },
  city_hub: { page_type: 'city_hub', host: 'food' },
  locality_hub: { page_type: 'locality_hub', host: 'construction', locality: 'Wakad' },
  dish_city: { page_type: 'dish_city', dish: 'Biryani' },
  dish_locality: { page_type: 'dish_locality', dish: 'Biryani', locality: 'Hinjewadi' },
  food_intent: { page_type: 'food_intent', dish: 'Biryani', locality: 'Hinjewadi', intent: 'under-200' },
  locality_food_intent: { page_type: 'locality_food_intent', locality: 'Baner', intent: 'late-night-food' },
  place: { page_type: 'place', name: 'Example Biryani House', locality: 'Wakad' },
  service_cost: { page_type: 'service_cost', service: 'Waterproofing', service_id: 'waterproofing' },
  service_city: { page_type: 'service_city', service: 'Painting' },
  locality_service: { page_type: 'locality_service', service: 'Painting', locality: 'Wakad' },
  provider: { page_type: 'provider', name: 'Example Painters', locality: 'Baner' },
  calculator: { page_type: 'calculator' },
  get_quotes: { page_type: 'get_quotes' },
  for_contractors: { page_type: 'for_contractors' },
  ask: { page_type: 'ask', host: 'food' },
  locality_guide: { page_type: 'locality_guide', locality: 'Wakad' },
  legal: { page_type: 'legal', name: 'Terms of Use', description: 'The terms that apply to this site.' },
  business: {
    page_type: 'business',
    name: 'Advertise',
    description: 'Advertise on MarketMind AI: how paid placement works and how it is labelled.',
  },
  contact: { page_type: 'contact' },
  about: { page_type: 'about' },
  not_found: { page_type: 'not_found' },
  thank_you: { page_type: 'thank_you' },
};

describe('every page type', () => {
  it.each(Object.entries(SAMPLES))(
    '%s has a branded title within budget and a sane description',
    (_type, input) => {
      const { title, description } = pageMeta(input);
      expect(title.endsWith(' | MarketMind AI')).toBe(true);
      expect(title.length).toBeLessThanOrEqual(TITLE_MAX_LENGTH);
      expect(description.length).toBeGreaterThanOrEqual(30);
      expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX_LENGTH);
      for (const text of [title, description]) {
        expect(text).not.toMatch(/[{}]/);
        expect(text).not.toMatch(/\s{2,}|^\s|\s$/);
        expect(text).not.toMatch(/undefined|null/);
      }
    },
  );

  it('titles of different page types differ', () => {
    const titles = Object.values(SAMPLES).map((i) => pageMeta(i).title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('never carries a phone number or the WhatsApp number', () => {
    for (const input of Object.values(SAMPLES)) {
      const { title, description } = pageMeta(input);
      expect(`${title} ${description}`).not.toMatch(/919834346179|\d{10}/);
    }
  });
});

describe('long names: recorded results (the §8a literals are not shortened)', () => {
  it('a long locality with a long service is over the 60 character budget', () => {
    const title = pageMeta({
      page_type: 'locality_service',
      service: 'External Wall Waterproofing',
      locality: 'Pimple Saudagar',
    }).title;
    expect(title).toBe('External Wall Waterproofing Cost in Pimple Saudagar, Pune | MarketMind AI');
    expect(title.length).toBe(73);
  });

  it('the longest locality with a typical service and dish fits the budget', () => {
    const waterproofing = pageMeta({
      page_type: 'locality_service',
      service: 'Waterproofing',
      locality: 'Pimple Saudagar',
    });
    expect(waterproofing.title).toBe('Waterproofing Cost in Pimple Saudagar, Pune | MarketMind AI');
    expect(waterproofing.title.length).toBe(59);
    const biryani = pageMeta({ page_type: 'dish_locality', dish: 'Biryani', locality: 'Pimple Saudagar' });
    expect(biryani.title).toBe('Best Biryani in Pimple Saudagar, Pune | MarketMind AI');
    expect(biryani.title.length).toBe(53);
  });

  it('the longest description of the §8a templates stays within 160 for the longest names', () => {
    const food = pageMeta({ page_type: 'dish_locality', dish: 'Chole Bhature', locality: 'Pimple Saudagar' });
    expect(food.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX_LENGTH);
    const build = pageMeta({
      page_type: 'locality_service',
      service: 'External Wall Waterproofing',
      locality: 'Pimple Saudagar',
    });
    expect(build.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX_LENGTH);
  });
});

describe('input handling', () => {
  it('trims and collapses whitespace in names', () => {
    const m = pageMeta({ page_type: 'dish_locality', dish: '  Vada   Pav ', locality: ' Pimple\nSaudagar ' });
    expect(m.title).toBe('Best Vada Pav in Pimple Saudagar, Pune | MarketMind AI');
  });

  it('rejects an empty name', () => {
    expect(() => pageMeta({ page_type: 'dish_locality', dish: '  ', locality: 'Wakad' })).toThrow(RangeError);
    expect(() => pageMeta({ page_type: 'place', name: '', locality: 'Wakad' })).toThrow(RangeError);
  });

  it('does not treat braces or dollar signs in a name as template syntax', () => {
    const m = pageMeta({ page_type: 'place', name: 'Example {Locality} $& Cafe', locality: 'Wakad' });
    expect(m.title).toBe('Example {Locality} $& Cafe in Wakad, Pune | MarketMind AI');
  });

  it('rejects the admin host and an unknown page type at run time', () => {
    expect(() => pageMeta({ page_type: 'home', host: 'admin' } as unknown as PageMetaInput)).toThrow(
      RangeError,
    );
    expect(() => pageMeta({ page_type: 'nope' } as unknown as PageMetaInput)).toThrow(RangeError);
    expect(() => pageMeta({ page_type: 'ask', host: 'main' } as unknown as PageMetaInput)).toThrow(
      RangeError,
    );
  });

  it('rejects an empty description on a page that supplies its own', () => {
    expect(() => pageMeta({ page_type: 'legal', name: 'Terms of Use', description: ' ' })).toThrow(
      RangeError,
    );
  });
});
