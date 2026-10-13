// Types of the cost engine (@mm/core/cost). Pure data shapes: the engine reads a validated `CostModel`
// (CONTRACTS §4) and returns an `Estimate` or a typed `CostError`. Nothing here is a contract enum; the
// enums come from @mm/core/schema.
import type { AreaPreset, CostModel, CostUnit, ServiceDef, SourceRef, Tier } from '../schema/index.ts';

/** One `area_presets` entry of a `ServiceDef`: the quantity a preset stands for, with its assumption and sources. */
export type AreaPresetEntry = ServiceDef['area_presets'][number];

/** The part of a `ServiceDef` the engine needs to resolve a preset. */
export interface ServicePresets {
  unit: CostUnit;
  /** May be empty: the preset path then returns `preset_unavailable` and the caller asks for a quantity. */
  area_presets: readonly AreaPresetEntry[];
}

/**
 * Where the quantity comes from. Shaped like `LeadSubmission.quote.area` (CONTRACTS §7).
 * `custom` uses `quantity`. Any other preset uses the service's preset entry and ignores `quantity`.
 */
export interface AreaInput {
  preset: AreaPreset;
  quantity?: number | null;
}

export interface EstimateInput {
  area: AreaInput;
  /**
   * The `ServiceDef` whose id is the model's `service_id` (a sub-service's own def, not its parent's: presets differ).
   * Needed for preset areas; its unit must equal the model's.
   */
  service?: ServicePresets | null;
  /** When omitted, or when the model has no sourced factor for it, the factor is 1 and the result says so. */
  locality_id?: string | null;
}

/** Picks one model. `scope_id` and `material_id` left out (or `null`) mean "not chosen". */
export interface ModelQuery {
  service_id: string;
  tier: Tier;
  scope_id?: string | null;
  material_id?: string | null;
}

export type ComponentId = keyof CostModel['components'];

/** A share of one figure. For each of low, expected and high, the components sum exactly to that figure. */
export interface EstimateComponent {
  id: ComponentId;
  label: string;
  low: number;
  expected: number;
  high: number;
}

export type LocalityBasis = 'not_requested' | 'no_sourced_factor' | 'sourced';

export interface EstimateLocality {
  locality_id: string | null;
  factor: number;
  /** `sourced` only when the model carries a cited factor for the locality; otherwise the factor is 1. */
  basis: LocalityBasis;
  sources: SourceRef[];
}

export interface Estimate {
  /** Integer INR for the whole job, rounded (see `roundInr`). Always `low <= expected <= high`. */
  low: number;
  expected: number;
  high: number;
  unit: CostUnit;
  quantity: number;
  quantity_source: 'preset' | 'explicit';
  /** The preset entry used (with its assumption and sources), or `null` for an explicit quantity. */
  preset: AreaPresetEntry | null;
  components: EstimateComponent[];
  /** True when the model's minimum job charge raised at least one of low, expected and high. */
  floor_applied: boolean;
  min_job_inr: number | null;
  locality: EstimateLocality;
  model: {
    id: string;
    service_id: string;
    scope_id: string | null;
    material_id: string | null;
    tier: Tier;
    reviewed_at: string;
    valid_until: string;
    status: CostModel['status'];
  };
  sources: SourceRef[];
  /** `COST_DISCLAIMER` (CONTRACTS §9): shown with every estimate. */
  disclaimer: string;
}

export type CostError =
  /** The service has no model at this tier. Never filled by interpolation. */
  | { code: 'no_data_for_tier'; service_id: string; tier: Tier; available_tiers: Tier[] }
  /** The tier has models, but none for the requested scope and material. */
  | {
      code: 'no_matching_model';
      service_id: string;
      tier: Tier;
      scope_id: string | null;
      material_id: string | null;
      candidate_ids: string[];
    }
  /** More than one model fits and none is more specific: the caller must ask for a scope or material. */
  | { code: 'ambiguous_model'; service_id: string; tier: Tier; candidate_ids: string[] }
  /** The preset is not among the service's presets (an empty list included). `available_presets` may be `[]`. */
  | { code: 'preset_unavailable'; preset: AreaPreset; available_presets: AreaPreset[] }
  | { code: 'invalid_quantity'; reason: 'missing' | 'not_positive_finite' | 'out_of_range' }
  /** The service passed with the input counts in a different unit from the model. */
  | { code: 'unit_mismatch'; model_unit: CostUnit; service_unit: CostUnit };

export type CostErrorCode = CostError['code'];

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: CostError };
