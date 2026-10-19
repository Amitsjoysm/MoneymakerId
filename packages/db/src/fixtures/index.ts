// @mm/db/fixtures (owner E01): the fake catalogue behind `DATA_SOURCE=fixtures` (CI and development only).
//
// `packages/db/fixtures/catalogue.json` holds businesses, evidence, experiences and recommendations. Every
// business in it is named "Example …" so the production build check (`assertNoFixtureBusinesses`) can refuse
// it. The reference sections (localities, dishes, services, cost models, guides) are not here: they come from
// `data/` and `content/` (CONTRACTS §6). The file is imported as a JSON module, so this module reads no disk
// and is safe in any runtime that bundles JSON.
import { CatalogueSnapshotSchema, type CatalogueSnapshot } from '@mm/core/schema';
import catalogueJson from '../../fixtures/catalogue.json' with { type: 'json' };
import { formatIssues } from '../issues.ts';

/** The word every fixture business name starts with (CONTRACTS §6: "Fixture businesses are named 'Example …'"). */
export const FIXTURE_NAME_PREFIX = 'Example';

/**
 * Whether `name` is a fixture business: it starts with "Example", in any case (the E01 brief's literal rule).
 * Deliberately loose, so it fails closed: "Exampleton Grill" is flagged too, and a real business that needs
 * that name is a loud build failure a person resolves, where a leaked fixture would be silent fabrication.
 */
export function isFixtureBusinessName(name: string): boolean {
  return name.normalize('NFKC').trimStart().toLowerCase().startsWith(FIXTURE_NAME_PREFIX.toLowerCase());
}

/** The sections of the snapshot that come from the fixture file (everything but the reference data). */
export const FixtureCatalogueSchema = CatalogueSnapshotSchema.omit({
  snapshot_id: true,
  generated_at: true,
  localities: true,
  dishes: true,
  services: true,
  cost_models: true,
  locality_guides: true,
});
export type FixtureCatalogue = Omit<
  CatalogueSnapshot,
  'snapshot_id' | 'generated_at' | 'localities' | 'dishes' | 'services' | 'cost_models' | 'locality_guides'
>;

export class FixtureCatalogueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FixtureCatalogueError';
  }
}

/** Validates a parsed fixture file; throws a `FixtureCatalogueError` naming the failing paths. */
export function parseFixtureCatalogue(raw: unknown): FixtureCatalogue {
  const result = FixtureCatalogueSchema.safeParse(raw);
  if (!result.success) {
    throw new FixtureCatalogueError(
      `fixtures/catalogue.json is invalid: ${formatIssues(result.error.issues)}`,
    );
  }
  const catalogue = result.data;
  const unnamed = [...catalogue.places, ...catalogue.providers]
    .map((b) => b.name)
    .filter((name) => !name.startsWith(`${FIXTURE_NAME_PREFIX} `));
  if (unnamed.length > 0) {
    throw new FixtureCatalogueError(
      `fixtures/catalogue.json: every business must be named "${FIXTURE_NAME_PREFIX} …"; found ${JSON.stringify(unnamed)}`,
    );
  }
  return catalogue;
}

/** The committed fixture catalogue, validated. */
export function loadFixtureCatalogue(): FixtureCatalogue {
  return parseFixtureCatalogue(catalogueJson);
}
