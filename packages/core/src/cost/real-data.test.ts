// The cost engine against the real, committed data/cost-models/*.json and data/services/*.json.
// The engine itself stays pure; this test file reads the files through the T01 loaders (Node fs + schema validation).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { loadCostModels, loadServices } from '../config/index.ts';
import { LEAF_SERVICE_IDS } from '../constants/index.ts';
import { TierSchema, type CostModel, type ServiceDef, type Tier } from '../schema/index.ts';
import { estimate, estimateForQuery } from './estimate.ts';
import { stepFor } from './money.ts';
import { selectModel } from './select.ts';
import type { Estimate } from './types.ts';

const MODELS: CostModel[] = loadCostModels();
const SERVICES = new Map<string, ServiceDef>();
const walk = (s: ServiceDef) => {
  SERVICES.set(s.id, s);
  s.sub_services.forEach(walk);
};
loadServices().forEach(walk);

const TIERS = TierSchema.options;
const KEYS = ['low', 'expected', 'high'] as const;
const QUANTITIES = [1, 2, 80, 1_000, 2_400, 12_345.5];
const service = (m: CostModel) => SERVICES.get(m.service_id)!;
const run = (m: CostModel, quantity: number): Estimate => {
  const out = estimate(m, { area: { preset: 'custom', quantity }, service: service(m) });
  if (!out.ok) throw new Error(`${m.id}: ${JSON.stringify(out.error)}`);
  return out.value;
};

describe('real data: the models load and every one belongs to a defined service', () => {
  it('has models, and each model service is defined with the model unit', () => {
    expect(MODELS.length).toBeGreaterThan(0);
    for (const m of MODELS) {
      expect(SERVICES.has(m.service_id), `${m.id}: service ${m.service_id}`).toBe(true);
      expect(service(m).unit, `${m.id}: unit`).toBe(m.unit);
    }
  });
});

describe('real data: every model estimates', () => {
  it.each(MODELS.map((m) => [m.id, m] as const))(
    '%s: ordered, integer, on the grid, components add up',
    (_id, m) => {
      for (const q of QUANTITIES) {
        const e = run(m, q);
        expect(e.low).toBeLessThanOrEqual(e.expected);
        expect(e.expected).toBeLessThanOrEqual(e.high);
        for (const k of KEYS) {
          expect(Number.isSafeInteger(e[k])).toBe(true);
          expect(e[k] % stepFor(e[k])).toBe(0);
          expect(e.components.reduce((a, c) => a + c[k], 0)).toBe(e[k]);
          if (m.min_job_inr !== null) expect(e[k]).toBeGreaterThanOrEqual(m.min_job_inr);
        }
        expect(e.sources.length).toBeGreaterThanOrEqual(2);
        expect(e.model.reviewed_at).toBe(m.reviewed_at);
      }
    },
  );

  it('matches the hand-computed figures for one real model (rate x quantity, rounded)', () => {
    const m = MODELS.find((x) => x.id === 'terrace-waterproofing-acrylic-coating-budget')!;
    // rate 35 / 55 / 100 per sq ft x 1,000 sq ft = 35,000 / 55,000 / 100,000
    const e = run(m, 1_000);
    expect([e.low, e.expected, e.high]).toEqual([35_000, 55_000, 100_000]);
    expect(e.unit).toBe('sqft');
    expect(e.locality.basis).toBe('not_requested');
  });
});

describe('real data: selecting a model', () => {
  it.each(MODELS.map((m) => [m.id, m] as const))(
    '%s: its own service, tier, scope and material select it',
    (_id, m) => {
      const out = selectModel(MODELS, {
        service_id: m.service_id,
        tier: m.tier,
        scope_id: m.scope_id,
        material_id: m.material_id,
      });
      expect(out.ok && out.value.id).toBe(m.id);
    },
  );

  it('answers every leaf service x tier cell with a model, an "ask for scope or material" or "no data for this tier"', () => {
    const cells = LEAF_SERVICE_IDS.flatMap((id) => TIERS.map((tier) => ({ id, tier })));
    expect(cells).toHaveLength(LEAF_SERVICE_IDS.length * 3);
    for (const { id, tier } of cells) {
      const hasModel = MODELS.some((m) => m.service_id === id && m.tier === tier);
      const out = selectModel(MODELS, { service_id: id, tier });
      if (hasModel) {
        expect(out.ok || (!out.ok && out.error.code === 'ambiguous_model'), `${id}/${tier}`).toBe(true);
      } else {
        expect(!out.ok && out.error.code, `${id}/${tier}`).toBe('no_data_for_tier');
      }
    }
  });

  it('returns no estimate, and names the tiers that exist, for every real tier cell that has no model', () => {
    const gaps = LEAF_SERVICE_IDS.flatMap((id) =>
      TIERS.filter((tier) => !MODELS.some((m) => m.service_id === id && m.tier === tier)).map((tier) => ({
        id,
        tier,
      })),
    );
    for (const { id, tier } of gaps) {
      const out = estimateForQuery(
        MODELS,
        { service_id: id, tier },
        { area: { preset: 'custom', quantity: 100 } },
      );
      expect(out.ok, `${id}/${tier}`).toBe(false);
      if (!out.ok && out.error.code === 'no_data_for_tier') {
        const present = TIERS.filter((t) => MODELS.some((m) => m.service_id === id && m.tier === t));
        expect(out.error.available_tiers).toEqual(present);
        expect(out.error.available_tiers).not.toContain(tier);
      } else {
        throw new Error(`${id}/${tier}: expected no_data_for_tier`);
      }
    }
  });

  it('gives a parent service no models of its own: its sub-services are estimated one by one', () => {
    const out = selectModel(MODELS, { service_id: 'waterproofing', tier: 'standard' });
    expect(out).toEqual({
      ok: false,
      error: { code: 'no_data_for_tier', service_id: 'waterproofing', tier: 'standard', available_tiers: [] },
    });
  });
});

describe('real data: presets', () => {
  const withPresets = MODELS.filter((m) => service(m).area_presets.length > 0);
  const withoutPresets = MODELS.filter((m) => service(m).area_presets.length === 0);

  it('resolves each preset of the model service to that preset quantity and shows the assumption', () => {
    expect(withPresets.length).toBeGreaterThan(0);
    for (const m of withPresets) {
      for (const entry of service(m).area_presets) {
        const out = estimate(m, { area: { preset: entry.preset }, service: service(m) });
        expect(out.ok && out.value.quantity, `${m.id}/${entry.preset}`).toBe(entry.quantity);
        expect(out.ok && out.value.preset?.assumption).toBe(entry.assumption);
        expect(out.ok && out.value.quantity_source).toBe('preset');
      }
    }
  });

  it('returns a typed error, not a guess, for a preset on a service with no presets; a custom quantity still works', () => {
    expect(withoutPresets.length).toBeGreaterThan(0);
    for (const m of withoutPresets) {
      const asked = estimate(m, { area: { preset: '2bhk' }, service: service(m) });
      expect(asked).toEqual({
        ok: false,
        error: { code: 'preset_unavailable', preset: '2bhk', available_presets: [] },
      });
      expect(estimate(m, { area: { preset: 'custom', quantity: 10 }, service: service(m) }).ok).toBe(true);
    }
  });
});

describe('real data: locality factor', () => {
  it('uses a cited factor where the model has one and otherwise reports factor 1', () => {
    for (const m of MODELS) {
      for (const f of m.locality_factors) {
        const e = estimate(m, { area: { preset: 'custom', quantity: 1_000 }, locality_id: f.locality_id });
        expect(e.ok && e.value.locality).toMatchObject({ factor: f.factor, basis: 'sourced' });
      }
      const none = estimate(m, {
        area: { preset: 'custom', quantity: 1_000 },
        locality_id: 'no-such-locality',
      });
      expect(none.ok && none.value.locality).toEqual({
        locality_id: 'no-such-locality',
        factor: 1,
        basis: 'no_sourced_factor',
        sources: [],
      });
    }
  });
});

describe('real data: properties', () => {
  const quantity = fc.oneof(
    fc.integer({ min: 1, max: 100_000 }),
    fc.integer({ min: 1, max: 400_000 }).map((n) => n / 4),
  );

  it('is monotone non-decreasing in the quantity for every real model', () => {
    const pair: fc.Arbitrary<[number, number]> = fc.oneof(
      fc.tuple(quantity, quantity).map(([a, b]): [number, number] => (a <= b ? [a, b] : [b, a])),
      fc
        .tuple(quantity, fc.double({ min: 0, max: 0.02, noNaN: true }))
        .map(([q, r]): [number, number] => [q, q * (1 + r)]),
    );
    fc.assert(
      fc.property(fc.constantFrom(...MODELS), pair, (m, [q1, q2]) => {
        const small = run(m, q1);
        const large = run(m, q2);
        for (const k of KEYS) expect(small[k]).toBeLessThanOrEqual(large[k]);
      }),
      { numRuns: 400 },
    );
  });

  // Models are comparable across tiers only when they differ in nothing but the tier: same service, scope and material.
  const groups = new Map<string, CostModel[]>();
  for (const m of MODELS) {
    const key = [m.service_id, m.scope_id, m.material_id].join('|');
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const ladders = [...groups.values()].filter((g) => new Set(g.map((m) => m.tier)).size >= 2);

  it('has at least one service x scope x material with more than one tier to compare', () => {
    expect(ladders.length).toBeGreaterThan(0);
  });

  it('is monotone in tier order (budget <= standard <= premium) wherever the same service, scope and material has those cells', () => {
    const order = (t: Tier) => TIERS.indexOf(t);
    fc.assert(
      fc.property(fc.constantFrom(...ladders), quantity, (group, q) => {
        const byTier = [...group].sort((a, b) => order(a.tier) - order(b.tier)).map((m) => run(m, q));
        for (let i = 1; i < byTier.length; i++) {
          for (const k of KEYS)
            expect(byTier[i - 1]![k], `${group[0]!.service_id} ${k}`).toBeLessThanOrEqual(byTier[i]![k]);
        }
      }),
      { numRuns: 300 },
    );
  });
});
