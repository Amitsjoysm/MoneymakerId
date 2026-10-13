// Tuning constants owned by C03. These are not CONTRACTS values: the weights, bands and MIN_LABEL_EVIDENCE
// live in @mm/core/constants (§8a) and are imported from there, never restated.

/**
 * How many pseudo-observations the locality prior is worth when shrinking a rating toward it (plan §8:
 * "Bayesian shrinkage toward the locality mean"). With 5, a place with 5 ratings sits halfway between its
 * own mean and the locality mean; one with 50 ratings is 91% its own mean.
 */
export const DEFAULT_PRIOR_WEIGHT = 5;
