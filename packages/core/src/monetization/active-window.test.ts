import { describe, expect, it } from 'vitest';
import type { CampaignView, FeaturedView } from '../schema/index.ts';
import { filterActive, isActive, isActiveOn } from './active-window.ts';

const win = (starts_on: string, ends_on: string) => ({ starts_on, ends_on });

describe('isActiveOn: starts_on <= today <= ends_on, inclusive, on IST calendar days', () => {
  it('is active on the first day, on the last day and in between', () => {
    const w = win('2026-11-01', '2026-11-30');
    expect(isActiveOn(w, '2026-11-01')).toBe(true);
    expect(isActiveOn(w, '2026-11-15')).toBe(true);
    expect(isActiveOn(w, '2026-11-30')).toBe(true);
  });

  it('is inactive the day before it starts and the day after it ends', () => {
    const w = win('2026-11-01', '2026-11-30');
    expect(isActiveOn(w, '2026-10-31')).toBe(false);
    expect(isActiveOn(w, '2026-12-01')).toBe(false);
  });

  it('a one-day window is active on exactly that day', () => {
    const w = win('2026-11-08', '2026-11-08');
    expect(isActiveOn(w, '2026-11-07')).toBe(false);
    expect(isActiveOn(w, '2026-11-08')).toBe(true);
    expect(isActiveOn(w, '2026-11-09')).toBe(false);
  });

  it('a window that ends before it starts is never active', () => {
    const w = win('2026-11-30', '2026-11-01');
    for (const day of ['2026-10-31', '2026-11-01', '2026-11-15', '2026-11-30', '2026-12-01']) {
      expect(isActiveOn(w, day)).toBe(false);
    }
  });

  it('compares across month and year ends correctly', () => {
    const w = win('2026-12-30', '2027-01-02');
    expect(isActiveOn(w, '2026-12-31')).toBe(true);
    expect(isActiveOn(w, '2027-01-01')).toBe(true);
    expect(isActiveOn(w, '2027-01-03')).toBe(false);
    expect(isActiveOn(win('2028-02-28', '2028-03-01'), '2028-02-29')).toBe(true);
  });
});

describe('isActive: the day is the IST day of the instant', () => {
  it('a window ending 31 Oct is still active at 23:59:59.999 IST and over at 00:00 IST on 1 Nov', () => {
    const w = win('2026-10-01', '2026-10-31');
    expect(isActive(w, new Date('2026-10-31T18:29:59.999Z'))).toBe(true);
    expect(isActive(w, new Date('2026-10-31T18:30:00.000Z'))).toBe(false);
  });

  it('a window starting 1 Nov is active from 00:00 IST, which is still 31 Oct in UTC', () => {
    const w = win('2026-11-01', '2026-11-30');
    expect(isActive(w, new Date('2026-10-31T18:29:59.999Z'))).toBe(false);
    expect(isActive(w, new Date('2026-10-31T18:30:00.000Z'))).toBe(true);
  });

  it('throws a RangeError for an invalid Date rather than guessing a day', () => {
    expect(() => isActive(win('2026-11-01', '2026-11-30'), new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe('filterActive: featured listings and campaigns', () => {
  const featured = (id: string, starts_on: string, ends_on: string): FeaturedView => ({
    business_id: `00000000-0000-4000-8000-00000000000${id}`,
    tier: 'featured',
    locality_ids: ['kothrud'],
    category_ids: ['waterproofing'],
    starts_on,
    ends_on,
  });
  const campaign = (id: string, starts_on: string, ends_on: string): CampaignView => ({
    id: `00000000-0000-4000-8000-00000000010${id}`,
    kind: 'sponsorship',
    advertiser_name: `Example advertiser ${id}`,
    target_locality: null,
    target_category: null,
    creative: { text: `Example creative ${id}`, url: 'https://example.com/offer', image: null },
    starts_on,
    ends_on,
  });
  const NOW = new Date('2026-11-10T06:30:00Z'); // 12:00 IST on 10 Nov 2026

  it('keeps the active featured listings, in their original order', () => {
    const items = [
      featured('1', '2026-11-10', '2026-11-20'),
      featured('2', '2026-10-01', '2026-11-09'),
      featured('3', '2026-11-11', '2026-12-01'),
      featured('4', '2026-01-01', '2026-11-10'),
      featured('5', '2026-11-01', '2026-11-30'),
    ];
    expect(filterActive(items, NOW).map((f) => f.business_id.slice(-1))).toEqual(['1', '4', '5']);
  });

  it('works for campaigns and keeps the campaign type', () => {
    const items = [campaign('1', '2026-11-01', '2026-11-30'), campaign('2', '2026-12-01', '2026-12-31')];
    const active: CampaignView[] = filterActive(items, NOW);
    expect(active).toEqual([items[0]]);
  });

  it('returns a new array, never changes its input, and returns the same objects', () => {
    const items = [featured('1', '2026-11-01', '2026-11-30')];
    const snapshot = structuredClone(items);
    const active = filterActive(items, NOW);
    expect(active).not.toBe(items);
    expect(active[0]).toBe(items[0]);
    expect(items).toEqual(snapshot);
  });

  it('returns an empty array for no items, or when nothing is active', () => {
    expect(filterActive([], NOW)).toEqual([]);
    expect(filterActive([featured('1', '2026-12-01', '2026-12-31')], NOW)).toEqual([]);
  });
});
