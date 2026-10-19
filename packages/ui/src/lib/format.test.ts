import { describe, expect, it } from 'vitest';
import { formatDate, formatInr, formatInrRange, formatQuantity, perUnit } from './format.ts';

describe('formatInr', () => {
  it('uses Indian digit grouping and the rupee sign', () => {
    expect(formatInr(55)).toBe('₹55');
    expect(formatInr(1000)).toBe('₹1,000');
    expect(formatInr(55000)).toBe('₹55,000');
    expect(formatInr(100000)).toBe('₹1,00,000');
    expect(formatInr(12345678)).toBe('₹1,23,45,678');
  });

  it('refuses amounts that are not whole non-negative rupees (CONTRACTS §1: integer INR)', () => {
    expect(() => formatInr(55.5)).toThrow(RangeError);
    expect(() => formatInr(-1)).toThrow(RangeError);
    expect(() => formatInr(Number.NaN)).toThrow(RangeError);
  });
});

describe('formatInrRange', () => {
  it('joins low and high with an en dash and no spaces', () => {
    expect(formatInrRange(35, 100)).toBe('₹35–₹100');
    expect(formatInrRange(35000, 100000)).toBe('₹35,000–₹1,00,000');
  });

  it('collapses a range whose ends are equal', () => {
    expect(formatInrRange(55, 55)).toBe('₹55');
  });

  it('refuses a reversed range', () => {
    expect(() => formatInrRange(100, 35)).toThrow(RangeError);
  });
});

describe('formatDate', () => {
  it('writes a date-only ISO value as day, short month, year', () => {
    expect(formatDate('2026-10-06')).toBe('6 Oct 2026');
    expect(formatDate('2027-04-04')).toBe('4 Apr 2027');
  });

  it('reads a timestamp in IST, so a late-evening UTC time is already the next day', () => {
    expect(formatDate('2026-10-05T20:00:00Z')).toBe('6 Oct 2026');
  });

  it('refuses text that is not an ISO date', () => {
    expect(() => formatDate('6 Oct 2026')).toThrow(RangeError);
    expect(() => formatDate('2026-02-30')).toThrow(RangeError);
  });
});

describe('units', () => {
  it('names each cost unit the way a Pune homeowner says it', () => {
    expect(perUnit('sqft')).toBe('per sq ft');
    expect(perUnit('rft')).toBe('per running ft');
    expect(perUnit('unit')).toBe('per unit');
    expect(perUnit('project')).toBe('per project');
  });

  it('formats a quantity with Indian grouping and its unit', () => {
    expect(formatQuantity(1000, 'sqft')).toBe('1,000 sq ft');
    expect(formatQuantity(1, 'unit')).toBe('1 unit');
    expect(formatQuantity(3, 'unit')).toBe('3 units');
  });
});
