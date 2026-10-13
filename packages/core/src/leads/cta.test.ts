import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ctaCopy } from './cta.ts';

const base = { service: 'terrace waterproofing', locality: 'Wakad' };

/** Every string the copy contains, which is what a visitor can read. */
const allText = (copy: ReturnType<typeof ctaCopy>) =>
  [copy.label, copy.description, copy.microcopy].join('\n');

describe('ctaCopy: the honest "3 quotes" rule (plan §13)', () => {
  it('with 3 or more accepting providers says "Get up to 3 free quotes"', () => {
    const copy = ctaCopy({ ...base, acceptingProviders: 3 });
    expect(copy.label).toBe('Get up to 3 free quotes');
    expect(copy.promisesMultipleQuotes).toBe(true);
    expect(copy.description).toBe(
      "Tell us about your terrace waterproofing job in Wakad and we'll share it with local contractors who take this work.",
    );
    expect(copy.microcopy).toBe(
      'Free · no obligation · shared with at most 3 verified contractors · no spam calls',
    );
  });

  it('with fewer than 3 says "Get a free quote — we\'ll connect you with a local contractor"', () => {
    const copy = ctaCopy({ ...base, acceptingProviders: 2 });
    expect(copy.label).toBe("Get a free quote — we'll connect you with a local contractor");
    expect(copy.promisesMultipleQuotes).toBe(false);
    expect(copy.description).toBe(
      "Tell us about your terrace waterproofing job in Wakad and we'll connect you with a local contractor.",
    );
    expect(copy.microcopy).toBe('Free · no obligation · no spam calls');
  });

  it('property over 0..10: the number 3 and "three" appear only with 3 or more accepting providers', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (acceptingProviders) => {
        const copy = ctaCopy({ ...base, acceptingProviders });
        const text = allText(copy);
        const claimsThree = /\b3\b|\bthree\b/i.test(text);
        expect(claimsThree).toBe(acceptingProviders >= 3);
        expect(copy.promisesMultipleQuotes).toBe(acceptingProviders >= 3);
        expect(/3 (free )?quotes/i.test(text)).toBe(acceptingProviders >= 3);
        expect(/\bquotes\b/i.test(copy.label)).toBe(acceptingProviders >= 3);
      }),
      { numRuns: 200 },
    );
  });

  it.each([0, 1, 2])('%i accepting providers never read as 3 quotes', (acceptingProviders) => {
    expect(allText(ctaCopy({ ...base, acceptingProviders }))).not.toMatch(/3|three/i);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a negative count', -1],
    ['a fraction below 3', 2.9],
    ['a fraction above 3', 3.5],
  ])(
    'a count that is not a whole number of at least 3 (%s) is treated as too few',
    (_label, acceptingProviders) => {
      const copy = ctaCopy({ ...base, acceptingProviders });
      expect(copy.promisesMultipleQuotes).toBe(false);
      expect(allText(copy)).not.toMatch(/3|three/i);
    },
  );

  it('a count that is not a number at all (bad data from outside) is treated as too few', () => {
    const copy = ctaCopy({ ...base, acceptingProviders: '5' as unknown as number });
    expect(copy.promisesMultipleQuotes).toBe(false);
  });
});

describe('ctaCopy: service and locality', () => {
  it('names the display service and locality, and falls back to Pune with no locality', () => {
    expect(
      ctaCopy({ acceptingProviders: 5, service: 'house construction', locality: null }).description,
    ).toBe(
      "Tell us about your house construction job in Pune and we'll share it with local contractors who take this work.",
    );
    expect(ctaCopy({ acceptingProviders: 0, service: 'painting', locality: 'Baner' }).description).toBe(
      "Tell us about your painting job in Baner and we'll connect you with a local contractor.",
    );
  });
});
