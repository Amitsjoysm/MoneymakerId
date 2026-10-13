// @mm/core/labels (owner C03): badges, trust labels and the evidence-validity rule they share (CONTRACTS §8,
// literal values in §8a). Pure and runtime-neutral. The temperature label (hot, trending, warm, cold) comes
// from `hotScore` in @mm/core/ranking.
export { badges } from './badges.ts';
export { trustLabels } from './trust.ts';
export { evidenceWindow, isCitable, isLive, lastChecked, MS_PER_DAY } from './validity.ts';
export type { EvidenceWindow } from './validity.ts';
export {
  BEST_VALUE_MIN_DATED_PRICES,
  BEST_VALUE_MIN_VALUE_PCT,
  FAMILY_TAG,
  HIDDEN_GEM_MAX_VISIBILITY_PCT,
  HIDDEN_GEM_MIN_QUALITY_PCT,
  LATE_NIGHT_MAX_CHECK_AGE_DAYS,
  OFFICE_LUNCH_MAX_DISTANCE_M,
  OFFICE_LUNCH_TAG,
  RECENTLY_CHECKED_DAYS,
} from './thresholds.ts';
