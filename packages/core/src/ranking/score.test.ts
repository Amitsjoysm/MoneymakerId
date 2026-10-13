import { describe, expect, it } from 'vitest';
import {
  FOOD_WEIGHTS,
  HOT_BANDS,
  HOT_WEIGHTS,
  MIN_LABEL_EVIDENCE,
  PROVIDER_WEIGHTS,
} from '../constants/index.ts';
import type { FoodCandidate, HotInputs, ProviderCandidate } from '../schema/index.ts';
import { foodScore, hotScore, providerScore } from './score.ts';

const ID = '33333333-3333-4333-8333-333333333333';

type Weights = Record<string, number>;

/** Components all equal to `fill`, except `key` set to `value`. */
function vector<W extends Weights>(weights: W, fill: number, key?: keyof W, value?: number) {
  const out: Record<string, number> = {};
  for (const k of Object.keys(weights)) out[k] = k === key ? (value as number) : fill;
  return out as Record<keyof W, number>;
}

const food = (components: FoodCandidate['components']): FoodCandidate => ({ entity_id: ID, components });
const provider = (components: ProviderCandidate['components']): ProviderCandidate => ({
  entity_id: ID,
  components,
});
const hot = (components: HotInputs['components'], evidence_count = MIN_LABEL_EVIDENCE): HotInputs => ({
  components,
  evidence_count,
});

describe.each([
  ['foodScore', FOOD_WEIGHTS as Weights, (c: Record<string, number>) => foodScore(food(c as never))],
  [
    'providerScore',
    PROVIDER_WEIGHTS as Weights,
    (c: Record<string, number>) => providerScore(provider(c as never)),
  ],
  ['hotScore', HOT_WEIGHTS as Weights, (c: Record<string, number>) => hotScore(hot(c as never))],
] as const)('%s uses the §8a weight objects exactly', (_name, weights, run) => {
  it('scores each unit vector at exactly that component weight', () => {
    for (const key of Object.keys(weights)) {
      const result = run(vector(weights, 0, key, 1));
      expect(result.score, key).toBe(weights[key]);
      expect(result.components[key as never], key).toBe(weights[key]);
    }
  });
  it('echoes the weighted parts, one per weight, in the weight order', () => {
    const result = run(vector(weights, 0.5));
    expect(Object.keys(result.components)).toEqual(Object.keys(weights));
    for (const key of Object.keys(weights)) {
      expect(result.components[key as never]).toBeCloseTo((weights[key] as number) * 0.5, 9);
    }
  });
  it('gives 1 for all ones, 0 for all zeros and halves for halves', () => {
    expect(run(vector(weights, 1)).score).toBe(1);
    expect(run(vector(weights, 0)).score).toBe(0);
    expect(run(vector(weights, 0.5)).score).toBe(0.5);
  });
  it('clamps every input to [0,1]', () => {
    for (const key of Object.keys(weights)) {
      expect(run(vector(weights, 0, key, 5)).score, `${key} high`).toBe(weights[key]);
      expect(run(vector(weights, 1, key, -5)).score, `${key} low`).toBe(
        Math.round((1 - (weights[key] as number)) * 1e4) / 1e4,
      );
    }
  });
  it('treats a missing or NaN component as 0', () => {
    const missing = vector(weights, 1);
    const first = Object.keys(weights)[0] as string;
    (missing as Record<string, number>)[first] = Number.NaN;
    expect(run(missing).score).toBe(Math.round((1 - (weights[first] as number)) * 1e4) / 1e4);
    const absent = { ...vector(weights, 1) } as Record<string, number>;
    delete absent[first];
    expect(run(absent).score).toBe(Math.round((1 - (weights[first] as number)) * 1e4) / 1e4);
  });
  it('rounds the score to 4 decimals and is monotonic in each component', () => {
    const result = run(vector(weights, 0.33333333));
    expect(result.score).toBe(Math.round(result.score * 1e4) / 1e4);
    for (const key of Object.keys(weights)) {
      expect(run(vector(weights, 0.2, key, 0.9)).score).toBeGreaterThan(
        run(vector(weights, 0.2, key, 0.1)).score,
      );
    }
  });
  it('does not mutate its input and is deterministic', () => {
    const input = vector(weights, 0.3);
    const before = JSON.stringify(input);
    const a = run(input);
    const b = run(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(a).toEqual(b);
  });
});

describe('foodScore worked example (spec §12 weights)', () => {
  it('is the weighted sum of the components', () => {
    const result = foodScore(
      food({
        relevance: 1,
        rating_strength: 0.8,
        review_strength: 0.6,
        dish_evidence: 1,
        freshness: 0.5,
        value: 0.4,
        locality_match: 0,
      }),
    );
    // .2*1 + .2*.8 + .15*.6 + .15*1 + .1*.5 + .1*.4 + .1*0
    expect(result.score).toBe(0.69);
    expect(result.components).toEqual({
      relevance: 0.2,
      rating_strength: 0.16,
      review_strength: 0.09,
      dish_evidence: 0.15,
      freshness: 0.05,
      value: 0.04,
      locality_match: 0,
    });
  });
  it('never carries a label', () => {
    expect(foodScore(food(vector(FOOD_WEIGHTS, 1)))).not.toHaveProperty('label');
    expect(providerScore(provider(vector(PROVIDER_WEIGHTS, 1)))).not.toHaveProperty('label');
  });
});

describe('providerScore worked example (spec §17 weights)', () => {
  it('is the weighted sum of the components', () => {
    const result = providerScore(
      provider({
        service_match: 1,
        locality_match: 1,
        specialization: 0,
        review_strength: 0.5,
        verification: 1,
        freshness: 0.2,
        experience: 0.4,
      }),
    );
    // .25 + .15 + 0 + .075 + .15 + .02 + .02
    expect(result.score).toBe(0.665);
  });
});

describe('hotScore labels (spec §13 bands)', () => {
  const at = (score: number, evidence_count = MIN_LABEL_EVIDENCE) =>
    hotScore(hot(vector(HOT_WEIGHTS, score), evidence_count));

  it('maps each band edge to the first band whose threshold is <= the score', () => {
    expect(at(1).label).toBe('hot');
    expect(at(0.8).label).toBe('hot');
    expect(at(0.7999).label).toBe('trending');
    expect(at(0.65).label).toBe('trending');
    expect(at(0.6499).label).toBe('warm');
    expect(at(0.5).label).toBe('warm');
    expect(at(0.4999).label).toBeUndefined();
    expect(at(0.35).label).toBeUndefined();
    expect(at(0.3499).label).toBe('cold');
    expect(at(0).label).toBe('cold');
  });
  it('reads the bands from the shared constant, in order', () => {
    for (const [threshold, label] of HOT_BANDS) {
      const result = at(threshold);
      expect(result.label, String(threshold)).toBe(label ?? undefined);
    }
  });
  it('omits the label key rather than returning undefined', () => {
    expect(at(0.4)).not.toHaveProperty('label');
  });
  it('labels on the rounded score, so a float sum that lands on a threshold counts', () => {
    // .25*.8 + .2*.8 + .2*.8 + .15*.8 + .2*.8 sums to 0.8 only after rounding in binary floating point
    expect(at(0.8).score).toBe(0.8);
    expect(at(0.8).label).toBe('hot');
  });
  it('shows no label below MIN_LABEL_EVIDENCE, but still returns the score', () => {
    for (const n of [0, 1, MIN_LABEL_EVIDENCE - 1]) {
      const result = at(1, n);
      expect(result.score).toBe(1);
      expect(result).not.toHaveProperty('label');
    }
    expect(at(1, MIN_LABEL_EVIDENCE).label).toBe('hot');
    expect(at(1, MIN_LABEL_EVIDENCE + 10).label).toBe('hot');
  });
  it('shows no label when the evidence count is not a usable number', () => {
    expect(hotScore(hot(vector(HOT_WEIGHTS, 1), Number.NaN))).not.toHaveProperty('label');
  });
  it('shows no label when a component is missing (plan §8: "no label shown")', () => {
    const missing = vector(HOT_WEIGHTS, 1);
    (missing as Record<string, number>)['demand_signal'] = Number.NaN;
    const result = hotScore(hot(missing));
    expect(result).not.toHaveProperty('label');
    expect(result.score).toBe(0.8);
  });
  it('still labels a component that is a real zero', () => {
    const result = hotScore(hot(vector(HOT_WEIGHTS, 1, 'engagement', 0)));
    expect(result.score).toBe(0.85);
    expect(result.label).toBe('hot');
  });
});
