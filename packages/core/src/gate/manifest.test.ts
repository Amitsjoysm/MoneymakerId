import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GateConfigSchema, ManifestEntrySchema } from '../schema/index.ts';
import type { CatalogueSnapshot, GateConfig, ManifestEntry } from '../schema/index.ts';
import { enumerateCandidates } from './candidates.ts';
import { evaluateGate } from './rules.ts';
import { DAY_MS, NOW, daysBefore, exampleSnapshot, makeConfig, makeEntry } from './fixtures.ts';
import { contentHash } from './hash.ts';
import { buildManifest, manifestAction } from './manifest.ts';

const cfg = makeConfig();
const DISH_PAGE = '/pune/hinjewadi/biryani/';

async function build(
  mutate: (s: CatalogueSnapshot) => void = () => {},
  config: GateConfig = cfg,
  now: Date = NOW,
): Promise<ManifestEntry[]> {
  const s = exampleSnapshot();
  mutate(s);
  return buildManifest(s, config, now);
}

const entry = (m: ManifestEntry[], host: string, url: string): ManifestEntry => {
  const found = m.find((e) => e.host === host && e.url === url);
  if (!found) throw new Error(`no manifest entry ${host} ${url}`);
  return found;
};

describe('buildManifest: coverage and shape', () => {
  it('has one valid entry per candidate page, in the order of the candidates', async () => {
    const m = await build();
    const candidates = enumerateCandidates(exampleSnapshot(), NOW);
    expect(m.map((e) => `${e.host}${e.url}`)).toEqual(candidates.map((c) => `${c.host}${c.url}`));
    for (const e of m) expect(() => ManifestEntrySchema.parse(e), e.url).not.toThrow();
    expect(new Set(m.map((e) => e.host))).toEqual(new Set(['main', 'construction', 'food']));
  });

  it('carries the page type and locale of the candidate and the hash of its data inputs', async () => {
    const m = await build();
    const e = entry(m, 'food', DISH_PAGE);
    expect(e.page_type).toBe('dish_locality');
    expect(e.locale).toBe('en');
    const candidate = enumerateCandidates(exampleSnapshot(), NOW).find(
      (c) => c.host === 'food' && c.url === DISH_PAGE,
    )!;
    expect(e.content_hash).toBe(await contentHash(candidate.data_inputs));
    expect(e.content_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not gate a page type that has no rule in the config', async () => {
    const e = entry(await build(), 'main', '/');
    expect(e).toMatchObject({ indexable: true, noindex_since: null, redirect_to: null });
    expect(e.gate).toMatchObject({ gate_key: 'main:home', passed: true, reasons: [] });
  });
});

describe('buildManifest: uniqueness is measured against every sibling', () => {
  it('gives each page the score it gets when compared with all candidates of its type', async () => {
    const m = await build();
    const all = enumerateCandidates(exampleSnapshot(), NOW);
    const open = () => true;
    for (const c of all) {
      const direct = evaluateGate(c, all, null, cfg, open, NOW);
      expect(entry(m, c.host, c.url).gate.scores.unique, `${c.host}${c.url}`).toBe(
        direct.result.scores.unique,
      );
    }
  });

  it('treats two pages with no text as identical', async () => {
    const m = await build((s) => {
      s.locality_guides.forEach((g) => (g.body_md = '#'));
    });
    const guides = m.filter((e) => e.page_type === 'locality_guide');
    expect(guides.map((e) => e.gate.scores.unique)).toEqual([0, 0, 0]);
  });
});

describe('buildManifest: the gate on the example catalogue', () => {
  it('indexes a dish page with enough grounded places and keeps thin ones out', async () => {
    const m = await build();
    const good = entry(m, 'food', DISH_PAGE);
    expect(good.indexable).toBe(true);
    expect(good.gate.passed).toBe(true);
    expect(good.gate.scores).toMatchObject({ entities: 4, evidence: 8, relevance: 1 });
    expect(good.gate.scores.unique).toBeGreaterThanOrEqual(0.5);
    expect(good.gate.scores.seo).toBeGreaterThanOrEqual(0.5);

    const thin = entry(m, 'food', '/pune/hinjewadi-phase-1/biryani/'); // one place
    expect(thin.indexable).toBe(false);
    expect(manifestAction(thin)).toBe('skip');
    expect(thin.gate.reasons.join(' ')).toMatch(/entities 1 is below min_entities 3/);
    expect(manifestAction(entry(m, 'food', '/pune/baner/misal-pav/'))).toBe('skip');
  });

  it('indexes a dish page across the city only for 5+ places in 2+ localities', async () => {
    const m = await build();
    expect(manifestAction(entry(m, 'food', '/pune/biryani/'))).toBe('build_index');
    const thin = entry(m, 'food', '/pune/misal-pav/');
    expect(thin.gate.reasons.join(' ')).toMatch(/min_entities/);
    expect(thin.gate.reasons.join(' ')).toMatch(/localities 0 is below min_localities 2/);
  });

  it('indexes a locality x service page with local substance and skips one without', async () => {
    const m = await build();
    const good = entry(m, 'construction', '/pune/hinjewadi/terrace-waterproofing/');
    expect(good.gate.passed).toBe(true);
    expect(good.gate.scores.unique).toBeGreaterThanOrEqual(0.5);
    const bare = entry(m, 'construction', '/pune/wakad/terrace-waterproofing/');
    expect(manifestAction(bare)).toBe('skip');
    expect(bare.gate.reasons.join(' ')).toMatch(/no local substance/);
  });

  it('counts providers towards local substance only with live evidence (plan §5 path b)', async () => {
    const WAKAD = '/pune/wakad/terrace-waterproofing/';
    // Uniqueness is switched off so that only the local-substance path is under test: Wakad's page shares its provider
    // text with /pune/wakad/waterproofing/.
    const pathB = makeConfig({
      'construction:locality_service': {
        min_entities: 0,
        min_evidence: 0,
        min_unique: 0,
        extra: { min_local_facts: 3, min_providers: 2, min_quotes: 3, min_factor_sources: 2 },
      },
    });
    const roofCare = (s: CatalogueSnapshot) =>
      s.providers.find((p) => p.name === 'Example Roof Care Services')!;
    const bothServeWakad = (s: CatalogueSnapshot): void => {
      roofCare(s).service_localities = ['wakad']; // Wakad had Example Terrace Seal Works only
    };

    const withBoth = entry(await build(bothServeWakad, pathB), 'construction', WAKAD);
    expect(manifestAction(withBoth), withBoth.gate.reasons.join('; ')).toBe('build_index');

    const oneWithoutEvidence = await build((s) => {
      bothServeWakad(s);
      s.evidence = s.evidence.filter((e) => e.entity_id !== roofCare(s).id);
    }, pathB);
    const thin = entry(oneWithoutEvidence, 'construction', WAKAD);
    expect(manifestAction(thin)).toBe('skip');
    expect(thin.gate.reasons.join(' ')).toMatch(/no local substance/);
  });

  it('holds a cost guide back until its prose is reviewed, and releases it when it is', async () => {
    const draft = entry(await build(), 'construction', '/pune/painting-cost/');
    expect(draft.indexable).toBe(false);
    expect(draft.gate.reasons.join(' ')).toMatch(
      /prose not reviewed: cost_model:painting-standard, service:painting/,
    );

    const m = await build((s) => {
      s.prose_reviews.push(
        { key: 'service:painting', status: 'reviewed' },
        { key: 'cost_model:painting-standard', status: 'reviewed' },
      );
    });
    expect(entry(m, 'construction', '/pune/painting-cost/').gate.reasons.join(' ')).not.toMatch(/prose/);
  });

  it('indexes a reviewed cost guide with two independent sources', async () => {
    const e = entry(await build(), 'construction', '/pune/terrace-waterproofing-cost/');
    expect(e.gate.passed).toBe(true);
    expect(e.indexable).toBe(true);
  });

  it('holds a locality guide back until it is reviewed and has 400 words', async () => {
    const guideConfig = makeConfig({
      'main:locality_guide': {
        min_entities: 0,
        min_evidence: 0,
        requires_reviewed_prose: true,
        extra: { min_words: 400 },
      },
    });
    const m = await build(() => {}, guideConfig);
    expect(manifestAction(entry(m, 'main', '/pune/hinjewadi/'))).toBe('build_index');
    expect(entry(m, 'main', '/pune/wakad/').gate.reasons.join(' ')).toMatch(
      /words 121 is below min_words 400/,
    );
    expect(entry(m, 'main', '/pune/baner/').gate.reasons.join(' ')).toMatch(
      /prose not reviewed: locality:baner:guide/,
    );
  });
});

describe('buildManifest: an intent page needs its parent page to be indexed', () => {
  const intentConfig = (parentMinEntities: number): GateConfig =>
    makeConfig({
      'food:dish_locality': { min_entities: parentMinEntities },
      'food:food_intent': { min_entities: 1, min_evidence: 1, min_unique: 0, seo_min: 0 },
    });
  const INTENT = '/pune/hinjewadi/biryani/under-400/';

  it('indexes the intent page when the parent passes', async () => {
    const m = await build(() => {}, intentConfig(3));
    expect(manifestAction(entry(m, 'food', DISH_PAGE))).toBe('build_index');
    expect(manifestAction(entry(m, 'food', INTENT))).toBe('build_index');
  });

  it('does not index the intent page when the parent fails, even if the intent has enough proof', async () => {
    const m = await build(() => {}, intentConfig(5));
    expect(manifestAction(entry(m, 'food', DISH_PAGE))).toBe('skip');
    const child = entry(m, 'food', INTENT);
    expect(manifestAction(child)).toBe('skip');
    expect(child.gate.passed).toBe(false);
    expect(child.gate.reasons.join(' ')).toMatch(/parent page \/pune\/hinjewadi\/biryani\/ is not indexed/);
  });
});

describe('buildManifest: a locality food intent page needs its locality hub to be indexed', () => {
  // Plan §5: an intent page passes only when its parent page passes (orchestrator ruling 2026-10-19 extends
  // this to the locality intents: late-night-food, budget-food, veg-food).
  const localityIntentConfig = (hubMinEntities: number): GateConfig =>
    makeConfig({
      'food:locality_hub': { min_entities: hubMinEntities, min_evidence: 0, min_unique: 0, seo_min: 0 },
      'food:locality_food_intent': { min_entities: 1, min_evidence: 1, min_unique: 0, seo_min: 0 },
    });
  const HUB = '/pune/hinjewadi/';
  const VEG = '/pune/hinjewadi/veg-food/';

  it('indexes the locality intent page when the locality hub passes', async () => {
    const m = await build(() => {}, localityIntentConfig(0));
    expect(manifestAction(entry(m, 'food', HUB))).toBe('build_index');
    expect(manifestAction(entry(m, 'food', VEG))).toBe('build_index');
  });

  it('skips the locality intent page when the locality hub is not indexed', async () => {
    const m = await build(() => {}, localityIntentConfig(1000));
    expect(manifestAction(entry(m, 'food', HUB))).toBe('skip');
    const child = entry(m, 'food', VEG);
    expect(manifestAction(child)).toBe('skip');
    expect(child.gate.reasons.join(' ')).toMatch(/parent page \/pune\/hinjewadi\/ is not indexed/);
  });
});

describe('buildManifest: content hash and hash_changed_at', () => {
  it('gives identical inputs an identical hash, and identical manifests', async () => {
    const a = await build();
    const b = await build();
    expect(b.map((e) => e.content_hash)).toEqual(a.map((e) => e.content_hash));
    expect(b).toEqual(a);
  });

  it('carries hash_changed_at over while the hash is unchanged and stamps it when the hash changes', async () => {
    const first = await build(() => {}, cfg, new Date(NOW.getTime() - 20 * DAY_MS));
    expect(entry(first, 'food', DISH_PAGE).hash_changed_at).toBe(daysBefore(NOW, 20));

    const same = await build((s) => {
      s.previous_manifest = first;
    });
    expect(entry(same, 'food', DISH_PAGE).hash_changed_at).toBe(daysBefore(NOW, 20));

    const changed = await build((s) => {
      s.previous_manifest = first;
      s.cost_models.find((m) => m.id === 'tw-standard')!.rate_inr.expected = 56;
    });
    const moved = entry(changed, 'construction', '/pune/terrace-waterproofing-cost/');
    expect(moved.hash_changed_at).toBe(NOW.toISOString());
    expect(moved.content_hash).not.toBe(
      entry(first, 'construction', '/pune/terrace-waterproofing-cost/').content_hash,
    );
    // every other page keeps its date
    expect(entry(changed, 'construction', '/pune/painting-cost/').hash_changed_at).toBe(daysBefore(NOW, 20));
    expect(entry(changed, 'food', DISH_PAGE).hash_changed_at).toBe(daysBefore(NOW, 20));
  });

  it('stamps a page that is new to the manifest with now', async () => {
    const e = entry(await build(), 'food', DISH_PAGE);
    expect(e.hash_changed_at).toBe(NOW.toISOString());
  });
});

describe('buildManifest: hysteresis timeline (plan §5)', () => {
  // The page has 8 evidence rows: it passes min_evidence 6, falls short of 9 but is within 80% of it (7.2), and is
  // below 80% of 11 (8.8).
  const slightly = makeConfig({ 'food:dish_locality': { min_evidence: 9 } });
  const badly = makeConfig({ 'food:dish_locality': { min_evidence: 11 } });
  const wasIndexed = (): ManifestEntry => makeEntry({ url: DISH_PAGE, hash_changed_at: daysBefore(NOW, 40) });

  it('keeps an indexed page indexed while every score is within 80% of its threshold', async () => {
    const m = await build((s) => {
      s.previous_manifest = [wasIndexed()];
    }, slightly);
    const e = entry(m, 'food', DISH_PAGE);
    expect(manifestAction(e)).toBe('build_index');
    expect(e.gate.passed).toBe(false);
    expect(e.noindex_since).toBeNull();
    expect(e.gate.reasons.join(' ')).toMatch(/kept indexed by hysteresis/);
  });

  it('does not index a new page that falls between the two thresholds', async () => {
    const e = entry(await build(() => {}, slightly), 'food', DISH_PAGE);
    expect(manifestAction(e)).toBe('skip');
  });

  it('sends an indexed page below 80% to noindex and starts the clock', async () => {
    const m = await build((s) => {
      s.previous_manifest = [wasIndexed()];
    }, badly);
    const e = entry(m, 'food', DISH_PAGE);
    expect(manifestAction(e)).toBe('build_noindex');
    expect(e).toMatchObject({ indexable: false, noindex_since: NOW.toISOString(), redirect_to: null });
  });

  it('walks noindex, then noindex, then a 301 to the parent after 30 days, over successive builds', async () => {
    const t0 = new Date('2026-10-01T06:00:00.000Z');
    const at = (days: number): Date => new Date(t0.getTime() + days * DAY_MS);
    let manifest = await build(
      (s) => {
        s.previous_manifest = [wasIndexed()];
      },
      badly,
      t0,
    );
    expect(manifestAction(entry(manifest, 'food', DISH_PAGE))).toBe('build_noindex');

    for (const [days, action] of [
      [1, 'build_noindex'],
      [29, 'build_noindex'],
      [30, 'redirect_parent'],
      [45, 'redirect_parent'],
    ] as const) {
      const previous = manifest;
      manifest = await build(
        (s) => {
          s.previous_manifest = previous;
        },
        badly,
        at(days),
      );
      const e = entry(manifest, 'food', DISH_PAGE);
      expect(manifestAction(e), `day ${days}`).toBe(action);
      expect(e.noindex_since, `day ${days}`).toBe(t0.toISOString());
      expect(e.redirect_to, `day ${days}`).toBe(action === 'redirect_parent' ? '/pune/hinjewadi/' : null);
    }
  });

  it('puts a page back in the index when it passes again', async () => {
    const t0 = new Date('2026-10-01T06:00:00.000Z');
    const noindexed = await build(
      (s) => {
        s.previous_manifest = [wasIndexed()];
      },
      badly,
      t0,
    );
    const m = await build(
      (s) => {
        s.previous_manifest = noindexed;
      },
      cfg,
      new Date(t0.getTime() + 10 * DAY_MS),
    );
    const e = entry(m, 'food', DISH_PAGE);
    expect(manifestAction(e)).toBe('build_index');
    expect(e.noindex_since).toBeNull();
  });
});

describe('buildManifest: a redirect lands on a page that exists', () => {
  const hubGone = makeConfig({
    'food:dish_locality': { min_evidence: 11 },
    'food:locality_hub': { min_entities: 99 },
  });
  const since = daysBefore(NOW, 31);
  const wasNoindex = (): ManifestEntry =>
    makeEntry({ url: DISH_PAGE, indexable: false, noindex_since: since });

  it('climbs past a parent hub that is itself not built, to the city page', async () => {
    const m = await build((s) => {
      s.previous_manifest = [wasNoindex()];
    }, hubGone);
    expect(manifestAction(entry(m, 'food', '/pune/hinjewadi/'))).toBe('skip');
    expect(entry(m, 'food', DISH_PAGE)).toMatchObject({ redirect_to: '/pune/', noindex_since: since });
  });

  it('redirects to the hub when the hub is built', async () => {
    const m = await build(
      (s) => {
        s.previous_manifest = [wasNoindex()];
      },
      makeConfig({ 'food:dish_locality': { min_evidence: 11 } }),
    );
    expect(entry(m, 'food', DISH_PAGE).redirect_to).toBe('/pune/hinjewadi/');
  });

  it('sends a vanished page to the nearest ancestor that is built, not one that is skipped', async () => {
    const m = await build((s) => {
      s.previous_manifest = [
        makeEntry({
          url: '/pune/hinjewadi/ghost-dish/',
          indexable: false,
          noindex_since: daysBefore(NOW, 60),
        }),
      ];
    }, hubGone);
    expect(entry(m, 'food', '/pune/hinjewadi/ghost-dish/').redirect_to).toBe('/pune/');
  });
});

describe('buildManifest: a page whose data is gone does not become a 404', () => {
  const GHOST = '/pune/hinjewadi/ghost-dish/';
  const ghost = (over: Partial<ManifestEntry> = {}): ManifestEntry =>
    makeEntry({ url: GHOST, page_type: 'dish_locality', hash_changed_at: daysBefore(NOW, 90), ...over });

  it('moves an indexed page that is no longer a candidate to noindex, keeping its hash and date', async () => {
    const m = await build((s) => {
      s.previous_manifest = [ghost()];
    });
    const e = entry(m, 'food', GHOST);
    expect(manifestAction(e)).toBe('build_noindex');
    expect(e.noindex_since).toBe(NOW.toISOString());
    expect(e.content_hash).toBe('a'.repeat(64));
    expect(e.hash_changed_at).toBe(daysBefore(NOW, 90));
    expect(e.gate.reasons.join(' ')).toMatch(/no longer a candidate/);
  });

  it('redirects it to the nearest ancestor page that exists once the grace period is over', async () => {
    const m = await build((s) => {
      s.previous_manifest = [ghost({ indexable: false, noindex_since: daysBefore(NOW, 31) })];
    });
    const e = entry(m, 'food', GHOST);
    expect(manifestAction(e)).toBe('redirect_parent');
    expect(e.redirect_to).toBe('/pune/hinjewadi/');
  });

  it('falls back to the city page when no ancestor is a candidate', async () => {
    const m = await build((s) => {
      s.previous_manifest = [
        makeEntry({ url: '/pune/kharadi/ghost-dish/', indexable: false, noindex_since: daysBefore(NOW, 60) }),
      ];
    });
    expect(entry(m, 'food', '/pune/kharadi/ghost-dish/').redirect_to).toBe('/pune/');
  });

  it('forgets a page that was never indexed', async () => {
    const m = await build((s) => {
      s.previous_manifest = [ghost({ indexable: false, noindex_since: null })];
    });
    expect(m.some((e) => e.url === GHOST)).toBe(false);
  });
});

describe('manifestAction', () => {
  it('reads the four states back from an entry', () => {
    const url = '/pune/x/';
    expect(manifestAction(makeEntry({ url }))).toBe('build_index');
    expect(manifestAction(makeEntry({ url, indexable: false, noindex_since: NOW.toISOString() }))).toBe(
      'build_noindex',
    );
    expect(
      manifestAction(
        makeEntry({ url, indexable: false, noindex_since: NOW.toISOString(), redirect_to: '/pune/' }),
      ),
    ).toBe('redirect_parent');
    expect(manifestAction(makeEntry({ url, indexable: false }))).toBe('skip');
  });
});

describe('buildManifest with the shipped data/gate.json', () => {
  const shipped = GateConfigSchema.parse(
    JSON.parse(readFileSync(new URL('../../../../data/gate.json', import.meta.url), 'utf8')),
  );

  it('gates the example catalogue by the real thresholds', async () => {
    const m = await build(() => {}, shipped);
    for (const e of m) expect(() => ManifestEntrySchema.parse(e), e.url).not.toThrow();
    // 4 grounded places, 8 claims: passes dish_locality (3 places, 6 claims)
    expect(manifestAction(entry(m, 'food', DISH_PAGE))).toBe('build_index');
    // the city dish page needs 5 places across 2 localities: biryani has exactly that
    expect(manifestAction(entry(m, 'food', '/pune/biryani/'))).toBe('build_index');
    // a locality hub needs 5 places; Hinjewadi has 4
    expect(manifestAction(entry(m, 'food', '/pune/hinjewadi/'))).toBe('skip');
    // guides need review and 400 words
    expect(manifestAction(entry(m, 'main', '/pune/hinjewadi/'))).toBe('build_index');
    expect(manifestAction(entry(m, 'main', '/pune/wakad/'))).toBe('skip');
    expect(manifestAction(entry(m, 'main', '/pune/baner/'))).toBe('skip');
    // the local-substance rule: Hinjewadi terrace waterproofing has it, Wakad has none
    expect(manifestAction(entry(m, 'construction', '/pune/hinjewadi/terrace-waterproofing/'))).toBe(
      'build_index',
    );
    expect(manifestAction(entry(m, 'construction', '/pune/wakad/terrace-waterproofing/'))).toBe('skip');
  });
});
