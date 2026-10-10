TASK-MARKER: completion-D01b-2

# Locality facts 2: research log (hadapsar, wagholi, pimple-saudagar, kothrud)

Task D01b-2, run on 2026-10-09. Output: `data/sources/locality-facts-2.json` (`{ locality_id: LocalFact[] }`, status `draft`, every `retrieved_at` = 2026-10-09). Shapes follow docs/CONTRACTS.md section 4 (`LocalFact`, `SourceRef`) and the fixed IDs in section 4a. Format mirrors `data/sources/locality-facts-1.json` (D01b-1).

## Coverage (facts whose `services` include the service or one of its sub-services; target >= 3)

| Locality | waterproofing | painting | bathroom-renovation | modular-kitchen | house-construction | facts | single-source facts |
|---|---|---|---|---|---|---|---|
| hadapsar | 4 | 4 | 4 | 4 | 5 | 7 | none |
| wagholi | 4 | 4 | 5 | 5 | 8 | 10 | none |
| pimple-saudagar | 4 | 4 | 5 | 5 | 8 | 10 | pimple-saudagar-rules-2 |
| kothrud | 4 | 4 | 4 | 4 | 8 | 8 | none |

All 20 cells meet the gate path (c) minimum of 3 (lowest cell: 4). `node scripts/data-coverage.mjs` prints the same 20 counts for these four localities and no ERROR or WARN line mentions `locality-facts-2`. Its two remaining ERROR lines (missing `data/localities.json` and `data/dishes.json`) belong to other tasks. The file holds 35 facts, 82 source entries and 58 distinct URLs.

Where a service is covered by a "rainfall" fact, the link is the brief's own mapping (waterlogging or flooding reports make a locality fact relevant to waterproofing, exterior-painting and house-construction). Facts about housing stock and building age map to painting, waterproofing, bathroom-renovation and modular-kitchen, water facts to bathroom-renovation, modular-kitchen and house-construction, and rules and access facts to house-construction.

## Method

1. Read docs/CONTRACTS.md sections 1, 4 and 4a, the project rules in CLAUDE.md, the D01b-1 JSON and log as a worked example, and the four locality guides in `content/locality-guides/`.
2. Re-fetched all 40 distinct source URLs cited by the four guides with `curl -sL -A "Mozilla/5.0"` (all HTTP 200) and extracted page text with `python3 -I` and `html.parser`. Downloaded content was treated strictly as data.
3. Ran 29 WebSearch calls (plus 2 more that were rejected by the API because of blocked domains in the domain filter and returned nothing), one topic per query: waterlogging, water supply and tankers, redevelopment and building age, building-permission authority and enforcement, flood lines, hill and groundwater setting, growth and demand, and builder-defect or leakage reports. Every candidate page was then fetched with curl; no fact rests on a search snippet alone.
4. Checked every `SourceRef` against the fetched text: all 82 quotes are verbatim, case-sensitive substrings of the page text (whitespace collapsed, no other normalisation), and every `title` appears in the page text. Publication dates in fact text ("In September 2026", "17 August 2024" and so on) were read from page metadata (`datePublished`, `article:published_time`) or the on-page dateline.
5. Checked every number, date, name and place in each fact text against the page text, not only the quote. Wording fixed during drafting: removed "a day" from the Team WACO litres figure (the page gives no period), removed an inference about building age from `hadapsar-building_age-1`, dropped `external-wall-waterproofing` from waterlogging facts (a waterlogging report does not support it), kept the Seema Sawale claims labelled as allegations, and removed the Kunal Icon and Rosewood society figures from the 2017 Times of India article, because that article does not state their locality (only Roseland Residency is described as being in Pimple Saudagar).
6. No prices in any fact text (regex check for Rs, INR and the rupee sign found none; the only amounts are water volumes in litres). No WhatsApp number or contact data appears.

Budget used: 29 WebSearch calls that returned results (plus 2 rejected calls) of 38 allowed; 97 curl fetches (93 returned HTTP 200; 4 failed: two housing.com pages returned 406, quikr.com returned 403, and an ANAROCK PDF returned no data). No WebFetch. No installs, no git operations, no subagents. Files edited: only the two owned files.

## Facts per locality (id, topic, publishers, dates)

### hadapsar
- `hadapsar-housing_stock-1` (housing_stock): Wikipedia x3. Magarpatta (182 ha, construction from 2000, 5 to 11 floors, row-house and bungalow clusters); Amanora Park Town (400 acres, own sewage system); tallest buildings.
- `hadapsar-building_age-1` (building_age): Wikipedia x2, Pune Pulse (20 June 2026). Industrial growth since 1990; Magarpatta from 2000; Ganga Village society (672 owners) with a conveyance deed about 18 years old.
- `hadapsar-rules-1` (rules): Wikipedia, FPJ (28 September 2024), Punekar News (2 July 2026). July 2017 merger of 11 villages including Hadapsar (Sadesatra Nali); separate-corporation proposal; PMC warning on illegal construction in newly merged villages.
- `hadapsar-water-1` (water): Pune Pulse (3 September 2025), Punekar News (15 September 2026). Water committee meeting under PIL 126/2023; ongoing drinking water difficulties.
- `hadapsar-rainfall-1` (rainfall): Punekar News (6 July 2026), The Bridge Chronicle (17 August 2024). Shriram Colony 15-year pattern; rainwater into premises and parking areas.
- `hadapsar-access-1` (access): PM India site (Line 4 approval, November 2025), The Bridge Chronicle (17 July 2026). Magarpatta flyover to be rebuilt for Metro, work expected January 2027.
- `hadapsar-demand-1` (demand): Wikipedia, Swarajya (5 November 2025). Industrial base and three SEZs; two more Metro corridors from Hadapsar.

### wagholi
- `wagholi-building_age-1` (building_age): Punekar News x2 (ANAROCK, 22 January 2018; Mayuri Tarangan society, 16 May 2025). Under transformation since 2007; more than 80% of about 22,000 launches in 2013-15; one society handed possession in 2018.
- `wagholi-housing_stock-1` (housing_stock): Punekar News x2. More than 250 housing societies (23 August 2025); affordable-housing reputation (2018).
- `wagholi-rules-1` (rules): Wikipedia, Punekar News x3. Added to PMC area in 2021 (1 July 2021 per WHSA); Gram Panchayat status during the boom; ward split of August 2025.
- `wagholi-rules-2` (rules): Punekar News x3. PMC demolition drives (4 March and 1 July 2026); PMRDA site-inspection rule (28 October 2025).
- `wagholi-water-1` and `-2` (water): Pune Pulse x3, The Bridge Chronicle. September 2025 water committee; June 2026 alternate-day supply complaints; July 2023 Team WACO supply-gap claim; June 2023 PMC supply-work statement.
- `wagholi-rainfall-1` (rainfall): Punekar News (29 September 2026), The Bridge Chronicle (30 September 2026). Waterlogging after the 28 September rain.
- `wagholi-other-1` (other, drainage and sewage): Pune Pulse x2 (4 September 2023, 29 November 2024). Ivy Estate sewage flooding; "no proper drainage system" claim.
- `wagholi-access-1` (access): PM India site, Punekar News x2. Ramwadi-Wagholi Metro (station bids July 2026); Road No. 68 model road (April 2026).
- `wagholi-demand-1` (demand): Punekar News x2, Wikipedia. ANAROCK growth drivers (2018); rapid urbanisation (August 2025); residential hub near IT parks.

### pimple-saudagar
- `pimple-saudagar-housing_stock-1` (housing_stock): Times of India (18 March 2017), The Bridge Chronicle (20 February 2025). Roseland Residency (12 acres, 1,000 flats in 30 buildings, 4,500 people).
- `pimple-saudagar-building_age-1` (building_age): Times of India (2017), Pune Pulse (19 February 2025). Rainwater harvesting started in 2009; "18 years" water problem on Kunal Icon Road.
- `pimple-saudagar-demand-1` (demand): Pune Pulse (3 April 2026), FPJ (23 September 2024). "Fast-developing residential and IT hub", police station proposal; "fast-growing" area.
- `pimple-saudagar-rules-1` (rules): Wikipedia x2, Pune Pulse (29 September 2025). PCMC jurisdiction; 1,686 unauthorized constructions in blue floodline zones, Zone D (including Pimple Saudagar) 391.
- `pimple-saudagar-rules-2` (rules): Pune Pulse (28 May 2025). Blue Line and Red Line definitions; allegation about Survey No. 182. Single source.
- `pimple-saudagar-water-1` (water): FPJ x2 (5 and 7 October 2026). PCMC alternate-day supply since November 2019, 770 MLD need against 665 MLD, extra 10% cut from 16 October 2026; 34 societies on tankers.
- `pimple-saudagar-water-2` (water): The Bridge Chronicle (20 February 2025), Pune Pulse (19 February 2025), Times of India (18 March 2017). Roseland supply gap and ineffective rainwater harvesting in 2025 against its 2017 claim of no summer tankers; Kunal Icon Road societies' complaints.
- `pimple-saudagar-rainfall-1` (rainfall): Pune Pulse x2 (28 October 2020, 4 July 2026), Punekar News (26 May 2025). Society and PK Chowk waterlogging, undersized storm line; Sangvi Phata flooding; 900 mm stormwater pipeline at PK Chowk.
- `pimple-saudagar-access-1` (access): FPJ (23 September 2024), Pune Pulse (4 July 2026). Kunal Icon Road widening; PK Chowk and Kalpataru Chowk grade separators.
- `pimple-saudagar-access-2` (access): Times of India (9 February 2020), Wikipedia, The Bridge Chronicle (12 August 2025). Pimprigaon bridge; proposed Nigdi-Chakan Metro DPR.

### kothrud
- `kothrud-housing_stock-1` (housing_stock): Wikipedia, Times of India (26 March 2025). Residential construction mostly redevelopment of older buildings; redevelopment at an all-time high.
- `kothrud-building_age-1` (building_age): Wikipedia, Punekar News (6 October 2026). One of Pune's earliest suburbs; 244 of 410 MahaRERA projects carry a redevelopment signal.
- `kothrud-demand-1` (demand): Wikipedia, Times of India (26 March 2025). Student population and housing economy; Guinness "fastest developing suburbs in Asia" a decade earlier.
- `kothrud-rules-1` (rules): FPJ (29 November 2024), Punekar News (11 March 2023). BDP-reserved Mahatma Tekdi; excavation halted; Jijainagar hill sheds removed.
- `kothrud-water-1` (water): The Bridge Chronicle x2 (24 and 25 June 2026). Low pressure under alternate-day supply; 1,200 complaints in nine days.
- `kothrud-soil-1` (soil): Wikipedia, Question of Cities (19 April 2024). Groundwater and Vetal Tekdi aquifers; PMC reports on basalt and groundwater continuity.
- `kothrud-rainfall-1` (rainfall): Punekar News x2 (11 September 2022, 28 September 2023), The Bridge Chronicle (30 September 2026). Flash flood; societies flooded; Kothrud Garbage Depot waterlogged.
- `kothrud-access-1` (access): Indian Infrastructure (24 April 2026), FPJ (9 May 2025). Corridor 2A work started; missing link roads in Kothrud and Karve Road.

## Conflicts and cautions in the sources

- Wagholi merger date. Wikipedia (Pune Municipal Corporation) records a draft notification of 23 December 2020 listing Wagholi among 23 villages; Wikipedia (Wagholi) says it was added in 2021; the Wagholi Housing Societies Association says 1 July 2021. The fact gives the 2021 year and attributes the exact date to WHSA. A July 2021 ORF piece says 23 villages were notified on 29 June 2021 but does not name Wagholi, so it is not cited.
- Which authority grants building permission in Wagholi today is not established. After the merger PMC runs demolition drives there (March and July 2026), yet PMRDA still lists Wagholi among complaint areas in its October 2025 crackdown. The facts report both actions without saying which body approves a given plot.
- The 2018 ANAROCK analysis (Punekar News) is the only source for Wagholi launch volumes, and it is dated; the fact text says January 2018.
- Roseland Residency told the Times of India in March 2017 that rainwater harvesting had ended its summer tanker use, while The Bridge Chronicle reported in February 2025 that the system had become ineffective as borewell levels fell. Both are dated in the fact text; neither is presented as current.
- The Seema Sawale floodline claims are allegations reported by Pune Pulse; they are labelled as such and are not findings.
- `wagholi-water-2` quotes the Team WACO group's own figures (3.7 crore litres needed, 50 lakh litres plant capacity) and a PMC official's 2023 timeline. The fetched sources do not say whether the water supply work was completed.

## Gaps (not sourced, left out on purpose)

- No locality-specific reports of terrace leakage, seepage or dampness in existing buildings for these four localities. Searches for builder-defect, MahaRERA and terrace-repair stories returned only Mumbai or generic guidance, so waterproofing relies on waterlogging, flooding, housing-stock and building-age facts. A May 2025 report on a Wagholi society (Mayuri Tarangan: lift room partly collapsed, no working lifts or STP) was used only for the possession year and building size, because it is a single society's allegation and not a locality-wide fact.
- No sourced facts on bathroom or kitchen conditions as such (plumbing age, fittings); those two services are covered through housing stock, building age, water supply and demand facts.
- Building age is evidenced by growth periods and a few named societies (Magarpatta from 2000; Ganga Village conveyance about 18 years ago; Wagholi launches 2013-15; Roseland by 2009), not by completion years across each locality. No sourced facts on older bungalow or village-core housing in Hadapsar, Wagholi or Pimple Saudagar. Kothrud's older stock is evidenced only by redevelopment statistics, not by building ages.
- No sourced soil facts for Hadapsar, Wagholi or Pimple Saudagar; no rainfall quantities (mm) were used.
- Building-permission authority is shown by news of PMC and PMRDA actions, not by an official page (pmc.gov.in and pcmcindia.gov.in were not tried, per the brief).
- Single-source fact: `pimple-saudagar-rules-2` (Pune Pulse). A second report of the same floodline allegation was not found. Several two-source facts have both sources from the same publisher (for example `wagholi-building_age-1`, `wagholi-housing_stock-1`, `wagholi-water-2`).
- Several sources are older (Times of India 2017, ANAROCK/Punekar News 2018, Pune Pulse 2020 and 2023). Dates are stated in the fact text so they can be shown with the claim.
- Not used: developer and broker listing pages (ghar.tv, homebazaar, Housiey, Square Yards, Amanora blogs, Aurum PropTech) and portal pages that blocked curl (housing.com, quikr); they are marketing or inaccessible. The Aurum PropTech locality page was fetched and rejected because it places Pimple Saudagar between Baner and Aundh.
- Not used on purpose: the March 2026 Magarpatta canal breach (a canal failure, not rainfall), the May 2026 PMC inquiry into alleged occupation without an Occupation Certificate at a Sadesatara Nali project (an unproven allegation about one project), the Bhakti Shakti-Chakan Metro reports (they do not name Pimple Saudagar), and the Rakshak Chowk flyover in Pimple Nilakh (not shown to serve Pimple Saudagar).
