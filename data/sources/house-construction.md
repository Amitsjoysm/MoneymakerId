# Research log: house-construction (D03, Wave 1)

- **Date:** 2026-10-06
- **Owner files:** `data/services/house-construction.json`, `data/cost-models/house-construction.json`, this log
- **Status:** **BLOCKED. No sources were gathered, so no cost model is included.** This pack needs a re-run when web research is available.

## Why it is blocked

1. **WebSearch:** the first query returned *"Web search was not performed: this turn's web search budget is used up (limit: 200 WebSearch calls per turn, shared by every agent in it)"*. The parallel Wave 1 agents had already used the shared budget before this task's first query.
2. **WebFetch:** every publisher domain tried was blocked by the egress proxy (`EGRESS_BLOCKED`) or returned "unable to fetch". The URLs below were only reachability tests. **No content was retrieved from any of them, and none is cited anywhere.**

Under the source-integrity rules (cite only pages actually seen; each model needs ≥ 2 independent publishers), nothing could be cited. So:
- `data/cost-models/house-construction.json` is `[]`. No model met the ≥ 2 independent sources rule, because none had any source.
- `data/services/house-construction.json` is a skeleton. It holds only taxonomy and editorial guidance that makes no numeric claims: scope options, material definitions, questions, mistakes, the quote checklist and an FAQ. It has `area_presets: []`, every `materials[].sources: []`, and a **placeholder `duration_days` of `{min: 0, max: 0}`** whose `basis` says NOT SOURCED. The contract does not make `duration_days` nullable, so a sentinel was the only shape-valid option, as in the modular-kitchen pack. It must be replaced before review.
- **The material descriptions are unsourced definitions** (fired clay brick, AAC block, fly ash brick, concrete block walling inside an RCC frame). They avoid price, strength and durability comparisons, but a reviewer should check them against manufacturer or standards pages and add `sources` during the re-run.
- **The prose is unsourced guidance.** Questions, mistakes, checklist and FAQ give process advice only (area measure, inclusions, specification, approvals, stage payments). They contain no figures and no claims about Pune rules, but they still need owner review.
- `sub_services` is `[]`. §4a defines no sub-services for `house-construction`.

## Queries and fetches run

| # | Tool | Query / URL | Result |
|---|---|---|---|
| 1 | WebSearch (standard) | `house construction cost per sq ft Pune 2025` | not performed: search budget used up |
| 2 | WebFetch | `www.nobroker.in` (article path test) | EGRESS_BLOCKED |
| 3 | WebFetch | `housing.com` (article path test) | EGRESS_BLOCKED |
| 4 | WebFetch | `igrmaharashtra.gov.in` (home page) | EGRESS_BLOCKED |
| 5 | WebFetch | `www.magicbricks.com` (article path test) | unable to fetch |
| 6 | WebFetch | `www.99acres.com` (article path test) | EGRESS_BLOCKED |
| 7 | WebFetch | `www.ultratechcement.com` (article path test) | EGRESS_BLOCKED |
| 8 | WebFetch | `cpwd.gov.in` (home page) | EGRESS_BLOCKED |
| 9 | WebFetch | `www.pmc.gov.in` (home page) | EGRESS_BLOCKED |
| 10 | WebFetch | `economictimes.indiatimes.com` (home page) | unable to fetch |
| 11 | WebFetch | `timesofindia.indiatimes.com` (Pune city page) | unable to fetch |
| 12 | WebFetch | `www.credaipune.org` (home page) | EGRESS_BLOCKED |
| 13 | WebFetch | `gharpedia.com` (article path test) | EGRESS_BLOCKED |
| 14 | WebFetch | `www.hindustantimes.com` (real estate section) | unable to fetch |
| 15 | WebFetch | `www.makaan.com` (home page) | EGRESS_BLOCKED |
| 16 | WebFetch | `www.indiamart.com` (home page) | EGRESS_BLOCKED |
| 17 | WebFetch | `www.jkcement.com` (home page) | EGRESS_BLOCKED |

I stopped after these tests. Per the tool's instructions, I did not route around the limit through search engines via curl, third-party readers, proxies or archives.

## Sources

None. No `SourceRef` appears in any of this pack's files.

## Conflicts

None to resolve, because no data was gathered.

## Gaps (all open)

- **Every cost model** (target ≥ 10 across scope × material × tier, each with ≥ 2 independent publishers).
- **`area_presets`:** typical built-up area, in sq ft across all floors, for an `independent_house` (for example a ground + 1 bungalow or row house on a Pune plot), and a `custom` preset, both with sources. `1bhk` to `4bhk` presets apply only if sources give built-up areas for independent houses of those sizes. Flat-based presets and `terrace` are not relevant to this service.
- **`materials[].sources`:** definitions of each walling material from a manufacturer, BIS or government page.
- **`duration_days`:** a sourced min/max from foundation work to handover, by scope (grey structure vs turnkey) and number of floors.
- **`min_job_inr`:** whether Pune contractors state a minimum project size.
- **Locality factors:** none expected unless a source shows a Pune locality difference, for example PMC vs PCMC vs PMRDA areas, or hilly or rocky sites.
- **Official benchmark (unchecked lead):** the IGR Maharashtra ready reckoner is understood to include a construction-cost rate per sq m used for valuation, and CPWD publishes plinth area rates. Neither was opened in this run. If either is reachable, it would be a useful non-commercial second source, but these are valuation or government-works rates rather than market quotes, so `notes` must say so.

## Plan for the re-run

**Unit (decision to confirm).** `sqft` of built-up area, added up across all floors. This matches the plan's page title "House Construction Cost per Sq Ft in Pune". The re-run must check which measure sources use: built-up, carpet or "construction area". If a source quotes per sq m (ready reckoner, CPWD), convert at 1 sq m = 10.764 sq ft and state the conversion in `notes`.

**Planned models (ids are proposals; `material_id` is the walling material):**

| id | scope_id | material_id | tier |
|---|---|---|---|
| `house-construction-turnkey-red-clay-brick-budget` | turnkey | red-clay-brick | budget |
| `house-construction-turnkey-red-clay-brick-standard` | turnkey | red-clay-brick | standard |
| `house-construction-turnkey-red-clay-brick-premium` | turnkey | red-clay-brick | premium |
| `house-construction-turnkey-aac-block-budget` | turnkey | aac-block | budget |
| `house-construction-turnkey-aac-block-standard` | turnkey | aac-block | standard |
| `house-construction-turnkey-aac-block-premium` | turnkey | aac-block | premium |
| `house-construction-turnkey-fly-ash-brick-budget` | turnkey | fly-ash-brick | budget |
| `house-construction-turnkey-concrete-block-budget` | turnkey | concrete-block | budget |
| `house-construction-grey-structure-red-clay-brick-budget` | grey-structure | red-clay-brick | budget |
| `house-construction-grey-structure-red-clay-brick-standard` | grey-structure | red-clay-brick | standard |
| `house-construction-grey-structure-aac-block-standard` | grey-structure | aac-block | standard |
| `house-construction-labour-only-budget` | labour-only | null | budget |
| `house-construction-labour-only-standard` | labour-only | null | standard |
| `house-construction-labour-only-premium` | labour-only | null | premium |

Most sources quote turnkey rates by tier (basic / standard / premium) without naming the walling material. If so, the re-run should create `material_id: null` turnkey models per tier first, and add material-specific models only where a source separates them.

**Components (editorial split, to state in `notes`).** Look for a source giving the material vs labour share of construction cost. If none is found, state that the split is editorial, as the waterproofing pack does.

**Queries to run (standard mode first, extended mode when results are thin):**
- `house construction cost per sq ft Pune 2025` / `2026`, and `bungalow construction cost Pune per sq ft`
- `construction cost per sq ft Pune basic standard premium` (NoBroker, Housing.com, MagicBricks, 99acres, Square Yards, Makaan)
- `grey structure construction cost per sq ft Pune` and `labour rate per sq ft construction Pune`
- `ready reckoner construction cost rate 2025-26 Maharashtra per sq m` (IGR Maharashtra) and `CPWD plinth area rates 2023`
- `CREDAI Pune construction cost increase 2025` (CREDAI Pune, news)
- Cement and steel manufacturer cost calculators or guides: UltraTech, ACC, Ambuja, JK Cement, JSW Steel, Tata Tiscon
- `AAC block vs red brick cost per sq ft wall India`
- `house construction time duration G+1 India months` (duration)
- News: Times of India Pune, Hindustan Times, Economic Times on Pune construction cost trends in 2025–26

## Verification (adversarial check, 2026-10-06)

**Result: the pack is shape-valid and its "no data" status is confirmed. It still cannot pass the gate.** No cost model, area preset, material source or duration could be added in this pass either, because the same blocks apply.

### Research access, re-tested

| # | Tool | Query / URL | Result |
|---|---|---|---|
| V1 | WebSearch (standard) | `house construction cost per sq ft Pune 2025` | not performed: the shared 200-call per-turn search budget is used up |
| V2 | WebFetch | `www.brickandbolt.com` (home page) | EGRESS_BLOCKED |
| V3 | WebFetch | `www.squareyards.com` (home page) | EGRESS_BLOCKED |
| V4 | WebFetch | `www.drfixit.co.in` (home page) | EGRESS_BLOCKED |
| V5 | WebFetch | `aapkapainter.com` (home page) | EGRESS_BLOCKED |

The agent proxy itself is healthy, with no relay failures. The blocks come from the cloud environment's **network access policy**, which does not allow these publisher hosts. Nothing was retrieved, so nothing could be cited, and no other agent's sources were copied in. To unblock: in the environment settings (session title bar, cloud environment menu, Edit, Network access), choose a broader access level, or choose Custom, add the publisher domains under Allowed domains and keep the default package-manager list. Then send a follow-up message so the search budget resets, and re-run D03 for this service.

### Shape check (CONTRACTS §4 / §4a)

A python check (no dependencies) of both JSON files tested:
- **ServiceDef:** exact key set; `id` and `parent_id: null`; `unit` is a `CostUnit`; slug IDs that are unique and not reserved; the `materials` key set including `sources`; `duration_days` shape with min ≤ max; question/mistake counts ≥ 6 and FAQ ≥ 5 (as in `scripts/data-coverage.mjs`); no duplicates; NFKC-normalised text; `prose_status: draft`; `sub_services: []` (§4a lists none).
- **CostModel** rules, applied to every element: exact key set; `service_id`; scope and material IDs exist in the ServiceDef; tier; unit equal to the ServiceDef unit; integer 0 < low ≤ expected ≤ high; component fractions sum to 1 ± 0.01; locality IDs in §4a; ≥ 2 sources from different publishers and hosts; SourceRef keys and `retrieved_at`; `valid_until` = `reviewed_at` + 180 days; `status: draft`.
- **Prose guard:** no digits, ₹, %, Rs, INR, lakh or crore, and no named authority or place (PMC, PCMC, PMRDA, UDCPR, RERA, Pune, Maharashtra, BIS, IS codes) in any unsourced prose field.
- **Self-test:** on a deliberately broken copy, the check reported all 10 seeded errors (prose status, scope ID, tier, unit, low > expected, fraction sum, single publisher, single host, valid_until, a ₹ figure in prose).

Result on the real files: **PASS, 0 errors.** It gave 5 warnings, all known gaps: 4 materials with `sources: []`, and the `duration_days` 0/0 placeholder. The cost-model array is empty, so the model rules passed only because there was nothing to check. `node scripts/data-coverage.mjs` reports no errors for house-construction, only the expected missing-tier and missing-fact warnings.

### Claims checked

| # | Claim (where) | Check | Outcome |
|---|---|---|---|
| 1 | No SourceRef anywhere in the pack (all three files) | Searched the JSON for URLs and SourceRef objects | Confirmed: none |
| 2 | Cost models `[]` because none had ≥ 2 independent publishers (cost-models) | Search and fetch re-tested above | Confirmed: still nothing citable |
| 3 | WebSearch budget exhausted (log, "Why it is blocked") | Re-ran the first query | Confirmed: same message |
| 4 | WebFetch blocked by the egress proxy (log) | 4 further publisher hosts tried, plus the proxy status | Confirmed: blocked by environment network policy |
| 5 | `duration_days` 0/0 sentinel follows the modular-kitchen precedent (log, ServiceDef) | Read `data/services/modular-kitchen.json` | Confirmed: identical convention |
| 6 | Component split stated as editorial "as the waterproofing pack does" (log, plan) | Read `data/cost-models/waterproofing.json` notes | Confirmed: all 16 models say so |
| 7 | Page title "House Construction Cost per Sq Ft in Pune", so unit `sqft` (log, ServiceDef) | Read PLAN §5 | Confirmed |
| 8 | §4a defines no sub-services for house-construction (`sub_services: []`) | Read CONTRACTS §4a | Confirmed |
| 9 | Prose has no figures and no Pune-specific rule claims (ServiceDef) | Prose guard above, then a manual read of all 3 scopes, 4 materials, 11 questions, 9 mistakes, 14 checklist items and 7 FAQs | Confirmed: process guidance and definitions only |
| 10 | Material definitions are accurate generic definitions (ServiceDef) | Manual review; no source could be fetched | Kept. "Made **mainly** from fly ash" stated a composition share with no source, so it now reads "made with fly ash" |
| 11 | Coverage script shows no house-construction errors (builder's report) | Ran `node scripts/data-coverage.mjs` | Confirmed: warnings only |
| 12 | Proposed model IDs in the re-run plan match ServiceDef IDs (log) | Compared each with `scope_options` and `materials` | Fixed: `red-brick` IDs renamed to `red-clay-brick` to match `material_id` |

### Sanity check (rates and units)

There are no rates, so there is nothing to compare across tiers or to test for a unit mix-up. The unit decision (sqft of built-up area, summed across floors) matches the page title and the scope descriptions. The re-run must convert any per-sq-m source (ready reckoner, CPWD) at 10.764 and must not mix per-project totals into per-sq-ft models.

### Changes made in this pass

1. `data/services/house-construction.json`: the `fly-ash-brick` description now says "made with fly ash" instead of the unsourced "made mainly from fly ash".
2. This log: the proposed IDs `house-construction-{turnkey,grey-structure}-red-brick-*` are now `...-red-clay-brick-*`. This "Verification" section was added.
3. `data/cost-models/house-construction.json`: unchanged (`[]`).

### Still open (unchanged from "Gaps")

All cost models (0 of ≥ 10; the budget, standard and premium cells are empty), `area_presets`, `materials[].sources`, a sourced `duration_days` in place of the 0/0 sentinel, `min_job_inr`, locality factors, and gate path (c) facts. The `house-construction-cost` guide cannot pass the gate until a re-run with web access fills these.
