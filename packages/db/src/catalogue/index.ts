// @mm/db/catalogue (owner E01): the catalogue snapshot loader (CONTRACTS §6). Every build starts here.
//
// `DATA_SOURCE=supabase` (production): `api.export_catalogue()` through the publishable-key client. Any error
//   fails the build; there is no fallback to fixtures, and a snapshot that contains an "Example …" business is
//   refused.
// `DATA_SOURCE=fixtures` (CI and development only): localities, dishes, services, cost models and locality
//   guides from `data/*.json` and `content/` through the T01 loaders, and the fake businesses, evidence,
//   experiences and recommendations from `packages/db/fixtures/catalogue.json`. NODE ONLY: it reads the disk.
//
// Page views never come here: this runs at build time.
import {
  fileExists,
  loadCostModels,
  loadDishes,
  loadLocalities,
  loadLocalityGuides,
  loadServices,
} from '@mm/core/config';
import { CatalogueSnapshotSchema, type CatalogueSnapshot } from '@mm/core/schema';
import { createApiClient, type ApiClient } from '../client/index.ts';
import { isFixtureBusinessName, loadFixtureCatalogue } from '../fixtures/index.ts';
import { formatIssues } from '../issues.ts';

export type DataSource = 'supabase' | 'fixtures';

/** A problem with how the snapshot is configured or with what it contains (not a database or file error). */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

export interface SupabaseSnapshotOptions {
  dataSource: 'supabase';
  /** A ready client; takes precedence over `supabase`. */
  client?: Pick<ApiClient, 'exportCatalogue'>;
  /** `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. */
  supabase?: { url: string; publishableKey: string; fetch?: typeof fetch; timeoutMs?: number };
}

export interface FixturesSnapshotOptions {
  dataSource: 'fixtures';
  /** The repository root. Default: found by walking up to `pnpm-workspace.yaml`. */
  root?: string;
  /** Stamps `generated_at`. Default: now. */
  now?: Date;
  /** Receives warnings. Default: `console.warn`. */
  warn?: (message: string) => void;
}

export type LoadSnapshotOptions = SupabaseSnapshotOptions | FixturesSnapshotOptions;

/** Parses `DATA_SOURCE`. A missing or unknown value is an error: the mode is never guessed. */
export function parseDataSource(value: string | null | undefined): DataSource {
  if (value === 'supabase' || value === 'fixtures') return value;
  throw new SnapshotError(
    `DATA_SOURCE must be "supabase" or "fixtures"; got ${value ? JSON.stringify(value) : 'nothing'}`,
  );
}

const MAX_LISTED = 5;

/**
 * The production build check: with `DATA_SOURCE=supabase`, any place or provider named "Example …" is a fixture
 * that leaked into real data, and this throws. With `fixtures` it does nothing. The default is the strict one.
 */
export function assertNoFixtureBusinesses(
  snapshot: Pick<CatalogueSnapshot, 'places' | 'providers'>,
  dataSource: DataSource = 'supabase',
): void {
  if (dataSource !== 'supabase') return;
  const offenders = [...snapshot.places, ...snapshot.providers]
    .map((b) => b.name)
    .filter(isFixtureBusinessName);
  if (offenders.length === 0) return;
  const listed = offenders.slice(0, MAX_LISTED).join(', ');
  const more = offenders.length > MAX_LISTED ? `, and ${offenders.length - MAX_LISTED} more` : '';
  throw new SnapshotError(
    `DATA_SOURCE=supabase but the catalogue contains ${offenders.length} fixture business(es) named "Example …": ${listed}${more}`,
  );
}

/** The options for `loadSnapshot` from build-time environment values (`import.meta.env` or `process.env`). */
export function snapshotOptionsFromEnv(env: Record<string, string | undefined>): LoadSnapshotOptions {
  const dataSource = parseDataSource(env['DATA_SOURCE']);
  if (dataSource === 'fixtures') return { dataSource };
  const url = env['SUPABASE_URL'];
  const publishableKey = env['SUPABASE_PUBLISHABLE_KEY'];
  const missing = [!url && 'SUPABASE_URL', !publishableKey && 'SUPABASE_PUBLISHABLE_KEY'].filter(Boolean);
  if (missing.length > 0) {
    throw new SnapshotError(`DATA_SOURCE=supabase needs ${missing.join(' and ')}`);
  }
  return { dataSource, supabase: { url: url!, publishableKey: publishableKey! } };
}

async function loadFromSupabase(options: SupabaseSnapshotOptions): Promise<CatalogueSnapshot> {
  let client = options.client;
  if (!client) {
    const config = options.supabase;
    if (!config) {
      throw new SnapshotError(
        'DATA_SOURCE=supabase needs a client, or SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY',
      );
    }
    if (!config.url) throw new SnapshotError('DATA_SOURCE=supabase needs SUPABASE_URL');
    if (!config.publishableKey)
      throw new SnapshotError('DATA_SOURCE=supabase needs SUPABASE_PUBLISHABLE_KEY');
    client = createApiClient(config);
  }
  const snapshot = await client.exportCatalogue();
  assertNoFixtureBusinesses(snapshot, 'supabase');
  return snapshot;
}

function loadFromFixtures(options: FixturesSnapshotOptions): CatalogueSnapshot {
  const warn = options.warn ?? ((message: string) => console.warn(message));
  const load = options.root === undefined ? {} : { root: options.root };

  // data/localities.json and data/dishes.json are Wave 1 leftovers and may not exist yet: warn and use [].
  // A file that exists is loaded strictly, and an invalid one throws.
  const optionalFile = <T>(rel: string, read: () => T[]): T[] => {
    if (fileExists(rel, load)) return read();
    warn(`DATA_SOURCE=fixtures: ${rel} does not exist yet, so the snapshot has none`);
    return [];
  };

  const fixture = loadFixtureCatalogue();
  const candidate = {
    snapshot_id: 'fixtures',
    generated_at: (options.now ?? new Date()).toISOString(),
    localities: optionalFile('data/localities.json', () => loadLocalities(load)),
    dishes: optionalFile('data/dishes.json', () => loadDishes(load)),
    services: loadServices(load),
    cost_models: loadCostModels(load),
    locality_guides: loadLocalityGuides(load),
    ...fixture,
  };
  const result = CatalogueSnapshotSchema.safeParse(candidate);
  if (!result.success) {
    throw new SnapshotError(`the fixtures snapshot is invalid: ${formatIssues(result.error.issues)}`);
  }
  return result.data;
}

/** Loads the catalogue snapshot for a build. Rejects on any error. */
export async function loadSnapshot(options: LoadSnapshotOptions): Promise<CatalogueSnapshot> {
  switch (options.dataSource) {
    case 'supabase':
      return loadFromSupabase(options);
    case 'fixtures':
      return loadFromFixtures(options);
    default:
      throw new SnapshotError(
        `unknown data source ${JSON.stringify((options as { dataSource?: unknown }).dataSource)}`,
      );
  }
}
