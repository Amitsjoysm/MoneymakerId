// Component helpers: turn raw, measurable inputs into the 0–1 components that the scorers weight
// (CONTRACTS §6a: FoodCandidate, ProviderCandidate and HotInputs components are "each 0–1, computed by C03
// helpers"). Pure. Missing inputs give 0, or the locality prior for ratings (plan §8).
import type { EvidenceView } from '../schema/index.ts';
import { MS_PER_DAY, evidenceWindow } from '../labels/validity.ts';
import { DEFAULT_PRIOR_WEIGHT } from './constants.ts';
import { clamp01, shrink } from './math.ts';

export interface RatingSample {
  /** Mean of the ratings on `scale`, e.g. 4.2. */
  mean: number;
  /** How many ratings the mean covers. */
  count: number;
  /** Top of the scale, e.g. 5. */
  scale: number;
}

export interface RatingPrior {
  /** The locality mean on `scale`. */
  mean: number;
  scale: number;
  /** Pseudo-observations the prior is worth. Defaults to DEFAULT_PRIOR_WEIGHT. */
  weight?: number;
}

function normalise(value: number, scale: number): number {
  return scale > 0 ? clamp01(value / scale) : 0;
}

/**
 * `rating_strength` in [0,1]: the mean rating shrunk toward the locality prior. No usable sample returns
 * the prior itself (plan §8: "if missing: locality prior").
 */
export function ratingStrength(sample: RatingSample | null, prior: RatingPrior): number {
  const priorMean = normalise(prior.mean, prior.scale);
  if (sample === null || !(sample.count > 0) || !(sample.scale > 0)) return priorMean;
  return clamp01(
    shrink(
      normalise(sample.mean, sample.scale),
      sample.count,
      priorMean,
      prior.weight ?? DEFAULT_PRIOR_WEIGHT,
    ),
  );
}

/**
 * A count (grounded mentions, dish evidence rows, years of experience, clicks) as a 0–1 strength: linear up
 * to `saturatesAt`, then 1. No count gives 0.
 */
export function countStrength(count: number, saturatesAt: number): number {
  if (!(count > 0)) return 0;
  if (!(saturatesAt > 0)) return 1;
  return Math.min(1, count / saturatesAt);
}

/** 1 at retrieval, falling linearly to 0 when `lifetimeDays` have passed. A future age or no lifetime gives 0. */
export function freshnessStrength(ageDays: number, lifetimeDays: number): number {
  if (!(ageDays >= 0) || !(lifetimeDays > 0)) return 0;
  return clamp01(1 - ageDays / lifetimeDays);
}

/**
 * The `freshness` component for an entity: the mean, over its active evidence rows, of how far through its
 * validity window each row is (see ./labels/validity.ts for the window). Expired, future-dated and
 * unreadable rows count as 0; superseded and rejected rows are ignored; no active rows gives 0.
 */
export function evidenceFreshness(evidence: readonly EvidenceView[], now: Date): number {
  const t = now.getTime();
  let rows = 0;
  let sum = 0;
  for (const e of evidence) {
    if (e.status !== 'active') continue;
    rows += 1;
    const window = evidenceWindow(e);
    if (window === null || t < window.start || t > window.end) continue;
    sum += freshnessStrength((t - window.start) / MS_PER_DAY, (window.end - window.start) / MS_PER_DAY);
  }
  return rows === 0 ? 0 : sum / rows;
}

/**
 * Where `value` sits in `population`, 0–100: the share of members below it, counting ties as half. The
 * input of the badge percentiles (BadgeInputs). Non-finite members are ignored; null when nothing is left
 * to compare against or the value is not finite.
 */
export function percentileRank(value: number, population: readonly number[]): number | null {
  if (!Number.isFinite(value)) return null;
  let n = 0;
  let below = 0;
  let equal = 0;
  for (const member of population) {
    if (!Number.isFinite(member)) continue;
    n += 1;
    if (member < value) below += 1;
    else if (member === value) equal += 1;
  }
  return n === 0 ? null : (100 * (below + equal / 2)) / n;
}
