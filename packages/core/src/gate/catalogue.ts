// A read-only, canonically ordered view of a CatalogueSnapshot for the candidate enumerators. Every list is sorted
// by id, so the pages (and what is hashed) never depend on the order the database or the fixtures returned rows in.
import { CLAIM_TIER, TIER_TTL_DAYS } from '../constants/index.ts';
import type {
  CatalogueSnapshot,
  CostModel,
  Dish,
  EvidenceView,
  ExperienceView,
  Locality,
  PlaceView,
  ProviderView,
  ServiceDef,
} from '../schema/index.ts';

export const DAY_MS = 86_400_000;

/** Plain code-unit order, the same order `Array.prototype.sort()` uses on strings. */
export const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export const sortedById = <T extends { id: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => compareText(a.id, b.id));

export interface ServiceNode {
  def: ServiceDef;
  /** The service and every sub-service below it, sorted. A parent service aggregates its sub-services' models. */
  ids: string[];
}

export interface Catalogue {
  snapshot: CatalogueSnapshot;
  now: Date;
  localities: Locality[];
  dishes: Dish[];
  services: ServiceNode[];
  models: CostModel[];
  places: PlaceView[];
  providers: ProviderView[];
  /** Live evidence rows by entity id, sorted by row id. Aggregator rows are left out. */
  live: Map<string, EvidenceView[]>;
  visits: Map<string, ExperienceView[]>;
  /** The locality and its ancestors, nearest first; empty for an id that is not in the snapshot. */
  lineage: (localityId: string) => string[];
}

/**
 * A row counts while it is active, not from an aggregator, and not expired. Expiry is the row's own `valid_until`,
 * or `retrieved_at` plus the TTL of its claim's tier (CONTRACTS §8a) when `valid_until` is null.
 */
export function isLive(row: EvidenceView, now: Date): boolean {
  if (row.status !== 'active' || row.source.kind === 'aggregator') return false;
  const endsAt =
    row.valid_until !== null
      ? Date.parse(row.valid_until)
      : Date.parse(row.retrieved_at) + TIER_TTL_DAYS[CLAIM_TIER[row.claim_type]] * DAY_MS;
  return endsAt > now.getTime();
}

function flattenServices(defs: readonly ServiceDef[], into: ServiceNode[]): string[] {
  const ids: string[] = [];
  for (const def of defs) {
    const below = flattenServices(def.sub_services, into);
    const node: ServiceNode = { def, ids: [def.id, ...below].sort(compareText) };
    into.push(node);
    ids.push(...node.ids);
  }
  return ids;
}

function group<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = out.get(key);
    if (list) list.push(item);
    else out.set(key, [item]);
  }
  return out;
}

export function buildCatalogue(snapshot: CatalogueSnapshot, now: Date): Catalogue {
  const localities = sortedById(snapshot.localities);
  const localityById = new Map(localities.map((l) => [l.id, l]));
  const services: ServiceNode[] = [];
  flattenServices(snapshot.services, services);
  services.sort((a, b) => compareText(a.def.id, b.def.id));

  const lineage = (localityId: string): string[] => {
    const out: string[] = [];
    let current = localityById.get(localityId);
    while (current !== undefined && !out.includes(current.id)) {
      out.push(current.id);
      current = current.parent_id === null ? undefined : localityById.get(current.parent_id);
    }
    return out;
  };

  const live = group(
    sortedById(snapshot.evidence).filter((row) => isLive(row, now)),
    (row) => row.entity_id,
  );

  return {
    snapshot,
    now,
    localities,
    dishes: sortedById(snapshot.dishes),
    services,
    models: sortedById(snapshot.cost_models),
    places: sortedById(snapshot.places),
    providers: sortedById(snapshot.providers),
    live,
    visits: group(sortedById(snapshot.experiences), (visit) => visit.business_id),
    lineage,
  };
}
