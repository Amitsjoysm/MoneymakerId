import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { WHATSAPP_NUMBER, whatsappUrl } from './whatsapp.ts';

describe('whatsappUrl', () => {
  it('is the exact wa.me URL: number, then text and a Ref line, percent-encoded', () => {
    expect(
      whatsappUrl({ text: 'Hi, I want a quote for terrace waterproofing in Wakad.', ref: 'C-WAKAD-WPT' }),
    ).toBe(
      'https://wa.me/919834346179?text=Hi%2C%20I%20want%20a%20quote%20for%20terrace%20waterproofing%20in%20Wakad.%0A%0ARef%20C-WAKAD-WPT',
    );
  });

  it('uses the MarketMind AI number by default', () => {
    expect(WHATSAPP_NUMBER).toBe('919834346179');
    expect(
      whatsappUrl({ text: 'Hello', ref: 'MM-AB12CD' }).startsWith('https://wa.me/919834346179?text='),
    ).toBe(true);
  });

  it('takes the number from the caller, which passes the WHATSAPP_NUMBER env value', () => {
    expect(whatsappUrl({ text: 'Hello', ref: 'MM-AB12CD' }, '919000000001')).toBe(
      'https://wa.me/919000000001?text=Hello%0A%0ARef%20MM-AB12CD',
    );
  });

  it('falls back to the default number when the caller passes undefined (an unset env value)', () => {
    expect(whatsappUrl({ text: 'Hello', ref: 'MM-AB12CD' }, undefined)).toBe(
      'https://wa.me/919834346179?text=Hello%0A%0ARef%20MM-AB12CD',
    );
  });

  it('encodes with encodeURIComponent: non-ASCII, emoji, ampersands and question marks cannot break the query', () => {
    const text = 'मला कोटेशन हवे & more? 100% 🙂';
    const url = whatsappUrl({ text, ref: 'C-PUNE-WP' });
    expect(url).toBe(`https://wa.me/919834346179?text=${encodeURIComponent(`${text}\n\nRef C-PUNE-WP`)}`);
    const parsed = new URL(url);
    expect([...parsed.searchParams.keys()]).toEqual(['text']);
    expect(parsed.searchParams.get('text')).toBe(`${text}\n\nRef C-PUNE-WP`);
  });

  it('trims the text, and with no text sends only the Ref line', () => {
    expect(whatsappUrl({ text: '  Hello  \n', ref: 'C-PUNE-WP' })).toBe(
      'https://wa.me/919834346179?text=Hello%0A%0ARef%20C-PUNE-WP',
    );
    expect(whatsappUrl({ text: '   ', ref: 'C-PUNE-WP' })).toBe(
      'https://wa.me/919834346179?text=Ref%20C-PUNE-WP',
    );
  });

  it('always carries the ref: an empty or malformed ref throws', () => {
    for (const ref of ['', '   ', 'has space', 'new\nline', 'C-WAKAD-WP!', 'x'.repeat(65)]) {
      expect(() => whatsappUrl({ text: 'Hello', ref }), JSON.stringify(ref)).toThrow(RangeError);
    }
  });

  it('rejects a number that is not digits only (no plus, spaces or letters) or has an impossible length', () => {
    for (const number of [
      '',
      '+919834346179',
      '91 98343 46179',
      '91983434617x',
      '123456789',
      '1234567890123456',
      '0919834346179',
    ]) {
      expect(() => whatsappUrl({ text: 'Hello', ref: 'C-PUNE-WP' }, number), JSON.stringify(number)).toThrow(
        RangeError,
      );
    }
  });

  it('property: the decoded text is always the trimmed text plus the Ref line, for any text', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (text) => {
        const url = whatsappUrl({ text, ref: 'C-WAKAD-WP' });
        expect(url.startsWith('https://wa.me/919834346179?text=')).toBe(true);
        const decoded = new URL(url).searchParams.get('text');
        const trimmed = text.trim();
        expect(decoded).toBe(trimmed === '' ? 'Ref C-WAKAD-WP' : `${trimmed}\n\nRef C-WAKAD-WP`);
      }),
    );
  });
});
