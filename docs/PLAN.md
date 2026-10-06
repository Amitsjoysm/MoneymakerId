# MarketMind AI: Build Plan v1

**Status:** DRAFT, waiting for owner approval. No application code is written until this plan is approved.
**Date:** 6 October 2026
**Source spec:** `Makemoney.txt` (MarketMind AI Final MVP), plus the owner's answers recorded in §1.

---

## 0. Goal and definition of done

**Business goal:** bring in as much Pune local search traffic as possible and turn it into revenue quickly. Construction leads come first because a lead is worth the most per visitor. Featured listings and direct sponsorship come second, and display ads third.

**v1 is done when all of the following hold:**

1. A Pune user searching *"waterproofing cost in Wakad"* lands on a fast page with a sourced cost range, local factors, a calculator, providers (once any exist) and a quote form. Submitting the form stores a lead in Supabase and opens WhatsApp to the MarketMind AI number with the details prefilled.
2. A user searching *"best biryani in Hinjewadi"* lands on a page whose recommendations are backed by evidence (first-hand visits, cited sources, dated prices). If there is not enough evidence, the page does not exist or is `noindex`. It is never padded.
3. The owner can add restaurants, dishes, prices and **personal first-hand experiences**, plus providers, cost data and featured listings, through an admin interface. A rebuild then publishes the changes.
4. The live "Ask" box answers questions in real time from the database. When data is missing or stale it uses Exa + Groq instead. Every fetched fact is validated against a strict schema, linked to its source and stored for reuse.
5. No fabricated businesses, prices, ratings or reviews exist anywhere in the build. Paid placement is always labelled.
6. Supabase uses the **new API keys** (`sb_publishable_…` / `sb_secret_…`), since the legacy anon/service_role keys are being retired by the end of 2026. Every table revokes the default grants explicitly before granting what it needs.
7. CI is green on a clean clone: install, typecheck, lint, unit tests and the build of every app. On a representative page of each type, Lighthouse mobile scores are Performance ≥ 95, SEO 100 and Accessibility ≥ 95, with CLS < 0.1.

---

## 1. Decisions already made (your answers)

| Topic | Decision |
|---|---|
| Hostnames | Subdomains: `marketmindai.com` (brand, trust and business pages), `food.marketmindai.com` and `construction.marketmindai.com`. New in this plan: `admin.marketmindai.com` (private). |
| Hosting | Cloudflare **Workers with static assets**. This is what Cloudflare now recommends for new projects, and the Astro Cloudflare adapter no longer supports Pages (see §3). |
| Data sources | All three: the automated pipeline (Exa + Firecrawl + Groq, keys added later), manual CSV curation, and the **admin UI for personal experiences** (added at your request). |
| Launch order | Construction first, because it has the fastest path to leads. Food pages publish as evidence arrives. |
| Real-time | The live Ask feature uses Groq + Exa to answer questions. Every result is stored in a strict, reusable format. Searches per locality (anonymous) feed "popular in this area" recommendations. |
| Errors / keys | Every provider error class is handled explicitly. Multiple keys per provider fail over on errors (§9; **please read the verified terms note there**). |
| Leads | Stored in Supabase, then handed off on WhatsApp to 9834346179 (Sarbanand / MarketMind AI). |
| Admin login | Cloudflare Access email one-time PIN, plus server-side JWT verification. |
| Web-found places | Auto-publish when ≥ 2 independent recent sources agree and at least one claim is grounded; everything else goes to the approval queue. |
| Languages | English for every page, plus Marathi and Hindi versions of the top pages with `hreflang` (M6, after English is live). Translations are written properly and flagged for native-speaker review, never machine filler. |
| Featured pricing | Tiers show their features, with "Contact for pricing" (WhatsApp/form). The price fields exist in config for later. |
| Experience photos | Yes. Uploads from your phone are resized to WebP in the browser and stored in Supabase Storage. |
| Analytics | Cloudflare Web Analytics + our own anonymous events **and** Google Analytics 4. GA4 loads after the page is interactive (protects speed) and uses Consent Mode v2: denied by default for EU/UK/CH visitors until consent, granted elsewhere. |
| Domain | Owned. DNS is currently elsewhere and moves to Cloudflare (free; steps in `docs/DEPLOY.md`). |

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
                      Cloudflare (DNS · HTTPS · CDN · cache · WAF · Turnstile · Access)
  ┌──────────────────┬───────────────────────┬────────────────────────────┬──────────────────────┐
  marketmindai.com    food.marketmindai.com    construction.marketmindai.com  admin.marketmindai.com
  (static + /api/lead) (static + /api/ask,      (static + /api/lead,          (server-rendered,
                        /api/lead, /api/event)   /api/ask, /api/event)          behind Cloudflare Access)
          │                     │                         │                           │
          └─────────────────────┴────────────┬────────────┴───────────────────────────┘
                                             │  (server-side only; secret key never sent to browsers)
                                         Supabase Postgres
                                             ▲
            GitHub Actions nightly cron ─────┘  pipeline: discover (Exa) → fetch (Firecrawl) →
            (or on-demand from admin)            extract (Groq, strict schema) → verify → store →
                                                 rank → rebuild static sites → sitemaps → IndexNow
```

- **Page views never call an AI or crawler** (spec §92). Pages are static HTML built from Supabase plus curated files, and served from Cloudflare's cache.
- **Only the Ask endpoint calls Exa/Groq live**, and only on a database miss or stale data, behind rate limits and a daily budget cap (§8).
- **Cloudflare Workers with static assets**, one Worker per host (4 Workers):
  - Requests for static files are served **free and unlimited** and never run the Worker.
  - Only `/api/*` and admin requests run code.
  - Built with **Astro 7.3** and `@astrojs/cloudflare` 14.x. Exact versions are pinned when npm access opens.
  - Workers Free allows 100k dynamic requests/day with 10 ms CPU per request. Workers Paid ($5/month) lifts this to 30 s, and is recommended once the live Ask is on.
  - Deploys run through Workers Builds, with **deploy hooks** for scheduled and admin-triggered rebuilds.
- **No VMs.** GitHub Actions replaces the "VM #2" worker for the nightly pipeline. If Supabase or the pipeline is down, the sites keep serving their last build.

---

## 4. Repository layout (pnpm monorepo, TypeScript strict)

```
apps/
  main/           Astro: marketmindai.com
  food/           Astro: food.marketmindai.com
  construction/   Astro: construction.marketmindai.com
  admin/          Astro (server-rendered): admin.marketmindai.com
packages/
  core/           domain types, Zod schemas, locality resolver, intent parser,
                  ranking, temperature labels, cost engine, quality gate,
                  SEO engine (titles, meta, canonical, JSON-LD), internal linking, config
  ui/             design tokens + shared Astro components and layouts
  db/             typed Supabase REST client (fetch-based, works on Workers + Node),
                  build-time data loader (Supabase → falls back to curated files)
  providers/      Exa / Firecrawl / Groq gateways, key pool, retry, circuit breaker, budgets
  pipeline/       nightly jobs + CLI (discover, refresh, extract, normalise, rank, rebuild, IndexNow)
  edge/           shared server handlers: lead, ask, event, turnstile, rate limit
data/
  localities.json   Pune locality database (20 localities + Hinjewadi phases)
  dishes.json       15 dishes: aliases, craving tags, diet, sanity price bounds
  services.json     5 construction services: units, scope items, local factors
  cost-models/      cited, dated cost models per service/tier
  curation/*.csv    manual curation templates (restaurants, dishes, providers, experiences)
supabase/
  migrations/       schema, RLS, functions (rate limit, upserts)
docs/               PLAN.md, ARCHITECTURE.md, DATA-POLICY.md, RUNBOOK.md, DEPLOY.md
.github/workflows/  ci.yml, nightly.yml
```

Dependencies are deliberately few: `astro`, `@astrojs/cloudflare`, `zod`, `typescript`, `vitest`, `@astrojs/check`, one self-hosted variable font. There is no UI framework, no Tailwind and no jQuery. Interactive parts (calculator, quote form, Ask box, filters) are small vanilla TypeScript islands.

---

## 5. URL map and indexing rules

Every URL has a trailing slash, lowercase hyphenated slugs, one canonical and exactly one H1. Filter, sort and tracking parameters never create new indexable URLs.

### construction.marketmindai.com (launches first)
| URL | Content | Indexed when |
|---|---|---|
| `/` | "What do you need?" picker, calculator, popular services, localities | always |
| `/pune/` | city hub: services, costs, localities, Construction Pulse | always |
| `/pune/{service}-cost/` | city cost guide: low/expected/high by tier, what's included, factors, materials, duration, mistakes, quote checklist, FAQ | cost model has ≥ 2 cited sources |
| `/pune/{locality}/` | locality hub: popular services, typical costs, providers, quotes | locality profile complete |
| `/pune/{locality}/{service}/` | local cost + local factors + providers + quote CTA | quality gate passes (§11). Otherwise the page is not built. |
| `/provider/{slug}/` | provider profile | provider has evidence + service area |
| `/cost-calculator/` | full calculator | always |
| `/get-quotes/` | multi-step quote form (no ads) | `noindex` |
| `/about/` | methodology for construction data | always |

Five services in v1: waterproofing, painting, bathroom renovation, modular kitchen, house construction.

### food.marketmindai.com
| URL | Content | Indexed when |
|---|---|---|
| `/` | "What are you craving?" + locality + budget, What's Hot in Pune | always |
| `/pune/` | city hub: dishes, localities | always |
| `/pune/{dish}/` | dish across Pune: top picks per locality | ≥ N evidence-backed places |
| `/pune/{locality}/` | locality Food Pulse: hot, value, late-night, popular dishes, nearby | ≥ N evidence-backed places |
| `/pune/{locality}/{dish}/` | the money page: "Best Biryani in Hinjewadi, Pune" | quality gate passes; otherwise not built |
| `/place/{slug}/` | restaurant profile: dishes, prices, hours, evidence, last checked | has evidence |
| `/ask/` | live Ask (Exa + Groq) | `noindex` |
| `/about/` | methodology for food data | always |

`/pune/{dish}/` and `/pune/{locality}/` share one route. A test guarantees that dish and locality slugs never collide.

### marketmindai.com
`/pune/` and `/pune/{locality}/`: **Pune locality guides**. Each guide is the area's own page (landmarks, office and residential clusters, what the area is known for, links into its food and construction pages). This gives the root domain substantial original content of its own, which AdSense reviews. `/`, `/about/`, `/contact/`, `/privacy/`, `/terms/`, `/cookie-policy/`, `/editorial-policy/` (how we rank, evidence and corrections; this builds trust and LLM credibility), `/advertise/`, `/feature-your-business/`, `/featured/`, `/claim-business/`. The forms are ad-free. Each host serves its own `robots.txt`, `sitemap.xml` (an index pointing to per-type sitemaps), `llms.txt`, `ads.txt` and 404 page.

### Quality gate (spec §4, §57, §62)
```
indexable = evidence_count ≥ MIN_EVIDENCE      (cited or first-hand facts)
        and entity_count  ≥ MIN_ENTITIES        (places/providers with evidence)
        and locality_relevance ≥ MIN_RELEVANCE  (entities actually in/serving the locality)
        and unique_content_score ≥ MIN_CONTENT  (page differs materially from siblings)
```
The thresholds live in config. Pages that fail the gate are **not built** (preferred, to avoid thin pages hurting AdSense review) or are built `noindex,follow` where the page is still useful to visitors. Sitemaps list only pages that are indexable, canonical and return 200. A build report lists every page with its gate scores.

---

## 6. Data model (Supabase Postgres)

The spec §67 tables, normalised:

- **Geography:** `cities`, `localities` (aliases, parent, neighbours, landmarks, office/residential clusters, lat/lng)
- **Catalogue:** `businesses` (shared fields: kind = restaurant | provider, status = candidate | published | hidden, verification_status, confidence, last_verified_at), `restaurants`, `providers`, `dishes`, `restaurant_dishes` (variant, price_inr, evidence_id, last_seen_at), `construction_services`, `provider_services`, `cost_models`
- **Evidence:** `sources` (url, domain, kind, content_hash, http_status, fetched_at), `evidence` (entity, claim_type, claim JSON, supporting_quote, source_id, retrieved_at, confidence, valid_until, extractor_version), `observations` (append-only history, spec §68), **`experiences`** (first-hand visits from the admin: visited_at, dishes tried, price paid, rating 1–5 per dish, notes, would_recommend, photos optional)
- **Ranking:** `ranking_runs`, `recommendations` (organic_score + every component stored; `commercial_score` kept separate, spec §70)
- **Revenue:** `leads` (with status, qualified flag, sold_to, revenue_inr), `featured_listings`, `advertisers`, `campaigns`, `ad_slots`, `ad_events`
- **Usage:** `queries` (anonymous: vertical, locality, dish/service, constraints, no IP), `query_cache` (TTL), `events`, `rate_limits`
- **Ops:** `jobs`, `api_credentials` (key fingerprint, usage, errors, cooldown; **never the key itself**), `system_events`, `business_claims`, `page_builds`

RLS is enabled on every table. Browsers have **no** direct table access. All writes go through our server endpoints using the secret key. Public catalogue reads happen at build time. A storage budget keeps the database under the 500 MB free tier: raw HTML is never stored, only hashes. `query_cache` and old `ad_events` are pruned on a schedule.

---

## 7. How data gets in

| Path | What | Status of the data |
|---|---|---|
| **A. Admin UI** (§13) | You add places, dishes, prices, **personal experiences**, providers, featured listings | `published`, with first-hand evidence labelled "Tried by MarketMind AI" |
| **B. CSV curation** | Bulk templates in `data/curation/`, imported with `pnpm import:csv` (validated, with dry-run diff) | `published` if every row passes validation |
| **C. Nightly pipeline** | Exa discovers official sites and menus, Firecrawl fetches changed pages only (hash compare), Groq extracts to strict schema | `candidate` until it passes auto-publish rules (§8) or you approve it in the admin |
| **D. Live Ask** | A database miss triggers Exa + Groq; results are shown to the user labelled "found on the web just now, not yet verified" and stored as `candidate` | same as C |

---

## 8. Strict data contract and real-time Ask

**Every value that enters the database passes all of these checks:**
1. **Schema:** a Zod schema per entity and claim type. Groq is called with strict JSON-schema output, then validated again by Zod. Anything invalid is rejected and logged, never "fixed up" by guessing.
2. **Grounding:** every extracted claim (price, dish, address, hours) must carry a supporting quote that is actually found in the fetched source text, using normalised matching. Claims without one are dropped. This blocks LLM hallucinations.
3. **Normalisation:** locality resolved via the alias dictionary (e.g. "Hinjawadi", "Hinjewadi Phase 1" → `hinjewadi-phase-1`), names and phone numbers normalised, prices in integer ₹ within each dish's sanity bounds, and dates in ISO format with the IST timezone.
4. **Dedup:** records are matched on (normalised name + locality) or website/phone. Matches merge into an existing business, and history is kept in `observations`.
5. **Confidence:** each claim's confidence is derived from source type (official site > menu PDF > directory > blog), agreement between sources, and freshness. It is computed by code, not by the LLM. Groq is **never** authoritative for price, address, hours, distance or ranking (spec §51).

**Ask flow:** parse intent deterministically (dish/service + locality + budget + diet) → per-IP rate limit (hashed, daily salt, IP never stored) → answer cache → database (rank, answer, with no AI) → only if data is missing or stale, Exa search + Groq extraction → verify → store as candidate → answer with citations. A daily budget cap per provider stops runaway costs. **Verified cost of one live lookup:** Exa search (auto, ≤ 10 results) $7/1k, plus page text $1/1k per page, plus Groq `gpt-oss-120b` at $0.15/$0.60 per 1M tokens. That comes to about **$0.016 (≈ ₹1.4) per uncached lookup**. Cached answers and database hits cost nothing. Exa gives $10 of free credit each month, roughly 600 lookups. If Exa or Groq fails, the user still gets database results, or a helpful fallback with a WhatsApp CTA.

**Auto-publish rule for web-found places** (decided): a place becomes `published` only if ≥ 2 independent sources agree on name + locality and at least one dish claim is grounded. Everything else waits in the admin approval queue.

---

## 9. Provider gateway and key pool

Each provider takes a comma-separated list of keys (`GROQ_API_KEYS`, `EXA_API_KEYS`, `FIRECRAWL_API_KEYS`). The gateway tracks each key by fingerprint and handles errors as follows:

| Error | Action |
|---|---|
| Network error / timeout | Retry the same key with exponential backoff + jitter (max 2), then try the next key |
| 401 / 403 (bad or revoked key) | Disable that key for 24 h, try the next key, raise a system event |
| 402 (credits exhausted) | Disable the key until the next day, try the next key, raise a system event |
| 429 (rate limited) | Cool the key down for `Retry-After` (or exponential), try the next key; if all keys are cooling, queue (pipeline) or fall back (Ask) |
| 5xx / provider capacity | Retry with backoff; open the provider's circuit breaker after 5 consecutive failures, for 5 min |
| 400 / 422 (our request is wrong) | No retry; log with request fingerprint (never the key or user data) |
| Bad JSON / schema mismatch (Groq) | One repair retry with the validation error; then drop and log |
| Daily budget reached | Stop calling that provider today; serve database results |

> **Verified terms note (important).**
> - **Groq** applies rate limits **per organisation**: every key in your account shares one budget, so extra keys from the same account add no capacity. Groq's Acceptable Use Policy explicitly forbids exceeding limits "by registering multiple accounts or orchestrating usage between multiple organizations".
> - **Exa** and **Firecrawl** also apply rate limits per team across all keys. Exa's free monthly credit goes only to a user's first team.
>
> So the key pool is built for **reliability**: a revoked or leaked key, exhausted credits on one key, or rotating a key with zero downtime. It is **not** for multiplying free quota across accounts, which would risk a ban of every account. When volume grows, the fix is the paid tier (Groq Developer is pay-as-you-go at cents per day for our volume).

**Provider facts the gateways are built against (verified):**
- **Groq:** strict JSON-schema output works only on `openai/gpt-oss-120b` (primary) and `openai/gpt-oss-20b` (fallback). `llama-3.3-70b` is no longer self-serve. Strict mode requires every field to be listed as required and allows no extra properties. The free tier is 30 req/min, 1k req/day and 8k tokens/min. Groq also returns 413 (too large), 422 (retryable) and 498 (capacity), all of which are handled.
- **Exa:** `POST /search` with `type: auto`, `userLocation: "IN"` and `maxAgeHours` for freshness. Errors are 402 `NO_MORE_CREDITS`, 429 with `Retry-After`, and 503 (not billed).
- **Firecrawl v2:** `POST /v2/scrape` with `formats: ["markdown"]`, `location.country: "IN"` and `maxAge` for caching. A scrape costs 1 credit (JSON mode costs 5, so we do not use it; Groq extracts more cheaply). The free tier is 1,000 credits/month at 10 req/min. Note: Firecrawl's terms restrict commercial use to what is "expressly authorized". Check with them before relying on the free tier commercially; paid plans are intended for commercial use.

---

## 10. Ranking, labels, cost engine

- **food_score** and **provider_score** use exactly the weights in spec §12 and §17. Every component is normalised to 0–1 and stored. First-hand experiences count as strong evidence (`dish_evidence`, `rating_strength`). Sponsorship never changes `organic_score`.
- **Temperature labels** (🔥 Hot, 🚀 Trending, 🌡️ Warm, 💎 Hidden gem, ❄️ Cold, 💰 Best value, 🌙 Late night, 👨‍👩‍👧 Family, 🧑‍💻 Office lunch) are computed from data with spec §13 thresholds, and are **shown only when minimum evidence exists**. They are never written by an LLM.
- **Cost engine:** service × area × tier (budget/standard/premium) × scope options × locality factor gives low/expected/high, broken into materials, labour, preparation, repair, transport and waste. It always carries the disclaimer "Estimates are indicative and are not quotations." Each cost model cites its sources and has a "last reviewed" date. Locality factors default to 1.0 unless evidence supports a different value.

---

## 11. SEO and LLM-visibility engine

- **Metadata engine:** spec §37–39 templates for title, description, canonical, robots, OG/Twitter. One H1 with an H2 outline per page type. Breadcrumbs plus `BreadcrumbList`.
- **Structured data**, only when accurate: `Organization` + `WebSite` (brand), `WebPage`, `BreadcrumbList`, `Restaurant` / `LocalBusiness` (only with verified address), `ItemList` for recommendation lists, `Review` **only** for our own first-hand experiences (author = MarketMind AI, with date). There are no aggregate ratings unless we have real data.
- **FAQs** stay on pages because they answer real questions and AI engines quote them. Google stopped showing FAQ rich results for all sites in May 2026, so `FAQPage` markup is kept only as plain schema.org for Bing and AI parsers, with no rich-result expectation.
- **Internal linking engine:** parent locality, parent category, the 3–5 nearest localities (by distance), related dishes/services and related intents. Links are capped per page.
- **For LLMs and AI search**, in order of real impact:
  1. Crawl access.
     - `robots.txt` explicitly allows the AI search and user-fetch bots: `OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `Perplexity-User`, plus Googlebot and Bingbot. Training bots are covered by question Q-B.
     - **Cloudflare blocks AI "training" and "agent" bots by default on new domains added after 15 Sep 2026**, and blocking training can also block mixed crawlers. `docs/DEPLOY.md` includes the exact AI Crawl Control settings so this does not silently hide the site.
  2. Pages that are easy to quote: a "Quick answer" block at the top (facts, ₹ prices, dates, sources), stable entity names, and a visible "last checked" date on every claim.
  3. **IndexNow** pings after every deploy. Bing, Yandex and others share these, and ChatGPT search uses third-party providers including Bing. Bing Webmaster Tools now reports AI citations.
  4. Search Console **"Search generative AI features" = Include** (new in Aug 2026; it is required for AI Overviews/AI Mode eligibility).
  5. `/llms.txt` per host. It is cheap, but Google says it ignores the file and no major AI engine has confirmed using it, so it is a bonus, not a strategy.
  6. Search Console and Bing Webmaster verification via DNS/env.
- **Seasonality:** pre-monsoon (Apr–May) and monsoon (Jun–Sep) modules on waterproofing pages are driven by date. This is Pune's biggest construction demand spike.

---

## 12. Monetisation

1. **Construction leads (primary):** calculator → "Get 3 free quotes" funnel; multi-step form (service, locality, area, budget, timeline, name, phone, optional notes). Turnstile protects against spam. Each lead is stored with a lead score, then handed off to WhatsApp with a prefilled summary. In the admin, leads have a status pipeline (new → contacted → qualified → sold/closed), a `sold_to` provider and revenue.
2. **Featured listings:** Free / Featured / Premium tiers (spec §20) on `/feature-your-business/`. They are always labelled "Featured · paid placement" and sit in a clearly separate block, never inside the organic ranking.
3. **Direct sponsorship:** locality and category sponsorship slots, e.g. "Hinjewadi Food Guide · Sponsored by X", managed from the admin, with impressions and clicks tracked.
4. **Display ads:** the spec §21 slot system: `showAd(slot, pageType, device, host)` from one config. Slots reserve space only when enabled, so there is no layout shift. **Ads stay OFF at launch** and are turned on with one env flag after AdSense approval. `ads.txt` is generated from the publisher ID env var. Pages that never get ads: contact, legal, quote, feature, claim, admin.
5. **Outbound / affiliate:** "Order on Swiggy/Zomato" and "Directions" links are tracked as outbound clicks, and affiliate parameters are added later if programmes become available.
6. **Growth enhancements (new):**
   - A "Featured on MarketMind AI" badge snippet for listed businesses to embed, which earns backlinks and authority.
   - A "Claim this business" → featured upsell path.
   - WhatsApp CTAs that carry page context, e.g. "Hi, I need waterproofing quotes in Wakad".

Disclosures per spec §86 appear wherever relevant.

---

## 13. Admin interface (new, at your request)

**`admin.marketmindai.com`**, a server-rendered Astro app protected by **Cloudflare Access** (one-time PIN to your email, free). Every request is also verified server-side against the Access JWT, so the admin is never protected only by a login screen.

Screens:
- **Places:** add/edit restaurants (name, locality, address, map pin, phone, website, hours, price range, diet). Duplicate warnings as you type.
- **Dishes & prices:** add dishes to a place with price and date checked.
- **My experiences:** "I visited X on date Y, tried dishes A/B, paid ₹Z, rating, notes, recommend?" (with optional photos, resized to WebP before upload). These become first-hand evidence and the "Tried by MarketMind AI" badge.
- **Providers:** contractors, their services, service areas, experience, verification status (manual checks only).
- **Cost models:** review and adjust rates, add sources, set "last reviewed".
- **Approval queue:** web-found candidates with their sources and quotes; approve, edit or reject.
- **Leads inbox:** filter by service/locality/status, mark contacted/sold, record revenue, export CSV.
- **Featured & sponsorships:** create listings and campaigns with start/end dates.
- **Publish:** a "Rebuild sites now" button that triggers the deploy; it shows the last build and its page-gate report.
- **Health:** API key status (fingerprints only), budgets, errors, job runs.

The admin is mobile-friendly so you can log experiences from your phone at the restaurant.

---

## 14. UI and design system

The Impeccable skill is not installed in your catalogue. Superpowers is in your catalogue but not enabled in this session. I will follow both methods by hand:
- From **Superpowers**: plan, then TDD, then verification before claiming anything is done.
- From **Impeccable**: deliberate typography, OKLCH colour tokens, tinted neutrals, no generic "AI look" (no purple gradients, no card-in-card, no emoji-as-design).

You can enable Superpowers for future sessions from the plugin card.

- **Direction:** an editorial local guide, task first.
  - **Food:** warm spice palette (turmeric, chilli, cardamom-green accents) on warm paper neutrals.
  - **Construction:** blueprint ink + terracotta on cool neutrals.
  - **Shared:** a type scale, spacing and components.
- **Type:** one self-hosted variable display font for headings, and the system UI stack for body text (zero font cost for body, fast LCP).
- **Mobile-first:** large tap targets, a sticky but dismissible action bar (Get quotes / WhatsApp), no popups, no autoplay, no hero images above the fold, and light/dark themes.
- **Accessibility:** semantic HTML, keyboard support, visible focus, colour contrast ≥ 4.5:1, labelled forms.

---

## 15. Privacy, security, abuse protection

- Secrets live only in Cloudflare/GitHub env and are never sent to the browser. Logs store fingerprints of keys, never the keys.
- Analytics: Cloudflare Web Analytics and our own event table are cookieless and anonymous. GA4 runs under Consent Mode v2, with a consent banner only for EU/UK/CH visitors. Personal data exists only in leads, with a consent checkbox and a retention policy described on the privacy page.
- Turnstile protects every form. Rate limits apply per hashed IP plus a Cloudflare WAF rate rule on `/api/*`. Input length limits and strict validation apply server-side.
- Security headers include CSP, HSTS, X-Content-Type-Options, Referrer-Policy and Permissions-Policy.
- The WhatsApp number appears only on MarketMind AI contact/CTA surfaces, never inside business records or business structured data (spec §35, final note).
- Data policy (spec §87): source attribution, retrieval dates, derived facts only. Full reviews, articles and photos without rights are never copied.

---

## 16. Performance budget

| Metric | Target |
|---|---|
| HTML (gzip) | < 30 KB typical page |
| JavaScript (ours) | < 3 KB on content pages (event beacon); < 15 KB on calculator/form/Ask pages. GA4 (~50 KB) is loaded after interaction/idle so it does not affect LCP. |
| CSS | < 25 KB, single file, cached |
| Fonts | 1 woff2, preloaded, `font-display: swap` with metric-matched fallback |
| LCP / CLS | < 2.0 s on mid-range mobile 4G / < 0.1 |
| Cache | static HTML cached at the edge; immutable hashed assets |

---

## 17. Testing and verification

- **TDD for all logic:** locality resolver, intent parser, ranking, labels, cost engine, quality gate, SEO templates, link engine, key pool and error matrix, schema validation and grounding checks, lead and Ask handlers (with mocked providers).
- **Build checks (fail the build):**
  - exactly one H1 per page
  - a canonical tag on every page
  - no `noindex` page in a sitemap
  - every sitemap URL exists
  - JSON-LD parses and matches its schema
  - no internal link returns 404
  - no WhatsApp number inside business data
  - `robots.txt` has no `Disallow: /` in production
- **E2E (Playwright):** quote funnel, Ask with mocked providers, and admin CRUD against a local Supabase or a mock.
- **Lighthouse CI** on one page per type, against the budgets in §16.
- **CI:** GitHub Actions runs everything on every push. A failing check blocks the merge.

---

## 18. Milestones

Each milestone ends with its acceptance checks passing, a commit and a push to `claude/relaxed-sagan-uipz8o`.

| # | Milestone | Acceptance |
|---|---|---|
| M0 | Foundation: monorepo, tooling, CI, design tokens, core types/schemas, Supabase migrations | clean install/typecheck/test/build green in CI; migrations apply to a fresh database |
| M1 | **Construction + brand site** (revenue first): cost engine, 5 cited cost models, calculator, city/service/locality pages with gate, quote funnel → Supabase + WhatsApp, brand/legal/feature/claim/advertise pages, sitemaps/robots/llms.txt/ads.txt | §0 item 1; Lighthouse budgets; lead stored in a test database |
| M2 | **Admin**: Access-protected CRUD for places, dishes, experiences, providers, cost models, leads, featured; rebuild trigger | E2E admin tests; unauthenticated requests rejected |
| M3 | **Food**: craving engine, ranking, labels, Food Pulse, What's Hot, gated dish/locality pages, place profiles, CSV import | §0 item 2 with seed data from admin/CSV; gate report |
| M4 | **Pipeline + live Ask**: gateways, key pool, Exa/Firecrawl/Groq, grounding, nightly cron, rebuild, IndexNow, anonymous search-history recommendations | error-matrix tests; Ask works with mocked and (once keys exist) real providers |
| M5 | **Hardening**: ad-slot system wired (off), analytics events, security headers, docs (README, DEPLOY, RUNBOOK, DATA-POLICY), final review pass | full CI green; independent review checklist complete |
| M6 | **Marathi + Hindi** top pages: `/mr/` and `/hi/` paths per host, `hreflang` pairs, translated UI strings | hreflang validation test; translations flagged for your review |

---

## 19. What I need from you (can come later; nothing blocks M0 except npm access)

1. **npm access in this environment** (Network access → allow `registry.npmjs.org`). This is a hard blocker for any build.
1b. **GitHub push access**: reconnect GitHub / install the Claude GitHub App on `Amitsjoysm/MoneymakerId`. Pushing currently fails with a 403.
2. Move the DNS for `marketmindai.com` to Cloudflare (free; I'll write the step-by-step).
3. Accounts, created by you, with secrets added in Cloudflare/GitHub and never pasted in chat: Supabase project, Cloudflare account, Groq / Exa / Firecrawl keys, and later AdSense publisher ID, Search Console and Bing Webmaster verification.
4. Your answers to the remaining open questions below.

---

## 20. Honest expectations and risks

- **Ranking takes time.** A new domain typically needs months, not days, to rank for competitive terms like "best biryani in Pune" against Zomato, Swiggy, Justdial and Google Maps. The fastest wins are long-tail and cost-intent queries ("terrace waterproofing cost Wakad", "biryani under ₹300 Hinjewadi"). The plan targets those first.
- **LLM recommendations** come from being cited and mentioned across the web, not only from on-site markup. Off-site work is outside the code: a Google Business Profile for MarketMind AI, social profiles, and business backlinks via the featured badge.
- **Food pages are only as good as the evidence.** Your first-hand experiences are the strongest differentiator. Without data, food pages stay unbuilt rather than thin.
- **Cost data must stay current.** Cost models expire (`valid_until`), and expired ones drop out of the index until they are reviewed.
- **Free-tier limits (verified):**
  - **Supabase Free:** 500 MB database (read-only above that), 1 GB storage, 5 GB egress. It pauses after 7 days of low activity (our nightly job and builds count as activity). **There are no backups on Free**, so the plan adds a nightly encrypted `pg_dump` from GitHub Actions. Supabase Pro ($25/month) adds daily backups and never pauses.
  - **Workers Free:** 10 ms CPU per request.
  - **Groq free tier:** 8k tokens/min, roughly one extraction per minute.
  - Upgrade points are documented in `docs/RUNBOOK.md`.

---

## 21. Out of scope for v1
Cities other than Pune; payments and checkout for featured plans (enquiry via form/WhatsApp only); a provider self-serve dashboard; a native app; media.net / Infolinks (only after AdSense data exists).

---

## Open questions (to answer before approval)
- **Q-A Live Ask budget:** maximum uncached live web lookups per day (about $0.016 each).
- **Q-B AI training bots:** allow `GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended` and `CCBot` (helps future models know the brand), or allow only AI *search* bots?
- **Q-C Paid services at launch:** which of Groq Developer (pay-as-you-go), Workers Paid ($5/month), Supabase Pro ($25/month) and Firecrawl Hobby ($19/month) you are willing to use.

---

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
