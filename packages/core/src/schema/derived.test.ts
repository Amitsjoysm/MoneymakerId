import { describe, expect, it } from 'vitest';
import {
  BadgeInputsSchema,
  BusinessUpsertSchema,
  CandidateInputSchema,
  CatalogueSnapshotSchema,
  ClaimSchema,
  EventAggregateSchema,
  EvidenceInsertSchema,
  EvidenceViewSchema,
  FoodCandidateSchema,
  HotInputsSchema,
  KeyOutcomeSchema,
  LeadInsertSchema,
  LeadRecordSchema,
  ManifestEntrySchema,
  OpeningHoursSchema,
  PageCandidateSchema,
  ParsedIntentSchema,
  PlaceViewSchema,
  ProviderViewSchema,
  AskItemSchema,
  AskResultSchema,
} from './derived.ts';
import { leadSubmission } from './test-fixtures.ts';

const ok = (s: { safeParse(v: unknown): { success: boolean } }, v: unknown) => s.safeParse(v).success;
const uuid = () => crypto.randomUUID();
const ts = '2026-10-07T10:00:00Z';

describe('OpeningHours', () => {
  it('accepts per-weekday ranges and rejects bad times and days', () => {
    expect(ok(OpeningHoursSchema, { mon: [['11:00', '23:30']], sun: [] })).toBe(true);
    expect(ok(OpeningHoursSchema, { mon: [['25:00', '23:30']] })).toBe(false);
    expect(ok(OpeningHoursSchema, { mon: [['11:00']] })).toBe(false);
    expect(ok(OpeningHoursSchema, { funday: [['11:00', '12:00']] })).toBe(false);
  });
});

describe('Claim and EvidenceInsert', () => {
  const evidence = (claim_type: string, claim: unknown) => ({
    entity_type: 'restaurant_dish',
    entity_id: uuid(),
    claim_type,
    claim,
    supporting_quote: 'Chicken biryani Rs. 249',
    source: { kind: 'menu', url: 'https://example.com/menu', title: 'Menu', publisher: 'Example', experience_id: null },
    retrieved_at: ts,
    valid_until: null,
    confidence: 0.9,
    extractor_version: 'det-1',
  });
  const price = { price: { dish_id: 'biryani', service_id: null, price_inr: 249, unit: 'serving' } };

  it('Claim accepts each variant and rejects an empty or two-keyed claim', () => {
    const claims = [
      price,
      { hours: { mon: [['11:00', '23:00']] } },
      { dish: { dish_id: 'biryani', variant_label: null } },
      { service: { service_id: 'terrace-waterproofing' } },
      { address: '12 Sample Road' },
      { phone: '+919834346179' },
      { rating: { value: 4.2, scale: 5 } },
      { mention: { sentiment: 'positive' } },
      { offer: { text: '10% off', ends_on: '2026-11-01' } },
      { availability: { text: 'Open on Sundays' } },
      { cost_rate: { cost_model_id: 'terrace-waterproofing-standard' } },
    ];
    for (const c of claims) expect(ok(ClaimSchema, c), JSON.stringify(c)).toBe(true);
    expect(ok(ClaimSchema, {})).toBe(false);
    expect(ok(ClaimSchema, { ...price, phone: '+919834346179' })).toBe(false);
    expect(ok(ClaimSchema, { price: { ...price.price, unit: 'litre' } })).toBe(false);
    expect(ok(ClaimSchema, { rating: { value: 6, scale: 5 } })).toBe(false);
  });

  it('EvidenceInsert accepts a consistent claim and rejects a claim that does not match claim_type', () => {
    expect(ok(EvidenceInsertSchema, evidence('price', price))).toBe(true);
    expect(ok(EvidenceInsertSchema, evidence('hours', price))).toBe(false);
  });

  it('EvidenceInsert needs a URL unless the source is first-hand', () => {
    const noUrl = { kind: 'first_hand', url: null, title: null, publisher: null, experience_id: uuid() };
    expect(ok(EvidenceInsertSchema, { ...evidence('price', price), source: noUrl })).toBe(true);
    expect(ok(EvidenceInsertSchema, { ...evidence('price', price), source: { ...noUrl, kind: 'menu' } })).toBe(false);
  });

  it('EvidenceInsert bounds confidence to 0..1', () => {
    expect(ok(EvidenceInsertSchema, { ...evidence('price', price), confidence: 1.2 })).toBe(false);
  });

  it('EvidenceView adds id, source_id, status and tier', () => {
    const view = { ...evidence('price', price), id: uuid(), source_id: uuid(), status: 'active', tier: 'HOT' };
    expect(ok(EvidenceViewSchema, view)).toBe(true);
    expect(ok(EvidenceViewSchema, { ...view, tier: 'LUKEWARM' })).toBe(false);
    expect(ok(EvidenceViewSchema, { ...view, claim_type: 'hours' })).toBe(false);
  });
});

describe('BusinessUpsert and CandidateInput', () => {
  const upsert = {
    kind: 'restaurant',
    name: 'Example Biryani House',
    locality_id: 'wakad',
    address: null,
    geo: null,
    phone: null,
    website: 'https://example.com/',
    chain_hint: null,
    branch_key: null,
    status: 'candidate',
    auto_published: false,
    restaurant: { cuisines: ['Hyderabadi'], price_level: 2 },
    provider: null,
    actor: 'csv',
  };
  it('accepts a partial restaurant block and rejects a bad price level', () => {
    expect(ok(BusinessUpsertSchema, upsert)).toBe(true);
    expect(ok(BusinessUpsertSchema, { ...upsert, restaurant: { price_level: 4 } })).toBe(false);
    expect(ok(BusinessUpsertSchema, { ...upsert, actor: 'robot' })).toBe(false);
  });
  it('CandidateInput adds evidence and a decision', () => {
    expect(ok(CandidateInputSchema, { ...upsert, evidence: [], decision: 'queue' })).toBe(true);
    expect(ok(CandidateInputSchema, { ...upsert, evidence: [], decision: 'maybe' })).toBe(false);
  });
});

describe('LeadInsert and LeadRecord', () => {
  const insert = {
    ...leadSubmission(),
    phone_e164: '+919834346179',
    grade: 'A',
    qualified: true,
    visitor_hmac: 'abc123',
    synthetic: false,
  };
  it('LeadInsert extends the submission with server fields', () => {
    expect(ok(LeadInsertSchema, insert)).toBe(true);
    expect(ok(LeadInsertSchema, { ...insert, phone_e164: '9834346179' })).toBe(false);
    expect(ok(LeadInsertSchema, { ...insert, synthetic: true })).toBe(false);
    expect(ok(LeadInsertSchema, { ...insert, grade: 'D' })).toBe(false);
  });
  it('LeadRecord adds the stored fields', () => {
    const record = {
      ...insert,
      id: uuid(),
      ref: 'C-WAKAD-WP-1',
      status: 'new',
      whatsapp_confirmed: false,
      next_follow_up_at: null,
      contact_attempts: 0,
      remind_at: null,
      duplicate_of: null,
      anonymised_at: null,
      created_at: ts,
    };
    expect(ok(LeadRecordSchema, record)).toBe(true);
    expect(ok(LeadRecordSchema, { ...record, status: 'sold' })).toBe(false);
  });
});

describe('KeyOutcome, ParsedIntent, AskItem, AskResult', () => {
  it('KeyOutcome', () => {
    const k = {
      provider: 'groq',
      fingerprint: 'abc123def456',
      account_label: 'acct1',
      status_code: 429,
      outcome: 'rate_limited',
      retry_after_s: 30,
      tokens: null,
    };
    expect(ok(KeyOutcomeSchema, k)).toBe(true);
    expect(ok(KeyOutcomeSchema, { ...k, provider: 'openai' })).toBe(false);
  });
  it('ParsedIntent', () => {
    const p = {
      vertical: 'food',
      subject_id: 'biryani',
      craving: null,
      locality_id: 'wakad',
      budget_inr: 300,
      diet: null,
      open_now: false,
      intent_key: 'food|biryani|wakad|300',
      confidence: 0.9,
    };
    expect(ok(ParsedIntentSchema, p)).toBe(true);
    expect(ok(ParsedIntentSchema, { ...p, vertical: 'travel' })).toBe(false);
    expect(ok(ParsedIntentSchema, { ...p, confidence: 2 })).toBe(false);
  });
  const item = {
    entity_id: null,
    name: 'Example Biryani House',
    locality_id: 'wakad',
    url: null,
    summary: 'Chicken biryani listed at Rs. 249.',
    price_inr: 249,
    labels: ['best_value', 'hot'],
    trust: ['source_backed'],
    sources: [{ url: 'https://example.com/menu', title: 'Menu', retrieved_at: '2026-10-07' }],
    unverified: true,
  };
  it('AskItem and AskResult', () => {
    expect(ok(AskItemSchema, item)).toBe(true);
    expect(ok(AskItemSchema, { ...item, labels: ['#1 best in Pune'] })).toBe(false);
    expect(ok(AskResultSchema, { items: [item], served_from: 'live', citations: item.sources })).toBe(true);
    expect(ok(AskResultSchema, { items: [item], served_from: 'cache', citations: [] })).toBe(false);
  });
  it('AskItem rejects extra keys, so a personal phone cannot ride along', () => {
    expect(ok(AskItemSchema, { ...item, phone: '+919834346179' })).toBe(false);
  });
});

describe('EventAggregate', () => {
  const e = {
    day: '2026-10-07',
    host: 'food',
    page_type: 'dish_locality',
    event: 'website_click',
    locality_id: 'wakad',
    subject_id: 'biryani',
    entity_id: '',
    ranking_run_id: '',
    slot: '',
    campaign_id: '',
    variant: '',
    referrer_class: 'search',
    device: 'mobile',
    landing_path: null,
    count: 3,
  };
  it('accepts an aggregate and rejects a zero count and an unknown event', () => {
    expect(ok(EventAggregateSchema, e)).toBe(true);
    expect(ok(EventAggregateSchema, { ...e, count: 0 })).toBe(false);
    expect(ok(EventAggregateSchema, { ...e, event: 'page_view' })).toBe(false);
  });
});

describe('views', () => {
  const place = {
    id: uuid(),
    slug: 'example-biryani-house',
    name: 'Example Biryani House',
    locality_id: 'wakad',
    address: null,
    geo: null,
    website: null,
    price_level: 2,
    cuisines: ['Hyderabadi'],
    diet: 'both',
    service_modes: ['dine_in'],
    opening_hours: null,
    tags: [],
    verification_status: 'unverified',
    verified_at: null,
    last_verified_at: null,
    auto_published: true,
    reviewed_at: null,
    dishes: [{ dish_id: 'biryani', variant_label: null, price_inr: 249, evidence_id: uuid(), last_seen_at: ts }],
  };
  it('PlaceView accepts a place and rejects a personal phone column', () => {
    expect(ok(PlaceViewSchema, place)).toBe(true);
    expect(ok(PlaceViewSchema, { ...place, phone: '+919834346179' })).toBe(false);
  });
  it('ProviderView carries no personal phone', () => {
    const provider = {
      id: uuid(),
      slug: 'example-waterproofing-works',
      name: 'Example Waterproofing Works',
      locality_id: 'wagholi',
      service_localities: ['wagholi'],
      services: ['terrace-waterproofing'],
      specializations: [],
      experience_years: null,
      accepts_leads: true,
      verification_status: 'unverified',
      verified_at: null,
      founding_partner: false,
      auto_published: false,
      reviewed_at: null,
    };
    expect(ok(ProviderViewSchema, provider)).toBe(true);
    expect(ok(ProviderViewSchema, { ...provider, phone: '+919834346179' })).toBe(false);
  });
});

describe('page, ranking and manifest shapes', () => {
  const gate = {
    gate_key: 'food:place',
    scores: { evidence: 4, entities: 1, relevance: 0.8, unique: 0.7, seo: 0.6 },
    passed: true,
    reasons: [],
  };
  it('ManifestEntry needs a sha256 content hash', () => {
    const entry = {
      url: 'https://food.marketmindai.com/place/example-biryani-house/',
      host: 'food',
      locale: 'en',
      page_type: 'place',
      indexable: true,
      content_hash: 'a'.repeat(64),
      hash_changed_at: ts,
      gate,
      noindex_since: null,
      redirect_to: null,
    };
    expect(ok(ManifestEntrySchema, entry)).toBe(true);
    expect(ok(ManifestEntrySchema, { ...entry, content_hash: 'abc' })).toBe(false);
  });
  it('PageCandidate keys seo_inputs by the SEO weights', () => {
    const seo = { demand: 0.5, data_quality: 0.5, locality_specificity: 0.5, commercial_intent: 0.5, content_depth: 0.5, freshness: 0.5 };
    const c = {
      url: 'https://food.marketmindai.com/pune/wakad/biryani/',
      host: 'food',
      locale: 'en',
      page_type: 'dish_locality',
      parent_url: null,
      entity_ids: [uuid()],
      evidence_count: 6,
      entity_count: 3,
      relevance: 0.7,
      main_text: 'text',
      data_inputs: { a: 1 },
      prose_keys: [],
      seo_inputs: seo,
      extra: {},
    };
    expect(ok(PageCandidateSchema, c)).toBe(true);
    const { freshness: _f, ...missing } = seo;
    expect(ok(PageCandidateSchema, { ...c, seo_inputs: missing })).toBe(false);
  });
  it('FoodCandidate and HotInputs key components by the §8a weights, each 0 to 1', () => {
    const food = { relevance: 1, rating_strength: 1, review_strength: 1, dish_evidence: 1, freshness: 1, value: 1, locality_match: 1 };
    expect(ok(FoodCandidateSchema, { entity_id: uuid(), components: food })).toBe(true);
    expect(ok(FoodCandidateSchema, { entity_id: uuid(), components: { ...food, value: 1.5 } })).toBe(false);
    expect(ok(FoodCandidateSchema, { entity_id: uuid(), components: { ...food, extra: 1 } })).toBe(false);
    const hot = { recent_mentions: 0.1, freshness: 0.1, demand_signal: 0.1, engagement: 0.1, quality: 0.1 };
    expect(ok(HotInputsSchema, { components: hot, evidence_count: 3 })).toBe(true);
  });
  it('BadgeInputs', () => {
    const b = {
      quality_pct: 80,
      visibility_pct: 20,
      value_pct: 85,
      dated_prices: 2,
      late_hours_checked_at: null,
      tags: [],
      distance_to_office_m: null,
      evidence_count: 4,
    };
    expect(ok(BadgeInputsSchema, b)).toBe(true);
  });
});

describe('CatalogueSnapshot', () => {
  it('accepts an empty snapshot and rejects a missing section', () => {
    const snap = {
      snapshot_id: 's1',
      generated_at: ts,
      localities: [],
      locality_profiles: [],
      dishes: [],
      services: [],
      cost_models: [],
      locality_guides: [],
      places: [],
      providers: [],
      evidence: [],
      experiences: [],
      recommendations: [],
      featured: [],
      campaigns: [],
      demand: [],
      quote_stats: [],
      founding_slots: [],
      prose_reviews: [],
      redirects: [],
      previous_manifest: [],
    };
    expect(ok(CatalogueSnapshotSchema, snap)).toBe(true);
    const { campaigns: _c, ...missing } = snap;
    expect(ok(CatalogueSnapshotSchema, missing)).toBe(false);
  });
});
