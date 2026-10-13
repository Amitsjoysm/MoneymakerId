import { describe, expect, it } from 'vitest';
import { buildPhraseIndex, findPhraseMatches, pickBest } from './match.ts';
import type { PhraseEntry } from './match.ts';

const find = (tokens: string[], entries: PhraseEntry[], options = {}) =>
  findPhraseMatches(tokens, buildPhraseIndex(entries, options));

describe('findPhraseMatches: match kinds', () => {
  const entries: PhraseEntry[] = [{ id: 'viman-nagar', forms: ['Viman Nagar', 'viman nagar'] }];

  it('reports an exact match with its token span', () => {
    expect(find(['best', 'viman', 'nagar'], entries)).toMatchObject([
      { id: 'viman-nagar', start: 1, end: 3, kind: 'exact', edits: 0, strong: true, coverage: 10 },
    ]);
  });

  it('reports a match that differs only by spacing as compact', () => {
    expect(find(['vimannagar'], entries)).toMatchObject([{ kind: 'compact', edits: 0, strong: true }]);
  });

  it('reports a typo as fuzzy, weak, with the edit count', () => {
    expect(find(['vimaan', 'nagar'], entries)).toMatchObject([{ kind: 'fuzzy', edits: 1, strong: false }]);
    expect(find(['vimaan', 'nager'], entries)).toMatchObject([{ kind: 'fuzzy', edits: 2, strong: false }]);
  });

  it('finds nothing beyond the edit limit, or when the first letter differs on a two-edit match', () => {
    expect(find(['vmn', 'ngr'], entries)).toEqual([]);
    expect(find(['simanagar'], entries)).toEqual([]); // two edits, and the first letter changed
    expect(find(['simannagar'], entries)).toMatchObject([{ edits: 1 }]); // one edit may change the first letter
  });

  it('keeps short forms exact', () => {
    const camp: PhraseEntry[] = [{ id: 'camp', forms: ['camp'] }];
    expect(find(['came'], camp)).toEqual([]);
    expect(find(['damp'], camp)).toEqual([]);
    expect(find(['camp'], camp)).toHaveLength(1);
  });

  it('returns the best match once per entry', () => {
    const out = find(['wakad', 'wakkad'], [{ id: 'wakad', forms: ['wakad'] }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'exact', start: 0 });
  });

  it('ignores forms made only of skip words, and strips skip words from the other forms', () => {
    const out = find(['camp'], [{ id: 'camp', forms: ['pune camp', 'pune'] }], {
      skipWords: new Set(['pune']),
    });
    expect(out).toMatchObject([{ id: 'camp', kind: 'exact' }]);
    expect(find(['pune'], [{ id: 'camp', forms: ['pune'] }], { skipWords: new Set(['pune']) })).toEqual([]);
  });

  it('handles empty input', () => {
    expect(find([], entries)).toEqual([]);
    expect(find(['viman'], [])).toEqual([]);
  });
});

describe('findPhraseMatches: the first word of a longer name', () => {
  const entries: PhraseEntry[] = [
    { id: 'pimple-saudagar', forms: ['Pimple Saudagar'] },
    { id: 'pimple-nilakh', forms: ['Pimple Nilakh'] },
    { id: 'pimpri', forms: ['Pimpri'] },
  ];

  it('is not guessed as a different one-word name that is two edits away', () => {
    expect(find(['pimple'], entries)).toEqual([]); // not "pimpri"
    expect(find(['best', 'biryani', 'pimple'], entries)).toEqual([]);
  });

  it('still matches the whole name, with or without a typo, and a typo of the one-word name', () => {
    expect(find(['pimple', 'saudagar'], entries)).toMatchObject([{ id: 'pimple-saudagar', kind: 'exact' }]);
    expect(find(['pimple', 'saudgar'], entries)).toMatchObject([{ id: 'pimple-saudagar', kind: 'fuzzy' }]);
    expect(find(['pimpry'], entries)).toMatchObject([{ id: 'pimpri', kind: 'fuzzy', edits: 1 }]);
  });

  it('matches the word exactly when it is also a name of its own', () => {
    const both: PhraseEntry[] = [...entries, { id: 'pimple', forms: ['Pimple'] }];
    expect(find(['pimple'], both)).toMatchObject([{ id: 'pimple', kind: 'exact' }]);
  });

  it('ignores a skip word at the front of the longer name', () => {
    const e: PhraseEntry[] = [
      { id: 'near-wakad-bridge', forms: ['Near Wakad Bridge'] },
      { id: 'wakar', forms: ['wakar'] },
    ];
    expect(find(['wakad'], e, { skipWords: new Set(['near']) })).toEqual([]);
  });
});

describe('findPhraseMatches: part forms and stems', () => {
  const entries: PhraseEntry[] = [
    { id: 'terrace-waterproofing', forms: ['terrace waterproofing'], partForms: ['terrace'] },
    { id: 'painting', forms: ['painting'] },
  ];

  it('treats a part form as weak and a little less sure than a full form', () => {
    const [m] = find(['terrace'], entries);
    expect(m).toMatchObject({ id: 'terrace-waterproofing', kind: 'exact', part: true, strong: false });
    expect(m!.quality).toBeCloseTo(0.85, 5);
  });

  it('matches a prefix of a longer word only when stems are on, from five letters, a few letters short', () => {
    expect(find(['paint'], entries)).toEqual([]);
    const [m] = find(['paint'], entries, { stems: true });
    expect(m).toMatchObject({ id: 'painting', kind: 'stem', strong: false });
    expect(m!.quality).toBeCloseTo(0.7, 5);
    expect(find(['pain'], entries, { stems: true })).toEqual([]); // four letters: too short to stand for a word
    expect(find(['pa'], entries, { stems: true })).toEqual([]);
  });

  it('does not stem a word that is more than four letters short of the form', () => {
    expect(find(['water'], [{ id: 'x', forms: ['waterproofing'] }], { stems: true })).toEqual([]);
    expect(find(['waterproof'], [{ id: 'x', forms: ['waterproofing'] }], { stems: true })).toHaveLength(1);
  });
});

describe('pickBest', () => {
  const idx = buildPhraseIndex([
    { id: 'a-long', forms: ['alpha beta'], rank: 5 },
    { id: 'alpha', forms: ['alpha'], rank: 1 },
    { id: 'gamma', forms: ['gamma'], rank: 2 },
    { id: 'delta', forms: ['delta'], rank: 9 },
    { id: 'delta-twin', forms: ['delta'], rank: 3 },
  ]);

  it('returns null when nothing matched', () => {
    expect(pickBest([], [])).toBeNull();
  });

  it('prefers the longer span, and does not call an overlapping nested match ambiguous', () => {
    const tokens = ['alpha', 'beta'];
    const best = pickBest(findPhraseMatches(tokens, idx), tokens)!;
    expect(best).toMatchObject({ id: 'a-long', matched: 'alpha beta', confidence: 1 });
  });

  it('calls two separate strong mentions ambiguous and takes the lower rank', () => {
    const tokens = ['gamma', 'alpha'];
    const best = pickBest(findPhraseMatches(tokens, idx), tokens)!;
    expect(best.id).toBe('alpha');
    expect(best.confidence).toBeCloseTo(0.85, 5);
  });

  it('breaks an equal tie on rank, then shorter id, then id order, and marks it ambiguous', () => {
    const tokens = ['delta'];
    const best = pickBest(findPhraseMatches(tokens, idx), tokens)!;
    expect(best.id).toBe('delta-twin');
    expect(best.confidence).toBeCloseTo(0.85, 5);
    const plain = buildPhraseIndex([
      { id: 'bb', forms: ['same'] },
      { id: 'aaa', forms: ['same'] },
      { id: 'cc', forms: ['same'] },
    ]);
    expect(pickBest(findPhraseMatches(['same'], plain), ['same'])!.id).toBe('bb');
  });

  it('puts the longer name before rank for separate mentions: rank decides only between names of equal length', () => {
    const longVersusRank = buildPhraseIndex([
      { id: 'short-priority', forms: ['baner'], rank: 0 },
      { id: 'long-other', forms: ['kothrud'], rank: 5 },
      { id: 'same-length-other', forms: ['wakad'], rank: 3 },
    ]);
    const a = ['kothrud', 'near', 'baner'];
    expect(pickBest(findPhraseMatches(a, longVersusRank), a)).toMatchObject({
      id: 'long-other',
      confidence: 0.85, // two equal mentions: lowered, so the caller can see it was not clear
    });
    const b = ['baner', 'near', 'kothrud'];
    expect(pickBest(findPhraseMatches(b, longVersusRank), b)!.id).toBe('long-other');
    const c = ['baner', 'wakad'];
    expect(pickBest(findPhraseMatches(c, longVersusRank), c)!.id).toBe('short-priority'); // equal length: rank
  });

  it('does not call a strong match ambiguous because of a weak one elsewhere', () => {
    const tokens = ['gamma', 'delte'];
    const best = pickBest(findPhraseMatches(tokens, idx), tokens)!;
    expect(best).toMatchObject({ id: 'gamma', confidence: 1 });
  });

  describe('a one-edit match that contains a strong one', () => {
    const entries = buildPhraseIndex([
      { id: 'waterproofing', forms: ['waterproofing'] },
      { id: 'terrace-waterproofing', forms: ['terrace waterproofing'] },
      { id: 'bathroom-waterproofing', forms: ['bathroom waterproofing'] },
      { id: 'phase-1', forms: ['site phase 1'] },
      { id: 'phase-2', forms: ['site phase 2'] },
      { id: 'site', forms: ['site'] },
    ]);
    const pick = (tokens: string[]) => pickBest(findPhraseMatches(tokens, entries), tokens)!;

    it('wins over the shorter exact match when it is the only candidate: a typo inside a longer name', () => {
      expect(pick(['terace', 'waterproofing'])).toMatchObject({
        id: 'terrace-waterproofing',
        kind: 'fuzzy',
        confidence: 0.8,
        matched: 'terace waterproofing',
      });
    });

    it('does not win when several entries match it equally: an unfinished name stays on the parent', () => {
      expect(pick(['site', 'phase']).id).toBe('site');
      expect(pick(['site', 'phase', '3']).id).toBe('site'); // phase 1 and phase 2 are each one edit away
    });

    it('wins when one sibling is clearly closer', () => {
      expect(pick(['site', 'phse', '1'])).toMatchObject({ id: 'phase-1', confidence: 0.8 });
    });

    it('never beats a strong match with a two-edit match', () => {
      expect(pick(['terce', 'waterproofing']).id).toBe('waterproofing'); // 'terce' is two edits from 'terrace'
    });
  });
});
