// Small numeric helpers shared by the scorers and the component helpers. Pure.

/** Clamps to [0,1]. NaN, infinities and non-numbers are "missing" and score 0 (plan §8: missing inputs are 0). */
export function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}

/** Rounds to 4 decimals, the precision of every stored score. */
export function round4(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}

/**
 * Bayesian shrinkage: (n·mean + priorWeight·priorMean) / (n + priorWeight).
 * With no observations the result is the prior (the mean is then not read at all). Negative or non-finite
 * `n` and `priorWeight` count as 0.
 */
export function shrink(mean: number, n: number, priorMean: number, priorWeight: number): number {
  const count = Number.isFinite(n) ? Math.max(0, n) : 0;
  const weight = Number.isFinite(priorWeight) ? Math.max(0, priorWeight) : 0;
  if (count === 0) return priorMean;
  return (count * mean + weight * priorMean) / (count + weight);
}
