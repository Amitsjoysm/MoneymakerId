import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLAIM_TIER } from '@mm/core/constants';
import {
  FIXTURE_NAME_PREFIX,
  isFixtureBusinessName,
  loadFixtureCatalogue,
  parseFixtureCatalogue,
} from './index.ts';

// CONTRACTS §4a.
const PRIORITY_LOCALITIES = [
  'hinjewadi',
  'wakad',
  'baner',
  'kharadi',
  'hadapsar',
  'wagholi',
  'pimple-saudagar',
  'kothrud',
];
const TOP_LEVEL_DISHES = [
  'biryani',
  'samosa',
  'vada-pav',
  'misal-pav',
  'momos',
  'dosa',
  'pizza',
  'burger',
  'poha',
];
const SERVICES = [
  'waterproofing',
  'painting',
  'bathroom-renovation',
  'modular-kitchen',
  'house-construction',
  'terrace-waterproofing',
  'bathroom-waterproofing',
  'external-wall-waterproofing',
  'basement-waterproofing',
  'leakage-repair',
  'interior-painting',
  'exterior-painting',
];

const file = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures', 'catalogue.json');

describe('isFixtureBusinessName', () => {
  it('flags names that start with "Example" as a word, case-insensitively', () => {
    expect(FIXTURE_NAME_PREFIX).toBe('Example');
    for (const name of [
      'Example Biryani House',
      'example cafe',
      'EXAMPLE Painters',
      '  Example Dosa',
      'Example',
    ]) {
      expect(isFixtureBusinessName(name), name).toBe(true);
    }
  });

  it('does not flag real-looking names that merely contain or begin with the letters', () => {
    for (const name of ['Exampleton Grill', 'The Example Cafe', 'Sample Biryani', 'Examples']) {
      expect(isFixtureBusinessName(name), name).toBe(false);
    }
  });
});

describe('fixtures/catalogue.json', () => {
  const catalogue = loadFixtureCatalogue();
  const businesses = [...catalogue.places, ...catalogue.providers];

  it('validates against the T01 schemas and has places, providers, evidence and recommendations', () => {
    expect(catalogue.places.length).toBeGreaterThanOrEqual(3);
    expect(catalogue.providers.length).toBeGreaterThanOrEqual(2);
    expect(catalogue.evidence.length).toBeGreaterThan(0);
    expect(catalogue.recommendations.length).toBeGreaterThan(0);
  });

  it('names every business "Example …" and gives it a fixture slug', () => {
    for (const b of businesses) {
      expect(b.name.startsWith(`${FIXTURE_NAME_PREFIX} `), b.name).toBe(true);
      expect(b.slug.startsWith('example-'), b.slug).toBe(true);
    }
  });

  it('keeps ids and slugs unique', () => {
    const ids = [...businesses.map((b) => b.id), ...catalogue.evidence.map((e) => e.id)];
    expect(new Set(ids).size).toBe(ids.length);
    const slugs = businesses.map((b) => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('covers 2 or 3 priority localities and 2 services, using only §4a reference ids', () => {
    const localities = new Set(businesses.map((b) => b.locality_id));
    expect(localities.size).toBeGreaterThanOrEqual(2);
    expect(localities.size).toBeLessThanOrEqual(3);
    for (const l of localities) expect(PRIORITY_LOCALITIES).toContain(l);
    const services = new Set(catalogue.providers.flatMap((p) => p.services));
    expect(services.size).toBe(2);
    for (const s of services) expect(SERVICES).toContain(s);
    for (const dish of catalogue.places.flatMap((p) => p.dishes.map((d) => d.dish_id))) {
      expect(TOP_LEVEL_DISHES).toContain(dish);
    }
  });

  it('links every priced dish to evidence that exists, and every evidence row to a source', () => {
    const evidenceIds = new Set(catalogue.evidence.map((e) => e.id));
    for (const place of catalogue.places) {
      for (const dish of place.dishes) expect(evidenceIds.has(dish.evidence_id), place.name).toBe(true);
    }
    for (const e of catalogue.evidence) {
      expect(e.source.url === null ? e.source.kind === 'first_hand' : true).toBe(true);
      expect(e.status).toBe('active');
      if (e.valid_until !== null)
        expect(Date.parse(e.valid_until)).toBeGreaterThan(Date.parse(e.retrieved_at));
    }
  });

  it('gives each evidence row the freshness tier of its claim type', () => {
    for (const e of catalogue.evidence) expect(e.tier, e.claim_type).toBe(CLAIM_TIER[e.claim_type]);
  });

  it('points recommendations and experiences at businesses that exist', () => {
    const ids = new Set(businesses.map((b) => b.id));
    for (const r of catalogue.recommendations) expect(ids.has(r.entity_id), r.page_key).toBe(true);
    const placeIds = new Set(catalogue.places.map((p) => p.id));
    for (const x of catalogue.experiences) expect(placeIds.has(x.business_id)).toBe(true);
    // ranks are 1..n within a page
    const byPage = Map.groupBy(catalogue.recommendations, (r) => r.page_key);
    for (const [page, rows] of byPage) {
      expect(
        rows.map((r) => r.rank).sort((a, b) => a - b),
        page,
      ).toEqual(rows.map((_, i) => i + 1));
    }
  });

  it("never carries MarketMind AI's WhatsApp number, any phone, or a Supabase URL", () => {
    const text = readFileSync(file, 'utf8');
    expect(text).not.toContain('919834346179');
    expect(text).not.toMatch(/"phone"|\+91\d{10}/);
    expect(text).not.toContain('supabase.co');
  });
});

describe('parseFixtureCatalogue', () => {
  const good = () => JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown[]>;

  it('accepts the committed file', () => {
    expect(() => parseFixtureCatalogue(good())).not.toThrow();
  });

  it('throws on a stray column (strict objects), naming where', () => {
    const bad = good();
    (bad['places']![0] as Record<string, unknown>)['phone'] = '+919876543210';
    expect(() => parseFixtureCatalogue(bad)).toThrow(/places\.0/);
  });

  it('throws on a missing section and on a malformed id', () => {
    const missing = good();
    delete missing['evidence'];
    expect(() => parseFixtureCatalogue(missing)).toThrow(/evidence/);
    const badId = good();
    (badId['providers']![0] as Record<string, unknown>)['id'] = 'not-a-uuid';
    expect(() => parseFixtureCatalogue(badId)).toThrow(/providers\.0\.id/);
  });

  it('refuses reference sections in the fixture file: those come from data/ and content/', () => {
    const bad = { ...good(), localities: [] };
    expect(() => parseFixtureCatalogue(bad)).toThrow(/localities/);
  });

  it('refuses a business whose name does not start with "Example "', () => {
    const bad = good();
    (bad['places']![0] as Record<string, unknown>)['name'] = 'Real Looking Biryani';
    expect(() => parseFixtureCatalogue(bad)).toThrow(/Example/);
  });
});
