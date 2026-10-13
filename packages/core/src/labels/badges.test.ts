import { describe, expect, it } from 'vitest';
import { MIN_LABEL_EVIDENCE } from '../constants/index.ts';
import type { BadgeInputs } from '../schema/index.ts';
import { badges } from './badges.ts';
import { DAY_MS, NOW, daysAgo } from './fixtures/views.ts';
import {
  BEST_VALUE_MIN_DATED_PRICES,
  BEST_VALUE_MIN_VALUE_PCT,
  HIDDEN_GEM_MAX_VISIBILITY_PCT,
  HIDDEN_GEM_MIN_QUALITY_PCT,
  LATE_NIGHT_MAX_CHECK_AGE_DAYS,
  OFFICE_LUNCH_MAX_DISTANCE_M,
} from './thresholds.ts';

/** Inputs that earn no badge, with enough evidence. */
function none(over: Partial<BadgeInputs> = {}): BadgeInputs {
  return {
    quality_pct: 50,
    visibility_pct: 50,
    value_pct: 50,
    dated_prices: 0,
    late_hours_checked_at: null,
    tags: [],
    distance_to_office_m: null,
    evidence_count: MIN_LABEL_EVIDENCE,
    ...over,
  };
}

describe('thresholds', () => {
  it('hidden gem is quality >= 80th and visibility <= 30th percentile (orchestrator-chosen, brief C03)', () => {
    expect(HIDDEN_GEM_MIN_QUALITY_PCT).toBe(75);
    expect(HIDDEN_GEM_MAX_VISIBILITY_PCT).toBe(25);
  });
  it('best value is value >= 80th percentile with >= 2 dated prices (plan §8)', () => {
    expect(BEST_VALUE_MIN_VALUE_PCT).toBe(80);
    expect(BEST_VALUE_MIN_DATED_PRICES).toBe(2);
  });
  it('late night needs hours checked within 30 days (plan §8)', () => {
    expect(LATE_NIGHT_MAX_CHECK_AGE_DAYS).toBe(30);
  });
  it('office lunch distance is a positive number of metres', () => {
    expect(OFFICE_LUNCH_MAX_DISTANCE_M).toBeGreaterThan(0);
  });
});

describe('badges: no inputs, no badge', () => {
  it('returns [] for unremarkable inputs', () => {
    expect(badges(none(), NOW)).toEqual([]);
  });
});

describe('badges: hidden gem', () => {
  it('needs high quality and low visibility, both edges inclusive', () => {
    const edge = none({
      quality_pct: HIDDEN_GEM_MIN_QUALITY_PCT,
      visibility_pct: HIDDEN_GEM_MAX_VISIBILITY_PCT,
    });
    expect(badges(edge, NOW)).toEqual(['hidden_gem']);
    expect(badges({ ...edge, quality_pct: HIDDEN_GEM_MIN_QUALITY_PCT - 0.01 }, NOW)).toEqual([]);
    expect(badges({ ...edge, visibility_pct: HIDDEN_GEM_MAX_VISIBILITY_PCT + 0.01 }, NOW)).toEqual([]);
  });
  it('is not given for high quality that is also highly visible', () => {
    expect(badges(none({ quality_pct: 99, visibility_pct: 90 }), NOW)).toEqual([]);
  });
  it('ignores NaN percentiles', () => {
    expect(badges(none({ quality_pct: Number.NaN, visibility_pct: 0 }), NOW)).toEqual([]);
    expect(badges(none({ quality_pct: 100, visibility_pct: Number.NaN }), NOW)).toEqual([]);
  });
});

describe('badges: best value', () => {
  it('needs the value percentile and enough dated prices, both edges inclusive', () => {
    const edge = none({ value_pct: BEST_VALUE_MIN_VALUE_PCT, dated_prices: BEST_VALUE_MIN_DATED_PRICES });
    expect(badges(edge, NOW)).toEqual(['best_value']);
    expect(badges({ ...edge, value_pct: 79.99 }, NOW)).toEqual([]);
    expect(badges({ ...edge, dated_prices: 1 }, NOW)).toEqual([]);
  });
});

describe('badges: late night', () => {
  const checked = (daysBefore: number) => none({ late_hours_checked_at: daysAgo(daysBefore) });

  it('is given when late hours were checked within the last 30 days, the 30th day included', () => {
    expect(badges(checked(0), NOW)).toEqual(['late_night']);
    expect(badges(checked(LATE_NIGHT_MAX_CHECK_AGE_DAYS), NOW)).toEqual(['late_night']);
  });
  it('is not given once the check is older', () => {
    expect(badges(checked(LATE_NIGHT_MAX_CHECK_AGE_DAYS + 0.01), NOW)).toEqual([]);
    expect(badges(checked(200), NOW)).toEqual([]);
  });
  it('is not given without a check, for a check in the future, or for an unreadable timestamp', () => {
    expect(badges(none(), NOW)).toEqual([]);
    expect(badges(checked(-1), NOW)).toEqual([]);
    expect(badges(none({ late_hours_checked_at: 'not-a-date' }), NOW)).toEqual([]);
  });
  it('cannot be verified without `now`, so it is withheld', () => {
    expect(badges(checked(0))).toEqual([]);
  });
  it('uses the supplied clock, not the wall clock', () => {
    const later = new Date(NOW.getTime() + 40 * DAY_MS);
    expect(badges(checked(0), later)).toEqual([]);
  });
});

describe('badges: family and office lunch', () => {
  it('family comes from the family tag, whatever its case or separators', () => {
    expect(badges(none({ tags: ['family'] }), NOW)).toEqual(['family']);
    expect(badges(none({ tags: ['  Family '] }), NOW)).toEqual(['family']);
    expect(badges(none({ tags: ['street-food', 'veg'] }), NOW)).toEqual([]);
  });
  it('office lunch needs the tag and an office cluster within reach', () => {
    const near = none({ tags: ['office-lunch'], distance_to_office_m: OFFICE_LUNCH_MAX_DISTANCE_M });
    expect(badges(near, NOW)).toEqual(['office_lunch']);
    expect(badges({ ...near, tags: ['Office Lunch'] }, NOW)).toEqual(['office_lunch']);
    expect(badges({ ...near, tags: ['office_lunch'] }, NOW)).toEqual(['office_lunch']);
    expect(badges({ ...near, distance_to_office_m: OFFICE_LUNCH_MAX_DISTANCE_M + 1 }, NOW)).toEqual([]);
    expect(badges({ ...near, distance_to_office_m: null }, NOW)).toEqual([]);
    expect(badges({ ...near, tags: [] }, NOW)).toEqual([]);
  });
  it('distance alone is not enough', () => {
    expect(badges(none({ distance_to_office_m: 0 }), NOW)).toEqual([]);
  });
});

describe('badges: evidence floor and ordering', () => {
  const everything = none({
    quality_pct: 100,
    visibility_pct: 0,
    value_pct: 100,
    dated_prices: 5,
    late_hours_checked_at: daysAgo(1),
    tags: ['family', 'office-lunch'],
    distance_to_office_m: 100,
  });

  it('returns every badge in the BadgeLabel order when all rules hold', () => {
    expect(badges(everything, NOW)).toEqual([
      'hidden_gem',
      'best_value',
      'late_night',
      'family',
      'office_lunch',
    ]);
  });
  it('returns no badge below MIN_LABEL_EVIDENCE, whatever else holds', () => {
    for (const n of [0, 1, MIN_LABEL_EVIDENCE - 1, Number.NaN]) {
      expect(badges({ ...everything, evidence_count: n }, NOW), String(n)).toEqual([]);
    }
    expect(badges({ ...everything, evidence_count: MIN_LABEL_EVIDENCE }, NOW)).toHaveLength(5);
  });
  it('does not mutate its input', () => {
    const before = JSON.stringify(everything);
    badges(everything, NOW);
    expect(JSON.stringify(everything)).toBe(before);
  });
});
