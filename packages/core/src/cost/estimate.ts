// The cost engine: one cost model + a quantity (a preset or the user's own) + a locality
// -> low / expected / high for the whole job, split into components, with the model's minimum job floor applied.
// Pure and runtime-neutral (Node and Workers): the models come in as arguments. No fetching, no AI, no guessing.
import { COST_DISCLAIMER } from '../constants/index.ts';
import type { CostModel } from '../schema/index.ts';
import { apportion, roundInr, roundUpInr, stepFor } from './money.ts';
import { resolveQuantity } from './quantity.ts';
import { selectModel } from './select.ts';
import type {
  ComponentId,
  Estimate,
  EstimateComponent,
  EstimateInput,
  EstimateLocality,
  ModelQuery,
  Outcome,
} from './types.ts';

/** The fixed order and wording of the components. */
const COMPONENT_LABELS: Record<ComponentId, string> = {
  materials: 'Materials',
  labour: 'Labour',
  preparation: 'Preparation',
  repair: 'Repair',
  transport: 'Transport',
  waste: 'Waste',
};
const COMPONENT_IDS = Object.keys(COMPONENT_LABELS) as ComponentId[];

/**
 * 1 unless the model carries a cited factor for the locality (CONTRACTS §4). A factor is never invented:
 * `basis` says whether the factor is `sourced`, or 1 because none was asked for or none is sourced.
 */
function resolveLocality(model: CostModel, localityId: string | null | undefined): EstimateLocality {
  if (!localityId) return { locality_id: null, factor: 1, basis: 'not_requested', sources: [] };
  const entry = model.locality_factors.find((f) => f.locality_id === localityId);
  if (!entry) return { locality_id: localityId, factor: 1, basis: 'no_sourced_factor', sources: [] };
  return {
    locality_id: localityId,
    factor: entry.factor,
    basis: 'sourced',
    sources: entry.sources.map((s) => ({ ...s })),
  };
}

/**
 * Estimates one model.
 *
 * - total = per-unit rate × quantity × locality factor, for each of low, expected and high;
 * - each total is rounded to the nearest INR 100 from INR 10,000 and to INR 10 below (`roundInr`);
 * - the minimum job charge, when the model has one, is a floor on each figure. It is rounded up to the
 *   same grid so a figure is never below it; `floor_applied` is true when it raised any figure;
 * - `low <= expected <= high` holds, and each figure is monotone non-decreasing in the quantity.
 *
 * The model must have passed `CostModelSchema` (ordered rate range, positive factors).
 */
export function estimate(model: CostModel, input: EstimateInput): Outcome<Estimate> {
  const { service } = input;
  if (service && service.unit !== model.unit) {
    return {
      ok: false,
      error: { code: 'unit_mismatch', model_unit: model.unit, service_unit: service.unit },
    };
  }
  const resolved = resolveQuantity(input.area, service);
  if (!resolved.ok) return resolved;
  const { quantity, source, preset } = resolved.value;

  const locality = resolveLocality(model, input.locality_id);
  const rate = model.rate_inr;
  const raw = {
    low: rate.low * quantity * locality.factor,
    expected: rate.expected * quantity * locality.factor,
    high: rate.high * quantity * locality.factor,
  };
  // A total that is infinite, or too large to be an exact integer, is an input error, not a number to show.
  if (!Number.isFinite(raw.high) || roundInr(raw.high) > Number.MAX_SAFE_INTEGER) {
    return { ok: false, error: { code: 'invalid_quantity', reason: 'out_of_range' } };
  }

  const floor = model.min_job_inr === null ? 0 : roundUpInr(model.min_job_inr);
  const rounded = { low: roundInr(raw.low), expected: roundInr(raw.expected), high: roundInr(raw.high) };
  const total = {
    low: Math.max(rounded.low, floor),
    expected: Math.max(rounded.expected, floor),
    high: Math.max(rounded.high, floor),
  };

  const shares = COMPONENT_IDS.map((id) => model.components[id]);
  const split = {
    low: apportion(total.low, shares, stepFor(total.low)),
    expected: apportion(total.expected, shares, stepFor(total.expected)),
    high: apportion(total.high, shares, stepFor(total.high)),
  };
  const components: EstimateComponent[] = COMPONENT_IDS.map((id, i) => ({
    id,
    label: COMPONENT_LABELS[id],
    low: split.low[i]!,
    expected: split.expected[i]!,
    high: split.high[i]!,
  }));

  return {
    ok: true,
    value: {
      ...total,
      unit: model.unit,
      quantity,
      quantity_source: source,
      preset,
      components,
      floor_applied:
        total.low > rounded.low || total.expected > rounded.expected || total.high > rounded.high,
      min_job_inr: model.min_job_inr,
      locality,
      model: {
        id: model.id,
        service_id: model.service_id,
        scope_id: model.scope_id,
        material_id: model.material_id,
        tier: model.tier,
        reviewed_at: model.reviewed_at,
        valid_until: model.valid_until,
        status: model.status,
      },
      sources: model.sources.map((s) => ({ ...s })),
      disclaimer: COST_DISCLAIMER,
    },
  };
}

/** Selects the model for a calculator choice (`selectModel`), then estimates it. Selection errors pass through. */
export function estimateForQuery(
  models: readonly CostModel[],
  query: ModelQuery,
  input: EstimateInput,
): Outcome<Estimate> {
  const selected = selectModel(models, query);
  return selected.ok ? estimate(selected.value, input) : selected;
}
