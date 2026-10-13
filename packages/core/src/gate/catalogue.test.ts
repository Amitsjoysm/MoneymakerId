import { describe, expect, it } from 'vitest';
import { buildCatalogue, isLive } from './catalogue.ts';
import {
  NOW,
  daysBefore,
  exampleSnapshot,
  makeEvidence,
  makeLocality,
  makeService,
  uuid,
} from './fixtures.ts';

const price = { price: { dish_id: 'biryani', service_id: null, price_inr: 200, unit: 'serving' as const } };

describe('isLive', () => {
  it('expires a row after the TTL of its claim tier (HOT 14 days, COLD 365)', () => {
    expect(isLive(makeEvidence(uuid(1), price, { retrieved_at: daysBefore(NOW, 13) }), NOW)).toBe(true);
    expect(isLive(makeEvidence(uuid(1), price, { retrieved_at: daysBefore(NOW, 15) }), NOW)).toBe(false);
    const address = makeEvidence(
      uuid(1),
      { address: 'Example Road 1' },
      { retrieved_at: daysBefore(NOW, 300) },
    );
    expect(isLive(address, NOW)).toBe(true);
  });

  it('lets valid_until override the tier TTL, in either direction', () => {
    const old = daysBefore(NOW, 30);
    expect(
      isLive(makeEvidence(uuid(1), price, { retrieved_at: old, valid_until: daysBefore(NOW, -1) }), NOW),
    ).toBe(true);
    expect(
      isLive(
        makeEvidence(uuid(1), price, { retrieved_at: daysBefore(NOW, 1), valid_until: daysBefore(NOW, 1) }),
        NOW,
      ),
    ).toBe(false);
  });

  it('never counts a superseded or rejected row, or one from an aggregator', () => {
    expect(isLive(makeEvidence(uuid(1), price, { status: 'superseded' }), NOW)).toBe(false);
    expect(isLive(makeEvidence(uuid(1), price, { status: 'rejected' }), NOW)).toBe(false);
    const aggregator = makeEvidence(uuid(1), price, {
      source: {
        kind: 'aggregator',
        url: 'https://example.com/agg',
        title: null,
        publisher: 'Example Agg',
        experience_id: null,
      },
    });
    expect(isLive(aggregator, NOW)).toBe(false);
  });

  it('treats an unreadable date as not live', () => {
    expect(isLive(makeEvidence(uuid(1), price, { retrieved_at: 'not a date' }), NOW)).toBe(false);
  });
});

describe('buildCatalogue', () => {
  it('lists every service with the ids of its whole subtree, parents first or last alike', () => {
    const s = exampleSnapshot();
    s.services = [
      makeService('a', null, {}, [
        makeService('a2', 'a', {}, [makeService('a3', 'a2')]),
        makeService('a1', 'a'),
      ]),
    ];
    const cat = buildCatalogue(s, NOW);
    expect(cat.services.map((n) => [n.def.id, n.ids])).toEqual([
      ['a', ['a', 'a1', 'a2', 'a3']],
      ['a1', ['a1']],
      ['a2', ['a2', 'a3']],
      ['a3', ['a3']],
    ]);
  });

  it('gives the lineage of a locality, nearest first, and an empty one for an unknown id', () => {
    const s = exampleSnapshot();
    s.localities.push(
      makeLocality('near-example-park', { kind: 'landmark', parent_id: 'hinjewadi-phase-1' }),
    );
    const cat = buildCatalogue(s, NOW);
    expect(cat.lineage('near-example-park')).toEqual(['near-example-park', 'hinjewadi-phase-1', 'hinjewadi']);
    expect(cat.lineage('hinjewadi')).toEqual(['hinjewadi']);
    expect(cat.lineage('nowhere')).toEqual([]);
  });

  it('survives a parent cycle', () => {
    const s = exampleSnapshot();
    s.localities = [makeLocality('x', { parent_id: 'y' }), makeLocality('y', { parent_id: 'x' })];
    expect(buildCatalogue(s, NOW).lineage('x')).toEqual(['x', 'y']);
  });

  it('groups only live evidence by entity, in id order', () => {
    const s = exampleSnapshot();
    const cat = buildCatalogue(s, NOW);
    const rows = cat.live.get(uuid(4)) ?? [];
    expect(rows.length).toBe(3); // price, dish and hours
    expect(rows.map((r) => r.id)).toEqual([...rows.map((r) => r.id)].sort());
  });
});
