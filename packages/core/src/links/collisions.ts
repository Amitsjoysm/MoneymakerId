// The slug-collision checker (CONTRACTS §1, §4a, §11). A locality, a dish and a service each become a URL segment, and
// several of them share one: on the food site `/pune/{slug}/` is a locality hub or a dish page, and on the
// construction site it is a locality hub, a service page or a `{service}-cost` guide. Two things claiming one segment
// would be one page that Astro cannot route, so this reports every such clash before a build, per host and URL space.
//
// It checks ids, so it takes ids: callers pass the ids from `data/` (or the CONTRACTS §4a ids while a file is missing).
import { LocalityFoodIntentSchema, type Host, type ServiceDef } from '../schema/index.ts';
import { isReservedSlug } from '../constants/index.ts';

export interface SlugSets {
  /** Every locality id: localities, sub-localities and landmarks. */
  localities: readonly string[];
  /** Every dish id, variants included. */
  dishes: readonly string[];
  /** Every service id, sub-services included (see `serviceIds`). */
  services: readonly string[];
}

export type CollisionKind =
  /** Two claims on one slug in one URL space. */
  | 'duplicate'
  /** An id that CONTRACTS §4a reserves (`ask`, `mr`, `under-*`, `*-cost`, the locality intents, ...). */
  | 'reserved'
  /** An id that is not a lowercase ASCII slug. */
  | 'invalid_slug';

export interface SlugCollision {
  host: Host;
  /** The URL space, e.g. `/pune/{slug}/`. */
  space: string;
  slug: string;
  kind: CollisionKind;
  /** Who claims the slug, as `locality:wakad`, in the order localities, dishes, services, then the fixed names. */
  claimants: string[];
}

/** The ids of a service tree, depth first, parents before their sub-services. */
export function serviceIds(defs: readonly ServiceDef[]): string[] {
  return defs.flatMap((def) => [def.id, ...serviceIds(def.sub_services)]);
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface Claim {
  slug: string;
  claimant: string;
  /** An id someone chose (checked for reserved and invalid slugs), as opposed to a name the site fixes. */
  chosen: boolean;
}

type Source = 'localities' | 'dishes' | 'services' | 'cost' | 'intents';

interface Space {
  host: Host;
  path: string;
  sources: readonly Source[];
}

/** Every URL space with more than one kind of claimant (CONTRACTS §11). */
const SPACES: readonly Space[] = [
  { host: 'main', path: '/pune/{slug}/', sources: ['localities'] },
  { host: 'construction', path: '/pune/{slug}/', sources: ['localities', 'services', 'cost'] },
  { host: 'construction', path: '/pune/{locality}/{slug}/', sources: ['services'] },
  { host: 'food', path: '/pune/{slug}/', sources: ['localities', 'dishes'] },
  { host: 'food', path: '/pune/{locality}/{slug}/', sources: ['dishes', 'intents'] },
];

function claimsOf(source: Source, sets: SlugSets): Claim[] {
  switch (source) {
    case 'localities':
      return sets.localities.map((slug) => ({ slug, claimant: `locality:${slug}`, chosen: true }));
    case 'dishes':
      return sets.dishes.map((slug) => ({ slug, claimant: `dish:${slug}`, chosen: true }));
    case 'services':
      return sets.services.map((slug) => ({ slug, claimant: `service:${slug}`, chosen: true }));
    case 'cost':
      return sets.services.map((id) => ({
        slug: `${id}-cost`,
        claimant: `service-cost:${id}-cost`,
        chosen: false,
      }));
    case 'intents':
      return LocalityFoodIntentSchema.options.map((slug) => ({
        slug,
        claimant: `locality-food-intent:${slug}`,
        chosen: false,
      }));
  }
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Every collision among the ids, per host URL space, sorted by host, space, slug and kind. Empty when there are none.
 * A reserved or invalid id is reported in each space it would sit in.
 */
export function findSlugCollisions(sets: SlugSets): SlugCollision[] {
  const out: SlugCollision[] = [];
  for (const space of SPACES) {
    const claims = space.sources.flatMap((source) => claimsOf(source, sets));
    const bySlug = new Map<string, Claim[]>();
    for (const claim of claims) {
      const list = bySlug.get(claim.slug);
      if (list) list.push(claim);
      else bySlug.set(claim.slug, [claim]);
    }
    const report = (slug: string, kind: CollisionKind, claimants: string[]) =>
      out.push({ host: space.host, space: space.path, slug, kind, claimants });

    for (const [slug, list] of bySlug) {
      if (list.length > 1) {
        report(
          slug,
          'duplicate',
          list.map((c) => c.claimant),
        );
      }
      for (const claim of list) {
        if (!claim.chosen) continue;
        if (!SLUG.test(slug)) report(slug, 'invalid_slug', [claim.claimant]);
        else if (isReservedSlug(slug)) report(slug, 'reserved', [claim.claimant]);
      }
    }
  }
  return out.sort(
    (a, b) =>
      compare(a.host, b.host) ||
      compare(a.space, b.space) ||
      compare(a.slug, b.slug) ||
      compare(a.kind, b.kind),
  );
}
