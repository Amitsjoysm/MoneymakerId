import { describe, expect, it } from 'vitest';
import { CRAVING_LEXICON, DIET_LEXICON, NEUTRAL_WORDS, OPEN_NOW_LEXICON, scanLexicon } from './lexicon.ts';

const scan = <T>(words: string, lexicon: Parameters<typeof scanLexicon<T>>[2]) => {
  const tokens = words.split(' ');
  return scanLexicon(tokens, new Array<boolean>(tokens.length).fill(false), lexicon);
};

describe('scanLexicon', () => {
  it('prefers the longest phrase at a position, so "non veg" is not "veg"', () => {
    expect(scan('non veg thali', DIET_LEXICON)).toEqual([{ value: 'non_veg', start: 0, end: 2 }]);
    expect(scan('pure veg thali', DIET_LEXICON)).toEqual([{ value: 'veg', start: 0, end: 2 }]);
    expect(scan('veg and non veg', DIET_LEXICON)).toEqual([
      { value: 'veg', start: 0, end: 1 },
      { value: 'non_veg', start: 2, end: 4 },
    ]);
  });

  it('skips words that are already claimed', () => {
    const tokens = ['late', 'night', 'food'];
    expect(scanLexicon(tokens, [true, false, false], CRAVING_LEXICON)).toEqual([]);
  });

  it('matches whole words only', () => {
    expect(scan('vegan vegetables', DIET_LEXICON)).toEqual([]);
  });

  it('reads the open-now phrases', () => {
    expect(scan('abhi khula hai', OPEN_NOW_LEXICON)).toEqual([{ value: true, start: 0, end: 3 }]);
    expect(scan('open now', OPEN_NOW_LEXICON)).toHaveLength(1);
    expect(scan('open', OPEN_NOW_LEXICON)).toEqual([]);
    expect(scan('now', OPEN_NOW_LEXICON)).toEqual([]);
  });
});

describe('word lists', () => {
  it('keeps the neutral words clear of single-word cravings and diets, and of the names the fixtures use', () => {
    // Lexicons are scanned before neutral words are dropped, so a neutral word may sit inside a phrase ("raat ko").
    for (const e of [...CRAVING_LEXICON, ...DIET_LEXICON, ...OPEN_NOW_LEXICON]) {
      expect(NEUTRAL_WORDS.has(e.phrase), e.phrase).toBe(false);
    }
    for (const w of ['biryani', 'pav', 'thali', 'waterproofing', 'kitchen', 'terrace', 'painting', 'veg']) {
      expect(NEUTRAL_WORDS.has(w), w).toBe(false);
    }
  });

  it('does not list "i": it is the Roman numeral in "Hinjewadi Phase I" as well as a pronoun', () => {
    expect(NEUTRAL_WORDS.has('i')).toBe(false);
  });

  it('has only lowercase, space-free entries in phrases split by single spaces', () => {
    for (const e of [...CRAVING_LEXICON, ...DIET_LEXICON, ...OPEN_NOW_LEXICON]) {
      expect(e.phrase).toBe(e.phrase.toLowerCase());
      expect(e.phrase).not.toMatch(/^\s|\s$|\s\s/);
    }
  });
});
