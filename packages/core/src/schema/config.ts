// Gate, ad-slot and experiment configuration (CONTRACTS §8, §9). `data/gate.json`, `data/ad-slots.json` and
// `data/experiments.json` are validated by these schemas. Strict, like every file we author.
import { z } from 'zod';
import { DeviceClassSchema, HostSchema, PageTypeSchema } from './enums.ts';
import { SlugSchema, TimestampSchema, UnitIntervalSchema } from './primitives.ts';

// --- gate (§8) -----------------------------------------------------------------------------------------------

/** `${Host}:${PageType}`, e.g. 'food:locality_hub' (not the same page as 'construction:locality_hub'). */
export const GateKeySchema = z.templateLiteral([HostSchema, ':', PageTypeSchema]);
export type GateKey = z.infer<typeof GateKeySchema>;

export const GatePageRuleSchema = z.strictObject({
  min_entities: z.number().int().nonnegative(),
  min_evidence: z.number().int().nonnegative(),
  min_relevance: UnitIntervalSchema,
  min_unique: UnitIntervalSchema,
  seo_min: UnitIntervalSchema,
  requires_reviewed_prose: z.boolean(),
  /** Page-type specific thresholds, e.g. `min_local_facts`. */
  extra: z.record(z.string(), z.number()),
});
export type GatePageRule = z.infer<typeof GatePageRuleSchema>;

export const GateConfigSchema = z.strictObject({
  pages: z.partialRecord(GateKeySchema, GatePageRuleSchema),
  /** A page that passed stays indexed until its scores fall below this fraction of the thresholds. */
  hysteresis_ratio: z.literal(0.8),
  noindex_grace_days: z.literal(30),
});
export type GateConfig = z.infer<typeof GateConfigSchema>;

export const GateResultSchema = z.strictObject({
  gate_key: GateKeySchema,
  scores: z.strictObject({
    evidence: z.number().nonnegative(),
    entities: z.number().nonnegative(),
    relevance: z.number().nonnegative(),
    unique: z.number().nonnegative(),
    seo: z.number().nonnegative(),
  }),
  passed: z.boolean(),
  reasons: z.array(z.string()),
});
export type GateResult = z.infer<typeof GateResultSchema>;

export const GateActionSchema = z.enum(['build_index', 'build_noindex', 'redirect_parent', 'skip']);
export type GateAction = z.infer<typeof GateActionSchema>;

export const GateDecisionSchema = z.strictObject({
  action: GateActionSchema,
  result: GateResultSchema,
  noindex_since: TimestampSchema.nullable(),
});
export type GateDecision = z.infer<typeof GateDecisionSchema>;

// --- monetisation (§9) ---------------------------------------------------------------------------------------

export const AdSlotIdSchema = z.enum([
  'AD_SLOT_TOP',
  'AD_SLOT_AFTER_INTRO',
  'AD_SLOT_AFTER_RESULTS',
  'AD_SLOT_SIDEBAR',
  'AD_SLOT_BEFORE_FAQ',
  'AD_SLOT_FOOTER',
]);
export type AdSlotId = z.infer<typeof AdSlotIdSchema>;

export const AdSlotRuleSchema = z.strictObject({
  host: HostSchema,
  page_types: z.array(PageTypeSchema),
  slots: z.array(AdSlotIdSchema),
  devices: z.array(DeviceClassSchema),
  provider: z.enum(['adsense', 'sponsorship']),
  enabled: z.boolean(),
});
export type AdSlotRule = z.infer<typeof AdSlotRuleSchema>;

export const ExperimentSchema = z.strictObject({
  id: SlugSchema,
  host: HostSchema,
  page_types: z.array(PageTypeSchema),
  variants: z
    .array(z.strictObject({ id: SlugSchema, weight: z.number().positive(), params: z.record(z.string(), z.unknown()) }))
    .min(1),
  guardrail_metric: z.enum(['quote_submit', 'recommendation_click']),
  active: z.boolean(),
});
export type Experiment = z.infer<typeof ExperimentSchema>;

// The whole-file shapes of data/ad-slots.json and data/experiments.json (gate.json is a GateConfig).
export const AdSlotRulesFileSchema = z.array(AdSlotRuleSchema);
export const ExperimentsFileSchema = z.array(ExperimentSchema);
