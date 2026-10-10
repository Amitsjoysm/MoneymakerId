// CONTRACTS §4a: fixed reference IDs and reserved slugs. Slugs are lowercase ASCII and double as URL segments.
import { deepFreeze } from './freeze.ts';

export const CITY_ID = 'pune';

/** Spec §5 localities (kind `locality`). */
export const LOCALITY_IDS = deepFreeze([
  'hinjewadi',
  'wakad',
  'baner',
  'balewadi',
  'aundh',
  'kothrud',
  'viman-nagar',
  'kharadi',
  'hadapsar',
  'koregaon-park',
  'shivajinagar',
  'camp',
  'kondhwa',
  'wagholi',
  'lohegaon',
  'pimple-saudagar',
  'pimple-nilakh',
  'pimpri',
  'chinchwad',
  'magarpatta',
] as const);

/** Sub-localities (kind `sub_locality`, parent `hinjewadi`). */
export const SUB_LOCALITY_IDS = deepFreeze([
  'hinjewadi-phase-1',
  'hinjewadi-phase-2',
  'hinjewadi-phase-3',
] as const);

/** The M1 priority localities. */
export const PRIORITY_LOCALITY_IDS = deepFreeze([
  'hinjewadi',
  'wakad',
  'baner',
  'kharadi',
  'hadapsar',
  'wagholi',
  'pimple-saudagar',
  'kothrud',
] as const);

/** Dishes with `parent_id` null. Variants are `{variant}-{parent}` and only D02 adds them. */
export const DISH_IDS = deepFreeze([
  'biryani',
  'samosa',
  'vada-pav',
  'misal-pav',
  'momos',
  'dosa',
  'pizza',
  'burger',
  'poha',
  'pav-bhaji',
  'shawarma',
  'chole-bhature',
  'thali',
  'kebab',
  'sandwich',
  'desserts',
] as const);

export const TOP_LEVEL_SERVICE_IDS = deepFreeze([
  'waterproofing',
  'painting',
  'bathroom-renovation',
  'modular-kitchen',
  'house-construction',
] as const);

/** Sub-services by parent. Top-level services missing from this map have none. */
export const SERVICE_TREE = deepFreeze({
  waterproofing: [
    'terrace-waterproofing',
    'bathroom-waterproofing',
    'external-wall-waterproofing',
    'basement-waterproofing',
    'leakage-repair',
  ],
  painting: ['interior-painting', 'exterior-painting'],
} as const);

/** All 12 service ids. Each has a `{id}-cost` city guide. */
export const ALL_SERVICE_IDS: readonly string[] = deepFreeze([
  ...TOP_LEVEL_SERVICE_IDS,
  ...SERVICE_TREE.waterproofing,
  ...SERVICE_TREE.painting,
]);

/** The 10 services without sub-services. Each needs at least one sourced cost model for a cost guide. */
export const LEAF_SERVICE_IDS: readonly string[] = deepFreeze([
  'bathroom-renovation',
  'modular-kitchen',
  'house-construction',
  ...SERVICE_TREE.waterproofing,
  ...SERVICE_TREE.painting,
]);

/** Reserved exact slugs. `under-*` and `*-cost` are reserved by pattern (see `isReservedSlug`). */
export const RESERVED_SLUGS: readonly string[] = deepFreeze([
  'late-night-food',
  'budget-food',
  'veg-food',
  'veg',
  'late-night',
  'family',
  'office-lunch',
  'ask',
  'about',
  'api',
  'mr',
  'hi',
  'ui-fixtures',
]);

/** True when a slug may not be a locality, dish or service id (CONTRACTS §4a). */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug) || slug.startsWith('under-') || slug.endsWith('-cost');
}
