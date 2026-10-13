import { describe, expect, it } from 'vitest';
import { FoodIntentSchema } from '../schema/index.ts';
import type { CatalogueSnapshot, EvidenceView, PageCandidate } from '../schema/index.ts';
import { enumerateCandidates } from './candidates.ts';
import { NOW, exampleSnapshot, makeEvidence, makeLocality, uuid } from './fixtures.ts';
import { BUDGET_FOOD_MAX_INR, DISH_INTENTS } from './food.ts';

const pages = (s: CatalogueSnapshot): PageCandidate[] => enumerateCandidates(s, NOW);
const find = (s: CatalogueSnapshot, host: string, url: string): PageCandidate | undefined =>
  pages(s).find((c) => c.host === host && c.url === url);
const row = (s: CatalogueSnapshot, place: number, type: string): EvidenceView =>
  s.evidence.find((e) => e.entity_id === uuid(place) && e.claim_type === type)!;
const setPrice = (s: CatalogueSnapshot, place: number, price_inr: number): void => {
  const r = row(s, place, 'price');
  if (!('price' in r.claim)) throw new Error('not a price row');
  r.claim = { price: { ...r.claim.price, price_inr } };
};
const setHours = (s: CatalogueSnapshot, close: string, open = '18:00'): void => {
  row(s, 4, 'hours').claim = { hours: { fri: [[open, close]] } };
};
const LATE = '/pune/hinjewadi/biryani/late-night/';

describe('late-night proof: verified hours past 23:00', () => {
  it('counts a closing time after 23:00, midnight and a wrap past midnight', () => {
    for (const close of ['23:30', '24:00', '00:30', '01:00']) {
      const s = exampleSnapshot();
      setHours(s, close);
      expect(find(s, 'food', LATE)?.entity_count, close).toBe(1);
    }
  });

  it('does not count a closing time of 23:00 or earlier', () => {
    for (const close of ['23:00', '22:30', '21:00']) {
      const s = exampleSnapshot();
      setHours(s, close);
      expect(find(s, 'food', LATE), close).toBeUndefined();
    }
  });

  it('needs a live hours row: hours on the place alone are not verified', () => {
    const s = exampleSnapshot();
    s.evidence = s.evidence.filter((e) => e !== row(s, 4, 'hours'));
    expect(find(s, 'food', LATE)).toBeUndefined();
    expect(find(s, 'food', '/pune/hinjewadi/late-night-food/')).toBeUndefined();
  });

  it('drops an expired hours row', () => {
    const s = exampleSnapshot();
    row(s, 4, 'hours').retrieved_at = '2026-08-01T00:00:00.000Z';
    expect(find(s, 'food', LATE)).toBeUndefined();
  });
});

describe('price proof: a dated price at or below the band', () => {
  it('counts a price equal to the band and not one rupee above it', () => {
    const at = exampleSnapshot();
    setPrice(at, 1, 250);
    expect(find(at, 'food', '/pune/hinjewadi/biryani/under-250/')?.entity_count).toBe(2);
    const over = exampleSnapshot();
    setPrice(over, 1, 251);
    expect(find(over, 'food', '/pune/hinjewadi/biryani/under-250/')?.entity_count).toBe(1);
  });

  it('lists no band that no place can prove', () => {
    const s = exampleSnapshot();
    expect(find(s, 'food', '/pune/hinjewadi/biryani/under-150/')).toBeUndefined();
    for (const n of [1, 2, 3, 4]) setPrice(s, n, 100);
    expect(find(s, 'food', '/pune/hinjewadi/biryani/under-150/')?.entity_count).toBe(4);
  });

  it('proves budget food on a locality page up to BUDGET_FOOD_MAX_INR, for any dish', () => {
    const s = exampleSnapshot();
    setPrice(s, 4, BUDGET_FOOD_MAX_INR);
    expect(find(s, 'food', '/pune/hinjewadi/budget-food/')?.entity_count).toBe(4);
    setPrice(s, 4, BUDGET_FOOD_MAX_INR + 1);
    expect(find(s, 'food', '/pune/hinjewadi/budget-food/')?.entity_count).toBe(3);
  });
});

describe('grounding: first-hand visit or two independent publishers', () => {
  const link = (url: string | null, publisher: string | null = null): EvidenceView['source'] => ({
    kind: 'article',
    url,
    title: null,
    publisher,
    experience_id: null,
  });
  const place2 = (s: CatalogueSnapshot, sources: EvidenceView['source'][]): void => {
    s.evidence
      .filter((e) => e.entity_id === uuid(2))
      .forEach((e, i) => (e.source = sources[i % sources.length]!));
  };
  const qualifying = (s: CatalogueSnapshot): string[] =>
    find(s, 'food', '/pune/hinjewadi/biryani/')!.entity_ids;

  it('falls back to the host of the URL when a source names no publisher', () => {
    const same = exampleSnapshot();
    place2(same, [link('https://www.example.org/a'), link('https://example.org/b')]);
    expect(qualifying(same)).not.toContain(uuid(2));
    const different = exampleSnapshot();
    place2(different, [link('https://www.example.org/a'), link('https://example.net/b')]);
    expect(qualifying(different)).toContain(uuid(2));
  });

  it('treats the same publisher written two ways as one', () => {
    const s = exampleSnapshot();
    place2(s, [
      link('https://example.org/a', 'Example Times'),
      link('https://example.org/b', ' example times '),
    ]);
    expect(qualifying(s)).not.toContain(uuid(2));
  });

  it('counts a first-hand evidence row as a visit', () => {
    const s = exampleSnapshot();
    const first = s.evidence.find((e) => e.entity_id === uuid(6))!;
    first.source = { kind: 'first_hand', url: null, title: null, publisher: null, experience_id: null };
    expect(find(s, 'food', '/pune/baner/misal-pav/')?.entity_count).toBe(1);
  });
});

describe('what is enumerated', () => {
  it('rolls a landmark up to its parent locality and gives it pages of its own', () => {
    const s = exampleSnapshot();
    s.localities.push(makeLocality('near-example-park', { kind: 'landmark', parent_id: 'hinjewadi' }));
    s.places.find((p) => p.id === uuid(3))!.locality_id = 'near-example-park';
    const landmark = find(s, 'food', '/pune/near-example-park/biryani/');
    expect(landmark?.entity_ids).toEqual([uuid(3)]);
    expect(landmark?.parent_url).toBe('/pune/near-example-park/');
    expect(find(s, 'food', '/pune/hinjewadi/biryani/')?.entity_count).toBe(4); // still counts towards Hinjewadi
  });

  it('has no page for a dish or a locality that is not in the catalogue', () => {
    const s = exampleSnapshot();
    const place = s.places.find((p) => p.id === uuid(6))!;
    place.dishes.push({ ...place.dishes[0]!, dish_id: 'ghost-dish' });
    s.places.push({ ...place, id: uuid(77), slug: 'example-elsewhere', locality_id: 'elsewhere' });
    s.locality_guides.push({ ...s.locality_guides[0]!, locality_id: 'elsewhere' });
    const urls = pages(s).map((c) => c.url);
    expect(urls.some((u) => u.includes('ghost-dish') || u.includes('elsewhere'))).toBe(false);
  });

  it('ignores aggregator evidence on a hub page', () => {
    const s = exampleSnapshot();
    for (const e of s.evidence.filter((x) => x.entity_id === uuid(6))) {
      e.source = { ...e.source, kind: 'aggregator' };
    }
    expect(find(s, 'food', '/pune/baner/')?.entity_count).toBe(0);
  });

  it('gives a locality with only a quote summary its construction pages', () => {
    const s = exampleSnapshot();
    expect(find(s, 'construction', '/pune/baner/painting/')).toBeUndefined();
    s.quote_stats.push({ service_id: 'painting', locality_id: 'baner', n: 3, low: 1000, high: 2000 });
    expect(find(s, 'construction', '/pune/baner/painting/')?.extra['quotes']).toBe(3);
    expect(find(s, 'construction', '/pune/baner/')).toBeDefined();
  });

  it('has no contractors page for a service nobody offers', () => {
    expect(find(exampleSnapshot(), 'construction', '/pune/painting/')).toBeUndefined();
  });

  it('puts the evidence a page rests on in its data inputs, so a new quote changes the hash input', () => {
    const s = exampleSnapshot();
    const before = JSON.stringify(find(s, 'food', '/pune/hinjewadi/biryani/')!.data_inputs);
    row(s, 3, 'dish').supporting_quote = 'Example review line: a changed opinion about the biryani.';
    expect(JSON.stringify(find(s, 'food', '/pune/hinjewadi/biryani/')!.data_inputs)).not.toBe(before);
  });

  it('adds a fresh row for an unrelated claim without moving a dish page that does not show it', () => {
    const s = exampleSnapshot();
    const before = JSON.stringify(find(s, 'food', '/pune/hinjewadi/biryani/')!.data_inputs);
    s.evidence.push(makeEvidence(uuid(3), { address: 'Example Road 3' }));
    expect(JSON.stringify(find(s, 'food', '/pune/hinjewadi/biryani/')!.data_inputs)).toBe(before);
  });
});

// Plan §5 path (b): "at least 2 providers serving the locality with evidence". A provider with no live evidence
// row (none at all, expired, superseded or aggregator-only) is not counted, listed or shown.
describe('providers count only with live evidence', () => {
  const PV1 = uuid(0x501); // Example Terrace Seal Works: terrace-waterproofing + waterproofing, serves Hinjewadi and Wakad
  const PV2 = uuid(0x502); // Example Roof Care Services: terrace-waterproofing, serves its home locality Hinjewadi
  const CONTRACTORS = '/pune/terrace-waterproofing/';
  const LOCAL = '/pune/hinjewadi/terrace-waterproofing/';
  const HUB = '/pune/hinjewadi/';

  const ofProvider = (s: CatalogueSnapshot, id: string): EvidenceView[] =>
    s.evidence.filter((e) => e.entity_id === id);
  const remove = (s: CatalogueSnapshot, id: string): void => {
    s.evidence = s.evidence.filter((e) => e.entity_id !== id);
  };
  const expire = (s: CatalogueSnapshot, id: string): void => {
    for (const e of ofProvider(s, id)) e.retrieved_at = '2025-01-01T00:00:00.000Z';
  };
  const providersOn = (s: CatalogueSnapshot, url: string) => {
    const page = find(s, 'construction', url);
    return page === undefined ? undefined : [page.extra['providers'], page.entity_count, page.entity_ids];
  };

  it('counts both providers while both have live evidence (the baseline)', () => {
    const s = exampleSnapshot();
    expect(providersOn(s, CONTRACTORS)).toEqual([2, 2, [PV1, PV2]]);
    expect(providersOn(s, LOCAL)).toEqual([2, 2, [PV1, PV2]]);
    expect(find(s, 'construction', HUB)?.entity_count).toBe(2);
  });

  it('stops counting a provider once its evidence has expired, on every page that lists providers', () => {
    const s = exampleSnapshot();
    expire(s, PV1);
    expect(providersOn(s, CONTRACTORS)).toEqual([1, 1, [PV2]]);
    expect(find(s, 'construction', CONTRACTORS)?.evidence_count).toBe(1);
    expect(providersOn(s, LOCAL)).toEqual([1, 1, [PV2]]);
    expect(providersOn(s, '/pune/hinjewadi/waterproofing/')).toEqual([1, 1, [PV2]]);
    const hub = find(s, 'construction', HUB)!;
    expect(hub.entity_count).toBe(1);
    expect(hub.entity_ids).toEqual([PV2]);
    expect(find(s, 'construction', '/pune/waterproofing/')?.entity_count).toBe(1);
  });

  it('does not count, list or show a provider that has no evidence at all', () => {
    const s = exampleSnapshot();
    remove(s, PV1);
    remove(s, PV2);
    // nobody can be shown for the service, so there is no contractors page
    expect(find(s, 'construction', CONTRACTORS)).toBeUndefined();
    expect(find(s, 'construction', '/pune/waterproofing/')).toBeUndefined();
    // the locality pages remain (they have local facts) but count and name no provider
    for (const url of [LOCAL, '/pune/hinjewadi/waterproofing/', HUB]) {
      const page = find(s, 'construction', url)!;
      expect(page.extra['providers'], url).toBe(0);
      expect(page.entity_count, url).toBe(0);
      expect(page.entity_ids, url).toEqual([]);
      expect(page.main_text, url).not.toContain('Example Terrace Seal Works');
      expect(JSON.stringify(page.data_inputs), url).not.toContain(PV1);
    }
  });

  it('does not count a provider whose only evidence comes from an aggregator or has been superseded', () => {
    const aggregator = exampleSnapshot();
    for (const e of ofProvider(aggregator, PV1)) e.source = { ...e.source, kind: 'aggregator' };
    expect(providersOn(aggregator, CONTRACTORS)).toEqual([1, 1, [PV2]]);
    const superseded = exampleSnapshot();
    for (const e of ofProvider(superseded, PV2)) e.status = 'superseded';
    expect(providersOn(superseded, LOCAL)).toEqual([1, 1, [PV1]]);
  });

  it('gives a locality no pages at all when its only construction data is a provider without evidence', () => {
    const s = exampleSnapshot();
    s.localities.push(makeLocality('kothrud', {}));
    s.providers[0]!.service_localities = ['kothrud']; // Example Terrace Seal Works also serves Kothrud
    remove(s, PV1);
    remove(s, PV2);
    expect(find(s, 'construction', '/pune/kothrud/')).toBeUndefined();
    expect(find(s, 'construction', '/pune/kothrud/terrace-waterproofing/')).toBeUndefined();
  });
});

describe('dish intents are read from the schema', () => {
  // proofRows() in food.ts has a proof rule for each of these four. A new FoodIntent in the schema lands in
  // DISH_INTENTS by itself, so this fails until that intent is given a proof rule (otherwise it would be listed with no proof).
  it('are exactly the four named intents, all valid FoodIntents, and no price band', () => {
    expect([...DISH_INTENTS].sort()).toEqual(['family', 'late-night', 'office-lunch', 'veg']);
    for (const intent of DISH_INTENTS) {
      expect(FoodIntentSchema.safeParse(intent).success, intent).toBe(true);
      expect(intent.startsWith('under-')).toBe(false);
    }
  });
});
