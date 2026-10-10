// HTTP contracts of the Workers (CONTRACTS §7). Requests come from browsers, so unknown keys are stripped and
// every free-text field is bounded. Every response is `Cache-Control: no-store`; bodies are at most 16 KB
// (enforced by the Workers, not here).
import { z } from 'zod';
import {
  AskItemSchema,
  CitationSchema,
  ParsedIntentSchema,
} from './derived.ts';
import {
  DeviceClassSchema,
  EventNameSchema,
  FeedbackKindSchema,
  LiveStatusSchema,
  LookupStatusSchema,
  PageTypeSchema,
  ReferrerClassSchema,
} from './enums.ts';
import { SlugSchema, UuidSchema } from './primitives.ts';

export {
  LeadAttributionSchema,
  LeadBusinessSchema,
  LeadConsentSchema,
  LeadQuoteSchema,
  LeadSubmissionSchema,
} from './submission.ts';
export type { LeadSubmission } from './submission.ts';

// --- POST /api/lead ------------------------------------------------------------------------------------------

/** 200 `{ ok, ref, duplicate }`, 202 `{ ok, ref, queued }`, and the synthetic-test reply `{ ok, ref, synthetic }`. */
export const LeadResponseSchema = z.union([
  z.object({ ok: z.literal(true), ref: z.string(), duplicate: z.boolean() }),
  z.object({ ok: z.literal(true), ref: z.string(), queued: z.literal(true) }),
  z.object({ ok: z.literal(true), ref: z.string(), synthetic: z.literal(true) }),
]);
export type LeadResponse = z.infer<typeof LeadResponseSchema>;

/** 400. The contract says only `errors`; each entry names a field path and a message the form can show. */
export const LeadErrorResponseSchema = z.object({
  ok: z.literal(false),
  errors: z.array(z.object({ path: z.string(), message: z.string() })),
});
export type LeadErrorResponse = z.infer<typeof LeadErrorResponseSchema>;

// --- POST /api/event -----------------------------------------------------------------------------------------

/** Dimensions are empty strings when they do not apply (they become part of a primary key, §5 `events_daily`). */
export const EventInputSchema = z.object({
  name: EventNameSchema,
  page_type: PageTypeSchema,
  path: z.string().max(512),
  locality_id: z.string().max(64),
  subject_id: z.string().max(64),
  entity_id: z.string().max(64),
  position: z.number().int().nonnegative().max(1000),
  ranking_run_id: z.string().max(64),
  slot: z.string().max(64),
  campaign_id: z.string().max(64),
  variant: z.string().max(64),
  device: DeviceClassSchema,
  referrer_class: ReferrerClassSchema,
  landing_path: z.string().max(512).nullable(),
  lcp_ms: z.number().int().nonnegative().nullable(),
});
export type EventInput = z.infer<typeof EventInputSchema>;

export const EventRequestSchema = z.object({ events: z.array(EventInputSchema).min(1).max(20) });
export type EventRequest = z.infer<typeof EventRequestSchema>;

// --- POST /api/feedback --------------------------------------------------------------------------------------

export const FeedbackRequestSchema = z.object({
  page_key: z.string().min(1).max(200),
  entity_id: UuidSchema.nullable(),
  kind: FeedbackKindSchema,
  note: z.string().max(500).nullable(),
  turnstile_token: z.string().max(2048).nullable(),
});
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;

// --- POST /api/ask and GET /api/ask/result -------------------------------------------------------------------

export const AskRequestSchema = z.object({
  q: z.string().min(2).max(200),
  locality_id: SlugSchema.nullable(),
  turnstile_token: z.string().max(2048).nullable(),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

export const AskResponseSchema = z.object({
  intent: ParsedIntentSchema,
  results: z.array(AskItemSchema),
  served_from: z.enum(['cache', 'db']),
  live: z.object({ status: LiveStatusSchema, lookup_id: UuidSchema.nullable() }),
});
export type AskResponse = z.infer<typeof AskResponseSchema>;

export const AskResultResponseSchema = z.object({
  status: LookupStatusSchema,
  results: z.array(AskItemSchema),
  citations: z.array(CitationSchema),
});
export type AskResultResponse = z.infer<typeof AskResultResponseSchema>;

// --- deploy.yml workflow_dispatch inputs ---------------------------------------------------------------------

export const DeployDispatchInputsSchema = z.object({
  reason: z.string().min(1).max(200),
  override_shrinkage: z.boolean(),
});
export type DeployDispatchInputs = z.infer<typeof DeployDispatchInputsSchema>;
