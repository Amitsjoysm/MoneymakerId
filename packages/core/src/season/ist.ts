// Calendar days and months in India Standard Time (`Asia/Kolkata`, CONTRACTS §1: dates are displayed in IST).
// IST is UTC+05:30 all year (India has no daylight saving time), so a fixed offset is exact and needs no
// `Intl` time-zone data, which keeps this identical on Node and on the Workers runtime.
const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

/** The IST calendar day of an instant, as `YYYY-MM-DD`. Throws a `RangeError` for an invalid `Date`. */
export function istDate(now: Date): string {
  if (Number.isNaN(now.getTime())) throw new RangeError('istDate: invalid Date');
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The IST calendar month of an instant, 1 (January) to 12 (December). Throws a `RangeError` for an invalid `Date`. */
export function istMonth(now: Date): number {
  return Number(istDate(now).slice(5, 7));
}
