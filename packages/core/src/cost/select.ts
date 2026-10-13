// Picks the one cost model a calculator choice refers to: service × tier, then scope and material.
// It never interpolates and never falls back to another tier, scope or material.
import { TierSchema, type CostModel } from '../schema/index.ts';
import type { ModelQuery, Outcome } from './types.ts';

const TIER_ORDER = TierSchema.options;

/**
 * - No model for the service at the tier: `no_data_for_tier` (lists the tiers that do exist).
 * - A scope or material that was chosen must equal the model's. A model with a null scope or material is not
 *   assumed to cover a scope or material the caller named: that is `no_matching_model`.
 * - A scope or material left open fits any model. If several fit, those that are null on every open dimension
 *   win; when that still leaves more than one, the result is `ambiguous_model` (the caller must ask).
 */
export function selectModel(models: readonly CostModel[], query: ModelQuery): Outcome<CostModel> {
  const forService = models.filter((m) => m.service_id === query.service_id);
  const atTier = forService.filter((m) => m.tier === query.tier);
  if (atTier.length === 0) {
    return {
      ok: false,
      error: {
        code: 'no_data_for_tier',
        service_id: query.service_id,
        tier: query.tier,
        available_tiers: TIER_ORDER.filter((tier) => forService.some((m) => m.tier === tier)),
      },
    };
  }

  const scope = query.scope_id ?? null;
  const material = query.material_id ?? null;
  const fits = atTier.filter(
    (m) => (scope === null || m.scope_id === scope) && (material === null || m.material_id === material),
  );
  if (fits.length === 0) {
    return {
      ok: false,
      error: {
        code: 'no_matching_model',
        service_id: query.service_id,
        tier: query.tier,
        scope_id: scope,
        material_id: material,
        candidate_ids: atTier.map((m) => m.id),
      },
    };
  }
  if (fits.length === 1) return { ok: true, value: fits[0]! };

  const generic = fits.filter(
    (m) => (scope !== null || m.scope_id === null) && (material !== null || m.material_id === null),
  );
  if (generic.length === 1) return { ok: true, value: generic[0]! };
  return {
    ok: false,
    error: {
      code: 'ambiguous_model',
      service_id: query.service_id,
      tier: query.tier,
      candidate_ids: (generic.length > 0 ? generic : fits).map((m) => m.id),
    },
  };
}
