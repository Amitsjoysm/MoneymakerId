import { describe, expect, it } from 'vitest';
import {
  GeoSchema,
  InrSchema,
  IsoDateSchema,
  PhoneE164Schema,
  ReferenceIdSchema,
  SlugSchema,
  TimestampSchema,
  UuidSchema,
} from './primitives.ts';

const ok = (s: { safeParse(v: unknown): { success: boolean } }, v: unknown) => s.safeParse(v).success;

describe('SlugSchema / ReferenceIdSchema', () => {
  it.each(['pune', 'hinjewadi-phase-1', 'near-xyz', 'a1', 'chole-bhature'])('slug accepts %s', (v) => {
    expect(ok(SlugSchema, v)).toBe(true);
  });
  it.each(['', 'Pune', 'a_b', 'a--b', '-a', 'a-', 'a b', 'पुणे', 'a.b'])('slug rejects %j', (v) => {
    expect(ok(SlugSchema, v)).toBe(false);
  });
  it('ReferenceId also rejects reserved slugs', () => {
    expect(ok(ReferenceIdSchema, 'baner')).toBe(true);
    for (const v of ['veg', 'ask', 'under-250', 'terrace-waterproofing-cost', 'hi']) {
      expect(ok(ReferenceIdSchema, v), v).toBe(false);
    }
  });
});

describe('dates, timestamps, uuids', () => {
  it('IsoDate is a real YYYY-MM-DD calendar date', () => {
    expect(ok(IsoDateSchema, '2026-10-07')).toBe(true);
    for (const v of ['2026-02-30', '2026-10-7', '07-10-2026', '2026-10-07T00:00:00Z', '']) {
      expect(ok(IsoDateSchema, v), v).toBe(false);
    }
  });
  it('Timestamp is ISO 8601 with a zone (Z or offset), with any sub-second precision', () => {
    for (const v of ['2026-10-07T10:00:00Z', '2026-10-07T10:00:00.123456+00:00', '2026-10-07T15:30:00+05:30']) {
      expect(ok(TimestampSchema, v), v).toBe(true);
    }
    for (const v of ['2026-10-07', '2026-10-07T10:00:00', 'yesterday']) {
      expect(ok(TimestampSchema, v), v).toBe(false);
    }
  });
  it('Uuid accepts crypto.randomUUID() output', () => {
    expect(ok(UuidSchema, crypto.randomUUID())).toBe(true);
    expect(ok(UuidSchema, 'not-a-uuid')).toBe(false);
  });
});

describe('money, phone, geo', () => {
  it('Inr is a non-negative integer', () => {
    expect(ok(InrSchema, 0)).toBe(true);
    expect(ok(InrSchema, 249)).toBe(true);
    for (const v of [-1, 2.5, '249', Number.NaN, Infinity]) expect(ok(InrSchema, v), String(v)).toBe(false);
  });
  it('PhoneE164 matches the Indian mobile rule', () => {
    expect(ok(PhoneE164Schema, '+919834346179')).toBe(true);
    for (const v of ['9834346179', '+915834346179', '+91983434617', '+9198343461790', '+14155550100']) {
      expect(ok(PhoneE164Schema, v), v).toBe(false);
    }
  });
  it('Geo is WGS84 lat/lng', () => {
    expect(ok(GeoSchema, { lat: 18.5913, lng: 73.7389 })).toBe(true);
    expect(ok(GeoSchema, { lat: 91, lng: 73 })).toBe(false);
    expect(ok(GeoSchema, { lat: 18, lng: 181 })).toBe(false);
    expect(ok(GeoSchema, { lat: 18, lng: 73, extra: 1 })).toBe(false);
  });
});
