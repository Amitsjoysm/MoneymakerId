import { describe, expect, it } from 'vitest';
import { DEFAULT_PRIOR_WEIGHT } from './constants.ts';
import { clamp01, round4, shrink } from './math.ts';

describe('clamp01', () => {
  it('keeps values inside [0,1] and clamps the rest', () => {
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(7)).toBe(1);
  });
  it('treats NaN, infinities and non-numbers as missing, which scores 0', () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clamp01(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(clamp01(undefined as unknown as number)).toBe(0);
  });
});

describe('round4', () => {
  it('rounds to four decimals', () => {
    expect(round4(0.123449)).toBe(0.1234);
    expect(round4(0.123451)).toBe(0.1235);
    expect(round4(1.0000000000000002)).toBe(1);
  });
});

describe('shrink: Bayesian shrinkage', () => {
  it('is (n*mean + w*prior) / (n + w)', () => {
    // (10*4 + 5*3) / 15 = 55/15
    expect(shrink(4, 10, 3, 5)).toBeCloseTo(55 / 15, 12);
  });
  it('returns the prior when there are no observations, whatever the mean is', () => {
    expect(shrink(Number.NaN, 0, 0.6, 5)).toBe(0.6);
    expect(shrink(5, 0, 0.6, 5)).toBe(0.6);
  });
  it('returns the mean when the prior has no weight', () => {
    expect(shrink(0.9, 4, 0.1, 0)).toBe(0.9);
  });
  it('returns the prior when both counts are zero instead of dividing by zero', () => {
    expect(shrink(0.9, 0, 0.1, 0)).toBe(0.1);
  });
  it('moves toward the mean as n grows and stays between the mean and the prior', () => {
    let last = shrink(1, 0, 0, 5);
    for (const n of [1, 2, 5, 20, 100, 1000]) {
      const v = shrink(1, n, 0, 5);
      expect(v).toBeGreaterThan(last);
      expect(v).toBeLessThan(1);
      last = v;
    }
  });
  it('treats negative counts and weights as zero', () => {
    expect(shrink(1, -3, 0.5, 5)).toBe(0.5);
    expect(shrink(1, 4, 0.5, -2)).toBe(1);
  });
  it('documents the default prior weight as a positive constant', () => {
    expect(DEFAULT_PRIOR_WEIGHT).toBeGreaterThan(0);
  });
});
