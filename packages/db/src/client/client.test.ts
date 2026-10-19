import { describe, expect, it } from 'vitest';
import type { LeadInsert } from '@mm/core/schema';
import { DbError } from '../rpc.ts';
import { emptySnapshot, jsonResponse, mockFetch } from '../testing.ts';
import { API_FUNCTIONS, createApiClient } from './index.ts';

const intent = {
  vertical: 'food' as const,
  subject_id: 'biryani',
  craving: null,
  locality_id: 'baner',
  budget_inr: null,
  diet: null,
  open_now: false,
  intent_key: 'food:biryani:baner',
  confidence: 0.9,
};

const URL_BASE = 'https://example-project.supabase.co';
const KEY = ['sb', 'publishable', 'abcdefghijklmnop'].join('_');
const SECRET_KEY = ['sb', 'secret', 'abcdefghijklmnop'].join('_');
const UUID = '5f0c3a52-7a43-4a58-9d1d-3a1c1f0b6a11';

function client(responder: Parameters<typeof mockFetch>[0]) {
  const mock = mockFetch(responder);
  return {
    api: createApiClient({ url: URL_BASE, publishableKey: KEY, fetch: mock.fetch }),
    calls: mock.calls,
  };
}

describe('API_FUNCTIONS', () => {
  it('is exactly the 🌐 functions of CONTRACTS §5', () => {
    expect([...API_FUNCTIONS].sort()).toEqual(
      [
        'ask_begin',
        'ask_commit',
        'ask_result',
        'ask_search',
        'export_catalogue',
        'record_events',
        'submit_feedback',
        'submit_lead',
      ].sort(),
    );
  });
});

describe('createApiClient', () => {
  it('calls api.* with the publishable key and the api profile', async () => {
    const { api, calls } = client(() => jsonResponse(emptySnapshot()));
    await api.exportCatalogue();
    expect(calls[0]!.url).toBe(`${URL_BASE}/rest/v1/rpc/export_catalogue`);
    expect(calls[0]!.headers['content-profile']).toBe('api');
    expect(calls[0]!.headers['apikey']).toBe(KEY);
  });

  it('exportCatalogue returns the snapshot validated by CatalogueSnapshotSchema', async () => {
    const snapshot = emptySnapshot({ snapshot_id: 'abc' });
    const { api } = client(() => jsonResponse(snapshot));
    await expect(api.exportCatalogue()).resolves.toEqual(snapshot);
  });

  it('exportCatalogue rejects a snapshot with a stray column (a phone number) as a decode error', async () => {
    const bad = { ...emptySnapshot(), leads: [{ phone: '+919876543210' }] };
    const { api } = client(() => jsonResponse(bad));
    const error = await api.exportCatalogue().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DbError);
    expect((error as DbError).kind).toBe('decode');
    expect((error as DbError).message).not.toContain('+919876543210');
  });

  it('submitLead sends {p: lead} and validates the result', async () => {
    const lead = { service_id: 'waterproofing' } as unknown as LeadInsert;
    const { api, calls } = client(() => jsonResponse({ lead_id: UUID, ref: 'MM-1234', duplicate_of: null }));
    await expect(api.submitLead(lead)).resolves.toEqual({
      lead_id: UUID,
      ref: 'MM-1234',
      duplicate_of: null,
    });
    expect(calls[0]!.url).toMatch(/\/rpc\/submit_lead$/);
    expect(calls[0]!.body).toEqual({ p: lead });
  });

  it('submitLead rejects a result without lead_id', async () => {
    const { api } = client(() => jsonResponse({ ref: 'MM-1234', duplicate_of: null }));
    await expect(api.submitLead({} as LeadInsert)).rejects.toMatchObject({
      kind: 'decode',
      fn: 'submit_lead',
    });
  });

  it('recordEvents and submitFeedback and askCommit return nothing for a void function', async () => {
    const { api, calls } = client(() => new Response(null, { status: 204 }));
    await expect(
      api.recordEvents({ visitor_hmac: 'h', verified: false, events: [] }),
    ).resolves.toBeUndefined();
    await expect(
      api.submitFeedback({
        page_key: 'k',
        entity_id: null,
        kind: 'useful',
        note: null,
        visitor_hmac: 'h',
      }),
    ).resolves.toBeUndefined();
    await expect(
      api.askCommit({
        lookup_id: UUID,
        commit_sig: 'a'.repeat(64),
        result: { items: [], served_from: 'live', citations: [] },
        key_outcomes: [],
        candidates: [],
      }),
    ).resolves.toBeUndefined();
    expect(calls.map((c) => c.url.split('/').pop())).toEqual([
      'record_events',
      'submit_feedback',
      'ask_commit',
    ]);
    expect(calls.every((c) => 'p' in (c.body as object))).toBe(true);
  });

  it('askSearch validates a list of items', async () => {
    const { api, calls } = client(() => jsonResponse([]));
    await expect(api.askSearch({ intent, limit: 5 })).resolves.toEqual([]);
    expect(calls[0]!.body).toEqual({ p: { intent, limit: 5 } });
  });

  it('askBegin validates the verdict', async () => {
    const ok = { verdict: 'allow', lookup_id: UUID, usable: { groq: ['abc123'], exa: [], firecrawl: [] } };
    const { api } = client(() => jsonResponse(ok));
    await expect(
      api.askBegin({ intent, intent_key: 'k', visitor_hmac: 'h', want_live: true }),
    ).resolves.toEqual(ok);
    const bad = client(() => jsonResponse({ ...ok, verdict: 'maybe' }));
    await expect(
      bad.api.askBegin({ intent, intent_key: 'k', visitor_hmac: 'h', want_live: true }),
    ).rejects.toMatchObject({
      kind: 'decode',
    });
  });

  it('askResult passes the id as the named argument `id`', async () => {
    const { api, calls } = client(() => jsonResponse({ status: 'pending', result: null }));
    await expect(api.askResult(UUID)).resolves.toEqual({ status: 'pending', result: null });
    expect(calls[0]!.body).toEqual({ id: UUID });
  });

  it('rpc() rejects admin_api names at run time and at compile time', async () => {
    const { api, calls } = client(() => jsonResponse(null));
    // @ts-expect-error key_report is an admin_api function
    await expect(api.rpc('key_report', {})).rejects.toThrow(TypeError);
    expect(calls).toHaveLength(0);
  });

  it('refuses a secret key: public Workers must never hold one', () => {
    expect(() => createApiClient({ url: URL_BASE, publishableKey: SECRET_KEY })).toThrow(/secret key/);
    const jwt = [
      'eyJhbGciOiJIUzI1NiJ9',
      btoa(JSON.stringify({ role: 'service_role' })).replaceAll('=', ''),
      'sig',
    ].join('.');
    expect(() => createApiClient({ url: URL_BASE, publishableKey: jwt })).toThrow(/secret key/);
    try {
      createApiClient({ url: URL_BASE, publishableKey: SECRET_KEY });
    } catch (e) {
      expect(String(e)).not.toContain(SECRET_KEY);
    }
  });

  it('accepts a legacy anon JWT as the publishable key', () => {
    const anon = [
      'eyJhbGciOiJIUzI1NiJ9',
      btoa(JSON.stringify({ role: 'anon' })).replaceAll('=', ''),
      'sig',
    ].join('.');
    expect(() => createApiClient({ url: URL_BASE, publishableKey: anon })).not.toThrow();
  });
});
