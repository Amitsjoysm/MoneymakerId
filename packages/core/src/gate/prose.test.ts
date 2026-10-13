import { describe, expect, it } from 'vitest';
import { exampleSnapshot, makeDish, makeFact, makeModel, makeService } from './fixtures.ts';
import { proseReviewed } from './prose.ts';

describe('proseReviewed (CONTRACTS §8, prose review rule)', () => {
  const snapshot = exampleSnapshot();
  const reviewed = proseReviewed(snapshot);

  it('maps service:{id} to ServiceDef.prose_status, including sub-services', () => {
    expect(reviewed('service:waterproofing')).toBe(true);
    expect(reviewed('service:terrace-waterproofing')).toBe(true);
    expect(reviewed('service:painting')).toBe(false);
  });

  it('maps cost_model:{id} to CostModel.status', () => {
    expect(reviewed('cost_model:tw-standard')).toBe(true);
    expect(reviewed('cost_model:painting-standard')).toBe(false);
  });

  it('maps dish:{id} to Dish.prose_status', () => {
    expect(reviewed('dish:biryani')).toBe(true);
    expect(reviewed('dish:misal-pav')).toBe(false);
  });

  it('maps locality:{id}:guide to the guide status', () => {
    expect(reviewed('locality:hinjewadi:guide')).toBe(true);
    expect(reviewed('locality:baner:guide')).toBe(false);
    expect(reviewed('locality:phase-9:guide')).toBe(false);
  });

  it('maps locality:{id}:facts to all of the locality facts: construction facts and food notes', () => {
    expect(reviewed('locality:hinjewadi:facts')).toBe(true);
    expect(reviewed('locality:wakad:facts')).toBe(false); // its one fact is a draft
    const mixed = exampleSnapshot();
    mixed.localities[0]!.food_notes = [
      makeFact('hinjewadi-other-9', ['painting'], 'Example food note.', 'draft'),
    ];
    expect(proseReviewed(mixed)('locality:hinjewadi:facts')).toBe(false);
  });

  it('does not treat a locality with no facts as reviewed (nothing to vouch for)', () => {
    expect(reviewed('locality:baner:facts')).toBe(false);
  });

  it('counts a key as reviewed when prose_reviews says so, even if the source record is still a draft', () => {
    const s = exampleSnapshot();
    s.prose_reviews = [
      { key: 'service:painting', status: 'reviewed' },
      { key: 'i18n:mr:/mr/pune/hinjewadi/', status: 'reviewed' },
      { key: 'dish:misal-pav', status: 'draft' },
    ];
    const r = proseReviewed(s);
    expect(r('service:painting')).toBe(true);
    expect(r('i18n:mr:/mr/pune/hinjewadi/')).toBe(true);
    expect(r('dish:misal-pav')).toBe(false);
  });

  it('keeps a reviewed source record reviewed when prose_reviews holds a draft row for it', () => {
    const s = exampleSnapshot();
    s.prose_reviews = [{ key: 'service:waterproofing', status: 'draft' }];
    expect(proseReviewed(s)('service:waterproofing')).toBe(true);
  });

  it('fails closed for unknown keys, unknown ids and unknown prefixes', () => {
    for (const key of [
      '',
      'service:nope',
      'cost_model:nope',
      'dish:nope',
      'banana:1',
      'i18n:hi:/hi/',
      'locality:hinjewadi',
    ]) {
      expect(reviewed(key), key).toBe(false);
    }
  });

  it('finds services nested at any depth', () => {
    const s = exampleSnapshot();
    s.services = [
      makeService('a', null, {}, [
        makeService('b', 'a', {}, [makeService('c', 'b', { prose_status: 'reviewed' })]),
      ]),
    ];
    s.services[0]!.prose_status = 'draft';
    s.cost_models = [makeModel('m', 'c', { status: 'draft' })];
    s.dishes = [makeDish('d')];
    const r = proseReviewed(s);
    expect(r('service:c')).toBe(true);
    expect(r('service:a')).toBe(false);
  });
});
