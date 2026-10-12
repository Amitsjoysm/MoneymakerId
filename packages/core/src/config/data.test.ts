// The acceptance tests of T01: every file under data/ and content/locality-guides/ validates against its schema,
// the CSV templates carry exactly the CONTRACTS §6 headers, and the rules that span records hold.
//
// These read the real committed files (the repository root is found from pnpm-workspace.yaml). The files named
// in REQUIRED are committed, so a missing one fails the test. The rest (localities, dishes and the
// locality-facts staging files) are produced by a separate data run: when they are present they are validated,
// and when they are absent their test is reported as skipped with the reason in its name.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ALL_SERVICE_IDS,
  DISH_IDS,
  LEAF_SERVICE_IDS,
  LOCALITY_IDS,
  NEVER_ADS,
  SERVICE_TREE,
  SUB_LOCALITY_IDS,
  TOP_LEVEL_SERVICE_IDS,
} from '../constants/index.ts';
import { CSV_HEADERS, type ServiceDef } from '../schema/index.ts';
import { parseCsvRecords } from './csv.ts';
import { fileExists, listFiles, readText } from './files.ts';
import {
  loadAdSlotRules,
  loadAggregators,
  loadCostModels,
  loadCuration,
  loadDemand,
  loadDishes,
  loadExperiments,
  loadGateConfig,
  loadLeadPricing,
  loadLocalities,
  loadLocalityFactsStaging,
  loadLocalityGuideFiles,
  loadSeasonalCalendar,
  loadServices,
} from './loaders.ts';

const CURATION = ['places', 'place_dishes', 'providers', 'experiences', 'local_facts'] as const;
const KNOWN_LOCALITIES: ReadonlySet<string> = new Set([...LOCALITY_IDS, ...SUB_LOCALITY_IDS]);
const KNOWN_SERVICES: ReadonlySet<string> = new Set(ALL_SERVICE_IDS);
const KNOWN_DISHES: ReadonlySet<string> = new Set(DISH_IDS);

function flatten(services: ServiceDef[]): ServiceDef[] {
  return services.flatMap((s) => [s, ...flatten(s.sub_services)]);
}

function unknownIds(ids: Iterable<string>, known: ReadonlySet<string>): string[] {
  return [...new Set(ids)].filter((id) => !known.has(id)).sort();
}

describe('data/services/*.json', () => {
  // Loaded in beforeAll, not at collection time, so a bad data file fails only the tests that need it.
  let services: ServiceDef[];
  let all: ServiceDef[];
  beforeAll(() => {
    services = loadServices();
    all = flatten(services);
  });

  it('holds exactly the five top-level services, one per file, named after the service id', () => {
    expect(listFiles('data/services', '.json')).toEqual(
      [...TOP_LEVEL_SERVICE_IDS].map((id) => `${id}.json`).sort(),
    );
    expect(services.map((s) => s.id).sort()).toEqual([...TOP_LEVEL_SERVICE_IDS].sort());
  });

  it('nests exactly the contract sub-services under their parents', () => {
    for (const [parent, subs] of Object.entries(SERVICE_TREE)) {
      const def = services.find((s) => s.id === parent);
      expect(def?.sub_services.map((s) => s.id).sort(), parent).toEqual([...subs].sort());
    }
    expect(all.map((s) => s.id).sort()).toEqual([...ALL_SERVICE_IDS].sort());
  });

  it('links every sub-service to its parent and gives every service a unique id', () => {
    for (const s of all) for (const sub of s.sub_services) expect(sub.parent_id, sub.id).toBe(s.id);
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
  });
});

describe('data/cost-models/*.json', () => {
  let models: ReturnType<typeof loadCostModels>;
  beforeAll(() => {
    models = loadCostModels();
  });

  it('has one file per top-level service', () => {
    expect(listFiles('data/cost-models', '.json')).toEqual(
      [...TOP_LEVEL_SERVICE_IDS].map((id) => `${id}.json`).sort(),
    );
  });

  it('gives every model a unique id and a known service, and every leaf service a sourced model', () => {
    expect(new Set(models.map((m) => m.id)).size).toBe(models.length);
    expect(
      unknownIds(
        models.map((m) => m.service_id),
        KNOWN_SERVICES,
      ),
    ).toEqual([]);
    const covered = new Set(models.map((m) => m.service_id));
    expect(LEAF_SERVICE_IDS.filter((id) => !covered.has(id))).toEqual([]);
  });

  it('only names scopes and materials that the service defines', () => {
    const byId = new Map(flatten(loadServices()).map((s) => [s.id, s]));
    const problems: string[] = [];
    for (const m of models) {
      const def = byId.get(m.service_id);
      if (!def) continue;
      if (m.scope_id !== null && !def.scope_options.some((o) => o.id === m.scope_id))
        problems.push(`${m.id}: scope ${m.scope_id}`);
      if (m.material_id !== null && !def.materials.some((o) => o.id === m.material_id))
        problems.push(`${m.id}: material ${m.material_id}`);
    }
    expect(problems).toEqual([]);
  });

  it('uses only known localities in its locality factors', () => {
    const used = models.flatMap((m) => m.locality_factors.map((f) => f.locality_id));
    expect(unknownIds(used, KNOWN_LOCALITIES)).toEqual([]);
  });
});

describe('data/*.json configuration files', () => {
  it('seasonal-calendar.json has all twelve months and only known services', () => {
    const cal = loadSeasonalCalendar();
    expect(Object.keys(cal.months).sort((a, b) => Number(a) - Number(b))).toEqual(
      Array.from({ length: 12 }, (_, i) => String(i + 1)),
    );
    expect(
      unknownIds(
        Object.values(cal.months).flatMap((m) => m.services),
        KNOWN_SERVICES,
      ),
    ).toEqual([]);
  });

  it('lead-pricing.json uses known services and no (service, grade) pair twice', () => {
    const pricing = loadLeadPricing();
    expect(
      unknownIds(
        pricing.prices.map((p) => p.service_id),
        KNOWN_SERVICES,
      ),
    ).toEqual([]);
    const keys = pricing.prices.map((p) => `${p.service_id}:${p.grade}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gate.json uses the v2 shape keyed by `${Host}:${PageType}` with the contract constants', () => {
    const gate = loadGateConfig();
    expect(Object.keys(gate.pages).length).toBeGreaterThan(0);
    for (const key of Object.keys(gate.pages))
      expect(key, key).toMatch(/^(main|food|construction|admin):[a-z_]+$/);
    expect(gate.hysteresis_ratio).toBe(0.8);
    expect(gate.noindex_grace_days).toBe(30);
  });

  it('ad-slots.json never allows an ad on a NEVER_ADS page or on the admin host', () => {
    const rules = loadAdSlotRules();
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.host, 'admin has no ads').not.toBe('admin');
      for (const pt of rule.page_types) expect(NEVER_ADS, `${rule.host}:${pt}`).not.toContain(pt);
    }
  });

  it('experiments.json variants carry positive weights and ids are unique', () => {
    const experiments = loadExperiments();
    expect(new Set(experiments.map((e) => e.id)).size).toBe(experiments.length);
    for (const e of experiments) {
      expect(e.variants.length, e.id).toBeGreaterThan(0);
      for (const v of e.variants) expect(v.weight, `${e.id}/${v.id}`).toBeGreaterThan(0);
    }
  });

  it('aggregators.json lists each domain once', () => {
    const domains = loadAggregators().map((a) => a.domain);
    expect(new Set(domains).size).toBe(domains.length);
    expect(domains.length).toBeGreaterThan(0);
  });
});

describe('CSV files', () => {
  it('data/demand.csv validates and names only known subjects and localities', () => {
    const rows = loadDemand();
    expect(rows.length).toBeGreaterThan(0);
    const subjects = new Set([...KNOWN_SERVICES, ...KNOWN_DISHES]);
    expect(
      unknownIds(
        rows.map((r) => r.service_or_dish),
        subjects,
      ),
    ).toEqual([]);
    expect(
      unknownIds(
        rows.flatMap((r) => (r.sub_id === null ? [] : [r.sub_id])),
        subjects,
      ),
    ).toEqual([]);
    expect(
      unknownIds(
        rows.map((r) => r.locality_id),
        KNOWN_LOCALITIES,
      ),
    ).toEqual([]);
  });

  it.each(CURATION)(
    'data/curation/%s.csv has exactly the CONTRACTS §6 header and its rows validate',
    (name) => {
      const rel = `data/curation/${name}.csv`;
      expect(parseCsvRecords(readText(rel)).header).toEqual([...CSV_HEADERS[name]]);
      expect(() => loadCuration(name)).not.toThrow();
    },
  );

  it('the CSV headers are the CONTRACTS §6 literals', () => {
    expect([...CSV_HEADERS.places].join(',')).toBe(
      'name,kind,locality_id,address,lat,lng,phone,website,cuisines,diet,price_level,service_modes,opening_hours,tags,source_url,retrieved_at,valid_until',
    );
    expect([...CSV_HEADERS.place_dishes].join(',')).toBe(
      'place_name,locality_id,dish_id,variant_label,price_inr,source_url,retrieved_at,valid_until',
    );
    expect([...CSV_HEADERS.providers].join(',')).toBe(
      'name,locality_id,address,phone,website,services,service_localities,specializations,experience_years,accepts_leads,min_job_inr,source_url,retrieved_at',
    );
    expect([...CSV_HEADERS.experiences].join(',')).toBe(
      'place_name,locality_id,visited_at,dish_id,price_paid_inr,rating,would_recommend,tags,notes',
    );
    expect([...CSV_HEADERS.local_facts].join(',')).toBe(
      'locality_id,topic,services,text,source_url,source_title,publisher,retrieved_at',
    );
    expect([...CSV_HEADERS.demand].join(',')).toBe(
      'service_or_dish,sub_id,locality_id,monthly_searches,est_lead_value_inr,data_ready,source',
    );
  });
});

describe('content/locality-guides/*.md', () => {
  let guides: ReturnType<typeof loadLocalityGuideFiles>;
  beforeAll(() => {
    guides = loadLocalityGuideFiles();
  });

  it('has at least one guide', () => {
    expect(guides.length).toBeGreaterThan(0);
  });

  it('validates each guide, names it after its locality and uses a known locality', () => {
    for (const g of guides) {
      expect(g.file, g.frontmatter.locality_id).toBe(
        `content/locality-guides/${g.frontmatter.locality_id}.md`,
      );
      expect(KNOWN_LOCALITIES.has(g.frontmatter.locality_id), g.file).toBe(true);
      expect(g.body_md.length, g.file).toBeGreaterThan(0);
    }
  });
});

// --- files produced by the parallel data run: validated when present ------------------------------------------

const hasLocalities = fileExists('data/localities.json');
describe('data/localities.json', () => {
  it.skipIf(!hasLocalities)(
    hasLocalities
      ? 'validates and its cross-references hold'
      : 'validates (SKIPPED: data/localities.json not produced yet)',
    () => {
      const localities = loadLocalities();
      const ids = new Set(localities.map((l) => l.id));
      expect(ids.size, 'unique ids').toBe(localities.length);
      expect(unknownIds(LOCALITY_IDS, ids), 'every contract locality is present').toEqual([]);
      const byId = new Map(localities.map((l) => [l.id, l]));
      const problems: string[] = [];
      for (const l of localities) {
        if (l.parent_id !== null && !ids.has(l.parent_id))
          problems.push(`${l.id}: parent ${l.parent_id} missing`);
        for (const n of l.neighbours) {
          const other = byId.get(n);
          if (!other) problems.push(`${l.id}: neighbour ${n} missing`);
          else if (!other.neighbours.includes(l.id))
            problems.push(`${l.id}: neighbour ${n} is not symmetric`);
        }
        for (const fact of [...l.construction_facts, ...l.food_notes]) {
          const unknown = unknownIds(fact.services, KNOWN_SERVICES);
          if (unknown.length) problems.push(`${l.id}/${fact.id}: unknown services ${unknown.join(',')}`);
        }
      }
      expect(problems).toEqual([]);
    },
  );
});

const hasDishes = fileExists('data/dishes.json');
describe('data/dishes.json', () => {
  it.skipIf(!hasDishes)(
    hasDishes
      ? 'validates and its cross-references hold'
      : 'validates (SKIPPED: data/dishes.json not produced yet)',
    () => {
      const dishes = loadDishes();
      const ids = new Set(dishes.map((d) => d.id));
      expect(ids.size, 'unique ids').toBe(dishes.length);
      expect(unknownIds(DISH_IDS, ids), 'every contract dish is present').toEqual([]);
      for (const d of dishes)
        if (d.parent_id !== null) expect(ids.has(d.parent_id), `${d.id}: parent ${d.parent_id}`).toBe(true);
    },
  );
});

const stagingFiles = listFiles('data/sources', '.json').filter((n) => n.startsWith('locality-facts-'));
describe('data/sources/locality-facts-*.json (staging)', () => {
  it.skipIf(stagingFiles.length === 0)(
    stagingFiles.length
      ? `validates ${stagingFiles.join(', ')}`
      : 'validates (SKIPPED: no locality-facts-*.json staged yet)',
    () => {
      const staged = loadLocalityFactsStaging();
      expect(staged.length).toBe(stagingFiles.length);
      const factIds: string[] = [];
      for (const { file, facts } of staged) {
        expect(unknownIds(Object.keys(facts), KNOWN_LOCALITIES), file).toEqual([]);
        for (const list of Object.values(facts)) {
          for (const fact of list) {
            factIds.push(fact.id);
            expect(unknownIds(fact.services, KNOWN_SERVICES), `${file}/${fact.id}`).toEqual([]);
          }
        }
      }
      expect(new Set(factIds).size, 'fact ids are unique across staging files').toBe(factIds.length);
    },
  );
});
