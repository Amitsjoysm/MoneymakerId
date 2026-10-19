// @mm/db/admin (owner E01): the typed client for the `admin_api.*` functions (CONTRACTS §5), called with the
// SECRET (service-role) key.
//
// ADMIN WORKER, NODE SCRIPTS AND GITHUB ACTIONS ONLY. Never import this from the public apps (main, food,
// construction), from @mm/edge or from @mm/ui; a test in this package fails if they do. The file itself is
// free of Node-only imports, so the admin Worker can use it, but that is no licence to bundle a secret key
// into a public Worker.
import {
  UpsertBusinessResultSchema,
  type BusinessUpsert,
  type KeyOutcome,
  type PageBuildsRecordInput,
  type Provider,
  type UpsertBusinessResult,
} from '@mm/core/schema';
import { createRpc, type Parser } from '../rpc.ts';

export { DbError, DEFAULT_TIMEOUT_MS, type DbErrorKind, type Parser } from '../rpc.ts';

/** Every function of the `admin_api` schema (CONTRACTS §5), grouped as the contract groups them. */
export const ADMIN_API_FUNCTIONS = [
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

/** `admin_api.key_report` result. */
export interface KeyReportResult {
  applied: number;
  disabled: number;
  breakers_opened: number;
}

/** `admin_api.governor_set_budget` input: `reserved_ask` and `breaker_open_until` are left alone when absent. */
export interface GovernorBudgetInput {
  provider: Provider;
  budget: number;
  reserved_ask?: number;
  breaker_open_until?: string | null;
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
  keyReport(outcomes: KeyOutcome[]): Promise<KeyReportResult>;
  /** Fingerprints of the provider's usable keys, least used first. */
  credentialsUsable(provider: Provider): Promise<string[]>;
  governorSetBudget(input: GovernorBudgetInput): Promise<GovernorRow>;
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

const KeyReportResultParser = shape<KeyReportResult>(
  '{ applied, disabled, breakers_opened } as numbers',
  (v) => isRecord(v) && isNumber(v['applied']) && isNumber(v['disabled']) && isNumber(v['breakers_opened']),
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
    upsertBusiness: (business) => rpc('upsert_business', { p: business }, UpsertBusinessResultSchema),
    pageBuildsRecord: async (input) => void (await rpc('page_builds_record', { p: input })),
  };
}
