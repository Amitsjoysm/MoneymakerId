import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { damerauLevenshtein, foldText, maxEdits, normaliseText, tokenise } from './text.ts';

describe('normaliseText', () => {
  it.each([
    ['Hinjewadi', 'hinjewadi'],
    ['  Koregaon   Park ', 'koregaon park'],
    ['Pimple-Saudagar', 'pimple saudagar'],
    ['Wakad, Pune!', 'wakad pune'],
    ['wakad_pune', 'wakad pune'],
    ["Pimple's", 'pimple s'],
    ['ＷＡＫＡＤ', 'wakad'], // full-width letters fold under NFKC
    ['Ⅻ', 'xii'], // compatibility characters fold under NFKC
    ['Hinjewadī', 'hinjewadi'], // IAST macron on a Latin letter is dropped
    ['Kothrūḍ', 'kothrud'],
    ['İstanbul', 'istanbul'], // the dotted capital I lowers to "i" plus a combining dot, which is dropped
    ['wa​kad', 'wakad'], // zero-width space is removed, not turned into a space
    ['वाकड', 'वाकड'], // Devanagari letters and vowel signs survive
    ['हिंजवडी', 'हिंजवडी'],
    ['फेज १', 'फेज 1'], // Devanagari digits become ASCII digits
    ['', ''],
    ['   ', ''],
    ['!!!', ''],
  ])('%j -> %j', (input, expected) => {
    expect(normaliseText(input)).toBe(expected);
  });

  it('is idempotent', () => {
    fc.assert(fc.property(fc.string(), (s) => normaliseText(normaliseText(s)) === normaliseText(s)));
  });

  it('never leaves leading, trailing or doubled spaces', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const n = normaliseText(s);
        return n === n.trim() && !n.includes('  ');
      }),
    );
  });
});

describe('foldText', () => {
  it('keeps punctuation, so the budget parser can read "₹" and "/-"', () => {
    expect(foldText('Under ₹200/-')).toBe('under ₹200/-');
  });

  it('folds Devanagari digits', () => {
    expect(foldText('₹२००')).toBe('₹200');
  });
});

describe('tokenise', () => {
  it('splits the normalised text on spaces', () => {
    expect(tokenise('Biryani near Wakad, Pune')).toEqual(['biryani', 'near', 'wakad', 'pune']);
  });

  it('returns no tokens for blank input', () => {
    expect(tokenise('  ')).toEqual([]);
  });
});

describe('damerauLevenshtein', () => {
  it.each([
    ['', '', 0],
    ['abc', 'abc', 0],
    ['', 'abc', 3],
    ['abc', '', 3],
    ['kitten', 'sitting', 3],
    ['ab', 'ba', 1], // one transposition
    ['ca', 'abc', 2], // the unrestricted distance; the restricted "optimal string alignment" gives 3
    ['hinjawadi', 'hinjewadi', 1],
    ['hinjewdi', 'hinjewadi', 1],
    ['wakkad', 'wakad', 1],
    ['kharedi', 'kharadi', 1],
    ['waterprofing', 'waterproofing', 1],
    ['terace', 'terrace', 1],
    ['वाकड', 'वाकड', 0],
    ['वाकड', 'वाकद', 1],
  ])('%j vs %j = %i', (a, b, d) => {
    expect(damerauLevenshtein(a, b)).toBe(d);
  });

  it('stops early: any answer above the bound is reported as bound + 1', () => {
    expect(damerauLevenshtein('abcdefgh', 'x', 2)).toBe(3);
    expect(damerauLevenshtein('abcdef', 'abcxyz', 2)).toBeGreaterThan(2);
    expect(damerauLevenshtein('abcdef', 'abcxef', 2)).toBe(1);
  });

  it('is a symmetric distance that is zero only for equal strings', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 12 }), fc.string({ maxLength: 12 }), (a, b) => {
        const d = damerauLevenshtein(a, b);
        return d === damerauLevenshtein(b, a) && (d === 0) === (a === b);
      }),
    );
  });

  it('never exceeds the length of the longer string and obeys the triangle inequality', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 8 }),
        fc.string({ maxLength: 8 }),
        fc.string({ maxLength: 8 }),
        (a, b, c) => {
          const ab = damerauLevenshtein(a, b);
          return (
            ab <= Math.max(a.length, b.length) &&
            damerauLevenshtein(a, c) <= ab + damerauLevenshtein(b, c) + 0 // the unrestricted distance is a metric
          );
        },
      ),
    );
  });
});

describe('damerauLevenshtein against a search over edit operations', () => {
  // The distance is the fewest single edits (insert, delete, substitute, swap two neighbours) that turn one string into
  // the other. Search all strings reachable in up to two edits and compare, on a three-letter alphabet.
  const ALPHABET = ['a', 'b', 'c'];
  function neighbours(s: string): Set<string> {
    const out = new Set<string>();
    for (let i = 0; i <= s.length; i++) for (const c of ALPHABET) out.add(s.slice(0, i) + c + s.slice(i));
    for (let i = 0; i < s.length; i++) {
      out.add(s.slice(0, i) + s.slice(i + 1));
      for (const c of ALPHABET) out.add(s.slice(0, i) + c + s.slice(i + 1));
      if (i + 1 < s.length) out.add(s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2));
    }
    out.delete(s);
    return out;
  }
  function withinTwo(a: string): Map<string, number> {
    const seen = new Map<string, number>([[a, 0]]);
    for (const n1 of neighbours(a)) {
      if (!seen.has(n1)) seen.set(n1, 1);
    }
    for (const [s, d] of [...seen]) {
      if (d !== 1) continue;
      for (const n2 of neighbours(s)) if (!seen.has(n2)) seen.set(n2, 2);
    }
    return seen;
  }

  it('agrees with the search for every distance up to 2, and reports more than 2 as 3', () => {
    const word = fc.stringMatching(/^[abc]{0,6}$/);
    fc.assert(
      fc.property(word, word, (a, b) => {
        const reach = withinTwo(a).get(b);
        return damerauLevenshtein(a, b, 2) === (reach ?? 3);
      }),
      { numRuns: 400 },
    );
  });

  it('gives the same answer with the trimmed middle as without a bound', () => {
    const word = fc.stringMatching(/^[abc]{0,8}$/);
    fc.assert(
      fc.property(word, word, (a, b) => {
        const d = damerauLevenshtein(a, b);
        return (
          damerauLevenshtein(a, b, 2) === Math.min(d, 3) && damerauLevenshtein(a, b, 5) === Math.min(d, 6)
        );
      }),
      { numRuns: 300 },
    );
  });

  it('handles strings longer than its scratch space', () => {
    const a = 'ab'.repeat(40);
    expect(damerauLevenshtein(a, `${a}c`)).toBe(1);
    expect(damerauLevenshtein(a, `x${a.slice(1)}`)).toBe(1);
    expect(damerauLevenshtein(a, 'ba'.repeat(40))).toBe(2); // one swap's worth of insert and delete at the ends
  });
});

describe('maxEdits', () => {
  it.each([
    [1, 0],
    [4, 0], // "damp" must not become "camp"; "came" must not become "camp"
    [5, 1],
    [6, 2],
    [12, 2],
  ])('a form of %i characters allows %i edits', (len, edits) => {
    expect(maxEdits(len)).toBe(edits);
  });
});
