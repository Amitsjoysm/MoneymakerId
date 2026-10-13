// foodScore, providerScore and hotScore (CONTRACTS §8). Weights, bands and MIN_LABEL_EVIDENCE come from
// @mm/core/constants (§8a); nothing is restated here. Paid placement never enters a score (plan §1).
import {
  FOOD_WEIGHTS,
  HOT_BANDS,
  HOT_WEIGHTS,
  MIN_LABEL_EVIDENCE,
  PROVIDER_WEIGHTS,
} from '../constants/index.ts';
import type { FoodCandidate, HotInputs, ProviderCandidate, TempLabel } from '../schema/index.ts';
import { clamp01, round4 } from './math.ts';

/** `score` is the weighted sum, `components` the weighted parts (weight × clamped input), all to 4 decimals. */
export interface ScoreResult<K extends string> {
  score: number;
  components: Record<K, number>;
}

export type FoodScore = ScoreResult<keyof FoodCandidate['components']>;
export type ProviderScore = ScoreResult<keyof ProviderCandidate['components']>;
export interface HotScore extends ScoreResult<keyof HotInputs['components']> {
  /** Absent when there is no label to show. */
  label?: TempLabel;
}

function weigh<K extends string>(
  weights: Readonly<Record<K, number>>,
  inputs: Readonly<Record<K, number>>,
): ScoreResult<K> {
  const components = {} as Record<K, number>;
  let sum = 0;
  for (const key of Object.keys(weights) as K[]) {
    const part = weights[key] * clamp01(inputs[key]);
    components[key] = round4(part);
    sum += part;
  }
  return { score: round4(sum), components };
}

export function foodScore(c: FoodCandidate): FoodScore {
  return weigh(FOOD_WEIGHTS, c.components);
}

export function providerScore(c: ProviderCandidate): ProviderScore {
  return weigh(PROVIDER_WEIGHTS, c.components);
}

/** The first band whose threshold is <= the score (the bands run highest first); null for the unlabelled band. */
function bandLabel(score: number): TempLabel | null {
  for (const [threshold, label] of HOT_BANDS) {
    if (threshold <= score) return label;
  }
  return null;
}

/**
 * The "What's Hot" score and its temperature label. The label needs at least MIN_LABEL_EVIDENCE evidence
 * rows and a real number for every component (plan §8: with a missing signal, no label is shown); the score
 * is returned either way. The band is read from the rounded score, the number a visitor can see.
 */
export function hotScore(c: HotInputs): HotScore {
  const result: HotScore = weigh(HOT_WEIGHTS, c.components);
  const enoughEvidence = Number.isFinite(c.evidence_count) && c.evidence_count >= MIN_LABEL_EVIDENCE;
  const complete = Object.keys(HOT_WEIGHTS).every((key) =>
    Number.isFinite((c.components as Record<string, number>)[key]),
  );
  if (enoughEvidence && complete) {
    const label = bandLabel(result.score);
    if (label !== null) result.label = label;
  }
  return result;
}
