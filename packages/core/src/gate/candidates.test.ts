import { describe, expect, it } from 'vitest';
import { PageCandidateSchema } from '../schema/index.ts';
import type { CatalogueSnapshot, PageCandidate } from '../schema/index.ts';
import { enumerateCandidates } from './candidates.ts';
import { NOW, exampleSnapshot, makeDish, makeLocality, uuid } from './fixtures.ts';
import { canonicalJson } from './hash.ts';

const all = enumerateCandidates(exampleSnapshot(), NOW);
/** Plain code-unit order, the order the enumerator uses ('-' sorts before '/'). */
const sorted = (xs: string[]): string[] => [...xs].sort();
const keyOf = (c: PageCandidate) => `${c.host}:${c.page_type}`;
const urls = (key: string) => all.filter((c) => keyOf(c) === key).map((c) => c.url);
const find = (host: string, url: string): PageCandidate => {
  const c = all.find((x) => x.host === host && x.url === url);
  if (!c) throw new Error(`no candidate ${host} ${url}`);
  return c;
};

describe('enumerateCandidates: shape', () => {
  it('returns valid PageCandidates only, all English, with root-relative lowercase URLs and a trailing slash', () => {
    for (const c of all) {
      expect(() => PageCandidateSchema.parse(c), c.url).not.toThrow();
      expect(c.locale).toBe('en');
      expect(c.url).toMatch(/^\/(?:[a-z0-9-]+\/)*$/);
      for (const v of Object.values(c.seo_inputs)) expect(v).toBeGreaterThanOrEqual(0);
      for (const v of Object.values(c.seo_inputs)) expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('has no two pages at the same host and URL', () => {
    const keys = all.map((c) => `${c.host} ${c.url}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is sorted by host, then URL', () => {
    const sorted = [...all].sort((a, b) => (a.host + a.url < b.host + b.url ? -1 : 1));
    expect(all.map((c) => c.host + c.url)).toEqual(sorted.map((c) => c.host + c.url));
  });

  it('does not depend on the order of the snapshot arrays', () => {
    const s = exampleSnapshot();
    const reversed: CatalogueSnapshot = {
      ...s,
      localities: [...s.localities].reverse(),
      dishes: [...s.dishes].reverse(),
      services: [...s.services].reverse(),
      cost_models: [...s.cost_models].reverse(),
      locality_guides: [...s.locality_guides].reverse(),
      places: [...s.places].reverse(),
      providers: [...s.providers].reverse(),
      evidence: [...s.evidence].reverse(),
      experiences: [...s.experiences].reverse(),
      demand: [...s.demand].reverse(),
      quote_stats: [...s.quote_stats].reverse(),
    };
    expect(canonicalJson(enumerateCandidates(reversed, NOW))).toBe(canonicalJson(all));
  });

  it('refuses two pages at one URL, which Astro could not route', () => {
    const s = exampleSnapshot();
    s.dishes.push(makeDish('wakad')); // /pune/wakad/ is the food locality hub and would also be a dish page
    const first = s.places[0]!;
    first.dishes.push({ ...first.dishes[0]!, dish_id: 'wakad' });
    expect(() => enumerateCandidates(s, NOW)).toThrow(/duplicate page .*\/pune\/wakad\//);
  });

  it('gives an empty catalogue just the home page of the root domain', () => {
    const empty: CatalogueSnapshot = {
      ...exampleSnapshot(),
      localities: [],
      dishes: [],
      services: [],
      cost_models: [],
      locality_guides: [],
      places: [],
      providers: [],
      evidence: [],
      experiences: [],
      demand: [],
      quote_stats: [],
    };
    expect(enumerateCandidates(empty, NOW).map((c) => `${c.host}${c.url}`)).toEqual(['main/']);
  });
});

describe('enumerateCandidates: construction', () => {
  it('lists a cost guide for every service, a contractors page where a provider serves it, and local pages where there is data', () => {
    expect(urls('construction:service_cost')).toEqual([
      '/pune/painting-cost/',
      '/pune/terrace-waterproofing-cost/',
      '/pune/waterproofing-cost/',
    ]);
    expect(urls('construction:service_city')).toEqual([
      '/pune/terrace-waterproofing/',
      '/pune/waterproofing/',
    ]);
    expect(urls('construction:locality_hub')).toEqual(['/pune/hinjewadi/', '/pune/wakad/']);
    expect(urls('construction:locality_service')).toEqual([
      '/pune/hinjewadi/painting/',
      '/pune/hinjewadi/terrace-waterproofing/',
      '/pune/hinjewadi/waterproofing/',
      '/pune/wakad/painting/',
      '/pune/wakad/terrace-waterproofing/',
      '/pune/wakad/waterproofing/',
    ]);
  });

  describe('service_cost', () => {
    const c = find('construction', '/pune/terrace-waterproofing-cost/');

    it('counts the models and the independent publishers behind them', () => {
      expect(c.parent_url).toBe('/pune/');
      expect(c.entity_count).toBe(2);
      expect(c.extra).toEqual({ sources: 2, models: 2 });
      expect(c.relevance).toBe(1);
    });

    it('asks for review of the service and of every model on the page', () => {
      expect(c.prose_keys).toEqual([
        'cost_model:tw-premium',
        'cost_model:tw-standard',
        'service:terrace-waterproofing',
      ]);
    });

    it('lets a parent service aggregate its sub-services models', () => {
      const parent = find('construction', '/pune/waterproofing-cost/');
      expect(parent.entity_count).toBe(3);
      expect(parent.prose_keys).toContain('cost_model:tw-standard');
      expect(parent.prose_keys).toContain('service:waterproofing');
    });

    it('is not a candidate for review when its prose is a draft, but still a candidate', () => {
      const painting = find('construction', '/pune/painting-cost/');
      expect(painting.prose_keys).toEqual(['cost_model:painting-standard', 'service:painting']);
    });

    it('builds its text from the service guidance, not from template sentences', () => {
      expect(c.main_text).toContain('Which terrace-waterproofing warranty do you give in writing?');
      expect(c.main_text).not.toMatch(/MarketMind/i);
    });

    it('scores a city-wide page as not locality-specific', () => {
      expect(c.seo_inputs.locality_specificity).toBe(0);
      expect(c.seo_inputs.demand).toBeCloseTo(0.8, 6); // the demand row 8 of a maximum 10
    });
  });

  describe('locality_service', () => {
    const c = find('construction', '/pune/hinjewadi/terrace-waterproofing/');

    it('counts local substance: facts, providers, quotes and sourced factors', () => {
      expect(c.parent_url).toBe('/pune/hinjewadi/');
      expect(c.extra).toEqual({ local_facts: 3, providers: 2, quotes: 4, factor_sources: 2 });
      expect(c.entity_count).toBe(2);
      expect(c.entity_ids).toEqual([uuid(0x501), uuid(0x502)]);
      expect(c.relevance).toBe(1);
    });

    it('does not count a default (1.0) locality factor as substance', () => {
      const wakad = find('construction', '/pune/wakad/terrace-waterproofing/');
      expect(wakad.extra['factor_sources']).toBe(0);
      expect(wakad.extra['providers']).toBe(1); // only Example Terrace Seal Works lists Wakad
      expect(wakad.extra['local_facts']).toBe(0);
    });

    it('uses only the facts tagged for this exact service', () => {
      expect(find('construction', '/pune/hinjewadi/waterproofing/').extra['local_facts']).toBe(1);
      expect(find('construction', '/pune/hinjewadi/painting/').extra['local_facts']).toBe(1);
    });

    it('reviews the locality facts and the service, and puts facts and provider names in the text', () => {
      expect(c.prose_keys).toEqual(['locality:hinjewadi:facts', 'service:terrace-waterproofing']);
      expect(c.main_text).toContain('written approval before terrace work starts');
      expect(c.main_text).toContain('Example Terrace Seal Works');
    });

    it('is locality-specific and carries its demand', () => {
      expect(c.seo_inputs.locality_specificity).toBe(1);
      expect(c.seo_inputs.demand).toBeCloseTo(0.8, 6);
    });
  });

  it('gives a locality hub its facts and the providers that serve it', () => {
    const hub = find('construction', '/pune/hinjewadi/');
    expect(hub.parent_url).toBe('/pune/');
    expect(hub.prose_keys).toEqual(['locality:hinjewadi:facts']);
    expect(hub.entity_count).toBe(2);
  });

  it('gives a contractors page the providers of the service, with their evidence', () => {
    const page = find('construction', '/pune/terrace-waterproofing/');
    expect(page.entity_count).toBe(2);
    expect(page.evidence_count).toBe(2);
    expect(find('construction', '/pune/waterproofing/').entity_count).toBe(2); // pv2 offers a sub-service
  });
});

describe('enumerateCandidates: food', () => {
  it('lists the dish and locality pages the example places support', () => {
    expect(urls('food:dish_city')).toEqual(['/pune/biryani/', '/pune/misal-pav/']);
    expect(urls('food:locality_hub')).toEqual(
      sorted(['/pune/baner/', '/pune/hinjewadi/', '/pune/hinjewadi-phase-1/', '/pune/wakad/']),
    );
    expect(urls('food:dish_locality')).toEqual(
      sorted([
        '/pune/baner/misal-pav/',
        '/pune/hinjewadi/biryani/',
        '/pune/hinjewadi-phase-1/biryani/',
        '/pune/wakad/biryani/',
      ]),
    );
    expect(urls('food:locality_food_intent')).toEqual(
      sorted([
        '/pune/baner/budget-food/',
        '/pune/baner/veg-food/',
        '/pune/hinjewadi/budget-food/',
        '/pune/hinjewadi/late-night-food/',
        '/pune/hinjewadi/veg-food/',
        '/pune/hinjewadi-phase-1/budget-food/',
        '/pune/hinjewadi-phase-1/veg-food/',
        '/pune/wakad/budget-food/',
      ]),
    );
  });

  describe('dish_locality counts places in the whole locality subtree with grounded, independent evidence', () => {
    const c = find('food', '/pune/hinjewadi/biryani/');

    it('includes the sub-locality place and counts every claim row', () => {
      expect(c.parent_url).toBe('/pune/hinjewadi/');
      expect(c.entity_count).toBe(4); // Phase 1 counts towards Hinjewadi
      expect(c.entity_ids).toEqual([1, 2, 3, 4].map(uuid));
      expect(c.evidence_count).toBe(8);
      expect(c.relevance).toBe(1);
    });

    it('does not count a place with a single publisher and no first-hand visit', () => {
      const baner = find('food', '/pune/baner/misal-pav/');
      expect(baner.entity_count).toBe(0);
      expect(baner.relevance).toBe(0);
    });

    it('counts a first-hand visit as enough on its own', () => {
      const s = exampleSnapshot();
      const baner = s.places.find((p) => p.locality_id === 'baner')!;
      s.experiences.push({ ...s.experiences[0]!, id: uuid(0x901), business_id: baner.id, dishes: [] });
      const c2 = enumerateCandidates(s, NOW).find((x) => x.url === '/pune/baner/misal-pav/')!;
      expect(c2.entity_count).toBe(1);
    });

    it('ignores evidence that is expired, superseded or from an aggregator', () => {
      const s = exampleSnapshot();
      for (const e of s.evidence) {
        if (e.entity_id === uuid(3)) e.status = 'superseded';
        if (e.entity_id === uuid(2)) e.source = { ...e.source, kind: 'aggregator' };
        if (e.entity_id === uuid(1)) e.retrieved_at = '2026-01-01T00:00:00.000Z'; // HOT rows expire after 14 days
      }
      const c2 = enumerateCandidates(s, NOW).find((x) => x.url === '/pune/hinjewadi/biryani/')!;
      // Place 3 has only a superseded row, place 2 only an aggregator's (no independent source), and place 1 has a
      // first-hand visit but every row expired, so it is not grounded. Only place 4 is left.
      expect(c2.entity_ids).toEqual([uuid(4)]);
    });

    it('builds its text from the places, their quotes and their visit notes', () => {
      expect(c.main_text).toContain('Example Biryani House');
      expect(c.main_text).toContain('regulars order the biryani at Example Spice Table');
      expect(c.main_text).toContain('the dum seal was opened at the table');
    });
  });

  it('counts the localities a dish page spans, with sub-localities rolled up to their parent', () => {
    const c = find('food', '/pune/biryani/');
    expect(c.entity_count).toBe(5);
    expect(c.evidence_count).toBe(10);
    expect(c.extra).toEqual({ localities: 2 }); // hinjewadi (with phase 1) and wakad
    expect(c.parent_url).toBe('/pune/');
    expect(c.seo_inputs.locality_specificity).toBe(0);
  });

  it('counts food-hub places that have any live evidence', () => {
    const hub = find('food', '/pune/hinjewadi/');
    expect(hub.entity_count).toBe(4);
    expect(hub.parent_url).toBe('/pune/');
  });

  describe('intent pages', () => {
    it('lists only the intents some qualifying place can prove', () => {
      const intents = urls('food:food_intent').filter((u) => u.startsWith('/pune/hinjewadi/biryani/'));
      expect(intents).toEqual([
        '/pune/hinjewadi/biryani/family/',
        '/pune/hinjewadi/biryani/late-night/',
        '/pune/hinjewadi/biryani/office-lunch/',
        '/pune/hinjewadi/biryani/under-250/',
        '/pune/hinjewadi/biryani/under-400/',
        '/pune/hinjewadi/biryani/veg/',
      ]);
      expect(urls('food:food_intent').some((u) => u.includes('/baner/'))).toBe(false);
    });

    it('counts places and proofs for a price band (a dated price within the band)', () => {
      const c = find('food', '/pune/hinjewadi/biryani/under-400/');
      expect(c.parent_url).toBe('/pune/hinjewadi/biryani/');
      expect(c.entity_count).toBe(4);
      expect(c.evidence_count).toBe(4);
      expect(find('food', '/pune/hinjewadi/biryani/under-250/').entity_count).toBe(2);
    });

    it('proves veg by the diet flag, family and office-lunch by tags, late-night by verified hours past 23:00', () => {
      expect(find('food', '/pune/hinjewadi/biryani/veg/').entity_count).toBe(3);
      expect(find('food', '/pune/hinjewadi/biryani/family/').entity_count).toBe(3);
      expect(find('food', '/pune/hinjewadi/biryani/office-lunch/').entity_count).toBe(1);
      const late = find('food', '/pune/hinjewadi/biryani/late-night/');
      expect(late.entity_count).toBe(1);
      expect(late.evidence_count).toBe(1); // one live hours row
    });

    it('proves locality intents the same way', () => {
      expect(find('food', '/pune/hinjewadi/late-night-food/').entity_count).toBe(1);
      expect(find('food', '/pune/hinjewadi/veg-food/').entity_count).toBe(3);
      expect(find('food', '/pune/hinjewadi/budget-food/').entity_count).toBe(4);
    });
  });
});

describe('enumerateCandidates: the root domain', () => {
  it('has a home page and one guide per locality guide', () => {
    expect(urls('main:home')).toEqual(['/']);
    expect(urls('main:locality_guide')).toEqual(['/pune/baner/', '/pune/hinjewadi/', '/pune/wakad/']);
  });

  it('counts the words of the guide, not its markdown, and asks for the guide to be reviewed', () => {
    const g = find('main', '/pune/hinjewadi/');
    expect(g.extra).toEqual({ words: 451 }); // 450 words and the heading
    expect(g.prose_keys).toEqual(['locality:hinjewadi:guide']);
    expect(g.parent_url).toBe('/pune/');
    expect(g.main_text).toContain('hin449');
    expect(find('main', '/pune/wakad/').extra).toEqual({ words: 121 });
  });

  it('does not count link targets as words', () => {
    const s = exampleSnapshot();
    s.locality_guides[0]!.body_md = 'Read [the map](https://example.com/very/long/path/here) now';
    const g = enumerateCandidates(s, NOW).find((c) => c.host === 'main' && c.url === '/pune/hinjewadi/')!;
    expect(g.extra['words']).toBe(4);
  });
});

describe('data_inputs and the content hash inputs', () => {
  it('are identical for identical snapshots', () => {
    expect(canonicalJson(enumerateCandidates(exampleSnapshot(), NOW).map((c) => c.data_inputs))).toBe(
      canonicalJson(all.map((c) => c.data_inputs)),
    );
  });

  it('change when a displayed value changes', () => {
    const s = exampleSnapshot();
    s.cost_models.find((m) => m.id === 'tw-standard')!.rate_inr.expected = 56;
    const changed = enumerateCandidates(s, NOW).find((c) => c.url === '/pune/terrace-waterproofing-cost/')!;
    expect(canonicalJson(changed.data_inputs)).not.toBe(
      canonicalJson(find('construction', '/pune/terrace-waterproofing-cost/').data_inputs),
    );
    // the sibling guide for painting does not move
    const painting = enumerateCandidates(s, NOW).find((c) => c.url === '/pune/painting-cost/')!;
    expect(canonicalJson(painting.data_inputs)).toBe(
      canonicalJson(find('construction', '/pune/painting-cost/').data_inputs),
    );
  });

  it('do not change with paid placements, founding slots or the review state of prose', () => {
    const s = exampleSnapshot();
    s.campaigns.push({
      id: uuid(0x700),
      kind: 'banner',
      advertiser_name: 'Example Advertiser',
      target_locality: 'hinjewadi',
      target_category: null,
      creative: { text: 'Example ad', url: 'https://example.com/ad', image: null },
      starts_on: '2026-10-01',
      ends_on: '2026-12-01',
    });
    s.featured.push({
      business_id: s.providers[0]!.id,
      tier: 'featured',
      locality_ids: ['hinjewadi'],
      category_ids: [],
      starts_on: '2026-10-01',
      ends_on: '2026-12-01',
    });
    s.founding_slots.push({ service_id: 'terrace-waterproofing', locality_id: 'hinjewadi', remaining: 2 });
    s.cost_models.find((m) => m.id === 'painting-standard')!.status = 'reviewed';
    const after = enumerateCandidates(s, NOW);
    expect(canonicalJson(after.map((c) => c.data_inputs))).toBe(canonicalJson(all.map((c) => c.data_inputs)));
  });
});

describe('a locality that is only a name', () => {
  it('has no pages', () => {
    const s = exampleSnapshot();
    s.localities.push(makeLocality('kharadi'));
    expect(enumerateCandidates(s, NOW).some((c) => c.url.includes('kharadi'))).toBe(false);
  });
});
