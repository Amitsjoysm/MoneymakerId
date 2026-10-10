// CONTRACTS §8a: literal values copied from the spec. Tests assert them; change them only with the spec.
import type { TempLabel } from '../schema/enums.ts';
import { deepFreeze } from './freeze.ts';

/** Food ranking weights (spec §12). */
export const FOOD_WEIGHTS = deepFreeze({
  relevance: 0.2,
  rating_strength: 0.2,
  review_strength: 0.15,
  dish_evidence: 0.15,
  freshness: 0.1,
  value: 0.1,
  locality_match: 0.1,
} as const);

/** Provider ranking weights (spec §17). */
export const PROVIDER_WEIGHTS = deepFreeze({
  service_match: 0.25,
  locality_match: 0.15,
  specialization: 0.15,
  review_strength: 0.15,
  verification: 0.15,
  freshness: 0.1,
  experience: 0.05,
} as const);

/** "What's Hot" score weights (spec §13). */
export const HOT_WEIGHTS = deepFreeze({
  recent_mentions: 0.25,
  freshness: 0.2,
  demand_signal: 0.2,
  engagement: 0.15,
  quality: 0.2,
} as const);

/**
 * Temperature bands (spec §13), highest first: the first band whose threshold is <= the score applies.
 * The 0.35 band has no label (hidden gem is percentile-based, plan §8).
 */
export const HOT_BANDS: readonly (readonly [number, TempLabel | null])[] = deepFreeze([
  [0.8, 'hot'],
  [0.65, 'trending'],
  [0.5, 'warm'],
  [0.35, null],
  [0.0, 'cold'],
] as const);

/** SEO page-score weights (spec §57). */
export const SEO_WEIGHTS = deepFreeze({
  demand: 0.2,
  data_quality: 0.25,
  locality_specificity: 0.2,
  commercial_intent: 0.15,
  content_depth: 0.1,
  freshness: 0.1,
} as const);

/** A label needs at least this many evidence rows (plan §8). */
export const MIN_LABEL_EVIDENCE = 3;
