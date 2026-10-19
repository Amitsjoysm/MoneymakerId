// Display formatting shared by the components: rupees with Indian grouping, ISO dates read in IST, and cost
// units in the words Pune homeowners use. Pure; the same output at build time and in the browser.
import type { CostUnit } from '@mm/core/schema';

const GROUPING = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** `₹1,00,000`. Money is whole rupees (CONTRACTS §1), so anything else is a bug upstream and throws. */
export function formatInr(amount: number): string {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError(`formatInr: expected whole non-negative rupees, got ${amount}`);
  }
  return `₹${GROUPING.format(amount)}`;
}

/** `₹35–₹100`: an en dash and no spaces, so a range never breaks across lines. */
export function formatInrRange(low: number, high: number): string {
  if (high < low) throw new RangeError(`formatInrRange: high ${high} is below low ${low}`);
  return low === high ? formatInr(low) : `${formatInr(low)}–${formatInr(high)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `6 Oct 2026`. A date-only value (`YYYY-MM-DD`, how sources record `retrieved_at`) is shown as written;
 * a timestamp is read in IST (Asia/Kolkata, no daylight saving), the zone every page displays.
 */
export function formatDate(iso: string): string {
  const dateOnly = DATE_ONLY.exec(iso);
  if (dateOnly) {
    const [, y, m, d] = dateOnly.map(Number) as [number, number, number, number];
    const check = new Date(Date.UTC(y, m - 1, d));
    if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
      throw new RangeError(`formatDate: ${iso} is not a calendar date`);
    }
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }
  const time = Date.parse(iso);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(iso) || Number.isNaN(time)) {
    throw new RangeError(`formatDate: expected an ISO date or timestamp, got ${iso}`);
  }
  const ist = new Date(time + IST_OFFSET_MS);
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
}

const UNIT_WORDS: Record<CostUnit, [singular: string, plural: string]> = {
  sqft: ['sq ft', 'sq ft'],
  rft: ['running ft', 'running ft'],
  unit: ['unit', 'units'],
  project: ['project', 'projects'],
};

/** `per sq ft`, the label under a per-unit rate. */
export function perUnit(unit: CostUnit): string {
  return `per ${UNIT_WORDS[unit][0]}`;
}

/** `1,000 sq ft`, `3 units`. */
export function formatQuantity(quantity: number, unit: CostUnit): string {
  const [one, many] = UNIT_WORDS[unit];
  return `${GROUPING.format(quantity)} ${quantity === 1 ? one : many}`;
}
