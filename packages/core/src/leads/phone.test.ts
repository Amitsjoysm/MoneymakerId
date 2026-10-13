import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PhoneE164Schema } from '../schema/index.ts';
import { normalisePhone } from './phone.ts';

// +919876543210 is the project's invented fixture phone (never MarketMind AI's own WhatsApp number).
const E164 = '+919876543210';

describe('normalisePhone: accepted forms', () => {
  it.each([
    ['plain ten digits', '9876543210'],
    ['ten digits with a space', '98765 43210'],
    ['plus 91, space and hyphen', '+91 98765-43210'],
    ['0 + 91 + ten digits', '0919876543210'],
    ['trunk 0 + ten digits', '09876543210'],
    ['91 + ten digits', '919876543210'],
    ['plus 91 with no separators', '+919876543210'],
    ['00 international prefix', '0091 98765 43210'],
    ['hyphens and parentheses', '(+91) 98765-43210'],
    ['dots', '98765.43210'],
    ['en dash and non-breaking space', '98765\u201343210\u00a0'],
    ['surrounding whitespace', '  9876543210\n'],
    ['full-width digits (NFKC)', '９８７６５４３２１０'],
    ['Devanagari digits', '९८७६५४३२१०'],
    ['Devanagari digits with +91', '+९१ ९८७६५-४३२१०'],
  ])('%s', (_label, input) => {
    expect(normalisePhone(input)).toBe(E164);
  });

  it.each(['6000000000', '7123456789', '8123456789', '9123456789'])(
    'accepts a mobile starting 6-9 (%s)',
    (digits) => {
      expect(normalisePhone(digits)).toBe(`+91${digits}`);
    },
  );

  it('a ten-digit mobile that starts with 91 is not mistaken for the country code', () => {
    expect(normalisePhone('9198765432')).toBe('+919198765432');
  });
});

describe('normalisePhone: rejected input', () => {
  it.each([
    ['Pune landline with STD code', '020 2712 3456'],
    ['Pune landline with STD code, no spaces', '02027123456'],
    ['landline digits only', '2027123456'],
    ['landline after +91', '+91 20 2712 3456'],
    ['mobile starting with 5', '5876543210'],
    ['mobile starting with 0 after the trunk 0', '00987654321'],
    ['UK number', '+44 7911 123456'],
    ['US number', '+1 415 555 2671'],
    ['00 prefix for another country', '0044 7911 123456'],
    ['+ with no country code', '+9876543210'],
    ['nine digits', '987654321'],
    ['eleven digits with no trunk 0', '19876543210'],
    ['twelve digits not starting with 91', '449876543210'],
    ['thirteen digits', '9109876543210'],
    ['too many digits', '98765432101234'],
    ['letters', '98765abcde'],
    ['extension', '9876543210 x12'],
    ['plus in the middle', '98765+43210'],
    ['two plus signs', '++919876543210'],
    ['empty string', ''],
    ['only spaces', '   '],
    ['only a plus', '+'],
  ])('%s', (_label, input) => {
    expect(normalisePhone(input)).toBeNull();
  });

  it('returns null, not a throw, for a value that is not a string', () => {
    expect(normalisePhone(undefined as unknown as string)).toBeNull();
    expect(normalisePhone(null as unknown as string)).toBeNull();
    expect(normalisePhone(9876543210 as unknown as string)).toBeNull();
  });
});

describe('normalisePhone: properties', () => {
  const mobile = fc
    .tuple(fc.integer({ min: 6, max: 9 }), fc.stringMatching(/^\d{9}$/))
    .map(([first, rest]) => `${first}${rest}`);

  it('every Indian mobile written in any accepted prefix normalises to the same valid E.164 number', () => {
    fc.assert(
      fc.property(
        mobile,
        fc.constantFrom('', '0', '91', '+91', '091', '0091', '+91 ', '(+91) '),
        (digits, prefix) => {
          const out = normalisePhone(`${prefix}${digits.slice(0, 5)} ${digits.slice(5)}`);
          expect(out).toBe(`+91${digits}`);
          expect(PhoneE164Schema.safeParse(out).success).toBe(true);
        },
      ),
    );
  });

  it('is idempotent: a normalised number normalises to itself', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }), (input) => {
        const once = normalisePhone(input);
        if (once !== null) expect(normalisePhone(once)).toBe(once);
      }),
      { numRuns: 500 },
    );
  });

  it('anything it returns satisfies the contract regex', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[+\d ()\-.]{0,18}$/), (input) => {
        const out = normalisePhone(input);
        if (out !== null) expect(out).toMatch(/^\+91[6-9]\d{9}$/);
      }),
      { numRuns: 1000 },
    );
  });
});
