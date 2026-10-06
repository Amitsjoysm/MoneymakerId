# Research log: bathroom-renovation (D03, Wave 1)

- **Date:** 2026-10-06
- **Owner files:** `data/services/bathroom-renovation.json`, `data/cost-models/bathroom-renovation.json`, this log
- **Status:** **BLOCKED. No sources were gathered, so no cost model is included.** This pack needs a re-run when web research is available.

## Why it is blocked

1. **WebSearch:** every query returned *"Web search was not performed: this turn's web search budget is used up (limit: 200 WebSearch calls per turn, shared by every agent in it)"*. The parallel Wave 1 agents had already used the shared budget before this task's first query.
2. **WebFetch:** every publisher domain tried was blocked by the egress proxy (`EGRESS_BLOCKED`) or returned "unable to fetch". The URLs below were only reachability tests. **No content was retrieved from any of them, and none is cited anywhere.**

Under the source-integrity rules (only pages actually seen; ≥ 2 independent publishers per model), nothing could be cited. So:
- `data/cost-models/bathroom-renovation.json` is `[]`. No model met the ≥ 2 independent sources rule, because none had any source.
- `data/services/bathroom-renovation.json` is a skeleton. It holds only taxonomy and editorial guidance that makes no numeric claims: scope options, material definitions, questions, mistakes, the quote checklist and an FAQ. It has `area_presets: []`, every `materials[].sources: []`, and a **placeholder `duration_days` of `{min: 0, max: 0}`** whose `basis` says NOT SOURCED. The contract does not make `duration_days` nullable, so a sentinel was the only shape-valid option. It must be replaced before review.

## Queries run

| # | Tool | Query / URL | Result |
|---|---|---|---|
| 1 | WebSearch (standard) | `bathroom renovation cost Pune per sq ft 2025` | not performed: search budget used up |
| 2 | WebSearch (standard) | `bathroom renovation cost in India per sq ft 2025 basic mid-range luxury` | not performed: search budget used up |
| 3 | WebSearch (standard) | `NoBroker bathroom renovation cost India` | not performed: search budget used up |
| 4 | WebSearch (extended) | `bathroom renovation cost per square foot India` | not performed: search budget used up |
| 5 | WebFetch | `www.nobroker.in` (article path test) | EGRESS_BLOCKED |
| 6 | WebFetch | `housing.com` (article path test) | EGRESS_BLOCKED |
| 7 | WebFetch | `www.urbancompany.com/blog` | EGRESS_BLOCKED |
| 8 | WebFetch | `www.magicbricks.com` (article path test) | unable to fetch |
| 9 | WebFetch | `www.asianpaints.com` | EGRESS_BLOCKED |
| 10 | WebFetch | `www.kajariaceramics.com` | EGRESS_BLOCKED |
| 11 | WebFetch | `timesofindia.indiatimes.com` | unable to fetch |
| 12 | WebFetch | `www.99acres.com/articles/` | EGRESS_BLOCKED |
| 13 | WebFetch | `www.hindustantimes.com` | unable to fetch |
| 14 | WebFetch | `igrmaharashtra.gov.in` | EGRESS_BLOCKED |
| 15 | WebFetch | `economictimes.indiatimes.com` | unable to fetch |
| 16 | WebFetch | `www.jaquar.com` | EGRESS_BLOCKED |

I stopped after these tests. Per the tool's instructions, I did not route around the limit through search engines via curl, third-party readers, proxies or archives.

## Sources

None. No `SourceRef` appears in any of this pack's files.

## Conflicts

None to resolve, because no data was gathered.

## Gaps (all open)

- **Every cost model** (target ≥ 10 across scope × material × tier, each with ≥ 2 independent publishers).
- **`area_presets`:** typical bathroom floor area per bathroom and the number of bathrooms per 1/2/3/4 BHK flat and independent house, with sources. `terrace` is not relevant to this service.
- **`materials[].sources`:** tile types and grades, slip resistance for wet floors, sanitaryware and tap tiers.
- **`duration_days`:** a sourced min/max by scope (full renovation vs retiling).
- **`min_job_inr`:** whether Pune contractors state a minimum job size.
- **Locality factors:** none expected unless a source shows a Pune locality difference.

## Plan for the re-run

**Unit.** `sqft` of bathroom floor area. This fits the contract's "per sq ft" title for `{service}-cost` pages. Quotes given per bathroom should be converted using the sourced floor area, with the conversion stated in `notes`.

**Planned models (ids are proposals):**

| id | scope_id | material_id | tier |
|---|---|---|---|
| `bathroom-renovation-full-budget` | full-renovation | null | budget |
| `bathroom-renovation-full-standard` | full-renovation | null | standard |
| `bathroom-renovation-full-premium` | full-renovation | null | premium |
| `bathroom-renovation-full-ceramic-budget` | full-renovation | ceramic-tiles | budget |
| `bathroom-renovation-full-vitrified-standard` | full-renovation | vitrified-tiles | standard |
| `bathroom-renovation-full-designer-premium` | full-renovation | large-format-designer-tiles | premium |
| `bathroom-renovation-full-stone-premium` | full-renovation | natural-stone | premium |
| `bathroom-renovation-retile-refit-budget` | retile-and-refit | null | budget |
| `bathroom-renovation-retile-refit-standard` | retile-and-refit | null | standard |
| `bathroom-renovation-retile-refit-premium` | retile-and-refit | null | premium |
| `bathroom-renovation-retiling-ceramic-budget` | retiling-only | ceramic-tiles | budget |
| `bathroom-renovation-retiling-vitrified-standard` | retiling-only | vitrified-tiles | standard |
| `bathroom-renovation-retiling-designer-premium` | retiling-only | large-format-designer-tiles | premium |

**Queries to run (standard mode first, extended mode when results are thin):**
- `bathroom renovation cost Pune per sq ft 2025` / `2026`
- `bathroom renovation cost India per sq ft basic mid luxury` (NoBroker, Housing.com, MagicBricks, 99acres, UrbanCompany)
- `bathroom tiling labour rate per sq ft Pune` and `tile laying charges per sq ft Maharashtra 2025`
- `bathroom waterproofing cost per sq ft Pune` (cross-check with the waterproofing pack's `bathroom-waterproofing` models, which that pack owns)
- `CPVC concealed plumbing bathroom cost India` and `bathroom plumbing labour charges Pune`
- `typical bathroom size Indian apartment sq ft` and `2BHK flat number of bathrooms Pune` (area presets)
- `bathroom renovation how many days India` (duration)
- Manufacturer price pages: Kajaria, Somany, Johnson (tiles); Jaquar, Hindware, Parryware, Cera (sanitaryware and taps); Dr. Fixit and Fosroc (bathroom waterproofing)
- News: Times of India Pune or Hindustan Times on renovation or tile price trends in 2025–26

**Cross-pack note.** §4a places `bathroom-waterproofing` under `waterproofing`, not under `bathroom-renovation`. This pack therefore has no sub-services in v1. Its scope descriptions treat waterproofing as a line item inside the renovation.

## Verification (adversarial review, 2026-10-06)

**Verdict: the pack is shape-valid and makes no unsourced numeric claims, but it is still BLOCKED.** It has 0 cost models, 0 area presets, no sources on its materials, and a placeholder duration. The verifier could not research either, so no data was added. D03 acceptance (≥ 10 models, each with ≥ 2 publishers) is **not met**. D03f must fill all three tiers for `bathroom-renovation`, or this pack must be re-dispatched with search budget.

### 1. Shape check

- I wrote a stdlib Python validator (`python3 -I`, no packages) and ran it on both JSON files. It checks:
  - exact key sets for ServiceDef, CostModel and SourceRef (CONTRACTS §4)
  - the CostUnit, AreaPreset, Tier and ProseStatus enums
  - §4a service, sub-service and locality IDs, slug format and reserved slugs
  - unique scope and material IDs, and that each model's scope_id and material_id resolve
  - integer `rate_inr` with low ≤ expected ≤ high
  - components summing to 1 ± 0.01
  - ≥ 2 sources per model from distinct publishers
  - `retrieved_at` = 2026-10-06, `valid_until` = 2027-04-04, status `draft`
  - a scan of all prose for digits or currency
- **Result: 0 errors.** Warnings are only the known gaps: empty presets, 4 materials without sources, the 0/0 duration placeholder, 0 models, and no tier coverage.
- The model checks had nothing to run on, because the cost-models file is `[]`. To prove they work, I ran the validator on a scratch copy with one deliberately broken model. It reported all 12 injected violations:
  - bad scope_id and bad tier
  - low > expected
  - components summing to 0.9
  - a non-§4a locality, and a locality factor with no sources
  - a wrong retrieved_at
  - a duplicate publisher that differed only in case
  - a wrong valid_until, the wrong status, and empty notes
- Counts match the builder's report: 9 questions, 8 mistakes, 11 checklist items, 6 FAQ entries, 3 scope options and 4 materials.

### 2. Source check

- **The pack contains 0 SourceRefs, so there was no cited rate or claim to re-check.** The ≥ 10 source re-checks this task asks for could not be done because there is nothing cited.
- I also tried to find sources myself, and that was blocked too:
  - WebSearch, standard mode, `bathroom renovation cost Pune per sq ft 2025`: *web search budget is used up (limit: 200 WebSearch calls per turn, shared by every agent in it)*.
  - WebFetch was EGRESS_BLOCKED on all 8 hosts tried: www.nobroker.in, www.drfixit.co.in, aapkapainter.com, www.biddaro.com, www.livspace.com, www.homelane.com, www.indiamart.com and en.wikipedia.org. The first four are publishers the waterproofing pack cites. Wikipedia was a control.
  - Following the tool's instructions, I did not work around the limit.
- I did not copy any SourceRef from the waterproofing pack. Under the source-integrity rule, a citation is valid only for a page the citing agent actually saw.

### 3. Prose sanity check (no numbers present; claims made definitional or hedged)

Changed in `data/services/bathroom-renovation.json`. Each change removes or hedges an unsourced claim about usage or market practice:

| Field | Before | After | Why |
|---|---|---|---|
| `materials.ceramic-tiles.description` | "…used mainly on bathroom walls. Floor tiles in a wet area should be…" | "Glazed tiles with a clay body. If they are used on a wet bathroom floor, choose a slip-resistant (matt or anti-skid) finish." | "used mainly on walls" is an unsourced claim about usage |
| `materials.vitrified-tiles.description` | "…used on bathroom floors and walls…" | "…for bathroom floors or walls. If they are used on a wet bathroom floor, choose a slip-resistant finish." | Reworded as a definition |
| `materials.large-format-designer-tiles.description` | "…typically chosen for premium bathrooms." | "Large porcelain slabs or patterned feature tiles." | Unsourced claim about the market and price tier |
| `materials.natural-stone.description` | "Marble or granite used for floors…" | "Marble or granite, for example on floors…" | Reworded as a definition |
| `common_mistakes[0]` | "…an existing leak into the flat below continues." | "…any existing leak into the flat below can continue." | Changed a certainty into a possibility |
| `faq[0].a` | "Quotes come in three forms: …" | "A contractor may quote …" | An unsourced, absolute claim about the market |
| `faq[4].a` | "Societies commonly set working hours and rules…" | "Your society may have rules on working hours…" | An unsourced claim about how common the rules are |

I left the remaining prose unchanged. It is advice or definition: scope definitions, questions to ask, the quote checklist, and the physical consequences of tiling over old tiles. It contains no figures. `prose_status` stays `draft`, and the owner should review the slip-resistance advice and attach a source to it.

### 4. Unit and sanity notes for whoever fills this pack (D03f or a re-run)

- **Unit risk.** The ServiceDef unit is `sqft` of **bathroom floor area**, and every scope description says so. A source can quote "per sq ft" against a different area:
  - tiling labour or tile prices per sq ft of **tiled** area (floor plus walls)
  - waterproofing per sq ft of treated area
  - a lump sum per bathroom

  Each of these must be converted to floor area, and the model's `notes` must show the conversion. Wall area is often several times the floor area. For example, a 5 ft × 8 ft floor (40 sq ft) with walls tiled to 7 ft has about 26 ft × 7 ft ≈ 180 sq ft of wall, before subtracting the door. That example is arithmetic, not a sourced figure. Mixing up these bases would understate or overstate costs several times over.
- **Lump-sum sources.** A per-bathroom price can be converted only by using a **sourced** bathroom floor area. The `area_presets` are empty, so a conversion has nothing to rest on until the presets are sourced.
- **Material-to-tier pairing.** The proposed matrix above pairs ceramic tiles with budget and designer tiles or natural stone with premium. That pairing is a hypothesis, and it must come from the sources, not be assumed.
- **Duration.** `duration_days` stays the `{min: 0, max: 0}` sentinel, and its basis says NOT SOURCED. The contract does not allow null, and no sourced range was available. The gate cannot publish `bathroom-renovation-cost` without a cost model that has ≥ 2 sources, so the sentinel cannot reach a published cost page. The calculator and other consumers should still treat `min = 0` as "unknown".
- **Open contract question for the orchestrator:** should `duration_days` (and the preset `quantity` values) be nullable when they are not sourced, instead of using a 0/0 sentinel?
