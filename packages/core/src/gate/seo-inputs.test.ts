import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_INTENT,
  ageFreshness,
  clamp01,
  demandIndex,
  fill,
  meanFill,
  meanOf,
  modelFreshness,
  rowFreshness,
  seoInputs,
} from './seo-inputs.ts';
import { NOW, daysBefore, makeEvidence, uuid } from './fixtures.ts';

describe('clamp01, fill, meanFill, meanOf', () => {
  it('keeps numbers in 0-1 and turns non-finite numbers into 0', () => {
    expect([clamp01(-1), clamp01(0.4), clamp01(7), clamp01(NaN), clamp01(Infinity)]).toEqual([
      0, 0.4, 1, 0, 0,
    ]);
  });

  it('fills a share of a full value, capped at 1, with no division by zero', () => {
    expect([fill(2, 4), fill(9, 4), fill(1, 0)]).toEqual([0.5, 1, 0]);
    expect(
      meanFill([
        [2, 4],
        [9, 4],
      ]),
    ).toBe(0.75);
    expect(meanFill([])).toBe(0);
  });

  it('averages only the parts that exist', () => {
    expect(meanOf([1, null, 0.5])).toBe(0.75);
    expect(meanOf([null, null])).toBe(0);
  });
});

describe('demandIndex', () => {
  const rows = [
    { subject_id: 'biryani', locality_id: 'hinjewadi', score: 10 },
    { subject_id: 'biryani', locality_id: null, score: 4 },
    { subject_id: 'misal-pav', locality_id: 'baner', score: 5 },
  ];
  const d = demandIndex(rows);

  it('is the strongest matching row as a share of the strongest row in the snapshot', () => {
    expect(d.subjects(['biryani'], null)).toBe(1);
    expect(d.subjects(['misal-pav'], null)).toBe(0.5);
  });

  it('with a locality counts only that locality, so a city-wide row does not stand in for it', () => {
    expect(d.subjects(['biryani'], 'hinjewadi')).toBe(1);
    expect(d.subjects(['biryani'], 'wakad')).toBe(0);
  });

  it('takes the best of several subjects (a parent service and its sub-services)', () => {
    expect(d.subjects(['x', 'misal-pav'], 'baner')).toBe(0.5);
  });

  it('gives a locality its strongest subject, and is 0 everywhere without data', () => {
    expect(d.locality('baner')).toBe(0.5);
    expect(d.locality('wakad')).toBe(0);
    const none = demandIndex([]);
    expect([none.subjects(['biryani'], null), none.locality('hinjewadi')]).toEqual([0, 0]);
  });
});

describe('freshness', () => {
  it('ages dated items against a TTL: new is 1, a TTL old is 0, and the mean is taken', () => {
    expect(ageFreshness([daysBefore(NOW, 0)], 100, NOW)).toBe(1);
    expect(ageFreshness([daysBefore(NOW, 50)], 100, NOW)).toBeCloseTo(0.5, 9);
    expect(ageFreshness([daysBefore(NOW, 100), daysBefore(NOW, 400)], 100, NOW)).toBe(0);
    expect(ageFreshness([daysBefore(NOW, 0), daysBefore(NOW, 100)], 100, NOW)).toBeCloseTo(0.5, 9);
    expect(ageFreshness([], 100, NOW)).toBe(0);
    expect(ageFreshness(['not a date'], 100, NOW)).toBe(0);
  });

  it('scores an evidence row by the share of its tier TTL that is left', () => {
    const price = {
      price: { dish_id: 'biryani', service_id: null, price_inr: 200, unit: 'serving' as const },
    };
    const fresh = makeEvidence(uuid(1), price, { retrieved_at: daysBefore(NOW, 0) });
    const half = makeEvidence(uuid(1), price, { retrieved_at: daysBefore(NOW, 7) }); // HOT: 14 days
    expect(rowFreshness([fresh], NOW)).toBe(1);
    expect(rowFreshness([half], NOW)).toBeCloseTo(0.5, 9);
    expect(rowFreshness([fresh, half], NOW)).toBeCloseTo(0.75, 9);
    expect(rowFreshness([], NOW)).toBe(0);
  });

  it('scores a cost model by the share of the COST TTL (180 days) until it expires', () => {
    const in90 = new Date(NOW.getTime() + 90 * 86_400_000).toISOString().slice(0, 10);
    expect(modelFreshness([in90], NOW)).toBeCloseTo(0.5, 1);
    expect(modelFreshness(['2020-01-01'], NOW)).toBe(0);
    expect(modelFreshness([], NOW)).toBe(0);
  });
});

describe('seoInputs', () => {
  const base = {
    key: 'construction:locality_service',
    demand: 0.8,
    data_quality: 0.5,
    local: true,
    freshness: 0.25,
    text: 'one two three',
  } as const;

  it('carries the parts, flags locality pages, and reads the commercial intent from the page type', () => {
    expect(seoInputs(base)).toEqual({
      demand: 0.8,
      data_quality: 0.5,
      locality_specificity: 1,
      commercial_intent: COMMERCIAL_INTENT['construction:locality_service'],
      content_depth: 3 / 150,
      freshness: 0.25,
    });
    expect(seoInputs({ ...base, local: false }).locality_specificity).toBe(0);
  });

  it('keeps every input in 0-1 and gives a page type without a table entry 0 commercial intent', () => {
    const wild = seoInputs({
      ...base,
      key: 'main:home',
      demand: 9,
      data_quality: -2,
      freshness: NaN,
      text: 'x '.repeat(5000),
    });
    expect(wild).toMatchObject({
      demand: 1,
      data_quality: 0,
      freshness: 0,
      commercial_intent: 0,
      content_depth: 1,
    });
  });
});
