import { describe, expect, it } from 'vitest';
import { LOCALITIES, makeLocality } from './fixtures.ts';
import { resolveLocality } from './resolve.ts';

const id = (text: string) => resolveLocality(text, LOCALITIES)?.locality_id ?? null;

describe('resolveLocality: exact names and ids', () => {
  it.each([
    ['Hinjewadi', 'hinjewadi'],
    ['wakad', 'wakad'],
    ['BANER', 'baner'],
    ['Balewadi', 'balewadi'],
    ['aundh', 'aundh'],
    ['Kothrud', 'kothrud'],
    ['Viman Nagar', 'viman-nagar'],
    ['viman-nagar', 'viman-nagar'],
    ['Kharadi', 'kharadi'],
    ['Hadapsar', 'hadapsar'],
    ['Koregaon Park', 'koregaon-park'],
    ['koregaon-park', 'koregaon-park'],
    ['Shivajinagar', 'shivajinagar'],
    ['Camp', 'camp'],
    ['Kondhwa', 'kondhwa'],
    ['Wagholi', 'wagholi'],
    ['Lohegaon', 'lohegaon'],
    ['Pimple Saudagar', 'pimple-saudagar'],
    ['pimple-saudagar', 'pimple-saudagar'],
    ['Pimple Nilakh', 'pimple-nilakh'],
    ['Pimpri', 'pimpri'],
    ['Chinchwad', 'chinchwad'],
    ['Magarpatta', 'magarpatta'],
    ['Hinjewadi Phase 1', 'hinjewadi-phase-1'],
    ['hinjewadi phase 2', 'hinjewadi-phase-2'],
    ['hinjewadi-phase-3', 'hinjewadi-phase-3'],
  ])('%j -> %s at confidence 1', (text, expected) => {
    expect(resolveLocality(text, LOCALITIES)).toMatchObject({ locality_id: expected, confidence: 1 });
  });
});

describe('resolveLocality: aliases, misspellings and Hinglish spellings', () => {
  it.each([
    ['hinjawadi', 'hinjewadi'],
    ['Hinjewdi', 'hinjewadi'],
    ['hinjavadi', 'hinjewadi'],
    ['rgip', 'hinjewadi'],
    ['hinjawadi phase 1', 'hinjewadi-phase-1'],
    ['hinjewadi phase ii', 'hinjewadi-phase-2'],
    ['hinjewadi phase three', 'hinjewadi-phase-3'],
    ['wakkad', 'wakad'],
    ['vakad', 'wakad'],
    ['KP', 'koregaon-park'],
    ['kp', 'koregaon-park'],
    ['vimannagar', 'viman-nagar'],
    ['vimaan nagar', 'viman-nagar'],
    ['pimplesaudagar', 'pimple-saudagar'],
    ['pimple soudagar', 'pimple-saudagar'],
    ['shivaji nagar', 'shivajinagar'],
    ['kondwa', 'kondhwa'],
    ['kharedi', 'kharadi'],
    ['hadpsar', 'hadapsar'],
    ['lohgaon', 'lohegaon'],
    ['chinchvad', 'chinchwad'],
    ['magarpatta city', 'magarpatta'],
    ['pune camp', 'camp'],
  ])('alias %j -> %s', (text, expected) => {
    expect(id(text)).toBe(expected);
  });

  it.each([
    ['hinjewadii', 'hinjewadi'], // one extra letter
    ['balewdi', 'balewadi'], // one missing
    ['kothrut', 'kothrud'], // one wrong
    ['wakda', 'wakad'], // two letters swapped
    ['wakar', 'wakad'], // a five-letter word may be one edit off
    ['pimpre', 'pimpri'],
    ['kondhwaa', 'kondhwa'],
    ['chinchwadd', 'chinchwad'],
    ['hadapsr', 'hadapsar'],
    ['magarpatt', 'magarpatta'],
    ['koregaonpark', 'koregaon-park'], // spacing only
    ['koregoan prak', 'koregaon-park'],
    ['pimple saudgar', 'pimple-saudagar'],
    ['chnchwd', 'chinchwad'], // two edits, same first letter
    ['hadpsr', 'hadapsar'],
    ['lohgon', 'lohegaon'],
  ])('fuzzy %j -> %s', (text, expected) => {
    expect(id(text)).toBe(expected);
  });

  it('gives lower confidence to fuzzy matches: 0.95 for spacing only, 0.8 for one edit, 0.65 for two', () => {
    expect(resolveLocality('koregaonpark', LOCALITIES)?.confidence).toBe(0.95);
    expect(resolveLocality('hinjewadii', LOCALITIES)?.confidence).toBe(0.8);
    expect(resolveLocality('chnchwd', LOCALITIES)?.confidence).toBe(0.65);
  });

  it('rejects three edits, and two edits that change the first letter', () => {
    expect(id('chnchw')).toBeNull(); // chinchwad: three letters missing
    expect(id('shnchwad')).toBeNull(); // two edits, and the first letter changed
  });
});

describe('resolveLocality: short words are never guessed at', () => {
  it.each([
    ['came'],
    ['damp'],
    ['camps'],
    ['cam'],
    ['bane'],
    ['wak'],
    ['under'],
    ['water'],
    ['rate'],
    ['cost'],
    ['paint'],
    ['samosa'],
    ['wada'],
    ['dosa'],
    ['sasta'],
    ['accha'],
    ['chahiye'],
    ['kuthe'],
    ['kiti'],
    ['bhav'],
    ['milega'],
  ])('%j -> null', (text) => {
    expect(id(text)).toBeNull();
  });
});

describe('resolveLocality: a partial name is not guessed as a neighbour', () => {
  it.each([['pimple'], ['Pimple'], ['best biryani near pimple'], ['pimple pune'], ['pimple, pune']])(
    '%j -> null (it begins "Pimple Saudagar" and "Pimple Nilakh", not "Pimpri")',
    (text) => {
      expect(id(text)).toBeNull();
    },
  );

  it.each([
    ['pimple saudagar', 'pimple-saudagar'],
    ['pimple saudgar', 'pimple-saudagar'],
    ['pimple nilakh', 'pimple-nilakh'],
    ['pimple nilkh', 'pimple-nilakh'],
    ['pimpri', 'pimpri'],
    ['pimpry', 'pimpri'],
    ['pimri', 'pimpri'],
    ['pimpri colony', 'pimpri'],
  ])('%j -> %s', (text, expected) => {
    expect(id(text)).toBe(expected);
  });

  it('keeps typos of a name that is also the first word of a longer one (wakad, wakad bridge)', () => {
    expect(id('wakda')).toBe('wakad');
    expect(id('wakad')).toBe('wakad');
    expect(id('wakad bridge')).toBe('near-wakad-bridge');
  });
});

describe('resolveLocality: free text and filler words', () => {
  it.each([
    ['near Wakad', 'wakad'],
    ['Wakad, Pune', 'wakad'],
    ['in baner', 'baner'],
    ['baner me', 'baner'],
    ['wakad ke paas', 'wakad'],
    ['hinjewadi jawal', 'hinjewadi'],
    ['hinjewadi madhe', 'hinjewadi'],
    ['koregaon park pune', 'koregaon-park'],
    ['best biryani in kharadi', 'kharadi'],
    ['biryani near wakad pune', 'wakad'],
    ['misal near hadapsar', 'hadapsar'],
    ['pizza in viman nagar pune', 'viman-nagar'],
    ['wakad area', 'wakad'],
    ['nearby hinjewadi phase 2', 'hinjewadi-phase-2'],
    ['hinjewadi phase 4', 'hinjewadi'], // no such phase: the parent is the safe answer, not phase 1, 2 or 3
    ['hinjewadi phase', 'hinjewadi'],
    ['hinjewadi phse 1', 'hinjewadi-phase-1'], // a typo inside the longer name beats the parent
    ['wakad bridgee', 'near-wakad-bridge'],
  ])('%j -> %s', (text, expected) => {
    expect(id(text)).toBe(expected);
  });

  it.each([[''], ['   '], ['near me'], ['pune'], ['in pune'], ['biryani'], ['xyz'], ['mumbai'], ['!!!']])(
    '%j has no locality',
    (text) => {
      expect(id(text)).toBeNull();
    },
  );

  it('returns the matched words, normalised', () => {
    expect(resolveLocality('Near WAKAD!', LOCALITIES)?.matched).toBe('wakad');
    expect(resolveLocality('hinjewadi phase 1 flats', LOCALITIES)?.matched).toBe('hinjewadi phase 1');
  });
});

describe('resolveLocality: landmarks', () => {
  it.each([
    ['wakad bridge', 'near-wakad-bridge'],
    ['near wakad bridge', 'near-wakad-bridge'],
    ['wakad flyover', 'near-wakad-bridge'],
    ['hinjewadi metro station', 'near-hinjewadi-metro'],
    ['hinjewadi metro', 'near-hinjewadi-metro'],
    ['near example chowk', 'near-example-chowk'],
    ['example chowk', 'near-example-chowk'],
  ])('%j -> %s (the more specific place wins over the locality it contains)', (text, expected) => {
    expect(id(text)).toBe(expected);
  });
});

describe('resolveLocality: normalisation and other scripts', () => {
  it.each([
    ['WAKAD', 'wakad'],
    ['Ｗａｋａｄ', 'wakad'],
    ['  wakad  ', 'wakad'],
    ['Wakad!!!', 'wakad'],
    ['Hinjewadī', 'hinjewadi'],
    ['Kothrūḍ', 'kothrud'],
    ['वाकड', 'wakad'],
    ['हिंजवडी', 'hinjewadi'],
    ['हिंजवाड़ी', 'hinjewadi'],
    ['बाणेर', 'baner'],
    ['कोथरूड', 'kothrud'],
    ['खराडी', 'kharadi'],
    ['वाकड, पुणे', 'wakad'],
  ])('%j -> %s', (text, expected) => {
    expect(id(text)).toBe(expected);
  });
});

describe('resolveLocality: ties and ambiguity', () => {
  const twin = (extra: string[]) => [
    ...extra.map((x) =>
      makeLocality({ id: x, name: x.toUpperCase(), geo: { lat: 1, lng: 1 }, aliases: ['twin town'] }),
    ),
  ];

  it('breaks a tie to the priority locality, then to the shorter id', () => {
    const list = [...twin(['aaa-x', 'zz']), LOCALITIES.find((l) => l.id === 'baner')!];
    const baner = list.find((l) => l.id === 'baner')!;
    const withAlias = list.map((l) => (l === baner ? { ...l, aliases: [...l.aliases, 'twin town'] } : l));
    expect(resolveLocality('twin town', withAlias)?.locality_id).toBe('baner'); // priority beats the shorter id
    expect(resolveLocality('twin town', twin(['aaa-x', 'zz']))?.locality_id).toBe('zz'); // shorter id
    expect(resolveLocality('twin town', twin(['zz', 'aaa-x']))?.locality_id).toBe('zz'); // input order is irrelevant
  });

  it('lowers the confidence by 0.15 when it had to break a tie', () => {
    expect(resolveLocality('twin town', twin(['aaa-x', 'zz']))?.confidence).toBe(0.85);
  });

  it('treats two localities named in one text as ambiguous and picks by priority', () => {
    const r = resolveLocality('wakad or baner', LOCALITIES);
    expect(r?.locality_id).toBe('wakad'); // wakad ranks above baner in the priority list
    expect(r?.confidence).toBe(0.85);
  });

  it('puts the longer name before the priority list for separate mentions, and says so with a lower confidence', () => {
    // kothrud is a priority locality and baner too, but kothrud's name is longer: the longer name is the pick in
    // either order. Priority decides only between names of equal length ("wakad or baner" above).
    for (const q of ['kothrud near baner', 'baner near kothrud']) {
      expect(resolveLocality(q, LOCALITIES)).toMatchObject({ locality_id: 'kothrud', confidence: 0.85 });
    }
    expect(resolveLocality('hinjewadi phase 1 near kothrud', LOCALITIES)?.locality_id).toBe(
      'hinjewadi-phase-1',
    );
    // Not a priority locality, but longer: still the pick.
    expect(resolveLocality('baner near magarpatta', LOCALITIES)?.locality_id).toBe('magarpatta');
  });

  it('is not ambiguous when the other mention is a weak, fuzzy one', () => {
    expect(resolveLocality('wakad hadpsr', LOCALITIES)?.confidence).toBe(1);
  });
});

describe('resolveLocality: robustness', () => {
  it('does not depend on the order of the locality list', () => {
    const reversed = [...LOCALITIES].reverse();
    for (const q of ['hinjawadi phase 1', 'kp', 'wakad or baner', 'vimaan nagar', 'came']) {
      expect(resolveLocality(q, reversed)).toEqual(resolveLocality(q, LOCALITIES));
    }
  });

  it('does not change its input', () => {
    const copy = structuredClone(LOCALITIES);
    resolveLocality('hinjawadi', LOCALITIES);
    expect(LOCALITIES).toEqual(copy);
  });

  it('returns null for an empty locality list', () => {
    expect(resolveLocality('wakad', [])).toBeNull();
  });

  it('copes with a very long text by reading only its first words', () => {
    expect(resolveLocality(`wakad ${'blah '.repeat(5000)}`, LOCALITIES)?.locality_id).toBe('wakad');
  });

  it('never claims a confidence outside 0..1', () => {
    for (const q of ['wakad', 'wakda', 'chnchwd', 'twin', 'wakad baner']) {
      const c = resolveLocality(q, LOCALITIES)?.confidence;
      if (c !== undefined) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });
});
