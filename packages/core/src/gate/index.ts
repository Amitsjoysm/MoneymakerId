// @mm/core/gate (owner C04): the quality gate and the build manifest (CONTRACTS §6, §8, plan §5).
export { evaluateGate, gateKeyOf, seoScore } from './rules.ts';
export { buildManifest, manifestAction } from './manifest.ts';
export { enumerateCandidates } from './candidates.ts';
export { proseReviewed } from './prose.ts';
export { canonicalJson, contentHash } from './hash.ts';
export { BUDGET_FOOD_MAX_INR } from './food.ts';
