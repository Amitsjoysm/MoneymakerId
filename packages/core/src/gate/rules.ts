// The quality gate (CONTRACTS §8, PLAN §5): `evaluateGate` turns one page candidate into build_index,
// build_noindex, redirect_parent or skip. Pure: thresholds come from the GateConfig (data/gate.json), review state
// from the `reviewed` callback, history from the page's entry in the previous manifest.
import { SEO_WEIGHTS } from '../constants/index.ts';
import type {
  GateConfig,
  GateDecision,
  GateKey,
  GateResult,
  ManifestEntry,
  PageCandidate,
} from '../schema/index.ts';
import { uniquenessScore } from './shingles.ts';

const MS_PER_DAY = 86_400_000;
/** Scores are rounded to this many decimals, so the manifest carries no floating-point dust and 0.5 is 0.5. */
const SCORE_DECIMALS = 1e6;
/** Tolerance when comparing a value with `ratio * threshold` (0.8 * 3 is 2.4000000000000004). */
const EPSILON = 1e-9;

const round6 = (n: number): number => Math.round(n * SCORE_DECIMALS) / SCORE_DECIMALS;

export function gateKeyOf(c: Pick<PageCandidate, 'host' | 'page_type'>): GateKey {
  return `${c.host}:${c.page_type}`;
}

/** `seo_score` = Σ SEO_WEIGHTS[k] · seo_inputs[k] (spec §57), rounded to six decimals. */
export function seoScore(inputs: PageCandidate['seo_inputs']): number {
  let total = 0;
  for (const key of Object.keys(SEO_WEIGHTS) as (keyof typeof SEO_WEIGHTS)[]) {
    const value = inputs[key];
    total += SEO_WEIGHTS[key] * (Number.isFinite(value) ? value : 0);
  }
  return round6(total);
}

interface Check {
  /** What is measured: `entities`, `local_facts`, ... For an extra it is the candidate `extra` key. */
  metric: string;
  /** The config key that holds the threshold: `min_entities`, `min_local_facts`, ... */
  name: string;
  value: number;
  min: number;
}

/**
 * Extras where one is enough. PLAN §5 gate path for `{locality}/{service}`: local substance exists when ANY of
 * a sourced locality factor, providers, local facts or real quotes is present. Every other extra is required.
 */
const ANY_OF_EXTRAS: Partial<Record<GateKey, { label: string; names: readonly string[] }>> = {
  'construction:locality_service': {
    label: 'local substance',
    names: ['min_local_facts', 'min_providers', 'min_quotes', 'min_factor_sources'],
  },
};

/** An extra threshold `min_X` in the config is checked against the candidate's `extra.X`. Other keys are ignored. */
const EXTRA_PREFIX = 'min_';

const met = (check: Check, ratio: number): boolean => check.value + EPSILON >= check.min * ratio;

function describe(check: Check): string {
  return `${check.metric} ${check.value} is below ${check.name} ${check.min}`;
}

interface CheckSet {
  required: Check[];
  anyOf: Check[];
  anyOfLabel: string;
}

function checkSet(
  key: GateKey,
  rule: NonNullable<GateConfig['pages'][GateKey]>,
  scores: GateResult['scores'],
  c: PageCandidate,
): CheckSet {
  const required: Check[] = [
    { metric: 'entities', name: 'min_entities', value: scores.entities, min: rule.min_entities },
    { metric: 'evidence', name: 'min_evidence', value: scores.evidence, min: rule.min_evidence },
    { metric: 'relevance', name: 'min_relevance', value: scores.relevance, min: rule.min_relevance },
    { metric: 'unique', name: 'min_unique', value: scores.unique, min: rule.min_unique },
    { metric: 'seo', name: 'seo_min', value: scores.seo, min: rule.seo_min },
  ];
  const group = ANY_OF_EXTRAS[key];
  const anyOf: Check[] = [];
  for (const [name, min] of Object.entries(rule.extra)) {
    if (!name.startsWith(EXTRA_PREFIX)) continue;
    const metric = name.slice(EXTRA_PREFIX.length);
    const check = { metric, name, value: c.extra[metric] ?? 0, min };
    (group?.names.includes(name) ? anyOf : required).push(check);
  }
  return { required, anyOf, anyOfLabel: group?.label ?? '' };
}

/** The checks that fail at `ratio` of every threshold (1 = the publish thresholds). */
function shortfalls(set: CheckSet, ratio: number): string[] {
  const out = set.required.filter((check) => !met(check, ratio)).map(describe);
  if (set.anyOf.length > 0 && !set.anyOf.some((check) => met(check, ratio))) {
    out.push(
      `no ${set.anyOfLabel}: need one of ${set.anyOf.map((c) => `${c.metric} ${c.value}/${c.min}`).join(', ')}`,
    );
  }
  return out;
}

export interface Assessment {
  result: GateResult;
  /** True when the page may stay indexed: prose is reviewed and every score is at least `hysteresis_ratio` of its threshold. */
  stay: boolean;
}

/**
 * Scores a candidate against its GateKey's rule. `result.passed` means "meets the publish thresholds" and does not
 * depend on history; `stay` is the same test at `hysteresis_ratio` of each threshold. A GateKey with no rule in the
 * config is not gated: it passes.
 */
export function assessCandidate(
  c: PageCandidate,
  siblings: readonly PageCandidate[],
  cfg: GateConfig,
  reviewed: (key: string) => boolean,
): Assessment {
  const key = gateKeyOf(c);
  const same = siblings.filter((s) => gateKeyOf(s) === key && !(s.host === c.host && s.url === c.url));
  const scores: GateResult['scores'] = {
    evidence: c.evidence_count,
    entities: c.entity_count,
    relevance: round6(c.relevance),
    unique: round6(uniquenessScore(c, same)),
    seo: seoScore(c.seo_inputs),
  };
  const rule = cfg.pages[key];
  if (rule === undefined) return { result: { gate_key: key, scores, passed: true, reasons: [] }, stay: true };

  const set = checkSet(key, rule, scores, c);
  const reasons = shortfalls(set, 1);
  const unreviewed = rule.requires_reviewed_prose
    ? [...new Set(c.prose_keys)].filter((k) => !reviewed(k))
    : [];
  if (unreviewed.length > 0) reasons.push(`prose not reviewed: ${unreviewed.join(', ')}`);
  const stay = unreviewed.length === 0 && shortfalls(set, cfg.hysteresis_ratio).length === 0;
  return { result: { gate_key: key, scores, passed: reasons.length === 0, reasons }, stay };
}

/**
 * The hysteresis state machine (PLAN §5). `prev` is the page's entry in the previous manifest.
 * - Passes the publish thresholds: build_index.
 * - Was indexed: stays build_index while `stay` holds; otherwise build_noindex, and the clock starts now.
 * - Was build_noindex: keeps its start date; once `noindex_grace_days` have passed, redirect_parent (or skip when
 *   there is no parent). A redirected page keeps redirecting while it fails.
 * - Anything else (new, or skipped before) that fails: skip. A page only gets back into the index by passing the
 *   full thresholds, never the relaxed ones, so it cannot flap inside the band.
 */
export function decide(
  a: Assessment,
  c: Pick<PageCandidate, 'parent_url'>,
  prev: ManifestEntry | null,
  cfg: GateConfig,
  now: Date,
): GateDecision {
  const { result } = a;
  if (result.passed) return { action: 'build_index', result, noindex_since: null };

  if (prev !== null && prev.indexable) {
    if (a.stay) {
      const note = `kept indexed by hysteresis: every score is at least ${Math.round(cfg.hysteresis_ratio * 100)}% of its threshold`;
      return {
        action: 'build_index',
        result: { ...result, reasons: [...result.reasons, note] },
        noindex_since: null,
      };
    }
    return { action: 'build_noindex', result, noindex_since: now.toISOString() };
  }

  if (prev !== null && prev.noindex_since !== null) {
    const since = prev.noindex_since;
    const started = Date.parse(since);
    const elapsed = Number.isFinite(started) ? now.getTime() - started : 0;
    if (elapsed < cfg.noindex_grace_days * MS_PER_DAY)
      return { action: 'build_noindex', result, noindex_since: since };
    if (c.parent_url === null) return { action: 'skip', result, noindex_since: null };
    return { action: 'redirect_parent', result, noindex_since: since };
  }

  return { action: 'skip', result, noindex_since: null };
}

/** CONTRACTS §8: `evaluateGate(c, siblings, prev, cfg, reviewed, now)`. Siblings of another GateKey are ignored. */
export function evaluateGate(
  c: PageCandidate,
  siblings: readonly PageCandidate[],
  prev: ManifestEntry | null,
  cfg: GateConfig,
  reviewed: (key: string) => boolean,
  now: Date,
): GateDecision {
  return decide(assessCandidate(c, siblings, cfg, reviewed), c, prev, cfg, now);
}
