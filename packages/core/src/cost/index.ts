// @mm/core/cost (owner C02): the cost engine behind the calculator and the cost guides.
// Pure and runtime-neutral: models and service presets are passed in; nothing is read, fetched or guessed.
export { estimate, estimateForQuery } from './estimate.ts';
export { selectModel } from './select.ts';
export { resolveQuantity, type ResolvedQuantity } from './quantity.ts';
export { apportion, roundInr, roundUpInr, stepFor } from './money.ts';
export type {
  AreaInput,
  AreaPresetEntry,
  ComponentId,
  CostError,
  CostErrorCode,
  Estimate,
  EstimateComponent,
  EstimateInput,
  EstimateLocality,
  LocalityBasis,
  ModelQuery,
  Outcome,
  ServicePresets,
} from './types.ts';
