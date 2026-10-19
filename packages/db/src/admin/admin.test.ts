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
      // signs api.ask_commit (CONTRACTS §5, amended 2026-10-19)
      'ask_secret_set',
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

  const keyOutcome: KeyOutcome = {
    provider: 'groq',
    fingerprint: 'abc123def456',
    account_label: 'one',
    status_code: 200,
    outcome: 'ok',
    retry_after_s: null,
    tokens: 120,
  };

  // The real admin_api.key_report (supabase/migrations/0103_keys_governor.sql, app.apply_key_outcomes) returns
  // { applied: int, disabled: [{ provider, fingerprint, reason }], breakers_opened: [provider] }.
  it('keyReport sends the outcomes as p and returns the real result shape (empty lists)', async () => {
    const result = { applied: 1, disabled: [], breakers_opened: [] };
    const { db, calls } = admin(() => jsonResponse(result));
    await expect(db.keyReport([keyOutcome])).resolves.toEqual(result);
    expect(calls[0]!.url).toMatch(/\/rpc\/key_report$/);
    expect(calls[0]!.body).toEqual({ p: [keyOutcome] });
  });

  it('keyReport returns the disabled keys and the opened breakers so a caller can alert', async () => {
    const result = {
      applied: 3,
      disabled: [
        { provider: 'groq', fingerprint: 'abc123def456', reason: 'auth' },
        { provider: 'exa', fingerprint: '0123456789ab', reason: 'credits' },
      ],
      breakers_opened: ['firecrawl'],
    };
    const { db } = admin(() => jsonResponse(result));
    const report = await db.keyReport([keyOutcome]);
    expect(report).toEqual(result);
    expect(report.disabled.map((d) => `${d.provider}:${d.reason}`)).toEqual(['groq:auth', 'exa:credits']);
    expect(report.breakers_opened).toEqual(['firecrawl']);
  });

  it.each([
    ['counts instead of lists (the old, wrong shape)', { applied: 1, disabled: 0, breakers_opened: 0 }],
    ['applied that is not a number', { applied: 'one', disabled: [], breakers_opened: [] }],
    ['a missing field', { applied: 1, disabled: [] }],
    ['a disabled entry that is not an object', { applied: 1, disabled: ['groq'], breakers_opened: [] }],
    [
      'a disabled entry without a fingerprint',
      { applied: 1, disabled: [{ provider: 'groq', reason: 'auth' }], breakers_opened: [] },
    ],
    [
      'a disabled entry with an unknown provider',
      {
        applied: 1,
        disabled: [{ provider: 'openai', fingerprint: 'abc123def456', reason: 'auth' }],
        breakers_opened: [],
      },
    ],
    ['a breaker that is not a provider', { applied: 1, disabled: [], breakers_opened: ['openai'] }],
    ['breakers as objects', { applied: 1, disabled: [], breakers_opened: [{ provider: 'groq' }] }],
    ['an array instead of an object', []],
  ])('keyReport fails with a decode error for %s', async (_name, body) => {
    const { db } = admin(() => jsonResponse(body));
    await expect(db.keyReport([keyOutcome])).rejects.toMatchObject({ kind: 'decode', fn: 'key_report' });
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

  it('askSecretSet sends the secret by name and returns only {rotated}', async () => {
    const secret = 'example-ask-commit-secret-not-real-0001';
    const { db, calls } = admin(() => jsonResponse({ rotated: false }));
    await expect(db.askSecretSet(secret)).resolves.toEqual({ rotated: false });
    expect(calls[0]!.url).toBe(`${URL_BASE}/rest/v1/rpc/ask_secret_set`);
    expect(calls[0]!.headers['content-profile']).toBe('admin_api');
    expect(calls[0]!.body).toEqual({ secret });
    const rotated = admin(() => jsonResponse({ rotated: true }));
    await expect(rotated.db.askSecretSet(secret)).resolves.toEqual({ rotated: true });
    const bad = admin(() => jsonResponse({ rotated: 'yes' }));
    await expect(bad.db.askSecretSet(secret)).rejects.toMatchObject({ kind: 'decode', fn: 'ask_secret_set' });
  });

  it('askSecretSet never puts the secret into an error, whatever the failure and whoever echoes it', async () => {
    const secret = 'example-ask-commit-secret-not-real-0001';
    const echo = `invalid input: ${secret}`;
    const failures: [string, Parameters<typeof mockFetch>[0], string][] = [
      ['http', () => jsonResponse({ code: '22023', message: echo }, 400), 'http'],
      ['http (secret in the code)', () => jsonResponse({ code: secret, message: 'nope' }, 400), 'http'],
      ['decode', () => jsonResponse({ echoed: secret }), 'decode'],
      ['network', () => Promise.reject(new TypeError(echo)), 'network'],
    ];
    for (const [name, responder, kind] of failures) {
      const error = await admin(responder)
        .db.askSecretSet(secret)
        .then(
          () => {
            throw new Error(`${name}: expected askSecretSet to reject`);
          },
          (e: unknown) => e,
        );
      expect(error, name).toMatchObject({ kind, fn: 'ask_secret_set' });
      expect((error as DbError).message, name).not.toContain(secret);
      expect(String((error as DbError).code), name).not.toContain(secret);
      expect(JSON.stringify(error, Object.getOwnPropertyNames(error)), name).not.toContain(secret);
    }
    // The secret is still sent to the database.
    const ok = admin(() => jsonResponse({ rotated: false }));
    await ok.db.askSecretSet(secret);
    expect(ok.calls[0]!.body).toEqual({ secret });
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
