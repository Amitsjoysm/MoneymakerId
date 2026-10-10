// Inputs and outputs of the database functions (CONTRACTS §5): the public `api.*` functions and the
// `admin_api.*` functions whose shapes the contract spells out. The rest of the admin functions take a free
// `p` payload that their owner task (T02c) defines next to the SQL.
import { z } from 'zod';
import {
  AskResultSchema,
  AskItemSchema,
  CandidateInputSchema,
  EventAggregateSchema,
  KeyOutcomeSchema,
  ManifestEntrySchema,
  ParsedIntentSchema,
} from './derived.ts';
import { AskVerdictSchema, FeedbackKindSchema, LookupStatusSchema, ProviderSchema } from './enums.ts';
import { SlugSchema, TextSchema, UuidSchema } from './primitives.ts';

export { CatalogueSnapshotSchema as ExportCatalogueResultSchema } from './derived.ts';
export type { CatalogueSnapshot as ExportCatalogueResult } from './derived.ts';

/** `api.submit_lead` takes a `LeadInsert` (derived.ts) and returns this. */
export const SubmitLeadResultSchema = z.strictObject({
  lead_id: UuidSchema,
  ref: TextSchema,
  duplicate_of: UuidSchema.nullable(),
});
export type SubmitLeadResult = z.infer<typeof SubmitLeadResultSchema>;

export const RecordEventsInputSchema = z.strictObject({
  visitor_hmac: TextSchema,
  /** Turnstile-verified, so the visitor counts towards `demand_daily`. */
  verified: z.boolean(),
  events: z.array(EventAggregateSchema),
});
export type RecordEventsInput = z.infer<typeof RecordEventsInputSchema>;

export const SubmitFeedbackInputSchema = z.strictObject({
  page_key: TextSchema,
  entity_id: UuidSchema.nullable(),
  kind: FeedbackKindSchema,
  note: z.string().max(500).nullable(),
  visitor_hmac: TextSchema,
});
export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackInputSchema>;

export const AskSearchInputSchema = z.strictObject({
  intent: ParsedIntentSchema,
  limit: z.number().int().min(1).max(10),
});
export type AskSearchInput = z.infer<typeof AskSearchInputSchema>;
export const AskSearchResultSchema = z.array(AskItemSchema);

export const AskBeginInputSchema = z.strictObject({
  intent_key: TextSchema,
  visitor_hmac: TextSchema,
  want_live: z.boolean(),
});
export type AskBeginInput = z.infer<typeof AskBeginInputSchema>;

export const AskBeginResultSchema = z.strictObject({
  verdict: AskVerdictSchema,
  lookup_id: UuidSchema.nullable(),
  /** Key fingerprints that are currently usable, by provider. */
  usable: z.record(ProviderSchema, z.array(TextSchema)),
});
export type AskBeginResult = z.infer<typeof AskBeginResultSchema>;

export const AskCommitInputSchema = z.strictObject({
  lookup_id: UuidSchema,
  result: AskResultSchema,
  key_outcomes: z.array(KeyOutcomeSchema),
  candidates: z.array(CandidateInputSchema),
});
export type AskCommitInput = z.infer<typeof AskCommitInputSchema>;

export const AskResultOutputSchema = z.strictObject({
  status: LookupStatusSchema,
  result: AskResultSchema.nullable(),
});
export type AskResultOutput = z.infer<typeof AskResultOutputSchema>;

// admin_api.* (service role only) -------------------------------------------------------------------------

export const UpsertBusinessResultSchema = z.strictObject({
  business_id: UuidSchema,
  slug: SlugSchema,
  action: z.enum(['inserted', 'merged', 'queued']),
});
export type UpsertBusinessResult = z.infer<typeof UpsertBusinessResultSchema>;

export const PageBuildsRecordInputSchema = z.strictObject({
  build_id: TextSchema,
  entries: z.array(ManifestEntrySchema),
});
export type PageBuildsRecordInput = z.infer<typeof PageBuildsRecordInputSchema>;
