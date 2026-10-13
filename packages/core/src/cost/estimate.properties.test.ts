// Properties of the cost engine (fast-check) on generated models. Real-data properties are in real-data.test.ts.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CostModel, Tier } from '../schema/index.ts';
import { estimate, estimateForQuery } from './estimate.ts';
import { localityFactor, makeModel, makeService } from './fixtures/models.ts';
import { stepFor } from './money.ts';
import type { Estimate, EstimateInput } from './types.ts';

const RUNS = { numRuns: 300 };
const KEYS = ['low', 'expected', 'high'] as const;

const rateArb = fc
  .tuple(
    fc.integer({ min: 1, max: 5_000 }),
    fc.integer({ min: 0, max: 5_000 }),
    fc.integer({ min: 0, max: 5_000 }),
  )
  .map(([low, a, b]) => ({ low, expected: low + a, high: low + a + b }));

const componentsArb = fc
  .array(fc.integer({ min: 0, max: 100 }), { minLength: 6, maxLength: 6 })
  .filter((v) => v.some((x) => x > 0))
  .map((v) => {
    const sum = v.reduce((a, b) => a + b, 0);
    const [materials, labour, preparation, repair, transport, waste] = v.map((x) => x / sum) as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    return { materials, labour, preparation, repair, transport, waste };
  });

// fast-check doubles lean towards small values, so mix in uniform integers and quarter-steps up to 100,000.
const quantityArb = fc.oneof(
  fc.double({ min: 0.01, max: 100_000, noNaN: true, noDefaultInfinity: true }),
  fc.integer({ min: 1, max: 100_000 }),
  fc.integer({ min: 1, max: 400_000 }).map((n) => n / 4),
);
// Pairs (smaller, larger): independent, up to 2% apart, or almost equal, so a step change anywhere is likely to be straddled.
const quantityPairArb: fc.Arbitrary<[number, number]> = fc.oneof(
  fc.tuple(quantityArb, quantityArb).map(([a, b]): [number, number] => (a <= b ? [a, b] : [b, a])),
  fc
    .tuple(quantityArb, fc.double({ min: 0, max: 0.02, noNaN: true }))
    .map(([q, rel]): [number, number] => [q, q * (1 + rel)]),
  fc
    .tuple(quantityArb, fc.double({ min: 0, max: 1, noNaN: true }))
    .map(([q, delta]): [number, number] => [q, q + delta]),
);
const minJobArb = fc.option(fc.integer({ min: 0, max: 300_000 }), { nil: null });
const factorArb = fc.double({ min: 0.5, max: 2, noNaN: true, noDefaultInfinity: true });

const modelArb = fc
  .record({ rate_inr: rateArb, components: componentsArb, min_job_inr: minJobArb })
  .map((o) => makeModel(o));

const customArea = (quantity: number): EstimateInput => ({ area: { preset: 'custom', quantity } });
const run = (model: CostModel, input: EstimateInput): Estimate => {
  const out = estimate(model, input);
  if (!out.ok) throw new Error(`unexpected error ${JSON.stringify(out.error)}`);
  return out.value;
};

describe('estimate: properties', () => {
  it('always returns integer figures on the 10 / 100 grid with low <= expected <= high', () => {
    fc.assert(
      fc.property(modelArb, quantityArb, (model, q) => {
        const e = run(model, customArea(q));
        expect(e.low).toBeLessThanOrEqual(e.expected);
        expect(e.expected).toBeLessThanOrEqual(e.high);
        for (const k of KEYS) {
          expect(Number.isSafeInteger(e[k])).toBe(true);
          expect(e[k] % stepFor(e[k])).toBe(0);
        }
      }),
      RUNS,
    );
  });

  it('is monotone non-decreasing in the quantity', () => {
    fc.assert(
      fc.property(modelArb, quantityPairArb, (model, [q1, q2]) => {
        const small = run(model, customArea(q1));
        const large = run(model, customArea(q2));
        for (const k of KEYS) expect(small[k]).toBeLessThanOrEqual(large[k]);
      }),
      RUNS,
    );
  });

  it('is monotone non-decreasing in the quantity with a sourced locality factor', () => {
    fc.assert(
      fc.property(modelArb, factorArb, quantityPairArb, (base, factor, [q1, q2]) => {
        const model = { ...base, locality_factors: [localityFactor('hinjewadi', factor)] };
        const small = run(model, { ...customArea(q1), locality_id: 'hinjewadi' });
        const large = run(model, { ...customArea(q2), locality_id: 'hinjewadi' });
        for (const k of KEYS) expect(small[k]).toBeLessThanOrEqual(large[k]);
      }),
      RUNS,
    );
  });

  it('is monotone non-decreasing in the locality factor', () => {
    fc.assert(
      fc.property(modelArb, factorArb, factorArb, quantityArb, (base, a, b, q) => {
        const [f1, f2] = a <= b ? [a, b] : [b, a];
        const at = (f: number) =>
          run(
            { ...base, locality_factors: [localityFactor('baner', f)] },
            { ...customArea(q), locality_id: 'baner' },
          );
        const low = at(f1);
        const high = at(f2);
        for (const k of KEYS) expect(low[k]).toBeLessThanOrEqual(high[k]);
      }),
      RUNS,
    );
  });

  it('is monotone in tier order: budget <= standard <= premium at the same quantity and locality', () => {
    const tierRatesArb = fc.tuple(rateArb, rateArb, rateArb).map((rates) => {
      // Sort the three rate ranges figure by figure so that each of low, expected and high rises with the tier.
      const sorted = (k: (typeof KEYS)[number]) => rates.map((r) => r[k]).sort((x, y) => x - y);
      const [l, x, h] = [sorted('low'), sorted('expected'), sorted('high')];
      return [0, 1, 2].map((i) => ({
        low: l[i]!,
        expected: Math.max(x[i]!, l[i]!),
        high: Math.max(h[i]!, x[i]!, l[i]!),
      }));
    });
    // A minimum charge, when present, rises with the tier and only the top tiers have one.
    const floorsArb = fc
      .tuple(
        fc.integer({ min: 0, max: 3 }),
        fc.array(fc.integer({ min: 0, max: 200_000 }), { minLength: 3, maxLength: 3 }),
      )
      .map(([count, v]) => {
        const sorted = [...v].sort((x, y) => x - y);
        return [0, 1, 2].map((i) => (i >= 3 - count ? sorted[i]! : null));
      });
    fc.assert(
      fc.property(tierRatesArb, floorsArb, factorArb, quantityArb, (rates, floors, factor, q) => {
        const tiers: Tier[] = ['budget', 'standard', 'premium'];
        const models = tiers.map((tier, i) =>
          makeModel({
            id: `m-${tier}`,
            tier,
            rate_inr: rates[i]!,
            min_job_inr: floors[i]!,
            locality_factors: [localityFactor('baner', factor)],
          }),
        );
        const [b, s, p] = tiers.map((tier) =>
          run(
            models.find((m) => m.tier === tier)!,
            { ...customArea(q), locality_id: 'baner' },
          ),
        );
        for (const k of KEYS) {
          expect(b![k]).toBeLessThanOrEqual(s![k]);
          expect(s![k]).toBeLessThanOrEqual(p![k]);
        }
        // And through selection by tier.
        const viaQuery = tiers.map((tier) => {
          const out = estimateForQuery(
            models,
            { service_id: 'example-service', tier },
            { ...customArea(q), locality_id: 'baner' },
          );
          if (!out.ok) throw new Error('unexpected');
          return out.value.expected;
        });
        expect(viaQuery).toEqual([b!.expected, s!.expected, p!.expected]);
      }),
      RUNS,
    );
  });

  it('never goes below the minimum job charge, and floor_applied is true exactly when it raised a figure', () => {
    fc.assert(
      fc.property(modelArb, quantityArb, (model, q) => {
        const e = run(model, customArea(q));
        const withoutFloor = run({ ...model, min_job_inr: null }, customArea(q));
        if (model.min_job_inr !== null)
          for (const k of KEYS) expect(e[k]).toBeGreaterThanOrEqual(model.min_job_inr);
        expect(e.floor_applied).toBe(KEYS.some((k) => e[k] > withoutFloor[k]));
        if (model.min_job_inr === null) expect(e.floor_applied).toBe(false);
      }),
      RUNS,
    );
  });

  it('components add up exactly to each figure and are never negative', () => {
    fc.assert(
      fc.property(modelArb, quantityArb, (model, q) => {
        const e = run(model, customArea(q));
        for (const k of KEYS) {
          expect(e.components.reduce((a, c) => a + c[k], 0)).toBe(e[k]);
          for (const c of e.components) expect(c[k]).toBeGreaterThanOrEqual(0);
        }
      }),
      RUNS,
    );
  });

  it('gives the same figures for a preset as for the same quantity entered by hand', () => {
    fc.assert(
      fc.property(modelArb, fc.constantFrom('1bhk' as const, '2bhk' as const), (model, preset) => {
        const service = makeService();
        const viaPreset = run(model, { area: { preset }, service });
        const byHand = run(model, customArea(viaPreset.quantity));
        for (const k of KEYS) expect(viaPreset[k]).toBe(byHand[k]);
        expect(viaPreset.components).toEqual(byHand.components);
      }),
      RUNS,
    );
  });

  it('returns a typed error, never throws or yields NaN, for any quantity at all', () => {
    const anyNumber = fc.oneof(
      fc.double(),
      fc.constantFrom(0, -0, 1e300, -1, Number.MIN_VALUE, Infinity, NaN),
    );
    fc.assert(
      fc.property(modelArb, anyNumber, (model, q) => {
        const out = estimate(model, customArea(q));
        if (out.ok) {
          for (const k of KEYS) expect(Number.isSafeInteger(out.value[k])).toBe(true);
        } else {
          expect(out.error.code).toBe('invalid_quantity');
        }
      }),
      RUNS,
    );
  });
});

describe('selectModel via estimateForQuery: a tier without a model is never filled in', () => {
  it('returns no_data_for_tier, listing exactly the tiers that have a model', () => {
    const tiersArb = fc.subarray(['budget', 'standard', 'premium'] as Tier[], { minLength: 0, maxLength: 3 });
    fc.assert(
      fc.property(
        tiersArb,
        fc.constantFrom('budget', 'standard', 'premium') as fc.Arbitrary<Tier>,
        rateArb,
        (present, wanted, rate) => {
          const models = present.map((tier) => makeModel({ id: `m-${tier}`, tier, rate_inr: rate }));
          const out = estimateForQuery(
            models,
            { service_id: 'example-service', tier: wanted },
            customArea(100),
          );
          if (present.includes(wanted)) {
            expect(out.ok).toBe(true);
          } else {
            expect(out.ok).toBe(false);
            if (!out.ok && out.error.code === 'no_data_for_tier') {
              expect(out.error.available_tiers).toEqual(
                (['budget', 'standard', 'premium'] as Tier[]).filter((t) => present.includes(t)),
              );
            } else {
              throw new Error('expected no_data_for_tier');
            }
          }
        },
      ),
      RUNS,
    );
  });
});
