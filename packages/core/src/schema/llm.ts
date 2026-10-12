// LLM-facing schemas (CONTRACTS §1 Nullability, §6a). Groq strict mode needs every property present, so an
// optional value is `.nullable()` and never `.optional()`; the exported JSON schemas are checked for that in
// llm.test.ts. These shapes are what the model emits. Mapping them onto `Claim`, `BusinessUpsert` and
// `EvidenceInsert` (with grounding and validation) is the extractor's job (P02b), not the schema's.
import { z } from 'zod';
import {
  BusinessKindSchema,
  ClaimTypeSchema,
  CostUnitSchema,
  CravingSchema,
  DietSchema,
  SentimentSchema,
} from './enums.ts';
import { toStrictJsonSchema, type JsonSchema } from './json-schema.ts';

/** The model never emits `locality_fact` or `cost_rate`: those are curated, not extracted. */
export const LlmClaimTypeSchema = ClaimTypeSchema.exclude(['locality_fact', 'cost_rate']);
export type LlmClaimType = z.infer<typeof LlmClaimTypeSchema>;

/**
 * One claim about a business, in a flat shape. Only the fields that fit `claim_type` are filled; the rest are
 * null. `text` carries the free text of hours, offer, availability, address and phone claims.
 */
export const LlmClaimSchema = z.strictObject({
  claim_type: LlmClaimTypeSchema,
  supporting_quote: z.string().describe('The exact words from the source that support this claim.'),
  dish_id: z.string().nullable().describe('A dish id from the reference list, or null.'),
  variant_label: z.string().nullable().describe('The dish variant as the source names it, or null.'),
  service_id: z.string().nullable().describe('A service id from the reference list, or null.'),
  price_inr: z.number().nullable().describe('Price in whole rupees, or null.'),
  price_unit: z
    .enum([...CostUnitSchema.options, 'serving'])
    .nullable()
    .describe('The unit the price applies to, or null.'),
  rating_value: z.number().nullable().describe('A rating the source states, or null.'),
  rating_scale: z.number().nullable().describe('The top of that rating scale (for example 5), or null.'),
  sentiment: SentimentSchema.nullable().describe('For a mention only, or null.'),
  text: z
    .string()
    .nullable()
    .describe('Free text for hours, offer, availability, address and phone claims, or null.'),
  ends_on: z.string().nullable().describe('When an offer ends, as YYYY-MM-DD, or null.'),
});
export type LlmClaim = z.infer<typeof LlmClaimSchema>;

/** A business found in a source, with the claims the source supports. */
export const LlmEntitySchema = z.strictObject({
  name: z.string().describe('The business name as the source writes it.'),
  kind: BusinessKindSchema,
  locality_id: z.string().nullable().describe('A locality id from the reference list, or null if unclear.'),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  chain_hint: z.string().nullable().describe('The chain name when this is a branch of one, or null.'),
  branch_key: z.string().nullable().describe('What tells this branch apart from the chain, or null.'),
  claims: z.array(LlmClaimSchema),
});
export type LlmEntity = z.infer<typeof LlmEntitySchema>;

/** The reply to one extraction call. */
export const LlmExtractionSchema = z.strictObject({ entities: z.array(LlmEntitySchema) });
export type LlmExtraction = z.infer<typeof LlmExtractionSchema>;

/** The reply to a free-text Ask question: `ParsedIntent` minus the fields the code computes (`intent_key`). */
export const LlmIntentSchema = z.strictObject({
  vertical: z.enum(['food', 'construction']),
  subject_id: z.string().nullable().describe('A dish or service id from the reference list, or null.'),
  craving: CravingSchema.nullable(),
  locality_id: z.string().nullable().describe('A locality id from the reference list, or null.'),
  budget_inr: z.number().nullable().describe('A per-person or total budget in whole rupees, or null.'),
  diet: DietSchema.nullable(),
  open_now: z.boolean(),
  confidence: z.number().describe('0 to 1: how sure you are of this reading.'),
});
export type LlmIntent = z.infer<typeof LlmIntentSchema>;

/** Every schema the model is asked to fill, by the name used in its JSON-schema export. */
export const LLM_SCHEMAS = {
  LlmClaim: LlmClaimSchema,
  LlmEntity: LlmEntitySchema,
  LlmExtraction: LlmExtractionSchema,
  LlmIntent: LlmIntentSchema,
} as const;

/** The strict-mode JSON schema for each entry of `LLM_SCHEMAS`. */
export function exportLlmJsonSchemas(): Record<string, JsonSchema> {
  return Object.fromEntries(
    Object.entries(LLM_SCHEMAS).map(([name, schema]) => [name, toStrictJsonSchema(schema)]),
  );
}
