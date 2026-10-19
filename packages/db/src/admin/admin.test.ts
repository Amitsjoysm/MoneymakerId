import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { KeyOutcome } from '@mm/core/schema';
import { DbError } from '../rpc.ts';
import { jsonResponse, mockFetch } from '../testing.ts';
import { ADMIN_API_FUNCTIONS, createAdminClient } from './index.ts';

const URL_BASE = 'https://example-project.supabase.co';
const KEY = ['sb', 'secret', 'abcdefghijklmnop'].join('_');
const UUID = '5f0c3a52-7a43-4a58-9d1d-3a1c1f0b6a11';

function admin(responder: Parameters<typeof mockFetch>[0]) {
  const mock = mockFetch(responder);
  return { db: createAdminClient({ url: URL_BASE, secretKey: KEY, fetch: mock.fetch }), calls: mock.calls };
}

describe('ADMIN_API_FUNCTIONS', () => {
  it('is exactly the admin_api functions of CONTRACTS §5', () => {
    const contract = [
      // credentials and governor
      'key_report',
      'credentials_usable',
      'governor_set_budget',
      // catalogue
      'upsert_business',
      'evidence_insert',
      'import_reference',
      'experience_upsert',
      'photo_register',
      'provider_update',
      'cost_model_upsert',
      'local_fact_upsert',
      'prose_review_set',
      'queue_list',
      'queue_decide',
      // leads
      'leads_list',
      'lead_get',
      'lead_update',
      'lead_anonymise',
      'assignment_upsert',
      'outbox_replay',
      'lead_prices_set',
      'credits_add',
      // revenue and reports
      'featured_upsert',
      'campaign_upsert',
      'sales_quote_upsert',
      'metrics_weekly',
      'business_report',
      // pipeline, builds and ops
      'ranking_commit',
      'search_demand_upsert',
      'job_begin',
      'job_finish',
      'last_successful_run',
      'page_builds_record',
      'lead_paths_30d',
      'health_snapshot',
      'prune',
    ];
    expect([...ADMIN_API_FUNCTIONS].sort()).toEqual(contract.sort());
  });
});

describe('createAdminClient', () => {
  it('calls admin_api.* with the secret key and the admin_api profile', async () => {
    const { db, calls } = admin(() => jsonResponse({ ok: true }));
    await db.rpc('prune', { p: { days: 30 } });
    expect(calls[0]!.url).toBe(`${URL_BASE}/rest/v1/rpc/prune`);
    expect(calls[0]!.headers['content-profile']).toBe('admin_api');
    expect(calls[0]!.headers['apikey']).toBe(KEY);
    expect(calls[0]!.headers['authorization']).toBe(`Bearer ${KEY}`);
  });

  it('rpc() rejects api.* names at run time and at compile time', async () => {
    const { db, calls } = admin(() => jsonResponse(null));
    // @ts-expect-error submit_lead is an api function
    await expect(db.rpc('submit_lead', {})).rejects.toThrow(TypeError);
    expect(calls).toHaveLength(0);
  });

  it('keyReport sends the outcomes as p and returns the counts', async () => {
    const outcome: KeyOutcome = {
      provider: 'groq',
      fingerprint: 'abc123def456',
      account_label: 'one',
      status_code: 200,
      outcome: 'ok',
      retry_after_s: null,
      tokens: 120,
    };
    const counts = { applied: 1, disabled: 0, breakers_opened: 0 };
    const { db, calls } = admin(() => jsonResponse(counts));
    await expect(db.keyReport([outcome])).resolves.toEqual(counts);
    expect(calls[0]!.url).toMatch(/\/rpc\/key_report$/);
    expect(calls[0]!.body).toEqual({ p: [outcome] });
    const bad = admin(() => jsonResponse({ applied: 'one' }));
    await expect(bad.db.keyReport([outcome])).rejects.toMatchObject({ kind: 'decode', fn: 'key_report' });
  });

  it('credentialsUsable sends the provider and validates a list of fingerprints', async () => {
    const { db, calls } = admin(() => jsonResponse(['abc123def456']));
    await expect(db.credentialsUsable('exa')).resolves.toEqual(['abc123def456']);
    expect(calls[0]!.body).toEqual({ provider: 'exa' });
    const bad = admin(() => jsonResponse({ not: 'a list' }));
    await expect(bad.db.credentialsUsable('exa')).rejects.toMatchObject({ kind: 'decode' });
  });

  it('governorSetBudget sends p and returns the governor row', async () => {
    const row = {
      day: '2026-10-13',
      provider: 'groq',
      budget: 100,
      used: 3,
      reserved_ask: 50,
      breaker_open_until: null,
    };
    const { db, calls } = admin(() => jsonResponse(row));
    await expect(db.governorSetBudget({ provider: 'groq', budget: 100, reserved_ask: 50 })).resolves.toEqual(
      row,
    );
    expect(calls[0]!.body).toEqual({ p: { provider: 'groq', budget: 100, reserved_ask: 50 } });
    const bad = admin(() => jsonResponse({ day: '2026-10-13' }));
    await expect(bad.db.governorSetBudget({ provider: 'groq', budget: 100 })).rejects.toMatchObject({
      kind: 'decode',
    });
  });

  it('upsertBusiness validates the result', async () => {
    const result = { business_id: UUID, slug: 'example-cafe', action: 'inserted' };
    const { db } = admin(() => jsonResponse(result));
    await expect(db.upsertBusiness({} as never)).resolves.toEqual(result);
    const bad = admin(() => jsonResponse({ ...result, action: 'exploded' }));
    await expect(bad.db.upsertBusiness({} as never)).rejects.toBeInstanceOf(DbError);
  });

  it('pageBuildsRecord sends {build_id, entries} as p', async () => {
    const { db, calls } = admin(() => new Response(null, { status: 204 }));
    await db.pageBuildsRecord({ build_id: 'b1', entries: [] });
    expect(calls[0]!.body).toEqual({ p: { build_id: 'b1', entries: [] } });
  });

  it('http errors keep the secret key out of the message', async () => {
    const { db } = admin(() => jsonResponse({ code: '42501', message: `denied for ${KEY}` }, 403));
    const error = await db.rpc('prune', {}).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'http', status: 403, fn: 'prune' });
    expect(String((error as Error).message)).not.toContain(KEY);
  });
});

// "/admin" holds the secret key's client: admin Worker, Node scripts and CI only (CONTRACTS §5, §10).
describe('the @mm/db/admin boundary', () => {
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
  const publicRoots = ['apps/main', 'apps/food', 'apps/construction', 'packages/edge', 'packages/ui'];

  function sources(dir: string): string[] {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return [];
    }
    return names.flatMap((name) => {
      if (name === 'node_modules' || name === 'dist' || name === '.astro') return [];
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sources(path);
      return /\.(ts|mts|js|mjs|astro)$/.test(name) ? [path] : [];
    });
  }

  it('is imported by none of the public Workers apps, @mm/edge or @mm/ui', () => {
    const offenders = publicRoots
      .flatMap((root) => sources(join(repo, root)))
      .filter((file) => readFileSync(file, 'utf8').includes('@mm/db/admin'))
      .map((file) => file.slice(repo.length + 1));
    expect(offenders).toEqual([]);
  });
});
