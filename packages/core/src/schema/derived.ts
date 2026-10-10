// Derived shapes (CONTRACTS §6 and §6a): the catalogue snapshot, build manifest, leads, evidence, views and
// the candidate shapes passed between @mm/core functions.
//
// Objects here are strict. Views feed the public snapshot, so a stray column (a phone number, a lead field)
// fails parsing instead of being published. Request bodies from the outside world are in http.ts and strip
// unknown keys instead.
import { z } from 'zod';
import { FOOD_WEIGHTS, HOT_WEIGHTS, PROVIDER_WEIGHTS, SEO_WEIGHTS } from '../constants/weights.ts';
import { addIssue, CostModelSchema, LocalFactSchema, LocalityGuideSchema, LocalitySchema, DishSchema, ServiceDefSchema } from './data.ts';
import {
  ActorSchema,
  BadgeLabelSchema,
  BusinessKindSchema,
  BusinessStatusSchema,
  CampaignKindSchema,
  ClaimTypeSchema,
  CostUnitSchema,
  CravingSchema,
  DeviceClassSchema,
  DietSchema,
  EventNameSchema,
  EvidenceEntityTypeSchema,
  EvidenceStatusSchema,
  FreshnessTierSchema,
  HostSchema,
  KeyOutcomeKindSchema,
  LeadGradeSchema,
  LeadStatusSchema,
  ListingTierSchema,
  LocaleSchema,
  PageTypeSchema,
  ProseStatusSchema,
  ProviderSchema,
  ReferrerClassSchema,
  SalesStageSchema,
  SentimentSchema,
  ServedFromSchema,
  ServiceModeSchema,
  SourceKindSchema,
  TempLabelSchema,
  TrustLabelSchema,
  VerificationStatusSchema,
  WeekdaySchema,
} from './enums.ts';
import { GateResultSchema } from './config.ts';
import { LeadSubmissionSchema } from './submission.ts';
import {
  ClockTimeSchema,
  DateOrTimestampSchema,
  GeoSchema,
  HttpUrlSchema,
  InrSchema,
  IsoDateSchema,
  PhoneE164Schema,
  SlugSchema,
  TextSchema,
  TimestampSchema,
  UnitIntervalSchema,
  UuidSchema,
} from './primitives.ts';

// --- shared pieces -------------------------------------------------------------------------------------------

/** `{"mon":[["11:00","23:30"]],…}`, IST. A missing day means unknown; an empty list means closed. */
export const OpeningHoursSchema = z.partialRecord(
  WeekdaySchema,
  z.array(z.tuple([ClockTimeSchema, ClockTimeSchema])),
);
export type OpeningHours = z.infer<typeof OpeningHoursSchema>;

const KeyedComponentsSchema = <W extends Record<string, number>>(weights: W) =>
  z.record(z.enum(Object.keys(weights) as [keyof W & string, ...(keyof W & string)[]]), UnitIntervalSchema);

// --- business writes (BusinessUpsert, CandidateInput) --------------------------------------------------------

/** Restaurant columns of CONTRACTS §5 (`restaurants`). */
export const RestaurantFieldsSchema = z.strictObject({
  cuisines: z.array(TextSchema),
  diet: DietSchema,
  price_level: z.number().int().min(1).max(3).nullable(),
  opening_hours: OpeningHoursSchema.nullable(),
  service_modes: z.array(ServiceModeSchema),
  tags: z.array(TextSchema),
});
export type RestaurantFields = z.infer<typeof RestaurantFieldsSchema>;

/** Provider columns of CONTRACTS §5 (`providers`), plus the `provider_services` ids as `services`. */
export const ProviderFieldsSchema = z.strictObject({
  services: z.array(SlugSchema),
  specializations: z.array(TextSchema),
  experience_years: z.number().int().nonnegative().nullable(),
  accepts_leads: z.boolean(),
  service_localities: z.array(SlugSchema),
  min_job_inr: InrSchema.nullable(),
  sales_stage: SalesStageSchema,
  trial_leads_remaining: z.number().int().nonnegative(),
  agreed_lead_price_inr: InrSchema.nullable(),
  founding_partner: z.boolean(),
  price_locked_until: IsoDateSchema.nullable(),
});
export type ProviderFields = z.infer<typeof ProviderFieldsSchema>;

export const BusinessUpsertSchema = z.strictObject({
  kind: BusinessKindSchema,
  name: TextSchema,
  locality_id: SlugSchema,
  address: z.string().nullable(),
  geo: GeoSchema.nullable(),
  phone: z.string().nullable(),
  website: HttpUrlSchema.nullable(),
  chain_hint: z.string().nullable(),
  branch_key: z.string().nullable(),
  status: BusinessStatusSchema,
  auto_published: z.boolean(),
  restaurant: RestaurantFieldsSchema.partial().nullable(),
  provider: ProviderFieldsSchema.partial().nullable(),
  actor: ActorSchema,
});
export type BusinessUpsert = z.infer<typeof BusinessUpsertSchema>;

// --- claims and evidence -------------------------------------------------------------------------------------

export const ClaimSchema = z.union([
  z.strictObject({
    price: z.strictObject({
      dish_id: SlugSchema.nullable(),
      service_id: SlugSchema.nullable(),
      price_inr: InrSchema,
      unit: CostUnitSchema.or(z.literal('serving')),
    }),
  }),
  z.strictObject({ hours: OpeningHoursSchema }),
  z.strictObject({
    dish: z.strictObject({ dish_id: SlugSchema, variant_label: z.string().nullable() }),
  }),
  z.strictObject({ service: z.strictObject({ service_id: SlugSchema }) }),
  z.strictObject({ address: TextSchema }),
  z.strictObject({ phone: TextSchema }),
  z.strictObject({
    rating: z
      .strictObject({ value: z.number().nonnegative(), scale: z.number().positive() })
      .check((ctx) => {
        if (ctx.value.value > ctx.value.scale) addIssue(ctx, 'rating value exceeds its scale');
      }),
  }),
  z.strictObject({ mention: z.strictObject({ sentiment: SentimentSchema }) }),
  z.strictObject({ offer: z.strictObject({ text: TextSchema, ends_on: IsoDateSchema.nullable() }) }),
  z.strictObject({ availability: z.strictObject({ text: TextSchema }) }),
  z.strictObject({ locality_fact: LocalFactSchema }),
  z.strictObject({ cost_rate: z.strictObject({ cost_model_id: SlugSchema }) }),
]);
export type Claim = z.infer<typeof ClaimSchema>;

export const EvidenceSourceSchema = z
  .strictObject({
    kind: SourceKindSchema,
    url: HttpUrlSchema.nullable(),
    title: z.string().nullable(),
    publisher: z.string().nullable(),
    experience_id: UuidSchema.nullable(),
  })
  .check((ctx) => {
    if (ctx.value.url === null && ctx.value.kind !== 'first_hand') {
      addIssue(ctx, 'url may be null only for a first_hand source', ['url']);
    }
  });

const EvidenceInsertShape = {
  entity_type: EvidenceEntityTypeSchema,
  entity_id: TextSchema,
  claim_type: ClaimTypeSchema,
  claim: ClaimSchema,
  supporting_quote: z.string().nullable(),
  source: EvidenceSourceSchema,
  retrieved_at: TimestampSchema,
  /** `null` means the TTL of the claim's tier (CLAIM_TIER and TIER_TTL_DAYS). */
  valid_until: TimestampSchema.nullable(),
  confidence: UnitIntervalSchema,
  extractor_version: TextSchema,
};

/** A claim is stored under its own name, so `claim_type: 'price'` must carry a `{ price: … }` claim. */
function checkClaimMatchesType(ctx: z.core.ParsePayload<{ claim_type: string; claim: object }>): void {
  const keys = Object.keys(ctx.value.claim);
  if (keys.length !== 1 || keys[0] !== ctx.value.claim_type) {
    addIssue(ctx, `claim must be { ${ctx.value.claim_type}: … } to match claim_type`, ['claim']);
  }
}

export const EvidenceInsertSchema = z.strictObject(EvidenceInsertShape).check(checkClaimMatchesType);
export type EvidenceInsert = z.infer<typeof EvidenceInsertSchema>;

export const EvidenceViewSchema = z
  .strictObject({
    ...EvidenceInsertShape,
    id: UuidSchema,
    source_id: UuidSchema,
    status: EvidenceStatusSchema,
    tier: FreshnessTierSchema,
  })
  .check(checkClaimMatchesType);
export type EvidenceView = z.infer<typeof EvidenceViewSchema>;

export const CandidateInputSchema = BusinessUpsertSchema.extend({
  evidence: z.array(EvidenceInsertSchema),
  /** From `autoPublish` (§8). */
  decision: z.enum(['publish', 'queue']),
});
export type CandidateInput = z.infer<typeof CandidateInputSchema>;

// --- API keys ------------------------------------------------------------------------------------------------

export const KeyOutcomeSchema = z.strictObject({
  provider: ProviderSchema,
  /** First 12 hex characters of the key's sha256. Never the key. */
  fingerprint: TextSchema,
  account_label: TextSchema,
  status_code: z.number().int().nullable(),
  outcome: KeyOutcomeKindSchema,
  retry_after_s: z.number().nonnegative().nullable(),
  tokens: z.number().int().nonnegative().nullable(),
});
export type KeyOutcome = z.infer<typeof KeyOutcomeSchema>;

// --- leads ---------------------------------------------------------------------------------------------------

export const LeadInsertSchema = LeadSubmissionSchema.extend({
  phone_e164: PhoneE164Schema,
  grade: LeadGradeSchema,
  qualified: z.boolean(),
  visitor_hmac: TextSchema,
  synthetic: z.literal(false),
});
export type LeadInsert = z.infer<typeof LeadInsertSchema>;

export const LeadRecordSchema = LeadInsertSchema.extend({
  id: UuidSchema,
  ref: TextSchema,
  status: LeadStatusSchema,
  whatsapp_confirmed: z.boolean(),
  next_follow_up_at: TimestampSchema.nullable(),
  contact_attempts: z.number().int().nonnegative(),
  remind_at: TimestampSchema.nullable(),
  duplicate_of: UuidSchema.nullable(),
  anonymised_at: TimestampSchema.nullable(),
  created_at: TimestampSchema,
});
export type LeadRecord = z.infer<typeof LeadRecordSchema>;

// --- Ask -----------------------------------------------------------------------------------------------------

export const ParsedIntentSchema = z.strictObject({
  vertical: z.enum(['food', 'construction']),
  subject_id: SlugSchema.nullable(),
  craving: CravingSchema.nullable(),
  locality_id: SlugSchema.nullable(),
  budget_inr: InrSchema.nullable(),
  diet: DietSchema.nullable(),
  open_now: z.boolean(),
  intent_key: TextSchema,
  confidence: UnitIntervalSchema,
});
export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

export const CitationSchema = z.strictObject({
  url: HttpUrlSchema,
  title: z.string(),
  retrieved_at: DateOrTimestampSchema,
});
export type Citation = z.infer<typeof CitationSchema>;

export const AskItemSchema = z.strictObject({
  entity_id: UuidSchema.nullable(),
  name: TextSchema,
  locality_id: SlugSchema.nullable(),
  url: z.string().nullable(),
  summary: z.string(),
  price_inr: InrSchema.nullable(),
  labels: z.array(BadgeLabelSchema.or(TempLabelSchema)),
  trust: z.array(TrustLabelSchema),
  sources: z.array(CitationSchema),
  unverified: z.boolean(),
});
export type AskItem = z.infer<typeof AskItemSchema>;

export const AskResultSchema = z.strictObject({
  items: z.array(AskItemSchema),
  served_from: z.enum(['db', 'live']),
  citations: z.array(CitationSchema),
});
export type AskResult = z.infer<typeof AskResultSchema>;

// --- events --------------------------------------------------------------------------------------------------

/**
 * A day's count for one combination of dimensions. Every dimension is part of the primary key, so an
 * unknown one is an empty string, except `landing_path`.
 */
export const EventAggregateSchema = z.strictObject({
  day: IsoDateSchema,
  host: HostSchema,
  page_type: PageTypeSchema,
  event: EventNameSchema,
  locality_id: z.string(),
  subject_id: z.string(),
  entity_id: z.string(),
  ranking_run_id: z.string(),
  slot: z.string(),
  campaign_id: z.string(),
  variant: z.string(),
  referrer_class: ReferrerClassSchema,
  device: DeviceClassSchema,
  landing_path: z.string().nullable(),
  count: z.number().int().positive(),
});
export type EventAggregate = z.infer<typeof EventAggregateSchema>;

// --- views in the catalogue snapshot -------------------------------------------------------------------------

export const LocalityProfileSchema = z.strictObject({
  locality_id: SlugSchema,
  search_intent: z.record(z.string(), z.number()),
  popular_dishes: z.array(SlugSchema),
  price_segments: z.record(z.string(), z.number()),
  business_density: z.number().nonnegative(),
  data_quality: UnitIntervalSchema,
  complete: z.boolean(),
  last_updated: TimestampSchema,
});
export type LocalityProfile = z.infer<typeof LocalityProfileSchema>;

export const PlaceViewSchema = z.strictObject({
  id: UuidSchema,
  slug: SlugSchema,
  name: TextSchema,
  locality_id: SlugSchema,
  address: z.string().nullable(),
  geo: GeoSchema.nullable(),
  website: HttpUrlSchema.nullable(),
  price_level: z.number().int().min(1).max(3).nullable(),
  cuisines: z.array(TextSchema),
  diet: DietSchema,
  service_modes: z.array(ServiceModeSchema),
  opening_hours: OpeningHoursSchema.nullable(),
  tags: z.array(TextSchema),
  verification_status: VerificationStatusSchema,
  verified_at: TimestampSchema.nullable(),
  last_verified_at: TimestampSchema.nullable(),
  auto_published: z.boolean(),
  reviewed_at: TimestampSchema.nullable(),
  dishes: z.array(
    z.strictObject({
      dish_id: SlugSchema,
      variant_label: z.string().nullable(),
      price_inr: InrSchema.nullable(),
      evidence_id: UuidSchema,
      last_seen_at: TimestampSchema,
    }),
  ),
});
export type PlaceView = z.infer<typeof PlaceViewSchema>;

/** Deliberately has no phone: providers' numbers never reach the public snapshot. */
export const ProviderViewSchema = z.strictObject({
  id: UuidSchema,
  slug: SlugSchema,
  name: TextSchema,
  locality_id: SlugSchema,
  service_localities: z.array(SlugSchema),
  services: z.array(SlugSchema),
  specializations: z.array(TextSchema),
  experience_years: z.number().int().nonnegative().nullable(),
  accepts_leads: z.boolean(),
  verification_status: VerificationStatusSchema,
  verified_at: TimestampSchema.nullable(),
  founding_partner: z.boolean(),
  auto_published: z.boolean(),
  reviewed_at: TimestampSchema.nullable(),
});
export type ProviderView = z.infer<typeof ProviderViewSchema>;

export const ExperienceViewSchema = z.strictObject({
  id: UuidSchema,
  business_id: UuidSchema,
  visited_at: IsoDateSchema,
  dishes: z.array(
    z.strictObject({
      dish_id: SlugSchema,
      price_paid_inr: InrSchema,
      rating: z.number().int().min(1).max(5),
      notes: z.string(),
    }),
  ),
  overall_rating: z.number().min(1).max(5),
  would_recommend: z.boolean(),
  tags: z.array(TextSchema),
  notes: z.string(),
  prose_status: ProseStatusSchema,
  photos: z.array(
    z.strictObject({
      id: UuidSchema,
      alt: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
  ),
});
export type ExperienceView = z.infer<typeof ExperienceViewSchema>;

export const RecommendationViewSchema = z.strictObject({
  ranking_run_id: UuidSchema,
  page_key: TextSchema,
  entity_id: UuidSchema,
  rank: z.number().int().positive(),
  organic_score: UnitIntervalSchema,
  components: z.record(z.string(), z.number()),
  labels: z.array(TempLabelSchema.or(BadgeLabelSchema)),
});
export type RecommendationView = z.infer<typeof RecommendationViewSchema>;

export const FeaturedViewSchema = z.strictObject({
  business_id: UuidSchema,
  tier: ListingTierSchema,
  locality_ids: z.array(SlugSchema),
  category_ids: z.array(SlugSchema),
  starts_on: IsoDateSchema,
  ends_on: IsoDateSchema,
});
export type FeaturedView = z.infer<typeof FeaturedViewSchema>;

export const CampaignViewSchema = z.strictObject({
  id: UuidSchema,
  kind: CampaignKindSchema,
  advertiser_name: TextSchema,
  target_locality: SlugSchema.nullable(),
  target_category: SlugSchema.nullable(),
  creative: z.strictObject({ text: TextSchema, url: HttpUrlSchema, image: z.string().nullable() }),
  starts_on: IsoDateSchema,
  ends_on: IsoDateSchema,
});
export type CampaignView = z.infer<typeof CampaignViewSchema>;

// --- manifest and snapshot -----------------------------------------------------------------------------------

export const ManifestEntrySchema = z.strictObject({
  url: TextSchema,
  host: HostSchema,
  locale: LocaleSchema,
  page_type: PageTypeSchema,
  indexable: z.boolean(),
  /** sha256 hex of the canonical JSON of the page's data inputs (not its HTML). */
  content_hash: z.string().regex(/^[0-9a-f]{64}$/, 'must be a sha256 hex digest'),
  hash_changed_at: TimestampSchema,
  gate: GateResultSchema,
  noindex_since: TimestampSchema.nullable(),
  redirect_to: z.string().nullable(),
});
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

export const CatalogueSnapshotSchema = z.strictObject({
  snapshot_id: TextSchema,
  generated_at: TimestampSchema,
  localities: z.array(LocalitySchema),
  locality_profiles: z.array(LocalityProfileSchema),
  dishes: z.array(DishSchema),
  services: z.array(ServiceDefSchema),
  cost_models: z.array(CostModelSchema),
  locality_guides: z.array(LocalityGuideSchema),
  places: z.array(PlaceViewSchema),
  providers: z.array(ProviderViewSchema),
  /** Active and not expired. */
  evidence: z.array(EvidenceViewSchema),
  experiences: z.array(ExperienceViewSchema),
  /** Latest run per page_key. */
  recommendations: z.array(RecommendationViewSchema),
  featured: z.array(FeaturedViewSchema),
  campaigns: z.array(CampaignViewSchema),
  demand: z.array(
    z.strictObject({ subject_id: SlugSchema, locality_id: SlugSchema.nullable(), score: z.number().nonnegative() }),
  ),
  /** n >= 3, last 180 days. */
  quote_stats: z.array(
    z.strictObject({
      service_id: SlugSchema,
      locality_id: SlugSchema,
      n: z.number().int().min(3),
      low: InrSchema,
      high: InrSchema,
    }),
  ),
  founding_slots: z.array(
    z.strictObject({ service_id: SlugSchema, locality_id: SlugSchema, remaining: z.number().int().nonnegative() }),
  ),
  prose_reviews: z.array(z.strictObject({ key: TextSchema, status: ProseStatusSchema })),
  redirects: z.array(z.strictObject({ host: HostSchema, from_path: TextSchema, to_path: TextSchema })),
  previous_manifest: z.array(ManifestEntrySchema),
});
export type CatalogueSnapshot = z.infer<typeof CatalogueSnapshotSchema>;

// --- candidates passed between @mm/core functions ------------------------------------------------------------

export const PageCandidateSchema = z.strictObject({
  url: TextSchema,
  host: HostSchema,
  locale: LocaleSchema,
  page_type: PageTypeSchema,
  parent_url: z.string().nullable(),
  entity_ids: z.array(UuidSchema),
  evidence_count: z.number().int().nonnegative(),
  entity_count: z.number().int().nonnegative(),
  relevance: UnitIntervalSchema,
  main_text: z.string(),
  /** The page's data inputs; hashed canonically for `content_hash`. */
  data_inputs: z.unknown(),
  prose_keys: z.array(TextSchema),
  seo_inputs: KeyedComponentsSchema(SEO_WEIGHTS),
  extra: z.record(z.string(), z.number()),
});
export type PageCandidate = z.infer<typeof PageCandidateSchema>;

export const FoodCandidateSchema = z.strictObject({
  entity_id: UuidSchema,
  components: KeyedComponentsSchema(FOOD_WEIGHTS),
});
export type FoodCandidate = z.infer<typeof FoodCandidateSchema>;

export const ProviderCandidateSchema = z.strictObject({
  entity_id: UuidSchema,
  components: KeyedComponentsSchema(PROVIDER_WEIGHTS),
});
export type ProviderCandidate = z.infer<typeof ProviderCandidateSchema>;

export const HotInputsSchema = z.strictObject({
  components: KeyedComponentsSchema(HOT_WEIGHTS),
  evidence_count: z.number().int().nonnegative(),
});
export type HotInputs = z.infer<typeof HotInputsSchema>;

export const BadgeInputsSchema = z.strictObject({
  quality_pct: z.number().min(0).max(100),
  visibility_pct: z.number().min(0).max(100),
  value_pct: z.number().min(0).max(100),
  dated_prices: z.number().int().nonnegative(),
  late_hours_checked_at: TimestampSchema.nullable(),
  tags: z.array(TextSchema),
  distance_to_office_m: z.number().nonnegative().nullable(),
  evidence_count: z.number().int().nonnegative(),
});
export type BadgeInputs = z.infer<typeof BadgeInputsSchema>;
