import { describe, expect, it } from 'vitest';
import { NOW, daysBefore, makeCandidate, makeConfig, makeEntry, seoAll } from './fixtures.ts';
import { assessCandidate, decide, evaluateGate, gateKeyOf, seoScore } from './rules.ts';

const allReviewed = () => true;
const noneReviewed = () => false;
const CFG = makeConfig();

describe('gateKeyOf', () => {
  it('joins host and page type, so the same page type on two hosts is two keys', () => {
    expect(gateKeyOf(makeCandidate({ host: 'food', page_type: 'locality_hub' }))).toBe('food:locality_hub');
    expect(gateKeyOf(makeCandidate({ host: 'construction', page_type: 'locality_hub' }))).toBe(
      'construction:locality_hub',
    );
  });
});

describe('seoScore (spec §57 weights)', () => {
  it('weights each input', () => {
    expect(seoScore({ ...seoAll(0), demand: 1 })).toBe(0.2);
    expect(seoScore({ ...seoAll(0), data_quality: 1 })).toBe(0.25);
    expect(seoScore({ ...seoAll(0), locality_specificity: 1 })).toBe(0.2);
    expect(seoScore({ ...seoAll(0), commercial_intent: 1 })).toBe(0.15);
    expect(seoScore({ ...seoAll(0), content_depth: 1 })).toBe(0.1);
    expect(seoScore({ ...seoAll(0), freshness: 1 })).toBe(0.1);
  });

  it('is 1 when every input is 1 and 0 when every input is 0, without floating-point dust', () => {
    expect(seoScore(seoAll(1))).toBe(1);
    expect(seoScore(seoAll(0))).toBe(0);
    expect(seoScore(seoAll(0.5))).toBe(0.5);
    expect(seoScore(seoAll(0.3))).toBe(0.3);
  });
});

describe('evaluateGate: the thresholds', () => {
  it('passes a page that meets every threshold', () => {
    const c = makeCandidate();
    const d = evaluateGate(c, [], null, CFG, allReviewed, NOW);
    expect(d.action).toBe('build_index');
    expect(d.noindex_since).toBeNull();
    expect(d.result).toEqual({
      gate_key: 'food:dish_locality',
      scores: { evidence: 8, entities: 4, relevance: 1, unique: 1, seo: 0.8 },
      passed: true,
      reasons: [],
    });
  });

  it('accepts a page exactly on every threshold', () => {
    const c = makeCandidate({ entity_count: 3, evidence_count: 6, relevance: 0.6, seo_inputs: seoAll(0.5) });
    expect(evaluateGate(c, [makeCandidate()], null, CFG, allReviewed, NOW).result.passed).toBe(true);
  });

  it.each([
    ['entities', { entity_count: 2 }, /entities 2 is below min_entities 3/],
    ['evidence', { evidence_count: 5 }, /evidence 5 is below min_evidence 6/],
    ['relevance', { relevance: 0.59 }, /relevance 0.59 is below min_relevance 0.6/],
    ['seo', { seo_inputs: seoAll(0.4) }, /seo 0.4 is below seo_min 0.5/],
  ])('fails, and says why, when %s is under its threshold', (_name, over, reason) => {
    const d = evaluateGate(makeCandidate(over), [], null, CFG, allReviewed, NOW);
    expect(d.result.passed).toBe(false);
    expect(d.result.reasons).toHaveLength(1);
    expect(d.result.reasons[0]).toMatch(reason);
    expect(d.action).toBe('skip');
  });

  it('fails a page whose text is too close to a sibling, and reports the uniqueness score', () => {
    const c = makeCandidate({ main_text: 'one two three four five six seven eight nine ten' });
    const twin = makeCandidate({ main_text: 'one two three four five six seven eight nine eleven' });
    const d = evaluateGate(c, [twin], null, CFG, allReviewed, NOW);
    // 6 shingles each, 5 shared: similarity 5/7, unique 2/7.
    expect(d.result.scores.unique).toBeCloseTo(2 / 7, 6);
    expect(d.result.passed).toBe(false);
    expect(d.result.reasons.join()).toMatch(/unique 0\.285714 is below min_unique 0\.5/);
  });

  it('lists every failing threshold', () => {
    const c = makeCandidate({ entity_count: 0, evidence_count: 0, relevance: 0, seo_inputs: seoAll(0) });
    expect(evaluateGate(c, [], null, CFG, allReviewed, NOW).result.reasons).toHaveLength(4);
  });

  it('ignores siblings of another template and the page itself', () => {
    const c = makeCandidate();
    const otherTemplate = makeCandidate({ page_type: 'locality_hub', main_text: c.main_text });
    const otherHost = makeCandidate({ host: 'construction', main_text: c.main_text });
    const d = evaluateGate(c, [c, otherTemplate, otherHost], null, CFG, allReviewed, NOW);
    expect(d.result.scores.unique).toBe(1);
  });

  it('rounds the stored scores to six decimals', () => {
    const c = makeCandidate({ main_text: 'a b c d e f g h' });
    const sibling = makeCandidate({ main_text: 'a b c d e f g x' });
    const unique = evaluateGate(c, [sibling], null, CFG, allReviewed, NOW).result.scores.unique;
    expect(unique).toBe(Math.round(unique * 1e6) / 1e6);
  });
});

describe('evaluateGate: page-specific extras', () => {
  it('requires every min_X extra to be met by the candidate extra X (dish_city localities)', () => {
    const base = { page_type: 'dish_city' as const, entity_count: 6, evidence_count: 6 };
    const one = evaluateGate(
      makeCandidate({ ...base, extra: { localities: 1 } }),
      [],
      null,
      CFG,
      allReviewed,
      NOW,
    );
    expect(one.result.passed).toBe(false);
    expect(one.result.reasons.join()).toMatch(/localities 1 is below min_localities 2/);
    const two = evaluateGate(
      makeCandidate({ ...base, extra: { localities: 2 } }),
      [],
      null,
      CFG,
      allReviewed,
      NOW,
    );
    expect(two.result.passed).toBe(true);
  });

  it('counts a missing extra as 0', () => {
    const c = makeCandidate({ page_type: 'dish_city', entity_count: 6, evidence_count: 6, extra: {} });
    expect(evaluateGate(c, [], null, CFG, allReviewed, NOW).result.reasons.join()).toMatch(
      /localities 0 is below/,
    );
  });

  describe('locality_service: local substance needs at least one of facts, providers, quotes, factor sources', () => {
    const base = {
      host: 'construction' as const,
      page_type: 'locality_service' as const,
      entity_count: 0,
      evidence_count: 0,
    };
    const run = (extra: Record<string, number>) =>
      evaluateGate(makeCandidate({ ...base, extra }), [], null, CFG, allReviewed, NOW).result;

    it('fails with no substance at all, naming the four ways to qualify', () => {
      const r = run({});
      expect(r.passed).toBe(false);
      expect(r.reasons.join()).toMatch(/local substance/);
      for (const name of ['local_facts', 'providers', 'quotes', 'factor_sources'])
        expect(r.reasons.join()).toContain(name);
    });

    it.each([[{ local_facts: 3 }], [{ providers: 2 }], [{ quotes: 3 }], [{ factor_sources: 2 }]])(
      'passes on any one of them: %j',
      (extra) => {
        expect(run(extra).passed).toBe(true);
      },
    );

    it('does not pass on near misses added together', () => {
      expect(run({ local_facts: 2, providers: 1, quotes: 2, factor_sources: 1 }).passed).toBe(false);
    });
  });
});

describe('evaluateGate: the prose rule', () => {
  const service = (over = {}) =>
    makeCandidate({
      host: 'construction',
      page_type: 'service_cost',
      entity_count: 0,
      evidence_count: 0,
      extra: { sources: 2 },
      prose_keys: ['service:terrace-waterproofing', 'cost_model:tw-standard'],
      ...over,
    });

  it('passes when every prose key is reviewed', () => {
    expect(evaluateGate(service(), [], null, CFG, allReviewed, NOW).result.passed).toBe(true);
  });

  it('fails when a key is not reviewed and names the keys', () => {
    const reviewed = (k: string) => k === 'service:terrace-waterproofing';
    const d = evaluateGate(service(), [], null, CFG, reviewed, NOW);
    expect(d.result.passed).toBe(false);
    expect(d.result.reasons).toEqual(['prose not reviewed: cost_model:tw-standard']);
    expect(d.action).toBe('skip');
  });

  it('does not ask for review on a page type that does not require it', () => {
    expect(
      evaluateGate(makeCandidate({ prose_keys: ['dish:biryani'] }), [], null, CFG, noneReviewed, NOW).result
        .passed,
    ).toBe(true);
  });

  it('passes a page that needs reviewed prose but carries no prose keys (nothing to review)', () => {
    expect(evaluateGate(service({ prose_keys: [] }), [], null, CFG, noneReviewed, NOW).result.passed).toBe(
      true,
    );
  });
});

describe('evaluateGate: page types with no rule are not gated', () => {
  it('builds and indexes them, with their scores recorded and no reasons', () => {
    const c = makeCandidate({
      host: 'construction',
      page_type: 'service_city',
      entity_count: 1,
      evidence_count: 0,
    });
    const d = evaluateGate(c, [], null, CFG, noneReviewed, NOW);
    expect(d.action).toBe('build_index');
    expect(d.result.passed).toBe(true);
    expect(d.result.reasons).toEqual([]);
    expect(d.result.gate_key).toBe('construction:service_city');
    expect(d.result.scores.entities).toBe(1);
  });
});

describe('evaluateGate: hysteresis (PLAN §5)', () => {
  const live = (url: string) => makeEntry({ url, indexable: true });
  const noindex = (url: string, since: string) =>
    makeEntry({
      url,
      indexable: false,
      noindex_since: since,
      gate: { ...makeEntry({ url }).gate, passed: false },
    });
  // evidence threshold 6: 80% is 4.8, so 5 is inside the band and 4 is below it.
  const inBand = () => makeCandidate({ evidence_count: 5 });
  const belowBand = () => makeCandidate({ evidence_count: 4 });

  it('keeps an indexed page indexed while every score is at least 80% of its threshold', () => {
    const c = inBand();
    const d = evaluateGate(c, [], live(c.url), CFG, allReviewed, NOW);
    expect(d.action).toBe('build_index');
    expect(d.noindex_since).toBeNull();
    expect(d.result.passed).toBe(false);
    expect(d.result.reasons[0]).toMatch(/evidence 5 is below min_evidence 6/);
    expect(d.result.reasons.at(-1)).toMatch(/kept indexed by hysteresis/);
  });

  it('never indexes a new page that is only inside the band', () => {
    expect(evaluateGate(inBand(), [], null, CFG, allReviewed, NOW).action).toBe('skip');
  });

  it('moves an indexed page that falls below 80% to build_noindex and starts the clock', () => {
    const c = belowBand();
    const d = evaluateGate(c, [], live(c.url), CFG, allReviewed, NOW);
    expect(d.action).toBe('build_noindex');
    expect(d.noindex_since).toBe(NOW.toISOString());
  });

  it('applies the same 80% to relevance and seo, and to entities (which are whole numbers)', () => {
    const stays = [{ relevance: 0.48 }, { seo_inputs: seoAll(0.4) }];
    for (const over of stays) {
      const page = makeCandidate(over);
      expect(evaluateGate(page, [], live(page.url), CFG, allReviewed, NOW).action, JSON.stringify(over)).toBe(
        'build_index',
      );
    }
    const falls = [{ entity_count: 2 }, { relevance: 0.47 }, { seo_inputs: seoAll(0.39) }];
    for (const over of falls) {
      const page = makeCandidate(over);
      expect(evaluateGate(page, [], live(page.url), CFG, allReviewed, NOW).action, JSON.stringify(over)).toBe(
        'build_noindex',
      );
    }
  });

  it('applies the same 80% to uniqueness: 0.4286 stays, 0.375 falls', () => {
    const page = makeCandidate({ main_text: 'one two three four five six seven eight nine ten' });
    const inBandTwin = makeCandidate({ main_text: 'one two three four five six seven eight x' });
    const belowBandTwin = makeCandidate({
      main_text: 'one two three four five six seven eight nine eleven twelve',
    });
    const prev = live(page.url);
    const stays = evaluateGate(page, [inBandTwin], prev, CFG, allReviewed, NOW);
    expect(stays.result.scores.unique).toBeCloseTo(3 / 7, 6);
    expect(stays.action).toBe('build_index');
    const falls = evaluateGate(page, [belowBandTwin], prev, CFG, allReviewed, NOW);
    expect(falls.result.scores.unique).toBeCloseTo(3 / 8, 6);
    expect(falls.action).toBe('build_noindex');
    expect(evaluateGate(page, [inBandTwin], null, CFG, allReviewed, NOW).action).toBe('skip');
  });

  it('does not relax the prose rule: unreviewed prose takes a live page out of the index', () => {
    const c = makeCandidate({
      host: 'construction',
      page_type: 'service_cost',
      entity_count: 0,
      evidence_count: 0,
      extra: { sources: 2 },
      prose_keys: ['service:x'],
    });
    const prev = makeEntry({ url: c.url, host: 'construction', page_type: 'service_cost' });
    const d = evaluateGate(c, [], prev, CFG, noneReviewed, NOW);
    expect(d.action).toBe('build_noindex');
  });

  it('keeps a noindex page in noindex, with its original date, for 29 days, then redirects at 30', () => {
    const c = belowBand();
    const since = daysBefore(NOW, 29);
    const early = evaluateGate(c, [], noindex(c.url, since), CFG, allReviewed, NOW);
    expect(early.action).toBe('build_noindex');
    expect(early.noindex_since).toBe(since);

    const due = evaluateGate(c, [], noindex(c.url, daysBefore(NOW, 30)), CFG, allReviewed, NOW);
    expect(due.action).toBe('redirect_parent');
    expect(due.noindex_since).toBe(daysBefore(NOW, 30));
  });

  it('is a skip, not a redirect, when the page has no parent', () => {
    const c = makeCandidate({ evidence_count: 4, parent_url: null });
    const d = evaluateGate(c, [], noindex(c.url, daysBefore(NOW, 45)), CFG, allReviewed, NOW);
    expect(d.action).toBe('skip');
    expect(d.noindex_since).toBeNull();
  });

  it('keeps redirecting a page that was already redirected and still fails', () => {
    const c = belowBand();
    const prev = makeEntry({
      url: c.url,
      indexable: false,
      noindex_since: daysBefore(NOW, 40),
      redirect_to: c.parent_url,
    });
    const d = evaluateGate(c, [], prev, CFG, allReviewed, NOW);
    expect(d.action).toBe('redirect_parent');
    expect(d.noindex_since).toBe(daysBefore(NOW, 40));
  });

  it('re-indexes a noindex or redirected page that passes the full thresholds again', () => {
    const c = makeCandidate();
    for (const prev of [
      noindex(c.url, daysBefore(NOW, 3)),
      makeEntry({
        url: c.url,
        indexable: false,
        noindex_since: daysBefore(NOW, 90),
        redirect_to: c.parent_url,
      }),
    ]) {
      const d = evaluateGate(c, [], prev, CFG, allReviewed, NOW);
      expect(d.action).toBe('build_index');
      expect(d.noindex_since).toBeNull();
    }
  });

  it('needs the full thresholds, not 80%, to come back from noindex', () => {
    const c = inBand();
    const d = evaluateGate(c, [], noindex(c.url, daysBefore(NOW, 3)), CFG, allReviewed, NOW);
    expect(d.action).toBe('build_noindex');
    expect(d.noindex_since).toBe(daysBefore(NOW, 3));
  });

  it('plays the whole timeline: index, fall, wait 30 days, redirect, recover', () => {
    const c = makeCandidate();
    const weak = { ...c, evidence_count: 3 };
    let prev: ReturnType<typeof makeEntry> | null = null;
    const toEntry = (page: typeof c, d: ReturnType<typeof evaluateGate>) =>
      makeEntry({
        url: page.url,
        indexable: d.action === 'build_index',
        noindex_since: d.noindex_since,
        redirect_to: d.action === 'redirect_parent' ? page.parent_url : null,
      });
    const steps: [typeof c, string, string][] = [
      [c, daysBefore(NOW, 60), 'build_index'],
      [weak, daysBefore(NOW, 59), 'build_noindex'],
      [weak, daysBefore(NOW, 40), 'build_noindex'],
      [weak, daysBefore(NOW, 29), 'redirect_parent'],
      [weak, daysBefore(NOW, 10), 'redirect_parent'],
      [c, daysBefore(NOW, 0), 'build_index'],
    ];
    for (const [page, at, expected] of steps) {
      const d = evaluateGate(page, [], prev, CFG, allReviewed, new Date(at));
      expect(d.action, `at ${at}`).toBe(expected);
      prev = toEntry(page, d);
    }
  });
});

describe('assessCandidate and decide', () => {
  it('evaluateGate is decide(assessCandidate(...))', () => {
    const c = makeCandidate({ evidence_count: 5 });
    const prev = makeEntry({ url: c.url });
    const a = assessCandidate(c, [], CFG, allReviewed);
    expect(decide(a, c, prev, CFG, NOW)).toEqual(evaluateGate(c, [], prev, CFG, allReviewed, NOW));
  });

  it('a page that passes the publish thresholds also passes the stay thresholds', () => {
    const a = assessCandidate(makeCandidate(), [], CFG, allReviewed);
    expect(a.result.passed && a.stay).toBe(true);
  });
});
