// Shared PostgREST RPC transport for the `api` and `admin_api` clients (CONTRACTS §5).
//
// Plain `fetch`: `POST {url}/rest/v1/rpc/{fn}` with the key in `apikey` and `Authorization`, and the schema in
// `Content-Profile`. The URL and key are constructor arguments; nothing here reads a global except `fetch`
// itself (resolved at call time, so it can be replaced in tests). Runs on Node and on Cloudflare Workers.
import { formatIssues } from './issues.ts';

export type DbErrorKind = 'timeout' | 'http' | 'network' | 'decode';

/** Every failure of a database call. The message never contains the key. */
export class DbError extends Error {
  readonly kind: DbErrorKind;
  /** The HTTP status, or null when no response was received (timeout, network) or read (decode of a 2xx). */
  readonly status: number | null;
  /** The function name without its schema, such as `submit_lead`. */
  readonly fn: string;
  /** The PostgREST / SQLSTATE `code` of an HTTP error body, such as `42501`, when it had one. */
  readonly code: string | null;

  constructor(
    kind: DbErrorKind,
    fn: string,
    message: string,
    status: number | null = null,
    code: string | null = null,
  ) {
    super(message);
    this.name = 'DbError';
    this.kind = kind;
    this.fn = fn;
    this.status = status;
    this.code = code;
  }
}

/** What the transport needs from a Zod schema (structural, so @mm/db does not depend on zod itself). */
export interface Parser<T> {
  safeParse(
    input: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> } };
}

export interface RpcOptions {
  /** The Supabase project URL, `https://<ref>.supabase.co`. */
  url: string;
  /** The publishable key (`api`) or the secret key (`admin_api`). */
  key: string;
  schema: 'api' | 'admin_api';
  /** The function names this client may call, checked at run time. */
  allowed: readonly string[];
  /** Replaces the global `fetch` (tests, or a Workers service binding). */
  fetch?: typeof fetch;
  /** Default 8000. */
  timeoutMs?: number;
}

export interface Rpc {
  /** Calls `fn` with the named arguments `args` (the PostgREST body). Without a parser the JSON body is returned as is. */
  call(fn: string, args: Record<string, unknown>): Promise<unknown>;
  call<T>(fn: string, args: Record<string, unknown>, parser: Parser<T>): Promise<T>;
}

export const DEFAULT_TIMEOUT_MS = 8000;
const MAX_MESSAGE = 300;

function isTimeout(e: unknown): boolean {
  const name = (e as { name?: unknown } | null)?.name;
  return name === 'TimeoutError' || name === 'AbortError';
}

export function createRpc(options: RpcOptions): Rpc {
  const { key, schema, allowed } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (typeof key !== 'string' || key.trim() === '') throw new TypeError('the database key is empty');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new TypeError('timeoutMs must be a positive number');
  let base: URL;
  try {
    base = new URL(options.url);
  } catch {
    throw new TypeError('the database URL is not a valid URL');
  }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') {
    throw new TypeError('the database URL must be http or https');
  }
  const origin = base.origin;
  const allowedSet = new Set(allowed);
  const customFetch = options.fetch;
  const redact = (text: string): string => (key.length >= 8 ? text.replaceAll(key, '[redacted]') : text);

  async function call(fn: string, args: Record<string, unknown>, parser?: Parser<unknown>): Promise<unknown> {
    if (!allowedSet.has(fn)) {
      throw new TypeError(`${JSON.stringify(fn)} is not an ${schema}.* function this client may call`);
    }
    const init: RequestInit = {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Profile': schema,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(timeoutMs),
    };
    const url = `${origin}/rest/v1/rpc/${fn}`;
    const timeout = () => new DbError('timeout', fn, `${schema}.${fn} timed out after ${timeoutMs}ms`);

    let response: Response;
    let text: string;
    try {
      response = await (customFetch ? customFetch(url, init) : globalThis.fetch(url, init));
      text = await response.text();
    } catch (e) {
      if (isTimeout(e)) throw timeout();
      const reason = e instanceof Error ? `${e.name}: ${e.message}` : 'unknown error';
      throw new DbError('network', fn, redact(`${schema}.${fn} could not be reached (${reason})`));
    }

    if (!response.ok) {
      let code: string | null = null;
      let detail = '';
      try {
        const body = JSON.parse(text) as { code?: unknown; message?: unknown };
        if (typeof body.code === 'string') code = body.code;
        if (typeof body.message === 'string') detail = body.message;
      } catch {
        // A non-JSON error body (a gateway page): the status alone is reported.
      }
      const suffix = detail ? `: ${redact(detail).slice(0, MAX_MESSAGE)}` : '';
      throw new DbError(
        'http',
        fn,
        `${schema}.${fn} failed with HTTP ${response.status}${code ? ` (${redact(code)})` : ''}${suffix}`,
        response.status,
        code === null ? null : redact(code),
      );
    }

    let value: unknown;
    if (text.trim() !== '') {
      try {
        value = JSON.parse(text);
      } catch {
        throw new DbError('decode', fn, `${schema}.${fn} returned a body that is not JSON`, response.status);
      }
    }
    if (!parser) return value;
    const result = parser.safeParse(value);
    if (!result.success) {
      throw new DbError(
        'decode',
        fn,
        redact(`${schema}.${fn} returned an unexpected shape: ${formatIssues(result.error.issues)}`),
        response.status,
      );
    }
    return result.data;
  }

  return { call } as Rpc;
}
