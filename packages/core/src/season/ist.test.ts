import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { istDate, istMonth } from './ist.ts';

// IST is UTC+05:30 all year (India has no daylight saving time).
describe('istDate: the calendar day in Asia/Kolkata', () => {
  it('rolls over at 18:30 UTC, not at UTC midnight', () => {
    expect(istDate(new Date('2026-10-31T18:29:59.999Z'))).toBe('2026-10-31');
    expect(istDate(new Date('2026-10-31T18:30:00.000Z'))).toBe('2026-11-01');
    expect(istDate(new Date('2026-11-01T00:00:00.000Z'))).toBe('2026-11-01');
    expect(istDate(new Date('2026-11-01T18:29:59.999Z'))).toBe('2026-11-01');
  });

  it('crosses a year end and a leap day', () => {
    expect(istDate(new Date('2026-12-31T18:30:00.000Z'))).toBe('2027-01-01');
    expect(istDate(new Date('2028-02-28T18:30:00.000Z'))).toBe('2028-02-29');
    expect(istDate(new Date('2028-02-29T18:30:00.000Z'))).toBe('2028-03-01');
  });

  it('agrees with the ICU time-zone database for any instant', () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const reference = (d: Date): string => {
      const p = Object.fromEntries(parts.formatToParts(d).map((x) => [x.type, x.value]));
      return `${p.year}-${p.month}-${p.day}`;
    };
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('1990-01-01T00:00:00Z'),
          max: new Date('2100-01-01T00:00:00Z'),
          noInvalidDate: true,
        }),
        (d) => istDate(d) === reference(d),
      ),
      { numRuns: 500 },
    );
  });

  it('rejects an invalid Date instead of returning a wrong day', () => {
    expect(() => istDate(new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe('istMonth: 1 to 12', () => {
  it('returns the IST month, including at the month boundary', () => {
    expect(istMonth(new Date('2026-04-30T18:29:59.999Z'))).toBe(4);
    expect(istMonth(new Date('2026-04-30T18:30:00.000Z'))).toBe(5);
    expect(istMonth(new Date('2026-12-31T18:30:00.000Z'))).toBe(1);
    expect(istMonth(new Date('2026-01-31T18:30:00.000Z'))).toBe(2);
  });

  it('rejects an invalid Date', () => {
    expect(() => istMonth(new Date(Number.NaN))).toThrow(RangeError);
  });
});
