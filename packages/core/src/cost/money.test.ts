import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { apportion, roundInr, roundUpInr, stepFor } from './money.ts';

describe('stepFor', () => {
  it('is 10 below INR 10,000 and 100 from INR 10,000', () => {
    expect(stepFor(0)).toBe(10);
    expect(stepFor(9_999)).toBe(10);
    expect(stepFor(10_000)).toBe(100);
    expect(stepFor(250_000)).toBe(100);
  });
});

describe('roundInr', () => {
  it.each([
    [0, 0],
    [4, 0],
    [5, 10],
    [9_994, 9_990],
    [9_995, 10_000],
    [9_999, 10_000],
    [10_000, 10_000],
    [10_049, 10_000],
    [10_050, 10_100],
    [123_456.7, 123_500],
    [4_321.4, 4_320],
  ])('rounds %s to %s', (input, expected) => {
    expect(roundInr(input)).toBe(expected);
  });

  it('is monotone non-decreasing, idempotent, and lands on the 10 / 100 grid', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 5_000_000, noNaN: true }),
        fc.double({ min: 0, max: 5_000_000, noNaN: true }),
        (a, b) => {
          const [x, y] = a <= b ? [a, b] : [b, a];
          expect(roundInr(x)).toBeLessThanOrEqual(roundInr(y));
          const r = roundInr(x);
          expect(roundInr(r)).toBe(r);
          expect(Number.isInteger(r)).toBe(true);
          expect(r % stepFor(r)).toBe(0);
        },
      ),
    );
  });
});

describe('roundUpInr', () => {
  it.each([
    [0, 0],
    [4_500, 4_500],
    [4_501, 4_510],
    [9_991, 10_000],
    [10_000, 10_000],
    [10_001, 10_100],
    [12_300, 12_300],
    [12_301, 12_400],
  ])('rounds %s up to %s', (input, expected) => {
    expect(roundUpInr(input)).toBe(expected);
  });

  it('never goes below its input, and stays on the grid', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5_000_000 }), (n) => {
        const r = roundUpInr(n);
        expect(r).toBeGreaterThanOrEqual(n);
        expect(r % stepFor(r)).toBe(0);
      }),
    );
  });
});

describe('apportion', () => {
  it('splits a total by share, in whole steps', () => {
    expect(apportion(1_000, [0.5, 0.5], 10)).toEqual([500, 500]);
  });

  it('rounds the running share, so the parts always add up to the total', () => {
    expect(apportion(100, [1, 1, 1], 10)).toEqual([30, 40, 30]);
    expect(apportion(10, [1, 1, 1], 10)).toEqual([0, 10, 0]);
  });

  it('normalises shares that sum to 0.99 or 1.01', () => {
    const out = apportion(10_000, [0.35, 0.35, 0.15, 0.08, 0.03, 0.04], 100);
    expect(out.reduce((a, b) => a + b, 0)).toBe(10_000);
    expect(apportion(10_000, [0.5, 0.49], 100).reduce((a, b) => a + b, 0)).toBe(10_000);
  });

  it('gives a zero share nothing', () => {
    expect(apportion(500, [0.5, 0, 0.5], 10)).toEqual([250, 0, 250]);
  });

  it('returns all zeros for a zero total', () => {
    expect(apportion(0, [0.2, 0.8], 10)).toEqual([0, 0]);
  });

  it('rejects a total off the step grid and shares that cannot be normalised', () => {
    expect(() => apportion(105, [1], 10)).toThrow(RangeError);
    expect(() => apportion(100, [0, 0], 10)).toThrow(RangeError);
    expect(() => apportion(100, [1, -1, 1], 10)).toThrow(RangeError);
  });

  it('property: parts sum exactly to the total, sit on the grid and stay within one step of the exact share', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500_000 }),
        fc.constantFrom(10, 100),
        fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 1, maxLength: 8 }),
        (units, step, shares) => {
          fc.pre(shares.reduce((a, b) => a + b, 0) > 1e-9);
          const total = units * step;
          const parts = apportion(total, shares, step);
          expect(parts).toHaveLength(shares.length);
          expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
          const sum = shares.reduce((a, b) => a + b, 0);
          parts.forEach((p, i) => {
            expect(p % step).toBe(0);
            expect(Math.abs(p - (total * shares[i]!) / sum)).toBeLessThan(step + 1e-6);
          });
        },
      ),
    );
  });
});
