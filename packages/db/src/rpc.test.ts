import { afterEach, describe, expect, it, vi } from 'vitest';
import { DbError, createRpc } from './rpc.ts';
import { hangingFetch, jsonResponse, mockFetch } from './testing.ts';

const URL_BASE = 'https://example-project.supabase.co';
const KEY = ['sb', 'publishable', 'abcdefghijklmnop'].join('_');
const allowed = ['submit_lead', 'ask_result'] as const;

afterEach(() => vi.restoreAllMocks());

function expectDbError(error: unknown, kind: DbError['kind']): DbError {
  expect(error).toBeInstanceOf(DbError);
  expect((error as DbError).kind).toBe(kind);
  return error as DbError;
}

describe('createRpc request', () => {
  it('POSTs to /rest/v1/rpc/{fn} with the PostgREST headers and the arguments as the JSON body', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ ok: true }));
    const rpc = createRpc({ url: URL_BASE, key: KEY, schema: 'api', allowed, fetch });
    const out = await rpc.call('submit_lead', { p: { a: 1 } });
    expect(out).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe(`${URL_BASE}/rest/v1/rpc/submit_lead`);
    expect(call.method).toBe('POST');
    expect(call.headers).toMatchObject({
      apikey: KEY,
      authorization: `Bearer ${KEY}`,
      'content-profile': 'api',
      'content-type': 'application/json',
    });
    expect(call.body).toEqual({ p: { a: 1 } });
  });

  it('tolerates a trailing slash on the URL', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse(null));
    const rpc = createRpc({ url: `${URL_BASE}/`, key: KEY, schema: 'api', allowed, fetch });
    await rpc.call('submit_lead', {});
    expect(calls[0]!.url).toBe(`${URL_BASE}/rest/v1/rpc/submit_lead`);
  });

  it('uses the admin_api profile when asked to', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse(null));
    const rpc = createRpc({ url: URL_BASE, key: KEY, schema: 'admin_api', allowed: ['key_report'], fetch });
    await rpc.call('key_report', { p: [] });
    expect(calls[0]!.headers['content-profile']).toBe('admin_api');
  });

  it('refuses a function outside its schema, before any request is made', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse(null));
    const rpc = createRpc({ url: URL_BASE, key: KEY, schema: 'api', allowed, fetch });
    await expect(rpc.call('key_report', {})).rejects.toThrow(TypeError);
    await expect(rpc.call('../admin_api/key_report', {})).rejects.toThrow(/not an api\.\* function/);
    expect(calls).toHaveLength(0);
  });

  it('rejects a bad URL, an empty key and a bad timeout when it is created, without echoing the key', () => {
    const make = (over: Record<string, unknown>) =>
      createRpc({ url: URL_BASE, key: KEY, schema: 'api', allowed, ...over });
    expect(() => make({ url: 'not a url' })).toThrow(TypeError);
    expect(() => make({ url: 'ftp://example.com' })).toThrow(/http/);
    expect(() => make({ key: '' })).toThrow(TypeError);
    expect(() => make({ timeoutMs: 0 })).toThrow(TypeError);
    expect(() => make({ timeoutMs: Number.NaN })).toThrow(TypeError);
  });
});

describe('createRpc responses', () => {
  it('treats 204 and an empty 200 body as no value', async () => {
    for (const res of [new Response(null, { status: 204 }), new Response('', { status: 200 })]) {
      const { fetch } = mockFetch(() => res);
      const rpc = createRpc({ url: URL_BASE, key: KEY, schema: 'api', allowed, fetch });
      await expect(rpc.call('submit_lead', {})).resolves.toBeUndefined();
    }
  });

  it('validates the body with the given parser and returns its output', async () => {
    const { fetch } = mockFetch(() => jsonResponse({ n: 3 }));
    const rpc = createRpc({ url: URL_BASE, key: KEY, schema: 'api', allowed, fetch });
    const parser = {
      safeParse: (v: unknown) =>
        typeof (v as { n?: unknown }).n === 'number'
          ? { success: true as const, data: (v as { n: number }).n * 2 }
          : { success: false as const, error: { issues: [{ path: ['n'], message: 'must be a number' }] } },
    };
    await expect(rpc.call('submit_lead', {}, parser)).resolves.toBe(6);
  });

  it('a body that fails the parser is a decode error naming the path, not the value', async () => {
    const { fetch } = mockFetch(() => jsonResponse({ n: 'secret-looking-value' }));
    const rpc = createRpc({ url: URL_BASE, key: KEY, schema: 'api', allowed, fetch });
    const parser = {
      safeParse: () => ({
        success: false as const,
        error: { issues: [{ path: ['n'], message: 'Invalid input: expected number, received string' }] },
      }),
    };
    const error = expectDbError(await rpc.call('submit_lead', {}, parser).catch((e: unknown) => e), 'decode');
    expect(error.fn).toBe('submit_lead');
    expect(error.message).toContain('n: Invalid input');
    expect(error.message).not.toContain('secret-looking-value');
  });

  it('a body that is not JSON is a decode error', async () => {
    const { fetch } = mockFetch(() => new Response('<html>oops</html>', { status: 200 }));
    const rpc = createRpc({ url: URL_BASE, key: KEY, schema: 'api', allowed, fetch });
    expectDbError(await rpc.call('submit_lead', {}).catch((e: unknown) => e), 'decode');
  });

  it('an HTTP error carries status, fn and the PostgREST code and message', async () => {
    const { fetch } = mockFetch(() =>
      jsonResponse({ code: '42501', message: 'permission denied for function submit_lead' }, 401),
    );
    const rpc = createRpc({ url: URL_BASE, key: KEY, schema: 'api', allowed, fetch });
    const error = expectDbError(await rpc.call('submit_lead', {}).catch((e: unknown) => e), 'http');
    expect(error.status).toBe(401);
    expect(error.fn).toBe('submit_lead');
    expect(error.code).toBe('42501');
    expect(error.message).toContain('permission denied for function submit_lead');
    expect(error.name).toBe('DbError');
  });

  it('an HTTP error with a non-JSON body still reports the status', async () => {
    const { fetch } = mockFetch(() => new Response('Bad Gateway', { status: 502 }));
    const rpc = createRpc({ url: URL_BASE, key: KEY, schema: 'api', allowed, fetch });
    const error = expectDbError(await rpc.call('submit_lead', {}).catch((e: unknown) => e), 'http');
    expect(error.status).toBe(502);
    expect(error.code).toBeNull();
  });

  it('a rejected fetch is a network error', async () => {
    const fetchImpl = (() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch;
    const rpc = createRpc({ url: URL_BASE, key: KEY, schema: 'api', allowed, fetch: fetchImpl });
    const error = expectDbError(await rpc.call('submit_lead', {}).catch((e: unknown) => e), 'network');
    expect(error.status).toBeNull();
    expect(error.message).toContain('fetch failed');
  });
});

describe('createRpc timeouts', () => {
  it('times out after timeoutMs with kind "timeout"', async () => {
    const rpc = createRpc({
      url: URL_BASE,
      key: KEY,
      schema: 'api',
      allowed,
      fetch: hangingFetch(),
      timeoutMs: 25,
    });
    const error = expectDbError(await rpc.call('submit_lead', {}).catch((e: unknown) => e), 'timeout');
    expect(error.message).toContain('25ms');
    expect(error.fn).toBe('submit_lead');
  });

  it('defaults to 8000 ms and passes the abort signal to fetch', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    const { fetch, calls } = mockFetch(() => jsonResponse(null));
    const rpc = createRpc({ url: URL_BASE, key: KEY, schema: 'api', allowed, fetch });
    await rpc.call('submit_lead', {});
    expect(spy).toHaveBeenCalledWith(8000);
    expect(calls[0]!.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('createRpc never leaks the key', () => {
  it('keeps the key out of every error kind, even when the server echoes it', async () => {
    const echo = mockFetch(() => jsonResponse({ code: 'X', message: `bad token ${KEY} for user` }, 401));
    const cases: [DbError['kind'], typeof fetch, number?][] = [
      ['http', echo.fetch],
      ['network', (() => Promise.reject(new TypeError(`failed with ${KEY}`))) as typeof fetch],
      ['timeout', hangingFetch(), 20],
      ['decode', mockFetch(() => new Response(`not json ${KEY}`)).fetch],
    ];
    for (const [kind, fetchImpl, timeoutMs] of cases) {
      const rpc = createRpc({
        url: URL_BASE,
        key: KEY,
        schema: 'api',
        allowed,
        fetch: fetchImpl,
        ...(timeoutMs ? { timeoutMs } : {}),
      });
      const error = expectDbError(await rpc.call('submit_lead', {}).catch((e: unknown) => e), kind);
      const everything = [
        error.message,
        String(error),
        error.stack ?? '',
        JSON.stringify(error),
        JSON.stringify({ ...error }),
      ].join('\n');
      expect(everything, kind).not.toContain(KEY);
    }
  });
});
