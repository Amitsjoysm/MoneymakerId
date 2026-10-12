import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CSV_HEADERS } from '../schema/index.ts';
import { ConfigError } from './errors.ts';
import {
  loadAggregators,
  loadCsv,
  loadDemand,
  loadLocalityGuideFiles,
  loadLocalityGuides,
  loadLocalityFactsStaging,
  loadServices,
} from './loaders.ts';
import { fileExists, listFiles, readJson } from './files.ts';
import { z } from 'zod';

// Each test builds a tiny repository in a temp directory, so error paths are tested without touching data/.
let root: string;
beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'mm-loaders-')));
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

function put(rel: string, text: string): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text);
}

const fail = (fn: () => unknown): ConfigError => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError);
    return e as ConfigError;
  }
  throw new Error('expected a ConfigError');
};

describe('file readers', () => {
  it('fileExists and listFiles see only what is there, sorted', () => {
    put('t/files/b.json', '[]');
    put('t/files/a.json', '[]');
    put('t/files/c.txt', '');
    expect(fileExists('t/files/a.json', { root })).toBe(true);
    expect(fileExists('t/files/zzz.json', { root })).toBe(false);
    expect(listFiles('t/files', '.json', { root })).toEqual(['a.json', 'b.json']);
    expect(listFiles('t/none', '.json', { root })).toEqual([]);
  });

  it('a missing file is a ConfigError naming the file, not an ENOENT', () => {
    const e = fail(() => readJson('t/missing.json', z.array(z.string()), { root }));
    expect(e.message).toContain('t/missing.json');
    expect(e.message).toContain('not found');
    expect(e.file).toBe('t/missing.json');
  });

  it('invalid JSON names the file', () => {
    put('t/bad.json', '{ nope');
    const e = fail(() => readJson('t/bad.json', z.unknown(), { root }));
    expect(e.message).toContain('t/bad.json');
    expect(e.message).toContain('not valid JSON');
  });

  it('a schema failure names the file and the failing path', () => {
    put('t/shape.json', '{"a":{"b":1}}');
    const e = fail(() => readJson('t/shape.json', z.object({ a: z.object({ b: z.string() }) }), { root }));
    expect(e.message).toContain('t/shape.json');
    expect(e.message).toContain('a.b');
  });

  it('caps the number of reported issues', () => {
    put('t/many.json', JSON.stringify(Array.from({ length: 30 }, () => 1)));
    const e = fail(() => readJson('t/many.json', z.array(z.string()), { root }));
    expect(e.message).toContain('and 22 more');
  });
});

describe('JSON loaders', () => {
  it('load every service file and require a top-level service', () => {
    put('data/services/x.json', JSON.stringify({ id: 'x', parent_id: 'y' }));
    const e = fail(() => loadServices({ root }));
    expect(e.file).toBe('data/services/x.json');
  });

  it('loadAggregators validates entries', () => {
    put(
      'data/aggregators.json',
      JSON.stringify([{ domain: 'zomato.com', owner_group: 'zomato', discovery_only: true }]),
    );
    expect(loadAggregators({ root })).toHaveLength(1);
    put(
      'data/aggregators.json',
      JSON.stringify([{ domain: 'zomato.com', owner_group: 'zomato', discovery_only: false }]),
    );
    fail(() => loadAggregators({ root }));
  });

  it('loadLocalityFactsStaging reads only the locality-facts-* files and returns [] when there are none', () => {
    expect(loadLocalityFactsStaging({ root })).toEqual([]);
    put('data/sources/painting.md', '# notes');
    put('data/sources/other.json', '{"not":"facts"}');
    expect(loadLocalityFactsStaging({ root })).toEqual([]);
    put('data/sources/locality-facts-1.json', '{}');
    expect(loadLocalityFactsStaging({ root })).toEqual([
      { file: 'data/sources/locality-facts-1.json', facts: {} },
    ]);
  });
});

describe('CSV loaders', () => {
  const demandHeader = CSV_HEADERS.demand.join(',');

  it('reads typed rows, skipping EXAMPLE rows', () => {
    put(
      'data/demand.csv',
      `${demandHeader}\nEXAMPLE-service,,wakad,100,1,1,x\nwaterproofing,terrace-waterproofing,wakad,,400,0,prior\n`,
    );
    expect(loadDemand({ root })).toEqual([
      {
        service_or_dish: 'waterproofing',
        sub_id: 'terrace-waterproofing',
        locality_id: 'wakad',
        monthly_searches: null,
        est_lead_value_inr: 400,
        data_ready: false,
        source: 'prior',
      },
    ]);
  });

  it('requires the exact header row', () => {
    put('data/demand.csv', `service_or_dish,locality_id\nx,y\n`);
    const e = fail(() => loadDemand({ root }));
    expect(e.message).toContain('header row must be exactly');
    expect(e.message).toContain(demandHeader);
  });

  it('names the file and the line of a bad row', () => {
    put(
      'data/demand.csv',
      `${demandHeader}\nwaterproofing,,wakad,,400,0,prior\nwaterproofing,,wakad,,abc,0,prior\n`,
    );
    const e = fail(() => loadDemand({ root }));
    expect(e.message).toContain('data/demand.csv line 3');
    expect(e.message).toContain('est_lead_value_inr');
  });

  it('loadCsv works for any template and path', () => {
    put('elsewhere/facts.csv', `${CSV_HEADERS.local_facts.join(',')}\n`);
    expect(loadCsv('local_facts', 'elsewhere/facts.csv', { root })).toEqual([]);
  });
});

describe('locality guides', () => {
  const guide = (extra = '') =>
    [
      '---',
      'locality_id: "baner"',
      'title: "Living in Baner"',
      'status: draft',
      'word_count: 3',
      'sources:',
      '  - url: "https://en.wikipedia.org/wiki/Baner"',
      '    title: "Baner"',
      '    publisher: "Wikipedia"',
      '    retrieved_at: "2026-10-07"',
      '    quote: null',
      extra,
      '---',
      '',
      '# Baner',
      '',
      'Body text.',
      '',
    ].join('\n');

  it('parses the front matter and returns the trimmed body', () => {
    put('content/locality-guides/baner.md', guide());
    const [file] = loadLocalityGuideFiles({ root });
    expect(file?.file).toBe('content/locality-guides/baner.md');
    expect(file?.frontmatter.locality_id).toBe('baner');
    expect(file?.body_md).toBe('# Baner\n\nBody text.');
    expect(loadLocalityGuides({ root })).toEqual([
      {
        locality_id: 'baner',
        title: 'Living in Baner',
        body_md: '# Baner\n\nBody text.',
        status: 'draft',
        sources: file?.frontmatter.sources,
      },
    ]);
  });

  it('names the file when the front matter is unreadable or does not validate', () => {
    put('content/locality-guides/baner.md', guide('surprise: true'));
    expect(fail(() => loadLocalityGuideFiles({ root })).message).toContain(
      'content/locality-guides/baner.md',
    );
    put('content/locality-guides/baner.md', 'no front matter here');
    const e = fail(() => loadLocalityGuideFiles({ root }));
    expect(e.message).toContain('content/locality-guides/baner.md');
    expect(e.message).toContain('front matter');
  });
});

describe('on a runtime without Node (Workers)', () => {
  it('importing is harmless and calling a loader fails with a clear ConfigError', () => {
    vi.stubGlobal('process', undefined);
    try {
      const e = fail(() => loadAggregators({ root }));
      expect(e.message).toContain('Node-only');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
