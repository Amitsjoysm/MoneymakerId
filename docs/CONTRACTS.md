# MarketMind AI: Shared Contracts

This is the single source of truth for names, shapes and interfaces. Every task in [`TASKS.md`](TASKS.md) builds against it, so tasks can run in parallel without colliding. **If a task needs a contract change, it stops and reports the change instead of improvising.** Only the orchestrator edits this file.

Spec references (`spec §N`) point to `Makemoney.txt`; plan references (`plan §N`) point to [`PLAN.md`](PLAN.md).

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Language / runtime | TypeScript `strict`, ESM only, Node ≥ 22.12 (builds and pipeline), Cloudflare Workers runtime (`/api/*`, admin) |
| Package manager | pnpm workspaces. Dependencies are declared **only** in task T00; a later task that needs a new dependency reports it and does not install it. |
| Reference-data IDs | Lowercase ASCII slugs, also used in URLs: `pune`, `hinjewadi`, `hinjewadi-phase-1`, `chicken-biryani`, `terrace-waterproofing` |
| Record IDs | `uuid` (v4 from Postgres `gen_random_uuid()`, or `crypto.randomUUID()` on the client for idempotency keys) |
| Money | Integer INR (`price_inr: 249`), never floats and never strings. Ranges use `{ low, expected, high }`. |
| Dates | ISO 8601. Timestamps are stored in UTC (`timestamptz`) and displayed in IST (`Asia/Kolkata`). Date-only fields use `YYYY-MM-DD`. |
| Phone | Stored as E.164 (`+919834346179`). Indian mobiles must match `^\+91[6-9]\d{9}$` after normalisation. |
| Geo | `{ lat: number, lng: number }` in WGS84. Distances use haversine in metres. |
| Text | Unicode NFKC-normalised before matching. Slugs are ASCII in every locale. |
| Units | `sqft`, `rft` (running feet), `unit`, `project` |
| Nullability | Optional data is `null`, not missing. LLM-facing Zod schemas use `.nullable()` (Groq strict mode requires every field). |
| File ownership | Each task owns the paths listed on its card. It never edits files owned by another task. Shared barrels (`index.ts`) are written once by T01/T05 and not edited afterwards; each module is reached through its own subpath export. |
| Tests | Vitest. Test files sit next to the code as `*.test.ts`. Workers code uses `@cloudflare/vitest-pool-workers`. The database uses pgTAP in `supabase/tests/`. |
| Commits | Only the orchestrator commits, after each wave has been verified. |

---

## 2. Package map and public entry points

Every package is `@mm/<name>`, and its subpaths are declared up front in `package.json#exports` by T00/T01.

| Package | Subpath exports (owner task) |
|---|---|
| `@mm/core` | `/schema` (T01) · `/config` (T01) · `/constants` (T01) · `/locality` (C01) · `/intent` (C01) · `/cost` (C02) · `/ranking` (C03) · `/labels` (C03) · `/gate` (C04) · `/seo` (C05) · `/links` (C05) · `/i18n` (C05) · `/leads` (C06) · `/monetization` (C07) · `/season` (C07) |
| `@mm/ui` | `/tokens.css` · `/layouts/*` · `/components/*` (T03; islands per app task) |
| `@mm/db` | `/client` (E01) · `/catalogue` (E01) · `/fixtures` (E01) |
| `@mm/providers` | `/pool` · `/exa` · `/firecrawl` · `/groq` · `/errors` (P01) |
| `@mm/extract` | `/deterministic` · `/groq-normalise` · `/grounding` · `/independence` (P02) |
| `@mm/edge` | `/lead` · `/event` · `/feedback` (E02) · `/alerts` (E03) · `/turnstile` · `/visitor` (E02) · `/ask` (P03) |
| `@mm/pipeline` | CLI `mm` with commands: `import:csv` (P05), `discover`, `refresh`, `extract`, `normalise`, `rank`, `gsc`, `indexnow`, `backup`, `health` (P04) |

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
FreshnessTier     = 'HOT' | 'WARM' | 'COLD' | 'COST'          // TTL days: 14 | 60 | 365 | 180
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
LeadType          = 'quote' | 'featured_enquiry' | 'advertise' | 'claim' | 'contact' | 'for_contractors'
LeadStatus        = 'new' | 'contacted' | 'qualified' | 'assigned' | 'won' | 'lost' | 'spam' | 'nurture'
LeadGrade         = 'A' | 'B' | 'C'
AssignmentMode    = 'shared' | 'exclusive'
AssignmentOutcome = 'none' | 'contacted' | 'site_visit' | 'won' | 'lost'
RefundReason      = 'wrong_number' | 'out_of_area' | 'duplicate' | 'not_owner'
SalesStage        = 'prospect' | 'contacted' | 'trial' | 'paying' | 'churned'
ListingTier       = 'free' | 'featured' | 'premium'
SalesProduct      = 'featured' | 'premium' | 'sponsorship' | 'lead_pack'
TempLabel         = 'hot' | 'trending' | 'warm' | 'hidden_gem' | 'cold'
BadgeLabel        = 'best_value' | 'late_night' | 'family' | 'office_lunch'
TrustLabel        = 'verified' | 'recently_checked' | 'source_backed' | 'price_checked' | 'hours_checked'
Host              = 'main' | 'food' | 'construction' | 'admin'
Locale            = 'en' | 'mr' | 'hi'
ReferrerClass     = 'search' | 'ai' | 'social' | 'direct' | 'other'
DeviceClass       = 'mobile' | 'tablet' | 'desktop'
Provider          = 'groq' | 'exa' | 'firecrawl'
EventName         = 'search' | 'filter' | 'recommendation_click' | 'website_click' | 'call_click'
                  | 'direction_click' | 'whatsapp_click' | 'quote_start' | 'quote_step' | 'quote_submit'
                  | 'calculator_start' | 'calculator_complete' | 'featured_click' | 'provider_click'
                  | 'profile_view' | 'list_impression' | 'ad_impression' | 'ad_click'
                  | 'ask_submit' | 'feedback' | 'outbound_order_click'
PageType          = 'home' | 'city_hub' | 'locality_hub' | 'dish_city' | 'dish_locality' | 'food_intent'
                  | 'locality_food_intent' | 'place' | 'service_cost' | 'service_city' | 'locality_service'
                  | 'provider' | 'calculator' | 'get_quotes' | 'for_contractors' | 'ask' | 'locality_guide'
                  | 'legal' | 'business' | 'about' | 'not_found' | 'thank_you'
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
  neighbours: string[];                 // ids; must be symmetric (test)
  landmarks: string[]; commercial_centres: string[]; office_clusters: string[]; residential_clusters: string[];
  construction_facts: LocalFact[];
  food_notes: LocalFact[];
  i18n: { mr: { name: string } | null; hi: { name: string } | null };
}
LocalFact = { id: string; topic: 'housing_stock'|'building_age'|'water'|'soil'|'rainfall'|'rules'|'access'|'demand'|'other';
              text: string; services: string[]; sources: SourceRef[]; status: ProseStatus }

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

// data/cost-models/{service_id}.json → CostModel[]
CostModel = { id: string; service_id: string; scope_id: string | null; material_id: string | null; tier: Tier;
  unit: CostUnit; rate_inr: { low: number; expected: number; high: number };   // per unit
  min_job_inr: number | null;
  components: { materials: number; labour: number; preparation: number; repair: number; transport: number; waste: number }; // fractions, sum = 1 ± 0.01
  locality_factors: { locality_id: string; factor: number; sources: SourceRef[] }[];
  sources: SourceRef[];                 // ≥ 2, independent (different publishers)
  reviewed_at: 'YYYY-MM-DD'; valid_until: 'YYYY-MM-DD'; status: ProseStatus; notes: string }

// data/seasonal-calendar.json → { months: Record<'1'..'12', { services: string[]; headline: string; cta: string; module: string | null }> }
// data/lead-pricing.json      → { currency: 'INR'; exclusive_multiplier: number; prices: { service_id: string; grade: LeadGrade; price_inr: number }[] }
// data/gate.json              → GateConfig (§8)
// data/ad-slots.json          → AdSlotRule[] (§9)
// data/experiments.json       → Experiment[] (§9)
// data/demand.csv             → service_or_dish,sub_id,locality_id,monthly_searches,est_lead_value_inr,data_ready(0-1),source
// data/aggregators.json       → { domain: string; owner_group: string; discovery_only: true }[]
// data/curation/*.csv         → see §6
```

## 4a. Fixed reference IDs (so data tasks can run in parallel)

**City:** `pune`

**Localities (spec §5), kind `locality`:** `hinjewadi`, `wakad`, `baner`, `balewadi`, `aundh`, `kothrud`, `viman-nagar`, `kharadi`, `hadapsar`, `koregaon-park`, `shivajinagar`, `camp`, `kondhwa`, `wagholi`, `lohegaon`, `pimple-saudagar`, `pimple-nilakh`, `pimpri`, `chinchwad`, `magarpatta`
- **Sub-localities** (`sub_locality`, parent `hinjewadi`): `hinjewadi-phase-1`, `hinjewadi-phase-2`, `hinjewadi-phase-3`
- **Landmarks** (`landmark`): IDs are prefixed `near-` and each needs a parent locality, e.g. `near-rajiv-gandhi-infotech-park` (parent `hinjewadi`). D01 may add more, and every landmark needs a source.

**Dishes (spec §8 ∪ §100), with `parent_id` null:** `biryani`, `samosa`, `vada-pav`, `misal-pav`, `momos`, `dosa`, `pizza`, `burger`, `poha`, `pav-bhaji`, `shawarma`, `chole-bhature`, `thali`, `kebab`, `sandwich`, `desserts`
- **Variants** use `{variant}-{parent}`, e.g. `chicken-biryani`, `mutton-biryani`, `veg-biryani`, `chicken-momos`, `masala-dosa`. Only D02 adds variants.

**Construction services (spec §99), top level:** `waterproofing`, `painting`, `bathroom-renovation`, `modular-kitchen`, `house-construction`
- **Sub-services:** `terrace-waterproofing`, `bathroom-waterproofing`, `external-wall-waterproofing`, `basement-waterproofing`, `leakage-repair` (all under `waterproofing`) · `interior-painting`, `exterior-painting` (under `painting`)
- **City cost-guide slug:** `{service_id}-cost`, e.g. `terrace-waterproofing-cost`, `house-construction-cost`
- **Reserved slugs** (must never be used as a locality, dish or service ID): `late-night-food`, `budget-food`, `veg-food`, `veg`, `late-night`, `family`, `office-lunch`, `under-*`, anything ending in `-cost`, `ask`, `about`, `api`

---

## 5. Database (`supabase/migrations`, owner: T02)

**Schemas:**
- `app`: all tables. Not exposed through the API. `ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM anon, authenticated`.
- `api`: the only exposed schema. Contains only `SECURITY DEFINER` functions with `SET search_path = ''`, each validating its own input. `GRANT EXECUTE` goes to `anon` (publishable key) **only** for the functions marked 🌐 below; everything else is executable by `service_role` only.

**Tables** (columns follow the §3 enums and §4 shapes; every table has `created_at` and `updated_at`):

| Table | Key columns |
|---|---|
| `cities` | id, name |
| `localities` | Locality fields (§4) + `i18n jsonb` |
| `locality_profiles` | locality_id, search_intent jsonb, popular_dishes text[], price_segments jsonb, business_density numeric, data_quality numeric, complete bool, last_updated |
| `dishes`, `services`, `cost_models` | mirrors of the curated files (loaded by `mm import:reference`) |
| `chains` | id, name, website_domain |
| `businesses` | id, kind, name, normalised_name, slug UNIQUE (allocated by the database, never changed after publish), status, locality_id, address, geo, phone, website, chain_id, branch_key, verification_status, verification_method, verified_at, confidence, last_verified_at, published_at. UNIQUE(kind, normalised_name, locality_id, coalesce(branch_key,'')) |
| `business_redirects` | from_slug, to_business_id (renames → 301) |
| `restaurants` | business_id PK, cuisines text[], diet, price_level 1–3, opening_hours jsonb (`{"mon":[["11:00","23:30"]],…}` IST), service_modes, tags text[] |
| `providers` | business_id PK, specializations text[], experience_years, accepts_leads, service_localities text[], min_job_inr, sales_stage, trial_leads_remaining default 2, agreed_lead_price_inr |
| `restaurant_dishes` | id, business_id, dish_id, variant_label, price_inr, evidence_id, last_seen_at |
| `provider_services` | business_id, service_id |
| `sources` | id, kind, url (NULL only when kind=first_hand), domain_etld1, owner_group, title, content_hash, http_status, fetched_at, experience_id |
| `evidence` | id, entity_type ('business'\|'restaurant_dish'\|'provider_service'\|'locality'\|'cost_model'), entity_id, claim_type, claim jsonb, supporting_quote, source_id, retrieved_at, valid_until, confidence 0–1, extractor_version, status |
| `experiences` | id, business_id, visited_at, dishes jsonb `[{dish_id, price_paid_inr, rating 1–5, notes}]`, overall_rating, would_recommend, tags text[], notes, prose_status |
| `experience_photos` | id, experience_id, storage_path, width, height, alt, published bool |
| `observations` | id, entity_type, entity_id, attribute, old_value jsonb, new_value jsonb, observed_at, source_id, confidence, extractor_version, actor ('admin'\|'csv'\|'pipeline'\|'ask'). **Written only by a trigger** on the tracked columns of businesses, restaurants, providers, restaurant_dishes and cost_models |
| `ranking_runs` | id, kind ('food'\|'provider'\|'hot'), started_at, finished_at, config_hash |
| `recommendations` | run_id, page_key, entity_id, rank, organic_score, components jsonb, labels jsonb, commercial_score |
| `leads` | see §7 `LeadRecord` |
| `lead_assignments` | id, lead_id, provider_id, mode, price_inr, sent_at, accepted_at, outcome, quoted_amount_inr, final_amount_inr, refund_reason, credited. Constraint: at most 3 shared per lead; an exclusive assignment excludes all others |
| `provider_credits` | id, provider_id, amount_inr (+ purchase / − spend), note, created_by |
| `featured_listings` | id, business_id, tier, locality_ids, category_ids, starts_on, ends_on, status |
| `advertisers`, `campaigns`, `ad_slots` | spec §31 fields; `campaigns.kind` ∈ ('sponsorship','banner') |
| `sales_quotes` | id, business_id, product, locality_id, service_id, price_quoted_inr, discount_reason, outcome, objection, decided_at |
| `queries` | id, vertical, intent jsonb, locality_id, candidate_ids uuid[], ranks int[], served_from ('cache'\|'db'\|'live'), lookup_id, created_at. **No IP address and no free text beyond 200 characters** |
| `ask_lookups` | id, intent_key, status ('pending'\|'done'\|'failed'), result jsonb, created_at |
| `events_daily` | day, host, page_type, event, locality_id, subject_id, entity_id, variant, count. PK on all dimensions |
| `demand_daily` | day, vertical, locality_id, subject_id, distinct_visitors |
| `feedback` | id, page_key, entity_id, kind ('useful'\|'not_useful'\|'outdated'), note ≤ 500 chars |
| `search_demand` | day, page_url, query, impressions, clicks, position |
| `jobs` | id, stage, run_id, status, started_at, finished_at, stats jsonb, error |
| `api_credentials` | fingerprint (sha256 prefix 12) PK, provider, account_label, status ('active'\|'cooling'\|'disabled'), cooldown_until, disabled_reason, daily_used, day, error_count, last_used_at. **Never the key itself** |
| `governor` | day, provider, budget, used, reserved_ask, breaker_open_until |
| `rate_buckets` | key (visitor HMAC or global), window_start, count |
| `system_events` | id, level, kind, message, data jsonb, created_at |
| `business_claims` | id, business_id, claimant_name, phone, email, method, status |
| `page_builds` | build_id, url, host, locale, page_type, indexable, content_hash, hash_changed_at, gate jsonb, created_at |
| `prose_reviews` | key ('service:waterproofing', 'locality:wakad:guide', …), status, reviewed_at, reviewer |

**`api.*` functions** (inputs and outputs are JSON, validated against the matching Zod schemas in `@mm/core/schema/api.ts`):

| Function | Who calls it | Input → Output |
|---|---|---|
| 🌐 `api.submit_lead(p)` | public Workers | `LeadSubmission` → `{ lead_id, ref, duplicate_of: uuid \| null }` (idempotent on `idempotency_key`; dedupes phone + service within 30 days) |
| 🌐 `api.record_events(p)` | public Workers | `{ events: EventAggregate[] }` → `void` (upserts `events_daily` and `demand_daily`) |
| 🌐 `api.ask_begin(p)` | public Workers | `{ intent_key, visitor_hmac, want_live }` → `{ verdict: 'allow'\|'rate_limited'\|'budget_exhausted'\|'cached', lookup_id: uuid\|null, usable: Record<Provider, string[]> }` |
| 🌐 `api.ask_commit(p)` | public Workers | `{ lookup_id, result: AskResult, key_outcomes: KeyOutcome[], candidates: CandidateInput[] }` → `void` |
| 🌐 `api.ask_result(id)` | public Workers | `uuid` → `{ status, result: AskResult \| null }` |
| 🌐 `api.submit_feedback(p)` | public Workers | `{ page_key, entity_id: uuid\|null, kind, note: string\|null }` → `void` (rate-limited per visitor HMAC) |
| 🌐 `api.export_catalogue()` | builds | → `CatalogueSnapshot` (§6; published rows and allowlisted columns only, **no leads, no phone numbers of individuals**) |
| `api.upsert_business(p)` | admin, pipeline | `BusinessUpsert` → `{ business_id, slug, action: 'inserted'\|'merged'\|'queued' }` (tiered dedup, plan §8) |
| `api.key_report(p)` | providers (pipeline/admin) | `KeyOutcome[]` → `void` |
| `api.credentials_usable(provider)` | providers | → `string[]` (fingerprints) |

---

## 6. Catalogue snapshot and CSV templates

```ts
CatalogueSnapshot = {
  snapshot_id: string; generated_at: string;
  localities: Locality[]; locality_profiles: LocalityProfile[];
  dishes: Dish[]; services: ServiceDef[]; cost_models: CostModel[];
  places: PlaceView[]; providers: ProviderView[];
  evidence: EvidenceView[];                // active + not expired, with source title/url/kind/retrieved_at
  experiences: ExperienceView[];           // published photos as storage paths (copied into build)
  recommendations: RecommendationView[];   // latest run per page_key, includes ranking_run_id
  featured: FeaturedView[]; campaigns: CampaignView[];
  demand: { subject_id: string; locality_id: string | null; score: number }[];
  quote_stats: { service_id: string; locality_id: string; n: number; low: number; high: number }[]; // n ≥ 3, 180 days
  prose_reviews: { key: string; status: ProseStatus }[];
  previous_manifest: ManifestEntry[];      // last deployed manifest (hysteresis + shrinkage guard)
}
ManifestEntry = { url: string; host: Host; locale: Locale; page_type: PageType; indexable: boolean;
                  content_hash: string; hash_changed_at: string; gate: GateResult; noindex_since: string | null }
```

`DATA_SOURCE=supabase` loads this snapshot through `api.export_catalogue()`, and any error fails the build. `DATA_SOURCE=fixtures` loads `packages/db/fixtures/catalogue.json` and is allowed only in CI and development.

**CSV templates** (`data/curation/`, header row exact; P05 imports them):
- `places.csv`: `name,kind,locality_id,address,lat,lng,phone,website,cuisines,diet,price_level,service_modes,opening_hours,tags,source_url,retrieved_at,valid_until`
- `place_dishes.csv`: `place_name,locality_id,dish_id,variant_label,price_inr,source_url,retrieved_at,valid_until`
- `providers.csv`: `name,locality_id,address,phone,website,services,service_localities,specializations,experience_years,accepts_leads,min_job_inr,source_url,retrieved_at`
- `experiences.csv`: `place_name,locality_id,visited_at,dish_id,price_paid_inr,rating,would_recommend,tags,notes`
- `local_facts.csv`: `locality_id,topic,services,text,source_url,source_title,publisher,retrieved_at`

`source_url` may be `visited` (first-hand) or `owner` (owner-entered). Every other value must be an `https://` URL.

---

## 7. HTTP contracts (Workers)

All bodies are JSON and validated by Zod in `@mm/core/schema/http.ts`. The `Origin` header must match the host. Bodies are limited to 16 KB. Every response sets `Cache-Control: no-store`.

```ts
// POST /api/lead   (main, construction; food for featured enquiries)
LeadSubmission = {
  lead_type: LeadType; idempotency_key: uuid; turnstile_token: string;
  consent: { version: string; accepted: true };
  name: string (1-80); phone: string;                       // normalised server-side
  quote: null | { service_id; locality_id; property_type: PropertyType; ownership: Ownership; timeline: Timeline;
                  area: { preset: AreaPreset; quantity: number | null }; tier: Tier | null;
                  estimate: { low; expected; high } | null; requested_provider_id: uuid | null; notes: string | null (≤500) };
  business: null | { business_name; category; locality_id; website; whatsapp; email; description; services: string[]; preferred_placement };
  message: null | string (≤1000);
  attribution: { landing_path; page_type: PageType; referrer_class: ReferrerClass; utm_source; utm_medium; utm_campaign;
                 ranking_run_id: string | null; ref_code: string; variant: string | null } }
→ 200 { ok: true, ref, duplicate: boolean } | 202 { ok: true, ref, queued: true }  (outbox) | 400 { ok: false, errors } | 429

// POST /api/event  (all public hosts)   — sendBeacon-compatible
{ events: { name: EventName; page_type; path; locality_id; subject_id; entity_id; position; ranking_run_id; slot; campaign_id; variant; device: DeviceClass; referrer_class: ReferrerClass }[] (≤ 20) }
→ 204

// POST /api/ask    (food, construction)
{ q: string (2-200); locality_id: string | null; turnstile_token: string | null }
→ 200 { intent: ParsedIntent; results: AskItem[]; served_from: 'cache'|'db'; live: { status: 'none'|'pending'|'capped'; lookup_id: uuid|null } }
// POST /api/feedback (food, construction)  { page_key; entity_id: uuid|null; kind: 'useful'|'not_useful'|'outdated'; note: string|null (≤500); turnstile_token: string|null } → 204
// GET  /api/ask/result?id=<uuid>
→ 200 { status: 'pending'|'done'|'failed'; results: AskItem[]; citations: { url; title; retrieved_at }[] }
```

**WhatsApp links** are built only by `@mm/core/leads.whatsappUrl({ text, ref })`, which produces `https://wa.me/919834346179?text=<encoded>`. The number comes from `WHATSAPP_NUMBER` and **must never appear in business data or business JSON-LD**.

---

## 8. Gate, ranking and labels (`@mm/core`)

```ts
GateConfig = { [page_type in PageType]?: { min_entities: number; min_evidence: number; min_relevance: number;
               min_unique: number /*0.5*/; seo_min: number; requires_reviewed_prose: boolean; extra: Record<string, number> } ;
               hysteresis_ratio: 0.8; noindex_grace_days: 30 }
GateResult = { page_type; scores: { evidence: number; entities: number; relevance: number; unique: number; seo: number };
               passed: boolean; reasons: string[] }
evaluateGate(candidate: PageCandidate, siblings: PageCandidate[], prev: ManifestEntry | null, cfg: GateConfig, now: Date): GateDecision
// GateDecision = { action: 'build_index' | 'build_noindex' | 'redirect_parent' | 'skip'; result: GateResult }
foodScore(c: FoodCandidate): { score: number; components: Record<'relevance'|'rating_strength'|'review_strength'|'dish_evidence'|'freshness'|'value'|'locality_match', number> }   // spec §12 weights
providerScore(c: ProviderCandidate): { score; components }                                                                                      // spec §17 weights
hotScore(c: HotInputs): { score; label: TempLabel | null }   // label null if evidence < MIN_LABEL_EVIDENCE
badges(c: BadgeInputs): BadgeLabel[]; trustLabels(e: EvidenceView[], b: PlaceView|ProviderView, now): TrustLabel[]
```

## 9. Monetisation config

```ts
AdSlotId   = 'AD_SLOT_TOP'|'AD_SLOT_AFTER_INTRO'|'AD_SLOT_AFTER_RESULTS'|'AD_SLOT_SIDEBAR'|'AD_SLOT_BEFORE_FAQ'|'AD_SLOT_FOOTER'
AdSlotRule = { host: Host; page_types: PageType[]; slots: AdSlotId[]; devices: DeviceClass[]; provider: 'adsense'|'sponsorship'; enabled: boolean }
showAd(slot, pageType, device, host, flags: { adsense: boolean; sponsorships: boolean }, rules: AdSlotRule[]): { show: boolean; provider }
NEVER_ADS: PageType[] = ['get_quotes','for_contractors','ask','legal','business','not_found','thank_you']   // + admin host
Experiment = { id; host: Host; page_types: PageType[]; variants: { id; weight; params: Record<string, unknown> }[]; guardrail_metric: 'quote_submit'|'recommendation_click'; active: boolean }
```

**Disclosure constants** live in `@mm/core/constants` (spec §86). Templates import them rather than writing their own text.
- `FEATURED_DISCLOSURE = 'Featured placement is paid.'`
- `AD_LABEL = 'Advertisement'`
- `AFFILIATE_DISCLOSURE = 'We may receive a commission from some links.'`
- `COST_DISCLAIMER = 'Cost estimates are indicative and should not be treated as quotations.'`
- `LEAD_CONSENT_V1` = the consent text from plan §13, together with its version id.

---

## 10. Environment variables

| Variable | main | food | constr. | admin | GH Actions |
|---|:-:|:-:|:-:|:-:|:-:|
| `SITE_URL_MAIN` / `SITE_URL_FOOD` / `SITE_URL_CONSTRUCTION` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `SUPABASE_URL` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `SUPABASE_PUBLISHABLE_KEY` | ✓ | ✓ | ✓ | | ✓ |
| `SUPABASE_SECRET_KEY` | | | | ✓ | ✓ |
| `SUPABASE_DB_URL` (session pooler, backups) | | | | | ✓ |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | ✓ | ✓ | ✓ | | |
| `VISITOR_HMAC_SECRET` (rotated daily) | ✓ | ✓ | ✓ | | |
| `LEADS_OUTBOX` (KV binding) | ✓ | ✓ | ✓ | ✓ | |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ALERT_EMAIL` (`send_email` binding + destination) | ✓ | ✓ | ✓ | ✓ | |
| `GROQ_API_KEYS` / `EXA_API_KEYS` / `FIRECRAWL_API_KEYS` (`label:key,…`) | | ✓ | ✓ | ✓ | ✓ |
| `LIVE_ASK_DAILY_CAP` (default 50) | | ✓ | ✓ | | |
| `WHATSAPP_NUMBER` (`919834346179`) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ADSENSE_PUBLISHER_ID` / `ADSENSE_ENABLED` / `DIRECT_SPONSORSHIPS_ENABLED` | ✓ | ✓ | ✓ | | ✓ |
| `EVENTS_ENABLED` / `GA4_MEASUREMENT_ID` / `CF_WEB_ANALYTICS_TOKEN` | ✓ | ✓ | ✓ | | ✓ |
| `INDEXNOW_KEY` / `GSC_VERIFICATION` / `BING_VERIFICATION` | | | | | ✓ |
| `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` | | | | ✓ | |
| `GITHUB_DISPATCH_TOKEN` / `GITHUB_REPO` | | | | ✓ | |
| `GSC_SERVICE_ACCOUNT_JSON` / `BACKUP_AGE_RECIPIENT` / `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | | | | | ✓ |
| `DATA_SOURCE` (`supabase`\|`fixtures`) / `PUBLIC_LAUNCHED` (`false` until sign-off) | | | | | ✓ |

**Build-time values** are read with `import.meta.env` / `process.env` during the build. **Runtime values** are read with `import { env } from 'cloudflare:workers'`. Every Worker sets `workers_dev = false` and `preview_urls = false`.

---

## 11. Route files (Astro, owner tasks in brackets)

**construction** (`apps/construction/src/pages/`)
- `index.astro` [A01]
- `pune/index.astro` [A01]
- `pune/[slug]/index.astro` [A01]: dispatches service_cost (`*-cost`) · service_city · locality_hub
- `pune/[locality]/[service]/index.astro` [A01]
- `provider/[slug].astro` [A01]
- `cost-calculator.astro`, `get-quotes.astro`, `for-contractors.astro` [A02]
- `about.astro`, `404.astro` [A01]
- `api/lead.ts`, `api/event.ts`, `api/feedback.ts`, `api/ask.ts`, `api/ask/result.ts` [thin re-exports of `@mm/edge`; E02/P03]
- `robots.txt.ts`, `sitemap*.xml.ts`, `llms.txt.ts` [A04]

**food** (`apps/food/src/pages/`)
- `index.astro` [F01]
- `pune/index.astro` [F01]
- `pune/[slug]/index.astro` [F01]: dish_city · locality_hub
- `pune/[locality]/[slug]/index.astro` [F01]: dish_locality · locality_food_intent
- `pune/[locality]/[dish]/[intent]/index.astro` [F01]
- `place/[slug].astro` [F01]
- `ask.astro` [F02]
- `about.astro`, `404.astro` [F01]
- `api/*` [E02/P03]
- SEO endpoints [A04]

**main** (`apps/main/src/pages/`)
- `index.astro`, `pune/index.astro`, `pune/[locality].astro` [A03]
- `about`, `contact`, `privacy`, `terms`, `cookie-policy`, `editorial-policy`, `advertise`, `feature-your-business`, `featured`, `claim-business` (`.astro`) [A03]
- `ads.txt.ts` [A04]
- `api/lead.ts`, `api/event.ts` [E02]
- SEO endpoints [A04]
- `/get-featured/` → 301 to `/feature-your-business/` in `public/_redirects` [A03]

**admin** (`apps/admin/src/pages/`)
- `index.astro` (Today), `leads/**` [AD1, extended AD2c]
- `places/**`, `experiences/**` [AD2a]
- `providers/**`, `prospects/**`, `cost-models/**`, `content/**`, `queue/**` [AD2b]
- `featured/**`, `sponsorships/**`, `sales/**`, `metrics/**`, `reports/**` [AD2c]
- `publish/**`, `health/**`, `api/**` [AD2d]
- `src/middleware.ts` (Access JWT check) [AD1]
- `src/scheduled.ts` (Cron Trigger → workflow_dispatch) [O02]
