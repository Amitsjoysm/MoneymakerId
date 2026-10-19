import { readFileSync } from 'node:fs';
import { estimate } from '@mm/core/cost';
import { CostModelSchema } from '@mm/core/schema';
import { describe, expect, it } from 'vitest';
import { estimateRange, parseQuantity } from './estimate-range.ts';

const models = CostModelSchema.array().parse(
  JSON.parse(readFileSync(new URL('../../../../data/cost-models/waterproofing.json', import.meta.url), 'utf8')),
);

const QUANTITIES = [1, 7, 33, 120, 275, 900, 1000, 1234, 4999, 25_000];

describe('estimateRange (the live total the estimate segment shows for a typed area)', () => {
  it.each(models.map((m) => [m.id, m] as const))('matches the cost engine for %s', (_id, model) => {
    for (const quantity of QUANTITIES) {
      const engine = estimate(model, { area: { preset: 'custom', quantity } });
      if (!engine.ok) throw new Error(`engine refused ${quantity}: ${engine.error.code}`);
      const { low, expected, high } = engine.value;
      expect(estimateRange({ ...model.rate_inr, min_job_inr: model.min_job_inr }, quantity), `${quantity}`).toEqual({
        low,
        expected,
        high,
      });
    }
  });

  it('applies a minimum job charge as a floor, rounded up to the display grid', () => {
    expect(estimateRange({ low: 10, expected: 20, high: 30, min_job_inr: 4_995 }, 1)).toEqual({
      low: 5_000,
      expected: 5_000,
      high: 5_000,
    });
  });
});

describe('parseQuantity (what the visitor typed into the area field)', () => {
  it.each([
    ['1000', 1000],
    [' 850 ', 850],
    ['1,200', 1200],
    ['12.5', 12.5],
  ])('reads %j as %d', (typed, quantity) => {
    expect(parseQuantity(typed)).toBe(quantity);
  });

  it.each(['', 'abc', '0', '-20', '1e9', '2000001', 'NaN'])('refuses %j', (typed) => {
    expect(parseQuantity(typed)).toBeNull();
  });
});
