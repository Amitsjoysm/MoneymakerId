TASK-MARKER: retryA-bathroom-renovation

# Research log: bathroom-renovation service pack (D03, retry A)

- **Files:** `data/services/bathroom-renovation.json`, `data/cost-models/bathroom-renovation.json`, this log
- **Researched:** 2026-10-06. Every `retrieved_at` and `reviewed_at` is `2026-10-06`; every `valid_until` is `2027-04-04`.
- **Status:** everything is `draft`. The prose needs owner review before it can render on an indexable page.
- **Result:** 8 cost models, covering all 3 tiers. Each model has at least 2 publishers. The ServiceDef has 3 sourced presets, 5 sourced materials and a sourced duration.
- **Replaces** the blocked first run. That run's draft used `unit: "sqft"`, a 0/0 duration placeholder and no sources. This retry keeps its advice-only prose where it was still correct and rewrites the rest for the per-bathroom unit.

## 1. Method and constraints

1. **WebSearch only.** WebFetch to `www.nobroker.in` returned `EGRESS_BLOCKED`, so no page was opened directly. Every quote is copied from the text the WebSearch tool returned (result titles or the tool's snippet or summary text). Markdown bold markers were removed; nothing else was changed.
2. **Attribution.** Most queries used `allowed_domains` set to a single publisher, so the publisher of each figure is certain. The exact page is the result whose title matches the figure's topic. §3 gives a confidence for each page:
   - **high:** that domain returned only one matching page
   - **medium:** several pages from the same publisher were returned
3. **Search budget.** The cap was 35. 32 WebSearch calls were made, counting one call refused with HTTP 400. 3 were left unused.
4. **Rules applied to every model:**
   - **Unit:** `unit` means one bathroom, priced as a labour-included lump sum. Sources quoted per sq ft were not converted. Their area basis (floor area or tiled area) is never stated, and §5 shows they conflict with the per-bathroom figures.
   - **Range:** `low` is the lowest cited low and `high` is the highest cited high, so the range is widened whenever sources disagree.
   - **Expected:** the median of the cited publishers' midpoints, with one midpoint per publisher, rounded to the nearest ₹500 with ties rounded down. Where a source gives an open-ended figure ("₹3.4L+"), its stated lower figure is used as its point figure.
   - **Independence:** a publisher counts once per model, however many of its pages are cited.
   - **Components:** an editorial split anchored on two sources. RealCostIQ gives CP fittings, cubicle, geyser and exhaust at about 38–39%, sanitaryware at about 20% and labour at about 18%. 99acres gives labour at 20–25% of the total. Labour is therefore set to 0.16–0.22, and fittings, sanitaryware and tiles are folded into `materials`. Preparation, repair, transport and waste are labelled assumptions.
   - **Unset fields:** `min_job_inr` is `null`, because only NoBroker states a minimum (Rs 10,000) and that page is unpinned. `locality_factors` is `[]`, because no source gives a Pune locality difference.
   - **GST:** no source says whether its per-bathroom total includes GST. NoBroker and Livspace price some line items as "plus 18% GST". Every model says "GST basis not stated" and does not mix in GST-exclusive line items.

## 2. Queries run

All queries ran in standard mode except Q29, which ran in extended mode.

| # | Domains | Query | Outcome |
|---|---|---|---|
| 1 | nobroker.in | bathroom renovation cost in Pune per bathroom 2025 | NoBroker Pune tier table, Pune overall range, line items. Not pinned to one page |
| 2 | nobroker.in | NoBroker home renovation Pune bathroom renovation basic fittings tiles ₹40K mid-range premium per bathroom | Same figures. Page attribution: §3 |
| – | WebFetch | www.nobroker.in/renovation/home-renovation-in-pune | EGRESS_BLOCKED |
| 3 | housing.com | bathroom renovation cost India per bathroom basic mid-range luxury | "No links found", so the summary was unsupported and is **not used** |
| 4 | livspace.com | bathroom renovation cost India per bathroom | LS figures |
| 5 | urbancompany.com | bathroom renovation price per bathroom | Cleaning pages only, no renovation prices (gap) |
| 6 | homelane.com, designcafe.com | bathroom renovation cost India per bathroom 2025 | HL and DC pointers |
| 7 | homelane.com | HomeLane bathroom renovation cost in India 2026 basic makeover mid-range full remodel | HL tiers (pinned) |
| 8 | designcafe.com | bathroom renovation cost small bathroom India ₹ lakh tiles fittings plumbing | DC small-bathroom figures, anti-skid advice |
| 9 | asianpaints.com | bathroom renovation cost India per bathroom budget | AP pages and figures |
| 10 | beautifulhomes.asianpaints.com | Beautiful Homes estimate home interior cost room by room bathroom standard premium ₹ lakh | AP standard and premium bands |
| 11 | 99acres.com | bathroom renovation cost India per bathroom | 99A labour share, component list |
| 12 | indiamart.com | bathroom renovation service Pune price per bathroom | Pune sellers quote per sq ft only (not used, §5) |
| 13 | indiamart.com | bathroom renovation ₹ per unit Pune toilet renovation work price | Same; no per-bathroom Pune listing |
| 14 | blocked: the big publishers | bathroom renovation cost Pune 2026 per bathroom contractor price | Pointers to Aecord, Interior Decor Designs, Comaron, RealCostIQ, AMS Civil Work, HomeTriangle, ZeroFi |
| 15 | aecord.com | bathroom renovation cost Pune budget mid-range premium full renovation 5x7 bathroom | AE Pune tiers, scope text, labour |
| 16 | comaron.com | bathroom renovation cost Pune per sq ft budget mid-range premium 2026 | CM per-bathroom figures; per-sq-ft figures conflict (§5) |
| 17 | zerofi.ai | bathroom renovation cost India by scope cosmetic refresh partial full renovation layout change INR | **Excluded** (§5) |
| 18 | realcostiq.com, interiordecordesigns.in | bathroom renovation cost calculator India cosmetic refresh partial renovation full renovation Pune | Scope typology and bands; attribution split by Q19 and Q20 |
| 19 | interiordecordesigns.in | Pune bathroom renovation cost full renovation budget mid-range premium tier-2 | IDD Pune full-renovation tiers, timeline (pinned) |
| 20 | realcostiq.com | bathroom renovation cost calculator India budget mid-range luxury per bathroom Pune | RC bands, packages, component shares (pinned) |
| 21 | amscivilwork.in | bathroom renovation Pune cost per bathroom price days | Per-sq-ft only (not used) |
| 22 | — | how many bathrooms in a 2BHK 3BHK flat typically India 1BHK one bathroom | Unpinned BHK definitions (not used) |
| 23 | nobroker.in, magicbricks.com, squareyards.com, housing.com, 99acres.com | 2 BHK flat usually has two bathrooms 3 BHK three bathrooms attached | **HTTP 400**: magicbricks.com not accessible |
| 24 | nobroker.in, squareyards.com, 99acres.com | (same as 23) | Bathroom counts; Square Yards and NoBroker mixed |
| 25 | squareyards.com | what is 1 BHK 2 BHK 3 BHK number of bathrooms attached common bathroom standard premium | SQ preset sources |
| 26 | nobroker.in | how long does a bathroom renovation take India days weeks timeline | NB duration |
| 27 | nobroker.in | "Home Renovation in Pune" NoBroker bathroom renovation cost per bathroom | Pin attempt: Pune minimum, line items; still unpinned |
| 28 | nobroker.in | "Mid-range bathroom upgrade" "Premium bathroom renovation" Pune | Pin attempt: national NoBroker bands; tier table absent (supports §3 attribution) |
| 29 | blocked: all publishers above (extended) | bathroom renovation Pune cost lakh per bathroom Kothrud Baner Wakad contractor | CDS (pinned); ContractorBhai, HomeTriangle and Bajaj Finserv pointers |
| 30 | contractorbhai.com | bathroom renovation cost Pune moderate remodel major renovation lakh | CB Mumbai/Pune figure; reveals the NoBroker overlap (§5) |
| 31 | — | Maharashtra housing society member renovation flat bathroom repairs permission notice bye-laws leakage flat below responsibility | Society NOC and bye-law text, unpinned (not used) |
| 32 | indiancooperative.com | bye law 46 addition alteration flat approval managing committee member repairs bathroom | Not found (not used) |

## 3. Sources cited (publisher, page, confidence)

| Key | Publisher | URL | Confidence | Used for |
|---|---|---|---|---|
| NB_PUNE | NoBroker | https://www.nobroker.in/interiors/design-guides/3-bhk-interior-design-cost-in-pune/ (re-pointed in Verification; was `/renovation/home-renovation-in-pune`) | medium-high (1) | Tier table: basic ₹40K–₹70K, mid ₹70K–₹1.1L, premium ₹1.1–₹1.5L |
| RC | RealCostIQ | https://realcostiq.com/in/bathroom-renovation-cost-calculator/ | high | Bands, packages, component shares, material pairings |
| CM | Comaron | https://www.comaron.com/blog/bathroom-renovation-cost-india-2026-complete-breakdown | high | Basic and mid-range per-bathroom figures |
| DC | Design Cafe | https://www.designcafe.com/blog/bathroom-interiors/budget-friendly-bathroom-renovation-tips/ | medium (2) | Small-bathroom figure, anti-skid advice |
| HL | HomeLane | https://www.homelane.com/design-ideas/bathroom-design/bathroom-renovation-cost/ | high | Basic makeover, mid-range, full remodel |
| AP_EST | Asian Paints (Beautiful Homes) | https://www.beautifulhomes.asianpaints.com/blogs/estimate-home-interior-cost.html | medium (3) | Standard ₹80,000–₹2 lakh; premium large-format text |
| AP_CALC | Asian Paints (Beautiful Homes) | https://www.beautifulhomes.asianpaints.com/home-decor-price-calculator.html | medium (3) | Premium Rs. 2 lakh – Rs. 5 lakh+ |
| AP_REN | Asian Paints (Beautiful Homes) | https://www.beautifulhomes.asianpaints.com/blogs/bathroom-renovation-cost.html | medium (3) | Ceramic tile price (material description only) |
| LS | Livspace | https://www.livspace.com/in/magazine/bathroom-renovation-cost | high | Compact bathroom "starts from ₹60,000"; waterproofing line item (FAQ) |
| CB | ContractorBhai | https://www.contractorbhai.com/what-decides-cost-of-bathroom-renovation-in-mumbai-or-pune-or-bangalore-etc/ | medium-high (title match) | Mumbai and Pune spend of 1.5 to 2 lakhs |
| CDS | Citi Design Studio | https://citidesignstudio.com/services/home-renovation-services-pune | high | Pune upgrades ₹1–2.5 lakhs, 15–20 days |
| IDD | Interior Decor Designs | https://www.interiordecordesigns.in/articles/bathroom-renovation-cost-india-2026 | high (Q19); typology medium-high (4) | Pune full-renovation tiers, cosmetic and partial bands, layout change, 10–15 days |
| AE | Aecord | https://aecord.com/blog/bathroom-renovation-cost-india-2026 | medium (5) | Pune tiers, scope text, labour figure |
| SQ2 | Square Yards | https://www.squareyards.com/blog/what-is-2-bhk | high for 2 BHK; medium for 1 BHK (6) | 1bhk and 2bhk presets |
| SQ3 | Square Yards | https://www.squareyards.com/blog/3-bhk-house-plan-dseart | medium-high | 3bhk preset |
| 99A | 99acres | https://www.99acres.com/articles/bathroom-remodel.html | medium-high | Labour share 20–25% (component basis, cited in notes only) |
| NB_DUR | NoBroker | https://www.nobroker.in/interiors/design-guides/full-bathroom-renovation/ | medium-high | 3–5 weeks for a full renovation; rush 10–14 days (duration basis only) |

Notes on confidence:
1. NB_PUNE. *Superseded by the Verification section below, which re-points this key to NoBroker's Pune 3 BHK interior design cost guide.* The original builder note follows. The tier table appeared in Q1 and Q2. Both returned this Pune renovation page together with several forum and guide pages. Q28 searched for the table's exact phrases and did not return this page, and the table did not appear in its results either. That fits the table being on this page, but the attribution is still medium. **Re-check before review.**
2. DC. Three Design Cafe pages were returned (this one, `low-cost-indian-bathroom-designs`, `bathroom-renovation-ideas`). This page was the first result both times.
3. AP pages were assigned by wording style. The "₹80,000–₹2 lakh" wording matches the room-by-room guide, the "Rs." bands match the calculator page, and the "INR" basic range matches the renovation blog. Re-check.
4. IDD typology. The cosmetic, partial, full and layout-change lines came from Q18, which searched two domains. They are attributed to IDD because Q19 (IDD only) returned the same full-renovation line.
5. AE. Two Aecord bathroom pages were returned. The other is https://aecord.com/blog/bathroom-renovation-cost-guide-2026-what-every-upgrade-actually-costs-in-india.
6. SQ2, 1 BHK. The 1 BHK sentence came from Q25, in which this 2 BHK "Comparison Guide" was the only BHK-definition page returned.

## 4. Models: sources and arithmetic

All figures are INR per bathroom. "Pune" marks a Pune-specific figure; every other figure is national.

| Model | Scope / tier | Publisher midpoints | low – expected – high |
|---|---|---|---|
| `bathroom-renovation-budget` | — / budget | DC 42,500 · CM 45,000 · NB_PUNE 55,000 (Pune) · RC 75,000 | 25,000 – **50,000** – 1,00,000 |
| `bathroom-renovation-standard` | — / standard | CM 60,000 · NB_PUNE 90,000 (Pune) · AP 1,40,000 · HL 1,65,000 · RC 1,75,000 · CB 1,75,000 (Mumbai/Pune) · CDS 1,75,000 (Pune). LS is a floor of ₹60,000 only, so it is not in the median | 40,000 – **1,65,000** – 2,50,000 |
| `bathroom-renovation-premium` | — / premium | NB_PUNE 1,30,000 (Pune) · AP 3,50,000 · RC 3,75,000 | 1,10,000 – **3,50,000** – 5,00,000 |
| `bathroom-renovation-cosmetic-refresh-budget` | cosmetic-refresh / budget | HL 55,000 · IDD 57,500 | 30,000 – **56,000** – 80,000 |
| `bathroom-renovation-retile-refit-budget` | retile-and-refit / budget | DC 42,500 · NB_PUNE 55,000 (Pune) · RC 65,000 (budget refresh) · IDD 1,05,000 (partial, ungraded) | 25,000 – **60,000** – 1,40,000 |
| `bathroom-renovation-full-budget` | full-renovation / budget | CM 45,000 · AE 74,000 (Pune) · IDD 1,35,000 (Pune) | 30,000 – **74,000** – 1,60,000 |
| `bathroom-renovation-full-standard` | full-renovation / standard | AE 1,67,500 (Pune) · IDD 2,05,000 (Pune) | 1,05,000 – **1,86,000** – 2,50,000 |
| `bathroom-renovation-full-premium` | full-renovation / premium | IDD 3,40,000 (Pune, open-ended) · HL 4,25,000 · AE 8,25,000 (Pune, luxury upper end) | 2,50,000 – **4,25,000** – 14,00,000 |

Some publishers appear in both a scope-null tier model and a scope model, for example NB_PUNE "Basic fittings & tiles" in the budget and retile-and-refit models. Within any single model, each publisher counts once.

## 5. Conflicts and exclusions

- **Disagreement across tiers.** NoBroker's Pune tier table is low: its premium band of ₹1.1–₹1.5L sits below the standard bands of every other publisher. Comaron's "mid-range" band of ₹40,000–₹80,000 is also low. Aecord's Pune premium band runs to ₹14,00,000+ because it includes smart toilets and automation. All of these are kept and the ranges widened, following the waterproofing method; each model's notes explain the spread.
- **NoBroker's untiered Pune figures** are not used in the median, because each covers all tiers. They are:
  - ₹60,000–₹2,50,000 (Pune forum)
  - ₹90,000–₹2,80,000 (small bathrooms, Tier-2 cities like Pune)
  - ₹1,80,000–₹4,80,000 (full renovation, Tier-2 cities like Pune)
- **Not independent: NoBroker and ContractorBhai.** NoBroker's forum text repeats ContractorBhai's wording: a 7'×4' bathroom at Rs 40,000–50,000, and tiles at Rs 25–40 (non-branded) and Rs 1,000–2,000 (branded) per sq ft. Neither figure is used in any model.
- **Per-sq-ft sources** are not used in any model, because their area basis is unknown and they conflict with the per-bathroom figures:
  - IndiaMART Pune sellers: ₹150–₹1,456 per sq ft
  - AMS Civil Work Pune: ₹150–₹450+
  - Comaron Pune: ₹320–₹1,900
  - HomeTriangle: ₹750–₹1,200
  - IDD national: ₹1,800–₹3,200

  For example, Comaron's own 6×8 ft example works out at about ₹300–₹500 per sq ft, which disagrees with its Pune per-sq-ft table and is far below its own per-bathroom figure.
- **Labour share conflict.** Aecord gives labour alone for a complete 40 sq ft renovation in Pune or Mumbai as ₹60,000–₹1,20,000, which would be about half of its mid-range total. RealCostIQ (about 18%) and 99acres (20–25%) give a much smaller share. Components follow RealCostIQ and 99acres; the conflict is noted in `bathroom-renovation-full-standard`.
- **ZeroFi excluded.** Its "India (INR)" page (https://www.zerofi.ai/in/blog/bathroom-remodel-cost) prices a cosmetic refresh at ₹2,00,000–₹3,00,000, with tubs, walk-in showers and double vanities. That reads as a currency-converted foreign template.
- **Housing.com (Q3)** returned no links, so its summary figures are unsupported and not used.
- **Livspace's ₹1.25–₹2 lakh band** excludes tiles and fixtures, so it is on a different basis and not used.

## 6. ServiceDef sourcing

- **Unit:** `unit` (per bathroom). This replaces the earlier `sqft`, as the task instructed.
- **Area presets:**

  | Preset | Bathrooms | Source |
  |---|---|---|
  | 1bhk | 1 | SQ2 |
  | 2bhk | 2 | SQ2 |
  | 3bhk | 3 | SQ3 |

  The 3bhk assumption text repeats Square Yards' note that 3 BHK bathroom counts vary. Unpinned Q24 text also said "A standard 3 BHK has two bathrooms". **4bhk has no preset**, because no source gave a bathroom count.
- **Materials:**
  - ceramic tiles: RC, AP_REN, DC
  - vitrified tiles: RC, AE, DC
  - large-format, imported or designer tiles: AP_EST, AE, RC
  - natural stone: AE only
  - sanitaryware and CP fittings: RC, AE

  The old `retiling-only` scope was dropped because it had no price. A layout change is covered in the FAQ and in the `full-premium` notes instead of as a scope.
- **Duration:** min 10, max 35 days.
  - IDD: 10–15 days
  - CDS: 15–20 days
  - NoBroker: 2–4 weeks for a small bathroom, 3–5 weeks for a full renovation, 10–14 days for a rush job
- **FAQ:** every number cites its publisher in the text.
  - NoBroker waterproofing line item: "Waterproofing is approximately Rs. 8,000 to Rs. 10,000 per bathroom, plus 18% GST." (Q1, NoBroker page unpinned)
  - Livspace: "Waterproofing starts from ₹12,000 per bathroom plus 18% GST."
  - HomeLane: "Going with the existing layout can save INR 20,000 to INR 80,000 by avoiding plumbing changes." (Q6; the "INR" style matches HomeLane)
  - The society FAQ is advisory only. The Maharashtra bye-law text from Q31 could not be pinned to a page.

## 7. Gaps

- **No sourced 4 BHK preset**, and no independent-house preset.
- **`min_job_inr`:** NoBroker's "minimum bathroom renovation cost Pune is Rs 10,000" comes from an unpinned page and has no second source.
- **No Pune locality factors.**
- **No material-specific models.** Sources tie tile grade to tier but never price a tile type per bathroom on its own.
- **No layout-change model.** Only IDD gives a separate band (₹2.5–4.5L). HomeLane's full remodel is already used in `full-premium`.
- **GST basis** of every per-bathroom total is unstated by the sources.
- **Not reached:** UrbanCompany has no renovation prices. Housing.com returned nothing. MagicBricks was refused (HTTP 400).
- **No quote was checked against a live page**, because fetching was blocked. Every page should be opened and checked before `prose_status` or `status` is set to `reviewed`, and the medium-confidence attributions in §3 first.

## 8. Verification

`node scripts/data-coverage.mjs` (2026-10-06) reported **0 ERROR lines for this pack**. All of its errors concern other packs: `data/localities.json`, `data/dishes.json` and the locality guides are missing. Its only bathroom-renovation warnings are the locality-fact coverage rows (0 facts per priority locality), which a different task owns.

A separate Python check confirmed:
- 8 models, all at `unit` with `material_id: null`
- `low ≤ expected ≤ high`, all integers
- components summing to 1.00
- at least 2 distinct publishers per model
- every `scope_id` resolves to a scope option

The ServiceDef has 10 questions, 9 common mistakes, 11 checklist items, 8 FAQs, 3 presets and 5 materials.

## Verification (transcript-based, 2026-10-06)

A separate verifier session checked this pack. Its own spot-check searches are marked V1–V5 below.

### Method

1. **Builder transcript.** The newest file matching `TASK-MARKER: retryA-bathroom-renovation` was the verifier's own transcript. The builder transcript is the other match, `subagents/workflows/wf_648354b3-820/agent-a4d0aceb97962300e.jsonl`. From it the verifier extracted every tool result: 32 WebSearch results and 1 WebFetch. The WebFetch was `EGRESS_BLOCKED`, and Q23 was refused with HTTP 400.
2. **Ref check.** Every SourceRef in both JSON files (presets, materials and models) was checked in two ways:
   - its `url` appears in a result's link list
   - its `quote` appears verbatim in result text, after removing markdown bold and collapsing whitespace

   Titles were also compared with the link-list titles.
   - **Before fixes:** 47 refs, 47 matched. For every ref, the URL and the quote were in the same result. Every title matched.
   - **After fixes:** 48 refs, 48 matched (one verified ref was added; see below).
3. **Arithmetic.** For each model, `expected` was recomputed as the median of one midpoint per publisher, rounded to the nearest ₹500 with ties rounded down. All 8 models match the file:
   - budget 50,000
   - standard 1,65,000
   - premium 3,50,000
   - cosmetic 56,000 (from 56,250)
   - retile 60,000
   - full-budget 74,000
   - full-standard 1,86,000 (from 1,86,250)
   - full-premium 4,25,000

   In every model, `low` and `high` cover every cited figure. Other checks:
   - Every model uses `unit`, matching the ServiceDef `unit`.
   - Every components set sums to 1.00.
   - Every model has at least 2 distinct publishers.
   - No model mixes a GST-exclusive or material-only figure into a labour-included per-bathroom total; Livspace's band that excludes tiles and fixtures stays out.
4. **Spot checks.** The verifier ran 5 WebSearch calls (its full budget), aimed at the medium-confidence page attributions:

| # | Domain | Target | Finding | Action |
|---|---|---|---|---|
| V1 | nobroker.in | NoBroker tier table ("Basic fittings & tiles", "Mid-range bathroom upgrade") | The summary says the bands "are specifically listed for 3 BHK interior design projects in Pune". The links list `3-bhk-interior-design-cost-in-pune/` second and do **not** list `/renovation/home-renovation-in-pune`. | NB_PUNE re-pointed. The page was misattributed; the publisher and quotes are correct. |
| V2 | squareyards.com | Q24's unpinned line "A standard 3 BHK has two bathrooms" | Only project listings came back, several with 3 attached bathrooms plus a powder room. The line was not pinned to a page. | None. The 3bhk preset stays at 3, with its "counts vary" caveat. |
| V3 | homelane.com | FAQ claim "existing layout can save INR 20,000 to INR 80,000" | Returned verbatim, with HomeLane's renovation-cost page as the first link. | None. The FAQ attribution is confirmed. |
| V4 | aecord.com | Which Aecord page holds the Pune tiers | Both Aecord bathroom pages were returned again, `bathroom-renovation-cost-india-2026` first. The tiers and the labour figure were repeated. | None. The attribution stays medium; re-check against the live page. |
| V5 | beautifulhomes.asianpaints.com | Page for the "Rs." standard and premium bands | `home-decor-price-calculator.html` was first, and the bands were repeated. | None. This agrees with the builder's AP_CALC attribution. |

### Changes made

**`data/cost-models/bathroom-renovation.json`**

1. **NoBroker ref re-pointed** (V1) in 4 models: `bathroom-renovation-budget`, `-standard`, `-premium` and `-retile-refit-budget`.
   - `url` was `https://www.nobroker.in/renovation/home-renovation-in-pune` and is now `https://www.nobroker.in/interiors/design-guides/3-bhk-interior-design-cost-in-pune/`.
   - `title` is now "3 BHK Interior Design Cost in Pune 2026".
   - The quotes are unchanged. Each new URL and title appears in builder results Q1, Q2 and Q27 and in V1.
   - In each model's notes, "(Pune page)" now reads "(NoBroker's 3 BHK interior design cost guide for Pune, per bathroom)".
   - No figures changed.
2. **`bathroom-renovation-standard` notes.** These now say that ContractorBhai (a typical spend) and Citi Design Studio (one firm's upgrade price) name no tier and are placed in standard as an editorial mapping. Without them the median would be ₹1,40,000. The model value stays ₹1,65,000. The builder excluded NoBroker's untiered Pune ranges but kept these two, so the difference is now disclosed.
3. **`bathroom-renovation-full-standard` notes.** These no longer call NoBroker's ₹1,80,000–₹4,80,000 "Tier-2 Cities like Pune" range a full-renovation range, because the Q28 search text does not state its scope.
4. **`bathroom-renovation-full-premium` notes.** "Moving the WC or shower point is part of HomeLane's scope" now reads "HomeLane's full remodel includes plumbing changes", which is what HomeLane's text says.

**`data/services/bathroom-renovation.json`**

5. **Unsourced descriptive claims removed from materials:**
   - ceramic: "Glazed tiles with a clay body"
   - vitrified: "Tiles fired to a dense body, used on bathroom floors and walls"
   - large-format: "patterned feature tiles"
   - natural stone: "granite", "vanity counters", "door thresholds"
   - sanitaryware: "diverter"

   Each description now states only what its cited quotes support. The natural-stone description says no source in this pack prices stone separately.
6. **`sanitaryware-and-cp-fittings`.** Added the verified RealCostIQ ref "Standard renovation (5×7 ft, 35 sqft): ₹1L–₹1.5L – includes vitrified tiles, branded CP (Jaquar/Cera), shower, vanity" (builder result Q20). Before this, the description's claim that RealCostIQ names Jaquar and Cera had no ref in this material. The wording also changed: RealCostIQ names them for its standard package, not for "mid-range work".

**No other changes.** No model was removed and no figure changed. Presets, scopes, duration, questions, mistakes, checklist and FAQ were left alone; their numbers match builder results Q1, Q4, Q6, Q14, Q18, Q19, Q20, Q26 and Q29.

### Still open

- Several page attributions remain medium, because no page could be fetched:
  - Aecord: which of its two bathroom pages
  - Asian Paints: the three Beautiful Homes pages
  - Design Cafe: the first of three pages
  - Square Yards: the 1 BHK sentence

  The publisher is certain in every case; open the pages before review.
- The NoBroker tier table is now attributed to the Pune 3 BHK interior design guide. That supports its use as per-bathroom Pune bands within a 3 BHK interiors project. The table does not say whether its bands include demolition or new waterproofing.
- 3bhk preset. Square Yards' "Some 3 BHK units have … 2 attached bathrooms and 1 common bathroom" supports 3. An unpinned Q24 line says a standard 3 BHK has two. The preset keeps 3 and warns that counts vary.
- The FAQ's NoBroker waterproofing line item (₹8,000–₹10,000 plus 18% GST) cites the publisher only; its page is unpinned.
- `node scripts/data-coverage.mjs` (rerun by the verifier after its changes) shows 0 ERROR lines for this pack. Its 10 errors concern `data/localities.json`, `data/dishes.json` and the locality guides. The bathroom-renovation warnings are the locality-fact rows only.
