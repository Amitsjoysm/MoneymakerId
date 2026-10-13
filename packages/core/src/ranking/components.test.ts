import { describe, expect, it } from 'vitest';
import { TIER_TTL_DAYS } from '../constants/index.ts';
import { DAY_MS, NOW, daysAgo, makeEvidence } from '../labels/fixtures/views.ts';
import { DEFAULT_PRIOR_WEIGHT } from './constants.ts';
import {
  countStrength,
  evidenceFreshness,
  freshnessStrength,
  percentileRank,
  ratingStrength,
} from './components.ts';
import { shrink } from './math.ts';

describe('ratingStrength', () => {
  const prior = { mean: 3.5, scale: 5 };

  it('falls back to the locality prior when there are no ratings', () => {
    expect(ratingStrength(null, prior)).toBeCloseTo(0.7, 12);
    expect(ratingStrength({ mean: 5, count: 0, scale: 5 }, prior)).toBeCloseTo(0.7, 12);
  });
  it('shrinks a small sample toward the prior using the default prior weight', () => {
    const raw = 5 / 5;
    const expected = shrink(raw, 2, 0.7, DEFAULT_PRIOR_WEIGHT);
    expect(ratingStrength({ mean: 5, count: 2, scale: 5 }, prior)).toBeCloseTo(expected, 12);
    expect(ratingStrength({ mean: 5, count: 2, scale: 5 }, prior)).toBeLessThan(1);
    expect(ratingStrength({ mean: 5, count: 2, scale: 5 }, prior)).toBeGreaterThan(0.7);
  });
  it('trusts a large sample', () => {
    expect(ratingStrength({ mean: 4.5, count: 5000, scale: 5 }, prior)).toBeCloseTo(0.9, 2);
  });
  it('normalises ratings on any scale', () => {
    const on5 = ratingStrength({ mean: 4, count: 10, scale: 5 }, prior);
    const on10 = ratingStrength({ mean: 8, count: 10, scale: 10 }, { mean: 7, scale: 10 });
    expect(on10).toBeCloseTo(on5, 12);
  });
  it('honours an explicit prior weight', () => {
    const heavy = ratingStrength({ mean: 5, count: 10, scale: 5 }, { ...prior, weight: 1000 });
    const light = ratingStrength({ mean: 5, count: 10, scale: 5 }, { ...prior, weight: 1 });
    expect(heavy).toBeLessThan(light);
  });
  it('stays inside [0,1] for out-of-range or broken input', () => {
    expect(ratingStrength({ mean: 9, count: 50, scale: 5 }, prior)).toBeLessThanOrEqual(1);
    expect(ratingStrength({ mean: -3, count: 50, scale: 5 }, prior)).toBeGreaterThanOrEqual(0);
    expect(ratingStrength({ mean: 4, count: 5, scale: 0 }, prior)).toBeCloseTo(0.7, 12);
    expect(ratingStrength(null, { mean: 3, scale: 0 })).toBe(0);
  });
});

describe('countStrength', () => {
  it('is linear up to the saturation point and 1 beyond it', () => {
    expect(countStrength(0, 10)).toBe(0);
    expect(countStrength(5, 10)).toBe(0.5);
    expect(countStrength(10, 10)).toBe(1);
    expect(countStrength(40, 10)).toBe(1);
  });
  it('is 0 for missing or negative counts and for a bad saturation point', () => {
    expect(countStrength(-1, 10)).toBe(0);
    expect(countStrength(Number.NaN, 10)).toBe(0);
    expect(countStrength(3, 0)).toBe(1);
    expect(countStrength(0, 0)).toBe(0);
  });
});

describe('freshnessStrength', () => {
  it('decays linearly from 1 at retrieval to 0 at the end of the lifetime', () => {
    expect(freshnessStrength(0, 60)).toBe(1);
    expect(freshnessStrength(30, 60)).toBe(0.5);
    expect(freshnessStrength(60, 60)).toBe(0);
    expect(freshnessStrength(90, 60)).toBe(0);
  });
  it('gives no credit to a future age or a non-positive lifetime', () => {
    expect(freshnessStrength(-1, 60)).toBe(0);
    expect(freshnessStrength(1, 0)).toBe(0);
  });
});

describe('evidenceFreshness', () => {
  it('is 0 without evidence', () => {
    expect(evidenceFreshness([], NOW)).toBe(0);
  });
  it('scores a row by its age against its tier lifetime', () => {
    const hot = TIER_TTL_DAYS.HOT; // price is HOT
    const row = makeEvidence('price', hot / 2);
    expect(evidenceFreshness([row], NOW)).toBeCloseTo(0.5, 9);
  });
  it('uses the source-stated valid_until as the lifetime when present', () => {
    const row = makeEvidence('price', 5, {
      valid_until: new Date(NOW.getTime() + 5 * DAY_MS).toISOString(),
    });
    expect(evidenceFreshness([row], NOW)).toBeCloseTo(0.5, 9);
  });
  it('counts expired rows as 0 and averages over active rows only', () => {
    const fresh = makeEvidence('dish', 0);
    const expired = makeEvidence('price', TIER_TTL_DAYS.HOT + 1);
    const superseded = makeEvidence('dish', 0, { status: 'superseded' });
    const rejected = makeEvidence('dish', 0, { status: 'rejected' });
    expect(evidenceFreshness([fresh, expired, superseded, rejected], NOW)).toBeCloseTo(0.5, 9);
  });
  it('gives no credit to a row retrieved in the future or with an unreadable timestamp', () => {
    const future = makeEvidence('dish', -3);
    const broken = makeEvidence('dish', 0, { retrieved_at: 'not-a-date' });
    expect(evidenceFreshness([future, broken], NOW)).toBe(0);
  });
  it('gives no credit when valid_until is not after retrieved_at', () => {
    const row = makeEvidence('dish', 1, { valid_until: daysAgo(2) });
    expect(evidenceFreshness([row], NOW)).toBe(0);
  });
});

describe('percentileRank', () => {
  const population = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  it('is the percentage of the population below the value, counting ties as half', () => {
    expect(percentileRank(100, population)).toBe(95);
    expect(percentileRank(10, population)).toBe(5);
    expect(percentileRank(55, population)).toBe(50);
    expect(percentileRank(1000, population)).toBe(100);
    expect(percentileRank(0, population)).toBe(0);
  });
  it('puts every member of an all-equal population at 50', () => {
    expect(percentileRank(7, [7, 7, 7])).toBe(50);
  });
  it('returns null when it cannot be computed', () => {
    expect(percentileRank(5, [])).toBeNull();
    expect(percentileRank(Number.NaN, population)).toBeNull();
  });
  it('ignores non-finite members of the population', () => {
    expect(percentileRank(5, [Number.NaN, 5])).toBe(50);
    expect(percentileRank(5, [Number.NaN])).toBeNull();
  });
});
