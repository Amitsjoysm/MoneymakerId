// The six inputs of `seo_score` (spec §57), each a 0-1 number. `seoScore` in rules.ts applies the SEO_WEIGHTS.
// Everything here is derived from the snapshot; nothing is invented. The few constants below are tuning knobs for
// how much a page type is worth commercially and how much text counts as "deep"; they are not claims about the world.
import { CLAIM_TIER, TIER_TTL_DAYS } from '../constants/index.ts';
import type { CatalogueSnapshot, EvidenceView, GateKey, PageCandidate } from '../schema/index.ts';
import { DAY_MS } from './catalogue.ts';
import { wordCount } from './text.ts';

export const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** `value` as a share of `full`, capped at 1. */
export const fill = (value: number, full: number): number => (full > 0 ? clamp01(value / full) : 0);

/** The mean fill of several (value, full) pairs. */
export function meanFill(pairs: readonly (readonly [number, number])[]): number {
  if (pairs.length === 0) return 0;
  return pairs.reduce((sum, [value, full]) => sum + fill(value, full), 0) / pairs.length;
}

/** How likely a visitor on this page type is to want to hire or buy (construction leads first, spec §57). */
export const COMMERCIAL_INTENT: Partial<Record<GateKey, number>> = {
  'construction:locality_service': 1,
  'construction:service_cost': 0.9,
  'construction:service_city': 0.9,
  'construction:locality_hub': 0.6,
  'food:dish_locality': 0.7,
  'food:food_intent': 0.7,
  'food:locality_food_intent': 0.6,
  'food:dish_city': 0.5,
  'food:locality_hub': 0.4,
  'main:locality_guide': 0.2,
};

/** Words at which a page of this type counts as fully deep (content_depth = 1). */
export const DEPTH_FULL_WORDS: Partial<Record<GateKey, number>> = {
  'construction:service_cost': 300,
  'construction:service_city': 60,
  'construction:locality_hub': 120,
  'construction:locality_service': 150,
  'food:dish_locality': 100,
  'food:food_intent': 80,
  'food:locality_food_intent': 80,
  'food:dish_city': 120,
  'food:locality_hub': 100,
  'main:locality_guide': 800,
};
const DEFAULT_DEPTH_WORDS = 100;

/** Demand from `snapshot.demand`, as a share of the largest demand score in the snapshot (0 when there is none). */
export interface DemandIndex {
  /** The strongest row for any of `subjects`; with a locality only that locality's row counts, else any locality's. */
  subjects: (subjects: readonly string[], localityId: string | null) => number;
  /** The strongest row of any subject in this locality. */
  locality: (localityId: string) => number;
}

export function demandIndex(rows: CatalogueSnapshot['demand']): DemandIndex {
  const top = rows.reduce((max, row) => Math.max(max, row.score), 0);
  const share = (best: number): number => (top > 0 ? clamp01(best / top) : 0);
  return {
    subjects: (subjects, localityId) =>
      share(
        rows
          .filter(
            (r) => subjects.includes(r.subject_id) && (localityId === null || r.locality_id === localityId),
          )
          .reduce((max, r) => Math.max(max, r.score), 0),
      ),
    locality: (localityId) =>
      share(rows.filter((r) => r.locality_id === localityId).reduce((max, r) => Math.max(max, r.score), 0)),
  };
}

/** The mean remaining share of life of dated items: 1 when new, 0 when `ttlDays` old or older (or undated). */
export function ageFreshness(dates: readonly string[], ttlDays: number, now: Date): number {
  if (dates.length === 0) return 0;
  let sum = 0;
  for (const date of dates) {
    const ageDays = (now.getTime() - Date.parse(date)) / DAY_MS;
    sum += Number.isFinite(ageDays) ? clamp01(1 - ageDays / ttlDays) : 0;
  }
  return sum / dates.length;
}

/** The mean remaining share of the validity of evidence rows, each against the TTL of its claim's tier. */
export function rowFreshness(rows: readonly EvidenceView[], now: Date): number {
  if (rows.length === 0) return 0;
  let sum = 0;
  for (const row of rows) {
    const ttl = TIER_TTL_DAYS[CLAIM_TIER[row.claim_type]];
    const endsAt =
      row.valid_until !== null ? Date.parse(row.valid_until) : Date.parse(row.retrieved_at) + ttl * DAY_MS;
    sum += clamp01((endsAt - now.getTime()) / (ttl * DAY_MS));
  }
  return sum / rows.length;
}

/** The mean remaining share of a cost model's validity: `valid_until` against the COST tier's TTL. */
export function modelFreshness(validUntil: readonly string[], now: Date): number {
  if (validUntil.length === 0) return 0;
  const ttl = TIER_TTL_DAYS.COST;
  const sum = validUntil.reduce(
    (acc, date) => acc + clamp01((Date.parse(date) - now.getTime()) / (ttl * DAY_MS)),
    0,
  );
  return sum / validUntil.length;
}

/** The mean of the parts that exist (a part with no data is left out, not counted as 0). */
export function meanOf(parts: readonly (number | null)[]): number {
  const present = parts.filter((p): p is number => p !== null);
  return present.length === 0 ? 0 : present.reduce((a, b) => a + b, 0) / present.length;
}

export interface SeoParts {
  key: GateKey;
  demand: number;
  data_quality: number;
  /** True for a page about one locality. */
  local: boolean;
  freshness: number;
  /** The page's main text, for content_depth. */
  text: string;
}

export function seoInputs(p: SeoParts): PageCandidate['seo_inputs'] {
  return {
    demand: clamp01(p.demand),
    data_quality: clamp01(p.data_quality),
    locality_specificity: p.local ? 1 : 0,
    commercial_intent: COMMERCIAL_INTENT[p.key] ?? 0,
    content_depth: fill(wordCount(p.text), DEPTH_FULL_WORDS[p.key] ?? DEFAULT_DEPTH_WORDS),
    freshness: clamp01(p.freshness),
  };
}
