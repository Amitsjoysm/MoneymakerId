import { describe, expect, it } from 'vitest';
import {
  AggregatorEntrySchema,
  CostModelSchema,
  DishSchema,
  LeadPricingSchema,
  LocalFactSchema,
  LocalitySchema,
  LocalityFactsStagingSchema,
  LocalityGuideFrontmatterSchema,
  SeasonalCalendarSchema,
  ServiceDefSchema,
  SourceRefSchema,
} from './data.ts';

const source = (publisher = 'Example Publisher', n = 1) => ({
  url: `https://example.com/page-${n}`,
  title: `Page ${n}`,
  publisher,
  retrieved_at: '2026-10-07',
  quote: 'A quoted passage',
});

const fact = (over: Record<string, unknown> = {}) => ({
  id: 'baner-water-1',
  topic: 'water',
  text: 'Some fact.',
  services: ['terrace-waterproofing'],
  sources: [source()],
  status: 'draft',
  ...over,
});

const locality = (over: Record<string, unknown> = {}) => ({
  id: 'baner',
  name: 'Baner',
  kind: 'locality',
  city_id: 'pune',
  parent_id: null,
  aliases: ['Banar'],
  geo: { lat: 18.559, lng: 73.7868 },
  geo_source: source(),
  jurisdiction: 'PMC',
  pincodes: ['411045'],
  neighbours: ['aundh', 'balewadi'],
  landmarks: [],
  commercial_centres: [],
  office_clusters: [],
  residential_clusters: [],
  construction_facts: [fact()],
  food_notes: [],
  i18n: { mr: { name: 'बाणेर' }, hi: null },
  ...over,
});

const costModel = (over: Record<string, unknown> = {}) => ({
  id: 'terrace-waterproofing-standard',
  service_id: 'terrace-waterproofing',
  scope_id: null,
  material_id: null,
  tier: 'standard',
  unit: 'sqft',
  rate_inr: { low: 40, expected: 60, high: 90 },
  min_job_inr: null,
  components: { materials: 0.4, labour: 0.3, preparation: 0.1, repair: 0.1, transport: 0.05, waste: 0.05 },
  locality_factors: [],
  sources: [source('Publisher A', 1), source('Publisher B', 2)],
  reviewed_at: '2026-10-06',
  valid_until: '2027-04-04',
  status: 'draft',
  notes: '',
  ...over,
});

const service = (over: Record<string, unknown> = {}) => ({
  id: 'painting',
  name: 'Painting',
  parent_id: null,
  unit: 'sqft',
  area_presets: [],
  scope_options: [{ id: 'full', label: 'Full', description: 'Everything' }],
  materials: [{ id: 'emulsion', label: 'Emulsion', description: 'Water based', sources: [source()] }],
  duration_days: null,
  questions_to_ask: ['q'],
  common_mistakes: ['m'],
  quote_checklist: ['c'],
  faq: [{ q: 'Q?', a: 'A.' }],
  prose_status: 'draft',
  sub_services: [],
  ...over,
});

const ok = (s: { safeParse(v: unknown): { success: boolean } }, v: unknown) => s.safeParse(v).success;

describe('SourceRef', () => {
  it('accepts a full reference and a null quote', () => {
    expect(ok(SourceRefSchema, source())).toBe(true);
    expect(ok(SourceRefSchema, { ...source(), quote: null })).toBe(true);
  });
  it('rejects http URLs, bad dates, missing publisher and extra keys', () => {
    expect(ok(SourceRefSchema, { ...source(), url: 'http://example.com/' })).toBe(false);
    expect(ok(SourceRefSchema, { ...source(), retrieved_at: '7 Oct 2026' })).toBe(false);
    expect(ok(SourceRefSchema, { ...source(), publisher: '' })).toBe(false);
    expect(ok(SourceRefSchema, { ...source(), extra: 1 })).toBe(false);
  });
});

describe('LocalFact', () => {
  it('accepts a sourced fact', () => {
    expect(ok(LocalFactSchema, fact())).toBe(true);
  });
  it('requires at least one source, because every factual statement carries one', () => {
    expect(ok(LocalFactSchema, fact({ sources: [] }))).toBe(false);
  });
  it('rejects an unknown topic', () => {
    expect(ok(LocalFactSchema, fact({ topic: 'gossip' }))).toBe(false);
  });
});

describe('Locality', () => {
  it('accepts a complete locality', () => {
    expect(ok(LocalitySchema, locality())).toBe(true);
  });
  it('rejects more than 6 neighbours', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    expect(ok(LocalitySchema, locality({ neighbours: many }))).toBe(false);
  });
  it('rejects a reserved id and a city other than pune', () => {
    expect(ok(LocalitySchema, locality({ id: 'veg' }))).toBe(false);
    expect(ok(LocalitySchema, locality({ city_id: 'mumbai' }))).toBe(false);
  });
  it('requires a landmark to be near-prefixed with a parent locality', () => {
    expect(ok(LocalitySchema, locality({ id: 'near-balewadi-stadium', kind: 'landmark', parent_id: 'balewadi' }))).toBe(true);
    expect(ok(LocalitySchema, locality({ id: 'balewadi-stadium', kind: 'landmark', parent_id: 'balewadi' }))).toBe(false);
    expect(ok(LocalitySchema, locality({ id: 'near-balewadi-stadium', kind: 'landmark', parent_id: null }))).toBe(false);
  });
  it('requires a sub-locality to have a parent', () => {
    expect(ok(LocalitySchema, locality({ id: 'hinjewadi-phase-1', kind: 'sub_locality', parent_id: 'hinjewadi' }))).toBe(true);
    expect(ok(LocalitySchema, locality({ id: 'hinjewadi-phase-1', kind: 'sub_locality', parent_id: null }))).toBe(false);
  });
  it('rejects a bad pincode', () => {
    expect(ok(LocalitySchema, locality({ pincodes: ['41104'] }))).toBe(false);
  });
});

describe('Dish', () => {
  const dish = (over: Record<string, unknown> = {}) => ({
    id: 'biryani',
    name: 'Biryani',
    parent_id: null,
    aliases: ['Biriyani'],
    cravings: ['spicy', 'filling'],
    diet: 'both',
    price_bands_inr: [150, 250, 400],
    price_sanity_inr: { min: 60, max: 1200 },
    description: 'Rice layered with spiced meat or vegetables.',
    prose_status: 'draft',
    i18n: { mr: null, hi: null },
    ...over,
  });
  it('accepts a dish', () => {
    expect(ok(DishSchema, dish())).toBe(true);
  });
  it('rejects an inverted sanity range and unsorted price bands', () => {
    expect(ok(DishSchema, dish({ price_sanity_inr: { min: 500, max: 100 } }))).toBe(false);
    expect(ok(DishSchema, dish({ price_bands_inr: [400, 150] }))).toBe(false);
  });
  it('rejects a reserved id', () => {
    expect(ok(DishSchema, dish({ id: 'veg' }))).toBe(false);
  });
});

describe('ServiceDef', () => {
  it('accepts a parent with a nested sub-service, null duration and no presets', () => {
    const parent = service({
      id: 'painting',
      sub_services: [service({ id: 'interior-painting', parent_id: 'painting' })],
    });
    expect(ok(ServiceDefSchema, parent)).toBe(true);
  });
  it('rejects a sub-service whose parent_id does not name its parent', () => {
    const parent = service({ sub_services: [service({ id: 'interior-painting', parent_id: 'waterproofing' })] });
    expect(ok(ServiceDefSchema, parent)).toBe(false);
  });
  it('accepts a sourced duration and rejects an inverted one', () => {
    expect(ok(ServiceDefSchema, service({ duration_days: { min: 3, max: 7, basis: 'Planning estimate' } }))).toBe(true);
    expect(ok(ServiceDefSchema, service({ duration_days: { min: 7, max: 3, basis: 'Planning estimate' } }))).toBe(false);
  });
  it('requires sources on an area preset', () => {
    const preset = { preset: 'terrace', label: 'Terrace', quantity: 1000, assumption: 'Example', sources: [] };
    expect(ok(ServiceDefSchema, service({ area_presets: [preset] }))).toBe(false);
    expect(ok(ServiceDefSchema, service({ area_presets: [{ ...preset, sources: [source()] }] }))).toBe(true);
  });
});

describe('CostModel', () => {
  it('accepts a valid model', () => {
    expect(ok(CostModelSchema, costModel())).toBe(true);
  });
  it('requires components to sum to 1 within 0.01', () => {
    const c = { materials: 0.4, labour: 0.3, preparation: 0.1, repair: 0.1, transport: 0.05, waste: 0.06 };
    expect(ok(CostModelSchema, costModel({ components: c }))).toBe(true); // 1.01
    expect(ok(CostModelSchema, costModel({ components: { ...c, waste: 0.2 } }))).toBe(false);
  });
  it('requires low <= expected <= high', () => {
    expect(ok(CostModelSchema, costModel({ rate_inr: { low: 90, expected: 60, high: 40 } }))).toBe(false);
  });
  it('requires two sources from different publishers', () => {
    expect(ok(CostModelSchema, costModel({ sources: [source('A', 1)] }))).toBe(false);
    expect(ok(CostModelSchema, costModel({ sources: [source('A', 1), source(' a ', 2)] }))).toBe(false);
    expect(ok(CostModelSchema, costModel({ sources: [source('A', 1), source('B', 2), source('B', 3)] }))).toBe(true);
  });
  it('rejects valid_until before reviewed_at and non-integer rates', () => {
    expect(ok(CostModelSchema, costModel({ valid_until: '2026-01-01' }))).toBe(false);
    expect(ok(CostModelSchema, costModel({ rate_inr: { low: 40.5, expected: 60, high: 90 } }))).toBe(false);
  });
  it('requires sources on a locality factor', () => {
    const lf = { locality_id: 'wakad', factor: 1.05, sources: [] };
    expect(ok(CostModelSchema, costModel({ locality_factors: [lf] }))).toBe(false);
    expect(ok(CostModelSchema, costModel({ locality_factors: [{ ...lf, sources: [source()] }] }))).toBe(true);
  });
});

describe('locality guide frontmatter', () => {
  const fm = (over: Record<string, unknown> = {}) => ({
    locality_id: 'baner',
    title: 'Living in Baner, Pune: Area Guide',
    status: 'draft',
    word_count: 563,
    sources: [source()],
    ...over,
  });
  it('accepts valid frontmatter', () => {
    expect(ok(LocalityGuideFrontmatterSchema, fm())).toBe(true);
  });
  it('rejects a bad status, a non-integer word count and no sources', () => {
    expect(ok(LocalityGuideFrontmatterSchema, fm({ status: 'published' }))).toBe(false);
    expect(ok(LocalityGuideFrontmatterSchema, fm({ word_count: 12.5 }))).toBe(false);
    expect(ok(LocalityGuideFrontmatterSchema, fm({ sources: [] }))).toBe(false);
  });
});

describe('small data files', () => {
  it('SeasonalCalendar needs all 12 months', () => {
    const month = { services: ['waterproofing'], headline: 'h', cta: 'c', module: null };
    const months = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), month]));
    expect(ok(SeasonalCalendarSchema, { months })).toBe(true);
    const { '12': _dropped, ...eleven } = months;
    expect(ok(SeasonalCalendarSchema, { months: eleven })).toBe(false);
  });
  it('LeadPricing needs INR and valid grades', () => {
    const prices = [{ service_id: 'painting', grade: 'A', price_inr: 400 }];
    expect(ok(LeadPricingSchema, { currency: 'INR', exclusive_multiplier: 2.5, prices })).toBe(true);
    expect(ok(LeadPricingSchema, { currency: 'USD', exclusive_multiplier: 2.5, prices })).toBe(false);
    expect(ok(LeadPricingSchema, { currency: 'INR', exclusive_multiplier: 2.5, prices: [{ ...prices[0], grade: 'D' }] })).toBe(false);
  });
  it('AggregatorEntry is discovery-only with a lowercase domain', () => {
    expect(ok(AggregatorEntrySchema, { domain: 'zomato.com', owner_group: 'eternal-zomato', discovery_only: true })).toBe(true);
    expect(ok(AggregatorEntrySchema, { domain: 'zomato.com', owner_group: 'x', discovery_only: false })).toBe(false);
    expect(ok(AggregatorEntrySchema, { domain: 'Zomato.com', owner_group: 'x', discovery_only: true })).toBe(false);
    expect(ok(AggregatorEntrySchema, { domain: 'https://zomato.com', owner_group: 'x', discovery_only: true })).toBe(false);
  });
  it('the locality-facts staging file maps locality ids to facts', () => {
    expect(ok(LocalityFactsStagingSchema, { baner: [fact()] })).toBe(true);
    expect(ok(LocalityFactsStagingSchema, { Baner: [fact()] })).toBe(false);
    expect(ok(LocalityFactsStagingSchema, { baner: [fact({ sources: [] })] })).toBe(false);
  });
});
