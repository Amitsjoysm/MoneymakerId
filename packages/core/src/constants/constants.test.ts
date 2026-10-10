import { describe, expect, it } from 'vitest';
import {
  AD_LABEL,
  AFFILIATE_DISCLOSURE,
  ALL_SERVICE_IDS,
  CLAIM_TIER,
  CITY_ID,
  CONSENT_VERSIONS,
  COST_DISCLAIMER,
  DESC,
  DISH_IDS,
  FEATURED_DISCLOSURE,
  FOOD_WEIGHTS,
  HOT_BANDS,
  HOT_WEIGHTS,
  LEAF_SERVICE_IDS,
  LEAD_CONSENT_V1,
  LOCALITY_IDS,
  MIN_LABEL_EVIDENCE,
  NEVER_ADS,
  PRIORITY_LOCALITY_IDS,
  PROVIDER_WEIGHTS,
  REMINDER_CONSENT_V1,
  RESERVED_SLUGS,
  SEO_WEIGHTS,
  SERVICE_TREE,
  SUB_LOCALITY_IDS,
  TIER_TTL_DAYS,
  TITLE,
  TOP_LEVEL_SERVICE_IDS,
  isReservedSlug,
} from './index.ts';

const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

describe('§8a weight sets', () => {
  it('are exactly the contract literals', () => {
    expect(FOOD_WEIGHTS).toEqual({
      relevance: 0.2,
      rating_strength: 0.2,
      review_strength: 0.15,
      dish_evidence: 0.15,
      freshness: 0.1,
      value: 0.1,
      locality_match: 0.1,
    });
    expect(PROVIDER_WEIGHTS).toEqual({
      service_match: 0.25,
      locality_match: 0.15,
      specialization: 0.15,
      review_strength: 0.15,
      verification: 0.15,
      freshness: 0.1,
      experience: 0.05,
    });
    expect(HOT_WEIGHTS).toEqual({
      recent_mentions: 0.25,
      freshness: 0.2,
      demand_signal: 0.2,
      engagement: 0.15,
      quality: 0.2,
    });
    expect(SEO_WEIGHTS).toEqual({
      demand: 0.2,
      data_quality: 0.25,
      locality_specificity: 0.2,
      commercial_intent: 0.15,
      content_depth: 0.1,
      freshness: 0.1,
    });
  });

  it.each([
    ['FOOD_WEIGHTS', FOOD_WEIGHTS],
    ['PROVIDER_WEIGHTS', PROVIDER_WEIGHTS],
    ['HOT_WEIGHTS', HOT_WEIGHTS],
    ['SEO_WEIGHTS', SEO_WEIGHTS],
  ])('%s sums to 1', (_name, weights) => {
    expect(sum(weights)).toBeCloseTo(1, 10);
  });

  it('are frozen so no consumer can mutate a shared literal', () => {
    expect(Object.isFrozen(FOOD_WEIGHTS)).toBe(true);
    expect(Object.isFrozen(HOT_BANDS)).toBe(true);
    expect(Object.isFrozen(HOT_BANDS[0])).toBe(true);
    expect(Object.isFrozen(TITLE.food)).toBe(true);
  });
});

describe('HOT_BANDS', () => {
  it('matches the contract and runs from high to low', () => {
    expect(HOT_BANDS).toEqual([
      [0.8, 'hot'],
      [0.65, 'trending'],
      [0.5, 'warm'],
      [0.35, null],
      [0.0, 'cold'],
    ]);
    const thresholds = HOT_BANDS.map(([t]) => t);
    expect(thresholds).toEqual([...thresholds].sort((a, b) => b - a));
  });
});

describe('freshness constants', () => {
  it('MIN_LABEL_EVIDENCE is 3', () => {
    expect(MIN_LABEL_EVIDENCE).toBe(3);
  });

  it('CLAIM_TIER matches the contract', () => {
    expect(CLAIM_TIER).toEqual({
      price: 'HOT',
      hours: 'HOT',
      offer: 'HOT',
      availability: 'HOT',
      dish: 'WARM',
      service: 'WARM',
      phone: 'WARM',
      rating: 'WARM',
      mention: 'WARM',
      address: 'COLD',
      locality_fact: 'COLD',
      cost_rate: 'COST',
    });
  });

  it('TIER_TTL_DAYS matches the contract', () => {
    expect(TIER_TTL_DAYS).toEqual({ HOT: 14, WARM: 60, COLD: 365, COST: 180 });
  });
});

describe('title and description templates (spec §38, §39)', () => {
  it('match the contract text exactly', () => {
    expect(TITLE.food.dish_locality).toBe('Best {Dish} in {Locality}, Pune | MarketMind AI');
    expect(TITLE.construction.locality_service).toBe('{Service} Cost in {Locality}, Pune | MarketMind AI');
    expect(TITLE.construction.service_cost).toBe('{Service} Cost in Pune | MarketMind AI');
    expect(TITLE.construction.service_cost_per_sqft).toBe('{Service} Cost per Sq Ft in Pune | MarketMind AI');
    expect(DESC.food).toBe(
      'Discover highly rated {dish} options in {locality}, Pune. Compare price, location, freshness and our latest recommendations.',
    );
    expect(DESC.construction).toBe(
      'Estimate {service} costs in {locality}, Pune, understand pricing factors and find local providers for quotes.',
    );
  });
});

describe('disclosures (spec §86) and consent texts', () => {
  it('disclosures match the spec text', () => {
    expect(FEATURED_DISCLOSURE).toBe('Featured placement is paid.');
    expect(AD_LABEL).toBe('Advertisement');
    expect(AFFILIATE_DISCLOSURE).toBe('We may receive a commission from some links.');
    expect(COST_DISCLAIMER).toBe('Cost estimates are indicative and should not be treated as quotations.');
  });

  it('LEAD_CONSENT_V1 carries a version id and the plan text', () => {
    expect(LEAD_CONSENT_V1).toEqual({
      id: 'lead-consent-v1',
      text: 'Share my details with up to 3 verified contractors and let MarketMind AI contact me on WhatsApp/phone about this request',
    });
  });

  it('REMINDER_CONSENT_V1 has its own version id, and never mentions sharing with contractors', () => {
    expect(REMINDER_CONSENT_V1.id).toBe('reminder-consent-v1');
    expect(REMINDER_CONSENT_V1.text).toMatch(/monsoon/i);
    expect(REMINDER_CONSENT_V1.text).not.toMatch(/contractor/i);
    expect(REMINDER_CONSENT_V1.id).not.toBe(LEAD_CONSENT_V1.id);
  });

  it('CONSENT_VERSIONS lists every consent by id', () => {
    expect(CONSENT_VERSIONS).toEqual({
      'lead-consent-v1': LEAD_CONSENT_V1,
      'reminder-consent-v1': REMINDER_CONSENT_V1,
    });
  });
});

describe('NEVER_ADS', () => {
  it('matches the contract', () => {
    expect([...NEVER_ADS]).toEqual([
      'get_quotes',
      'for_contractors',
      'ask',
      'legal',
      'business',
      'contact',
      'not_found',
      'thank_you',
    ]);
  });
});

describe('fixed reference IDs (§4a)', () => {
  it('has 20 localities, 3 sub-localities and 8 priority localities', () => {
    expect(CITY_ID).toBe('pune');
    expect(LOCALITY_IDS).toHaveLength(20);
    expect(new Set(LOCALITY_IDS).size).toBe(20);
    expect(SUB_LOCALITY_IDS).toEqual(['hinjewadi-phase-1', 'hinjewadi-phase-2', 'hinjewadi-phase-3']);
    expect(PRIORITY_LOCALITY_IDS).toEqual([
      'hinjewadi',
      'wakad',
      'baner',
      'kharadi',
      'hadapsar',
      'wagholi',
      'pimple-saudagar',
      'kothrud',
    ]);
    for (const id of PRIORITY_LOCALITY_IDS) expect(LOCALITY_IDS).toContain(id);
  });

  it('has 16 parent dishes', () => {
    expect(DISH_IDS).toHaveLength(16);
    expect(new Set(DISH_IDS).size).toBe(16);
  });

  it('has 5 top-level services, 12 service ids and 10 leaf services', () => {
    expect(TOP_LEVEL_SERVICE_IDS).toEqual([
      'waterproofing',
      'painting',
      'bathroom-renovation',
      'modular-kitchen',
      'house-construction',
    ]);
    expect(SERVICE_TREE.waterproofing).toEqual([
      'terrace-waterproofing',
      'bathroom-waterproofing',
      'external-wall-waterproofing',
      'basement-waterproofing',
      'leakage-repair',
    ]);
    expect(SERVICE_TREE.painting).toEqual(['interior-painting', 'exterior-painting']);
    expect(ALL_SERVICE_IDS).toHaveLength(12);
    expect(LEAF_SERVICE_IDS).toHaveLength(10);
    expect(LEAF_SERVICE_IDS).not.toContain('waterproofing');
    expect(LEAF_SERVICE_IDS).not.toContain('painting');
  });

  it('never uses a reserved slug as a locality, dish or service id', () => {
    for (const id of [...LOCALITY_IDS, ...SUB_LOCALITY_IDS, ...DISH_IDS, ...ALL_SERVICE_IDS]) {
      expect(isReservedSlug(id), id).toBe(false);
    }
  });
});

describe('reserved slugs (§4a)', () => {
  it('lists the exact reserved words', () => {
    expect([...RESERVED_SLUGS].sort()).toEqual(
      [
        'late-night-food',
        'budget-food',
        'veg-food',
        'veg',
        'late-night',
        'family',
        'office-lunch',
        'ask',
        'about',
        'api',
        'mr',
        'hi',
        'ui-fixtures',
      ].sort(),
    );
  });

  it.each(['veg', 'late-night-food', 'under-250', 'under-100', 'terrace-waterproofing-cost', 'x-cost', 'api', 'mr', 'hi'])(
    '%s is reserved',
    (slug) => {
      expect(isReservedSlug(slug)).toBe(true);
    },
  );

  it.each(['biryani', 'hinjewadi', 'costco', 'underpass', 'vegan', 'hindi'])('%s is not reserved', (slug) => {
    expect(isReservedSlug(slug)).toBe(false);
  });
});
