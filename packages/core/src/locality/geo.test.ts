import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LOCALITIES, makeLocality } from './fixtures.ts';
import { haversineM, nearest } from './geo.ts';

describe('haversineM', () => {
  it('is zero for the same point', () => {
    expect(haversineM({ lat: 18.5, lng: 73.8 }, { lat: 18.5, lng: 73.8 })).toBe(0);
  });

  it('measures one degree of latitude as about 111.2 km', () => {
    const d = haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it('shrinks a degree of longitude with latitude', () => {
    const equator = haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    const pune = haversineM({ lat: 18.5, lng: 73 }, { lat: 18.5, lng: 74 });
    expect(pune / equator).toBeCloseTo(Math.cos((18.5 * Math.PI) / 180), 2);
  });

  it('is symmetric and never negative', () => {
    const point = fc.record({
      lat: fc.double({ min: -90, max: 90, noNaN: true }),
      lng: fc.double({ min: -180, max: 180, noNaN: true }),
    });
    fc.assert(
      fc.property(point, point, (a, b) => {
        const d = haversineM(a, b);
        return d >= 0 && Math.abs(d - haversineM(b, a)) < 1e-6;
      }),
    );
  });

  it('agrees with the spherical law of cosines, an independent formula, for two fixture points', () => {
    const wakad = LOCALITIES.find((l) => l.id === 'wakad')!.geo;
    const baner = LOCALITIES.find((l) => l.id === 'baner')!.geo;
    const r = (deg: number) => (deg * Math.PI) / 180;
    const cosines =
      Math.acos(
        Math.sin(r(wakad.lat)) * Math.sin(r(baner.lat)) +
          Math.cos(r(wakad.lat)) * Math.cos(r(baner.lat)) * Math.cos(r(baner.lng - wakad.lng)),
      ) * 6_371_008.8;
    expect(haversineM(wakad, baner)).toBeCloseTo(cosines, -1); // within 5 m
    expect(cosines).toBeGreaterThan(5000); // about 5.2 km: a sanity check on the fixture values themselves
    expect(cosines).toBeLessThan(5500);
  });
});

describe('nearest', () => {
  const hinjewadi = LOCALITIES.find((l) => l.id === 'hinjewadi')!.geo;

  it('returns the n closest localities, closest first, as whole metres', () => {
    const out = nearest(hinjewadi, LOCALITIES, 3);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ locality_id: 'hinjewadi', distance_m: 0 });
    expect(out.map((o) => o.locality_id)).toEqual(['hinjewadi', 'wakad', 'balewadi']);
    for (const o of out) expect(Number.isInteger(o.distance_m)).toBe(true);
    expect(out[1]!.distance_m).toBeLessThanOrEqual(out[2]!.distance_m);
  });

  it('skips sub-localities and landmarks unless asked', () => {
    const ids = nearest(hinjewadi, LOCALITIES, 50).map((o) => o.locality_id);
    expect(ids).toHaveLength(20);
    expect(ids).not.toContain('hinjewadi-phase-1');
    expect(ids).not.toContain('near-hinjewadi-metro');
  });

  it('includes other kinds when asked', () => {
    const out = nearest(hinjewadi, LOCALITIES, 4, { kinds: ['locality', 'sub_locality', 'landmark'] });
    expect(out.map((o) => o.locality_id)).toEqual([
      'hinjewadi',
      'near-hinjewadi-metro',
      'hinjewadi-phase-1',
      'near-example-chowk',
    ]);
  });

  it('can return only landmarks', () => {
    const out = nearest(hinjewadi, LOCALITIES, 5, { kinds: ['landmark'] });
    expect(out.map((o) => o.locality_id)).toEqual([
      'near-hinjewadi-metro',
      'near-example-chowk',
      'near-wakad-bridge',
    ]);
  });

  it('returns fewer than n when there are fewer localities', () => {
    expect(nearest(hinjewadi, LOCALITIES.slice(0, 2), 5)).toHaveLength(1); // slice holds one locality and one sub-locality
  });

  it('returns [] for n of zero, a negative, NaN, or an empty list', () => {
    expect(nearest(hinjewadi, LOCALITIES, 0)).toEqual([]);
    expect(nearest(hinjewadi, LOCALITIES, -2)).toEqual([]);
    expect(nearest(hinjewadi, LOCALITIES, Number.NaN)).toEqual([]);
    expect(nearest(hinjewadi, [], 3)).toEqual([]);
  });

  it('truncates a fractional n', () => {
    expect(nearest(hinjewadi, LOCALITIES, 2.9)).toHaveLength(2);
  });

  it('breaks distance ties by id, so the order is the same whatever the input order', () => {
    const a = makeLocality({ id: 'tie-b', name: 'Tie B', geo: { lat: 18.5, lng: 73.9 } });
    const b = makeLocality({ id: 'tie-a', name: 'Tie A', geo: { lat: 18.5, lng: 73.9 } });
    const origin = { lat: 18.6, lng: 73.9 };
    expect(nearest(origin, [a, b], 2).map((o) => o.locality_id)).toEqual(['tie-a', 'tie-b']);
    expect(nearest(origin, [b, a], 2).map((o) => o.locality_id)).toEqual(['tie-a', 'tie-b']);
  });

  it('ignores a locality whose coordinates are not finite, and a non-finite origin returns []', () => {
    const bad = makeLocality({ id: 'bad', name: 'Bad', geo: { lat: Number.NaN, lng: 73 } });
    expect(nearest(hinjewadi, [bad, ...LOCALITIES], 1)[0]!.locality_id).toBe('hinjewadi');
    expect(nearest({ lat: Number.NaN, lng: 0 }, LOCALITIES, 3)).toEqual([]);
  });

  it('does not change its input', () => {
    const copy = structuredClone(LOCALITIES);
    nearest(hinjewadi, LOCALITIES, 5);
    expect(LOCALITIES).toEqual(copy);
  });
});
