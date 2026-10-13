import { describe, expect, it } from 'vitest';
import { LOCALITIES, makeLocality } from './fixtures.ts';
import { subtree } from './tree.ts';

describe('subtree', () => {
  it('returns the id, then every descendant: sub-localities and landmarks, and landmarks of sub-localities', () => {
    expect(subtree('hinjewadi', LOCALITIES)).toEqual([
      'hinjewadi',
      'hinjewadi-phase-1',
      'hinjewadi-phase-2',
      'hinjewadi-phase-3',
      'near-hinjewadi-metro',
      'near-example-chowk',
    ]);
  });

  it('works from a sub-locality', () => {
    expect(subtree('hinjewadi-phase-2', LOCALITIES)).toEqual(['hinjewadi-phase-2', 'near-example-chowk']);
  });

  it('returns just the id for a leaf', () => {
    expect(subtree('baner', LOCALITIES)).toEqual(['baner']);
    expect(subtree('near-wakad-bridge', LOCALITIES)).toEqual(['near-wakad-bridge']);
  });

  it('includes the landmark of a plain locality', () => {
    expect(subtree('wakad', LOCALITIES)).toEqual(['wakad', 'near-wakad-bridge']);
  });

  it('returns [] for an id that is not in the list', () => {
    expect(subtree('nowhere', LOCALITIES)).toEqual([]);
    expect(subtree('hinjewadi', [])).toEqual([]);
  });

  it('lists each id once and survives a parent cycle in bad data', () => {
    const a = makeLocality({ id: 'cycle-a', name: 'A', geo: { lat: 1, lng: 1 }, parent_id: 'cycle-b' });
    const b = makeLocality({ id: 'cycle-b', name: 'B', geo: { lat: 1, lng: 1 }, parent_id: 'cycle-a' });
    expect(subtree('cycle-a', [a, b])).toEqual(['cycle-a', 'cycle-b']);
  });

  it('does not change its input', () => {
    const copy = structuredClone(LOCALITIES);
    subtree('hinjewadi', LOCALITIES);
    expect(LOCALITIES).toEqual(copy);
  });
});
