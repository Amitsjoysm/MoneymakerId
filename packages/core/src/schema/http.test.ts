import { describe, expect, it } from 'vitest';
import {
  AskRequestSchema,
  AskResponseSchema,
  AskResultResponseSchema,
  DeployDispatchInputsSchema,
  EventRequestSchema,
  FeedbackRequestSchema,
  LeadErrorResponseSchema,
  LeadResponseSchema,
  LeadSubmissionSchema,
} from './http.ts';
import { leadSubmission } from './test-fixtures.ts';

const ok = (s: { safeParse(v: unknown): { success: boolean } }, v: unknown) => s.safeParse(v).success;
const uuid = () => crypto.randomUUID();

describe('LeadSubmission', () => {
  it('accepts a complete quote submission', () => {
    expect(ok(LeadSubmissionSchema, leadSubmission())).toBe(true);
  });

  it('requires accepted consent, exactly true', () => {
    const base = leadSubmission();
    expect(ok(LeadSubmissionSchema, { ...base, consent: { version: 'lead-consent-v1', accepted: false } })).toBe(false);
    expect(ok(LeadSubmissionSchema, { ...base, consent: { version: 'lead-consent-v1' } })).toBe(false);
    expect(ok(LeadSubmissionSchema, { ...base, consent: { version: '', accepted: true } })).toBe(false);
  });

  it('bounds name (1-80), message (1000) and quote notes (500)', () => {
    const base = leadSubmission();
    expect(ok(LeadSubmissionSchema, { ...base, name: '' })).toBe(false);
    expect(ok(LeadSubmissionSchema, { ...base, name: 'x'.repeat(80) })).toBe(true);
    expect(ok(LeadSubmissionSchema, { ...base, name: 'x'.repeat(81) })).toBe(false);
    expect(ok(LeadSubmissionSchema, { ...base, message: 'x'.repeat(1000) })).toBe(true);
    expect(ok(LeadSubmissionSchema, { ...base, message: 'x'.repeat(1001) })).toBe(false);
    const quote = base.quote as Record<string, unknown>;
    expect(ok(LeadSubmissionSchema, { ...base, quote: { ...quote, notes: 'x'.repeat(500) } })).toBe(true);
    expect(ok(LeadSubmissionSchema, { ...base, quote: { ...quote, notes: 'x'.repeat(501) } })).toBe(false);
  });

  it('validates quote enums and the idempotency key', () => {
    const base = leadSubmission();
    const quote = base.quote as Record<string, unknown>;
    expect(ok(LeadSubmissionSchema, { ...base, quote: { ...quote, timeline: 'someday' } })).toBe(false);
    expect(ok(LeadSubmissionSchema, { ...base, quote: { ...quote, property_type: 'castle' } })).toBe(false);
    expect(ok(LeadSubmissionSchema, { ...base, quote: { ...quote, tier: null, estimate: null } })).toBe(true);
    expect(ok(LeadSubmissionSchema, { ...base, quote: { ...quote, area: { preset: 'custom', quantity: null } } })).toBe(true);
    expect(ok(LeadSubmissionSchema, { ...base, idempotency_key: 'not-a-uuid' })).toBe(false);
  });

  it('requires the turnstile token and the attribution block', () => {
    const base = leadSubmission();
    expect(ok(LeadSubmissionSchema, { ...base, turnstile_token: '' })).toBe(false);
    const { attribution: _a, ...noAttribution } = base;
    expect(ok(LeadSubmissionSchema, noAttribution)).toBe(false);
  });

  it('accepts a business enquiry', () => {
    const business = {
      business_name: 'Example Waterproofing Works',
      category: 'waterproofing',
      locality_id: 'wagholi',
      website: null,
      whatsapp: null,
      email: 'owner@example.com',
      description: null,
      services: ['terrace-waterproofing'],
      preferred_placement: null,
    };
    expect(ok(LeadSubmissionSchema, { ...leadSubmission(), lead_type: 'for_contractors', quote: null, business })).toBe(true);
    expect(ok(LeadSubmissionSchema, { ...leadSubmission(), quote: null, business: { ...business, email: 'nope' } })).toBe(false);
  });

  it('strips unknown keys from untrusted input rather than carrying them through', () => {
    const parsed = LeadSubmissionSchema.parse({ ...leadSubmission(), is_admin: true });
    expect('is_admin' in parsed).toBe(false);
  });
});

describe('lead responses', () => {
  it('LeadResponse covers 200, 202 and the synthetic case', () => {
    expect(ok(LeadResponseSchema, { ok: true, ref: 'C-1', duplicate: false })).toBe(true);
    expect(ok(LeadResponseSchema, { ok: true, ref: 'C-1', queued: true })).toBe(true);
    expect(ok(LeadResponseSchema, { ok: true, ref: 'TEST-1', synthetic: true })).toBe(true);
    expect(ok(LeadResponseSchema, { ok: false })).toBe(false);
  });
  it('LeadErrorResponse lists field errors', () => {
    expect(ok(LeadErrorResponseSchema, { ok: false, errors: [{ path: 'phone', message: 'Enter a valid mobile number' }] })).toBe(true);
    expect(ok(LeadErrorResponseSchema, { ok: true, errors: [] })).toBe(false);
  });
});

describe('EventRequest', () => {
  const event = {
    name: 'website_click',
    page_type: 'place',
    path: '/place/example/',
    locality_id: 'wakad',
    subject_id: 'biryani',
    entity_id: uuid(),
    position: 2,
    ranking_run_id: '',
    slot: '',
    campaign_id: '',
    variant: '',
    device: 'mobile',
    referrer_class: 'search',
    landing_path: null,
    lcp_ms: null,
  };
  it('accepts up to 20 events and rejects 21 or none', () => {
    expect(ok(EventRequestSchema, { events: [event] })).toBe(true);
    expect(ok(EventRequestSchema, { events: Array.from({ length: 20 }, () => event) })).toBe(true);
    expect(ok(EventRequestSchema, { events: Array.from({ length: 21 }, () => event) })).toBe(false);
    expect(ok(EventRequestSchema, { events: [] })).toBe(false);
  });
  it('rejects an unknown event name', () => {
    expect(ok(EventRequestSchema, { events: [{ ...event, name: 'page_view' }] })).toBe(false);
  });
});

describe('FeedbackRequest and Ask', () => {
  it('FeedbackRequest bounds the note to 500', () => {
    const f = { page_key: 'food:place:x', entity_id: null, kind: 'useful', note: null, turnstile_token: null };
    expect(ok(FeedbackRequestSchema, f)).toBe(true);
    expect(ok(FeedbackRequestSchema, { ...f, note: 'x'.repeat(500) })).toBe(true);
    expect(ok(FeedbackRequestSchema, { ...f, note: 'x'.repeat(501) })).toBe(false);
    expect(ok(FeedbackRequestSchema, { ...f, kind: 'meh' })).toBe(false);
  });
  it('AskRequest needs 2 to 200 characters', () => {
    const a = { q: 'biryani in wakad', locality_id: null, turnstile_token: null };
    expect(ok(AskRequestSchema, a)).toBe(true);
    expect(ok(AskRequestSchema, { ...a, q: 'x' })).toBe(false);
    expect(ok(AskRequestSchema, { ...a, q: 'x'.repeat(201) })).toBe(false);
  });
  it('AskResponse and AskResultResponse', () => {
    const intent = {
      vertical: 'food',
      subject_id: 'biryani',
      craving: null,
      locality_id: 'wakad',
      budget_inr: null,
      diet: null,
      open_now: false,
      intent_key: 'k',
      confidence: 0.8,
    };
    expect(
      ok(AskResponseSchema, { intent, results: [], served_from: 'db', live: { status: 'pending', lookup_id: uuid() } }),
    ).toBe(true);
    expect(ok(AskResponseSchema, { intent, results: [], served_from: 'live', live: { status: 'none', lookup_id: null } })).toBe(false);
    expect(ok(AskResultResponseSchema, { status: 'done', results: [], citations: [] })).toBe(true);
    expect(ok(AskResultResponseSchema, { status: 'queued', results: [], citations: [] })).toBe(false);
  });
});

describe('DeployDispatchInputs', () => {
  it('needs a reason and the override flag', () => {
    expect(ok(DeployDispatchInputsSchema, { reason: 'content refresh', override_shrinkage: false })).toBe(true);
    expect(ok(DeployDispatchInputsSchema, { reason: '', override_shrinkage: false })).toBe(false);
    expect(ok(DeployDispatchInputsSchema, { reason: 'x' })).toBe(false);
  });
});
