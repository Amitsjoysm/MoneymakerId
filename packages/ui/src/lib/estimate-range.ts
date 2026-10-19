// The live total of the estimate segment when the visitor types their own area. It is the cost engine's
// arithmetic (@mm/core/cost estimate(): rate x quantity, rounded to the display grid, floored at the minimum
// job charge) without the model's sources and components, so the browser needs only four numbers.
//
// This file runs in the browser, so it imports nothing at runtime: @mm/core/cost's entry point brings zod and
// every constant with it (about 120 KB against plan §18's 15 KB). The grid rounding is mirrored here instead,
// and the tests hold it equal to roundInr/roundUpInr for any amount, and estimateRange equal to estimate() on
// every real waterproofing model.

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

/** From ₹10,000 the display grid is ₹100; below it, ₹10 (@mm/core/cost money.ts). */
const COARSE_FROM = 10_000;

/** Nearest grid value: roundInr. */
export function roundToGrid(amount: number): number {
  const step = amount >= COARSE_FROM ? 100 : 10;
  return Math.round(amount / step) * step;
}

/** Smallest grid value at or above the amount: roundUpInr, for a minimum charge that is never undercut. */
export function roundUpToGrid(amount: number): number {
  const step = amount <= COARSE_FROM ? 10 : 100;
  return Math.ceil(amount / step) * step;
}

export function estimateRange(rate: RateInput, quantity: number): Range {
  const floor = rate.min_job_inr === null ? 0 : roundUpToGrid(rate.min_job_inr);
  const total = (perUnit: number) => Math.max(roundToGrid(perUnit * quantity), floor);
  return { low: total(rate.low), expected: total(rate.expected), high: total(rate.high) };
}

/** Reads a typed area ("1,200" or "850"); `null` for anything that is not a positive number in range. */
export function parseQuantity(typed: string): number | null {
  const text = typed.trim().replaceAll(',', '');
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const quantity = Number(text);
  return quantity > 0 && quantity <= MAX_QUANTITY ? quantity : null;
}
