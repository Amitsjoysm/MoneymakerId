// badges(BadgeInputs): the data-derived badges of CONTRACTS §3 BadgeLabel (plan §8, spec §10). Pure.
import { MIN_LABEL_EVIDENCE } from '../constants/index.ts';
import type { BadgeInputs, BadgeLabel } from '../schema/index.ts';
import { MS_PER_DAY } from './validity.ts';
import {
  BEST_VALUE_MIN_DATED_PRICES,
  BEST_VALUE_MIN_VALUE_PCT,
  FAMILY_TAG,
  HIDDEN_GEM_MAX_VISIBILITY_PCT,
  HIDDEN_GEM_MIN_QUALITY_PCT,
  LATE_NIGHT_MAX_CHECK_AGE_DAYS,
  OFFICE_LUNCH_MAX_DISTANCE_M,
  OFFICE_LUNCH_TAG,
} from './thresholds.ts';

/** `Office Lunch`, ` office_lunch` and `office-lunch` are the same tag. */
function normaliseTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

function lateHoursCheckedRecently(checkedAt: string | null, now: Date | undefined): boolean {
  if (checkedAt === null || now === undefined) return false;
  const age = now.getTime() - Date.parse(checkedAt);
  return age >= 0 && age <= LATE_NIGHT_MAX_CHECK_AGE_DAYS * MS_PER_DAY;
}

/**
 * The badges whose evidence rule holds, in BadgeLabel order. None at all below MIN_LABEL_EVIDENCE.
 *
 * - hidden_gem: quality percentile >= HIDDEN_GEM_MIN_QUALITY_PCT and visibility percentile <= HIDDEN_GEM_MAX_VISIBILITY_PCT
 * - best_value: value percentile >= BEST_VALUE_MIN_VALUE_PCT and >= BEST_VALUE_MIN_DATED_PRICES dated prices
 * - late_night: `late_hours_checked_at` is the date verified late hours were last checked, and it is within
 *   LATE_NIGHT_MAX_CHECK_AGE_DAYS of `now`. The caller sets it only when the verified hours run past 23:00.
 * - family: the `family` tag
 * - office_lunch: the `office-lunch` tag and an office cluster within OFFICE_LUNCH_MAX_DISTANCE_M
 *
 * `now` is not in the CONTRACTS §8 signature `badges(c)`, but the 30-day window cannot be checked without
 * it. Without `now`, late_night is withheld rather than shown on possibly stale data.
 */
export function badges(c: BadgeInputs, now?: Date): BadgeLabel[] {
  if (!Number.isFinite(c.evidence_count) || c.evidence_count < MIN_LABEL_EVIDENCE) return [];
  const tags = new Set(c.tags.map(normaliseTag));
  const out: BadgeLabel[] = [];
  if (c.quality_pct >= HIDDEN_GEM_MIN_QUALITY_PCT && c.visibility_pct <= HIDDEN_GEM_MAX_VISIBILITY_PCT) {
    out.push('hidden_gem');
  }
  if (c.value_pct >= BEST_VALUE_MIN_VALUE_PCT && c.dated_prices >= BEST_VALUE_MIN_DATED_PRICES) {
    out.push('best_value');
  }
  if (lateHoursCheckedRecently(c.late_hours_checked_at, now)) out.push('late_night');
  if (tags.has(FAMILY_TAG)) out.push('family');
  if (
    tags.has(OFFICE_LUNCH_TAG) &&
    c.distance_to_office_m !== null &&
    c.distance_to_office_m <= OFFICE_LUNCH_MAX_DISTANCE_M
  ) {
    out.push('office_lunch');
  }
  return out;
}
