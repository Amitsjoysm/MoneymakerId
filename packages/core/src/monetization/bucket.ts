// Per-tab experiment bucketing. A tab is hashed with the experiment id (FNV-1a, 32 bit, over the UTF-8 bytes of
// `experimentId:tabId`, then one murmur3 finalizer round) and the hash picks a variant by cumulative weight.
// Nothing is stored and nothing is random, so a tab sees the same variant on every page and every run, and
// different experiments split the same tabs independently. Pure: no clock, no storage, no network.
//
// The finalizer is there because plain FNV-1a keeps structure from near-identical inputs: over 10,000 counter-like
// ids ("tab-0", "tab-1", ...) a 20% arm came out up to 4 points off. Real tab ids are random UUIDs, but bucketing
// should not depend on that.
import type { Host, PageType } from '../schema/index.ts';

/** The part of an `Experiment` variant that bucketing reads. */
export interface WeightedVariant {
  id: string;
  weight: number;
}

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const UINT32_RANGE = 2 ** 32;

/** FNV-1a, 32 bit, over the UTF-8 bytes of `text`. Returns an unsigned 32-bit integer. */
export function fnv1a32(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of new TextEncoder().encode(text)) {
    hash = Math.imul(hash ^ byte, FNV_PRIME);
  }
  return hash >>> 0;
}

/** The murmur3 32-bit finalizer: every input bit affects every output bit, so close inputs land far apart. */
function mix32(hash: number): number {
  let h = hash;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** The control: the first variant. Throws a `RangeError` for an empty list (the schema requires at least one). */
function controlOf<V>(experimentId: string, variants: readonly V[]): V {
  const control = variants[0];
  if (control === undefined) throw new RangeError(`experiment "${experimentId}" has no variants`);
  return control;
}

/** A weight that can take part in the split: finite and positive. Anything else counts as 0. */
const usable = (weight: number): number => (Number.isFinite(weight) && weight > 0 ? weight : 0);

/**
 * The variant this tab belongs to. Weights are relative (1 and 3 split 25/75); a variant with no usable weight is
 * never chosen, and if none has one the control (the first variant) is returned. The result is one of the objects
 * in `variants`. Throws a `RangeError` for an empty list.
 */
export function bucket<V extends WeightedVariant>(
  experimentId: string,
  tabId: string,
  variants: readonly V[],
): V {
  const control = controlOf(experimentId, variants);

  const total = variants.reduce((sum, v) => sum + usable(v.weight), 0);
  if (total === 0) return control;

  const point = (mix32(fnv1a32(`${experimentId}:${tabId}`)) / UINT32_RANGE) * total; // [0, total)
  let upTo = 0;
  let last = control;
  for (const variant of variants) {
    const weight = usable(variant.weight);
    if (weight === 0) continue;
    upTo += weight;
    last = variant;
    if (point < upTo) return variant;
  }
  return last; // floating-point rounding at the very top of the range
}

/** Where a tab is when it asks which variant to show. */
export interface ExperimentContext {
  tabId: string;
  host: Host;
  pageType: PageType;
}

/** The part of an `Experiment` that `assignVariant` reads. */
export interface ExperimentLike<V extends WeightedVariant> {
  id: string;
  host: Host;
  page_types: readonly PageType[];
  variants: readonly V[];
  active: boolean;
}

/**
 * The variant to show on this page. An experiment that is inactive, or that does not run on this host and page
 * type, shows the control (the first variant) to everyone; otherwise the tab is bucketed. A list of page types
 * that is empty matches no page.
 */
export function assignVariant<V extends WeightedVariant>(
  experiment: ExperimentLike<V>,
  context: ExperimentContext,
): V {
  const runsHere =
    experiment.active && experiment.host === context.host && experiment.page_types.includes(context.pageType);
  return runsHere
    ? bucket(experiment.id, context.tabId, experiment.variants)
    : controlOf(experiment.id, experiment.variants);
}
