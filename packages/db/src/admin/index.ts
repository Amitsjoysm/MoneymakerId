// @mm/db/admin (owner E01): the typed client for the `admin_api.*` functions (CONTRACTS §5), called with the
// SECRET (service-role) key.
//
// ADMIN WORKER, NODE SCRIPTS AND GITHUB ACTIONS ONLY. Never import this from the public apps (main, food,
// construction), from @mm/edge or from @mm/ui; a test in this package fails if they do. The file itself is
// free of Node-only imports, so the admin Worker can use it, but that is no licence to bundle a secret key
// into a public Worker.
import {
  ProviderSchema,
  UpsertBusinessResultSchema,
  type BusinessUpsert,
  type KeyOutcome,
  type PageBuildsRecordInput,
  type Provider,
  type UpsertBusinessResult,
} from '@mm/core/schema';
import { createRpc, DbError, type Parser } from '../rpc.ts';

export { DbError, DEFAULT_TIMEOUT_MS, type DbErrorKind, type Parser } from '../rpc.ts';

/** Every function of the `admin_api` schema (CONTRACTS §5), grouped as the contract groups them. */
export const ADMIN_API_FUNCTIONS = [
  // credentials and governor
  'key_report',
  'credentials_usable',
  'governor_set_budget',
  // stores the secret that signs api.ask_commit (CONTRACTS §5, amended 2026-10-19)
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
] as const;
export type AdminFunctionName = (typeof ADMIN_API_FUNCTIONS)[number];

export interface AdminClientConfig {
  /** The Supabase project URL (`SUPABASE_URL`). */
  url: string;
  /** The secret key (`SUPABASE_SECRET_KEY`). */
  secretKey: string;
  /** Replaces the global `fetch`. */
  fetch?: typeof fetch;
  /** Default 8000. */
  timeoutMs?: number;
}

/** A key that `admin_api.key_report` has just disabled (401/403 is `auth`, 402 is `credits`). */
export interface DisabledKey {
  provider: Provider;
  fingerprint: string;
  reason: string;
}

/**
 * `admin_api.key_report` result, as `app.apply_key_outcomes` returns it (migration 0103): how many outcomes were
 * applied, the keys this call disabled and the providers whose circuit breaker it opened, so the caller can alert.
 */
export interface KeyReportResult {
  applied: number;
  disabled: DisabledKey[];
  breakers_opened: Provider[];
}

/** `admin_api.governor_set_budget` input: `reserved_ask` and `breaker_open_until` are left alone when absent. */
export interface GovernorBudgetInput {
  provider: Provider;
  budget: number;
  reserved_ask?: number;
  breaker_open_until?: string | null;
}

/** `admin_api.ask_secret_set` result: whether a secret was already stored and has now been replaced. */
export interface AskSecretSetResult {
  rotated: boolean;
}

/** Today's governor row, as `admin_api.governor_set_budget` returns it. */
export interface GovernorRow {
  day: string;
  provider: Provider;
  budget: number;
  used: number;
  reserved_ask: number;
  breaker_open_until: string | null;
}

export interface AdminClient {
  /** Calls any `admin_api.*` function with named arguments (the PostgREST body, such as `{ p: … }`). */
  rpc(fn: AdminFunctionName, args: Record<string, unknown>): Promise<unknown>;
  rpc<T>(fn: AdminFunctionName, args: Record<string, unknown>, parser: Parser<T>): Promise<T>;
  /** Applies the outcomes in order. Returns the keys it disabled and the breakers it opened (alert data). */
  keyReport(outcomes: KeyOutcome[]): Promise<KeyReportResult>;
  /** Fingerprints of the provider's usable keys, least used first. */
  credentialsUsable(provider: Provider): Promise<string[]>;
  governorSetBudget(input: GovernorBudgetInput): Promise<GovernorRow>;
  /**
   * Stores `ASK_COMMIT_SECRET` (32 to 256 characters) in the database at deploy time. `api.ask_commit` accepts only
   * calls signed with `HMAC-SHA256(secret, lookup_id)`. The database never returns the secret.
   */
  askSecretSet(secret: string): Promise<AskSecretSetResult>;
  upsertBusiness(business: BusinessUpsert): Promise<UpsertBusinessResult>;
  pageBuildsRecord(input: PageBuildsRecordInput): Promise<void>;
}

/** A parser for the few results T01 has no Zod schema for. */
function shape<T>(what: string, test: (value: unknown) => boolean): Parser<T> {
  return {
    safeParse: (value) =>
      test(value)
        ? { success: true, data: value as T }
        : { success: false, error: { issues: [{ path: [], message: `expected ${what}` }] } },
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);

const isProvider = (v: unknown): v is Provider => ProviderSchema.safeParse(v).success;
const isDisabledKey = (v: unknown): boolean =>
  isRecord(v) &&
  isProvider(v['provider']) &&
  typeof v['fingerprint'] === 'string' &&
  typeof v['reason'] === 'string';

const KeyReportResultParser = shape<KeyReportResult>(
  '{ applied: number, disabled: { provider, fingerprint, reason }[], breakers_opened: provider[] }',
  (v) =>
    isRecord(v) &&
    isNumber(v['applied']) &&
    Array.isArray(v['disabled']) &&
    v['disabled'].every(isDisabledKey) &&
    Array.isArray(v['breakers_opened']) &&
    v['breakers_opened'].every(isProvider),
);
const AskSecretSetResultParser = shape<AskSecretSetResult>(
  '{ rotated } as a boolean',
  (v) => isRecord(v) && typeof v['rotated'] === 'boolean',
);
const FingerprintsParser = shape<string[]>(
  'a list of key fingerprints',
  (v) => Array.isArray(v) && v.every((x) => typeof x === 'string'),
);
const GovernorRowParser = shape<GovernorRow>(
  'a governor row',
  (v) =>
    isRecord(v) &&
    typeof v['day'] === 'string' &&
    typeof v['provider'] === 'string' &&
    isNumber(v['budget']) &&
    isNumber(v['used']) &&
    isNumber(v['reserved_ask']),
);

/**
 * Runs `attempt` and, if it fails with a `DbError`, replaces every copy of `secret` in the error with
 * `[redacted]`. The transport redacts only the API key; a request argument that is itself a secret (the Ask
 * signing secret) is handled here, in case a database error message ever echoes it.
 */
async function withoutSecret<T>(secret: string, attempt: () => Promise<T>): Promise<T> {
  try {
    return await attempt();
  } catch (e) {
    if (!(e instanceof DbError) || secret === '') throw e;
    const hide = (text: string): string => text.replaceAll(secret, '[redacted]');
    throw new DbError(e.kind, e.fn, hide(e.message), e.status, e.code === null ? null : hide(e.code));
  }
}

export function createAdminClient(config: AdminClientConfig): AdminClient {
  const { call } = createRpc({
    url: config.url,
    key: config.secretKey,
    schema: 'admin_api',
    allowed: ADMIN_API_FUNCTIONS,
    ...(config.fetch ? { fetch: config.fetch } : {}),
    ...(config.timeoutMs === undefined ? {} : { timeoutMs: config.timeoutMs }),
  });
  const rpc = ((fn: AdminFunctionName, args: Record<string, unknown>, parser?: Parser<unknown>) =>
    parser ? call(fn, args, parser) : call(fn, args)) as AdminClient['rpc'];

  return {
    rpc,
    keyReport: (outcomes) => rpc('key_report', { p: outcomes }, KeyReportResultParser),
    credentialsUsable: (provider) => rpc('credentials_usable', { provider }, FingerprintsParser),
    governorSetBudget: (input) => rpc('governor_set_budget', { p: input }, GovernorRowParser),
    askSecretSet: (secret) =>
      withoutSecret(secret, () => rpc('ask_secret_set', { secret }, AskSecretSetResultParser)),
    upsertBusiness: (business) => rpc('upsert_business', { p: business }, UpsertBusinessResultSchema),
    pageBuildsRecord: async (input) => void (await rpc('page_builds_record', { p: input })),
  };
}
