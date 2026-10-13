// The season resolver: which services to promote right now, from data/seasonal-calendar.json.
// The calendar is keyed by month, and the file names no seasons, so a "season" here is the calendar entry of the
// current IST month. Nothing is hard-coded: the calendar is an argument, and a month the calendar lacks is an error.
import type { SeasonalCalendar } from '../schema/index.ts';
import { istMonth } from './ist.ts';

/** What the calendar says to promote in one month. */
export interface Season {
  /** The IST calendar month, 1 (January) to 12 (December). */
  month: number;
  /** Service ids to promote, in the calendar's priority order (the first leads the homepage and the sticky CTA). */
  services: string[];
  headline: string;
  cta: string;
  /** A seasonal page module (such as `monsoon-reminder`), or `null`. */
  module: string | null;
}

/**
 * The season in force at `date`. The month is the month in India (`Asia/Kolkata`) at that instant, so the
 * boundaries are IST midnights, not UTC ones. The result is a copy: changing it never changes the calendar.
 * Throws a `RangeError` for an invalid `Date`, or when an unvalidated calendar lacks that month.
 */
export function seasonFor(date: Date, calendar: SeasonalCalendar): Season {
  const month = istMonth(date);
  const entry = calendar.months[String(month) as keyof SeasonalCalendar['months']] as
    SeasonalCalendar['months'][keyof SeasonalCalendar['months']] | undefined;
  if (entry === undefined) throw new RangeError(`seasonFor: the calendar has no entry for month ${month}`);
  return {
    month,
    services: [...entry.services],
    headline: entry.headline,
    cta: entry.cta,
    module: entry.module,
  };
}
