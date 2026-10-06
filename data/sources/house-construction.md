TASK-MARKER: retryA-house-construction

# Research log: house-construction service pack (D03, retry A)

- **Owner task:** D03 · Service pack `house-construction` (retry after the blocked Wave 1 run)
- **Files:** `data/services/house-construction.json`, `data/cost-models/house-construction.json`, this log
- **Researched:** 2026-10-06 (all `retrieved_at` = `2026-10-06`; `reviewed_at` = `2026-10-06`; `valid_until` = `2027-04-04`)
- **Status:** everything is `draft`. The prose needs owner review before it can appear on an indexable page.
- **Result:** 5 cost models (turnkey budget, standard and premium; grey structure standard; labour-only standard), 1 sourced area preset, sources for all 4 walling materials, and a sourced `duration_days`. The target of 8 or more models was **not** reached: see §6.

## 1. Method and constraints

1. **WebSearch only.** WebFetch to `www.bricknbolt.com` returned `EGRESS_BLOCKED`. The earlier run had already found nobroker.in, housing.com, 99acres.com, makaan.com, squareyards.com, igrmaharashtra.gov.in and pmc.gov.in blocked, so no other page was fetched. No page was opened directly.
2. **Attribution by domain-restricted search.** Most queries set `allowed_domains` to one publisher, so the publisher of each figure is certain. The page URL is the top result whose title matches the figure's topic. Where a publisher returned several pages and the figure could belong to more than one of them, §3 marks confidence as **medium**.
3. **Quotes.** Every `quote` is copied character for character from the WebSearch tool output: the result titles, or the text the tool returned. Markdown bold markers from that text were removed. Pages could not be opened, so **no quote has been checked against the live page**. The search tool may condense page text, so the reviewer should open each URL and confirm the wording and figures before marking anything `reviewed`. Sources seen only as a result title carry `quote: null`; they back material descriptions only, never a rate.
4. **Search budget.** 36 of the 40 allowed WebSearch calls were used (§2). One WebFetch was attempted.
5. **Rules applied to every model:**
   - `low` = lowest cited low and `high` = highest cited high, so the range is widened whenever sources disagree.
   - `expected` = median of one midpoint per publisher, rounded to the nearest ₹25 with ties rounded down. A publisher that gives several figures for the same cell contributes the median of its own midpoints.
   - Open-ended figures ("₹3,200+", "beyond ₹2,500", "₹3,000 or more") are counted at the stated number, which pulls `expected` down slightly.
   - Two sources count as independent only if their publishers differ. Two pages from the same publisher count once.
   - Bases are kept apart. Turnkey models use material-and-labour figures only. The labour-only model uses labour-contract figures only. The grey-structure model uses structure-only figures only.
   - `min_job_inr` = `null` everywhere, because no source states a minimum project size.
   - `locality_factors` = `[]` everywhere, because the sources conflict (§4).
   - `components`: see each model's notes. The labour shares are anchored to sources. Preparation, transport and waste are editorial assumptions, and are labelled as such.
6. **Unit.** `sqft` of built-up area summed across floors. Studio Matrx quotes "per sq ft built-up". Most other sources say only "per sq ft", so every model's notes tell the reader to check the area measure on a quote.

## 2. Queries run

All queries ran in standard mode. "Domains" is the `allowed_domains` filter.

| # | Domains | Query | Useful result |
|---|---|---|---|
| 1 | brickandbolt.com | house construction cost per sq ft Pune 2025 package basic standard premium | No links. The real domain is bricknbolt.com |
| 2 | — | house construction cost per sq ft in Pune 2025 | Pointers to Brick & Bolt, Construction Estimator India, Home Bazaar, Godrej Properties, Casagrand, InfraLens (text not attributable) |
| 3 | bricknbolt.com | construction cost in Pune per sq ft basic standard premium package | BB_BLOG tier ranges, ₹3,200 premium example, an older package price set |
| 4 | bricknbolt.com | Brick & Bolt Pune packages Basic ₹1,560 Classic ₹1,700 Premium ₹1,950 Royal per sq ft | BB_PKG current package prices (₹1,680 / ₹1,840 / ₹2,110 / ₹2,270) |
| — | WebFetch | www.bricknbolt.com/construction-company-pune | EGRESS_BLOCKED |
| 5 | constructionestimatorindia.com | Pune construction cost per sqft basic standard premium luxury 2026 | CEI_PUNE tiers, CEI city table |
| 6 | constructionestimatorindia.com | Construction Cost Estimator in Pune low-cost residential standard residential premium residential luxury villas per sq ft | CEI_PUNE pinned: tiers and civil/structural ₹800–₹1,500 |
| 7 | nobroker.in | house construction cost in Pune per sq ft 2025 labour charges material | NB_PUNE tiers, labour share, material breakup |
| 8 | nobroker.in | Construction Costs in Pune per Sq.Ft 2026 Update basic quality standard quality premium quality | NB_PUNE pinned: tiers and cost breakdown |
| 9 | housing.com, 99acres.com, makaan.com, squareyards.com | construction cost per sq ft Pune 2025 | Square Yards and 99acres pages. No housing.com or makaan.com results |
| 10 | squareyards.com | construction cost in Pune 2026 per sq ft rates basic mid-range luxury | SY pinned: tiers and the 1,200 sq ft example |
| 11 | 99acres.com | cost of constructing a house in Pune per sq ft | A99: ₹1,800–₹2,500, a dated (2022-era) article. Not used in models |
| 12 | — | grey structure construction cost per sq ft Pune 2025 | Godrej, Home Bazaar, Grihashakti and Studio Matrx pointers. Shell ₹1,500–₹2,000 (unattributable) |
| 13 | studiomatrx.org | cost and timeline to build a house India grey structure finishing per sq ft months | SM timeline (G+1 about 12 months), a Pune range of ₹1,850–₹2,450 (page not pinned) |
| 14 | studiomatrx.org | Pune ₹1,850 – 2,450 sq ft construction cost city tier grey structure shell ₹1,500–2,000 | Nothing usable |
| 15 | — | labour contract rate per sq ft house construction Pune 2025 RCC | InfraLens pointers, Pune daily wages (not attributable) |
| 16 | infralens.in | construction cost Pune 2026 per sq ft basic standard premium labour share grey structure | IL pinned: ₹2,007 / ₹2,573 / ₹3,474, zone table, labour 25–28% |
| 17 | nobroker.in, bricknbolt.com | grey structure construction cost per sq ft India 2026 what is included | Brick & Bolt grey structure definition. Ghaziabad rate (not used) |
| 18 | studiomatrx.org | grey structure the shell costs roughly per sq ft finishing build your own house India cost timeline | SM_TIMELINE pinned, a Tier-2 range (page not pinned) |
| 19 | nobroker.in | labour cost per sq ft for house construction 2026 labour contract only material by owner | NoBroker labour-only ₹350–₹550 (several pages) |
| 20 | bricknbolt.com, constructionestimatorindia.com, infralens.in | labour contract rate per sq ft house construction 2026 India labour only rate | Labour-only ₹300–₹500 (not attributable) |
| 21 | constructionestimatorindia.com | labour contract rates range ₹300 – ₹500 per sq ft labor-only package | CEI_3BHK pinned (medium) |
| 22 | homebazaar.com, grihashakti.com, godrejproperties.com, casagrand.co.in, bricknbolt.com, nobroker.in | grey structure cost Pune per sq ft civil work structure only | RCC ₹900–₹1,200, civil works ₹980–₹1,000, ₹800–₹1,000 (not attributable) |
| 23 | homebazaar.com, grihashakti.com, godrejproperties.com | Pune civil works charges per square feet RCC construction cost excavation footings blockwork plaster | Same figures, still not attributable |
| 24 | homebazaar.com | construction cost in Pune RCC construction cost per sqft civil works | HB pinned: RCC ₹900–₹1,200 |
| 25 | nobroker.in, bricknbolt.com, constructionestimatorindia.com, studiomatrx.org, infralens.in | AAC block vs red brick house construction cost per sq ft saving India 2026 | AAC and brick wall-work pages. Rates are per sq ft of wall (not used) |
| 26 | bricknbolt.com | fly ash bricks vs red bricks vs concrete blocks for house construction difference | Brick & Bolt material guides (material sources) |
| 27 | bricknbolt.com, nobroker.in | how long does it take to build a house in India months G+1 construction timeline | BB_TIMELINE pinned: 8 to 18 months |
| 28 | — | ready reckoner 2025-26 Maharashtra construction cost rate RCC per square metre Pune valuation | Only the ready reckoner hike percentages. No construction-cost rate (gap) |
| 29 | nobroker.in, infralens.in, bricknbolt.com, homebazaar.com, grihashakti.com | Pune house construction labour rate per sq ft only labour contractor 2025 | InfraLens labour share ₹550–₹755 (different basis, not used) |
| 30 | bricknbolt.com, studiomatrx.org, constructionestimatorindia.com | grey structure cost per sq ft Pune Maharashtra 2026 shell construction material and labour | CEI_HOUSE (medium) and the CEI RCC material/labour split |
| 31 | nobroker.in | 1000 sq ft house construction cost hiring labour directly costs per sq ft material procurement quality control | Labour 15–20% (national). Labour-only quote not pinned |
| 32 | nobroker.in | 1200 sq ft house construction cost labour only material by owner per sq ft | NB_1200 pinned: labour-only ₹350–₹550 |
| 33 | — | Pune bungalow construction labour contract rate per sq ft RCC slab brickwork plaster 2025 2026 | No labour-only Pune figure |
| 34 | godrejproperties.com | construction cost in Pune per square foot standard materials premium areas Aundh Koregaon Park Wagholi Katraj | GOD pinned |
| 35 | bricknbolt.com | Brick & Bolt package price per sq ft inclusive of GST what is included cement steel brand Pune | BB_PKG confirmed, with tile allowances and the GST label |
| 36 | nobroker.in, constructionestimatorindia.com, infralens.in, squareyards.com | grey structure construction cost per sq ft 2026 India basic standard premium | CEI national RCC ₹800–₹1,200. No new publisher |

## 3. Sources and the models they support

Confidence is about which page the figure comes from. The publisher is certain in every row.

| Key | Publisher | URL | Figures used | Used in | Confidence |
|---|---|---|---|---|---|
| NB_PUNE | NoBroker | https://www.nobroker.in/blog/construction-cost-in-pune/ | Basic ₹1,800–₹2,200; Standard ₹2,200–₹2,700; Premium ₹2,800–₹3,200+ | turnkey ×3 | high |
| NB_1200 | NoBroker | https://www.nobroker.in/blog/1200-sq-ft-house-construction-cost/ | Labour-only ₹350–₹550; the 1,200 sq ft example | labour-only; `independent_house` preset | high |
| CEI_PUNE | Construction Estimator India | https://constructionestimatorindia.com/construction-cost-estimator-in-pune/ | Low-cost ₹1,300–₹1,800; standard ₹1,800–₹2,500; premium ₹2,500–₹3,500+; civil & structural ₹800–₹1,500 | turnkey ×3; grey structure | high |
| CEI_HOUSE | Construction Estimator India | https://constructionestimatorindia.com/cost-of-building-a-house-in-india/ | Pune basic ₹1,700–₹2,500; premium ₹2,800–₹4,200 | turnkey budget, premium | medium |
| CEI_3BHK | Construction Estimator India | https://constructionestimatorindia.com/3bhk-house-construction-cost-in-india/ | Labour-only ₹300–₹500 (national) | labour-only | medium |
| SY | Square Yards | https://www.squareyards.com/blog/construction-cost-in-pune-smrthme | Basic ₹1,400–₹1,800; mid-range ₹1,800–₹2,200; luxury beyond ₹2,500; 30×40 ft (1,200 sq ft) example | turnkey ×3; preset | high |
| BB_BLOG | Brick & Bolt | https://www.bricknbolt.com/blogs-and-articles/construction-guide/construction-cost-in-pune | Basic ₹1,600–₹1,900; standard ₹1,900–₹2,500; premium example ₹3,200 | turnkey ×3 | high (ranges); medium (the ₹3,200 example) |
| BB_PKG | Brick & Bolt | https://www.bricknbolt.com/construction-company-pune | Packages: Basic ₹1,680, Classic ₹1,840, Premium ₹2,110, Royale ₹2,270 | turnkey ×3 | medium (several Brick & Bolt Pune pages list packages) |
| IL | InfraLens | https://infralens.in/prices/pune | Basic ~₹2,007; Standard ₹2,573; Premium ~₹3,474 | turnkey ×3 | high (the page title carries ₹2,573) |
| GOD | Godrej Properties | https://www.godrejproperties.com/blog/construction-cost-in-pune | Standard materials ₹1,500–₹2,000; premium ₹3,000 or more (blog dated 27 Dec 2024) | turnkey standard, premium | high |
| HB | Home Bazaar | https://www.homebazaar.com/knowledge/what-is-construction-cost-in-pune/ | RCC construction ₹900–₹1,200 | grey structure | high |
| BB_MAT | Brick & Bolt | fly-ash-bricks-vs-red-bricks, aac-blocks-vs-red-brick-which-is-better, bricks-vs-cement-blocks, cement-block-types-uses | Material descriptions only | `materials[].sources` | medium (the quoted lines); titles only for the rest |
| CEI_MAT | Construction Estimator India | aac-block-work-cost-per-sq-ft-in-india, brick-masonry-cost-per-square-foot-in-india | Titles only | `materials[].sources` | title only |
| BB_TIMELINE | Brick & Bolt | https://www.bricknbolt.com/blogs-and-articles/construction-guide/house-construction-timeline-stage-wise-duration-guide | 8 to 18 months for a standard residential house (national) | `duration_days.basis` | high |
| SM_TIMELINE | Studio Matrx | https://www.studiomatrx.org/utilities/construction-timeline | G+1 about 12 months from approved drawings to OC handover; monsoon adds 1–2 months | `duration_days.basis` | medium (the guide `guides/building-house-india` was also returned) |

### Models

| id | scope | tier | low / expected / high (₹ per sq ft) | Publishers |
|---|---|---|---|---|
| `house-construction-turnkey-budget` | turnkey | budget | 1,300 / 1,825 / 2,500 | NoBroker, Construction Estimator India, Square Yards, Brick & Bolt, InfraLens |
| `house-construction-turnkey-standard` | turnkey | standard | 1,500 / 2,125 / 2,700 | NoBroker, Construction Estimator India, Square Yards, Brick & Bolt, InfraLens, Godrej Properties |
| `house-construction-turnkey-premium` | turnkey | premium | 2,270 / 3,000 / 4,200 | NoBroker, Construction Estimator India, Square Yards, Brick & Bolt, InfraLens, Godrej Properties |
| `house-construction-grey-structure-standard` | grey-structure | standard | 800 / 1,100 / 1,500 | Construction Estimator India, Home Bazaar |
| `house-construction-labour-only-standard` | labour-only | standard | 300 / 425 / 550 | NoBroker, Construction Estimator India (both national) |

Each model's `notes` field shows the midpoint arithmetic.

## 4. Conflicts and judgement calls

1. **Brick & Bolt package names against the tiers.** Brick & Bolt sells five Pune packages: Basic, Classic, Premium, Royale and Luxury Homes. Its prices (₹1,680–₹2,270) are lower than most other publishers' standard and premium figures. Mapping by name would put "Premium" (₹2,110) under the premium tier, below every other publisher's premium low. The packages were therefore mapped **by price position**: Basic → budget, Classic and Premium → standard, Royale → premium. The Luxury Homes package had no price. An older Brick & Bolt price set (Basic ₹1,560, Classic ₹1,700, Premium ₹1,950, Royal ₹2,100) appeared on another page and was not used.
2. **Construction Estimator India's two Pune tables disagree.** The Pune estimator page gives low-cost ₹1,300–₹1,800. Its city table gives basic ₹1,700–₹2,500. Both are cited, and the publisher's own median was used.
3. **Godrej Properties is older and lower.** Its standard ₹1,500–₹2,000 comes from a December 2024 blog. It sets the standard tier's low but has little effect on the median.
4. **Locality differences conflict, so `locality_factors` = `[]`.** Square Yards says Baner, Kothrud and Viman Nagar cost more than Wagholi and Hinjewadi. InfraLens' zone table ranks Hinjewadi (basic ₹2,200, standard ₹2,700) above Kothrud (₹2,000 / ₹2,500) and Baner (₹2,100 / ₹2,600), with PCMC lowest (₹1,800 / ₹2,200). Godrej says Aundh and Koregaon Park cost more and Wagholi less. With the direction for Hinjewadi contradicted and only one numeric source, no factor was set.
5. **What "grey structure" covers.** The Pune sources price civil and structural works (CEI) and RCC construction (Home Bazaar), not a named shell package. Brick & Bolt's Ghaziabad guide defines grey structure as foundation, RCC columns, brick masonry walls, beams, roof slabs and waterproofing, at ₹1,100–₹1,400 and 55–60% of total cost (another city; not used). A Studio Matrx figure of ₹1,500–₹2,000 for the shell (national) could not be tied to one page and is higher than both Pune sources. The scope description therefore tells users to get the inclusions in writing.
6. **Labour share.** NoBroker's Pune guide puts labour at 20–25% of total cost. NoBroker's national 1,000 and 1,200 sq ft guides give 15–20%. InfraLens gives 25–28% for Pune, and Construction Estimator India gives 25–30% for RCC work. The turnkey components use 0.22, inside NoBroker's Pune range.
7. **Labour-only rates are national.** No Pune-specific labour-contract rate per sq ft was found. InfraLens' "₹550–₹755 per sq ft" is the labour share inside a turnkey rate. It is a different basis, so it was not mixed into the labour-only model.
8. **GST.** The search summary labelled Brick & Bolt's package prices as inclusive of GST. No other source states a GST basis. The notes flag this, and the quote checklist asks whether GST is included.
9. **Not used:** 99acres (₹1,800–₹2,500, an article referring to 2022 price trends, so stale); Home Bazaar's citywide average ₹1,500–₹2,500 (no tier); InfraLens' alternative figures (₹1,720 / ₹2,200 / ₹2,970) and the ₹1,995–₹2,415 / ₹2,415–₹2,940 / ₹3,045–₹4,410 table, because neither could be tied to one page; Studio Matrx's Pune range of ₹1,850–₹2,450 (page not pinned); and all wall-area rates for AAC blocks and bricks (per sq ft of wall, not of built-up area).

## 5. ServiceDef changes in this run

- **`area_presets`:** added `independent_house`, 1,200 sq ft. It is sourced to Square Yards (a 30×40 ft, 1,200 sq ft Pune example) and NoBroker (its 1,200 sq ft guide). The assumption text tells users to add up the built-up area of every floor.
- **`materials[].sources`:** all four walling materials now cite Brick & Bolt or Construction Estimator India material guides. Each description adds one sourced sentence and says that published wall rates are per sq ft of wall. The earlier unsourced definitions are kept.
- **`duration_days`:** the 0/0 placeholder is replaced by `{ min: 240, max: 540 }`. The basis is Brick & Bolt (8 to 18 months, national) and Studio Matrx (G+1 about 12 months from approved drawings to OC, national), at 30 days per month.
- **Prose:**
  - Removed a superlative ("is the easiest to compare" now reads "is easier to compare").
  - Added an FAQ on duration that names its sources (8 FAQs in total).
  - Added a question about package allowances, following the tile allowances in Brick & Bolt's package list.
  - Kept the rest of the earlier questions, mistakes and checklist. They are process guidance and contain no figures.

Counts: 12 questions, 9 mistakes, 14 checklist items and 8 FAQs.

## 6. Gaps (open)

- **Model count is 5, not 8 or more.** No source gives per-sq-ft built-up rates by walling material, so there are no AAC, fly ash or red brick models; wall-area rates cannot be converted without a wall-to-floor ratio. No source separates grey-structure or labour-only rates by specification tier, so each of those scopes has one standard-tier model.
- **Pune labour-only rate:** both sources are national.
- **Official benchmark:** no IGR Maharashtra ready reckoner construction-cost rate, and no PMC rate, was found in search text (query 28).
- **`min_job_inr`:** no source.
- **Locality factors:** the sources conflict (§4.4).
- **Gate path (c):** house-construction facts for priority localities belong to another task and are not in this pack.
- **Verification:** every quote comes from search-result text. A reviewer should open each URL, confirm the figure and wording, and confirm the medium-confidence page attributions in §3.

## 7. Verification

- `node scripts/data-coverage.mjs`: **0 ERROR lines for house-construction**, and no tier-gap warning for it, because all three tiers have a model. The remaining errors are files other tasks own: `data/localities.json`, `data/dishes.json`, the painting pack and the locality guides. The house-construction warnings are only the gate path (c) locality-fact counts.
- A Python shape check confirmed:
  - the exact key sets of ServiceDef, CostModel and SourceRef
  - that each `scope_id` exists in the ServiceDef
  - that the unit matches the ServiceDef unit
  - integer rates with low ≤ expected ≤ high
  - component sums of 1 ± 0.01
  - 2 or more publishers and 2 or more hosts per model
  - `retrieved_at`, `reviewed_at`, `valid_until` and `status` values
  - NFKC-normalised text
  - a regex scan of the prose for superlatives, which found none

  It passed.
