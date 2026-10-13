// Rounding and apportioning of INR amounts for the cost engine. Pure functions on numbers.

/** From this amount the display grid is INR 100; below it, INR 10. */
const COARSE_FROM_INR = 10_000;
const FINE_STEP = 10;
const COARSE_STEP = 100;

/** The grid step an amount sits on: INR 10 below INR 10,000, INR 100 from INR 10,000. */
export function stepFor(amountInr: number): 10 | 100 {
  return amountInr >= COARSE_FROM_INR ? COARSE_STEP : FINE_STEP;
}

/** Rounds to the nearest INR 100 from INR 10,000, and to the nearest INR 10 below. Monotone non-decreasing. */
export function roundInr(amountInr: number): number {
  const step = stepFor(amountInr);
  return Math.round(amountInr / step) * step;
}

/** The smallest grid value that is at least `amountInr`: used for a minimum charge, which must never be undercut. */
export function roundUpInr(amountInr: number): number {
  const step = amountInr <= COARSE_FROM_INR ? FINE_STEP : COARSE_STEP;
  return Math.ceil(amountInr / step) * step;
}

/**
 * Splits `total` (a multiple of `step`) across `shares` in whole steps, so the parts add up to `total` exactly.
 * Shares are relative weights (they need not sum to 1). Each part is within one step of its exact share.
 * Method: round the running share, then take differences, so there is no float drift and no negative part.
 */
export function apportion(total: number, shares: readonly number[], step: number): number[] {
  if (!Number.isInteger(total) || total < 0 || !Number.isInteger(step) || step <= 0 || total % step !== 0) {
    throw new RangeError(`total ${total} must be a non-negative multiple of step ${step}`);
  }
  if (shares.some((s) => !Number.isFinite(s) || s < 0)) {
    throw new RangeError('shares must be finite and non-negative');
  }
  const sum = shares.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) throw new RangeError('shares must have a positive sum');

  const units = total / step;
  const parts: number[] = [];
  let running = 0;
  let previous = 0;
  shares.forEach((share, i) => {
    running += share;
    const cumulative = i === shares.length - 1 ? units : Math.round((units * running) / sum);
    parts.push((cumulative - previous) * step);
    previous = cumulative;
  });
  return parts;
}
