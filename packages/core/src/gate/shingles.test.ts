import { describe, expect, it } from 'vitest';
import { jaccard, shingleSet, shinglesOf, uniquenessScore, words } from './shingles.ts';

describe('words', () => {
  it('NFKC-normalises, lowercases and splits on anything that is not a letter, mark or digit', () => {
    expect(words('ＨＩＮＪＥＷＡＤＩ Park, near-the Metro 3!')).toEqual([
      'hinjewadi',
      'park',
      'near',
      'the',
      'metro',
      '3',
    ]);
  });

  it('keeps Devanagari vowel signs inside the word', () => {
    expect(words('हिंजवडी में बिरयानी')).toEqual(['हिंजवडी', 'में', 'बिरयानी']);
  });

  it('returns no words for empty or punctuation-only text', () => {
    expect(words('')).toEqual([]);
    expect(words(' ... -- ')).toEqual([]);
  });
});

describe('shingleSet', () => {
  it('makes word 5-shingles', () => {
    expect([...shingleSet('one two three four five six')]).toEqual([
      'one two three four five',
      'two three four five six',
    ]);
  });

  it('uses the whole text as one shingle when it has fewer than five words', () => {
    expect([...shingleSet('Just three words')]).toEqual(['just three words']);
  });

  it('is empty for empty text and collapses repeated shingles', () => {
    expect(shingleSet('').size).toBe(0);
    expect(shingleSet('a b c d e a b c d e').size).toBe(5);
  });

  it('does not care about case or punctuation', () => {
    expect(shingleSet('Alpha, Beta; gamma delta EPSILON')).toEqual(
      shingleSet('alpha beta gamma delta epsilon'),
    );
  });
});

describe('jaccard', () => {
  it('is 1 for identical sets and 0 for disjoint ones', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(1);
    expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
  });

  it('is |intersection| / |union|', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3, 12);
  });

  it('treats two empty sets as identical and one empty set as disjoint', () => {
    expect(jaccard(new Set(), new Set())).toBe(1);
    expect(jaccard(new Set(), new Set(['a']))).toBe(0);
    expect(jaccard(new Set(['a']), new Set())).toBe(0);
  });
});

describe('uniquenessScore', () => {
  const base = { main_text: 'one two three four five six seven eight' }; // 4 shingles

  it('is 1 when there are no siblings', () => {
    expect(uniquenessScore(base, [])).toBe(1);
  });

  it('is 0 against an identical sibling', () => {
    expect(uniquenessScore(base, [{ main_text: 'ONE two three four five six seven eight.' }])).toBe(0);
  });

  it('is 1 minus the highest similarity over all siblings', () => {
    const near = { main_text: 'one two three four five six seven nine' }; // shares 3 of 4+1 -> 3/5
    const far = { main_text: 'alpha beta gamma delta epsilon zeta eta theta' };
    expect(uniquenessScore(base, [far, near])).toBeCloseTo(1 - 3 / 5, 12);
    expect(uniquenessScore(base, [near, far])).toBeCloseTo(1 - 3 / 5, 12);
  });

  it('is 1 against siblings that share nothing', () => {
    expect(uniquenessScore(base, [{ main_text: 'completely different words appear on this page' }])).toBe(1);
  });

  it('counts two empty pages as duplicates of each other, but an empty page against real text as unique', () => {
    expect(uniquenessScore({ main_text: '' }, [{ main_text: '' }])).toBe(0);
    expect(uniquenessScore({ main_text: '' }, [base])).toBe(1);
  });
  it('equals one minus the brute-force highest Jaccard, whatever the lengths (the size bound prunes, never changes)', () => {
    let seed = 7;
    const next = (n: number): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % n;
    };
    const vocabulary = ['rain', 'roof', 'seal', 'coat', 'tile', 'leak', 'wall', 'crack', 'paint', 'layer'];
    const text = (): string =>
      Array.from({ length: next(40) + (next(4) === 0 ? 0 : 5) }, () => vocabulary[next(10)]).join(' ');
    const pages = Array.from({ length: 40 }, () => ({ main_text: text() }));
    for (const [i, page] of pages.entries()) {
      const others = pages.filter((_, j) => j !== i);
      const brute = Math.max(
        0,
        ...others.map((o) => jaccard(shingleSet(page.main_text), shingleSet(o.main_text))),
      );
      expect(uniquenessScore(page, others), `page ${i}`).toBe(1 - brute);
    }
  });
});

describe('shinglesOf: the cache follows the text', () => {
  it('scores a page by its current main_text if it was changed after it was first scored', () => {
    const page = { main_text: 'one two three four five six seven' };
    const sibling = { main_text: 'one two three four five six seven' };
    expect(uniquenessScore(page, [sibling])).toBe(0);
    page.main_text = 'completely different words appear on this page';
    expect(uniquenessScore(page, [sibling])).toBe(1);
    expect(shinglesOf(page)).toEqual(shingleSet(page.main_text));
  });
});
