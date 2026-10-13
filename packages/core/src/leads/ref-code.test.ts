import { describe, expect, it } from 'vitest';
import { ALL_SERVICE_IDS, LOCALITY_IDS, SUB_LOCALITY_IDS } from '../constants/index.ts';
import { LeadAttributionSchema } from '../schema/index.ts';
import { refCode, SERVICE_REF_ABBR } from './ref-code.ts';

describe('refCode', () => {
  it('matches the plan example: Ref C-WAKAD-WP', () => {
    expect(refCode({ localityId: 'wakad', serviceId: 'waterproofing' })).toBe('C-WAKAD-WP');
  });

  it.each([
    ['baner', 'house-construction', 'C-BANER-HC'],
    ['kharadi', 'modular-kitchen', 'C-KHARADI-MK'],
    ['pimple-saudagar', 'terrace-waterproofing', 'C-PIMPLE-SAUDAGAR-TWP'],
    ['hinjewadi-phase-1', 'basement-waterproofing', 'C-HINJEWADI-PHASE-1-BSWP'],
    ['near-xyz-metro', 'interior-painting', 'C-NEAR-XYZ-METRO-IPT'],
  ])('%s + %s -> %s', (localityId, serviceId, expected) => {
    expect(refCode({ localityId, serviceId })).toBe(expected);
  });

  it('uses the city when the page has no locality yet (a city guide or the calculator)', () => {
    expect(refCode({ localityId: null, serviceId: 'painting' })).toBe('C-PUNE-PT');
  });

  it('is deterministic: the same page always prints the same code', () => {
    const input = { localityId: 'wagholi', serviceId: 'leakage-repair' };
    expect(refCode(input)).toBe(refCode({ ...input }));
  });

  it('rejects a service with no abbreviation and a locality that is not a slug', () => {
    expect(() => refCode({ localityId: 'wakad', serviceId: 'plumbing' })).toThrow(RangeError);
    // Inherited object keys are not services.
    expect(() => refCode({ localityId: 'wakad', serviceId: 'constructor' })).toThrow(RangeError);
    expect(() => refCode({ localityId: 'wakad', serviceId: 'toString' })).toThrow(RangeError);
    expect(() => refCode({ localityId: 'Wakad', serviceId: 'waterproofing' })).toThrow(RangeError);
    expect(() => refCode({ localityId: 'wakad!', serviceId: 'waterproofing' })).toThrow(RangeError);
    expect(() => refCode({ localityId: '', serviceId: 'waterproofing' })).toThrow(RangeError);
  });
});

describe('SERVICE_REF_ABBR', () => {
  it('has an entry for each of the 12 service ids and no others', () => {
    expect(Object.keys(SERVICE_REF_ABBR).sort()).toEqual([...ALL_SERVICE_IDS].sort());
    expect(ALL_SERVICE_IDS).toHaveLength(12);
  });

  it('abbreviations are unique, uppercase ASCII letters', () => {
    const abbreviations = Object.values(SERVICE_REF_ABBR);
    expect(new Set(abbreviations).size).toBe(abbreviations.length);
    for (const abbr of abbreviations) expect(abbr).toMatch(/^[A-Z]{2,4}$/);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(SERVICE_REF_ABBR)).toBe(true);
  });
});

describe('every locality x service code', () => {
  const localities = [...LOCALITY_IDS, ...SUB_LOCALITY_IDS, 'near-example-landmark'];

  it('is uppercase ASCII, starts with C-, is unique, and fits the attribution schema', () => {
    const seen = new Map<string, string>();
    for (const localityId of localities) {
      for (const serviceId of ALL_SERVICE_IDS) {
        const code = refCode({ localityId, serviceId });
        expect(code).toMatch(/^C-[A-Z0-9]+(?:-[A-Z0-9]+)*$/);
        expect(
          seen.get(code),
          `${code} is shared by ${seen.get(code)} and ${localityId}/${serviceId}`,
        ).toBeUndefined();
        seen.set(code, `${localityId}/${serviceId}`);
        const attribution = LeadAttributionSchema.shape.ref_code.safeParse(code);
        expect(attribution.success, code).toBe(true);
      }
    }
    expect(seen.size).toBe(localities.length * ALL_SERVICE_IDS.length);
  });
});
