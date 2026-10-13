// Test fixtures for ranking and labels. Every name, id and number here is invented for tests; none of it is data.
import { CLAIM_TIER } from '../../constants/index.ts';
import type { Claim, ClaimType, EvidenceView, PlaceView, ProviderView } from '../../schema/index.ts';

export const PLACE_ID = '11111111-1111-4111-8111-111111111111';
export const NOW = new Date('2026-10-12T06:00:00.000Z');
export const DAY_MS = 86_400_000;

/** An ISO timestamp `days` before `NOW` (negative for the future). */
export function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

const CLAIMS: Record<ClaimType, Claim> = {
  price: { price: { dish_id: 'biryani', service_id: null, price_inr: 249, unit: 'serving' } },
  hours: { hours: { mon: [['11:00', '23:30']] } },
  offer: { offer: { text: 'Example offer', ends_on: null } },
  availability: { availability: { text: 'Example availability note' } },
  dish: { dish: { dish_id: 'biryani', variant_label: null } },
  service: { service: { service_id: 'terrace-waterproofing' } },
  address: { address: 'Example Lane, Wakad, Pune' },
  phone: { phone: '+919876543210' },
  rating: { rating: { value: 4.2, scale: 5 } },
  mention: { mention: { sentiment: 'positive' } },
  locality_fact: {
    locality_fact: {
      id: 'example-fact',
      topic: 'rainfall',
      text: 'Example locality fact.',
      services: [],
      sources: [
        {
          url: 'https://example.com/fact',
          title: 'Example fact',
          publisher: 'Example Publisher',
          retrieved_at: '2026-10-01',
          quote: null,
        },
      ],
      status: 'draft',
    },
  },
  cost_rate: { cost_rate: { cost_model_id: 'example-model' } },
};

let counter = 0;
function uuid(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

/**
 * An active, source-backed evidence row retrieved `age` days before `NOW`. `tier` follows CLAIM_TIER unless
 * overridden. Override `valid_until`, `status`, `source` and so on per test.
 */
export function makeEvidence(
  claim_type: ClaimType = 'dish',
  age = 1,
  over: Partial<EvidenceView> = {},
): EvidenceView {
  return {
    id: uuid(),
    source_id: uuid(),
    entity_type: 'business',
    entity_id: PLACE_ID,
    claim_type,
    claim: CLAIMS[claim_type],
    supporting_quote: null,
    source: {
      kind: 'menu',
      url: 'https://example.com/menu',
      title: 'Example menu',
      publisher: null,
      experience_id: null,
    },
    retrieved_at: daysAgo(age),
    valid_until: null,
    confidence: 0.9,
    extractor_version: 'test-1',
    status: 'active',
    tier: CLAIM_TIER[claim_type],
    ...over,
  };
}

export function makePlace(over: Partial<PlaceView> = {}): PlaceView {
  return {
    id: PLACE_ID,
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
    auto_published: false,
    reviewed_at: null,
    dishes: [],
    ...over,
  };
}

export function makeProvider(over: Partial<ProviderView> = {}): ProviderView {
  return {
    id: '22222222-2222-4222-8222-222222222222',
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
    ...over,
  };
}
