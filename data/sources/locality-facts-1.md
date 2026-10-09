TASK-MARKER: retryB-D01b-1

# Locality facts 1: research log (hinjewadi, wakad, baner, kharadi)

Task D01b-1, retry B, run on 2026-10-07. Output: `data/sources/locality-facts-1.json` (`{ locality_id: LocalFact[] }`, status `draft`, every `retrieved_at` = 2026-10-07). Shapes follow docs/CONTRACTS.md section 4 (`LocalFact`, `SourceRef`) and the fixed IDs in section 4a.

## Coverage (facts whose `services` include the service or one of its sub-services; target >= 3)

| Locality | waterproofing | painting | bathroom-renovation | modular-kitchen | house-construction | facts | single-source facts |
|---|---|---|---|---|---|---|---|
| hinjewadi | 5 | 4 | 4 | 4 | 7 | 9 | none |
| wakad | 6 | 4 | 4 | 4 | 7 | 9 | wakad-rainfall-1, wakad-rainfall-3 |
| baner | 6 | 4 | 4 | 4 | 7 | 9 | baner-housing_stock-1 |
| kharadi | 5 | 4 | 5 | 5 | 8 | 10 | kharadi-water-2 |

`node scripts/data-coverage.mjs`: no ERROR or WARN line mentions `locality-facts-1`. All 20 cells meet the gate path (c) minimum of 3. The remaining ERROR lines in that script's output (missing `data/localities.json`, `data/dishes.json`, `content/locality-guides/*.md`) belong to other tasks.

## Method

1. Read CONTRACTS section 1, section 4, section 4a and the project rules in CLAUDE.md.
2. An unverified draft of 47 facts (70 source entries, 41 distinct URLs) already existed. Rule applied: a fact stays only if its source was re-fetched this session and its quote matches.
3. Re-fetched all 41 URLs with `curl -sL -A "Mozilla/5.0"` (all returned HTTP 200), extracted page text with `python3 -I` and `html.parser`, and checked every quote as a verbatim substring (whitespace-collapsed). Result: 70/70 quotes matched. Downloaded content was treated strictly as data.
4. Checked each `SourceRef.title` against the page heading or `<title>`, and each publication date against page metadata (`datePublished`, `article:published_time`) or the dateline in the text. All titles matched. The dates used in fact text ("In September 2026", "April 2017", and so on) agree with those dates.
5. Went beyond the quotes: checked every number, date, name and place in each fact's text against the page text, found overreach in 14 facts, and rewrote them (list below).
6. Found 2 more pages by search, fetched them with curl, and added them (Kharadi enforcement). Final file: 37 facts, 72 source entries; all 72 quotes match verbatim (also under a strict case-sensitive substring check).

Budget used: 9 WebSearch calls of 38 allowed; 43 pages fetched with curl (41 re-fetched draft sources plus 2 new). No WebFetch. No installs, no git operations, no subagents. Files edited: only the two owned files.

## Changes made to the draft

Wording corrected so the text claims only what the cited page says:
- hinjewadi-water-1: removed "piped" (the source says "water supply"), removed "long depended", cited the source's own "long-pending drinking water shortage", added what PMRDA's 1.2 TMC request actually was (a proposal to the Water Resources Department).
- wakad-building_age-1: now names the four areas the Times of India listed, and says "fringe villages" as the source does (it had said "a fringe village").
- wakad-rules-1: re-sourced to the Times of India (April 2017) plus the Wikipedia lead sentence; the earlier Wikipedia claim about building permissions came from an uncited section. The PCMC water-undertaking rule is stated as PCMC-wide, because that article does not mention Wakad.
- wakad-rainfall-2: dropped "had not been independently verified" (not in the source); now "alleged ... and asked for a technical probe".
- wakad-access-1: dropped the Wikipedia claim about dug-up roads (uncited section); now uses the FPJ congestion points and the Bridge Chronicle report on the Tathawade-Punawale underpass.
- baner-housing_stock-1: the bungalow was in Prathamesh Park at Balewadi Phata, not Baner, so the text no longer says Baner has bungalows; the seven-building Saidutta society detail is now in the quote.
- baner-rules-1: re-sourced; the Aundh-Baner Ward Office, the Building Department referral and the BDP restriction are all in the cited Punekar News article. The earlier text said "served by PMC's ward office" without a quote.
- baner-soil-1: "foothills of Baner Hill" corrected to "foothills of the hills comprising the Baner-Pashan Biodiversity Park"; channel narrowing attributed to illegal construction and debris dumping as Wikipedia states.
- baner-rainfall-2: "claim had not been independently verified" replaced by what the reports say (residents questioned the riverfront works and asked for a probe; cause not established).
- baner-access-1: the report names Baner-Mahalunge Road, Balewadi Road and Aundh-Baner Road waterlogged (not "Baner Road" for the Metro work); date given as 14-15 September 2025.
- kharadi-demand-1: removed "EON IT Park" (not on that Wikipedia page; only in a different source); the quote now carries the WTC and company list; the 2011 BusinessLine point reworded.
- kharadi-building_age-1: attributes the "rapid pace in the 2020s" to Wikipedia, which says so.
- kharadi-access-1: no longer says the Kharadi Bypass station is "on" the double-decker structure; the source says the corridor will be double-decker and lists four stations.
- kharadi-housing_stock-1 and the new kharadi-water-2: "housing society" instead of "complex" for Nyati Elysia.

Removed:
- wakad-water-2 (wells and falling groundwater) and wakad-soil-1 (black soil): both relied only on an uncited section of the Wikipedia "Wakad" page, which carries a "needs more citations" banner. Wakad still has 9 facts and 4+ in every service.

Added (new sources found this session):
- kharadi-rules-2: PMC enforcement of building permissions in Kharadi (Pune Pulse, 1 November 2025; The Bridge Chronicle, 29 July 2026).
- kharadi-water-2: the April 2025 Nyati Elysia shortage, showing the shortfall predates May 2026 (Pune Pulse).

## Facts per locality (id, topic, services, publishers)

### hinjewadi
- `hinjewadi-demand-1` (demand; all five services): Wikipedia, FPJ. Infotech Park size and company count; district collector's 5 lakh daily travellers (September 2026).
- `hinjewadi-housing_stock-1` (housing_stock): RealtynMore, Bridge Chronicle. High-rise project signed October 2025; growth belt reported September 2026.
- `hinjewadi-building_age-1` (building_age): Bridge Chronicle, FPJ. Recent urbanisation (August 2026 reports).
- `hinjewadi-rules-1` (rules): Punekar News, FPJ. No municipal corporation; MIDC, PMRDA and gram panchayats; PCMC merger proposal of seven villages (PCMC general body, February 2015) pushed again September 2026.
- `hinjewadi-rules-2` (rules): Punekar News, FPJ x2. PMRDA groundwater certificate delays approvals (August 2026); residents ask PMRDA to halt new permissions.
- `hinjewadi-water-1` (water): HT report on supriyassule.in (April 2018), FPJ (June 2026). Tanker dependence; stalled MJP scheme; 1.2 TMC request.
- `hinjewadi-rainfall-1` and `-2` (rainfall): Punekar News, FPJ, Bridge Chronicle. Flooding on 7 and 22 June 2025 and 21 September 2026; blocked nullahs and drains.
- `hinjewadi-access-1` (access): Wikipedia, FPJ. Peak-hour congestion; heavy-vehicle restriction.

### wakad
- `wakad-demand-1` (demand): Wikipedia, Times of India (April 2017).
- `wakad-building_age-1` (building_age): Times of India, Bridge Chronicle.
- `wakad-housing_stock-1` (housing_stock): Punekar News (Yashone Central, 412 flats), Pune Pulse (Kalpataru Exquisite, basement parking and lifts).
- `wakad-rules-1` (rules): Times of India, Wikipedia (lead sentence), Punekar News. PCMC area; PCMC builders' water undertaking (March 2026).
- `wakad-water-1` (water): Punekar News x2. Alternate-day PCMC supply, daily tankers in September 2026, 36 societies on the federation's list.
- `wakad-rainfall-1` (rainfall): Pune Pulse. 24-25 July 2024 basement flooding at Kalpataru Exquisite.
- `wakad-rainfall-2` (rainfall): Punekar News x2. August 2020 flood alert; July 2026 riverbed-fill allegation.
- `wakad-rainfall-3` (rainfall): Bridge Chronicle. 21 September 2026 waterlogging; drainage network inadequate in pockets.
- `wakad-access-1` (access): FPJ, Bridge Chronicle. Congestion points and the Tathawade-Punawale underpass.

### baner
- `baner-demand-1` (demand): Wikipedia, Punekar News (August 2026).
- `baner-building_age-1` (building_age): Wikipedia x2. Agricultural village; IT and residential influx after 2005.
- `baner-housing_stock-1` (housing_stock): Bridge Chronicle. Saidutta society (seven buildings), Prathamesh Park bungalows (August 2019 flooding).
- `baner-rules-1` (rules): Punekar News, Wikipedia. PMC; Aundh-Baner Ward Office; BDP restriction (July 2026).
- `baner-soil-1` (soil): Wikipedia x2. Foothill setting, 570 m; Ramnadi narrowed, 106 of 416 feeder streams gone.
- `baner-rainfall-1` and `-2` (rainfall): Wikipedia, Bridge Chronicle, Pune Pulse, Punekar News. 2019 Ramnadi flooding; July 2026 Mula River flooding.
- `baner-water-1` (water): Pune Pulse x2. Inadequate PMC supply and tankers (June 2023); Warje pumping station line (2023).
- `baner-access-1` (access): FPJ, Punekar News. Metro Line 3 works and drains (September 2025); junction congestion (August 2026).

### kharadi
- `kharadi-demand-1` (demand): Wikipedia, Hindu BusinessLine (2011).
- `kharadi-building_age-1` (building_age): Wikipedia, Hindu BusinessLine.
- `kharadi-housing_stock-1` (housing_stock): Punekar News (over 50 societies, 25,000-30,000 residents), Pune Pulse (Nyati Elysia, 3,000 residents).
- `kharadi-water-1` and `-2` (water): Punekar News x2 (May 2026); Pune Pulse (April 2025).
- `kharadi-rainfall-1` and `-2` (rainfall): Pune Pulse x2, Wikipedia, FPJ. June 2025 and 2 April 2026 waterlogging; July 2026 Mula-Mutha submerging the Keshav Nagar link road.
- `kharadi-access-1` (access): Punekar News, Bridge Chronicle. Ramwadi-Wagholi Metro works (September 2026).
- `kharadi-rules-1` and `-2` (rules): Punekar News x2 (residents' demand to halt approvals, May 2026); Pune Pulse, Bridge Chronicle (PMC demolitions).

## Gaps (not sourced, left out on purpose)

- No locality-specific reports of terrace leakage, seepage or dampness in existing buildings. Searches for Kharadi, Hinjewadi, Wakad and Baner returned only generic Indian housing-society and MahaRERA guidance, so waterproofing relies on waterlogging, flooding and basement facts.
- No sourced facts on bathroom or kitchen conditions as such (plumbing age, fittings); those two services are covered through housing stock, building age, water supply and demand facts.
- Building age is evidenced by the growth period (IT boom from about 2005; Wakad's decade of development to 2017) but not by completion years of specific societies. No sourced facts on older bungalow or village-core housing for these four localities.
- Hinjewadi and Kharadi building-permission authority is shown by news of PMRDA/PMC actions, not by an official PMC or PMRDA page (pmc.gov.in and pcmcindia.gov.in were not tried, per the brief's note that they reset connections).
- Wikipedia "Wakad" is flagged "needs more citations"; only its lead sentence is used. Wakad soil and well-water facts were dropped for that reason.
- Several sources are older (BusinessLine 2011, Times of India 2017, HT 2018, Bridge Chronicle 2019, flood alert 2020, Pune Pulse 2023). Dates are stated in the fact text so they can be shown with the claim.
- Single-source facts (preferred minimum is two): wakad-rainfall-1, wakad-rainfall-3, baner-housing_stock-1, kharadi-water-2. Searches for a second independent report of the Wakad July 2024 basement flooding found only the same Pune Pulse article.
- Developer and broker listing pages (Lodha, Kolte-Patil, homebazaar and similar) turned up in searches and were not used: they are marketing, not independent sources.
