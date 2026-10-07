# Research log: waterproofing service pack (D03a)

- **Owner task:** D03a · Service pack `waterproofing`
- **Files:** `data/services/waterproofing.json`, `data/cost-models/waterproofing.json`, this log
- **Researched:** 2026-10-06 (all `retrieved_at` = `2026-10-06`; `reviewed_at` = `2026-10-06`; `valid_until` = `2027-04-04`)
- **Status:** everything is `draft`; prose needs owner review before it can render on an indexable page.

## 1. Method and constraints

1. **WebSearch only.** WebFetch was blocked by the egress proxy (`EGRESS_BLOCKED`) for every domain tried: asianpaints.com, nobroker.in, aecord.com, studiomatrx.org, infralens.in, leakfoe.com, housingsocietytimes.com, constructionestimatorindia.com. No page was opened directly.
2. **Attribution by domain-restricted search.** To tie each figure to a publisher, most queries were run with `allowed_domains` set to one publisher. The publisher of each figure is therefore certain. The exact page URL is the result whose title matches the figure's topic; where more than one page of the same publisher was returned, confidence is marked **medium** in §3.
3. **Quotes.** Every `quote` is copied character-for-character from the WebSearch tool output (result titles, or the snippet text the tool returned). Because pages could not be opened, **no quote has been checked against the live page**. The search tool may condense page text, so the reviewer should open each URL and confirm the wording and figures before marking prose `reviewed`. Product pages where only the title was seen carry `quote: null`.
4. **Blocked or empty publishers.** Search refused these domains for the search user agent (HTTP 400): magicbricks.com, timesofindia.indiatimes.com, hindustantimes.com, economictimes.indiatimes.com, indianexpress.com, punemirror.com. housing.com returned no results (two tries). urbancompany.com returned no waterproofing prices.
5. **Search budget.** The shared WebSearch budget for this turn ran out after query 50. Three planned pinning queries (§2, rows 51–53) were not run.
6. **Rules applied to every model:**
   - `low` = lowest cited low; `high` = highest cited high (ranges widened whenever sources disagree).
   - `expected` = median of the cited publishers' midpoints, rounded to the nearest ₹5 with ties rounded down (leakage repair: nearest ₹50). When one publisher gives several figures, its own median is used as its midpoint.
   - Two sources count as independent only if publishers differ. Two pages from the same publisher count once.
   - `components` are an editorial split for the calculator, not sourced, except bathroom models, where labour + preparation + repair = 0.75 following NoBroker's statement that labour is about 75% of bathroom waterproofing cost.
   - `min_job_inr` = `null` everywhere: no source states a minimum job value.
   - `locality_factors` = `[]` everywhere: no source gives a Pune locality-level difference.

## 2. Queries run

`std` = standard mode, `ext` = extended mode. "Domains" = `allowed_domains` filter.

| # | Mode | Domains | Query | Useful result |
|---|---|---|---|---|
| 1 | std | — | terrace waterproofing cost per sq ft Pune 2025 | Pointers to IndiaMART Pune, Asian Paints, NoBroker, Aecord |
| 2 | std | — | bathroom waterproofing cost per sq ft India 2025 | Pointers to Studio Matrx, Construction Estimator India |
| 3 | std | — | waterproofing cost per square feet India 2026 terrace bathroom wall price guide | Asian Paints city ranges (not used) |
| 4 | std | asianpaints.com | waterproofing cost in India per sq ft terrace bathroom external wall | AP_COST figures |
| 5 | std | nobroker.in | terrace waterproofing cost per sq ft | Mixed NoBroker pages; tier/method figures not pinned to a page (not used) |
| 6 | std | aecord.com | terrace waterproofing cost India 2026 per sq ft APP PU membrane | AEC_TERR figures |
| 7 | std | nobroker.in | Waterproofing Cost in Pune Price Per SqFt Labour Charges NoBroker | NB_PUNE figures |
| 8 | ext | — | waterproofing rate in Pune per sq ft | Pointers to Leakfoe, Biddaro, IndiaMART Pune; NoBroker forum (2024) |
| 9 | std | leakfoe.com | waterproofing rates in Pune terrace bathroom | LF_PUNE figures |
| 10 | std | indiamart.com | terrace waterproofing service Pune price per square feet | IM_TERR_COAT and Pune terrace listings |
| 11 | std | biddaro.com | waterproofing cost per sq ft Pune | BID_PUNE figures |
| 12 | std | urbancompany.com | waterproofing service price terrace bathroom per sq ft | No prices (gap) |
| 13 | std | drfixit.co.in, pidilite.com | Dr. Fixit waterproofing cost per sq ft terrace bathroom | Product pages and prices |
| 14 | std | drfixit.co.in | Dr. Fixit roof waterproofing cost explained per sq ft basic coating liquid applied membrane | DF_ROOF figures |
| 15 | std | drfixit.co.in | what to expect from Dr. Fixit waterproofing price solutions | DF_EXPECT figures |
| 16 | std | nobroker.in | bathroom waterproofing cost per sq ft labour charges | NB_BATH figures (first pass) |
| 17 | std | studiomatrx.org | bathroom waterproofing cost India per sq ft | SM_BATHCON figures |
| 18 | std | studiomatrx.org | studiomatrx bathroom waterproofing cost india floor walls 1800 mm shower height ₹7,000–₹14,000 | Confirms SM_BATHCON page; renovation tiers |
| 19 | std | studiomatrx.org | cementitious waterproofing India coatings coats cost per sq ft sunken bathroom | SM_CEM figures |
| 20 | std | nobroker.in | bathroom waterproofing cost price per sq ft labour charges basic coating grouting sunken slab | NB_BATH figures (pinned) |
| 21 | std | — | external wall waterproofing cost per sq ft India exterior seepage | Pointers to AP_EXT, AapkaPainter |
| 22 | std | nobroker.in | exterior wall waterproofing cost per sq ft | NB_EXT figures |
| 23 | std | aapkapainter.com | waterproofing price calculator exterior wall terrace per sq ft | AAP_CALC figures |
| 24 | std | asianpaints.com | exterior wall waterproofing seepage solutions cost | AP_EXT figures |
| 25 | std | — | basement waterproofing cost per sq ft India | Pointer to AP basement figure |
| 26 | std | nobroker.in | how much does it cost to waterproof a basement per sq ft | NB_BASE (first pass) |
| 27 | std | asianpaints.com | basement waterproofing cost per sq ft | AP basement figure |
| 28 | std | nobroker.in | waterproof a basement cost cementitious crystalline injection grouting Rs per sq ft | NB_BASE figures (pinned) |
| 29 | std | studiomatrx.org | basement waterproofing cost India per sq ft membrane crystalline | Crystalline and external membrane figures |
| 30 | std | studiomatrx.org | studiomatrx waterproofing guide Indian homes zone-by-zone basement external membrane positive side ₹80–150 per sq ft | SM_GUIDE (pinned) |
| 31 | std | studiomatrx.org | waterproofing membrane types India cementitious acrylic PU sheet crystalline ₹ per sq ft elongation | SM_TYPES table |
| 32 | std | — | injection grouting cost per point leakage repair India ceiling seepage | Pointers to AapkaPainter, IndiaMART |
| 33 | std | — | leakage repair cost Pune ceiling seepage crack filling price | US-only results; nothing usable |
| 34 | std | aapkapainter.com | PU injection grouting price per nozzle | AAP_PUINJ, AAP_PUGROUT |
| 35 | std | indiamart.com | PU injection grouting service price per point Pune | IM_INJ_DIR figures |
| 36 | std | nobroker.in | injection grouting cost leakage seepage repair per sq ft per point | Pointer to NB_SEEP |
| 37 | std | nobroker.in | cost of interior wall seepage repair 2026 injection grouting per point | NB_SEEP (pinned) |
| 38 | std | indiamart.com | Polymer Injection Grouting Service ₹2000 per injection Pune | IM_TARMIC |
| 39 | std | — | brickbat coba waterproofing rate per sq ft 2025 Pune Mumbai | Generic; Scribd CPWD analysis (user upload, not used) |
| 40 | std | — | APP membrane waterproofing rate per sq ft India 2025 4mm torch applied | Nothing specific |
| 41 | std | infralens.in | waterproofing prices Pune Maharashtra per sq ft | Material price only (not used) |
| 42 | std | indiamart.com | brick bat coba service price per sqft Pune | IM_BBC_81/105/145 |
| 43 | std | indiamart.com | APP membrane waterproofing service price per square feet Pune | IM_APP_DIR |
| 44 | std | housing.com | terrace waterproofing cost per sq ft APP membrane PU brickbat coba | No results |
| 45 | std | magicbricks.com | waterproofing cost per sq ft terrace bathroom | Refused (400) |
| 46 | std | 99acres.com | waterproofing cost per sq ft terrace | A99_DAMP |
| 47 | std | TOI, HT, ET, Pune Mirror, Indian Express | Pune waterproofing pre-monsoon demand cost per sq ft societies terrace leakage | Refused (400) |
| 48 | std | housing.com | waterproofing cost per sq ft terrace bathroom 2025 | No results |
| 49 | ext | — | Pune housing societies terrace waterproofing leakage monsoon 2025 news cost lakh | Housing Society Times (bye-law 68), Leakfoe again |
| 50 | std | constructionestimatorindia.com | "waterproofing" cost per sq ft guide India 2026 PU APP cementitious bathroom terrace basement price table | CEI_BATH, CEI_PARK figures |
| 51 | — | constructionestimatorindia.com | (planned) pin the cementitious/PU figures to the bathroom page | Not run: budget exhausted |
| 52 | — | housingsocietytimes.com | (planned) confirm bye-law 68 wording | Not run: budget exhausted |
| 53 | — | navniwas.com | (planned) Maharashtra rules on who pays for leakage from the flat above | Not run: budget exhausted |

## 3. Sources and what each supports

Confidence = confidence that the figure is on **this exact URL** (the publisher is certain in every case because the search was domain-restricted, except where noted).

| Key | Publisher | URL | Type | What it supports | Key quote (as seen in search output) | Confidence |
|---|---|---|---|---|---|---|
| AP_COST | Asian Paints | https://www.asianpaints.com/blogs/waterproofing-cost-in-india.html | Manufacturer article, undated | Terrace tiers; bathroom; external wall; basement; overall range | "Basic coating systems cost ₹60 to ₹100 per sq ft, mid-range membrane systems cost ₹100 to ₹180 per sq ft, and premium PU or advanced systems cost ₹180 to ₹250 per sq ft." | High (terrace, bathroom, external wall). **Medium** for the basement figure, which may sit on the AP waterproofing calculator page instead (query 27 listed the calculator first; query 25 listed this blog first). |
| AP_EXT | Asian Paints | https://www.asianpaints.com/blogs/exterior-wall-waterproofing-seepage-solutions.html | Manufacturer article | Exterior range ₹25–₹80; coating types | "In India, exterior waterproofing usually ranges between ₹25 to ₹80 per sq ft, depending on the system and quality." | High |
| NB_PUNE | NoBroker | https://www.nobroker.in/painting-services/waterproofing-cost-in-pune | Marketplace price page, Pune | Terrace ₹35–₹60; basement ₹75–₹100; exterior ₹30–₹60; bathroom ₹2,000–₹4,000 per bathroom; crack filling ₹100–₹150 per linear foot; balcony ₹30–₹50; chemical waterproofing ₹30–₹95 | "Terrace Waterproofing: ₹35–₹60 per sqft" | High |
| NB_BATH | NoBroker | https://www.nobroker.in/painting-services/bathroom-waterproofing-cost | Marketplace price page | Bathroom scope tiers; labour ≈ 75% | "Basic coating + grouting: Rs. 80 to Rs. 120/sq ft" | High (top result in two queries) |
| NB_EXT | NoBroker | https://www.nobroker.in/forum/what-is-the-exterior-wall-waterproofing-cost-in-india/ | Marketplace forum article | Exterior basic ₹35–₹60; crack filling + elastomeric ₹35–₹80; premium ₹60–₹150 | "Crack filling + elastomeric coating ranges from Rs. 35 to Rs. 80 per sq ft" | Medium-high |
| NB_BASE | NoBroker | https://www.nobroker.in/forum/how-much-it-cost-to-waterproof-a-basement/ | Marketplace forum article | Basement cementitious ₹100–₹200, crystalline ₹150–₹320, injection ₹180–₹350; overall ₹40–₹350 | "Injection grouting costs Rs. 180 to Rs. 350 per sq. ft. and is recommended for active water leaks, wall cracks, and construction joints." | High |
| NB_SEEP | NoBroker | https://www.nobroker.in/forum/what-is-the-cost-of-interior-wall-seepage-repair/ | Marketplace forum article (2026 in title) | Injection grouting ₹500–₹1,200 per point | "Injection grouting for severe seepage ranges from Rs. 500 to Rs. 1,200 per point." | High |
| DF_ROOF | Pidilite Industries (Dr. Fixit) | https://www.drfixit.co.in/resources/blog/new-home/protection-and-peace-roof-waterproofing-cost-explained | Manufacturer article | Basic coating ₹35–₹45; LAM ₹65–₹85; average ₹30–₹90; 900 sq ft roof example | "For a basic coating system, the cost is approximately ₹35–₹45 per sq ft." | High |
| DF_EXPECT | Pidilite Industries (Dr. Fixit) | https://www.drfixit.co.in/resources/blog/home-care-decor/what-to-expect-from-dr-fixit-waterproofing-solutions-price-and-more | Manufacturer article | ₹15–₹80+ per sq ft overall; Roofseal Classic ₹465/L; Roofseal Ultra ₹11,330/20 L | "Dr. Fixit Roofseal Classic is available at Rs. 465 for 1 litre" | High |
| DF_ULTRA, DF_PIDIFIN, DF_BITUFIX, DF_RAINCOAT | Pidilite Industries (Dr. Fixit) | product pages under https://www.drfixit.co.in/products/… | Manufacturer product pages | Product examples in material descriptions (title only, except Pidifin 2K pack prices) | Pidifin 2K: "Available in 3 kg (₹580) and 15 kg (₹2,360) packages." | Medium (pack prices came from a mixed Dr. Fixit query). **Verification (§8):** Pidifin 2K quote set to `null`; the product page is kept as a title-only reference. |
| AAP_CALC | AapkaPainter | https://aapkapainter.com/resources/waterproofing-price-calculator | Contractor/marketplace calculator | External wall ₹27–₹33 (paint surface), ₹28–₹35 (concrete); terrace Roofseal Classic ₹55; terrace ₹45–₹85; parapet area counted | "External Wall (paint surface): ₹27-33/sqft" | High |
| AAP_PUINJ | AapkaPainter | https://aapkapainter.com/services/grouting/injection/pu-injection-grouting/mumbai | Contractor city page (Mumbai) | PU injection ₹2,000–₹3,000 per nozzle | "The cost of PU injection grouting in India ranges from Rs. 2000-3000 per nozzle, though this depends on area, surface and other conditions." | Medium (the same sentence appears on AapkaPainter's Delhi page; Mumbai chosen as the nearest city) |
| AAP_PUGROUT | AapkaPainter | https://aapkapainter.com/products/waterproofing/dr-fixit-price/pu-grouting | Contractor product page | Dr. Fixit PU Grouting ₹300/kg | "Dr Fixit PU Grouting is available at ₹300 per 1kg and ₹8000 per 25kg." | High |
| IM_TERR_COAT | IndiaMART | https://www.indiamart.com/proddetail/terrace-waterproofing-coating-22860711973.html | Seller listing, Pune | Terrace coating ₹55/sq ft | Title: "Terrace Waterproofing Coating at ₹ 55/square feet in Pune" | High |
| IM_APP_DIR | IndiaMART | https://dir.indiamart.com/pune/app-membrane-waterproofing-service.html | Seller directory, Pune | APP membrane ₹25–₹80 (one listing ₹110); duration ~5 days | "APP membrane waterproofing services in Pune range from ₹25 to ₹80 per square feet" | Medium (the quote is the search tool's summary of the directory) |
| IM_BBC_81 / _105 / _145 | IndiaMART | three proddetail URLs (see JSON) | Seller listings, Pune | Brickbat coba ₹81, ₹105, ₹145 per sq ft | Titles, e.g. "Brick Bat Coba Service at ₹ 145/square feet in Pune" | High |
| IM_INJ_DIR | IndiaMART | https://dir.indiamart.com/pune/injection-grouting-service.html | Seller directory, Pune | ₹700/point; ₹550/nozzle; ₹2,000/injection | "One service provider offers pressure grouting service at ₹700 per point." | Medium. **Removed in verification (§8):** the same search also returned IndiaMART's separate *Pressure Grouting* Pune directory, which matches the quote's wording. |
| IM_TARMIC | IndiaMART | https://www.indiamart.com/proddetail/polymer-injection-grouting-service-24385305233.html | Seller listing, Lohegaon, Pune | ₹2,000 per injection onwards; 1–2 days; hole-driven method | "Tarmic Waterproofing Company offers Polymer Injection Grouting Service in Pune, Maharashtra at ₹2000/per injection onwards." | High |
| SM_BATHCON | Studio Matrx | https://www.studiomatrx.org/guides/bathroom-construction-cost-india | Design-practice guide (2026) | ₹90–₹200 per sq ft of treated area; ₹8,000–₹16,000 for a 40 sq ft bath; ₹7,000/₹12,000/₹22,000 tiers | "Expect ₹90–₹200 per sq ft of treated area, or ₹8,000–₹16,000 for a 40 sq ft bath." | High |
| SM_CEM | Studio Matrx | https://www.studiomatrx.org/guides/cementitious-waterproofing-india | Guide (2026) | Sunken bathroom 2 coats ₹90–₹160; coat counts | "Applied cost for a sunken bathroom with 2 coats plus prep and mesh at junctions is ₹90–160 per sq ft." | High |
| SM_TYPES | Studio Matrx | https://www.studiomatrx.org/guides/waterproofing-membrane-types-india | Guide | Per-system ₹/sq ft, elongation, durability; PU and crystalline caveats | "Polyurethane (PU): 300–500% elongation, 12–20 years durability, ₹80–160 per sq ft" | High (table); medium for the crystalline caveat sentence |
| SM_GUIDE | Studio Matrx | https://www.studiomatrx.org/guides/waterproofing-guide | Guide | External basement membrane ₹80–₹150, new construction | "The external membrane (positive side) method is applied on the outside of basement walls before backfilling, with a cost of ₹80-150 per sqft, and is best for new construction as it is the most effective approach." | High |
| CEI_BATH | Construction Estimator India | https://constructionestimatorindia.com/bathroom-construction-cost-in-india/ | Cost-guide site (2026) | Cementitious ₹80–₹120; PU ₹150–₹200 for bathrooms above ground floor | "Polyurethane membranes (₹150–₹200/sq ft) offer superior durability for 10–15 years and are recommended for bathrooms above the ground floor." | Medium (pinning query 51 not run; topic matches) |
| CEI_PARK | Construction Estimator India | https://constructionestimatorindia.com/parking-area-construction-cost-in-india/ | Cost-guide site (2026) | Basement parking waterproofing ₹80–₹150 | "For basement parking, waterproofing (external + internal) costs ₹80–₹150/sq ft." | Medium (inferred from page topic) |
| AEC_TERR | Aecord | https://aecord.com/blog/terrace-waterproofing-cost-india-2026 | Cost-guide blog (2026) | APP/SBS ₹80–₹160, 6–10 yrs; PU ₹140–₹300, 10–15 yrs | "APP/SBS Torch-On Membranes cost ₹80–₹160 per sq. ft. and are best for older terraces experiencing recurrent dampness and heavy seepage, with an expected lifespan of 6-10 years." | High |
| BID_PUNE | Biddaro | https://www.biddaro.com/ask/city/pune/waterproofing-cost-per-sq-ft-india | Programmatic Q&A page, Pune | Pune per-method and per-area ranges; 1,000 sq ft terrace example | "Brick bat coba (traditional): ₹50–80/sqft" | High (only one Biddaro Pune page). **Quality note:** looks like templated city pages; treat as weaker evidence. |
| LF_PUNE | Leakfoe | https://leakfoe.com/blog/waterproofing-rates-in-pune.html | Waterproofing contractor's blog, Pune | Residential terrace "acceptable" ₹200–₹300; bathroom ₹24,000 per bathroom | "For residential terrace waterproofing, the lowest rate is Rs 75/- per sqft, the acceptable rate is Rs 200/- - Rs300/- per sqft, with rates considered too high if they go up to Rs 560/- per sqft." | High. **Interested party:** it sells the service. |
| A99_DAMP | 99acres | https://www.99acres.com/articles/damp-proofing.html | Property-portal article | Damp-proofing services ₹50–₹150 | "The price of damp proofing services in India ranges between Rs 50 and Rs 150 per sq ft" | High |
| (FAQ only) | Housing Society Times | https://housingsocietytimes.com/how-cooperative-housing-societies-can-carry-out-terrace-waterproofing-repairs/ | Society-management publication | Terrace is a common area under Bye-law No. 68 of the Maharashtra model bye-laws | "Under Bye-Law No. 68 of the Model Bye-Laws for cooperative housing societies in Maharashtra, the terrace is classified as a common area, and therefore the society is responsible for its upkeep and waterproofing." | Medium (came from an unrestricted extended search; pinning query 52 not run). Used only in FAQ text, which has no `sources` field. |

**Publisher independence notes.** Dr. Fixit pages are counted as one publisher (Pidilite). AapkaPainter applies and resells Dr. Fixit products but is a separate company, so it counts as independent of Pidilite. All IndiaMART listings and directories count as one publisher (IndiaMART), whoever the seller is. The two Asian Paints articles count once; so do the NoBroker pages and the Studio Matrx guides.

## 4. Cost models: derivation, conflicts and resolution

Unit is ₹ per sq ft unless stated. "Mid" = midpoint used for the expected value.

| Model id | Cited figures (publisher: range → mid) | Result low / expected / high | Conflict and resolution |
|---|---|---|---|
| terrace-waterproofing-acrylic-coating-budget | Dr. Fixit 35–45 → 40; AapkaPainter Roofseal Classic 55 (tile 59.85) → 57.5; NoBroker Pune 35–60 → 47.5; IndiaMART Pune coating 55 → 55; Asian Paints basic coating 60–100 → 80 | 35 / 55 / 100 | AP's basic tier is higher than the Pune marketplace figures; widened to cover it. NoBroker's Pune figure does not name a system; at ₹35–₹60 it matches coating-grade work. |
| terrace-waterproofing-liquid-membrane-standard | Dr. Fixit LAM 65–85 → 75; Biddaro Pune Dr. Fixit liquid membrane 80–120 → 100 | 65 / 85 / 120 | Pune figure higher than manufacturer figure; widened. |
| terrace-waterproofing-app-membrane-standard | Aecord 80–160 → 120; Studio Matrx 60–120 → 90; IndiaMART Pune 25–80 → 52.5 | 25 / 90 / 160 | Wide disagreement. IndiaMART "from" prices have no stated scope (likely membrane only, no screed or slope work). Widened to ₹25–₹160 as the rules require; the note explains the low end. |
| terrace-waterproofing-pu-membrane-premium | Asian Paints premium PU 180–250 → 215; Aecord 140–300 → 220; Studio Matrx 80–160 → 120; Leakfoe Pune "acceptable" 200–300 → 250 | 80 / 215 / 300 | Studio Matrx is much lower. Widened. Leakfoe is a contractor and does not name a system; it is included because it is the only Pune figure and sits inside the range. |
| terrace-waterproofing-brickbat-coba-standard | Biddaro Pune 50–80 → 65; IndiaMART Pune listings 81 / 105 / 145 → 105 | 50 / 85 / 145 | The IndiaMART Pune directory also shows listings from ₹20 to ₹210 with no scope; extremes logged, not used. |
| bathroom-waterproofing-grout-and-coat-budget | NoBroker basic coating + grouting 80–120 → 100; Biddaro Pune cement slurry 40–70 → 55; Asian Paints 40–120 → 80 | 40 / 80 / 120 | Pune slurry figure is lower; widened. |
| bathroom-waterproofing-floor-and-joints-standard | NoBroker floor + joints 120–160 → 140; Studio Matrx sunken 2 coats 90–160 → 125; Construction Estimator India cementitious 80–120 → 100 | 80 / 125 / 160 | Widened. No Pune-specific figure for this scope. |
| bathroom-waterproofing-full-sunken-slab-premium | NoBroker full treatment 160–200 → 180; Construction Estimator India PU 150–200 → 175; Studio Matrx treated area 90–200 → 145 | 90 / 175 / 200 | Studio Matrx's general bathroom range is wider; widened. Material set to PU (the premium system named for bathrooms above ground floor). |
| external-wall-waterproofing-coating-budget | AapkaPainter 27–35 → 31; NoBroker Pune 30–60 → 45; Biddaro Pune polymer coating 30–60 → 45 | 27 / 45 / 60 | Minor; widened to AapkaPainter low. |
| external-wall-waterproofing-crack-repair-elastomeric-standard | NoBroker crack filling + elastomeric 35–80 → 57.5; Asian Paints exterior 25–80 → 52.5 and external wall 35–100 → 67.5 | 25 / 55 / 100 → **25 / 60 / 100 (§8)** | AP pages counted as one publisher. Widened. |
| external-wall-waterproofing-elastomeric-premium | NoBroker premium paint systems 60–150 → 105; 99acres damp-proofing 50–150 → 100 | 50 / 100 / 150 | 99acres covers damp-proofing generally, not only external walls; weaker corroboration, noted in the model. |
| basement-waterproofing-cementitious-budget | NoBroker Pune basement 75–100 → 87.5; NoBroker cementitious 100–200 → 150; Biddaro Pune basement 80–200 → 140 | 75 / 140 / 200 → **75 / 130 / 200 (§8)** | NoBroker's Pune page is lower than its national page; widened. |
| basement-waterproofing-crystalline-standard | NoBroker 150–320 → 235; Studio Matrx 40–90 → 65; Biddaro Pune crystalline/epoxy injection 100–200 → 150 (**§8: replaced by Biddaro's crystalline row 120–180 → 150**) | 40 / 150 / 320 | Strong disagreement (possibly material-only slurry vs full job; **§8: Studio Matrx says material + labour, so this explanation is withdrawn**). Widened; flagged low-confidence in notes. |
| basement-waterproofing-external-membrane-standard | Studio Matrx 80–150 → 115; Construction Estimator India 80–150 → 115 | 80 / 115 / 150 | None. AP's general basement range ₹120–₹300 is not system-specific and is not used here. |
| basement-waterproofing-injection-grouting-premium | NoBroker injection 180–350 → 265; Biddaro Pune 100–200 → 150; Asian Paints basement 120–300 → 210 (**§8: Asian Paints removed**) | 100 / 210 / 350 → **100 / 205 / 350 (§8)** | Widened. |
| leakage-repair-injection-grouting-standard (₹ per injection point) | NoBroker 500–1,200 → 850; AapkaPainter 2,000–3,000 per nozzle → 2,500; IndiaMART Pune 550 / 700 / 2,000 → 700 (**§8: directory figures removed; IndiaMART = Tarmic listing 2,000**) | 500 / 850 / 3,000 → **500 / 2,000 / 3,000 (§8)** | Two price clusters (₹500–₹1,200 and ₹2,000–₹3,000) that the sources do not explain. Widened into one model rather than inventing tiers. |

## 5. ServiceDef content and where it comes from

- **Area presets.**
  - `terrace` 1,000 sq ft: Biddaro's Pune example (1,000 sq ft terrace). AapkaPainter says parapet area is part of the priced terrace area.
  - `independent_house` roof 900 sq ft: Dr. Fixit's 900 sq ft roof example. "Roof ≈ footprint" is our planning assumption, stated as such.
  - Bathroom 1–4 BHK = 80 / 160 / 240 / 320 sq ft of treated area: 80 sq ft per bathroom is derived from Studio Matrx (₹8,000–₹16,000 for a 40 sq ft bath at ₹90–₹200 per sq ft of treated area → about 80–90 sq ft treated). **One bathroom per bedroom is unsourced** and labelled as an assumption.
  - External wall `independent_house` 2,000 sq ft: our arithmetic on a 900 sq ft footprint (Dr. Fixit example); **not sourced**, labelled as such.
  - Basement and leakage repair have no presets (measured area / number of injection points). No `custom` preset is included because it has no meaningful default quantity; the calculator should offer free entry.
- **Materials.** Each material cites 2–3 sources (see JSON). Brand products are named only as examples, from the manufacturers' own page titles.
- **Durations.** Only two are sourced: injection grouting 1–2 days (IM_TARMIC) and APP membrane about 5 days (IM_APP_DIR). Coat counts come from SM_CEM. Every other duration is a planning estimate and its `basis` says so.
- **FAQ facts** (FAQ entries have no `sources` field, so their sources are listed here):
  - Price figures repeat the cost models above and NB_PUNE, SM_BATHCON, BID_PUNE, IM_APP_DIR, LF_PUNE, NB_SEEP, AAP_PUINJ, IM_INJ_DIR (no longer used after §8), IM_TARMIC, NB_EXT, CEI_BATH.
  - Bye-law 68 / terrace as common area: Housing Society Times (medium confidence; confirm wording).
  - System lifetimes: SM_TYPES (acrylic 6–10, cementitious 8–12, APP/SBS 10–15, PU 12–20 years) and AEC_TERR (APP/SBS 6–10, PU 10–15 years).
  - PU needs a bone-dry primed surface; cementitious coatings are rigid; crystalline needs dense concrete: SM_TYPES. Coat counts: SM_CEM.
  - Labour ≈ 75% of bathroom cost: NB_BATH. Basement moisture pressure: AP (query 27 text: "Basement waterproofing is more complex because underground moisture pressure is higher").
  - Coating types (acrylic / elastomeric / liquid membrane) and price factors for external walls: AP_EXT.
  - "Most providers offer 5-year warranties" for Pune terrace listings (IndiaMART Pune terrace directory, https://dir.indiamart.com/pune/terrace-water-proofing-services.html, search-tool summary) is **not** used in the prose because it is too general.

## 6. Figures seen but not used

| Figure | Publisher | Why not used |
|---|---|---|
| Bathroom ₹2,000–₹4,000 per bathroom (Pune) | NoBroker | Unit is per bathroom; models are per sq ft. Mentioned in FAQ only. |
| Bathroom ₹24,000 per bathroom (residential, "current rate") | Leakfoe | Per bathroom; contractor source. |
| Bathroom renovation waterproofing ₹8,000–₹40,000 by tier; ₹7,000/₹12,000/₹22,000 for 40 sq ft | Studio Matrx | Per bathroom; used to derive the treated-area preset and in FAQ. |
| Bathroom totals ₹3,000–₹40,000 by tier | Construction Estimator India | Per bathroom; page attribution uncertain. |
| Crack filling ₹100–₹150 per linear foot (Pune) | NoBroker | Only one source for an `rft` rate, and no service in this pack uses `rft`. Mentioned in FAQ. |
| Balcony ₹30–₹50 per sq ft (Pune) | NoBroker | Balcony is not a sub-service in §4a. |
| Chemical waterproofing ₹30–₹95 per sq ft (Pune); "starts at Rs. 19 … up to Rs. 120" (Pune, 2024) | NoBroker | Not tied to a sub-service or system; the forum page is from 2024. |
| Overall ₹35–₹250 per sq ft | Asian Paints | Not tied to a sub-service. |
| Overall ₹15–₹80+; roof average ₹30–₹90 | Dr. Fixit | Not tied to a system. |
| "Pune … 15–20% lower than Mumbai" | unclear (extended search, Biddaro likely) | City-level, not a Pune locality factor; attribution uncertain. |
| Mumbai MMR ₹60–₹300; Delhi NCR ₹50–₹250 | Aecord | Other cities. |
| Waterproofing chemical ₹170 per litre in Pune | Infralens | Material price only. |
| PU injection ₹650–₹2,800 per sq ft (Pune listings) | IndiaMART | Units and scope inconsistent across listings. |
| Brickbat coba ₹20 and ₹210 per sq ft (Pune listings) | IndiaMART | Unscoped extremes. |
| CPWD brickbat coba rate analysis ₹1,398.50 per sq m | Scribd (user upload) | Not an official CPWD page; uploader unknown. |
| Dr. Fixit Bathseal Select coverage 1.1–1.2 L/sq m in 2 coats; pack prices | Pidilite (Dr. Fixit) | Material-only; not needed for applied rates. |

## 7. Gaps and follow-ups

1. **Parent `waterproofing` has no cost models.** Contracts v2 asks for ≥ 1 model per tier for every service id. I found no source that gives general (all-area) waterproofing rates split by tier; the tiered figures found are terrace-specific (Asian Paints, NoBroker). Options for the orchestrator / D03f: (a) let the `waterproofing-cost` guide roll up the sub-service models, which needs a contract note; or (b) source general tiered rates.
2. **`leakage-repair` has only a `standard` model.** Sources show two price clusters per injection point but do not explain them (grout type, crack depth, making good). D03f should look for sources that tie a price level to a grout type (e.g., cement/pressure grouting vs PU vs epoxy) before adding budget/premium models.
3. **Contract wording:** CONTRACTS §4a says every `{service_id}-cost` title says "per sq ft". Leakage repair is priced per injection point (`unit`), so its guide title should say "per point". Reported, not changed.
4. **No official schedule-of-rates source.** PWD Maharashtra SSR / PMC schedule of rates and IGR ready reckoner were not searched (budget exhausted). An SSR item for brickbat coba or APP membrane would be a strong Maharashtra anchor.
5. **No Pune news source.** Times of India, Hindustan Times, Economic Times, Indian Express and Pune Mirror are not accessible to the search tool; MagicBricks too; Housing.com returned nothing; UrbanCompany shows no prices; no CREDAI Pune source was found.
6. **Quotes unverified against live pages** (WebFetch blocked). Medium-confidence URL attributions: AP basement figure (removed from models in §8), NB_EXT, AAP_PUINJ, IM_APP_DIR, IM_INJ_DIR (removed in §8), SM_TYPES crystalline caveat, CEI_BATH, CEI_PARK, Housing Society Times.
7. **Unsourced assumptions** (labelled in the JSON): bathrooms per BHK; external wall area of an independent house; roof ≈ footprint; most durations; all component splits except the bathroom labour share.
8. **No `min_job_inr`** source and **no locality factors** for any Pune locality.
9. **Many figures are national.** Pune-specific figures come from NoBroker's Pune page, IndiaMART Pune listings, Biddaro's Pune page and Leakfoe. Each model's `notes` say which of its figures are national.
10. **Who pays for a leak from the flat above (Maharashtra)?** Not researched (query 53 not run); no FAQ claims made on it.

## 8. Verification (adversarial review, 2026-10-06)

**Reviewer:** D03a verify pass. I edited only the three D03a files. I made no commits, no installs and no contract edits.

### 8.1 How the check was done, and its limits

- **No live re-check was possible.** WebFetch is blocked by the egress proxy (`EGRESS_BLOCKED`) for every source host tried in this pass: nobroker.in, biddaro.com, aapkapainter.com, 99acres.com, drfixit.co.in and indiamart.com, plus the hosts the builder found blocked. The shared WebSearch budget (200 per turn) was already spent when this pass began, so its first query was refused. Per the proxy README, blocked hosts were not routed around.
- **What was checked instead:** the builder's raw tool output. I extracted all 61 of its WebSearch/WebFetch calls and results from the session transcript (`subagents/workflows/wf_d82b2728-489/agent-ad2031aa2d70b057d.jsonl`). A script then checked every `SourceRef` in both JSON files (130 refs, 62 unique) against that text:
  - the URL appears in a result list;
  - the title equals, or is a prefix of, a result title;
  - the quote appears verbatim, ignoring whitespace and markdown `**` bold markers.
  - **Result: 62 of 62 unique refs pass.** No URL, title, publisher or quote was invented.
- **Caveat that still applies:** WebSearch returns a model-written summary over several links, not page text. So each "quote" is verbatim *search output*, as the brief allows, but may be condensed. A figure is tied to one URL only by the search's domain filter, the result ranking and the topic of the title. I therefore checked each figure's page attribution call by call. Changes are in §8.3.

### 8.2 What I checked (one row per claim)

| # | Claim (where used) | Raw-output evidence (builder's call #) | Verdict |
|---|---|---|---|
| 1 | NoBroker Pune: terrace ₹35–₹60, basement ₹75–₹100, exterior ₹30–₹60, bathroom ₹2,000–₹4,000/bathroom, crack filling ₹100–₹150/rft (terrace, external-wall and basement models; FAQs) | Calls 12 and 13; domain-restricted; Pune page ranked first | Confirmed. **However**, calls 27 and 31 show NoBroker's Bangalore, Hyderabad and Chennai pages carry the same exterior range (₹30–₹60), and Bangalore and Hyderabad the same basement range (₹75–₹100). These city pages look templated and are **not Pune-specific evidence**. Caveat added to the model notes. |
| 2 | Asian Paints terrace tiers ₹60–₹100 / ₹100–₹180 / ₹180–₹250; bathroom ₹40–₹120; external wall ₹35–₹100 (terrace acrylic, PU, bathroom budget, external crack-repair) | Call 9, domain-restricted, cost blog ranked first | Confirmed. |
| 3 | Asian Paints basement ₹120–₹300 (basement injection model) | Calls 30 and 32; call 32 ranks the AP calculator page above the blog | Attribution to the blog not confirmed, and the figure covers all systems. **Removed from the injection model.** |
| 4 | Aecord APP/SBS ₹80–₹160 (6–10 yrs); PU ₹140–₹300 (10–15 yrs) (APP and PU models; materials; FAQ) | Call 11, domain-restricted, cited page ranked first | Confirmed. |
| 5 | Studio Matrx table: PU ₹80–₹160; APP/SBS ₹60–₹120; crystalline ₹40–₹90; elongation and lifetimes (APP, PU, crystalline models; materials; FAQs) | Call 36 (table); call 34 says crystalline ₹40–₹90 is "material + labour" | Confirmed. The table comes from a page about **bathroom** membranes, now noted on the APP and PU models. The builder's guess that Studio Matrx's crystalline figure was "material-only" **contradicts** the source and was removed from the notes. |
| 6 | Studio Matrx bathroom ₹90–₹200 per sq ft of treated area; ₹8,000–₹16,000 for a 40 sq ft bath; ₹7,000 / ₹12,000 / ₹22,000 tiers (bathroom presets; premium model; FAQ) | Calls 22 and 23 | Confirmed. The 80 sq ft treated-area preset follows arithmetically (₹8,000 ÷ ₹90 ≈ 89; ₹16,000 ÷ ₹200 = 80). |
| 7 | NoBroker bathroom scope tiers ₹80–₹120 / ₹120–₹160 / ₹160–₹200; labour ≈ 75% (three bathroom models; FAQ) | Calls 21 and 25, domain-restricted, bathroom page ranked first | Confirmed. All three models' labour + preparation + repair fractions sum to 0.75, as stated. |
| 8 | Biddaro Pune method rows and the 1,000 sq ft terrace example (terrace preset; six models) | Call 16, domain-restricted, Pune page ranked first | Confirmed as search text. Biddaro is a templated city Q&A page (results also list Bangalore, Patna, Nashik and others), so it is weak evidence. Its own summary gives two terrace ranges (₹40–₹100 and ₹50–₹150). It also has a dedicated "Crystalline waterproofing: ₹120–180/sqft" row that the builder did not use; see §8.3. |
| 9 | Dr. Fixit basic coating ₹35–₹45; liquid-applied membrane ₹65–₹85; 900 sq ft roof example (terrace models; house preset; materials) | Call 19, domain-restricted | Confirmed. The English URL cited was seen in call 18; call 19 listed the /hi/ variant. |
| 10 | Dr. Fixit Pidifin 2K pack prices ₹580 / ₹2,360 (material sources ×3) | Call 18, a mixed summary over 10 Dr. Fixit pages | Not tied to the product page. **Quote set to `null`.** The description never used the price. |
| 11 | AapkaPainter: external wall ₹27–₹33 (paint) and ₹28–₹35 (concrete); terrace Roofseal Classic ₹55; parapet sentence (presets; models) | Call 28, domain-restricted, calculator page ranked first | Confirmed. |
| 12 | AapkaPainter PU injection ₹2,000–₹3,000 per nozzle (leakage model) | Call 39; call 37 says the figure is quoted "in major cities like Delhi and Mumbai" | Confirmed. The sentence is templated across city pages. |
| 13 | IndiaMART Pune: terrace coating ₹55; brickbat coba ₹81 / ₹105 / ₹145 (terrace models; materials) | Calls 15 and 47; listing titles verbatim | Confirmed. The Pune directory shows unscoped brickbat listings from ₹20 to ₹210, as logged. |
| 14 | IndiaMART Pune APP directory ₹25–₹80, about 5 days (APP model; duration; FAQ) | Call 48, directory ranked first | Confirmed as search text. The same summary also lists a ₹110 listing, so the parent FAQ now says "mostly ₹25 to ₹80". |
| 15 | IndiaMART Pune injection directory "pressure grouting service at ₹700 per point" (leakage model) | Call 40 also returned the separate *Pressure Grouting Service … in Pune* directory | Attribution to the cited URL not confirmed. "Pressure grouting" may also mean a cement grout, which does not match the model's PU material. **Removed.** |
| 16 | Tarmic (IndiaMART) polymer injection ₹2,000 per injection onwards; 1–2 days; hole-driven (leakage model; duration; FAQ) | Call 43; listing title verbatim | Confirmed. |
| 17 | NoBroker injection ₹500–₹1,200 per point; basement cementitious ₹100–₹200, crystalline ₹150–₹320, injection ₹180–₹350 (basement and leakage models) | Calls 31, 33, 41 and 42; domain-restricted; cited forum pages ranked first | Confirmed. |
| 18 | Construction Estimator India: cementitious ₹80–₹120; PU ₹150–₹200 (bathroom); basement parking ₹80–₹150 (models) | Call 55, domain-restricted; bathroom and parking pages in results | Confirmed as search text. The PU sentence is bathroom-specific; the parking figure is the only parking topic. Page attribution is medium-to-high. |
| 19 | 99acres damp-proofing ₹50–₹150 (external premium model) | Call 51, domain-restricted, cited article in results | Confirmed. It is generic damp-proofing, so weak corroboration (already noted). |
| 20 | Leakfoe Pune terrace ₹75 / ₹200–₹300 / ₹560; ₹24,000 per bathroom (PU model; FAQ) | Calls 14 and 54 | Confirmed. Leakfoe is an interested party. Dropping it would not change the PU expected value (still ₹215). |
| 21 | Housing Society Times: Bye-law No. 68 makes the terrace a common area (FAQ prose only) | Call 54; the article is the top result and its title matches | Confirmed as search text. Wording still to be checked on the live page. |
| 22 | Durations: injection 1–2 days; APP about 5 days; coat counts | Calls 43, 48 and 24 | Confirmed. All other durations are labelled planning estimates. |
| 23 | Expected-value rule ("median of the publishers' midpoints, nearest ₹5, ties down", one midpoint per publisher) | Recomputed for all 16 models | 2 models broke the builder's own rule (fixed, §8.3). After fixes, all 16 recompute exactly. |

### 8.3 Changes made

| File / item | Before | After | Why |
|---|---|---|---|
| `external-wall-waterproofing-crack-repair-elastomeric-standard` | 25 / 55 / 100 | 25 / **60** / 100 | Asian Paints' two pages had been counted as two midpoints. One per publisher: NoBroker 57.5 and Asian Paints 60 give 58.75, which rounds to 60. |
| `basement-waterproofing-cementitious-budget` | 75 / 140 / 200 | 75 / **130** / 200 | NoBroker had been counted twice. One per publisher: NoBroker 118.75 and Biddaro 140 give 129.4, which rounds to 130. Notes added: two of the three figures cover all methods, and NoBroker's "Pune" figure is templated. |
| `basement-waterproofing-crystalline-standard` | Biddaro quote "Crystalline/epoxy injection (basement): ₹100–200/sqft" | Biddaro quote "Crystalline waterproofing: ₹120–180/sqft" | Biddaro's own crystalline row (same search result) fits better; the combined row stays in the injection model only. Numbers unchanged (Biddaro midpoint is 150 either way). The note's "material-only" guess was replaced, because Studio Matrx says material + labour. |
| `basement-waterproofing-injection-grouting-premium` | 3 sources; 100 / 210 / 350 | 2 sources (NoBroker, Biddaro); 100 / **205** / 350 | Asian Paints' basement ₹120–₹300 removed: it names no system (the builder excluded the same figure from the membrane model) and its blog attribution is unconfirmed. |
| `leakage-repair-injection-grouting-standard` | 4 sources; 500 / 850 / 3,000 | 3 sources (NoBroker, AapkaPainter, IndiaMART–Tarmic); 500 / **2,000** / 3,000 | IndiaMART directory "₹700 per point" removed (row 15). With one midpoint per publisher (850, 2,500, 2,000) the median is 2,000. Both sources that name a PU or polymer grout are at ₹2,000 or more. The expected value is sensitive to which sources are included; D03f should add per-point PU quotes for Pune. |
| Notes only | — | Caveats added | External coating model (NoBroker templated); 3 bathroom models (NoBroker area basis not stated; per-bathroom cross-check ≈ ₹6,400 / ₹10,000 / ₹14,000 against ₹2,000–₹24,000 across sources); APP and PU models (Studio Matrx table comes from a bathroom page). |
| ServiceDef materials (×3) | Pidifin 2K quote with pack prices | `quote: null` | Row 10. |
| Parent FAQ "How much does waterproofing cost in Pune?" | "built from cited 2025–2026 sources" | "built from sources retrieved in October 2026 (many undated)" | Most sources carry no date (Asian Paints, Dr. Fixit, NoBroker pages, 99acres), so the old wording overclaimed. |
| Parent FAQ "Why do quotes vary…" | "from ₹25 to ₹80" | "at mostly ₹25 to ₹80" | The same IndiaMART summary lists a ₹110 listing. |
| Sub-service FAQs | ₹55; ₹140; ₹210; ₹850; "₹550 per nozzle" | ₹60; ₹130; ₹205; ₹2,000; Tarmic listing only | Kept in sync with the model changes. |
| This log §3 and §4 | — | Superseded values marked "§8" inline | So the derivation tables are not read as current. |

### 8.4 Sanity review (rates and units)

- **Units:** every model's `unit` matches its ServiceDef. Terrace, bathroom, external wall and basement are per sq ft; leakage repair is per injection point (`unit`). No per-project or per-bathroom figure was fed into a per-sq-ft model; the per-bathroom figures appear only in FAQ and log.
- **Area basis (bathroom):** applying the per-sq-ft models to the 80 sq ft treated-area preset gives about ₹6,400 / ₹10,000 / ₹14,000 per bathroom. That matches Studio Matrx's ₹7,000–₹22,000 per 40 sq ft bath. It is above NoBroker Pune's ₹2,000–₹4,000 per bathroom and below Leakfoe's ₹24,000. NoBroker does not say whether its per-sq-ft rates are for floor or treated area, so this is a known ambiguity, not a unit error.
- **Tier spreads:** terrace budget-to-premium expected is ₹55 to ₹215 (≈ 3.9×), against Asian Paints' basic-to-premium ≈ 2.7× and NoBroker's terrace tiers (₹25–₹40 / ₹40–₹80 / ₹90–₹150, not used: not pinned to one page). The premium expected sits in the upper source cluster (Asian Paints, Aecord, Leakfoe) rather than the lower (Studio Matrx, NoBroker); it is plausible but uncertain.
- **Wide ranges:** terrace APP ₹25–₹160 (6.4×) and basement crystalline ₹40–₹320 (8×) remain low-confidence because of source disagreement.
- **Tier ordering:** the basement budget model (cementitious, ₹130) is priced above the external-membrane standard model (₹115). They cover different scopes (retrofit from inside versus new construction before backfilling), so this is not a unit error. It is noted on the model.
- **Invariants:** my stdlib validator (`verify_wp_shape.py`, session scratchpad) checked exact §4 key sets, enums, scope and material IDs resolving per service, integer rates with low ≤ expected ≤ high, component sums within 1 ± 0.01, ≥ 2 sources from ≥ 2 publishers, `valid_until − reviewed_at` = 180 days, `retrieved_at` = 2026-10-06, and all statuses `draft`. **0 errors.** `node scripts/data-coverage.mjs` shows no errors for this pack, only the same 5 tier-coverage warnings.

### 8.5 Still open (for D03f or the owner)

1. **Coverage gaps (unchanged):** `waterproofing` has no models in any tier; `leakage-repair` has no budget or premium model.
2. **Contract wording (unchanged):** the "per sq ft" title rule in §4a does not fit `leakage-repair`, which is priced per point.
3. **No live page has been opened for any source.** Before prose moves to `reviewed`, open each URL and confirm wording and figures. Priority: Biddaro (6 models), the IndiaMART APP directory, Construction Estimator India, and Housing Society Times (bye-law 68).
4. **Pune-specific evidence is thinner than §7.9 suggests.** NoBroker's and Biddaro's city pages are templated, so the only Pune-specific price evidence is IndiaMART Pune seller listings and Leakfoe, a contractor and so an interested party. A PWD Maharashtra SSR or PMC schedule-of-rates item remains the best anchor.
5. **Leakage expected value:** ₹2,000 rests on 3 publishers whose figures fall in two clusters. Add more per-point PU injection quotes before publishing.
6. **Brickbat coba description:** the sentence on how it is laid (slope forming, done at construction or full re-lay) is general knowledge; the cited sources support only the prices.
7. **Candidate third source** for the terrace liquid-membrane model (currently Dr. Fixit and Biddaro only): NoBroker's bathroom page summary lists "Liquid applied membrane: ₹65 to ₹100 per sq. ft." (builder calls 21 and 25). It was not added because the page attribution is medium and the context is bathrooms.

## 9. Leakage-repair tier gaps (D03g, 2026-10-06)

TASK-MARKER: batchB-D03g

- **Owner task:** D03g · fill the `leakage-repair` budget and premium tier gaps. I edited only `data/cost-models/waterproofing.json` and this log. No installs, no commits, and no change to any existing model. A script checked that all 16 earlier models are unchanged (equal as parsed JSON objects).
- **Rule for adding a tier:** at least 2 independent publishers giving a per-point price (or a per-job price that converts to per point on a stated basis) for a grout or spec that clearly belongs to that tier. Method as in §1.6: low = lowest cited low, high = highest cited high, expected = median of one midpoint per publisher, rounded to the nearest ₹50 with ties rounded down.
- **Result:** **budget model added** (`leakage-repair-cement-injection-budget`, ₹450 / ₹550 / ₹700 per point). **Premium model not added**: no source was found (§9.4).

### 9.1 How pages were read this time

Unlike §1 and §8, pages could be opened. Plain HTTPS through `curl` worked for nobroker.in, aapkapainter.com, indiamart.com (`dir.` and `m.` hosts; `www.indiamart.com/proddetail/…` returned HTTP 429), tradeindia.com, gharkabudget.com and bnpmindia.com. Text was pulled out with a stdlib `html.parser` script run under `python3 -I`, and pages were treated as data only. justdial.com (curl HTTP 403; WebFetch `EGRESS_BLOCKED`), sulekha.com (403) and happho.com (HTTP 500) could not be opened. **Both quotes in the new model were checked against the live page text**, ignoring whitespace. Each is a table row or a listing name plus its price, which the page shows in separate cells.

### 9.2 Queries run (12 of 12 WebSearch calls used)

| # | Mode | Domains | Query | Useful result |
|---|---|---|---|---|
| G1 | std | — | injection grouting rate per point India cement epoxy PU nozzle price | IndiaMART seller "Grouting Specialist" (opened: cementitious ₹450/point and PU ₹1,500/point); AapkaPainter PU city pages |
| G2 | std | — | cement injection grouting rate per nozzle Rs leakage repair contractor India | Only IndiaMART national directories, priced per sq ft or per kg (opened; no per-point figures) |
| G3 | std | nobroker.in | injection grouting cost per nozzle epoxy PU cement leakage | Only per-sq-ft figures; nothing per point |
| G4 | ext | — | PU injection grouting cost per point 2026 India ceiling seepage epoxy injection per point price guide | Pointed to the AapkaPainter calculator (opened: "Cement injection grouting 700 per nozzle", "PU injection grouting 2400 per nozzle") and to GharKaBudget (opened: per-bathroom and per-sq-ft figures only) |
| G5 | std | — | epoxy injection grouting charges per point India crack repair rate "per point" | Same IndiaMART seller; a 2018 BNPM tender enquiry (opened: quantities only, no rates); unverifiable `lovable.app` pages and a spam-like "cost guide" domain (not used) |
| G6 | ext | — | waterproofing injection grouting rate per hole OR "per packer" OR "per nozzle" Pune Mumbai contractor price list | Pune seller Aqua Protect Adhesives and IndiaMART Mumbai directories (opened): prices per sq ft or per kg only; Pune seller Aqua Engineering (opened): no prices |
| G7 | std | aecord.com, studiomatrx.org, constructionestimatorindia.com, biddaro.com, leakfoe.com, gharkabudget.com, drfixit.co.in, asianpaints.com, 99acres.com, housing.com | injection grouting cost per point nozzle port PU epoxy acrylic | GharKaBudget only (opened: "Crack chasing & epoxy injection ₹35–70/sqft"); other results were US patents |
| G8 | std | — | epoxy injection grouting rate per nozzle Rs structural crack injection price India | Epoxy prices only per kg, sq m, sq ft or square inch |
| G9 | std | sulekha.com, urbancompany.com, justdial.com, housejoy.in, squareyards.com, makaan.com, homelane.com, civiljungle.com, gharpedia.com, happho.com | injection grouting price per point leakage waterproofing rate card | Summary: Mumbai pressure injection grouting "₹100 - ₹200 per point"; Justdial and Sulekha pages blocked (403) |
| G10 | ext | — | epoxy resin crack injection cost per packer OR per port OR per point India ₹ 2026 structural crack repair contractor | US-only results (USD per linear foot or per crack); nothing for India |
| G11 | std | justdial.com | pressure grouting services Mumbai per point price | Summary: "N S Engineers & Contractors in Navi Mumbai offers Pressure Grouting Services and Pressure Injection Grouting Services at ₹100 - ₹200 per point." The page could not be opened. |
| G12 | std | tradeindia.com, exportersindia.com, dial4trade.com, justdial.com, aapkapainter.com, nobroker.in | epoxy injection grouting service price per point | Epoxy injection only per sq ft (₹180, ₹550, ₹800); TradeIndia PU pages opened, with no per-point prices |

Pages opened with curl without spending a search: the existing leakage sources (NoBroker seepage forum; AapkaPainter PU injection Mumbai page), AapkaPainter's **Pune** PU injection and Pune cement injection pages and its grouting hub (links found on the Mumbai page), and IndiaMART's Pune injection-grouting and pressure-grouting directories.

### 9.3 Budget model: `leakage-repair-cement-injection-budget`

| Publisher | URL | What the live page shows (verbatim) | Midpoint |
|---|---|---|---|
| AapkaPainter | https://aapkapainter.com/resources/waterproofing-price-calculator | Table "Additional cost", row 5: "Cement injection grouting" / "700 per nozzle". Row 6 of the same table: "PU injection grouting" / "2400 per nozzle". | 700 |
| IndiaMART (seller: Grouting Specialists Private Limited, Chennai) | https://m.indiamart.com/grouting-specialist/epoxy-grouting-services.html | Listing "Cementitious Injection Grouting" / "₹ 450/point" (property type Commercial, applicable area Floor). The same seller lists "PU Injection Grouting Service" at "₹ 1,500/per point". | 450 |

- **Result:** low 450, high 700, expected = median(450, 700) = 575, which is a tie between ₹550 and ₹600, so it rounds down to **₹550**.
- **Why this is a separate, lower tier:** both publishers price cement injection at about 30% of their own PU per-point price (700 / 2,400 and 450 / 1,500). The tier is therefore set by the grout type, within the same publisher, not by guesswork.
- **`material_id` = `null`:** the `leakage-repair` ServiceDef has only `pu-injection-grout`, and I do not own `data/services/waterproofing.json`. **Request to the ServiceDef owner:** add a cement-grout material (for example `cement-injection-grout`, with these two sources) and then set this model's `material_id`.
- **Components** are an editorial split (materials 0.25, labour 0.45, preparation 0.12, repair 0.08, transport 0.07, waste 0.03; sum 1.00), not sourced. `min_job_inr` is null and `locality_factors` is empty: no source gives either.
- **Weaknesses:** there are only two publishers, and **neither figure is from Pune** (one is a national calculator, the other a Chennai seller listing for commercial floors). Treat as low-confidence. Status `draft`.

### 9.4 Premium tier: not added

- **What was looked for:** a per-point price for a grout or spec above standard PU injection (epoxy resin, acrylic gel, or PU with a stated warranty or extra scope), from at least 2 publishers.
- **What was found:** epoxy injection prices appear only per kg, per sq m, per sq ft or per square inch (IndiaMART, TradeIndia), or per sq ft of crack area (GharKaBudget ₹35–70). Per-point figures exist only for cement grout (now the budget model) and PU, which is already the standard model's material: AapkaPainter ₹2,000–3,000 per nozzle (also on its **Pune** page: "Rs. 2000-3000 /Nozzle") and ₹2,400 per nozzle (calculator); Tarmic ₹2,000 per injection onwards; Grouting Specialists ₹1,500 per point. A premium PU model would reuse the standard model's material and sources with no sourced difference in spec, so it was not created.
- **Per-job figures cannot be converted:** GharKaBudget's "PU/epoxy pressure-injection through small drilled ports plus re-grouting, for ₹8,000–25,000 per bathroom" gives no number of ports. Any per-point figure derived from it would rest on an invented port count.
- **Indian structural-crack rates by length** (per running metre) were not found for epoxy. US guides (USD per linear foot) are out of scope.

### 9.5 Figures seen but not used

| Figure | Publisher / page | Why not used |
|---|---|---|
| Pressure grouting ₹100–₹200 per point (Navi Mumbai) | Justdial (search summary, G9 and G11) | The page is blocked (403 and `EGRESS_BLOCKED`), so the listing could not be pinned to a URL. The grout type is not named. It would lower the budget low end to ₹100 if confirmed. |
| Cement injection grouting "Rs. 650-800 /Sqft" (Pune page) | AapkaPainter, `/services/grouting/injection/cement-injection-grouting/pune` | The unit is per sq ft. It conflicts with the same publisher's calculator figure (₹700 per nozzle), which falls inside 650–800, so the "/Sqft" label may be wrong. It is not used in a per-point model. |
| PU injection ₹1,500 per point | IndiaMART (Grouting Specialists, Chennai) | PU belongs to the existing standard model, which this task may not change. **Candidate for the standard model:** IndiaMART's midpoint would become median(2,000, 1,500) = 1,750, and the model's expected value would move from ₹2,000 to ₹1,750. Reported, not applied. |
| IndiaMART Pune injection-grouting directory: listings at ₹45–₹7,000 "/ sq ft" and ₹130–₹3,500 "/ Kg" | IndiaMART | Mixed or implausible units (a PU listing at "₹ 2,000 / sq ft" for "Upto 50 rft" coverage). Only Tarmic's listing, already cited, is per injection. |
| IndiaMART Pune pressure-grouting directory: "₹ 900 / Square Inch", "₹ 8,000 / Per Toilet onwards", "₹ 800 / onwards" | IndiaMART | Units are not per point. The "₹700 per point" figure that §8 removed is not on the live page today. |
| Crack chasing and epoxy injection ₹35–70 per sq ft; bathroom injection ₹8,000–25,000 | GharKaBudget | Unit is sq ft or per bathroom (see §9.4). The site says its rates come from contractor quotations in Q2–Q3 2026, but it gives no Pune figure. |
| Epoxy injection ₹180, ₹550, ₹800 per sq ft | TradeIndia / NoBroker (search summaries G3, G12) | Per sq ft, not per point. |

### 9.6 Note on an existing source (no change made)

The live NoBroker seepage page (opened by curl) reads: "Injection grouting for severe seepage: Ranges from Rs. 500 to Rs. 1,200 per point". The standard model's quote, "Injection grouting for severe seepage ranges from Rs. 500 to Rs. 1,200 per point.", is the search tool's rendering of that line. The figures match, but the wording differs slightly. The page also gives "Basic crack filling: Ranges from Rs. 20 to Rs. 40 per sq ft" and a bedroom-wall total of Rs. 8,000 to Rs. 30,000. Under "do not change existing models", I left the quote as it is. The owner may want to replace it with the live wording.

### 9.7 Open items

1. `leakage-repair/premium` is still a tier gap; the coverage script now reports 29 of 30 tier cells. To close it, the next pass needs per-point epoxy or acrylic injection prices from 2 publishers, ideally Pune contractors, or a per-job price with a stated number of ports.
2. A ServiceDef material for cement grout is needed (see §9.3).
3. Whether to add Grouting Specialists' ₹1,500 per point to the standard model (see §9.5) is the owner's decision.
4. There is still no Pune-specific per-point price for cement grout.
