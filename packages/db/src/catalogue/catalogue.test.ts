import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadLocalities } from '@mm/core/config';
import { CatalogueSnapshotSchema, type CatalogueSnapshot } from '@mm/core/schema';
import { DbError } from '../rpc.ts';
import { loadFixtureCatalogue } from '../fixtures/index.ts';
import { emptySnapshot, hangingFetch, jsonResponse, mockFetch } from '../testing.ts';
import {
  SnapshotError,
  assertNoFixtureBusinesses,
  loadSnapshot,
  parseDataSource,
  snapshotOptionsFromEnv,
} from './index.ts';

// Wraps the real loader so a test can prove the supabase path never reaches it (no fallback to fixtures).
vi.mock('../fixtures/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../fixtures/index.ts')>();
  return { ...actual, loadFixtureCatalogue: vi.fn(actual.loadFixtureCatalogue) };
});

const URL_BASE = 'https://example-project.supabase.co';
const KEY = ['sb', 'publishable', 'abcdefghijklmnop'].join('_');
const repoRoot = join(dirname(new URL(import.meta.url).pathname), '..', '..', '..', '..');

afterEach(() => vi.unstubAllGlobals());

describe('parseDataSource', () => {
  it('accepts the two modes', () => {
    expect(parseDataSource('supabase')).toBe('supabase');
    expect(parseDataSource('fixtures')).toBe('fixtures');
  });

  it('refuses anything else, including a missing value: there is no silent default', () => {
    for (const bad of [undefined, null, '', 'Supabase', 'fixture', 'production']) {
      expect(() => parseDataSource(bad), String(bad)).toThrow(SnapshotError);
    }
  });
});

describe('assertNoFixtureBusinesses', () => {
  const place = loadFixtureCatalogue().places[0]!;
  const provider = loadFixtureCatalogue().providers[0]!;
  const real = (name: string) => emptySnapshot({ places: [{ ...place, name }] });

  it('throws for an Example place or provider when the source is supabase, which is also the default', () => {
    const withPlace = emptySnapshot({ places: [place] });
    const withProvider = emptySnapshot({ providers: [provider] });
    expect(() => assertNoFixtureBusinesses(withPlace, 'supabase')).toThrow(SnapshotError);
    expect(() => assertNoFixtureBusinesses(withPlace)).toThrow(/Example Biryani House/);
    expect(() => assertNoFixtureBusinesses(withProvider)).toThrow(/Example Waterproofing Works/);
  });

  it('allows fixture businesses when the source is fixtures', () => {
    expect(() => assertNoFixtureBusinesses(emptySnapshot({ places: [place] }), 'fixtures')).not.toThrow();
  });

  it('throws for any name that starts with "Example", even when it continues as one word', () => {
    for (const name of ['Exampleton Grill', 'EXAMPLES Painters', 'example']) {
      expect(() => assertNoFixtureBusinesses(real(name)), name).toThrow(SnapshotError);
    }
  });

  it('allows ordinary names, including ones that only contain or resemble the word', () => {
    for (const name of ['Sample Biryani', 'The Example Cafe', 'Exemplar Foods']) {
      expect(() => assertNoFixtureBusinesses(real(name)), name).not.toThrow();
    }
    expect(() => assertNoFixtureBusinesses(emptySnapshot())).not.toThrow();
  });

  it('lists at most a few offenders', () => {
    const many = emptySnapshot({
      places: Array.from({ length: 12 }, (_, i) => ({ ...place, id: place.id, name: `Example Cafe ${i}` })),
    });
    const message = (() => {
      try {
        assertNoFixtureBusinesses(many);
      } catch (e) {
        return (e as Error).message;
      }
      return '';
    })();
    expect(message).toContain('12');
    expect(message.length).toBeLessThan(600);
  });
});

describe("loadSnapshot({ dataSource: 'supabase' })", () => {
  it('returns api.export_catalogue() through the publishable-key client', async () => {
    const snapshot = emptySnapshot({ snapshot_id: 'from-db' });
    const { fetch, calls } = mockFetch(() => jsonResponse(snapshot));
    const out = await loadSnapshot({
      dataSource: 'supabase',
      supabase: { url: URL_BASE, publishableKey: KEY, fetch },
    });
    expect(out).toEqual(snapshot);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${URL_BASE}/rest/v1/rpc/export_catalogue`);
    expect(calls[0]!.headers['apikey']).toBe(KEY);
    expect(calls[0]!.headers['content-profile']).toBe('api');
  });

  it('accepts a ready client instead of url and key', async () => {
    const snapshot = emptySnapshot();
    const exportCatalogue = vi.fn(async () => snapshot);
    await expect(loadSnapshot({ dataSource: 'supabase', client: { exportCatalogue } })).resolves.toBe(
      snapshot,
    );
    expect(exportCatalogue).toHaveBeenCalledOnce();
  });

  it.each([
    ['http', () => mockFetch(() => jsonResponse({ code: 'X', message: 'boom' }, 500)).fetch, undefined],
    ['network', () => (() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch, undefined],
    ['timeout', () => hangingFetch(), 20],
    ['decode', () => mockFetch(() => jsonResponse({ snapshot_id: 'incomplete' })).fetch, undefined],
  ] as const)('a %s error throws and does not fall back to fixtures', async (kind, makeFetch, timeoutMs) => {
    vi.mocked(loadFixtureCatalogue).mockClear();
    const error = await loadSnapshot({
      dataSource: 'supabase',
      supabase: {
        url: URL_BASE,
        publishableKey: KEY,
        fetch: makeFetch(),
        ...(timeoutMs ? { timeoutMs } : {}),
      },
    }).then(
      (snapshot) => {
        throw new Error(`resolved with snapshot "${snapshot.snapshot_id}" instead of rejecting`);
      },
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(DbError);
    expect((error as DbError).kind).toBe(kind);
    expect(loadFixtureCatalogue).not.toHaveBeenCalled();
  });

  it('throws when it has neither a client nor a url and key', async () => {
    await expect(loadSnapshot({ dataSource: 'supabase' })).rejects.toThrow(SnapshotError);
    await expect(
      loadSnapshot({ dataSource: 'supabase', supabase: { url: '', publishableKey: KEY } }),
    ).rejects.toThrow(/SUPABASE_URL/);
    const error = await loadSnapshot({
      dataSource: 'supabase',
      supabase: { url: URL_BASE, publishableKey: '' },
    }).catch((e: unknown) => e);
    expect(String(error)).toContain('SUPABASE_PUBLISHABLE_KEY');
  });

  it('fails the build when the database snapshot contains an Example business', async () => {
    const snapshot = emptySnapshot({ places: loadFixtureCatalogue().places });
    const { fetch } = mockFetch(() => jsonResponse(snapshot));
    await expect(
      loadSnapshot({ dataSource: 'supabase', supabase: { url: URL_BASE, publishableKey: KEY, fetch } }),
    ).rejects.toThrow(/Example/);
  });
});

describe("loadSnapshot({ dataSource: 'fixtures' })", () => {
  it('assembles a valid snapshot from data/, content/ and the fixture file, with no network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const warnings: string[] = [];
    const now = new Date('2026-10-13T08:00:00Z');
    const snapshot = await loadSnapshot({ dataSource: 'fixtures', now, warn: (m) => warnings.push(m) });
    expect(CatalogueSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(snapshot.generated_at).toBe('2026-10-13T08:00:00.000Z');
    expect(snapshot.snapshot_id).toBe('fixtures');

    const fixture = loadFixtureCatalogue();
    expect(snapshot.places).toEqual(fixture.places);
    expect(snapshot.providers).toEqual(fixture.providers);
    expect(snapshot.evidence).toEqual(fixture.evidence);
    expect(snapshot.recommendations).toEqual(fixture.recommendations);
    // Reference sections come from the real files.
    expect(snapshot.services.map((s) => s.id).sort()).toEqual([
      'bathroom-renovation',
      'house-construction',
      'modular-kitchen',
      'painting',
      'waterproofing',
    ]);
    expect(snapshot.cost_models.length).toBeGreaterThan(40);
    expect(snapshot.locality_guides.length).toBeGreaterThan(0);

    const haveLocalities = existsSync(join(repoRoot, 'data/localities.json'));
    const haveDishes = existsSync(join(repoRoot, 'data/dishes.json'));
    expect(snapshot.localities.length > 0).toBe(haveLocalities);
    expect(snapshot.dishes.length > 0).toBe(haveDishes);
    expect(warnings.some((w) => w.includes('data/localities.json'))).toBe(!haveLocalities);
    expect(warnings.some((w) => w.includes('data/dishes.json'))).toBe(!haveDishes);
    // Nothing else is warned about.
    expect(warnings).toHaveLength(Number(!haveLocalities) + Number(!haveDishes));
  });

  it.skipIf(!existsSync(join(repoRoot, 'data/localities.json')))(
    'uses data/localities.json as is (skipped while the file does not exist)',
    async () => {
      const snapshot = await loadSnapshot({ dataSource: 'fixtures', warn: () => {} });
      expect(snapshot.localities).toEqual(loadLocalities());
    },
  );

  it('the production check flags the fixture snapshot', async () => {
    const snapshot = await loadSnapshot({ dataSource: 'fixtures', warn: () => {} });
    expect(() => assertNoFixtureBusinesses(snapshot, 'fixtures')).not.toThrow();
    expect(() => assertNoFixtureBusinesses(snapshot, 'supabase')).toThrow(SnapshotError);
  });

  describe('with a repository root of its own', () => {
    let root: string;
    beforeAll(() => {
      root = realpathSync(mkdtempSync(join(tmpdir(), 'mm-db-')));
      writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
    });
    afterAll(() => rmSync(root, { recursive: true, force: true }));
    const put = (rel: string, value: unknown) => {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), JSON.stringify(value));
    };

    it('uses empty localities and dishes and logs a warning for each while the files do not exist', async () => {
      const warnings: string[] = [];
      const snapshot = await loadSnapshot({ dataSource: 'fixtures', root, warn: (m) => warnings.push(m) });
      expect(snapshot.localities).toEqual([]);
      expect(snapshot.dishes).toEqual([]);
      expect(snapshot.services).toEqual([]);
      expect(snapshot.cost_models).toEqual([]);
      expect(snapshot.locality_guides).toEqual([]);
      expect(warnings).toHaveLength(2);
      expect(warnings[0]).toContain('data/localities.json');
      expect(warnings[1]).toContain('data/dishes.json');
      expect(snapshot.places).toHaveLength(loadFixtureCatalogue().places.length);
    });

    it('loads localities.json and dishes.json once they exist, without a warning', async () => {
      const locality = {
        id: 'hinjewadi',
        name: 'Hinjewadi',
        kind: 'locality',
        city_id: 'pune',
        parent_id: null,
        aliases: [],
        geo: { lat: 18.5, lng: 73.8 },
        geo_source: {
          url: 'https://example.com/geo',
          title: 't',
          publisher: 'p',
          retrieved_at: '2026-10-01',
          quote: null,
        },
        jurisdiction: 'PMRDA',
        pincodes: ['411057'],
        neighbours: [],
        landmarks: [],
        commercial_centres: [],
        office_clusters: [],
        residential_clusters: [],
        construction_facts: [],
        food_notes: [],
        i18n: { mr: null, hi: null },
      };
      const dish = {
        id: 'biryani',
        name: 'Biryani',
        parent_id: null,
        aliases: [],
        cravings: [],
        diet: 'both',
        price_bands_inr: [100, 200, 300],
        price_sanity_inr: { min: 50, max: 800 },
        description: 'Fixture description.',
        prose_status: 'draft',
        i18n: { mr: null, hi: null },
      };
      put('data/localities.json', [locality]);
      put('data/dishes.json', [dish]);
      const warnings: string[] = [];
      const snapshot: CatalogueSnapshot = await loadSnapshot({
        dataSource: 'fixtures',
        root,
        warn: (m) => warnings.push(m),
      });
      expect(snapshot.localities.map((l) => l.id)).toEqual(['hinjewadi']);
      expect(snapshot.dishes.map((d) => d.id)).toEqual(['biryani']);
      expect(warnings).toEqual([]);
    });

    it('throws when a data file exists but is invalid: a loader error is never swallowed', async () => {
      put('data/localities.json', [{ id: 'hinjewadi' }]);
      const warn = vi.fn();
      await expect(loadSnapshot({ dataSource: 'fixtures', root, warn })).rejects.toThrow(/localities\.json/);
      expect(warn).not.toHaveBeenCalled();
      writeFileSync(join(root, 'data/localities.json'), '{ not json');
      await expect(loadSnapshot({ dataSource: 'fixtures', root, warn })).rejects.toThrow(/localities\.json/);
    });
  });
});

describe('snapshotOptionsFromEnv', () => {
  it('reads DATA_SOURCE, SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse(emptySnapshot()));
    const options = snapshotOptionsFromEnv({
      DATA_SOURCE: 'supabase',
      SUPABASE_URL: URL_BASE,
      SUPABASE_PUBLISHABLE_KEY: KEY,
    });
    expect(options.dataSource).toBe('supabase');
    if (options.dataSource !== 'supabase') throw new Error('unreachable');
    await loadSnapshot({ ...options, supabase: { ...options.supabase!, fetch } });
    expect(calls[0]!.headers['apikey']).toBe(KEY);
    expect(snapshotOptionsFromEnv({ DATA_SOURCE: 'fixtures' })).toEqual({ dataSource: 'fixtures' });
  });

  it('refuses a missing or unknown DATA_SOURCE, and names missing variables without printing values', () => {
    expect(() => snapshotOptionsFromEnv({})).toThrow(/DATA_SOURCE/);
    expect(() => snapshotOptionsFromEnv({ DATA_SOURCE: 'prod' })).toThrow(SnapshotError);
    expect(() => snapshotOptionsFromEnv({ DATA_SOURCE: 'supabase', SUPABASE_URL: URL_BASE })).toThrow(
      /SUPABASE_PUBLISHABLE_KEY/,
    );
    expect(() => snapshotOptionsFromEnv({ DATA_SOURCE: 'supabase', SUPABASE_PUBLISHABLE_KEY: KEY })).toThrow(
      /SUPABASE_URL/,
    );
  });
});
