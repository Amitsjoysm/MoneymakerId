// @mm/core/monetization (owner C07): the ad gate, the date filter for paid placements and experiment bucketing.
// Pure and runtime-neutral: rules, experiments and "now" are passed in; nothing is read, stored or fetched.
export { showAd, type AdDecision, type AdFlags } from './show-ad.ts';
export { filterActive, isActive, isActiveOn, type DateWindow } from './active-window.ts';
export {
  assignVariant,
  bucket,
  fnv1a32,
  type ExperimentContext,
  type ExperimentLike,
  type WeightedVariant,
} from './bucket.ts';
