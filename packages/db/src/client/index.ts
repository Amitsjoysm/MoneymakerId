// @mm/db/client (owner E01): the typed client for the public `api.*` functions (CONTRACTS §5), called with the
// PUBLISHABLE key. Safe on Node and on the Workers runtime. It can only call the 🌐 functions, enforced by the
// `ApiFunctionName` type and again at run time, and it refuses a secret key outright, so a public Worker that is
// misconfigured with the wrong key fails at start-up instead of working with too much power.
import {
  AskBeginResultSchema,
  AskResultOutputSchema,
  AskSearchResultSchema,
  CatalogueSnapshotSchema,
  SubmitLeadResultSchema,
  type AskBeginInput,
  type AskBeginResult,
  type AskCommitInput,
  type AskResultOutput,
  type AskSearchInput,
  type CatalogueSnapshot,
  type AskItem,
  type LeadInsert,
  type RecordEventsInput,
  type SubmitFeedbackInput,
  type SubmitLeadResult,
} from '@mm/core/schema';
import { createRpc, type Parser } from '../rpc.ts';

export { DbError, DEFAULT_TIMEOUT_MS, type DbErrorKind, type Parser } from '../rpc.ts';

/** The functions of the `api` schema that the publishable key may call. */
export const API_FUNCTIONS = [
  'submit_lead',
  'record_events',
  'submit_feedback',
  'ask_search',
  'ask_begin',
  'ask_commit',
  'ask_result',
  'export_catalogue',
] as const;
export type ApiFunctionName = (typeof API_FUNCTIONS)[number];

export interface ApiClientConfig {
  /** The Supabase project URL (`SUPABASE_URL`). */
  url: string;
  /** The publishable key (`SUPABASE_PUBLISHABLE_KEY`). */
  publishableKey: string;
  /** Replaces the global `fetch`. */
  fetch?: typeof fetch;
  /** Default 8000. */
  timeoutMs?: number;
}

export interface ApiClient {
  /** Calls any `api.*` function with named arguments; prefer the typed methods. */
  rpc(fn: ApiFunctionName, args: Record<string, unknown>): Promise<unknown>;
  rpc<T>(fn: ApiFunctionName, args: Record<string, unknown>, parser: Parser<T>): Promise<T>;
  submitLead(lead: LeadInsert): Promise<SubmitLeadResult>;
  recordEvents(input: RecordEventsInput): Promise<void>;
  submitFeedback(input: SubmitFeedbackInput): Promise<void>;
  askSearch(input: AskSearchInput): Promise<AskItem[]>;
  askBegin(input: AskBeginInput): Promise<AskBeginResult>;
  askCommit(input: AskCommitInput): Promise<void>;
  askResult(id: string): Promise<AskResultOutput>;
  exportCatalogue(): Promise<CatalogueSnapshot>;
}

/** A Supabase secret key (`sb_secret_…`) or a legacy JWT whose role is `service_role`. */
function looksLikeSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload: unknown = JSON.parse(atob(parts[1]!.replaceAll('-', '+').replaceAll('_', '/')));
    return (payload as { role?: unknown } | null)?.role === 'service_role';
  } catch {
    return false;
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  if (looksLikeSecretKey(config.publishableKey)) {
    throw new TypeError(
      'createApiClient was given a secret key; the public client takes the publishable key only',
    );
  }
  const { call } = createRpc({
    url: config.url,
    key: config.publishableKey,
    schema: 'api',
    allowed: API_FUNCTIONS,
    ...(config.fetch ? { fetch: config.fetch } : {}),
    ...(config.timeoutMs === undefined ? {} : { timeoutMs: config.timeoutMs }),
  });
  const rpc = ((fn: ApiFunctionName, args: Record<string, unknown>, parser?: Parser<unknown>) =>
    parser ? call(fn, args, parser) : call(fn, args)) as ApiClient['rpc'];

  return {
    rpc,
    submitLead: (lead) => rpc('submit_lead', { p: lead }, SubmitLeadResultSchema),
    recordEvents: async (input) => void (await rpc('record_events', { p: input })),
    submitFeedback: async (input) => void (await rpc('submit_feedback', { p: input })),
    askSearch: (input) => rpc('ask_search', { p: input }, AskSearchResultSchema),
    askBegin: (input) => rpc('ask_begin', { p: input }, AskBeginResultSchema),
    askCommit: async (input) => void (await rpc('ask_commit', { p: input })),
    askResult: (id) => rpc('ask_result', { id }, AskResultOutputSchema),
    exportCatalogue: () => rpc('export_catalogue', {}, CatalogueSnapshotSchema),
  };
}
