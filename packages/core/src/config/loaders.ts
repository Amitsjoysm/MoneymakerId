// Typed loaders for the curated data (`data/**`, `content/locality-guides/*.md`). Every loader reads the real
// files, validates them with the schemas of @mm/core/schema and returns typed values, or throws a
// `ConfigError` naming the file. Node-only: the loaders read the disk, so they must not run on Workers.
// Builds read reference data from the catalogue snapshot (CONTRACTS §6); these loaders feed
// `DATA_SOURCE=fixtures`, `mm import:reference` and the data tests.
import { z } from 'zod';
import {
  AdSlotRulesFileSchema,
  AggregatorEntrySchema,
  CSV_HEADERS,
  CSV_TEMPLATES,
  DishSchema,
  ExperimentsFileSchema,
  GateConfigSchema,
  LeadPricingSchema,
  LocalityFactsStagingSchema,
  LocalityGuideFrontmatterSchema,
  LocalitySchema,
  SeasonalCalendarSchema,
  TopLevelServiceSchema,
  CostModelSchema,
  isExampleRow,
  type CostModel,
  type Dish,
  type GateConfig,
  type LocalityFactsStaging,
  type LocalityGuide,
  type LocalityGuideFrontmatter,
  type Locality,
  type SeasonalCalendar,
  type ServiceDef,
  type LeadPricing,
  type AdSlotRule,
  type Experiment,
  type AggregatorEntry,
} from '../schema/index.ts';
import { parseCsvRecords } from './csv.ts';
import { ConfigError } from './errors.ts';
import { listFiles, parseWith, readJson, readText, type LoadOptions } from './files.ts';
import { parseFrontmatter } from './frontmatter.ts';

export type { LoadOptions } from './files.ts';

// --- JSON files ----------------------------------------------------------------------------------------------

/** `data/localities.json`. */
export function loadLocalities(opts?: LoadOptions): Locality[] {
  return readJson('data/localities.json', z.array(LocalitySchema), opts);
}

/** `data/dishes.json`. */
export function loadDishes(opts?: LoadOptions): Dish[] {
  return readJson('data/dishes.json', z.array(DishSchema), opts);
}

/** `data/services/*.json`: one top-level service per file, with its sub-services nested. */
export function loadServices(opts?: LoadOptions): ServiceDef[] {
  return listFiles('data/services', '.json', opts).map((name) =>
    readJson(`data/services/${name}`, TopLevelServiceSchema, opts),
  );
}

/** `data/cost-models/*.json`: every file is an array of models; the result is all of them, in file order. */
export function loadCostModels(opts?: LoadOptions): CostModel[] {
  return listFiles('data/cost-models', '.json', opts).flatMap((name) =>
    readJson(`data/cost-models/${name}`, z.array(CostModelSchema), opts),
  );
}

export function loadSeasonalCalendar(opts?: LoadOptions): SeasonalCalendar {
  return readJson('data/seasonal-calendar.json', SeasonalCalendarSchema, opts);
}

export function loadLeadPricing(opts?: LoadOptions): LeadPricing {
  return readJson('data/lead-pricing.json', LeadPricingSchema, opts);
}

export function loadGateConfig(opts?: LoadOptions): GateConfig {
  return readJson('data/gate.json', GateConfigSchema, opts);
}

export function loadAdSlotRules(opts?: LoadOptions): AdSlotRule[] {
  return readJson('data/ad-slots.json', AdSlotRulesFileSchema, opts);
}

export function loadExperiments(opts?: LoadOptions): Experiment[] {
  return readJson('data/experiments.json', ExperimentsFileSchema, opts);
}

export function loadAggregators(opts?: LoadOptions): AggregatorEntry[] {
  return readJson('data/aggregators.json', z.array(AggregatorEntrySchema), opts);
}

/**
 * The staging files `data/sources/locality-facts-*.json` (facts by locality id, merged into the localities
 * later). Returns one entry per file, in file order; an empty list when there are none.
 */
export function loadLocalityFactsStaging(
  opts?: LoadOptions,
): { file: string; facts: LocalityFactsStaging }[] {
  return listFiles('data/sources', '.json', opts)
    .filter((name) => name.startsWith('locality-facts-'))
    .map((name) => {
      const file = `data/sources/${name}`;
      return { file, facts: readJson(file, LocalityFactsStagingSchema, opts) };
    });
}

// --- CSV files -----------------------------------------------------------------------------------------------

type Templates = typeof CSV_TEMPLATES;
export type CsvTemplateName = keyof Templates;
export type CsvRowOf<N extends CsvTemplateName> = z.output<Templates[N]['row']>;

/**
 * Reads a CSV file written to one of the CONTRACTS §6 templates: checks the exact header row, skips rows whose
 * first field starts with `EXAMPLE`, and validates the rest, reporting a failure by file and line.
 */
export function loadCsv<N extends CsvTemplateName>(name: N, rel: string, opts?: LoadOptions): CsvRowOf<N>[] {
  const template = CSV_TEMPLATES[name];
  const { header, records } = parseCsvRecords(readText(rel, opts));
  const expected: readonly string[] = CSV_HEADERS[name];
  if (header.length !== expected.length || header.some((h, i) => h !== expected[i])) {
    throw new ConfigError(
      `${rel}: header row must be exactly\n  ${expected.join(',')}\nbut is\n  ${header.join(',')}`,
      rel,
    );
  }
  const rows: CsvRowOf<N>[] = [];
  for (const record of records) {
    if (isExampleRow(Object.values(record.values))) continue;
    rows.push(parseWith(template.row, record.values, rel, ` line ${record.line}`) as CsvRowOf<N>);
  }
  return rows;
}

/** `data/demand.csv`. */
export function loadDemand(opts?: LoadOptions): CsvRowOf<'demand'>[] {
  return loadCsv('demand', 'data/demand.csv', opts);
}

/** `data/curation/{places,place_dishes,providers,experiences,local_facts}.csv`. */
export function loadCuration<N extends Exclude<CsvTemplateName, 'demand'>>(
  name: N,
  opts?: LoadOptions,
): CsvRowOf<N>[] {
  return loadCsv(name, `data/curation/${name}.csv`, opts);
}

// --- locality guides -----------------------------------------------------------------------------------------

export interface LocalityGuideFile {
  /** Path relative to the repository root. */
  file: string;
  frontmatter: LocalityGuideFrontmatter;
  /** The markdown after the front matter, trimmed. */
  body_md: string;
}

/** `content/locality-guides/*.md`: front matter validated, body untouched. */
export function loadLocalityGuideFiles(opts?: LoadOptions): LocalityGuideFile[] {
  return listFiles('content/locality-guides', '.md', opts).map((name) => {
    const file = `content/locality-guides/${name}`;
    let parsed;
    try {
      parsed = parseFrontmatter(readText(file, opts));
    } catch (e) {
      if (e instanceof ConfigError) throw new ConfigError(`${file}: ${e.message}`, file);
      throw e;
    }
    const frontmatter = parseWith(LocalityGuideFrontmatterSchema, parsed.data, file);
    return { file, frontmatter, body_md: parsed.body.trim() };
  });
}

/** The guides in the shape the catalogue snapshot carries (CONTRACTS §6). */
export function loadLocalityGuides(opts?: LoadOptions): LocalityGuide[] {
  return loadLocalityGuideFiles(opts).map(({ frontmatter, body_md }) => ({
    locality_id: frontmatter.locality_id,
    title: frontmatter.title,
    body_md,
    status: frontmatter.status,
    sources: frontmatter.sources,
  }));
}
