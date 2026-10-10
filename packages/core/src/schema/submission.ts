// The `POST /api/lead` request body (CONTRACTS §7). It lives apart from http.ts because both http.ts
// (responses that reuse Ask shapes from derived.ts) and derived.ts (`LeadInsert`) build on it.
//
// This is untrusted input from a browser, so unknown keys are stripped, not rejected, and text fields are
// bounded. Which of `quote` / `business` / `message` a `lead_type` needs is decided by the Worker (E02).
import { z } from 'zod';
import {
  AreaPresetSchema,
  LeadTypeSchema,
  OwnershipSchema,
  PageTypeSchema,
  PropertyTypeSchema,
  ReferrerClassSchema,
  TierSchema,
  TimelineSchema,
} from './enums.ts';
import { InrSchema, SlugSchema, UuidSchema } from './primitives.ts';

const trimmed = (max: number) => z.string().trim().max(max);

export const LeadConsentSchema = z.object({
  /** Version id of the consent text the visitor saw (see CONSENT_VERSIONS in @mm/core/constants). */
  version: trimmed(64).min(1),
  accepted: z.literal(true),
});

export const LeadQuoteSchema = z.object({
  service_id: SlugSchema,
  locality_id: SlugSchema,
  property_type: PropertyTypeSchema,
  ownership: OwnershipSchema,
  timeline: TimelineSchema,
  area: z.object({ preset: AreaPresetSchema, quantity: z.number().positive().max(10_000_000).nullable() }),
  tier: TierSchema.nullable(),
  estimate: z.object({ low: InrSchema, expected: InrSchema, high: InrSchema }).nullable(),
  requested_provider_id: UuidSchema.nullable(),
  notes: trimmed(500).nullable(),
});

export const LeadBusinessSchema = z.object({
  business_name: trimmed(120).min(1),
  category: trimmed(80).min(1),
  locality_id: SlugSchema,
  website: trimmed(300).nullable(),
  whatsapp: trimmed(32).nullable(),
  email: z.email().max(200).nullable(),
  description: trimmed(1000).nullable(),
  services: z.array(SlugSchema).max(20),
  preferred_placement: trimmed(80).nullable(),
});

export const LeadAttributionSchema = z.object({
  landing_path: trimmed(512),
  page_type: PageTypeSchema,
  referrer_class: ReferrerClassSchema,
  utm_source: trimmed(100).nullable(),
  utm_medium: trimmed(100).nullable(),
  utm_campaign: trimmed(100).nullable(),
  ranking_run_id: trimmed(64).nullable(),
  /** The code printed in the prefilled WhatsApp text, e.g. `C-WAKAD-WP`. */
  ref_code: trimmed(64).min(1),
  variant: trimmed(64).nullable(),
});

export const LeadSubmissionSchema = z.object({
  lead_type: LeadTypeSchema,
  idempotency_key: UuidSchema,
  turnstile_token: z.string().min(1).max(2048),
  consent: LeadConsentSchema,
  name: trimmed(80).min(1),
  /** As typed. The Worker normalises it to E.164 (`phone_e164`). */
  phone: trimmed(32).min(1),
  quote: LeadQuoteSchema.nullable(),
  business: LeadBusinessSchema.nullable(),
  message: trimmed(1000).nullable(),
  attribution: LeadAttributionSchema,
});
export type LeadSubmission = z.infer<typeof LeadSubmissionSchema>;
