import { describe, expect, it } from 'vitest';
import {
  AskBeginInputSchema,
  AskBeginResultSchema,
  AskCommitInputSchema,
  AskResultOutputSchema,
  AskSearchInputSchema,
  PageBuildsRecordInputSchema,
  RecordEventsInputSchema,
  SubmitFeedbackInputSchema,
  SubmitLeadResultSchema,
  UpsertBusinessResultSchema,
} from './api.ts';

const ok = (s: { safeParse(v: unknown): { success: boolean } }, v: unknown) => s.safeParse(v).success;
const uuid = () => crypto.randomUUID();
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

describe('api.* inputs and outputs (CONTRACTS §5)', () => {
  it('submit_lead result', () => {
    expect(ok(SubmitLeadResultSchema, { lead_id: uuid(), ref: 'C-1', duplicate_of: null })).toBe(true);
    expect(ok(SubmitLeadResultSchema, { lead_id: 'x', ref: 'C-1', duplicate_of: null })).toBe(false);
  });
  it('record_events', () => {
    expect(ok(RecordEventsInputSchema, { visitor_hmac: 'h', verified: true, events: [] })).toBe(true);
    expect(ok(RecordEventsInputSchema, { visitor_hmac: 'h', events: [] })).toBe(false);
  });
  it('submit_feedback', () => {
    const f = { page_key: 'p', entity_id: null, kind: 'outdated', note: null, visitor_hmac: 'h' };
    expect(ok(SubmitFeedbackInputSchema, f)).toBe(true);
    expect(ok(SubmitFeedbackInputSchema, { ...f, note: 'x'.repeat(501) })).toBe(false);
  });
  it('ask_search limits results to 10', () => {
    expect(ok(AskSearchInputSchema, { intent, limit: 10 })).toBe(true);
    expect(ok(AskSearchInputSchema, { intent, limit: 11 })).toBe(false);
    expect(ok(AskSearchInputSchema, { intent, limit: 0 })).toBe(false);
  });
  it('ask_begin input and result', () => {
    expect(ok(AskBeginInputSchema, { intent_key: 'k', visitor_hmac: 'h', want_live: true })).toBe(true);
    const usable = { groq: ['abc'], exa: [], firecrawl: [] };
    expect(ok(AskBeginResultSchema, { verdict: 'allow', lookup_id: uuid(), usable })).toBe(true);
    expect(ok(AskBeginResultSchema, { verdict: 'rate_limited', lookup_id: null, usable })).toBe(true);
    expect(ok(AskBeginResultSchema, { verdict: 'maybe', lookup_id: null, usable })).toBe(false);
    expect(ok(AskBeginResultSchema, { verdict: 'allow', lookup_id: null, usable: { groq: [] } })).toBe(false);
  });
  it('ask_commit and ask_result', () => {
    const result = { items: [], served_from: 'live', citations: [] };
    expect(ok(AskCommitInputSchema, { lookup_id: uuid(), result, key_outcomes: [], candidates: [] })).toBe(true);
    expect(ok(AskResultOutputSchema, { status: 'done', result })).toBe(true);
    expect(ok(AskResultOutputSchema, { status: 'pending', result: null })).toBe(true);
  });
  it('upsert_business result and page_builds_record input', () => {
    expect(ok(UpsertBusinessResultSchema, { business_id: uuid(), slug: 'example-place', action: 'merged' })).toBe(true);
    expect(ok(UpsertBusinessResultSchema, { business_id: uuid(), slug: 'example-place', action: 'deleted' })).toBe(false);
    expect(ok(PageBuildsRecordInputSchema, { build_id: 'b1', entries: [] })).toBe(true);
  });
});
