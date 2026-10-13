import { describe, expect, it } from 'vitest';
import { COST_DISCLAIMER } from '../constants/index.ts';
import type { CostModel } from '../schema/index.ts';
import { estimate, estimateForQuery } from './estimate.ts';
import { EXAMPLE_PRESETS, localityFactor, makeModel, makeService } from './fixtures/models.ts';
import type { Estimate, Outcome } from './types.ts';

function ok(out: Outcome<Estimate>): Estimate {
  if (!out.ok) throw new Error(`expected an estimate, got ${JSON.stringify(out.error)}`);
  return out.value;
}
const custom = (quantity: number) => ({ area: { preset: 'custom' as const, quantity } });
const figures = (e: Estimate) => [e.low, e.expected, e.high];
const sumOf = (e: Estimate, key: 'low' | 'expected' | 'high') => e.components.reduce((a, c) => a + c[key], 0);

describe('estimate: totals', () => {
  it('multiplies the per-unit range by the quantity', () => {
    const e = ok(estimate(makeModel(), custom(1_000)));
    expect(figures(e)).toEqual([40_000, 60_000, 90_000]);
    expect(e.unit).toBe('sqft');
    expect(e.quantity).toBe(1_000);
    expect(e.quantity_source).toBe('explicit');
    expect(e.preset).toBeNull();
  });

  it('rounds to INR 10 below INR 10,000 and to INR 100 from INR 10,000, each figure on its own', () => {
    // 123 sqft: 4,920 / 7,380 / 11,070 -> the high figure is on the INR 100 grid.
    expect(figures(ok(estimate(makeModel(), custom(123))))).toEqual([4_920, 7_380, 11_100]);
    // 7.77 sqft: 310.8 / 466.2 / 699.3 -> nearest INR 10.
    expect(figures(ok(estimate(makeModel(), custom(7.77))))).toEqual([310, 470, 700]);
  });

  it('keeps low <= expected <= high', () => {
    const e = ok(estimate(makeModel({ rate_inr: { low: 50, expected: 50, high: 50 } }), custom(33)));
    expect(e.low).toBeLessThanOrEqual(e.expected);
    expect(e.expected).toBeLessThanOrEqual(e.high);
  });

  it('carries the disclaimer, the model facts, the model sources and the dates', () => {
    const model = makeModel({
      id: 'm1',
      scope_id: 's',
      material_id: 'x',
      tier: 'premium',
      status: 'reviewed',
    });
    const e = ok(estimate(model, custom(100)));
    expect(e.disclaimer).toBe(COST_DISCLAIMER);
    expect(e.model).toEqual({
      id: 'm1',
      service_id: 'example-service',
      scope_id: 's',
      material_id: 'x',
      tier: 'premium',
      reviewed_at: '2026-10-06',
      valid_until: '2027-04-04',
      status: 'reviewed',
    });
    expect(e.sources).toEqual(model.sources);
    expect(e.sources).not.toBe(model.sources);
  });

  it('does not change the model it is given', () => {
    const model = makeModel({ locality_factors: [localityFactor('hinjewadi', 1.1)], min_job_inr: 5_000 });
    const before = structuredClone(model);
    ok(estimate(model, { ...custom(500), locality_id: 'hinjewadi' }));
    expect(model).toEqual(before);
  });
});

describe('estimate: a dense sweep of quantities', () => {
  it.each([
    ['plain', makeModel()],
    ['with a minimum job charge', makeModel({ min_job_inr: 8_000 })],
    ['with a sourced locality factor', makeModel({ locality_factors: [localityFactor('baner', 1.07)] })],
  ])('never decreases as the quantity grows by 0.25 (%s)', (_name, model) => {
    const previous = { low: 0, expected: 0, high: 0 };
    for (let q = 0.25; q <= 3_000; q += 0.25) {
      const e = ok(estimate(model, { ...custom(q), locality_id: 'baner' }));
      expect(e.low).toBeGreaterThanOrEqual(previous.low);
      expect(e.expected).toBeGreaterThanOrEqual(previous.expected);
      expect(e.high).toBeGreaterThanOrEqual(previous.high);
      previous.low = e.low;
      previous.expected = e.expected;
      previous.high = e.high;
    }
  });
});

describe('estimate: quantity from a preset', () => {
  it('uses the service preset and returns the entry with its assumption', () => {
    const e = ok(estimate(makeModel(), { area: { preset: '2bhk' }, service: makeService() }));
    expect(e.quantity).toBe(1_200);
    expect(e.quantity_source).toBe('preset');
    expect(e.preset).toEqual(EXAMPLE_PRESETS[1]);
    expect(figures(e)).toEqual([48_000, 72_000, 108_000]);
  });

  it('returns a typed error when the service has no presets', () => {
    const out = estimate(makeModel(), {
      area: { preset: '2bhk' },
      service: makeService({ area_presets: [] }),
    });
    expect(out).toEqual({
      ok: false,
      error: { code: 'preset_unavailable', preset: '2bhk', available_presets: [] },
    });
  });

  it('accepts a custom quantity even when the service has no presets', () => {
    const e = ok(estimate(makeModel(), { ...custom(900), service: makeService({ area_presets: [] }) }));
    expect(e.quantity).toBe(900);
  });

  it('refuses a service that counts in a different unit from the model', () => {
    const out = estimate(makeModel({ unit: 'unit' }), { area: { preset: '1bhk' }, service: makeService() });
    expect(out).toEqual({
      ok: false,
      error: { code: 'unit_mismatch', model_unit: 'unit', service_unit: 'sqft' },
    });
  });
});

describe('estimate: invalid quantities', () => {
  it.each([
    [{ preset: 'custom' as const, quantity: null }, 'missing'],
    [{ preset: 'custom' as const, quantity: 0 }, 'not_positive_finite'],
    [{ preset: 'custom' as const, quantity: -3 }, 'not_positive_finite'],
    [{ preset: 'custom' as const, quantity: Number.NaN }, 'not_positive_finite'],
  ])('returns invalid_quantity for %j', (area, reason) => {
    expect(estimate(makeModel(), { area })).toEqual({
      ok: false,
      error: { code: 'invalid_quantity', reason },
    });
  });

  it.each([1e300, Number.MAX_VALUE, 1e15])(
    'returns out_of_range when the total cannot be an exact integer (%s)',
    (q) => {
      expect(estimate(makeModel(), custom(q))).toEqual({
        ok: false,
        error: { code: 'invalid_quantity', reason: 'out_of_range' },
      });
    },
  );
});

describe('estimate: locality factor', () => {
  const model = makeModel({ locality_factors: [localityFactor('hinjewadi', 1.2)] });

  it('is 1 and says so when no locality is requested', () => {
    const e = ok(estimate(model, custom(1_000)));
    expect(e.locality).toEqual({ locality_id: null, factor: 1, basis: 'not_requested', sources: [] });
    expect(figures(e)).toEqual([40_000, 60_000, 90_000]);
  });

  it('is 1 and says so when the model has no sourced factor for the locality', () => {
    const e = ok(estimate(model, { ...custom(1_000), locality_id: 'baner' }));
    expect(e.locality).toEqual({ locality_id: 'baner', factor: 1, basis: 'no_sourced_factor', sources: [] });
    expect(figures(e)).toEqual([40_000, 60_000, 90_000]);
  });

  it('scales the range by the sourced factor and returns its sources', () => {
    const e = ok(estimate(model, { ...custom(1_000), locality_id: 'hinjewadi' }));
    expect(e.locality.basis).toBe('sourced');
    expect(e.locality.factor).toBe(1.2);
    expect(e.locality.sources).toEqual(model.locality_factors[0]!.sources);
    expect(figures(e)).toEqual([48_000, 72_000, 108_000]);
  });

  it('treats an empty locality id as not requested', () => {
    expect(ok(estimate(model, { ...custom(100), locality_id: null })).locality.basis).toBe('not_requested');
  });
});

describe('estimate: minimum job floor', () => {
  it('raises every figure that falls below the minimum and reports it', () => {
    const e = ok(estimate(makeModel({ min_job_inr: 5_000 }), custom(10)));
    expect(figures(e)).toEqual([5_000, 5_000, 5_000]);
    expect(e.floor_applied).toBe(true);
    expect(e.min_job_inr).toBe(5_000);
  });

  it('raises only the figures below the minimum', () => {
    // 100 sqft: 4,000 / 6,000 / 9,000 against a floor of 7,000.
    const e = ok(estimate(makeModel({ min_job_inr: 7_000 }), custom(100)));
    expect(figures(e)).toEqual([7_000, 7_000, 9_000]);
    expect(e.floor_applied).toBe(true);
  });

  it('reports floor_applied false when the minimum does not bind', () => {
    const e = ok(estimate(makeModel({ min_job_inr: 3_000 }), custom(100)));
    expect(figures(e)).toEqual([4_000, 6_000, 9_000]);
    expect(e.floor_applied).toBe(false);
    expect(e.min_job_inr).toBe(3_000);
  });

  it('reports floor_applied false when the model has no minimum', () => {
    const e = ok(estimate(makeModel({ min_job_inr: null }), custom(1)));
    expect(e.floor_applied).toBe(false);
    expect(e.min_job_inr).toBeNull();
  });

  it('never shows less than the minimum: an off-grid minimum is rounded up, not down', () => {
    const e = ok(estimate(makeModel({ min_job_inr: 12_345 }), custom(10)));
    expect(figures(e)).toEqual([12_400, 12_400, 12_400]);
  });

  it('applies after the locality factor', () => {
    const model = makeModel({ min_job_inr: 6_000, locality_factors: [localityFactor('hinjewadi', 1.5)] });
    // 100 sqft at x1.5: 6,000 / 9,000 / 13,500 -> the floor equals low, so it does not bind.
    const e = ok(estimate(model, { ...custom(100), locality_id: 'hinjewadi' }));
    expect(figures(e)).toEqual([6_000, 9_000, 13_500]);
    expect(e.floor_applied).toBe(false);
  });
});

describe('estimate: components', () => {
  it('splits each figure by the model shares, in a fixed order with labels', () => {
    const e = ok(estimate(makeModel(), custom(1_000)));
    expect(e.components.map((c) => c.id)).toEqual([
      'materials',
      'labour',
      'preparation',
      'repair',
      'transport',
      'waste',
    ]);
    expect(e.components.map((c) => c.label)).toEqual([
      'Materials',
      'Labour',
      'Preparation',
      'Repair',
      'Transport',
      'Waste',
    ]);
    expect(e.components.map((c) => c.expected)).toEqual([21_000, 21_000, 9_000, 4_800, 1_800, 2_400]);
  });

  it('adds up exactly to low, expected and high', () => {
    for (const q of [7.77, 123, 1_000, 4_321.5]) {
      const e = ok(estimate(makeModel(), custom(q)));
      expect(sumOf(e, 'low')).toBe(e.low);
      expect(sumOf(e, 'expected')).toBe(e.expected);
      expect(sumOf(e, 'high')).toBe(e.high);
    }
  });

  it('adds up to the floor when the floor applies', () => {
    const e = ok(estimate(makeModel({ min_job_inr: 12_345 }), custom(10)));
    expect(sumOf(e, 'expected')).toBe(12_400);
  });

  it('normalises shares that sum to 0.99 and gives a zero share nothing', () => {
    const model = makeModel({
      components: { materials: 0.5, labour: 0.49, preparation: 0, repair: 0, transport: 0, waste: 0 },
    });
    const e = ok(estimate(model, custom(1_000)));
    expect(sumOf(e, 'expected')).toBe(60_000);
    expect(e.components.find((c) => c.id === 'repair')!.expected).toBe(0);
  });
});

describe('estimateForQuery', () => {
  const models: CostModel[] = [
    makeModel({ id: 'budget', tier: 'budget', rate_inr: { low: 20, expected: 30, high: 45 } }),
    makeModel({ id: 'standard', tier: 'standard' }),
  ];

  it('selects the model for the tier and estimates it', () => {
    const e = ok(estimateForQuery(models, { service_id: 'example-service', tier: 'budget' }, custom(1_000)));
    expect(e.model.id).toBe('budget');
    expect(figures(e)).toEqual([20_000, 30_000, 45_000]);
  });

  it('returns "no data for this tier" instead of a price for a tier with no model', () => {
    const out = estimateForQuery(models, { service_id: 'example-service', tier: 'premium' }, custom(1_000));
    expect(out).toEqual({
      ok: false,
      error: {
        code: 'no_data_for_tier',
        service_id: 'example-service',
        tier: 'premium',
        available_tiers: ['budget', 'standard'],
      },
    });
  });

  it('passes a selection error through unchanged', () => {
    const out = estimateForQuery(
      models,
      { service_id: 'example-service', tier: 'standard', scope_id: 'nope' },
      custom(1_000),
    );
    expect(!out.ok && out.error.code).toBe('no_matching_model');
  });

  it('does not look at the quantity when the model cannot be selected', () => {
    const out = estimateForQuery(models, { service_id: 'example-service', tier: 'premium' }, custom(-1));
    expect(!out.ok && out.error.code).toBe('no_data_for_tier');
  });
});
