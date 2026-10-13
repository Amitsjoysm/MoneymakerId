// Badge and trust-label thresholds owned by C03. These are not CONTRACTS values: MIN_LABEL_EVIDENCE,
// CLAIM_TIER and TIER_TTL_DAYS live in @mm/core/constants (§8a) and are imported from there.

/** Hidden gem (spec §10, plan §8): quality at or above the 75th percentile and visibility at or below the 25th. */
export const HIDDEN_GEM_MIN_QUALITY_PCT = 75;
export const HIDDEN_GEM_MAX_VISIBILITY_PCT = 25;

/** Best value (plan §8): value at or above the 80th percentile, backed by at least 2 dated prices. */
export const BEST_VALUE_MIN_VALUE_PCT = 80;
export const BEST_VALUE_MIN_DATED_PRICES = 2;

/** Late night (plan §8): the late hours were checked within this many days. */
export const LATE_NIGHT_MAX_CHECK_AGE_DAYS = 30;

/** Office lunch (plan §8, "plus distance to office clusters"): the nearest office cluster is within this many metres. */
export const OFFICE_LUNCH_MAX_DISTANCE_M = 1000;

/** Trust label "Recently checked" (plan §8): the newest live evidence was retrieved within this many days. */
export const RECENTLY_CHECKED_DAYS = 30;

/** Tags that earn the family and office-lunch badges. They match the FoodIntent values (CONTRACTS §3). */
export const FAMILY_TAG = 'family';
export const OFFICE_LUNCH_TAG = 'office-lunch';
