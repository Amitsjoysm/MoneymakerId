// The live total of the estimate segment when the visitor types their own area. It is the cost engine's
// arithmetic (@mm/core/cost estimate(): rate x quantity, rounded to the display grid, floored at the minimum
// job charge) without the model's sources and components, so the browser needs only four numbers. The test
// holds it equal to estimate() on every real waterproofing model.
import { roundInr, roundUpInr } from '@mm/core/cost';

export interface RateInput {
  low: number;
  expected: number;
  high: number;
  min_job_inr: number | null;
}

export interface Range {
  low: number;
  expected: number;
  high: number;
}

/** The largest area the field accepts: beyond any home job, so a typo cannot print an absurd figure. */
export const MAX_QUANTITY = 2_000_000;

export function estimateRange(rate: RateInput, quantity: number): Range {
  const floor = rate.min_job_inr === null ? 0 : roundUpInr(rate.min_job_inr);
  const total = (perUnit: number) => Math.max(roundInr(perUnit * quantity), floor);
  return { low: total(rate.low), expected: total(rate.expected), high: total(rate.high) };
}

/** Reads a typed area ("1,200" or "850"); `null` for anything that is not a positive number in range. */
export function parseQuantity(typed: string): number | null {
  const text = typed.trim().replaceAll(',', '');
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const quantity = Number(text);
  return quantity > 0 && quantity <= MAX_QUANTITY ? quantity : null;
}
