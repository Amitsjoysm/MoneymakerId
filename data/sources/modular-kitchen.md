# Research log: modular-kitchen (D03, Wave 1)

- **Date:** 2026-10-06
- **Owner files:** `data/services/modular-kitchen.json`, `data/cost-models/modular-kitchen.json`, this log
- **Status:** **BLOCKED. No sources were gathered, so no cost model is included.** This pack needs a re-run when web research is available.

## Why it is blocked

1. **WebSearch:** both queries returned *"Web search was not performed: this turn's web search budget is used up (limit: 200 WebSearch calls per turn, shared by every agent in it)"*. The parallel Wave 1 agents had already used the shared budget before this task's first query.
2. **WebFetch:** every publisher domain tried was blocked by the egress proxy (`EGRESS_BLOCKED`) or returned "unable to fetch". The URLs below were only reachability tests. **No content was retrieved from any of them, and none is cited anywhere.**

Under the source-integrity rules (only pages actually seen; ≥ 2 independent publishers per model), nothing could be cited. So:
- `data/cost-models/modular-kitchen.json` is `[]`. No model met the ≥ 2 independent sources rule, because none had any source.
- `data/services/modular-kitchen.json` is a skeleton. It holds only taxonomy and editorial guidance that makes no numeric claims: scope options, material definitions, questions, mistakes, the quote checklist and an FAQ. It has `area_presets: []`, every `materials[].sources: []`, and a **placeholder `duration_days` of `{min: 0, max: 0}`** whose `basis` says NOT SOURCED. The contract does not make `duration_days` nullable, so a sentinel was the only shape-valid option. It must be replaced before review.
- **The material descriptions are unsourced definitions** (BWP / BWR / MR plywood grades, HDHMR, particle board / MDF, laminate, acrylic, membrane, PU, veneer, granite, quartz). They avoid price and durability comparisons, but a reviewer should check them against manufacturer pages (for example Greenply, CenturyPly, Action Tesa, Merino, Hettich, Hafele, Ebco) and add `sources` during the re-run.
- `sub_services` is `[]`. §4a defines no sub-services for `modular-kitchen`.

## Queries run

| # | Tool | Query / URL | Result |
|---|---|---|---|
| 1 | WebSearch (standard) | `modular kitchen cost per sq ft Pune 2025` | not performed: search budget used up |
| 2 | WebSearch (standard) | `modular kitchen price per square feet India 2026 laminate acrylic PU` | not performed: search budget used up |
| 3 | WebFetch | `www.nobroker.in` (article path test) | EGRESS_BLOCKED |
| 4 | WebFetch | `www.livspace.com` (article path test) | EGRESS_BLOCKED |
| 5 | WebFetch | `housing.com` (article path test) | EGRESS_BLOCKED |
| 6 | WebFetch | `www.homelane.com` (article path test) | EGRESS_BLOCKED |
| 7 | WebFetch | `www.asianpaints.com` (article path test) | EGRESS_BLOCKED |
| 8 | WebFetch | `www.magicbricks.com` (article path test) | unable to fetch |
| 9 | WebFetch | `www.magicbricks.com/blog/` | unable to fetch |
| 10 | WebFetch | `en.wikipedia.org` (reachability test) | EGRESS_BLOCKED |
| 11 | WebFetch | `www.99acres.com` (article path test) | EGRESS_BLOCKED |
| 12 | WebFetch | `www.urbancompany.com` (article path test) | EGRESS_BLOCKED |
| 13 | WebFetch | `aapkapainter.com` | EGRESS_BLOCKED |
| 14 | WebFetch | `www.designcafe.com` (article path test) | EGRESS_BLOCKED |
| 15 | WebFetch | `timesofindia.indiatimes.com` | unable to fetch |
| 16 | WebFetch | `www.indiamart.com` | EGRESS_BLOCKED |
| 17 | WebFetch | `www.squareyards.com` (article path test) | EGRESS_BLOCKED |
| 18 | WebFetch | `economictimes.indiatimes.com` | unable to fetch |
| 19 | WebFetch | `www.hindustantimes.com` | unable to fetch |
| 20 | WebFetch | `www.hettich.com/en-in` | EGRESS_BLOCKED |
| 21 | WebFetch | `www.greenply.com` | EGRESS_BLOCKED |
| 22 | WebFetch | `www.centuryply.com` | EGRESS_BLOCKED |
| 23 | WebFetch | `www.ebco.in` | EGRESS_BLOCKED |
| 24 | WebFetch | `www.hafeleindia.com` | EGRESS_BLOCKED |
| 25 | WebFetch | `www.sleekworld.com` | EGRESS_BLOCKED |

I stopped after these tests. Per the tool's instructions, I did not route around the limit through search engines via curl, third-party readers, proxies or archives.

## Sources

None. No `SourceRef` appears in any of this pack's files.

## Conflicts

None to resolve, because no data was gathered.

## Gaps (all open)

- **Every cost model** (target ≥ 10 across scope × material × tier, each with ≥ 2 independent publishers).
- **`area_presets`:** typical cabinet front area (or running feet of counter) for a 1/2/3/4 BHK flat's kitchen and for an independent house, with sources. Layout matters too (straight, L-shaped, U-shaped, parallel, island). `terrace` is not relevant to this service.
- **`materials[].sources`:** board grades for carcasses (BWP / BWR / MR plywood, HDHMR, particle board / MDF), shutter finishes, countertop stones.
- **`duration_days`:** a sourced min/max from design sign-off to installation, by scope.
- **`min_job_inr`:** whether Pune firms state a minimum order value.
- **Locality factors:** none expected unless a source shows a Pune locality difference.

## Plan for the re-run

**Unit (decision to confirm).** `sqft` of cabinet front area: the width × height of every base, wall and tall unit, including lofts if quoted. This matches the contract's "per sq ft" title for `{service}-cost` pages. The re-run must check which basis Pune and Indian sources actually use:
- If most sources quote **per sq ft**, keep `sqft`. Sources that give a **lump sum per kitchen** or **per layout** (for example "L-shaped kitchen for a 2BHK") must be converted using a sourced cabinet area, with the conversion stated in `notes`.
- If most sources quote **per running foot**, the orchestrator should decide whether to switch `unit` to `rft`. That change touches `data/services/modular-kitchen.json`, which D03f does not own.

**Planned models (ids are proposals; `material_id` is the shutter finish unless noted):**

| id | scope_id | material_id | tier |
|---|---|---|---|
| `modular-kitchen-cabinets-laminate-budget` | cabinets-only | laminate-finish | budget |
| `modular-kitchen-cabinets-laminate-standard` | cabinets-only | laminate-finish | standard |
| `modular-kitchen-cabinets-membrane-standard` | cabinets-only | membrane-finish | standard |
| `modular-kitchen-cabinets-acrylic-standard` | cabinets-only | acrylic-finish | standard |
| `modular-kitchen-cabinets-acrylic-premium` | cabinets-only | acrylic-finish | premium |
| `modular-kitchen-cabinets-pu-premium` | cabinets-only | pu-lacquer-finish | premium |
| `modular-kitchen-cabinets-veneer-premium` | cabinets-only | veneer-finish | premium |
| `modular-kitchen-countertop-granite-budget` | cabinets-and-countertop | granite-countertop | budget |
| `modular-kitchen-countertop-granite-standard` | cabinets-and-countertop | granite-countertop | standard |
| `modular-kitchen-countertop-quartz-premium` | cabinets-and-countertop | quartz-countertop | premium |
| `modular-kitchen-remodel-budget` | full-kitchen-remodel | null | budget |
| `modular-kitchen-remodel-standard` | full-kitchen-remodel | null | standard |
| `modular-kitchen-remodel-premium` | full-kitchen-remodel | null | premium |
| `modular-kitchen-shutters-laminate-budget` | shutter-replacement | laminate-finish | budget |
| `modular-kitchen-shutters-acrylic-standard` | shutter-replacement | acrylic-finish | standard |
| `modular-kitchen-shutters-pu-premium` | shutter-replacement | pu-lacquer-finish | premium |

**Queries to run (standard mode first, extended mode when results are thin):**
- `modular kitchen cost per sq ft Pune 2025` / `2026`, and `modular kitchen price Pune 2BHK L-shaped`
- `modular kitchen cost per sq ft India laminate acrylic PU membrane` (NoBroker, Housing.com, MagicBricks, 99acres, UrbanCompany, Livspace, HomeLane, Design Cafe)
- `modular kitchen cost per running foot India` (to settle the unit question)
- `BWP plywood vs HDHMR kitchen cabinet price per sq ft` and plywood or board manufacturer price lists (Greenply, CenturyPly, Action Tesa, Merino)
- `granite vs quartz kitchen countertop price per sq ft Pune`
- `kitchen shutter replacement cost per sq ft India`
- `old kitchen platform removal cost Pune` and `kitchen renovation cost Pune` (full remodel)
- `modular kitchen installation time days India` (duration)
- Hardware price pages: Hettich, Hafele, Ebco (hinges, channels, baskets)
- News: Times of India Pune or Hindustan Times on home interiors or kitchen price trends in 2025–26

## Verification (adversarial check, 2026-10-06)

**Outcome: the pack is still BLOCKED.** The cost-model file stays `[]`, and no sources were added. Eight unsourced wording problems in the ServiceDef were fixed (listed below). Nothing in the pack cites a source, so there was nothing to fabricate and nothing fabricated was found.

### Research access during verification

| # | Tool | Query / URL | Result |
|---|---|---|---|
| V1 | WebSearch (standard) | `modular kitchen cost per sq ft Pune 2025` | not performed: the turn's search budget (200 calls, shared by all agents) is used up |
| V2 | WebFetch | `https://www.nobroker.in/blog/modular-kitchen-cost/` | EGRESS_BLOCKED |
| V3 | WebFetch | `https://www.godrejinterio.com/` | EGRESS_BLOCKED |
| V4 | WebFetch | `https://www.decorpot.com/` | EGRESS_BLOCKED |
| V5 | WebFetch | `https://www.bonito.in/` | EGRESS_BLOCKED |

The permission classifier refused a check of the egress proxy status, and I did not pursue it. I did not route around either limit. The domains above were reachability tests only, and none of them is cited.

### 1. Shape check

`validate_pack.py` (Python standard library only, kept in the verifier's scratchpad) checks the following against CONTRACTS §4/§4a:
- exact key sets for `ServiceDef`, area presets, scopes, materials, `duration_days`, FAQ, `CostModel`, components, `locality_factors` and `SourceRef`
- enums (`CostUnit`, `AreaPreset`, `Tier`, `ProseStatus`) and slug and reserved-slug rules
- that each model's `scope_id` and `material_id` exist in the ServiceDef, and that its `unit` matches the ServiceDef unit
- integer `rate_inr` with low ≤ expected ≤ high
- components summing to 1 ± 0.01
- ≥ 2 sources from different publishers, with no duplicate URLs
- `retrieved_at` and `reviewed_at` = 2026-10-06, `valid_until` = 2027-04-04 (+180 days), and `status` / `prose_status` = `draft`
- money, %, superlative and digit claims in unsourced prose

Tests of the checker itself:
- **Mutation test:** a scratch copy of the pack with one valid model and 9 deliberately broken models (bad rate order, components sum of 1.2, same publisher twice, wrong `valid_until`, `reviewed` status, unknown `material_id`, `rft` unit mismatch, bad tier, non-integer rate). All 9 were caught, and the valid model passed.
- **Control run:** on the waterproofing pack (read only), its 16 models passed every model check.

**Result for this pack:** 0 errors and 17 warnings, before and after the fixes:
- `area_presets` is empty
- all 11 `materials[].sources` are empty
- `duration_days` is a 0..0 placeholder
- no model in any of the 3 tiers
- 0 models against the D03 target of 10

`node scripts/data-coverage.mjs` reports no error for modular-kitchen, only the three "no model for modular-kitchen/{tier}" warnings. Its exit code 1 comes from files owned by other tasks.

### 2. Sources

The pack has **0 cited claims**, so there was nothing to re-check against the web. A grep found 0 occurrences of `http` in the service and cost-model files. The builder's 23 WebFetch reachability tests (22 domains) appear only in this log's query table. I confirmed these builder statements:
- the cost-model file is `[]`
- the counts are 4 scopes, 11 materials, 10 questions, 8 mistakes, 13 checklist items, 8 FAQs, 0 area presets and 0 sub-services
- `data-coverage.mjs` reports no errors for the pack
- the search budget is used up and the publisher domains are blocked

### 3. Content review and sanity check (by reading only, no web confirmation available)

I reviewed all 4 scope descriptions, 11 material descriptions, 8 FAQ answers, 10 questions, 8 mistakes and 13 checklist items. The default was to remove or neutralise any claim that could not be confirmed:

| # | Where | Problem | Change |
|---|---|---|---|
| 1 | scope `cabinets-and-countertop` | It included "the backsplash between the countertop and the wall units". The quote checklist and FAQ treat dado tiling as a separate, possibly extra item, so the scope was ambiguous for pricing. | Wall (dado) tiling is now stated as excluded or priced separately. |
| 2 | material `particle-board-mdf` | "used in lower-cost and ready-made modular units" is an unsourced price comparison. | Sentence removed. |
| 3 | material `acrylic-finish` | "high-gloss" was stated as the only acrylic finish, which is unsourced. | Changed to "a smooth, even face". The gloss and matt options need a source on the re-run. |
| 4 | FAQ "How is a modular kitchen priced?" | "Quotes come in three forms" is an unsourced, exhaustive claim about market practice. | Changed to "A quote may be given as …". |
| 5 | FAQ "Which board … sink unit?" | "the cabinet most exposed to water" is an unsourced superlative. | Changed to "exposed to water from the tap, the waste pipe, leaks and cleaning". |
| 6 | FAQ "laminate, acrylic, membrane and PU" | "Acrylic is a glossy sheet" has the same problem as #3. | Changed to "a smooth acrylic sheet". |
| 7 | FAQ "existing stone platform" | "Often, yes" is an unsourced frequency claim. | Changed to "It may be possible". |
| 8 | FAQ "housing society" | "Societies commonly set …" is an unsourced claim. | Rewritten as advice on what to ask the society office. |

**Kept, but the re-run must source or cut them:** the remaining material definitions. They read as standard technical definitions:
- BWP, BWR and MR plywood grades: check the grade names against IS 303 and IS 710 or a plywood maker's page, because BWR naming varies between standards revisions and brands
- HDHMR as a high-density fibreboard
- membrane as PVC foil pressed onto MDF
- PU, veneer, granite and quartz

The questions, mistakes and checklist are procedural advice with no numeric or comparative claims.

**Unit and sanity risks for the re-run.** There are no rates, so there are no unit mix-ups to fix yet.
- **The unit is sq ft of cabinet front area.** Indian quotes "per sq ft" can mean kitchen floor area or carcass area. Others are per running foot or a lump sum per kitchen. Every model's `notes` must state the conversion. The calculator (plan §11) cannot turn a rate into a kitchen estimate until `area_presets` holds sourced cabinet-front areas per BHK.
- **`full-kitchen-remodel` per sq ft of cabinet front.** Civil, plumbing, electrical and tiling costs do not scale with cabinet area. A per-sq-ft rate would have to be a sourced whole-kitchen figure divided by a sourced cabinet area, stated in `notes`. Otherwise the orchestrator should leave this scope out of the cost models.
- **Countertop models.** `material_id` holds the stone, so the cabinet board and finish assumed must be stated in `notes`. Stone is usually priced per sq ft of slab or per running foot of counter, and needs a stated conversion.
- **Tier spread.** When models are added, check that the budget-to-premium ratio and the tier-to-finish mapping (laminate budget; acrylic, PU or veneer premium) match the sources, rather than assuming a multiplier.

**Still open (cannot be fixed by this pack's owner):**
- **`duration_days` is `{min: 0, max: 0}`.** `CONTRACTS §4` gives no nullable shape, and a page that ignores `basis` would show "0–0 days". This is a contract-change request for the orchestrator: allow `duration_days: null`, or require pages to hide it when `max = 0`.
- **The modular-kitchen budget, standard and premium cost-model cells are empty.** The re-run plan above, D03f, or a re-run with search budget must fill them.
