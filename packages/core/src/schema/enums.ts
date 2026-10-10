// Enums, defined once (CONTRACTS §3). Each is a Zod schema `XxxSchema` plus its type `Xxx`.
// The values are parsed back out of docs/CONTRACTS.md by enums.test.ts, so the two cannot drift apart.
import { z } from 'zod';

export const LocalityKindSchema = z.enum(['locality', 'sub_locality', 'landmark']);
export type LocalityKind = z.infer<typeof LocalityKindSchema>;

export const JurisdictionSchema = z.enum(['PMC', 'PCMC', 'PMRDA', 'cantonment', 'other']);
export type Jurisdiction = z.infer<typeof JurisdictionSchema>;

export const BusinessKindSchema = z.enum(['restaurant', 'provider']);
export type BusinessKind = z.infer<typeof BusinessKindSchema>;

export const BusinessStatusSchema = z.enum(['candidate', 'published', 'hidden']);
export type BusinessStatus = z.infer<typeof BusinessStatusSchema>;

export const VerificationStatusSchema = z.enum(['unverified', 'verified']);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const VerificationMethodSchema = z.enum(['website', 'phone', 'business_docs', 'visit']);
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

export const SourceKindSchema = z.enum([
  'first_hand', 'owner_manual', 'csv', 'official_site', 'menu', 'directory', 'article', 'aggregator',
]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const ClaimTypeSchema = z.enum([
  'price', 'hours', 'offer', 'availability', 'dish', 'service', 'address', 'phone', 'rating', 'mention',
  'locality_fact', 'cost_rate',
]);
export type ClaimType = z.infer<typeof ClaimTypeSchema>;

export const FreshnessTierSchema = z.enum(['HOT', 'WARM', 'COLD', 'COST']);
export type FreshnessTier = z.infer<typeof FreshnessTierSchema>;

export const EvidenceStatusSchema = z.enum(['active', 'superseded', 'rejected']);
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;

export const ProseStatusSchema = z.enum(['draft', 'reviewed']);
export type ProseStatus = z.infer<typeof ProseStatusSchema>;

export const DietSchema = z.enum(['veg', 'non_veg', 'egg', 'both']);
export type Diet = z.infer<typeof DietSchema>;

export const CravingSchema = z.enum([
  'spicy', 'sweet', 'savoury', 'light', 'filling', 'street', 'breakfast', 'late_night', 'healthy',
]);
export type Craving = z.infer<typeof CravingSchema>;

export const ServiceModeSchema = z.enum(['dine_in', 'takeaway', 'delivery']);
export type ServiceMode = z.infer<typeof ServiceModeSchema>;

export const LocalityFoodIntentSchema = z.enum(['late-night-food', 'budget-food', 'veg-food']);
export type LocalityFoodIntent = z.infer<typeof LocalityFoodIntentSchema>;

export const TierSchema = z.enum(['budget', 'standard', 'premium']);
export type Tier = z.infer<typeof TierSchema>;

export const CostUnitSchema = z.enum(['sqft', 'rft', 'unit', 'project']);
export type CostUnit = z.infer<typeof CostUnitSchema>;

export const AreaPresetSchema = z.enum([
  '1bhk', '2bhk', '3bhk', '4bhk', 'independent_house', 'terrace', 'custom',
]);
export type AreaPreset = z.infer<typeof AreaPresetSchema>;

export const PropertyTypeSchema = z.enum(['flat', 'independent_house', 'society_common', 'commercial']);
export type PropertyType = z.infer<typeof PropertyTypeSchema>;

export const OwnershipSchema = z.enum(['owner', 'tenant', 'society']);
export type Ownership = z.infer<typeof OwnershipSchema>;

export const TimelineSchema = z.enum(['within_2_weeks', 'within_1_month', '1_to_3_months', 'researching']);
export type Timeline = z.infer<typeof TimelineSchema>;

export const LeadTypeSchema = z.enum([
  'quote', 'featured_enquiry', 'advertise', 'claim', 'contact', 'for_contractors', 'reminder',
]);
export type LeadType = z.infer<typeof LeadTypeSchema>;

export const LeadStatusSchema = z.enum([
  'new', 'contacted', 'qualified', 'assigned', 'won', 'lost', 'spam', 'nurture',
]);
export type LeadStatus = z.infer<typeof LeadStatusSchema>;

export const LeadGradeSchema = z.enum(['A', 'B', 'C']);
export type LeadGrade = z.infer<typeof LeadGradeSchema>;

export const AssignmentModeSchema = z.enum(['shared', 'exclusive']);
export type AssignmentMode = z.infer<typeof AssignmentModeSchema>;

export const AssignmentOutcomeSchema = z.enum(['none', 'contacted', 'site_visit', 'won', 'lost']);
export type AssignmentOutcome = z.infer<typeof AssignmentOutcomeSchema>;

export const RefundReasonSchema = z.enum(['wrong_number', 'out_of_area', 'duplicate', 'not_owner']);
export type RefundReason = z.infer<typeof RefundReasonSchema>;

export const SalesStageSchema = z.enum(['prospect', 'contacted', 'trial', 'paying', 'churned']);
export type SalesStage = z.infer<typeof SalesStageSchema>;

export const ListingTierSchema = z.enum(['free', 'featured', 'premium']);
export type ListingTier = z.infer<typeof ListingTierSchema>;

export const SalesProductSchema = z.enum(['featured', 'premium', 'sponsorship', 'lead_pack']);
export type SalesProduct = z.infer<typeof SalesProductSchema>;

// hidden gem is a BadgeLabel (plan §8)
export const TempLabelSchema = z.enum(['hot', 'trending', 'warm', 'cold']);
export type TempLabel = z.infer<typeof TempLabelSchema>;

export const BadgeLabelSchema = z.enum(['hidden_gem', 'best_value', 'late_night', 'family', 'office_lunch']);
export type BadgeLabel = z.infer<typeof BadgeLabelSchema>;

export const TrustLabelSchema = z.enum([
  'verified', 'recently_checked', 'source_backed', 'price_checked', 'hours_checked',
]);
export type TrustLabel = z.infer<typeof TrustLabelSchema>;

export const HostSchema = z.enum(['main', 'food', 'construction', 'admin']);
export type Host = z.infer<typeof HostSchema>;

export const LocaleSchema = z.enum(['en', 'mr', 'hi']);
export type Locale = z.infer<typeof LocaleSchema>;

export const ReferrerClassSchema = z.enum(['search', 'ai', 'social', 'direct', 'other']);
export type ReferrerClass = z.infer<typeof ReferrerClassSchema>;

export const DeviceClassSchema = z.enum(['mobile', 'tablet', 'desktop']);
export type DeviceClass = z.infer<typeof DeviceClassSchema>;

export const ProviderSchema = z.enum(['groq', 'exa', 'firecrawl']);
export type Provider = z.infer<typeof ProviderSchema>;

export const EventNameSchema = z.enum([
  'session_start', 'web_vital', 'search', 'filter', 'recommendation_click', 'website_click', 'call_click',
  'direction_click', 'whatsapp_click', 'quote_start', 'quote_step', 'quote_submit', 'calculator_start',
  'calculator_complete', 'featured_click', 'provider_click', 'profile_view', 'list_impression',
  'ad_impression', 'ad_click', 'ask_submit', 'feedback', 'outbound_order_click',
]);
export type EventName = z.infer<typeof EventNameSchema>;

export const PageTypeSchema = z.enum([
  'home', 'city_hub', 'locality_hub', 'dish_city', 'dish_locality', 'food_intent', 'locality_food_intent',
  'place', 'service_cost', 'service_city', 'locality_service', 'provider', 'calculator', 'get_quotes',
  'for_contractors', 'ask', 'locality_guide', 'legal', 'business', 'contact', 'about', 'not_found',
  'thank_you',
]);
export type PageType = z.infer<typeof PageTypeSchema>;
// `under-${number}`: a positive whole number of rupees ('under-250'). Checked by pattern because Zod's
// template-literal number accepts a minus sign.
export const FoodIntentSchema = z
  .custom<`under-${number}`>((v) => typeof v === 'string' && /^under-[1-9]\d*$/.test(v))
  .or(z.enum(['veg', 'late-night', 'family', 'office-lunch']));
export type FoodIntent = z.infer<typeof FoodIntentSchema>;

// ---------------------------------------------------------------------------------------------------------
// Closed sets that CONTRACTS §5 to §9 name but §3 does not, collected here so each is still defined once.
// ---------------------------------------------------------------------------------------------------------

/** Who made a change (§5 `observations.actor`, §6a `BusinessUpsert.actor`). */
export const ActorSchema = z.enum(['admin', 'csv', 'pipeline', 'ask']);
export type Actor = z.infer<typeof ActorSchema>;

/** §9 `AdSlotRule.provider`. */
export const AdProviderSchema = z.enum(['adsense', 'sponsorship']);
export type AdProvider = z.infer<typeof AdProviderSchema>;

/** §5 `api.ask_begin` verdict. */
export const AskVerdictSchema = z.enum(['allow', 'rate_limited', 'budget_exhausted', 'cached']);
export type AskVerdict = z.infer<typeof AskVerdictSchema>;

/** §5 `campaigns.kind`, §6a `CampaignView.kind`. */
export const CampaignKindSchema = z.enum(['sponsorship', 'banner']);
export type CampaignKind = z.infer<typeof CampaignKindSchema>;

/** §5 `evidence.entity_type`. */
export const EvidenceEntityTypeSchema = z.enum([
  'business',
  'restaurant_dish',
  'provider_service',
  'locality',
  'cost_model',
]);
export type EvidenceEntityType = z.infer<typeof EvidenceEntityTypeSchema>;

/** §5 `feedback.kind`, §7 `/api/feedback`. */
export const FeedbackKindSchema = z.enum(['useful', 'not_useful', 'outdated']);
export type FeedbackKind = z.infer<typeof FeedbackKindSchema>;

/** §6a `KeyOutcome.outcome`. */
export const KeyOutcomeKindSchema = z.enum([
  'ok',
  'timeout',
  'auth',
  'credits',
  'rate_limited',
  'server',
  'bad_request',
  'schema',
]);
export type KeyOutcomeKind = z.infer<typeof KeyOutcomeKindSchema>;

/** §7 `/api/ask` `live.status`. */
export const LiveStatusSchema = z.enum(['none', 'pending', 'capped']);
export type LiveStatus = z.infer<typeof LiveStatusSchema>;

/** §5 `ask_lookups.status`, §7 `/api/ask/result`. */
export const LookupStatusSchema = z.enum(['pending', 'done', 'failed']);
export type LookupStatus = z.infer<typeof LookupStatusSchema>;

/** §6a `Claim.mention.sentiment`. */
export const SentimentSchema = z.enum(['positive', 'neutral', 'negative']);
export type Sentiment = z.infer<typeof SentimentSchema>;

/** §5 `queries.served_from` (the cache/db/live path), §7 `/api/ask`. */
export const ServedFromSchema = z.enum(['cache', 'db', 'live']);
export type ServedFrom = z.infer<typeof ServedFromSchema>;

/** §5 `restaurants.opening_hours` keys. */
export const WeekdaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type Weekday = z.infer<typeof WeekdaySchema>;
