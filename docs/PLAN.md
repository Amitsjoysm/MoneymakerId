# MarketMind AI: Build Plan v2

**Status:** APPROVED by the owner on 6 October 2026. Work is broken into dependency-mapped tasks in [`docs/TASKS.md`](TASKS.md), built against the shared interfaces in [`docs/CONTRACTS.md`](CONTRACTS.md).
**Date:** 6 October 2026
**Inputs:** `Makemoney.txt` (the MarketMind AI Final MVP spec, cited as "spec §N"), the owner's answers (§1), a fact-check of every vendor dependency (Appendix), and an independent three-critic review covering spec coverage, technical risk and revenue (43 findings, all addressed below).

---

## 0. Goal and definition of done

**Business goal:** bring in as much Pune local search traffic as possible and turn it into revenue quickly.
- **Construction:** leads first (the highest value per visitor), then featured providers, then sponsorship. Display ads come last and stay off the lead pages by default.
- **Food:** featured listings, then sponsorship and affiliate links, then display ads.

**v1 is done when all of these are true:**

1. **Construction.** At least **40 locality × service pages and 10 or more city cost guides** pass the quality gate (§5), built from sourced local data. On each one, a visitor sees:
   - a cited cost range with a calculator (BHK presets, live estimate)
   - local cost drivers
   - providers, once any accept leads
   - an inline quote form

   A submitted lead is stored even if the database is down (outbox), alerts the owner instantly, and offers a one-tap WhatsApp handoff to 91 98343 46179.
2. **Food.** *"best biryani in Hinjewadi"* resolves to a page only when evidence exists: first-hand visits, grounded and cited claims, and dated prices. Without enough evidence the page is not built. It is never padded.
3. **Admin.** The owner can add places, dishes, prices, **personal experiences with photos**, providers, cost data, featured listings and sponsorships through the admin. The owner can also work leads (assign, follow up, record revenue) and trigger a rebuild.
4. **Live Ask.** The Ask box answers from the database instantly. On a miss it runs a live Exa + Groq lookup inside free-tier limits and returns grounded, cited results. Everything fetched is stored in a strict, reusable format.
5. **Honesty.** No fabricated businesses, prices, ratings or reviews exist anywhere. Every rendered claim shows its source and the date it was checked. Paid placement is always labelled.
6. **Supabase hardening.** The database uses the new API keys. Public Workers can only call a small set of database functions; they never touch tables directly.
7. **Launch gate.** `pnpm launch:check` passes (§20), and the owner signs off before any host is opened to search engines.
8. **CI.** CI is green on a clean clone: install, typecheck, lint, unit tests, database tests, Workers-runtime tests and all builds. Lighthouse mobile scores on one page of each type: Performance ≥ 95, SEO 100, Accessibility ≥ 95, CLS < 0.1.

---

## 1. Decisions made (your answers)

| Topic | Decision |
|---|---|
| Hostnames | Subdomains: `marketmindai.com` (brand, trust, business pages, **Pune locality guides**), `food.marketmindai.com`, `construction.marketmindai.com`, and the private `admin.marketmindai.com`. |
| Hosting | Cloudflare **Workers with static assets** (Cloudflare's current recommendation; the Astro adapter no longer supports Pages). |
| Cost policy | **Free tiers only**: Workers Free, Supabase Free, Groq / Exa / Firecrawl free tiers. The design must fit these limits (§9, §10, §19). |
| Provider keys | **Owner decision:** multiple accounts per provider, with automatic key rotation. See the risk note in §10. |
| Data sources | Automated pipeline (Exa + Firecrawl + Groq), manual CSV curation, and the **admin UI for personal experiences**. |
| Launch order | Construction first. Food pages publish as evidence arrives. |
| Live Ask | Real-time Groq + Exa answers on database misses. **Cap: 50 uncached live lookups per day** (≈ $0.016 each, so at most about $24/month of usage, which the free credits absorb first). Anonymous search demand per locality feeds "popular here" modules. |
| Leads | Supabase, plus a WhatsApp handoff to 91 98343 46179 (MarketMind AI / Sarbanand). |
| Admin login | Cloudflare Access email one-time PIN, with server-side JWT verification on every request. |
| Web-found places | Auto-publish when ≥ 2 **independent** sources agree and claims are grounded (§8). Everything else goes to the approval queue. |
| Languages | English everywhere. Marathi and Hindi versions of the top pages come in M6, with routing prepared from M0. Translations ship `noindex` until you review them. |
| Featured pricing | "Contact for pricing" on public pages. Prices, lead prices and quotes are recorded in the admin. |
| Experience photos | Yes. Photos are resized to WebP on your phone before upload, then copied into the static build (never hot-linked from Supabase). |
| Analytics | Cloudflare Web Analytics + our own anonymous interaction events + GA4 (Consent Mode v2). |
| AI crawlers | **Allow all** AI bots: search, user-fetch and training. |
| Domain | Owned, with DNS currently elsewhere. It moves to Cloudflare (steps in `docs/DEPLOY.md`). |

---

## 2. Answers to your questions (verified against official docs, 6 Oct 2026)

### Will pages rank on subdomains?
**Yes.** Google officially has no ranking preference between subdomains and subfolders. Its SEO Starter Guide says to "do whatever makes sense for your business", and John Mueller has said Google "is fine with using either". Google's ranking-systems guide says it "generally treats subdomains as part of a root domain". There are two honest caveats:
- Google needs a few days to learn how to crawl each new subdomain.
- Mueller personally leans towards subfolders unless the subdomain is genuinely different. Food and construction are different audiences, so the split is defensible.

What this plan does to help subdomains:
- One **Search Console Domain property** (verified by DNS) covers all hosts, and its new "Search generative AI features" setting stays on **Include**.
- Strong cross-linking between hosts.
- One shared brand entity (Organization schema, logo, `sameAs`) on every host.
- Fast, evidence-backed pages.

The URL base of each vertical is a single config value, so moving to `marketmindai.com/food/` later is a setting plus 301 redirects.

### Can we control which pages or subdomains show AdSense ads?
**Yes.** The control lives mainly in our code:
- **Adding the site in AdSense:** AdSense accepts only the **root domain** (`marketmindai.com`); subdomains can no longer be added separately (since March 2023). Once the root is approved, ads can serve on `food.` and `construction.` with the same publisher ID.
- **Auto ads settings:** these are stored **per domain, not per subdomain**. So the AdSense dashboard alone cannot switch ads on for `food.` and off for `construction.`.
- **The reliable control is ours:** ads appear only on pages that load the AdSense code. Our ad-slot config decides, per host, per page type and per device, whether that code is included. Pages that convert (quote form, contact, feature, claim, legal, admin) never include it. For pixel-exact control we can also use manual ad units instead of Auto ads.
- **`ads.txt`:** one file at `https://marketmindai.com/ads.txt` covers all subdomains, because they share one publisher ID. It is generated from one config value.
- **Approval risk:** Google reviews the root domain itself, so `marketmindai.com` must carry real, original content, not just links to the subdomains. The plan adds **Pune locality guides** to the brand site for that reason (§5).
- **EU/UK/Swiss visitors:** personalised ads need a Google-certified consent tool. AdSense's built-in, free "Privacy & messaging" tool covers that, and visitors without consent only lose personalisation. The privacy policy includes the cookie and opt-out wording that Google requires.

## 3. Architecture

```
                  Cloudflare (DNS · HTTPS · CDN · WAF · Turnstile · Access · Cron Trigger)
 ┌────────────────────┬────────────────────────┬─────────────────────────────┬──────────────────────┐
 marketmindai.com      food.marketmindai.com     construction.marketmindai.com   admin.marketmindai.com
 static + /api/lead     static + /api/ask,        static + /api/lead,             server-rendered,
        + /api/event           /api/lead,                /api/ask, /api/event      Cloudflare Access
                               /api/event
        │  publishable key → only `api.*` database functions │           secret key (admin only)
        └─────────────────────────────┬───────────────────────┘                     │
                                      ▼                                               ▼
                              Supabase Postgres  ◄──────────────────────────────────┘
                     (`app` schema: tables, never exposed · `api` schema: vetted functions)
                                      ▲
   GitHub Actions ────────────────────┘  nightly.yml (01:00 IST, staged, jittered)
   ▲ workflow_dispatch from a Cloudflare Cron Trigger (nightly) and from the admin "Rebuild" button
   └─ deploy.yml: one catalogue snapshot → quality gate → cross-host manifest → build all 4 apps
                  → validate links + hreflang → shrinkage guard → wrangler deploy ×4 → IndexNow (changed URLs only)
```

- **Page views never call an AI or a crawler** (spec §92). Pages are static HTML on Cloudflare. Static-file requests are free and unlimited, and they never run a Worker.
- **There is only one build system.** GitHub Actions builds all four apps from **one snapshot** of the catalogue, so the hosts can never disagree. Cross-host links and `hreflang` are checked against one manifest before anything deploys. A deploy is skipped when no page content hash changed.
- **The data source is explicit.** Production builds require `DATA_SOURCE=supabase`, and any fetch error fails the build; nothing silently falls back. Fixtures are allowed only in CI and in development.
- **Shrinkage guard.** A deploy aborts if the number of indexable URLs drops by more than 5%, or if a URL that produced a lead in the last 30 days would disappear. You can override from the admin.
- **The schedule runs on Cloudflare, not GitHub's own cron.** GitHub's scheduled workflows can be disabled by GitHub after inactivity. A Cloudflare Cron Trigger (free) dispatches the nightly workflow instead, and a dead-man alert fires if no successful run has completed in 26 hours.
- **Failure tolerance (spec §91).** If Exa or Firecrawl is down, we serve the database. If Groq is down, extraction falls back to deterministic parsing. If the pipeline or Supabase is down, the sites keep serving the last good build and leads go to an outbox (§13).

---

## 4. Repository layout (pnpm monorepo, TypeScript strict)

```
apps/            main · food · construction (static + /api routes) · admin (server-rendered)
packages/
  core/          types, Zod schemas, locality resolver, intent parser, ranking, labels,
                 cost engine, lead scoring, quality gate, SEO engine, link engine,
                 disclosure constants, localizedUrl(), seasonal calendar
  ui/            design tokens + shared Astro components and layouts
  db/            typed fetch client for Supabase `api.*` functions (Workers + Node)
  providers/     Exa / Firecrawl / Groq gateways, key pool, retries, circuit breakers, budgets
  extract/       deterministic extractors (JSON-LD, tel:, ₹ price patterns, hours) + Groq
                 normaliser + grounding verifier
  pipeline/      nightly stages + CLI (discover, refresh, extract, normalise, dedup, rank,
                 GSC import, backup, health report, csv import)
  edge/          shared Worker handlers: lead, ask, event, turnstile, governor
data/
  localities.json      Pune localities, sub-localities and landmarks; aliases; geo; neighbours;
                       clusters; per-locality construction facts (sourced)
  dishes.json          dishes and variants (chicken/mutton biryani…), aliases, craving map
                       (spicy, sweet…), diet, price bands, sanity bounds
  services.json        services + sub-services (terrace waterproofing, interior painting…),
                       units, BHK→area conversions, scope items
  cost-models/         cited, dated models: service × scope × material × tier (50+)
  seasonal-calendar.json · demand.csv · lead-pricing.json · ad-slots.json · experiments.json
  curation/*.csv       templates with required source columns
supabase/            migrations (schemas, RLS, grants, triggers, functions) + pgTAP tests
docs/                PLAN · ARCHITECTURE · DATA-POLICY · EDITORIAL-POLICY · DEPLOY · RUNBOOK
.github/workflows/   ci.yml · deploy.yml · nightly.yml
```

Dependencies are kept to a minimum: `astro` 7.3, `@astrojs/cloudflare` 14.x, `zod`, `typescript`, `vitest`, `@cloudflare/vitest-pool-workers`, `@astrojs/check`, `wrangler` and one self-hosted variable font. There is no UI framework; interactive pieces are small vanilla TypeScript islands. **Astro i18n** is configured from M0 (en now; mr and hi in M6), and every link is generated by `localizedUrl()`.

---

## 5. Pages, URL map and indexing rules

Every URL has a trailing slash, a lowercase ASCII slug, a self-referencing canonical and exactly one H1. Filters, sorting and tracking parameters never create indexable URLs. Instead, **whitelisted intents get their own gated pages**. A test proves that no two slugs collide at the same level (dish vs locality, service vs locality, intent vs dish).

### construction.marketmindai.com (launches first)
| URL | Content |
|---|---|
| `/` | Seasonal "What do you need?" picker, calculator, popular services, localities |
| `/pune/` | City hub: services, costs, Construction Pulse |
| `/pune/{service}-cost/` | City cost guide. Includes sub-service guides such as `terrace-waterproofing-cost`, `interior-painting-cost` (1/2/3 BHK), `exterior-painting-cost`, `bathroom-waterproofing-cost`, `house-construction-cost-per-sq-ft`. Each covers: tiers, inclusions, materials, duration, local factors, questions to ask, common mistakes, quote checklist, FAQ |
| `/pune/{service}/` | City contractors page ("Waterproofing contractors in Pune") |
| `/pune/{locality}/` | Locality hub: services, local cost drivers, providers |
| `/pune/{locality}/{service}/` | Local cost + "what drives cost here" + providers + inline quote |
| `/provider/{slug}/` | Provider profile |
| `/cost-calculator/` | Full calculator |
| `/get-quotes/` | Direct quote form (`noindex`, no ads) |
| `/for-contractors/` | "Get customer enquiries in {locality}": provider sign-up (no ads) |
| `/about/` | Methodology for construction data |

### food.marketmindai.com
| URL | Content |
|---|---|
| `/` | "What are you craving?" (including Something Spicy / Something Sweet), locality, budget, What's Hot |
| `/pune/` · `/pune/{dish}/` | City hub · dish across Pune. Variants such as `chicken-biryani` are dishes in their own right |
| `/pune/{locality}/` | Food Pulse. Sub-localities (`hinjewadi-phase-1`) and landmarks (`near-rajiv-gandhi-infotech-park`) are valid locality slugs |
| `/pune/{locality}/{dish}/` | The money page: "Best Biryani in Hinjewadi, Pune" |
| `/pune/{locality}/{dish}/{intent}/` | Intent ∈ `under-{₹band}`, `veg`, `late-night`, `family`, `office-lunch` |
| `/pune/{locality}/{late-night-food,budget-food,veg-food}/` | Locality intent pages |
| `/place/{slug}/` | Restaurant profile |
| `/ask/` | Live Ask (`noindex`, no ads) |
| `/about/` | Methodology for food data |

### marketmindai.com
`/pune/` and `/pune/{locality}/` are **Pune locality guides**, aimed at "living in / area guide" searches. They are built only where the owner has written or edited at least 400 words, so the root domain has original content of its own for AdSense review. The food and construction hubs link to them but do not repeat their text.

Also on the root domain:
- **Trust and policy pages:** `/`, `/about/`, `/contact/`, `/privacy/` (including the Google ads cookie wording, the DPDP notice and retention periods), `/terms/`, `/cookie-policy/`, `/editorial-policy/` (how ranking, evidence and corrections work).
- **Business pages:** `/advertise/`, `/feature-your-business/` (with `/get-featured/` redirecting to it), `/featured/`, `/claim-business/`.
- **`ads.txt`:** served from the root host only.

### Every host
`robots.txt`, `sitemap.xml` (index → per-type sitemaps), `llms.txt`, a real 404 page (`not_found_handling: "404-page"`), and a `_headers` file (§17).

### Quality gate (spec §4, §57, §62)
The gate runs per page type, and every threshold lives in `config/gate.json`. The build report prints each page's score.

**Food**
| Page type | Built and indexed when |
|---|---|
| `{locality}/{dish}` | ≥ 3 places in the locality subtree with fresh, grounded dish evidence; ≥ 6 claims in total; every place has a first-hand experience or ≥ 2 independent sources |
| intent page | Its parent page passes, **and** ≥ 3 places carry evidence for the intent: a dated price within the band, verified hours past 23:00, a diet flag, or a family / office tag |
| `{dish}` (city) | ≥ 5 places across ≥ 2 localities |
| `{locality}` hub | ≥ 5 places |
| `/place/` | A first-hand experience, **or** ≥ 3 grounded claims from ≥ 2 independent non-aggregator sources. Otherwise the page is built `noindex,follow` and left out of sitemaps until an admin reviews it |

**Construction**
| Page type | Built and indexed when |
|---|---|
| `{service}-cost` | The cost model has ≥ 2 independent cited sources, has not expired, and its prose has been owner-reviewed |
| `{locality}/{service}` | **Local substance** exists: at least one of (a) a non-default locality factor backed by ≥ 2 sources, (b) ≥ 2 providers serving the locality with evidence, (c) ≥ 3 sourced or owner-entered local facts relevant to the service (housing stock, building age, PMC or PCMC rules, society work rules), or (d) ≥ 3 anonymised real quotes. Providers are **not** required, so the page can launch before any provider exists. Until a page qualifies, Wakad searches are served by the city guide (with a locality selector) and the Wakad hub. |

**All pages**
- `unique_content_score` = 1 − (the highest 5-word-shingle Jaccard similarity of the page's main content against any sibling of the same template), measured after template sentences are removed. It must be ≥ 0.5.
- `seo_score` uses the spec §57 weights. Demand comes from Search Console and Ask demand, with a config prior used at cold start. It must be ≥ `SEO_MIN`.
- **Hysteresis:** the threshold to stay published is 80% of the threshold to get published. A live page that falls below it stays at 200 with `noindex,follow` for 30 days, then 301-redirects to its parent hub. It never flips straight to a 404.
- **Expiring cost models:** the admin is alerted 30 days before a model's `valid_until`. Once expired, the page shows "being re-verified · last reviewed {date}" instead of leaving the index.
- **Prose policy:** no AI-drafted prose renders on an indexable page until the owner marks it reviewed (`prose.status = reviewed`); the build fails otherwise. Template sentences count as boilerplate in the uniqueness score.
- **Freshness dates:** `lastmod`, the visible "Updated" date and IndexNow submissions all use the date the page's **content hash** last changed, never the build date.

---

## 6. Data model (Supabase Postgres)

**Security layout**
- All tables live in schema **`app`**, which is not exposed through the API. `ALTER DEFAULT PRIVILEGES … REVOKE ALL FROM anon, authenticated`, so tables added later are not exposed by accident.
- Public Workers hold only the **publishable key**, and can call only `SECURITY DEFINER` functions in schema **`api`**:
  - `submit_lead`
  - `record_events`
  - `ask_begin` / `ask_commit`
  - `export_catalogue` (published rows and allowlisted columns only, used by builds)
- Each function sets `search_path = ''` and validates its own input.
- The secret key exists only in the admin Worker and in GitHub Actions.
- RLS is enabled everywhere as a second layer.

**Tables (spec §67, extended)**
- **Geography:** `cities`, `localities` (parent: sub-locality and landmark kinds; aliases; geo; neighbours; clusters), `locality_profiles` (the spec §6 fields: search_intent, popular dishes, price segments, business density, data quality, `complete` flag)
- **Catalogue:**
  - `businesses`: kind restaurant | provider; status candidate | published | hidden; `verification_status` + method + date; `chain_id`; `branch_key`; stable DB-allocated `slug`. Unique index on (kind, normalised_name, locality_id, branch_key).
  - `chains`
  - `restaurants`: structured `opening_hours` (IST intervals per day), `service_modes[]` (dine-in, takeaway, delivery), diet, price range
  - `providers`: specializations, experience, `accepts_leads`, `service_localities[]`, `min_job_inr`, `sales_stage`, `trial_leads_remaining`, `agreed_lead_price_inr`
  - `dishes`, `restaurant_dishes`, `construction_services` (+ sub-services), `provider_services`, `cost_models`
- **Evidence:** every claim, from **every** path, is evidence.
  - `sources`: kind first_hand | owner_manual | csv | official_site | menu | directory | article. The URL is nullable only for first-hand sources, which link to `experiences`.
  - `evidence`: claim_type ∈ price | hours | offer | availability | dish | service | address | phone | rating | mention | locality_fact; `supporting_quote`; `retrieved_at`; `valid_until`; `confidence`; `extractor_version`
  - `experiences` + `experience_photos`
  - `observations`: append-only, written by a **Postgres trigger** on every tracked column change, whatever the write path (admin, CSV or pipeline). This satisfies spec §68.
- **Ranking:** `ranking_runs`, `recommendations` (organic score + every component + labels with their inputs; `commercial_score` kept separately)
- **Revenue:**
  - `leads`: `lead_type` ∈ quote | featured_enquiry | advertise | claim | contact | for_contractors; idempotency key; grade; consent version and time; attribution (landing path, referrer class, UTM, page type, `ranking_run_id`, calculator inputs and estimate, WhatsApp ref code); follow-up fields
  - `lead_assignments`: provider, shared or exclusive, price, outcome, quoted and final amounts, refund reason. At most 3 shared assignments per lead, enforced in the DB.
  - `provider_credits` (manual ledger), `featured_listings`, `advertisers`, `campaigns`, `ad_slots`, `sales_quotes`
- **Usage:**
  - `queries`: Ask intent + candidate set + ranks; no IP
  - `events_daily`: aggregated counters
  - `feedback`: "useful?" and "report outdated info"
  - `search_demand`: daily Search Console import
- **Ops:**
  - `jobs`: idempotent pipeline stages
  - `api_credentials`: key fingerprint, provider, account label, status, cooldown, usage, errors; **never the key itself**
  - `governor`: daily budgets and circuit-breaker state
  - `system_events`, `business_claims`, `page_builds`: URL manifest, content hashes, gate scores
- **Storage budget (500 MB):** raw HTML is never stored, only hashes. Events are aggregated, not stored as rows. `query_cache` and old rows are pruned on a schedule. Database size is reported in the health report.

---

## 7. How data gets in

| Path | What | Result |
|---|---|---|
| **A. Admin** | Places, dishes, prices, hours, **experiences + photos**, providers, cost data, local facts | Each claim is published with evidence (first-hand or owner-entered, with a source URL or "visited") |
| **B. CSV** | Bulk import with `pnpm import:csv --dry-run`, then the real import. Required columns: `source_url` (or `visited`), `retrieved_at`, optional `valid_until` | Published only if every row validates; the dry run shows a diff first |
| **C. Nightly pipeline** | Discover → fetch changed pages → extract → ground → dedup | Candidates, which auto-publish under the §8 rules |
| **D. Live Ask** | Database miss → live lookup | Candidates (same rules); shown to the user labelled "found on the web just now" |

All paths write through **one** `upsert_business` function, so concurrent writers cannot create duplicate places or slugs.

---

## 8. Strict data contract

**Freshness tiers (spec §47).** `valid_until` = `retrieved_at` + TTL, unless the source states its own date. A claim is *stale* when `now > valid_until`. Stale claims drop out of the gate counts and out of the ranking's freshness score. HOT claims render "Price last checked {date}" or are hidden once stale; a build check enforces this.

| Tier | Claim types | TTL |
|---|---|---|
| HOT | price, hours, offer, availability | 14 days (an offer lasts until its stated end) |
| WARM | dish or menu presence, services, specialities, contact | 60 days |
| COLD | address, history, description | 365 days |
| Cost models | — | 180 days |

**Extraction runs in this order (spec §51, §91):**
1. **Deterministic first:** schema.org JSON-LD (Restaurant, Menu, OpeningHoursSpecification), `tel:` links, ₹ price patterns in menu tables and lists, and address blocks.
2. **Groq only for what spec §51 allows:** entity normalisation, dish and service classification, ambiguous matching, review-signal extraction and summaries. It runs on `openai/gpt-oss-120b` with strict JSON schema output (falling back to `gpt-oss-20b`). Its Zod schemas use `.nullable()` because strict mode makes every field required, and a test checks that each JSON schema and its Zod schema are equivalent.
3. **Groq down or over budget:** deterministic results continue; ambiguous items are queued.

**Grounding (prevents hallucinated facts):**
- Every claim needs a supporting quote of 8–300 characters, found in **the exact text chunk that was sent to the model**. Matching is done after normalisation: NFKC, whitespace, Rs./INR/₹, and Devanagari digits.
- **Code re-derives the value from the quote.** The price regex must equal the claimed price, and the dish or locality alias must appear in the quote. Any mismatch rejects the claim. There are unit tests for the "quote says ₹249, claim says ₹294" case.

**Independent sources:**
- Two sources count as independent only if they are on different registrable domains (eTLD+1), belong to different owner groups (a maintained aggregator list), and their quoted passages are not near-duplicates (simhash).
- **Aggregators (Zomato, Swiggy, Justdial, Google Maps, Sulekha …) are discovery-only.** We store their URL and title and never scrape them (spec §87, and their terms).

**Auto-publish rules**
- **Restaurants:** ≥ 2 independent sources agree on name + locality, and at least one dish claim is grounded.
- **Providers:** ≥ 2 independent sources agree on name + locality, and a service claim is grounded.
- Everything else waits in the admin queue. Auto-published places stay out of sitemaps until reviewed (§5).

**Dedup (tiered):**
- **Auto-merge** only when the phone number matches, name similarity (`pg_trgm`) is ≥ 0.8, and the places are within 300 m of each other or share a leaf locality.
- **Probable matches go to the admin queue:** name similarity ≥ 0.85 within the same locality subtree.
- **A website alone never merges places**, because chains share one website. Branches are tracked in `chains`.
- **Renames** keep the slug and add a 301 redirect.

**Ranking inputs (spec §12, §13, §17)**
| Component | Source | If missing |
|---|---|---|
| rating_strength | First-hand ratings, plus grounded numeric ratings from sources whose terms allow it (never review text), with Bayesian shrinkage toward the locality mean | Locality prior |
| review_strength | Independent grounded positive mentions | 0 |
| dish_evidence, freshness, value, locality_match, relevance | Evidence rows | 0 (and the place is excluded if it has no dish evidence) |
| provider: verification | An admin-set method: website, phone, business documents or visit | 0 |
| provider: specialization, experience | Provider fields with evidence | 0 |
| hot_score: recent_mentions, demand_signal, engagement | New evidence in the last 30 days · distinct-user `queries` + Search Console impressions · click events | No label shown |

**Labels.** Labels are only ever data-derived, and each one needs `MIN_LABEL_EVIDENCE` (default 3):
- **Hot, Trending, Warm, Cold:** the spec §13 bands.
- **Hidden gem:** quality ≥ 75th percentile **and** visibility ≤ 25th percentile. This resolves the conflict between spec §10 and §13 by using the §10 meaning; the 0.35–0.49 band shows no label.
- **Best value:** value ≥ 80th percentile, with ≥ 2 dated prices.
- **Late night:** verified hours past 23:00, checked within the last 30 days.
- **Family / office lunch:** tags from evidence or experiences, plus distance to office clusters.

**Trust labels (spec §71):**
- **✓ Verified:** set only by an admin, with a method and a date.
- **Recently checked:** checked within the last 30 days.
- **Source-backed:** has at least one sourced evidence row.
- **Price / hours last checked:** taken from the newest evidence.
- Copy such as "#1 best in Pune" fails the build.

---

## 9. Live Ask (designed for Workers Free: 10 ms CPU, 50 subrequests)

1. The request reaches `/api/ask`. A deterministic intent parser extracts dish or service, locality, budget, diet and `open_now`.
2. **Answer from cache or the database immediately.** The Workers Cache API is keyed by the normalised intent. If the database already holds data for that intent, the ranked results come back right away. No AI is used for this.
3. **Live lookup (only on a miss or stale data), in two phases:**
   - A **Turnstile** check is required first.
   - One `api.ask_begin` call checks everything in a single round trip: the per-visitor burst limit (HMAC of the IP with a secret rotated daily; IPv6 keyed by /64; CGNAT-friendly limits), the **global daily cap (50)**, the provider budgets, and which keys are usable.
   - The response returns at once with a lookup id. The work then runs in `ctx.waitUntil`, and the page polls `/api/ask/result`.
   - The lookup itself: **Exa** `type: auto`, `userLocation: IN`, ≤ 5 results with ≤ 1,500 characters each. Prompt tokens are counted and hard-capped at about 4k, so a lookup fits Groq's free 8k tokens/minute. Then Groq normalisation, grounding, and **one** batched `api.ask_commit`.
   - Identical concurrent misses are coalesced into a single lookup.
4. If the cap is reached or a provider fails, the visitor gets database results plus "Ask us on WhatsApp", never an error page.
5. A Workers-runtime test asserts **≤ 20 subrequests on the worst error path**, and the CPU used per lookup is measured. If CPU ever exceeds the free limit, the heavy step moves to a Supabase Edge Function (2 s CPU, free).

---

## 10. Provider gateway and key pool

Keys are provided per provider as `GROQ_API_KEYS`, `EXA_API_KEYS` and `FIRECRAWL_API_KEYS`, each a comma list with an optional account label (`label:key`). The pool tracks health per key fingerprint in `api_credentials`, shared through Supabase (not per-isolate memory), and **rotates automatically**:

| Error | Action |
|---|---|
| Timeout / network | Retry once with backoff + jitter, then move to the next key |
| 401 / 403 | Disable the key, raise a system event, and alert the owner |
| 402: Exa `NO_MORE_CREDITS` / Firecrawl payment required | Disable the key until its credits reset (Exa: the 1st of next month; Firecrawl: its billing cycle). Next key |
| 429 | Cool down for `Retry-After` (or until Groq's `x-ratelimit-reset-*`). Next key |
| Groq 498 / 503, Exa 503 / 504, Firecrawl 5xx | Backoff; the provider's circuit breaker opens after 5 consecutive failures for 5 minutes |
| Groq 413 | Shrink the input and retry once |
| Groq 422 / schema mismatch | One repair retry, then drop and log |
| 400 / other 4xx | No retry; log the request fingerprint (never the key or any user data) |
| Daily budget reached | Stop calling that provider for the day; serve from the database |

The pipeline gets the night window (00:00–06:00 IST). The live Ask has a reserved share of each daily budget, so the two never starve each other.

> **⚠ Risk you have accepted:** Groq's Acceptable Use Policy (verified) forbids exceeding its limits "by registering multiple accounts or orchestrating usage between multiple organizations". Exa gives free credits only to a user's first team, and Firecrawl limits each team across all its keys. Groq, Exa and Firecrawl can ban **all** linked accounts, and the live Ask would then stop working.
>
> To limit the damage: every key carries an account label so a ban is isolated quickly, the database-first design keeps calls low, and the health report warns you as soon as a key is disabled.
>
> I will build normal multi-key failover. I will **not** build anything meant to hide the accounts' connection to each other or to evade abuse detection.

**Free-tier budget (approximate, per account per day):**
| Provider | Free allowance | Our default daily budget |
|---|---|---|
| Groq | 1k requests, 200k tokens | 150 requests (pipeline 100, Ask 50) |
| Exa | $10 a month, ≈ 20 searches a day | 20 searches, plus 50 Ask lookups shared across pooled keys |
| Firecrawl | 1,000 credits a month | ≈ 30 scrapes |

Each budget is set in config and can be raised from the admin.

---

## 11. Cost engine and calculator

- A **cost model** = service × scope variant × material × tier (budget, standard, premium). Each model is split into materials, labour, preparation, repair, transport and waste, and cites ≥ 2 independent sources with dates.
- **Launch target:** 50+ cost models covering the 5 services and their sub-services.
- **Calculator inputs:** BHK presets (1/2/3/4 BHK flat, independent house, terrace in sq ft) with their area assumptions shown (e.g. paintable wall area ≈ 3–3.5× carpet area, configurable), material, scope, tier, timeline and locality.
- **Calculator outputs:** low / expected / high, plus "send this estimate to my WhatsApp".
- **Locality factor:** 1.0 unless sourced evidence or anonymised real quotes (n ≥ 3 within 180 days) justify another value. Once n ≥ 3, a "Recent quotes in {locality}: ₹X–₹Y (n jobs)" block appears.
- Every estimate carries the spec §86 disclaimer.

---

## 12. SEO and LLM visibility

- **Metadata:** the spec §37–40 templates, plus a template for each intent and sub-service. One H1 per page, and an H2 outline per page type. Breadcrumbs plus `BreadcrumbList`.
- **Structured data (only when accurate):**
  - `Organization` + `WebSite`, `WebPage`, `BreadcrumbList`, `ItemList`.
  - `Restaurant` / `LocalBusiness`, only with a verified address.
  - `Review`, only for our own first-hand experiences.
  - `FAQPage` as plain schema.org. Google stopped showing FAQ rich results in May 2026; the FAQs stay for users and AI engines.
  - No aggregate ratings without real data.
- **Linking:**
  - Parent locality and category.
  - 3–5 nearest localities by distance.
  - Related dishes or services, and related intents (now real pages).
  - Cross-host links to the brand locality guide.
  - Links per page are capped.
- **For AI engines, in order of impact:**
  1. **Crawl access.** `robots.txt` allows every AI bot: OAI-SearchBot, ChatGPT-User, GPTBot, Claude-SearchBot, Claude-User, ClaudeBot, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, CCBot, plus all search engines.
     - **Cloudflare blocks AI training and agent bots by default on new domains**, so `DEPLOY.md` includes the exact AI Crawl Control settings to fix this.
  2. **Quotable pages:** a "Quick answer" block with ₹ prices, dates and sources, stable entity names, and a "last checked" date on every claim.
  3. **IndexNow** for changed URLs only. Bing and Yandex share these submissions, and ChatGPT search uses third-party providers including Bing.
  4. **Search Console:** the "Search generative AI features" setting = Include.
  5. `/llms.txt` on each host, a cheap bonus.
- **Seasonality** (`seasonal-calendar.json`, with a unit test for each month). It drives the homepage order, the sticky CTA and seasonal modules:
  - **Oct–Nov:** painting (Diwali is 8 Nov 2026)
  - **Oct–Jan:** post-monsoon seepage repair
  - **Nov–Feb:** bathroom and kitchen work (wedding and griha-pravesh season)
  - **Jan–Mar:** book waterproofing early, with a "remind me before monsoon" sign-up
  - **Apr–May:** peak waterproofing
  - **Jun–Sep:** emergency leakage repair

  **All waterproofing locality pages are live by December so they can rank by April.**
- **Content priority:** `demand.csv` (searches, lead value, data readiness) gives priority = demand × lead value × data readiness, following spec §56. The build report prints the ranked backlog. Search Console and Ask data refine it nightly.

---

## 13. Revenue engine

### Construction leads (primary)
- **Inline funnel:** step 1 of the quote form sits under every estimate, prefilled from the calculator.
  - **Step 1:** service, locality, area, property type (flat / independent house / society common area / commercial), ownership (owner / tenant / society), start time (within 2 weeks / 1 month / 1–3 months / just researching).
  - **Step 2:** name and phone (Indian mobile format; `+91` or a leading 0 is normalised).
  - **Microcopy:** "Free · no obligation · shared with at most 3 verified contractors · no spam calls".
- **Consent (DPDP Act):** an unticked checkbox reading "Share my details with up to 3 verified contractors and let MarketMind AI contact me on WhatsApp/phone about this request". The consent text version and time are stored, and retention periods are stated in the privacy policy.
- **Submit flow:**
  1. The form posts with `keepalive`, carrying an idempotency UUID.
  2. A thank-you state shows a reference number and "We'll WhatsApp you within 2 working hours", plus a **one-tap "Send on WhatsApp" button** (a real link to `wa.me/919834346179?text=…` with the reference code). It is never an automatic redirect, which iPhones and in-app browsers block.
  3. If the database write fails, the Worker stores the lead in **Workers KV (outbox)** and the admin replays it. No lead is lost.
- **Instant owner alert** for every lead and for the health report, via **Telegram and email**.
- **Lead grade A/B/C** (`leadScore()`, built test-first):
  - **Inputs:** timeline, ownership, property type, estimate size, served area, valid phone, WhatsApp confirmed, notes.
  - **Qualified:** grade A/B + contact confirmed + timeline ≤ 3 months.
  - **Duplicates:** the same phone + service within 30 days merges into one lead and is never sold twice.
- **Resale mechanics:**
  - `lead_assignments` allows up to 3 shared assignments, or one exclusive.
  - `lead-pricing.json` holds a price per service × grade, seeded with hypotheses you can edit in the admin: painting ₹250–400, waterproofing ₹300–500, bathroom ₹500–800, kitchen ₹600–1,000, house construction ₹1,500–3,000, with exclusive at 2.5×.
  - A refund reason is recorded for invalid leads.
  - The admin forwards a **masked summary** first and releases the phone number only once the assignment is accepted.
- **Speed-to-lead:**
  - A "Due today" view, with follow-up fields on every lead.
  - Copy-ready WhatsApp templates at T+0 (confirm), T+1 day ("have contractors called?") and T+7 days ("did you hire? what was the quote?").
  - The quoted and final amounts collected this way feed the anonymised local quote data (§11).
  - Visitors who are "just researching" can opt in to "remind me before monsoon".
- **Attribution and tracking:**
  - Each lead stores its landing path, referrer class, UTM, page type, ranking run, and calculator inputs and estimate.
  - Every prefilled WhatsApp text carries a ref code (e.g. `Ref C-WAKAD-WP`).
  - An admin "Log WhatsApp lead" button records chats that start without the form.
- **Honest CTAs:**
  - "Get up to 3 free quotes" appears only when ≥ 3 active providers accept leads for that service × locality. Otherwise the CTA reads "Get a free quote — we'll connect you with a local contractor".
  - On profiles of providers who accept leads: "Request a quote from {name}", and the lead goes to that provider first.
  - On other profiles: "Get quotes from local contractors", with no implication that the listed provider will respond.
  - A test enforces these rules.

### Provider acquisition (the leads need buyers)
- `/for-contractors/` and "Is this your business?" links on every provider profile and locality × service page.
- Provider sales fields (§6), with 2 free trial leads by default.
- An admin **Prospects** view of pipeline-found providers, sorted by service × locality demand.
- The leads inbox shows the matching providers for each lead, with one-tap masked WhatsApp forwarding.
- A **founding-partner offer** flag: the first 5 paid providers per locality × service lock their price for 6 months. The slot count is computed from real data, so the scarcity is never fake.

### Featured listings and sponsorship
- **Tiers:** Free, Featured and Premium (spec §20), shown with features and "Contact for pricing".
  - Paid listings are always labelled "Featured · paid placement".
  - They appear in a separate block, never inside the organic ranking.
  - Paid links carry `rel="sponsored"`.
- **Sponsorships:** locality and category sponsorships ("Hinjewadi Food Guide · Sponsored by X") have their own flag, `DIRECT_SPONSORSHIPS_ENABLED`, independent of AdSense.
  - Dates are respected at build time, and a client-side check hides a slot once `data-end` passes.
- **Sales quotes:** every price you quote is recorded in `sales_quotes` (product, price, outcome, objection), with a win-rate report.
- **Per-business report:** 30-day views, clicks, calls and leads, with a one-tap "copy WhatsApp summary" for sales outreach and renewal proof.
- **Backlinks:** a "Featured on MarketMind AI" badge snippet for businesses to embed.

### Display ads (last)
- `ADSENSE_ENABLED` is off at launch.
  - `<meta name="google-adsense-account">` is always present on the root domain once the publisher ID is set.
  - `ads.txt` is generated from that ID.
- **Construction lead pages default to no ads.** AdSense in this niche mostly shows competitors (Urban Company, NoBroker, Livspace, Sulekha …). Ads may be tested there only in a 50/50 experiment, and stay on only if lead revenue per 1,000 sessions does not drop. A list of competitor URLs to block in AdSense is applied before ads go live anywhere. **Food and brand-guide pages are the first ad inventory.**
- **Ad units:** manual units in reserved, fixed-height slots, so ads cause no layout shift. If Auto ads is ever turned on, its in-page formats and vignettes stay off.
- **Never ads:** forms, contact, legal, feature, claim, for-contractors, /ask/, 404, thank-you states, admin.
- **Experiments (spec §84):** `experiments.json` defines variants of slot layout, density, CTA and featured placement. Each tab is bucketed client-side, and events carry the variant. Reports cover revenue, CTR, quote submits and LCP. A guardrail stops any variant that lowers recommendation or quote conversion.
- **When to apply for AdSense:** all legal pages are live, ≥ 50 pages are indexed in Search Console, and there are ≥ 4 weeks of real organic visitors.

### Outbound
"Order on Swiggy/Zomato" (search links), "Directions" and "Call" clicks are tracked. Affiliate parameters are added if programmes become available, together with the affiliate disclosure.

---

## 14. Admin (`admin.marketmindai.com`)

**Access:** Cloudflare Access (email one-time PIN, your email only). The middleware also verifies the `Cf-Access-Jwt-Assertion` signature, audience and issuer against your team's keys on every request. Workers `workers.dev` and preview URLs are disabled, so there is no back door.

**Screens:** mobile-first, so you can log a visit at the restaurant.
- **Today:** new leads, leads due for follow-up, the approval queue, expiring cost models, and alerts.
- **Leads:** filter by type, grade, service, locality or status; assign to providers (masked forwarding); follow-up templates; revenue; CSV export; "Log WhatsApp lead".
- **Places, dishes and prices:** each with a source URL or "visited" and the date checked; duplicate warnings as you type.
- **My experiences:** visit date, dishes tried, price paid, rating per dish, notes, "would recommend", tags (family, office lunch, late night) and photos (resized on your phone).
- **Providers + Prospects:** services, service areas, specializations, verification (method + date) and the sales stage.
- **Cost models:** rates, sources, `valid_until` and review status.
- **Content:** review and edit AI-drafted prose (guides, locality profiles, FAQs). It must be marked reviewed before it can be indexed.
- **Approval queue:** web-found candidates, with the source quote highlighted.
- **Featured, sponsorships and sales quotes.**
- **Metrics:** the spec §81 metrics per vertical per week (visitors, calculator completions, provider CTR, quote starts, qualified leads, revenue per lead, ad RPM entered manually); revenue per 1,000 sessions by landing page; per-business reports.
- **Publish:** "Rebuild now" (dispatches `deploy.yml`), the last build's gate report, and the shrinkage-guard override.
- **Health:** key status by fingerprint and account label, budgets, failures, job runs, database size and the dead-man status.

---

## 15. UI and design system

Impeccable is not in your plugin catalogue, and Superpowers is in your catalogue but not enabled in this session. I will apply their methods by hand:
- **Superpowers:** plan, then test-first development, then verify before claiming anything is done.
- **Impeccable:** deliberate typography, OKLCH colour tokens, tinted neutrals, and none of the generic "AI look".

**Direction:** an editorial local guide where the visitor's task comes first.
- **Food:** a warm spice palette of turmeric, chilli and cardamom-green accents on warm paper neutrals.
- **Construction:** blueprint ink and terracotta on cool neutrals.
- **Shared:** one shared type scale, spacing system and set of components.

**Type:** one self-hosted variable display font for headings; body text uses the system font stack.

**Mobile-first:** large tap targets, a sticky but dismissible action bar, no popups, no autoplay and no hero images. Light and dark themes.

**Accessibility (WCAG 2.2 AA):** semantic HTML, full keyboard use, visible focus, contrast ≥ 4.5:1, labelled forms, and error messages announced to screen readers.

**Food filters:** "Open now" is computed in the browser in IST. "Near me" uses opt-in browser geolocation; the location is used only for the distance calculation and is never sent to our servers.

**Feedback:** a "Was this useful? / Report outdated info" widget on profiles and recommendation lists feeds the corrections process.

---

## 16. Analytics and measurement

**Events.** Our own events are a Zod enum covering every spec §80 event (`page_view` is left to Cloudflare and GA4) plus:
- `calculator_start`, `calculator_complete`
- `quote_step_n`
- `whatsapp_click`, `provider_click`
- `profile_view`, `list_impression`
- `ask_submit`, `feedback`

**Event fields:** host, page type, path, locality, dish or service, entity id, position, `ranking_run_id`, slot, campaign, experiment variant, device class and referrer class (search, AI, social, direct). **No IP address, no user agent and no cookies.** Events are batched per page and aggregated into `events_daily`. An `EVENTS_ENABLED` kill switch can turn them off.

**What the HTML carries:**
- Each recommendation has `ranking_run_id` and its position stamped in at build time.
- A random per-tab id (not a cookie) links a visit's clicks together.

This keeps the spec §69 chain intact: query → candidates → ranking → click → lead → feedback.

**GA4** loads after the page is interactive, under Consent Mode v2. The default is set in the static HTML with Google's `region` parameter: denied for the EEA, UK and Switzerland, granted elsewhere. GA4 loads immediately on the thank-you state so the `generate_lead` conversion (value = lead price) is captured. Our own tables remain the source of truth.

**Search Console:** a daily import fills `search_demand` (needs a free Google service account).

**Demand signals** (Hot / Trending / popular here) count **distinct visitor-days**, with a cap per key, and only from Turnstile-verified or interaction-confirmed requests. This makes them hard to inflate with scripts.

---

## 17. Privacy, security, abuse protection

- **Secrets:**
  - Secrets live only in Cloudflare and GitHub environment settings.
  - Only the admin Worker and GitHub Actions hold the Supabase secret key.
  - CI scans every build output for key patterns (`sb_secret_`, `gsk_`, `fc-`, the Exa key format) and fails if one appears.
- **Security headers:** a `_headers` file per app sets a hash-based CSP (allowing GA4, AdSense and Turnstile), HSTS, X-Content-Type-Options, Referrer-Policy and Permissions-Policy. Static pages never run a Worker, so these headers cannot come from middleware.
- **Forms:**
  - **Bots:** Turnstile protects every form and every live lookup.
  - **Bursts:** Cloudflare's rate limiting (or the governor function) caps bursts, plus one free WAF rate rule on `/api/*`.
  - **Input:** strict length and format validation on the server.
- **Personal data:** phone numbers exist only in leads, with versioned consent, stated retention periods, and a deletion route listed on the privacy page.
- **The WhatsApp number** never appears inside business records or business structured data (spec §35).
- **Data policy** (spec §87): attribution and retrieval dates on everything; derived facts only. Aggregators are never scraped. No review text, articles or photos are copied without rights.

---

## 18. Performance budget

| Metric | Target |
|---|---|
| HTML (gzip) | < 30 KB on a typical page |
| JavaScript (ours) | < 3 KB on content pages (the event beacon); < 15 KB on calculator, form and Ask pages. GA4 loads after interaction or when the browser is idle. |
| CSS | < 25 KB, in a single cached file |
| Fonts | 1 woff2, preloaded, with `swap` and a metric-matched fallback |
| LCP / CLS | < 2.0 s on a mid-range phone over 4G / < 0.1 (measured with ad test mode on) |

---

## 19. Operations

**Nightly schedule (IST; spec §55).**
- **Trigger:** a Cloudflare Cron Trigger dispatches `nightly.yml` at 01:0x IST, with random jitter.
- **Stages, run in order:**
  1. discover
  2. refresh stale data
  3. extract
  4. normalise and dedup
  5. rank
  6. rebuild (`deploy.yml`)
  7. sitemaps and IndexNow
  8. backup
  9. health report
- **Run rules:** each stage is idempotent and recorded in `jobs`. Concurrency within a stage is 2–4, and runs never overlap. If a stage fails, the rebuild uses the last good data.

**Health report (07:30 IST).** Synthetic checks: `/api/lead` in test mode, each host's homepage and `sitemap.xml`, and the 404 page. It summarises key status, budgets, failures, leads, gate changes and database size. It is sent to your alert channel and recorded in `system_events`.

**Backups (Supabase Free has none).**
- **How:** `supabase db dump` through the IPv4 session pooler, encrypted with `age` to a public key whose private key you keep offline.
- **Where:** stored as private GitHub Actions artifacts kept for 30 days, or in Cloudflare R2 if you enable it.
- **Check:** a test restore runs monthly.

**Supabase pausing:** nightly jobs and builds count as activity. The dead-man alert catches any gap.

**Photos:** published photo versions are copied into the static build, so public pages never use Supabase egress.

---

## 20. Testing, verification and the launch gate

**Tests:**
- **Test-first for all logic:** locality resolver, intent parser, ranking, labels, cost engine, `leadScore()`, quality gate (shingles and hysteresis), SEO templates, link engine, seasonal calendar, key pool and the full error matrix, extraction grounding (including the price-mismatch case) and the JSON-schema ↔ Zod equivalence.
- **Database (pgTAP):** anon and authenticated roles have zero table privileges; each `api.*` function has allow and deny cases; a table created later inherits no privileges.
- **Workers runtime** (`@cloudflare/vitest-pool-workers`): lead outbox and idempotency, Ask subrequest count (≤ 20) and CPU measurement, and Access JWT checks with forged, expired and wrong-audience tokens.
- **Extraction quality:** a scrubbed fixture set of ≥ 50 recorded provider responses with hand-labelled claims. CI fails if precision drops below 0.95.
- **E2E (Playwright):** calculator → quote → thank-you, checking the exact `wa.me` URL and that the lead survives a database 503. Also the live Ask with mocked providers, and admin create/read/update/delete.
- **Lighthouse CI:** one page of each type, including a run with ads in test mode.

**Build checks (the build fails if any is broken):**
- exactly one H1 per page
- a canonical on every page
- no `noindex` URL in any sitemap
- every sitemap URL exists
- JSON-LD is valid
- cross-host links and `hreflang` resolve against the manifest
- every rendered claim shows a source and a date
- no stale claim is unlabelled
- disclosures are present wherever they are required: paid placement, "Advertisement", affiliate, cost disclaimer
- no "#1 best" copy
- no unreviewed AI prose on an indexable page
- no WhatsApp number inside business data
- no secret patterns in the build output
- no `Disallow: /` in `robots.txt`

**Launch gate (spec §102–103).** Until `pnpm launch:check` passes **and you sign off**, the public hosts stay behind Cloudflare Access with `X-Robots-Tag: noindex`. The check covers:
- HTTPS / HSTS
- mobile Lighthouse scores
- a real 404 page
- canonicals, sitemaps, robots and structured data
- legal, contact and claim pages
- source attribution and freshness on every claim
- the lead alert and outbox, tested end to end

Only after the gate passes do we point DNS, submit sitemaps and ping IndexNow.

---

## 21. Milestones

Each milestone ends with its checks green, a commit and a push to `claude/relaxed-sagan-uipz8o`.

| # | Milestone | Done when |
|---|---|---|
| **M0** | Foundation: monorepo; CI; one deploy pipeline (with snapshot, manifest and shrinkage guard); Supabase schemas, grants, functions and pgTAP; Astro i18n scaffolding; design tokens; core types and schemas; `_headers`; launch-check skeleton | Clean install, typecheck, test and build green in CI; migrations apply to a fresh database; pgTAP passes |
| **M1** | **Construction revenue launch**: cost engine + 50+ cited cost models; sub-service guides; calculator with BHK presets; inline quote funnel; lead engine (consent, grade, dedup, outbox, owner alert, attribution, ref codes, thank-you state); **minimal admin** (leads inbox with follow-ups and assignments; provider list); provider CSV import; `/for-contractors/`; brand, legal and trust pages; brand locality guides (owner-reviewed); the top **8 localities × 5 services** where local substance exists; seasonal calendar; interaction events; sitemaps, robots, llms.txt and ads.txt | ≥ 40 locality × service pages pass the gate; E2E funnel green; Lighthouse budgets met; launch gate ready for your sign-off |
| **M2** | **Full admin**: places, dishes, experiences + photos, providers + prospects, cost models, prose review, approval queue, featured, sponsorships (own flag), sales quotes, metrics, business reports, rebuild, health | Admin E2E tests; Access JWT tests; requests without Access are rejected |
| **M3** | **Food**: craving engine and map, ranking, labels, trust labels, Food Pulse, What's Hot, gated dish / locality / intent pages, place profiles, Open-now and Near-me filters, feedback widget | Gate report shows food pages built only from real evidence entered via the admin or CSV |
| **M4** | **Pipeline + live Ask**: gateways, key pool, deterministic + Groq extraction, grounding, independence rules, dedup function, nightly schedule, Search Console import, demand prioritisation, IndexNow, backups, health report, dead-man alert | Error-matrix tests; extraction precision ≥ 0.95 on fixtures; Ask within ≤ 20 subrequests; live keys verified once you add them |
| **M5** | **Monetisation hardening**: ad-slot system (flags off), AdSense readiness, experiments framework, competitor-blocking list, Lighthouse with ads in test mode; docs (README, ARCHITECTURE, DEPLOY, RUNBOOK, DATA-POLICY, EDITORIAL-POLICY); final independent review | Full CI green; review findings resolved |
| **M6** | **Marathi + Hindi** top pages: translated UI strings and `*_i18n` content, `hreflang` pairs (only between pages that both exist and are indexable) | hreflang reciprocity test passes; translations stay `noindex` until you review them |

---

## 22. What I need from you

1. **npm access** in this environment (Network access → allow `registry.npmjs.org`). This blocks every build.
2. **GitHub push access:** reconnect GitHub or install the Claude GitHub App on `Amitsjoysm/MoneymakerId`. Pushing currently fails with a 403.
3. **Later, all on free plans** (`DEPLOY.md` will walk you through each):
   - a Cloudflare account, with your DNS moved to it
   - a Supabase project
   - Groq, Exa and Firecrawl keys
   - a Turnstile site
   - an Access application
   - a Google service account for Search Console
   - Bing Webmaster verification
   - later, the AdSense publisher ID

   Secrets go into Cloudflare and GitHub settings, never into chat.
4. **Your time after M1:** review the AI-drafted prose (5–10 cost guides and up to 20 locality profiles), sign off the launch gate, and start entering experiences.

---

## 23. Honest expectations and risks

- **Ranking takes time.** A new domain usually needs months to rank for head terms like "best biryani in Pune", where Zomato, Swiggy, Justdial and Google Maps compete. The plan goes after long-tail and cost-intent searches first, and times the waterproofing pages for April.
- **AI recommendations follow mentions across the web**, not only on-site markup. Off-site work is still needed: a Google Business Profile for MarketMind AI, social profiles, and badge backlinks.
- **Food pages need evidence.** Your first-hand experiences are the fastest way to get them.
- **Free-tier ceilings** (verified):
  - **Supabase:** 500 MB, and it pauses when inactive (our jobs prevent this). No backups, so we add our own.
  - **Workers:** 10 ms CPU per request; the Ask is designed for this.
  - **Groq:** 8k tokens per minute.
  - **Exa:** about 20 searches a day per account.
  - **Firecrawl:** about 30 scrapes a day per account.
- **Multi-account rotation** can get every linked account banned (§10).
- **Lead resale depends on providers.** Until they sign up, leads are worth nothing. `/for-contractors/` and the Prospects view are there to fix that.

---

## 24. Out of scope for v1

- Cities other than Pune
- Online payments (featured plans and leads are paid manually)
- A self-serve provider dashboard
- A native app
- Media.net and Infolinks (considered only after AdSense data exists)

---

## Resolved questions
- **Q-D Instant alerts:** **both**. A Telegram bot sends instant push alerts with a tap-to-WhatsApp link, and Cloudflare Email Routing sends an email copy as a searchable record. Both cover new leads, disabled keys, the dead-man alert and the daily health report.

## Appendix: sources checked on 6 Oct 2026
- AdSense: sites and subdomains [12170421](https://support.google.com/adsense/answer/12170421), Auto ads exclusions [9262311](https://support.google.com/adsense/answer/9262311), ads.txt [12171612](https://support.google.com/adsense/answer/12171612), [7679060](https://support.google.com/adsense/answer/7679060), [9785052](https://support.google.com/adsense/answer/9785052), CMP requirement [13554116](https://support.google.com/adsense/answer/13554116), eligibility [9724](https://support.google.com/adsense/answer/9724), required privacy content [1348695](https://support.google.com/adsense/answer/1348695)
- Google Search: [SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), [ranking systems guide](https://developers.google.com/search/docs/appearance/ranking-systems-guide), [spam policies](https://developers.google.com/search/docs/essentials/spam-policies), [AI optimisation guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), [Search generative AI control](https://support.google.com/webmasters/answer/16908024), [Search updates](https://developers.google.com/search/updates)
- AI crawlers: [OpenAI bots](https://developers.openai.com/api/docs/bots), [Anthropic crawlers](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler), [Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers), [Cloudflare AI traffic defaults](https://developers.cloudflare.com/changelog/post/2026-07-01-ai-traffic-options/), [IndexNow](https://www.indexnow.org/documentation), [llms.txt](https://llmstxt.org/)
- Groq: [structured outputs](https://console.groq.com/docs/structured-outputs), [models](https://console.groq.com/docs/models), [deprecations](https://console.groq.com/docs/deprecations), [rate limits](https://console.groq.com/docs/rate-limits), [errors](https://console.groq.com/docs/errors), [acceptable use](https://console.groq.com/docs/legal/ai-policy)
- Exa: [search API](https://exa.ai/docs/reference/search.md), [error codes](https://exa.ai/docs/admin/error-codes.md), [pricing](https://exa.ai/docs/admin/pricing.md), [billing](https://exa.ai/docs/admin/billing.md)
- Firecrawl: [v2 OpenAPI](https://docs.firecrawl.dev/api-reference/v2-openapi.json), [billing](https://docs.firecrawl.dev/billing.md)
- Astro and Cloudflare: [Astro 7.3](https://astro.build/blog/astro-730/), [Astro joins Cloudflare](https://blog.cloudflare.com/astro-joins-cloudflare/), [Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/), [Workers static assets](https://developers.cloudflare.com/workers/static-assets/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [deploy hooks](https://developers.cloudflare.com/changelog/post/2026-04-01-deploy-hooks/), [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- Supabase (from the official `supabase/supabase` repo docs): plans, free-project pausing, database size, API keys, RLS, RBAC/custom claims

Some vendor pages could not be opened directly from this environment, and some facts were read from official search extracts or the vendors' own doc repositories. Versions and prices are re-checked at scaffold time.
