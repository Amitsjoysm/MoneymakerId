import { describe, expect, it } from 'vitest';
import { loadSeasonalCalendar } from '../config/index.ts';
import type { SeasonalCalendar } from '../schema/index.ts';
import { seasonFor } from './season.ts';

const CALENDAR = loadSeasonalCalendar();
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const key = (m: number) => String(m) as keyof SeasonalCalendar['months'];

// The middle of month `m` (2026), at noon IST: unambiguous in UTC and in IST.
const midMonth = (m: number, year = 2026) => new Date(Date.UTC(year, m - 1, 15, 6, 30));
// The first instant of month `m` in IST (00:00 IST = 18:30 UTC the evening before).
const istMonthStart = (m: number, year = 2026) => new Date(Date.UTC(year, m - 1, 1) - 330 * 60_000);

describe('seasonFor against the real data/seasonal-calendar.json: all 12 months', () => {
  it.each(MONTHS)('month %i resolves to its calendar entry', (m) => {
    const entry = CALENDAR.months[key(m)];
    const season = seasonFor(midMonth(m), CALENDAR);
    expect(season.month).toBe(m);
    expect(season.services).toEqual(entry.services);
    expect(season.headline).toBe(entry.headline);
    expect(season.cta).toBe(entry.cta);
    expect(season.module).toBe(entry.module);
    expect(season.services.length).toBeGreaterThan(0);
    expect(new Set(season.services).size).toBe(season.services.length);
  });

  // Plan §12 (Seasonality). Leading with the right service is what makes the homepage order, the sticky CTA
  // and the seasonal module seasonal; the calendar file is the data, these are the plan's invariants.
  it.each([1, 2, 3, 4, 5] as const)('pre-monsoon: month %i leads with waterproofing', (m) => {
    expect(seasonFor(midMonth(m), CALENDAR).services[0]).toBe('waterproofing');
  });

  it.each([1, 2, 3] as const)('early booking: month %i carries the monsoon-reminder module', (m) => {
    expect(seasonFor(midMonth(m), CALENDAR).module).toBe('monsoon-reminder');
  });

  it('peak waterproofing (April, May) names the specific waterproofing services as well', () => {
    for (const m of [4, 5]) {
      const { services } = seasonFor(midMonth(m), CALENDAR);
      expect(services).toEqual(
        expect.arrayContaining([
          'terrace-waterproofing',
          'external-wall-waterproofing',
          'bathroom-waterproofing',
        ]),
      );
    }
  });

  it.each([6, 7, 8, 9] as const)('monsoon: month %i leads with leakage repair', (m) => {
    expect(seasonFor(midMonth(m), CALENDAR).services[0]).toBe('leakage-repair');
  });

  it.each([10, 11] as const)('Diwali season: month %i leads with painting', (m) => {
    expect(seasonFor(midMonth(m), CALENDAR).services[0]).toBe('painting');
  });

  it('December leads with bathroom and kitchen work', () => {
    expect(seasonFor(midMonth(12), CALENDAR).services.slice(0, 2)).toEqual([
      'bathroom-renovation',
      'modular-kitchen',
    ]);
  });

  it('does not depend on the year', () => {
    for (const m of MONTHS) {
      for (const year of [2026, 2027, 2028, 2030]) {
        expect(seasonFor(midMonth(m, year), CALENDAR)).toEqual(seasonFor(midMonth(m), CALENDAR));
      }
    }
  });
});

describe('seasonFor: month boundaries are in IST, not UTC', () => {
  it.each(MONTHS)(
    'the first instant of IST month %i is in month %i, and 1 ms earlier is the previous month',
    (m) => {
      const start = istMonthStart(m);
      const previous = m === 1 ? 12 : m - 1;
      expect(seasonFor(start, CALENDAR).month).toBe(m);
      expect(seasonFor(new Date(start.getTime() - 1), CALENDAR).month).toBe(previous);
    },
  );

  it('31 Dec 20:00 UTC is already 1 Jan in India', () => {
    const season = seasonFor(new Date('2026-12-31T20:00:00Z'), CALENDAR);
    expect(season.month).toBe(1);
    expect(season.services[0]).toBe('waterproofing');
  });

  it('1 Oct 01:00 IST (30 Sep 19:30 UTC) is October, so painting leads', () => {
    expect(seasonFor(new Date('2026-09-30T19:30:00Z'), CALENDAR).services[0]).toBe('painting');
  });
});

describe('seasonFor: reads the calendar it is given', () => {
  // Invented months, only to prove that nothing is hard-coded in the resolver.
  const synthetic: SeasonalCalendar = {
    months: Object.fromEntries(
      MONTHS.map((m) => [
        String(m),
        {
          services: [`example-service-${m}`, 'shared'],
          headline: `Example headline ${m}`,
          cta: `Example CTA ${m}`,
          module: m === 7 ? 'example-module' : null,
        },
      ]),
    ) as SeasonalCalendar['months'],
  };

  it('returns the synthetic entry for each month', () => {
    for (const m of MONTHS) {
      const season = seasonFor(midMonth(m), synthetic);
      expect(season).toEqual({
        month: m,
        services: [`example-service-${m}`, 'shared'],
        headline: `Example headline ${m}`,
        cta: `Example CTA ${m}`,
        module: m === 7 ? 'example-module' : null,
      });
    }
  });

  it('returns a copy: changing the result never changes the calendar', () => {
    const season = seasonFor(midMonth(3), synthetic);
    (season.services as string[]).push('mutated');
    expect(synthetic.months['3'].services).toEqual(['example-service-3', 'shared']);
    expect(seasonFor(midMonth(3), synthetic).services).toEqual(['example-service-3', 'shared']);
  });

  it('throws a RangeError naming the month when the calendar lacks it (an unvalidated calendar)', () => {
    const partial = { months: { '1': synthetic.months['1'] } } as unknown as SeasonalCalendar;
    expect(() => seasonFor(midMonth(2), partial)).toThrow(RangeError);
    expect(() => seasonFor(midMonth(2), partial)).toThrow(/month 2/);
  });

  it('throws a RangeError for an invalid Date', () => {
    expect(() => seasonFor(new Date(Number.NaN), synthetic)).toThrow(RangeError);
  });
});
