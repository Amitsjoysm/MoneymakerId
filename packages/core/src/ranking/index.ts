// @mm/core/ranking (owner C03): the food, provider and "What's Hot" scorers (CONTRACTS §8, weights and bands
// from §8a) and the helpers that compute their 0–1 components. Pure and runtime-neutral.
export { foodScore, hotScore, providerScore } from './score.ts';
export type { FoodScore, HotScore, ProviderScore, ScoreResult } from './score.ts';
export {
  countStrength,
  evidenceFreshness,
  freshnessStrength,
  percentileRank,
  ratingStrength,
} from './components.ts';
export type { RatingPrior, RatingSample } from './components.ts';
export { DEFAULT_PRIOR_WEIGHT } from './constants.ts';
export { clamp01, round4, shrink } from './math.ts';
