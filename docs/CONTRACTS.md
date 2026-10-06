# MarketMind AI: Shared Contracts (v2, after the task-graph audit)

This is the single source of truth for names, shapes and interfaces. Every task in [`TASKS.md`](TASKS.md) builds against it, so tasks can run in parallel without colliding. **If a task needs a contract change, it stops and reports the change instead of improvising.** Only the orchestrator edits this file.

`spec §N` refers to the owner's original spec, [`docs/Makemoney.txt`](Makemoney.txt). `plan §N` refers to [`PLAN.md`](PLAN.md). Literal values that tasks must match exactly (weights, bands, templates) are in §8a.

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Language / runtime | TypeScript `strict` and ESM only. Builds and the pipeline run on Node ≥ 22.12; `/api/*` and admin run on the Cloudflare Workers runtime. |
| Package manager | pnpm workspaces. Dependencies are declared **only** in T00. A later task that needs a new dependency reports it and does not install it. |
| Reference-data IDs | Lowercase ASCII slugs, also used in URLs: `pune`, `hinjewadi`, `hinjewadi-phase-1`, `chicken-biryani`, `terrace-waterproofing` |
| Record IDs | `uuid` v4: `gen_random_uuid()` in Postgres, or `crypto.randomUUID()` for client idempotency keys |
| Money | Integer INR (`price_inr: 249`). Ranges use `{ low, expected, high }`. |
| Dates | ISO 8601. Timestamps are stored as UTC `timestamptz` and displayed in IST (`Asia/Kolkata`). Date-only fields use `YYYY-MM-DD`. |
| Phone | Stored as E.164. Indian mobiles must match `^\+91[6-9]\d{9}$` after normalisation. |
| Geo | `{ lat, lng }` in WGS84. Distances use haversine in metres. |
| Text | NFKC-normalised before matching. Slugs are ASCII in every locale. |
| Nullability | Optional data is `null`, not missing. LLM-facing Zod schemas use `.nullable()`, because Groq strict mode requires every field. |
| File ownership | Each task edits only the paths its card owns. **T00 writes a stub entry file for every subpath export; only that subpath's owner task replaces it.** A task that modifies a file created by an earlier task says so on its card. |
| Tests | Vitest, with `*.test.ts` files next to the code. Workers code uses `@cloudflare/vitest-pool-workers`. The database uses pgTAP in `supabase/tests/`. E2E uses Playwright in `e2e/`. |
| Commits | Only the orchestrator commits, after each wave has been verified. |

---

## 2. Package map and public entry points

Every package is `@mm/<name>`. **T00 declares all subpaths up front** in `package.json#exports`.

| Package | Subpath exports (owner task) |
|---|---|
| `@mm/core` | `/schema` · `/config` · `/constants` (T01) · `/locality` · `/intent` (C01) · `/cost` (C02) · `/ranking` · `/labels` (C03) · `/gate` (C04; includes `buildManifest`) · `/seo` (C05a) · `/links` · `/i18n` (C05b) · `/leads` (C06) · `/monetization` · `/season` (C07) |
| `@mm/ui` | `/tokens.css` · `/layouts/*` · `/components/*` (T03) · `/islands/lead-form` (A02) · `/islands/analytics` (M01a) · `/islands/slot-expiry` (M01b) · `/islands/experiments` (M02) |
| `@mm/db` | `/client` · `/admin` · `/catalogue` · `/fixtures` (E01) |
| `@mm/providers` | `/pool` · `/exa` · `/firecrawl` · `/groq` · `/errors` (P01) |
| `@mm/extract` | `/deterministic` · `/grounding` · `/independence` (P02a) · `/groq-normalise` (P02b) |
| `@mm/edge` | `/lead` · `/event` · `/feedback` · `/turnstile` · `/visitor` (E02) · `/alerts` (E03) · `/ask` (P03) |
| `@mm/pipeline` | CLI `mm`. `src/cli.ts` (T00) auto-discovers `src/commands/*.ts` by file name and is never edited later. Commands and owners: `import:csv`, `import:reference` (P05) · `rank` (R00) · `discover`, `refresh`, `extract`, `normalise` (P04a) · `gsc`, `demand` (P04b) · `backup`, `health`, `prune` (P04c). IndexNow is the build script `scripts/indexnow.mjs` (O01b). |

---

## 3. Enums (defined once in `@mm/core/schema/enums.ts`)

```ts
LocalityKind      = 'locality' | 'sub_locality' | 'landmark'
Jurisdiction      = 'PMC' | 'PCMC' | 'PMRDA' | 'cantonment' | 'other'
BusinessKind      = 'restaurant' | 'provider'
BusinessStatus    = 'candidate' | 'published' | 'hidden'
VerificationStatus= 'unverified' | 'verified'
VerificationMethod= 'website' | 'phone' | 'business_docs' | 'visit'
SourceKind        = 'first_hand' | 'owner_manual' | 'csv' | 'official_site' | 'menu' | 'directory' | 'article' | 'aggregator'
ClaimType         = 'price' | 'hours' | 'offer' | 'availability' | 'dish' | 'service' | 'address'
                  | 'phone' | 'rating' | 'mention' | 'locality_fact' | 'cost_rate'
FreshnessTier     = 'HOT' | 'WARM' | 'COLD' | 'COST'
EvidenceStatus    = 'active' | 'superseded' | 'rejected'
ProseStatus       = 'draft' | 'reviewed'
Diet              = 'veg' | 'non_veg' | 'egg' | 'both'
Craving           = 'spicy' | 'sweet' | 'savoury' | 'light' | 'filling' | 'street' | 'breakfast' | 'late_night' | 'healthy'
ServiceMode       = 'dine_in' | 'takeaway' | 'delivery'
FoodIntent        = `under-${number}` | 'veg' | 'late-night' | 'family' | 'office-lunch'
LocalityFoodIntent= 'late-night-food' | 'budget-food' | 'veg-food'
Tier              = 'budget' | 'standard' | 'premium'
CostUnit          = 'sqft' | 'rft' | 'unit' | 'project'
AreaPreset        = '1bhk' | '2bhk' | '3bhk' | '4bhk' | 'independent_house' | 'terrace' | 'custom'
PropertyType      = 'flat' | 'independent_house' | 'society_common' | 'commercial'
Ownership         = 'owner' | 'tenant' | 'society'
Timeline          = 'within_2_weeks' | 'within_1_month' | '1_to_3_months' | 'researching'
LeadType          = 'quote' | 'featured_enquiry' | 'advertise' | 'claim' | 'contact' | 'for_contractors' | 'reminder'
LeadStatus        = 'new' | 'contacted' | 'qualified' | 'assigned' | 'won' | 'lost' | 'spam' | 'nurture'
LeadGrade         = 'A' | 'B' | 'C'
AssignmentMode    = 'shared' | 'exclusive'
AssignmentOutcome = 'none' | 'contacted' | 'site_visit' | 'won' | 'lost'
RefundReason      = 'wrong_number' | 'out_of_area' | 'duplicate' | 'not_owner'
SalesStage        = 'prospect' | 'contacted' | 'trial' | 'paying' | 'churned'
ListingTier       = 'free' | 'featured' | 'premium'
SalesProduct      = 'featured' | 'premium' | 'sponsorship' | 'lead_pack'
TempLabel         = 'hot' | 'trending' | 'warm' | 'cold'                    // hidden gem is a BadgeLabel (plan §8)
BadgeLabel        = 'hidden_gem' | 'best_value' | 'late_night' | 'family' | 'office_lunch'
TrustLabel        = 'verified' | 'recently_checked' | 'source_backed' | 'price_checked' | 'hours_checked'
Host              = 'main' | 'food' | 'construction' | 'admin'
Locale            = 'en' | 'mr' | 'hi'
ReferrerClass     = 'search' | 'ai' | 'social' | 'direct' | 'other'
DeviceClass       = 'mobile' | 'tablet' | 'desktop'
Provider          = 'groq' | 'exa' | 'firecrawl'
EventName         = 'session_start' | 'web_vital' | 'search' | 'filter' | 'recommendation_click' | 'website_click'
                  | 'call_click' | 'direction_click' | 'whatsapp_click' | 'quote_start' | 'quote_step' | 'quote_submit'
                  | 'calculator_start' | 'calculator_complete' | 'featured_click' | 'provider_click'
                  | 'profile_view' | 'list_impression' | 'ad_impression' | 'ad_click'
                  | 'ask_submit' | 'feedback' | 'outbound_order_click'
PageType          = 'home' | 'city_hub' | 'locality_hub' | 'dish_city' | 'dish_locality' | 'food_intent'
                  | 'locality_food_intent' | 'place' | 'service_cost' | 'service_city' | 'locality_service'
                  | 'provider' | 'calculator' | 'get_quotes' | 'for_contractors' | 'ask' | 'locality_guide'
                  | 'legal' | 'business' | 'contact' | 'about' | 'not_found' | 'thank_you'
```

---

## 4. Curated data files (`data/`): shapes

All files are validated by Zod schemas in `@mm/core/schema/data.ts` (T01). Every factual statement carries `SourceRef[]`.

```ts
SourceRef = { url: string; title: string; publisher: string; retrieved_at: 'YYYY-MM-DD'; quote: string | null }

// data/localities.json  → Locality[]
Locality = {
  id: string; name: string; kind: LocalityKind; city_id: 'pune'; parent_id: string | null;
  aliases: string[];                    // misspellings, Marathi/Hindi spellings, "Hinjawadi"
  geo: { lat: number; lng: number }; geo_source: SourceRef;
  jurisdiction: Jurisdiction; pincodes: string[];
  neighbours: string[];                 // ids, ≤ 6, symmetric (test)
  landmarks: string[]; commercial_centres: string[]; office_clusters: string[]; residential_clusters: string[];
  construction_facts: LocalFact[];      // ≥ 3 per (priority locality × top-level service), plan §5 gate path (c)
  food_notes: LocalFact[];
  i18n: { mr: { name: string } | null; hi: { name: string } | null };
}
LocalFact = { id: string; topic: 'housing_stock'|'building_age'|'water'|'soil'|'rainfall'|'rules'|'access'|'demand'|'other';
              text: string; services: string[];  // every service id (top-level or sub) the fact is relevant to
              sources: SourceRef[]; status: ProseStatus }

// data/dishes.json → Dish[]
Dish = { id: string; name: string; parent_id: string | null; aliases: string[]; cravings: Craving[];
         diet: Diet; price_bands_inr: number[]; price_sanity_inr: { min: number; max: number };
         description: string; prose_status: ProseStatus; i18n: { mr: {name: string}|null; hi: {name: string}|null } }

// data/services/{service_id}.json → ServiceDef (one file per top-level service; sub-services nested)
ServiceDef = { id: string; name: string; parent_id: string | null; unit: CostUnit;
  area_presets: { preset: AreaPreset; label: string; quantity: number; assumption: string; sources: SourceRef[] }[];
  scope_options: { id: string; label: string; description: string }[];
  materials: { id: string; label: string; description: string; sources: SourceRef[] }[];
  duration_days: { min: number; max: number; basis: string };
  questions_to_ask: string[]; common_mistakes: string[]; quote_checklist: string[];
  faq: { q: string; a: string }[];
  prose_status: ProseStatus; sub_services: ServiceDef[] }

// data/cost-models/{service_id}.json → CostModel[]   (≥ 1 model per tier for EVERY service id in §4a)
CostModel = { id: string; service_id: string; scope_id: string | null; material_id: string | null; tier: Tier;
  unit: CostUnit; rate_inr: { low: number; expected: number; high: number };   // per unit
  min_job_inr: number | null;
  components: { materials: number; labour: number; preparation: number; repair: number; transport: number; waste: number }; // sum = 1 ± 0.01
  locality_factors: { locality_id: string; factor: number; sources: SourceRef[] }[];
  sources: SourceRef[];                 // ≥ 2, from different publishers
  reviewed_at: 'YYYY-MM-DD'; valid_until: 'YYYY-MM-DD'; status: ProseStatus; notes: string }

// content/locality-guides/{locality_id}.md: frontmatter { locality_id, title, status: ProseStatus, word_count, sources: SourceRef[] } + markdown body
// data/seasonal-calendar.json → { months: Record<'1'..'12', { services: string[]; headline: string; cta: string; module: string | null }> }
// data/lead-pricing.json      → { currency: 'INR'; exclusive_multiplier: number; prices: { service_id; grade: LeadGrade; price_inr }[] }  (seed for the lead_prices table)
// data/gate.json              → GateConfig (§8)
// data/ad-slots.json          → AdSlotRule[] (§9)
// data/experiments.json       → Experiment[] (§9)
// data/demand.csv             → service_or_dish,sub_id,locality_id,monthly_searches,est_lead_value_inr,data_ready,source  (monthly_searches may be empty = unknown)
// data/aggregators.json       → { domain: string; owner_group: string; discovery_only: true }[]
// data/curation/*.csv         → see §6
```

## 4a. Fixed reference IDs

**City:** `pune`

**Localities (spec §5), kind `locality`:** `hinjewadi`, `wakad`, `baner`, `balewadi`, `aundh`, `kothrud`, `viman-nagar`, `kharadi`, `hadapsar`, `koregaon-park`, `shivajinagar`, `camp`, `kondhwa`, `wagholi`, `lohegaon`, `pimple-saudagar`, `pimple-nilakh`, `pimpri`, `chinchwad`, `magarpatta`
- **Sub-localities** (`sub_locality`, parent `hinjewadi`): `hinjewadi-phase-1`, `hinjewadi-phase-2`, `hinjewadi-phase-3`
- **Landmarks** (`landmark`): IDs are prefixed `near-` and each needs a parent locality and a source.
- **Priority localities (M1):** `hinjewadi`, `wakad`, `baner`, `kharadi`, `hadapsar`, `wagholi`, `pimple-saudagar`, `kothrud`

**Dishes, with `parent_id` null:** `biryani`, `samosa`, `vada-pav`, `misal-pav`, `momos`, `dosa`, `pizza`, `burger`, `poha`, `pav-bhaji`, `shawarma`, `chole-bhature`, `thali`, `kebab`, `sandwich`, `desserts`. Variants use `{variant}-{parent}`, and only D02 adds them.

**Construction services, top level:** `waterproofing`, `painting`, `bathroom-renovation`, `modular-kitchen`, `house-construction`
- **Sub-services:** `terrace-waterproofing`, `bathroom-waterproofing`, `external-wall-waterproofing`, `basement-waterproofing`, `leakage-repair` (under `waterproofing`) · `interior-painting`, `exterior-painting` (under `painting`)
- **City cost-guide slug:** `{service_id}-cost` for all 12 service ids, e.g. `terrace-waterproofing-cost`, `house-construction-cost`. Its title says "per sq ft".
- **Reserved slugs** (never used as a locality, dish or service ID): `late-night-food`, `budget-food`, `veg-food`, `veg`, `late-night`, `family`, `office-lunch`, `under-*`, anything ending in `-cost`, `ask`, `about`, `api`, `mr`, `hi`, `ui-fixtures`

---

## 5. Database (`supabase/`, owners T02a/T02b/T02c)

**Schemas:**
- `app`: all tables, never exposed. It sets `ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM anon, authenticated`.
- `api`: exposed. It holds only the 🌐 functions, as `SECURITY DEFINER`, with `SET search_path = ''`, executable by `anon` and `service_role`.
- `admin_api`: exposed. It holds `SECURITY DEFINER` functions, with `REVOKE EXECUTE … FROM anon, authenticated` and `GRANT EXECUTE … TO service_role` only. Callers are the admin Worker and Node scripts (pipeline, import, deploy) using the secret key.
- **Storage:** a private bucket `experience-photos`, which only `service_role` can read and write.

**Reference data authority.** `mm import:reference` loads `data/*.json` into `localities`, `dishes`, `services` and `cost_models`. After the first import, **database rows are authoritative**. A re-import inserts missing IDs, and it updates a row only if the row is unedited (`updated_at = imported_at`) or `--force <id>` is passed. Builds read reference data only from the snapshot (§6).

**Tables** (every table has `created_at` and `updated_at`):

| Table | Key columns |
|---|---|
| `cities` | id, name |
| `localities` | the Locality fields (§4) + `imported_at` |
| `locality_profiles` | locality_id, search_intent jsonb, popular_dishes text[], price_segments jsonb, business_density numeric, data_quality numeric, complete bool, last_updated. Written by R00 |
| `dishes`, `services`, `cost_models` | the §4 fields + `imported_at` |
| `chains` | id, name, website_domain |
| `businesses` | id, kind, name, normalised_name, slug UNIQUE (allocated by the database; never changes after publish), status, locality_id, address, geo, phone, website, chain_id, branch_key, verification_status, verification_method, verified_at, confidence, last_verified_at, published_at, **auto_published bool default false, reviewed_at timestamptz null**. UNIQUE(kind, normalised_name, locality_id, coalesce(branch_key,'')) |
| `business_redirects` | from_slug, to_business_id, host |
| `restaurants` | business_id PK, cuisines text[], diet, price_level 1–3, opening_hours jsonb (`{"mon":[["11:00","23:30"]],…}` IST), service_modes, tags text[] |
| `providers` | business_id PK, specializations text[], experience_years, accepts_leads, service_localities text[], min_job_inr, sales_stage, trial_leads_remaining default 2, agreed_lead_price_inr, **founding_partner bool, price_locked_until date** |
| `restaurant_dishes` | id, business_id, dish_id, variant_label, price_inr, evidence_id, last_seen_at |
| `provider_services` | business_id, service_id |
| `sources` | id, kind, url (NULL only when kind = first_hand), domain_etld1, owner_group, title, content_hash, http_status, fetched_at, experience_id |
| `evidence` | id, entity_type ('business'\|'restaurant_dish'\|'provider_service'\|'locality'\|'cost_model'), entity_id, claim_type, claim jsonb, supporting_quote, source_id, retrieved_at, valid_until, confidence 0–1, extractor_version, status |
| `experiences` | id, business_id, visited_at, dishes jsonb `[{dish_id, price_paid_inr, rating 1–5, notes}]`, overall_rating, would_recommend, tags text[], notes, prose_status |
| `experience_photos` | id, experience_id, storage_path, thumb_path, width, height, alt, published bool |
| `observations` | id, entity_type, entity_id, attribute, old_value jsonb, new_value jsonb, observed_at, source_id, confidence, extractor_version, actor ('admin'\|'csv'\|'pipeline'\|'ask'). **Written only by a trigger** on the tracked columns of businesses, restaurants, providers, restaurant_dishes and cost_models |
| `ranking_runs` | id, kind ('food'\|'provider'\|'hot'), started_at, finished_at, config_hash |
| `recommendations` | run_id, page_key, entity_id, rank, organic_score, components jsonb, labels jsonb, commercial_score |
| `leads` | `LeadRecord` (§6a) |
| `lead_assignments` | id, lead_id, provider_id, mode, price_inr, sent_at, accepted_at, outcome, quoted_amount_inr, final_amount_inr, area_quantity, tier, refund_reason, credited. Constraint: at most 3 shared per lead; an exclusive assignment excludes all others |
| `lead_prices` | service_id, grade, price_inr. Seeded from `data/lead-pricing.json` and editable in the admin |
| `provider_credits` | id, provider_id, amount_inr (+ purchase / − spend), note, created_by |
| `featured_listings` | id, business_id, tier, locality_ids, category_ids, starts_on, ends_on, status |
| `advertisers`, `campaigns`, `ad_slots` | spec §31 fields; `campaigns.kind` ∈ ('sponsorship','banner') |
| `sales_quotes` | id, business_id, product, locality_id, service_id, price_quoted_inr, discount_reason, outcome, objection, decided_at |
| `queries` | id, vertical, intent jsonb, locality_id, candidate_ids uuid[], ranks int[], served_from ('cache'\|'db'\|'live'), lookup_id. **No IP address, and no free text beyond 200 characters** |
| `ask_lookups` | id, intent_key, status ('pending'\|'done'\|'failed'), result jsonb |
| `events_daily` | day, host, page_type, event, locality_id, subject_id, entity_id, ranking_run_id, slot, campaign_id, variant, referrer_class, device, landing_path, count. PK on every column except count |
| `demand_daily` | day, vertical, locality_id, subject_id, distinct_visitors. Incremented at most once per (day, visitor_hmac, subject, locality), via the `rate_buckets` key `demand:{day}:{hmac}:{subject}:{locality}`, and only when `verified` |
| `feedback` | id, page_key, entity_id, kind ('useful'\|'not_useful'\|'outdated'), note ≤ 500 chars |
| `search_demand` | day, page_url, query, impressions, clicks, position |
| `jobs` | id, stage, run_id, status, started_at, finished_at, stats jsonb, error |
| `api_credentials` | fingerprint (sha256 prefix 12) PK, provider, account_label, status ('active'\|'cooling'\|'disabled'), cooldown_until, disabled_reason, daily_used, day, error_count, last_used_at. **Never the key itself** |
| `governor` | day, provider, budget, used, reserved_ask, breaker_open_until |
| `rate_buckets` | key, window_start, count |
| `system_events` | id, level, kind, message, data jsonb |
| `business_claims` | id, business_id, claimant_name, phone, email, method, status |
| `page_builds` | build_id, url, host, locale, page_type, indexable, content_hash, hash_changed_at, **noindex_since timestamptz null**, gate jsonb |
| `prose_reviews` | key (§8), status, reviewed_at, reviewer |

**Public functions (`api.*`, 🌐 = callable with the publishable key):**

| Function | Input → Output | Owner |
|---|---|---|
| 🌐 `api.submit_lead(p)` | `LeadInsert` (§6a) → `{ lead_id, ref, duplicate_of: uuid\|null }`. Idempotent on `idempotency_key`; dedupes phone + service within 30 days. `lead_type = 'reminder'` stores a nurture lead | T02b |
| 🌐 `api.record_events(p)` | `{ visitor_hmac, verified: boolean, events: EventAggregate[] }` → `void` | T02b |
| 🌐 `api.submit_feedback(p)` | `{ page_key, entity_id, kind, note, visitor_hmac }` → `void` (rate-limited) | T02b |
| 🌐 `api.ask_search(p)` | `{ intent: ParsedIntent, limit ≤ 10 }` → `AskItem[]` (published entities only; latest recommendations + active evidence; no individuals' phone numbers) | T02b |
| 🌐 `api.ask_begin(p)` | `{ intent_key, visitor_hmac, want_live }` → `{ verdict: 'allow'\|'rate_limited'\|'budget_exhausted'\|'cached', lookup_id: uuid\|null, usable: Record<Provider, string[]> }` | T02b |
| 🌐 `api.ask_commit(p)` | `{ lookup_id, result: AskResult, key_outcomes: KeyOutcome[], candidates: CandidateInput[] }` → `void` | T02b |
| 🌐 `api.ask_result(id)` | `uuid` → `{ status, result: AskResult\|null }` | T02b |
| 🌐 `api.export_catalogue()` | → `CatalogueSnapshot` (published rows and allowlisted columns only; **no leads, no individuals' phone numbers**) | T02c |

**Service-role functions (`admin_api.*`):** each one has allow and deny pgTAP cases. They are grouped by the task that uses them.
- **Credentials and governor:** `key_report(KeyOutcome[])`, `credentials_usable(provider) → string[]`, `governor_set_budget(p)`. Owner: T02b.
- **Catalogue:** `upsert_business(BusinessUpsert) → { business_id, slug, action: 'inserted'|'merged'|'queued' }` (tiered dedup, plan §8), `evidence_insert(EvidenceInsert[])`, `import_reference(p)`, `experience_upsert(p)`, `photo_register(p)`, `provider_update(p)`, `cost_model_upsert(p)`, `local_fact_upsert(p)`, `prose_review_set(key, status)`, `queue_list(filter)`, `queue_decide(p)`. Owner: T02c.
- **Leads:** `leads_list(filter)`, `lead_get(id)`, `lead_update(p)`, `lead_anonymise(id)`, `assignment_upsert(p)`, `outbox_replay(LeadInsert)`, `lead_prices_set(p)`, `credits_add(p)`. Owner: T02c.
- **Revenue and reports:** `featured_upsert(p)`, `campaign_upsert(p)`, `sales_quote_upsert(p)`, `metrics_weekly(p)`, `business_report(id)`. Owner: T02c.
- **Pipeline, builds and ops:** `ranking_commit(p)` (writes ranking_runs + recommendations + locality_profiles + quote_stats), `search_demand_upsert(rows)`, `job_begin(stage, run_id) → id`, `job_finish(id, stats, error)`, `last_successful_run(stage) → timestamptz`, `page_builds_record({ build_id, entries: ManifestEntry[] })`, `lead_paths_30d() → string[]` (landing paths only), `health_snapshot() → { db_bytes, … }`, `prune(p)`. Owner: T02c.

---

## 6. Catalogue snapshot, build manifest, CSV templates

```ts
CatalogueSnapshot = {
  snapshot_id: string; generated_at: string;
  localities: Locality[]; locality_profiles: LocalityProfile[];
  dishes: Dish[]; services: ServiceDef[]; cost_models: CostModel[];
  locality_guides: { locality_id: string; title: string; body_md: string; status: ProseStatus; sources: SourceRef[] }[];
  places: PlaceView[]; providers: ProviderView[];
  evidence: EvidenceView[];                // active + not expired
  experiences: ExperienceView[];
  recommendations: RecommendationView[];   // latest run per page_key
  featured: FeaturedView[]; campaigns: CampaignView[];
  demand: { subject_id: string; locality_id: string | null; score: number }[];
  quote_stats: { service_id: string; locality_id: string; n: number; low: number; high: number }[]; // n ≥ 3, last 180 days
  founding_slots: { service_id: string; locality_id: string; remaining: number }[];
  prose_reviews: { key: string; status: ProseStatus }[];
  redirects: { host: Host; from_path: string; to_path: string }[];
  previous_manifest: ManifestEntry[];
}
ManifestEntry = { url: string; host: Host; locale: Locale; page_type: PageType; indexable: boolean;
                  content_hash: string; hash_changed_at: string; gate: GateResult; noindex_since: string | null;
                  redirect_to: string | null }
```

- **`DATA_SOURCE=supabase`** (production) loads the snapshot through `api.export_catalogue()`. Any error fails the build.
- **`DATA_SOURCE=fixtures`** (CI and development only) loads the reference sections (localities, dishes, services, cost models, locality guides) **from `data/*.json` and `content/`** and the fake businesses, evidence and recommendations from `packages/db/fixtures/catalogue.json`. Fixture businesses are named "Example …", and the build check fails if any of them appear in a production build.
- **Build manifest:** `build/manifest.json` (`ManifestEntry[]`). It is produced **before** `astro build` by `buildManifest(snapshot, prevManifest, gateConfig, now)` in `@mm/core/gate` (C04). `content_hash` = sha256 of the canonical JSON of the page's **data inputs** (not its HTML). Apps read the path from `MM_MANIFEST_PATH` and render only URLs whose action is `build_index` or `build_noindex`. A04's sitemaps list only `indexable` entries, with `lastmod = hash_changed_at`.
- **Photos:** published `experience_photos` are downloaded by `scripts/fetch-photos.mjs` (O01b) to `apps/food/public/photos/{id}-{w}.webp` before the build. No `supabase.co` URL may appear in any `dist`.

**CSV templates** (`data/curation/`, exact header row; imported by P05):
- `places.csv`: `name,kind,locality_id,address,lat,lng,phone,website,cuisines,diet,price_level,service_modes,opening_hours,tags,source_url,retrieved_at,valid_until`
- `place_dishes.csv`: `place_name,locality_id,dish_id,variant_label,price_inr,source_url,retrieved_at,valid_until`
- `providers.csv`: `name,locality_id,address,phone,website,services,service_localities,specializations,experience_years,accepts_leads,min_job_inr,source_url,retrieved_at`
- `experiences.csv`: `place_name,locality_id,visited_at,dish_id,price_paid_inr,rating,would_recommend,tags,notes`
- `local_facts.csv`: `locality_id,topic,services,text,source_url,source_title,publisher,retrieved_at`

**CSV value rules:**
- Multi-value cells use `|`. `opening_hours` is written `mon=11:00-23:30;tue=…`.
- `source_url` is an `https://` URL, `visited` (first-hand) or `owner` (owner-entered).
- **A data row whose first field starts with `EXAMPLE` is skipped.**

---

## 6a. Derived shapes (Zod in `@mm/core/schema`, owner T01)

```ts
LeadInsert   = LeadSubmission & { phone_e164: string; grade: LeadGrade; qualified: boolean; visitor_hmac: string; synthetic: false }
LeadRecord   = LeadInsert & { id: uuid; ref: string; status: LeadStatus; whatsapp_confirmed: boolean; next_follow_up_at: ts|null;
               contact_attempts: number; remind_at: ts|null; duplicate_of: uuid|null; anonymised_at: ts|null; created_at: ts }
BusinessUpsert = { kind: BusinessKind; name: string; locality_id: string; address: string|null; geo: Geo|null; phone: string|null;
               website: string|null; chain_hint: string|null; branch_key: string|null; status: BusinessStatus; auto_published: boolean;
               restaurant: Partial<RestaurantFields>|null; provider: Partial<ProviderFields>|null; actor: 'admin'|'csv'|'pipeline'|'ask' }
EvidenceInsert = { entity_type; entity_id: string; claim_type: ClaimType; claim: Claim; supporting_quote: string|null;
               source: { kind: SourceKind; url: string|null; title: string|null; publisher: string|null; experience_id: uuid|null };
               retrieved_at: ts; valid_until: ts|null /* null → CLAIM_TIER TTL */; confidence: number; extractor_version: string }
Claim        = { price: { dish_id|null; service_id|null; price_inr: number; unit: CostUnit|'serving' } | { hours: OpeningHours }
               | { dish: { dish_id; variant_label|null } } | { service: { service_id } } | { address: string } | { phone: string }
               | { rating: { value: number; scale: number } } | { mention: { sentiment: 'positive'|'neutral'|'negative' } }
               | { offer: { text: string; ends_on: date|null } } | { availability: { text: string } } | { locality_fact: LocalFact }
               | { cost_rate: { cost_model_id: string } } }
KeyOutcome   = { provider: Provider; fingerprint: string; account_label: string; status_code: number|null;
               outcome: 'ok'|'timeout'|'auth'|'credits'|'rate_limited'|'server'|'bad_request'|'schema'; retry_after_s: number|null; tokens: number|null }
CandidateInput = BusinessUpsert & { evidence: EvidenceInsert[]; decision: 'publish'|'queue' }   // decision from autoPublish (§8)
ParsedIntent = { vertical: 'food'|'construction'; subject_id: string|null; craving: Craving|null; locality_id: string|null;
               budget_inr: number|null; diet: Diet|null; open_now: boolean; intent_key: string; confidence: number }
AskItem      = { entity_id: uuid|null; name: string; locality_id: string|null; url: string|null; summary: string;
               price_inr: number|null; labels: (BadgeLabel|TempLabel)[]; trust: TrustLabel[];
               sources: { url: string; title: string; retrieved_at: string }[]; unverified: boolean }
AskResult    = { items: AskItem[]; served_from: 'db'|'live'; citations: { url; title; retrieved_at }[] }
EventAggregate = { day: date; host: Host; page_type: PageType; event: EventName; locality_id; subject_id; entity_id; ranking_run_id;
               slot; campaign_id; variant; referrer_class: ReferrerClass; device: DeviceClass; landing_path: string|null; count: number }
LocalityProfile = { locality_id; search_intent: Record<string, number>; popular_dishes: string[]; price_segments: Record<string, number>;
               business_density: number; data_quality: number; complete: boolean; last_updated: ts }
PlaceView    = { id; slug; name; locality_id; address; geo; website; price_level; cuisines; diet; service_modes; opening_hours;
               tags; verification_status; verified_at; last_verified_at; auto_published: boolean; reviewed_at: ts|null;
               dishes: { dish_id; variant_label; price_inr|null; evidence_id; last_seen_at }[] }
ProviderView = { id; slug; name; locality_id; service_localities; services: string[]; specializations; experience_years;
               accepts_leads; verification_status; verified_at; founding_partner; auto_published; reviewed_at }   // no personal phone
EvidenceView = EvidenceInsert & { id: uuid; source_id: uuid; status: EvidenceStatus; tier: FreshnessTier }
ExperienceView = { id; business_id; visited_at; dishes: { dish_id; price_paid_inr; rating; notes }[]; overall_rating; would_recommend;
               tags; notes; prose_status; photos: { id; alt; width; height }[] }
RecommendationView = { ranking_run_id: uuid; page_key: string; entity_id: uuid; rank: number; organic_score: number;
               components: Record<string, number>; labels: (TempLabel|BadgeLabel)[] }
FeaturedView = { business_id; tier: ListingTier; locality_ids; category_ids; starts_on; ends_on }
CampaignView = { id; kind: 'sponsorship'|'banner'; advertiser_name; target_locality|null; target_category|null; creative: { text; url; image|null };
               starts_on; ends_on }
PageCandidate = { url; host: Host; locale: Locale; page_type: PageType; parent_url: string|null; entity_ids: uuid[];
               evidence_count; entity_count; relevance: number; main_text: string; data_inputs: unknown;
               prose_keys: string[]; seo_inputs: Record<keyof SEO_WEIGHTS, number>; extra: Record<string, number> }
FoodCandidate = { entity_id; components: Record<keyof FOOD_WEIGHTS, number> }       // each 0–1, computed by C03 helpers
ProviderCandidate = { entity_id; components: Record<keyof PROVIDER_WEIGHTS, number> }
HotInputs    = { components: Record<keyof HOT_WEIGHTS, number>; evidence_count: number }
BadgeInputs  = { quality_pct: number; visibility_pct: number; value_pct: number; dated_prices: number; late_hours_checked_at: ts|null;
               tags: string[]; distance_to_office_m: number|null; evidence_count: number }
```

---

## 7. HTTP contracts (Workers)

All bodies are JSON validated by Zod in `@mm/core/schema/http.ts`. Every request needs an `Origin` header that matches the host, and bodies are limited to 16 KB. Every response sets `Cache-Control: no-store`.

```ts
// POST /api/lead   (main, food, construction)
LeadSubmission = {
  lead_type: LeadType; idempotency_key: uuid; turnstile_token: string;
  consent: { version: string; accepted: true };
  name: string (1-80); phone: string;
  quote: null | { service_id; locality_id; property_type; ownership; timeline;
                  area: { preset: AreaPreset; quantity: number | null }; tier: Tier | null;
                  estimate: { low; expected; high } | null; requested_provider_id: uuid | null; notes: string | null (≤500) };
  business: null | { business_name; category; locality_id; website; whatsapp; email; description; services: string[]; preferred_placement };
  message: null | string (≤1000);
  attribution: { landing_path; page_type: PageType; referrer_class; utm_source; utm_medium; utm_campaign;
                 ranking_run_id: string | null; ref_code: string; variant: string | null } }
→ 200 { ok: true, ref, duplicate } | 202 { ok: true, ref, queued: true } | 400 { ok: false, errors } | 429
```

- **Server side, E02** normalises the phone, computes `grade` and `qualified` with C06, adds `visitor_hmac`, and calls `api.submit_lead(LeadInsert)`.
- **Outbox:** if the database call fails, the lead goes into KV `LEADS_OUTBOX` under the key `lead:{idempotency_key}`, with the value `{ submission: LeadInsert, received_at, last_error }`. The handler responds 202, and AD1b replays it through `admin_api.outbox_replay`.
- **Synthetic tests:** a request carrying the header `X-MM-Synthetic: hex(HMAC-SHA256(SYNTHETIC_SECRET, idempotency_key))` gets full validation but creates **no lead row and no alert**. It writes a `system_events` row of kind `synthetic_lead` and responds `{ ok: true, ref: "TEST-…", synthetic: true }`. Its outbox keys use the `synthetic:` prefix and are purged automatically.

```ts
// POST /api/event  (all public hosts; sendBeacon-compatible)
{ events: { name: EventName; page_type; path; locality_id; subject_id; entity_id; position; ranking_run_id; slot; campaign_id;
            variant; device; referrer_class; landing_path: string|null; lcp_ms: number|null }[] (≤ 20) } → 204
// POST /api/feedback  (food, construction)
{ page_key; entity_id: uuid|null; kind: 'useful'|'not_useful'|'outdated'; note: string|null (≤500); turnstile_token: string|null } → 204
// POST /api/ask  (food, construction)
{ q: string (2-200); locality_id: string | null; turnstile_token: string | null }
→ 200 { intent: ParsedIntent; results: AskItem[]; served_from: 'cache'|'db'; live: { status: 'none'|'pending'|'capped'; lookup_id: uuid|null } }
// GET  /api/ask/result?id=<uuid>
→ 200 { status: 'pending'|'done'|'failed'; results: AskItem[]; citations: { url; title; retrieved_at }[] }
// deploy.yml workflow_dispatch inputs (sent by AD2d, honoured by O01b)
{ reason: string; override_shrinkage: boolean }
```

**WhatsApp links** are built only by `@mm/core/leads.whatsappUrl({ text, ref })`, which produces `https://wa.me/919834346179?text=<encoded>`. The number must never appear in business data or business JSON-LD.

## 7a. DOM data attributes (read by islands; written by page tasks)

- `<body data-host data-page-type data-locality data-subject data-variant>`
- Recommendation items: `data-mm-entity`, `data-mm-run` (`ranking_run_id`), `data-mm-pos`
- Ad and sponsorship slots: `data-mm-slot`, `data-mm-campaign`, `data-end` (ISO date)
- Trackable links: `data-mm-event="website_click|call_click|direction_click|whatsapp_click|provider_click|featured_click|outbound_order_click"`

---

## 8. Gate, prose review, ranking and labels (`@mm/core`)

```ts
GateKey    = `${Host}:${PageType}`          // e.g. 'food:locality_hub' ≠ 'construction:locality_hub'
GateConfig = { pages: { [k in GateKey]?: { min_entities: number; min_evidence: number; min_relevance: number; min_unique: number;
               seo_min: number; requires_reviewed_prose: boolean; extra: Record<string, number> } };
               hysteresis_ratio: 0.8; noindex_grace_days: 30 }
GateResult = { gate_key: GateKey; scores: { evidence; entities; relevance; unique; seo }; passed: boolean; reasons: string[] }
GateDecision = { action: 'build_index' | 'build_noindex' | 'redirect_parent' | 'skip'; result: GateResult; noindex_since: string|null }
evaluateGate(c: PageCandidate, siblings: PageCandidate[], prev: ManifestEntry|null, cfg: GateConfig, reviewed: (key: string) => boolean, now: Date): GateDecision
buildManifest(snapshot: CatalogueSnapshot, cfg: GateConfig, now: Date): ManifestEntry[]   // enumerates every candidate page of every host
foodScore(c: FoodCandidate) / providerScore(c: ProviderCandidate) / hotScore(c: HotInputs) → { score; components; label? }
badges(c: BadgeInputs): BadgeLabel[]     trustLabels(e: EvidenceView[], b: PlaceView|ProviderView, now): TrustLabel[]
autoPublish(c: CandidateInput, ev: EvidenceInsert[], aggregators: AggregatorEntry[]): 'publish' | 'queue'   // @mm/extract/independence (P02a)
```

**Prose review rule.** A key counts as reviewed if `prose_reviews[key].status === 'reviewed'` **or** the source record's own status is `reviewed`. Keys map to source records as follows:

| Key | Source record |
|---|---|
| `service:{id}` | `ServiceDef.prose_status` |
| `cost_model:{id}` | `CostModel.status` |
| `dish:{id}` | `Dish.prose_status` |
| `locality:{id}:guide` | the locality guide's frontmatter `status` |
| `locality:{id}:facts` | the facts' `status` (all facts of that locality) |
| `i18n:{locale}:{url}` | translated pages (M6) |

In M1, before the admin exists, the owner marks prose reviewed by setting these file fields to `reviewed` (documented in `docs/DEPLOY.md`).

## 8a. Literal values (copied from the spec; tests assert them)

```ts
FOOD_WEIGHTS     = { relevance: .20, rating_strength: .20, review_strength: .15, dish_evidence: .15, freshness: .10, value: .10, locality_match: .10 }   // spec §12
PROVIDER_WEIGHTS = { service_match: .25, locality_match: .15, specialization: .15, review_strength: .15, verification: .15, freshness: .10, experience: .05 }  // spec §17
HOT_WEIGHTS      = { recent_mentions: .25, freshness: .20, demand_signal: .20, engagement: .15, quality: .20 }   // spec §13
HOT_BANDS        = [ [0.80, 'hot'], [0.65, 'trending'], [0.50, 'warm'], [0.35, null /* no label; hidden gem is percentile-based */], [0.00, 'cold'] ]
SEO_WEIGHTS      = { demand: .20, data_quality: .25, locality_specificity: .20, commercial_intent: .15, content_depth: .10, freshness: .10 }   // spec §57
MIN_LABEL_EVIDENCE = 3
CLAIM_TIER = { price: 'HOT', hours: 'HOT', offer: 'HOT', availability: 'HOT', dish: 'WARM', service: 'WARM', phone: 'WARM',
               rating: 'WARM', mention: 'WARM', address: 'COLD', locality_fact: 'COLD', cost_rate: 'COST' }
TIER_TTL_DAYS = { HOT: 14, WARM: 60, COLD: 365, COST: 180 }
// Titles (spec §38) — other page types follow the same pattern in C05a:
TITLE.food.dish_locality         = 'Best {Dish} in {Locality}, Pune | MarketMind AI'
TITLE.construction.locality_service = '{Service} Cost in {Locality}, Pune | MarketMind AI'
TITLE.construction.service_cost  = '{Service} Cost in Pune | MarketMind AI'   // house-construction: '{Service} Cost per Sq Ft in Pune | MarketMind AI'
// Descriptions (spec §39)
DESC.food        = 'Discover highly rated {dish} options in {locality}, Pune. Compare price, location, freshness and our latest recommendations.'
DESC.construction= 'Estimate {service} costs in {locality}, Pune, understand pricing factors and find local providers for quotes.'
```

## 9. Monetisation config and constants

```ts
AdSlotId   = 'AD_SLOT_TOP'|'AD_SLOT_AFTER_INTRO'|'AD_SLOT_AFTER_RESULTS'|'AD_SLOT_SIDEBAR'|'AD_SLOT_BEFORE_FAQ'|'AD_SLOT_FOOTER'
AdSlotRule = { host: Host; page_types: PageType[]; slots: AdSlotId[]; devices: DeviceClass[]; provider: 'adsense'|'sponsorship'; enabled: boolean }
showAd(slot, pageType, device, host, flags: { adsense: boolean; sponsorships: boolean }, rules: AdSlotRule[]): { show: boolean; provider }
NEVER_ADS: PageType[] = ['get_quotes','for_contractors','ask','legal','business','contact','not_found','thank_you']   // + the whole admin host
Experiment = { id; host: Host; page_types: PageType[]; variants: { id; weight; params: Record<string, unknown> }[]; guardrail_metric: 'quote_submit'|'recommendation_click'; active: boolean }
```

`@mm/core/constants` (owner T01) holds the spec §86 disclosure strings, the consent texts and the shared constants:
- `FEATURED_DISCLOSURE` = 'Featured placement is paid.'
- `AD_LABEL` = 'Advertisement'
- `AFFILIATE_DISCLOSURE` = 'We may receive a commission from some links.'
- `COST_DISCLAIMER` = 'Cost estimates are indicative and should not be treated as quotations.'
- `LEAD_CONSENT_V1` and `REMINDER_CONSENT_V1`, each with a version id
- every §8a literal

---

## 10. Environment variables

| Variable | main | food | constr. | admin | GH Actions |
|---|:-:|:-:|:-:|:-:|:-:|
| `SITE_URL_MAIN` / `SITE_URL_FOOD` / `SITE_URL_CONSTRUCTION` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `SUPABASE_URL` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `SUPABASE_PUBLISHABLE_KEY` | ✓ | ✓ | ✓ | | ✓ |
| `SUPABASE_SECRET_KEY` | | | | ✓ | ✓ |
| `SUPABASE_DB_URL` (session pooler, backups only) | | | | | ✓ |
| `TURNSTILE_SITE_KEY` (build-time, rendered into forms) | | | | | ✓ |
| `TURNSTILE_SECRET_KEY` | ✓ | ✓ | ✓ | | |
| `VISITOR_HMAC_SECRET` (rotated daily) | ✓ | ✓ | ✓ | | |
| `SYNTHETIC_SECRET` | ✓ | ✓ | ✓ | | ✓ |
| `LEADS_OUTBOX` (KV binding) | ✓ | ✓ | ✓ | ✓ | |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ALERT_EMAIL` (`send_email` binding + destination address) | ✓ | ✓ | ✓ | ✓ | |
| `GROQ_API_KEYS` / `EXA_API_KEYS` / `FIRECRAWL_API_KEYS` (`label:key,…`) | | ✓ | ✓ | ✓ | ✓ |
| `LIVE_ASK_DAILY_CAP` (default 50) | | ✓ | ✓ | | |
| `WHATSAPP_NUMBER` (`919834346179`) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ADSENSE_PUBLISHER_ID` / `ADSENSE_ENABLED` / `DIRECT_SPONSORSHIPS_ENABLED` | | | | | ✓ |
| `EVENTS_ENABLED` (runtime kill switch) | ✓ | ✓ | ✓ | | ✓ |
| `GA4_MEASUREMENT_ID` / `CF_WEB_ANALYTICS_TOKEN` | | | | | ✓ |
| `INDEXNOW_KEY` / `GSC_VERIFICATION` / `BING_VERIFICATION` | | | | | ✓ |
| `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` | | | | ✓ | |
| `GITHUB_DISPATCH_TOKEN` (fine-grained, Actions: write) / `GITHUB_REPO` | | | | ✓ | |
| `GSC_SERVICE_ACCOUNT_JSON` / `BACKUP_AGE_RECIPIENT` / `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | | | | | ✓ |
| `DATA_SOURCE` / `PUBLIC_LAUNCHED` / `MM_MANIFEST_PATH` | | | | | ✓ |

**Build-time values** are read with `import.meta.env` / `process.env`. **Runtime values** are read with `import { env } from 'cloudflare:workers'`. Every Worker sets `workers_dev = false` and `preview_urls = false`.

---

## 11. Route files (Astro, owner tasks in brackets)

**construction** (`apps/construction/src/pages/`)
- `index.astro`, `pune/index.astro` [A01]
- `pune/[slug]/index.astro` [A01]: dispatches to service_cost (`*-cost`), service_city or locality_hub
- `pune/[locality]/[service]/index.astro` [A01]
- `provider/[slug].astro`, `about.astro`, `404.astro` [A01]
- `cost-calculator.astro`, `get-quotes.astro`, `for-contractors.astro`, `thank-you.astro` [A02]
- `api/lead.ts`, `api/event.ts`, `api/feedback.ts` [E02]
- `api/ask.ts`, `api/ask/**` [P03]
- `robots.txt.ts`, `sitemap*.xml.ts`, `llms.txt.ts` [A04]
- `ui-fixtures/[x].astro` [T05; built only with `DATA_SOURCE=fixtures`]

**food** (`apps/food/src/pages/`)
- `index.astro`, `pune/index.astro`, `pune/[slug]/index.astro` (dish_city or locality_hub), `about.astro`, `404.astro` [F01a]
- `pune/[locality]/[slug]/index.astro` (dish_locality or locality_food_intent), `pune/[locality]/[dish]/[intent]/index.astro`, `place/[slug].astro` [F01b]
- `ask.astro` [F02]
- `api/lead.ts`, `api/event.ts`, `api/feedback.ts` [E02]
- `api/ask.ts`, `api/ask/**` [P03]
- SEO endpoints [A04]
- `{mr,hi}/**` [I01]

**main** (`apps/main/src/pages/`)
- `index.astro`, `pune/index.astro`, `pune/[locality].astro` [A03]
- `about`, `contact`, `privacy`, `terms`, `cookie-policy`, `editorial-policy`, `advertise`, `feature-your-business`, `featured`, `claim-business`, `thank-you`, `404` (`.astro`) [A03]
- `public/_redirects` (static rules, e.g. `/get-featured/` → `/feature-your-business/`) [A03]
- `ads.txt.ts` [A04]
- `api/lead.ts`, `api/event.ts` [E02]
- SEO endpoints [A04]
- `{mr,hi}/**` [I01]

**admin** (`apps/admin/src/`)
- `middleware.ts`, `lib/**` (except `lib/photos/`), `layouts/**`, `pages/index.astro` (Today shell, which imports `components/today/*`) [AD1a]
- `pages/leads/**`, `pages/providers/index.astro` [AD1b]
- `pages/places/**`, `pages/experiences/**`, `lib/photos/**` [AD2a]
- `pages/providers/**` (extends AD1b's index), `pages/prospects/**`, `pages/cost-models/**`, `pages/content/**`, `pages/queue/**`, `components/today/**` [AD2b]
- `pages/featured/**`, `pages/sponsorships/**`, `pages/sales/**`, `pages/metrics/**`, `pages/reports/**`, `pages/lead-prices/**`, `pages/credits/**` [AD2c]
- `pages/publish/**`, `pages/health/**`, `pages/api/**` [AD2d]
- `scheduled.ts` (replaces T05's stub) [O02]
