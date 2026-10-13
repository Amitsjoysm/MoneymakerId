import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { loadExperiments } from '../config/index.ts';
import type { Experiment } from '../schema/index.ts';
import { assignVariant, bucket, fnv1a32 } from './bucket.ts';

const variants = (...weights: number[]) => weights.map((weight, i) => ({ id: `v${i}`, weight, params: {} }));

// Deterministic, realistic tab ids: UUID-shaped, from a seeded generator (no Math.random, so runs are stable).
const tabIds = (n: number, seed = 20261013): string[] => {
  let s = seed >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0; // an LCG: fine for test data
    return s;
  };
  const hex = (len: number) =>
    Array.from({ length: len }, () => (next() >>> 24).toString(16).padStart(2, '0')).join('');
  return Array.from({ length: n }, () => `${hex(4)}-${hex(2)}-4${hex(2).slice(1)}-${hex(2)}-${hex(6)}`);
};
const sequentialIds = (n: number) => Array.from({ length: n }, (_, i) => `tab-${i}`);

const shares = (ids: string[], vs: ReturnType<typeof variants>, experimentId = 'exp') => {
  const counts = new Map<string, number>(vs.map((v) => [v.id, 0]));
  for (const id of ids)
    counts.set(bucket(experimentId, id, vs).id, (counts.get(bucket(experimentId, id, vs).id) ?? 0) + 1);
  return vs.map((v) => (counts.get(v.id) ?? 0) / ids.length);
};

describe('fnv1a32: FNV-1a, 32 bit, over the UTF-8 bytes', () => {
  it('matches the published test vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('returns an unsigned 32-bit integer', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const h = fnv1a32(s);
        return Number.isInteger(h) && h >= 0 && h <= 0xffffffff;
      }),
    );
  });

  it('hashes non-ASCII text by its UTF-8 bytes, like a byte-wise reference', () => {
    const reference = (s: string) => {
      let h = 0x811c9dc5n;
      for (const b of Buffer.from(s, 'utf8')) h = ((h ^ BigInt(b)) * 0x01000193n) & 0xffffffffn;
      return Number(h);
    };
    fc.assert(fc.property(fc.string({ unit: 'binary' }), (s) => fnv1a32(s) === reference(s)));
    expect(fnv1a32('पुणे')).toBe(reference('पुणे'));
  });
});

describe('bucket: deterministic', () => {
  it('gives the same variant for the same experiment and tab, every time', () => {
    const vs = variants(1, 1);
    for (const id of tabIds(200)) {
      const first = bucket('exp', id, vs);
      for (let i = 0; i < 3; i++) expect(bucket('exp', id, vs)).toBe(first);
    }
  });

  // These pin the algorithm (FNV-1a 32 bit over "experimentId:tabId", one murmur3 finalizer round, cumulative weights
  // over [0, 1)). The expected values come from an independent reference (Python integers), not from this code. If
  // one fails, assignments changed for every visitor of a running experiment: that needs a deliberate decision.
  it('is stable across runs and releases: pinned assignments', () => {
    expect(fnv1a32('construction-lead-page-ads:tab-1')).toBe(0xd6d89f2f);
    expect(fnv1a32('construction-lead-page-ads:0b1c2d3e-aaaa-4bbb-8ccc-123456789abc')).toBe(0xfcdfd0ac);

    const twoArms = [
      { id: 'control', weight: 0.5, params: {} },
      { id: 'ads', weight: 0.5, params: {} },
    ];
    const ads = (tab: string) => bucket('construction-lead-page-ads', tab, twoArms).id;
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => ads(`tab-${i}`))).toEqual([
      'control',
      'ads',
      'control',
      'control',
      'control',
      'control',
      'ads',
      'control',
    ]);
    expect(ads('0b1c2d3e-aaaa-4bbb-8ccc-123456789abc')).toBe('control');

    const threeArms = variants(0.1, 0.3, 0.6);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => bucket('alpha', `tab-${i}`, threeArms).id)).toEqual([
      'v2',
      'v1',
      'v0',
      'v1',
      'v1',
      'v2',
      'v1',
      'v1',
    ]);
  });

  it('hashes "experimentId:tabId", so the two parts are not interchangeable', () => {
    const vs = variants(1, 1);
    const ids = tabIds(300);
    const swapped = ids.filter((id) => bucket('alpha', id, vs).id !== bucket('beta', id, vs).id);
    // Independent experiments split the same tabs differently: about half of the tabs must differ.
    expect(swapped.length).toBeGreaterThan(90);
    expect(swapped.length).toBeLessThan(210);
  });

  it('returns the very variant object from the list it was given', () => {
    const vs = variants(1, 1, 1);
    expect(vs).toContain(bucket('exp', 'tab-1', vs));
  });
});

describe('bucket: respects the weights (10,000 tab ids)', () => {
  const N = 10_000;
  const TOLERANCE = 0.02; // 2 percentage points: four standard deviations for a fair split of 10,000

  it.each([
    ['50/50', [0.5, 0.5]],
    ['80/20', [0.8, 0.2]],
    ['10/30/60', [0.1, 0.3, 0.6]],
    ['weights that do not sum to 1 (1 and 3 act as 25/75)', [1, 3]],
    ['four equal variants', [1, 1, 1, 1]],
  ])('UUID-shaped ids: %s', (_name, weights) => {
    const vs = variants(...weights);
    const total = weights.reduce((a, b) => a + b, 0);
    const actual = shares(tabIds(N), vs);
    weights.forEach((w, i) => expect(Math.abs(actual[i]! - w / total)).toBeLessThan(TOLERANCE));
  });

  it.each([
    ['50/50', [0.5, 0.5]],
    ['10/30/60', [0.1, 0.3, 0.6]],
  ])('sequential ids (tab-0, tab-1, ...): %s', (_name, weights) => {
    const vs = variants(...weights);
    const actual = shares(sequentialIds(N), vs);
    weights.forEach((w, i) => expect(Math.abs(actual[i]! - w)).toBeLessThan(TOLERANCE));
  });

  it('a variant with weight 0 is never chosen, even as the first one', () => {
    const vs = variants(0, 1, 1);
    for (const id of tabIds(2000)) expect(bucket('exp', id, vs).id).not.toBe('v0');
  });

  it('a single variant always wins', () => {
    const vs = variants(1);
    for (const id of tabIds(50)) expect(bucket('exp', id, vs).id).toBe('v0');
  });

  it('treats negative, NaN and infinite weights as 0, and falls back to the control if none is usable', () => {
    expect(bucket('exp', 'tab-1', variants(-1, Number.NaN, Number.POSITIVE_INFINITY)).id).toBe('v0');
    expect(bucket('exp', 'tab-1', variants(0, 0)).id).toBe('v0');
    const mixed = variants(Number.NaN, 1);
    for (const id of tabIds(100)) expect(bucket('exp', id, mixed).id).toBe('v1');
  });

  it('throws a RangeError for an experiment with no variants', () => {
    expect(() => bucket('exp', 'tab-1', [])).toThrow(RangeError);
  });
});

describe('assignVariant: only active experiments on their own host and page types are split', () => {
  const experiment: Experiment = {
    id: 'example-experiment',
    host: 'construction',
    page_types: ['service_cost', 'locality_service'],
    variants: [
      { id: 'control', weight: 0.5, params: { adsense: false } },
      { id: 'treatment', weight: 0.5, params: { adsense: true } },
    ],
    guardrail_metric: 'quote_submit',
    active: true,
  };
  const ctx = (
    tabId: string,
    host: Experiment['host'] = 'construction',
    pageType: Experiment['page_types'][number] = 'service_cost',
  ) => ({
    tabId,
    host,
    pageType,
  });
  // A tab the active experiment puts in the treatment, so a "control" answer below can only come from the guards.
  const treatedTab = tabIds(200).find(
    (t) => bucket(experiment.id, t, experiment.variants).id === 'treatment',
  )!;

  it('splits an active experiment on a matching host and page type exactly as bucket does', () => {
    expect(treatedTab).toBeDefined();
    for (const id of tabIds(300)) {
      expect(assignVariant(experiment, ctx(id))).toBe(bucket(experiment.id, id, experiment.variants));
    }
    expect(assignVariant(experiment, ctx(treatedTab)).id).toBe('treatment');
    expect(assignVariant(experiment, ctx(treatedTab, 'construction', 'locality_service')).id).toBe(
      'treatment',
    );
  });

  it('returns the control (first) variant when the experiment is inactive', () => {
    expect(assignVariant({ ...experiment, active: false }, ctx(treatedTab))).toBe(experiment.variants[0]);
  });

  it('returns the control when the host does not match', () => {
    for (const host of ['main', 'food', 'admin'] as const) {
      expect(assignVariant(experiment, ctx(treatedTab, host))).toBe(experiment.variants[0]);
    }
  });

  it('returns the control when the page type does not match', () => {
    for (const pageType of ['calculator', 'get_quotes', 'thank_you', 'home'] as const) {
      expect(assignVariant(experiment, ctx(treatedTab, 'construction', pageType))).toBe(
        experiment.variants[0],
      );
    }
  });

  it('an experiment with no page types matches nothing, so everyone gets the control', () => {
    expect(assignVariant({ ...experiment, page_types: [] }, ctx(treatedTab))).toBe(experiment.variants[0]);
  });

  it('control means the first variant, not the heaviest', () => {
    const skewed: Experiment = {
      ...experiment,
      variants: [
        { id: 'control', weight: 0.1, params: {} },
        { id: 'big', weight: 0.9, params: {} },
      ],
      active: false,
    };
    expect(assignVariant(skewed, ctx('tab-1')).id).toBe('control');
  });

  it('over 10,000 tabs an active 50/50 experiment lands close to half in each arm', () => {
    let treatment = 0;
    for (const id of tabIds(10_000))
      if (assignVariant(experiment, ctx(id)).id === 'treatment') treatment += 1;
    expect(Math.abs(treatment / 10_000 - 0.5)).toBeLessThan(0.02);
  });
});

describe('assignVariant against the real data/experiments.json', () => {
  const EXPERIMENTS = loadExperiments();
  const ads = EXPERIMENTS.find((e) => e.id === 'construction-lead-page-ads');

  it('has the construction lead-page ads experiment', () => {
    expect(ads).toBeDefined();
    expect(ads!.variants[0]!.id).toBe('control');
  });

  it('while it is inactive, every tab gets the control', () => {
    const experiment = { ...ads!, active: false };
    for (const id of tabIds(500)) {
      expect(
        assignVariant(experiment, { tabId: id, host: 'construction', pageType: 'service_cost' }).id,
      ).toBe('control');
    }
  });

  it('switched on, it splits service_cost and locality_service pages about 50/50, and nothing else', () => {
    const experiment = { ...ads!, active: true };
    const arms = { control: 0, ads: 0 };
    for (const id of tabIds(10_000)) {
      arms[
        assignVariant(experiment, { tabId: id, host: 'construction', pageType: 'service_cost' }).id as
          'control' | 'ads'
      ] += 1;
    }
    expect(Math.abs(arms.ads / 10_000 - 0.5)).toBeLessThan(0.02);
    for (const pageType of ['get_quotes', 'thank_you', 'calculator'] as const) {
      for (const id of tabIds(200)) {
        expect(assignVariant(experiment, { tabId: id, host: 'construction', pageType }).id).toBe('control');
      }
    }
  });
});
