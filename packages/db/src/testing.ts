// Test support for @mm/db (not part of any subpath export, excluded from the Workers-safe typecheck).
// Mocked `fetch` and a minimal valid catalogue snapshot, so no test touches the network.
import type { CatalogueSnapshot } from '@mm/core/schema';

export interface RecordedCall {
  url: string;
  method: string;
  /** Header names are lower-cased. */
  headers: Record<string, string>;
  /** The JSON body, parsed. */
  body: unknown;
  signal: AbortSignal | null;
}

export type Responder = (call: RecordedCall) => Response | Promise<Response>;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** A `fetch` that records every call and answers with `responder`. */
export function mockFetch(responder: Responder): { fetch: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });
    const call: RecordedCall = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      signal: init?.signal ?? null,
    };
    calls.push(call);
    return responder(call);
  };
  return { fetch: impl as typeof fetch, calls };
}

/** A `fetch` that never answers until its signal aborts (to test timeouts). */
export function hangingFetch(): typeof fetch {
  return ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    })) as typeof fetch;
}

/** The smallest snapshot that passes `CatalogueSnapshotSchema`. */
export function emptySnapshot(overrides: Partial<CatalogueSnapshot> = {}): CatalogueSnapshot {
  return {
    snapshot_id: 'test-snapshot',
    generated_at: '2026-10-13T00:00:00Z',
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
    ...overrides,
  };
}
