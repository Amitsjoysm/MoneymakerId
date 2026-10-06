TASK-MARKER: retryA-painting

# Research log: painting service pack (D03, retry A)

- **Owner task:** D03 · Service pack `painting` (sub-services `interior-painting`, `exterior-painting`)
- **Files:** `data/services/painting.json`, `data/cost-models/painting.json`, this log
- **Researched:** 2026-10-06 (all `retrieved_at` = `2026-10-06`; `reviewed_at` = `2026-10-06`; `valid_until` = `2027-04-04`)
- **Status:** everything is `draft`; prose needs owner review before it can render on an indexable page.
- **Previous draft:** the task brief mentioned hedged ServiceDef prose from a blocked run, but no painting files existed in the working tree or git history (`git log --all -- data/services/painting.json` is empty). The pack was written from scratch.

## 1. Method and constraints

1. **WebSearch only.** WebFetch was refused by the egress proxy (`EGRESS_BLOCKED`) for `www.nobroker.in` and `aapkapainter.com`; no page was opened directly. Every quote is copied from the WebSearch tool output received in this session (result titles or the result text the tool returned). Bold markers (`**`) in the tool output were dropped; otherwise quotes are character-for-character.
2. **Attribution by domain-restricted search.** Most queries used `allowed_domains` set to one publisher, so the publisher of each figure is certain. The tool does not say which result page each sentence came from, so the page URL is the returned result whose title matches the figure's topic, usually the first result. Page confidence is graded in §3. Where the same URL appeared under two titles (AapkaPainter's calculator showed "Painting Cost Calculator: Rs/Sq Ft Rates for 1, 2, 3 BHK" in query 12 and "House Painting Cost Calculator: Free Per Sq Ft Estimate 2026" in queries 13, 14, 24, 28, 39 and 40), the more frequent title is used.
3. **Search budget.** 42 WebSearch calls of the 50 allowed. The tool retried internally on two calls (query 17 showed three "No links found" attempts; query 31 showed two result blocks), so the shared counter may have moved by up to 45.
4. **Unit.** Every model is per sq ft of **paintable area** (wall and ceiling surface for interiors; wall surface for exteriors), labour and material included unless the note says otherwise. No model mixes labour-only and all-inclusive figures. Labour-only rates are reported in §5 and in the FAQ only.
5. **Rules applied to every model:**
   - `low` = lowest cited low; `high` = highest cited high (ranges widened to cover every cited figure).
   - `expected` = median of the cited publishers' midpoints, rounded to the nearest ₹1 with ties rounded down. A single figure ("₹9", "starts at ₹13") counts as its own midpoint. When one publisher gives several figures, its own median is used, so each publisher counts once.
   - Two sources count as independent only if publishers differ.
   - `components` are an editorial split for the calculator, not taken from a source. They are anchored to Asian Paints ("material takes around 55% to 65% of the total budget, while labour usually covers the remaining 35% to 45%") and HomeTriangle ("Labour is typically ₹4–₹12 per sq ft, or 30–55% of the all-in rate"). Budget grades give labour a larger share, in line with NoBroker's rule that labour is about 3/2 of material cost; luxury grades give materials a larger share, following Asian Paints' note that on premium jobs the paint becomes the bigger expense. Scaffolding has no component of its own and is counted under labour and transport.
   - `min_job_inr` = `null` everywhere: no source states a minimum job value (Urban Company's "₹2,499 for 1 wall" and HomeTriangle's package prices are starting prices, not minimums).
   - `locality_factors` = `[]` everywhere: no source gives a Pune locality-level difference.
   - **GST:** no source says whether its rates include GST. Every model note says so.
6. **Tier mapping** (brief: tier = paint grade). Budget = distemper or entry-level emulsion (Tractor-class); standard = premium emulsion (Apcolite-class) and lustre; premium = luxury emulsion (Royale-class) or texture. Exterior: budget = entry-level exterior emulsion (Ace-class, and the products AapkaPainter calls its economy tier); standard = weatherproof emulsion (Apex-class); premium = Apex Ultima / Ultima Protek-class systems or texture. Where a source names a grade but not a product (for example AapkaPainter Pune "standard emulsion" ₹20–₹30 and "premium emulsion" ₹36–₹55), the figure was **not** used, because it could not be matched to a product grade. Fresh-paint and repaint models whose source gives no grade are filed as `standard`.

## 2. Queries run

`std` = standard mode. "Domains" = `allowed_domains` filter (or `blocked_domains` where marked).

| # | Domains | Query | Useful result |
|---|---|---|---|
| 1 | nobroker.in | painting cost in Pune per sq ft labour charges | NB Pune averages, distemper ₹8, texture, lustre, fresh vs repaint, labour |
| 2 | nobroker.in | "Painting Cost in Pune - Price Per SqFt & Labour Charges" interior exterior Royale Apcolite Tractor emulsion rate | NB Pune per-product starting prices; Tractor/Apcolite and Royale full-job figures; exterior "Rs 13+" |
| 3 | asianpaints.com | interior wall painting cost per sq ft India emulsion distemper luxury price guide | AP interior ₹12–₹45, distemper ₹10–₹15, emulsion ₹20–₹40, labour by job type |
| 4 | asianpaints.com | painting cost per sq ft Pune interior exterior city rates labour material | AP exterior ₹18–₹60; material 55–65% / labour 35–45%; Pune ranked below Mumbai, Delhi, Bangalore |
| 5 | asianpaints.com, bergerpaints.com, nerolac.com | paint budget calculator carpet area paintable area times multiplied | 2.5 multiplier (publisher not pinned; resolved in 6) |
| 6 | asianpaints.com | painting area estimated by multiplying the carpet area by 2.5 paint budget calculator | AP calculator: carpet area × 2.5 |
| 7 | bergerpaints.com | paint calculator carpet area paintable area estimate how much paint interior walls ceiling | Berger: fresh painting = 1–2 putty coats, primer, 2–3 paint coats; no multiplier |
| 8 | nobroker.in | paintable area carpet area multiply 3.5 times painting cost calculation 2BHK | NB calculator: carpet area × 3.5 (also "3 to 3.5") |
| 9 | nobroker.in | 1 BHK 2 BHK 3 BHK painting cost Pune carpet area sq ft paintable area estimate | NB Pune blog: distemper ₹7, emulsion ₹9–₹25, texture ₹70–₹250; how to measure |
| 10 | housing.com, 99acres.com, squareyards.com, nobroker.in | average carpet area of 1BHK 2BHK 3BHK flat Pune sq ft | NB 1 BHK 450–600; Square Yards 2 BHK 600–950, 3 BHK 850–1,200 (Pune 1,100–1,400) |
| 11 | urbancompany.com | home painting price per sq ft Pune interior exterior rate card | UC standard ₹10–₹20, premium ₹30–₹50; Pune package starting prices |
| 12 | aapkapainter.com | painting cost calculator interior painting rates per sqft Royale Apcolite Tractor Emulsion fresh painting repainting | AAP economy/premium/luxury emulsion rates, litre prices, coverage |
| 13 | aapkapainter.com | Budget-Friendly Painting Costs in Pune per square foot pricing interior exterior | AAP Pune interior and exterior grades, labour-only, 2 BHK totals |
| 14 | aapkapainter.com | exterior painting cost per sq ft Ace Apex Apex Ultima Ultima Protek rates labour included | AAP exterior Apex/Ultima/Protek; Hyderabad Ace; Pune exterior |
| 15 | nobroker.in | Exterior Painting Cost Price Per SqFt Labour Charges Ace Apex Ultima weatherproof | NB exterior ranges, 1,000 sq ft Apex example, Ace ₹301/L |
| 16 | asianpaints.com | exterior house painting cost per sq ft India weatherproof emulsion economy premium luxury rates | AP exterior ₹20–₹45 in metros (Hyderabad page); project totals without area (not used) |
| 17 | housing.com | house painting cost per sq ft India 2025 interior exterior distemper emulsion texture labour | No links found (gap) |
| 18 | bergerpaints.com | house painting cost per sq ft India interior exterior labour charges | Berger interior ₹10–₹35; 1,000 sq ft house example |
| 19 | nobroker.in | exterior painting cost per sq ft starting price Ace exterior Apex Apex Ultima fresh repaint | NB exterior ₹15–₹30 with Asian Paints products; Apex Ultima litre prices |
| 20 | indiamart.com | exterior painting service Pune price per square feet | Pune listings: ₹16 internal/external, ₹35 lustre, ₹50 exterior, ₹5 apartment exterior |
| 21 | asianpaints.com | painting rates exterior Ace Apex Ultima per sq ft interior Tractor Apcolite Royale per sq ft labour | AP Hyderabad exterior/interior ranges; Royale vs Apcolite positioning and litre prices |
| 22 | asianpaints.com | Royale vs Apcolite painting cost per sq ft with labour difference | Litre prices only; no per-sq-ft by product |
| 23 | nerolac.com | house painting cost per sq ft interior exterior emulsion distemper texture price | Nerolac exterior texture ~₹60; distemper vs emulsion; coverage |
| 24 | aapkapainter.com, asianpaints.com | texture painting cost per sq ft interior wall exterior texture rates labour material | AAP texture ₹80–₹400 and type list; Chennai exterior texture ₹55–₹85 |
| 25 | nobroker.in, aapkapainter.com, urbancompany.com, asianpaints.com, bergerpaints.com | how many days does it take to paint a 2BHK 3BHK flat painting duration | NB 2 BHK 3–5 days, 3 BHK 5–7 (5–15); AAP 2 BHK 4–5 days |
| 26 | aapkapainter.com | fresh painting vs repainting cost per sq ft putty primer two coats rates | AAP fresh ₹18–₹35, repaint ₹12–₹25, repaint 25–40% less |
| 27 | nobroker.in, urbancompany.com, 99acres.com, squareyards.com | Apex Ultima Protek exterior painting cost per sq ft including labour premium exterior emulsion rate | NB Protek ₹836/L; no premium labour-included rate |
| 28 | bergerpaints.com, nobroker.in, aapkapainter.com | exterior painting cost per sq ft WeatherCoat Long Life Anti Dustt rates labour | WeatherCoat economy ₹15–₹22 and scaffolding ₹5–₹10 extra (publisher not pinned; not used) |
| 29 | dulux.in, akzonobel.co.in, duluxindia.com | painting cost per sq ft Dulux Weathershield Velvet Touch exterior interior price | Coverage only; no prices (gap) |
| 30 | biddaro.com | painting cost per sq ft Pune interior exterior | Biddaro national page; no Pune page returned |
| 31 | biddaro.com | "Painting Cost in Pune 2026" economy premium luxury exterior interior per sq ft | Biddaro grade table (national) |
| 32 | asianpaints.com, beautifulhomes.asianpaints.com | exterior painting cost per sq ft economy premium luxury exterior emulsion table labour and material | No tiered exterior rates (gap) |
| 33 | blocked: nobroker.in, aapkapainter.com, asianpaints.com, biddaro.com | Apex Ultima exterior painting cost per sq ft with labour 2026 India | Pointers to Construction Estimator India and HomeTriangle (figures not pinned; resolved in 34–35) |
| 34 | constructionestimatorindia.com | house painting cost per sq ft India interior exterior Apex Ultima Royale Tractor distemper texture | CEI distemper, luxury, exterior weatherproof, texture, Tractor |
| 35 | hometriangle.com | House Painting Cost in India 2026 per sq ft BHK rates economy premium luxury exterior | HT grade table, all-in ranges, labour share, repaint discount |
| 36 | nobroker.in, aapkapainter.com, asianpaints.com, bergerpaints.com, hometriangle.com | how long does exterior house painting take days drying time rain monsoon avoid painting | Berger 24–48 h after rain; NB rain within 4 h; no exterior job duration |
| 37 | indiamart.com | interior wall painting service Pune price per square feet emulsion Royale | Pune listings: Royale Lustre ₹34, Royale Shyne ₹28, ₹16, ₹21, ₹30 |
| 38 | squareyards.com, nobroker.in | 4 BHK flat carpet area square feet typical size | Project listings only (gap) |
| 39 | aapkapainter.com | paintable area 1 BHK 2 BHK 3 BHK 4 BHK sq ft carpet area painting estimate | AAP multiplier 3.2 (3–3.5); paintable area by BHK; 4 BHK 1,800–2,400 sq ft |
| 40 | nobroker.in, aapkapainter.com, hometriangle.com, urbancompany.com | exterior painting independent house how many days scaffolding duration bungalow | NB exterior 2–6 days |
| 41 | hometriangle.com | House Painting Service in Pune price per sq ft interior exterior rates | HT Pune listed rates and package prices |
| 42 | asianpaints.com, bergerpaints.com, nerolac.com | painting over damp wall seepage peeling paint fix dampness before painting mistakes | AP: trapped moisture causes blistering and peeling |

Plus two WebFetch attempts (not searches): `https://www.nobroker.in/painting-services/painting-cost-in-pune` and `https://aapkapainter.com/resources/painting-cost-calculator`, both `EGRESS_BLOCKED`.

## 3. Source catalogue and page confidence

Publisher is certain for every source (domain-restricted query). "Page" confidence says how sure we are that the quoted sentence is on that exact URL.

| Publisher | URL | Used for | Query | Page confidence |
|---|---|---|---|---|
| NoBroker | https://www.nobroker.in/painting-services/painting-cost-in-pune | Pune distemper ₹8, product starting prices, Tractor/Apcolite and Royale full-job ranges, texture, lustre, fresh/repaint, exterior "Rs 13+" | 1, 2 | medium (first result; NoBroker also has a Pune blog and Pune BHK pages with similar figures) |
| NoBroker | https://www.nobroker.in/painting-services/home-painting-ideas/painting-costs-in-pune/ | distemper ₹7 | 9 | medium |
| NoBroker | https://www.nobroker.in/painting-services/painting-cost-calculator | × 3.5 multiplier | 8 | high (first result, topic match) |
| NoBroker | https://www.nobroker.in/painting-services/asian-paints-home-painting-cost | exterior ₹15–₹30 with Asian Paints products | 15, 19 | medium |
| NoBroker | https://www.nobroker.in/forum/how-much-does-it-cost-to-paint-1000-sq-ft-house-exterior/ | 1,000 sq ft exterior ₹13–₹70; Apex example | 15 | high for the ₹13–₹70 sentence (title match), medium for the Apex example |
| NoBroker | https://www.nobroker.in/blog/best-paint-for-exterior-walls/ | Ace ₹301/L | 15 | medium |
| NoBroker | https://www.nobroker.in/forum/what-is-the-coverage-of-1-litre-apex-ultima/ | Protek ₹836/L | 27 | medium |
| NoBroker | https://www.nobroker.in/blog/2-bhk-painting-cost/ | 2 BHK 3–5 days | 25 | medium |
| NoBroker | https://www.nobroker.in/forum/how-long-does-it-take-to-paint-a-3-bhk-house/ | 3 BHK 5–7 days | 25 | high |
| NoBroker | https://www.nobroker.in/forum/how-long-does-it-take-to-paint-a-house-exterior/ | exterior 2–6 days | 40 | high |
| NoBroker | https://www.nobroker.in/forum/how-much-square-feet-required-for-1-bhk/ | 1 BHK 450–600 sq ft | 10 | high |
| NoBroker | https://www.nobroker.in/forum/what-is-luster-paint-rate-in-pune/ | title only (`quote: null`) | 1 | n/a |
| Asian Paints | https://www.asianpaints.com/blogs/painting-cost-per-sq-ft-india.html | interior/exterior ranges, distemper/emulsion, material/labour split, labour by job type | 3, 4 | medium-high (first result in both; Asian Paints' beautifulhomes subdomain has a similar article) |
| Asian Paints | https://www.asianpaints.com/blogs/painting-rates-in-hyderabad.html | exterior ₹20–₹45 in metros | 16, 21 | medium |
| Asian Paints | https://www.asianpaints.com/resources/tools/paint-budget-calculator.html | × 2.5 multiplier | 6 | high |
| Asian Paints | https://www.asianpaints.com/blogs/royale-vs-apcolite-price-finish-features-comparison.html | Royale vs Apcolite positioning, litre prices | 21, 22 | high |
| Asian Paints | https://www.asianpaints.com/blogs/waterproofing-before-painting-walls.html | trapped moisture → peeling (prose only) | 42 | medium |
| Asian Paints | product pages: tractor, apcolite, royale, ace-exterior-emulsion, apex, apex-ultima, apex-ultima-protek | material identity (`quote: null`; title seen only) | 3, 16, 21, 22 | n/a |
| AapkaPainter | https://aapkapainter.com/resources/painting-cost-calculator | interior grade rates, litre prices, coverage, exterior Apex/Ultima/Protek, multiplier 3.2, 4 BHK | 12, 14, 39 | medium (several AapkaPainter guides carry similar tables) |
| AapkaPainter | https://aapkapainter.com/blog/painting-cost-in-pune/ | Pune interior and exterior grades, 2 BHK totals, 2 BHK duration | 13, 25 | medium |
| AapkaPainter | https://aapkapainter.com/blog/painting-labour-cost-per-sq-ft-in-pune/ | Pune labour + material grades, labour-only | 13 | medium-low (could be the Pune cost page) |
| AapkaPainter | https://aapkapainter.com/blog/how-to-calculate-painting-cost-per-sq-ft/ | fresh vs repaint | 26 | medium-low (first result was the calculator) |
| AapkaPainter | https://aapkapainter.com/blog/painting-cost-in-hyderabad/ | Hyderabad Ace/Apex/Protek | 14 | high (city label) |
| AapkaPainter | https://aapkapainter.com/blog/what-is-texture-painting-and-types/ | texture ₹80–₹400 | 24 | high (title carries the range) |
| AapkaPainter | https://aapkapainter.com/blog/painting-cost-per-sq-ft-in-chennai-labour-material-rates-explained/ | Chennai exterior texture | 24 | medium (a second Chennai URL ending `-2026/` exists) |
| AapkaPainter | https://aapkapainter.com/blog/1bhk-vs-2bhk-vs-3bhk-painting-cost/ | paintable area by BHK | 39 | medium |
| HomeTriangle | https://hometriangle.com/blogs/house-painting-cost-in-india-2026-the-complete-homeowners-guide/ | grade table, all-in ranges, labour share, repaint discount | 35 | high |
| HomeTriangle | https://hometriangle.com/pune/house-painting | Pune listed rates | 41 | high (only Pune city page returned) |
| Urban Company | https://www.urbancompany.com/articles/room-painting-cost-everything-you-need-to-know | standard ₹10–₹20, premium ₹30–₹50 | 11 | high |
| Construction Estimator India | https://constructionestimatorindia.com/cost-of-painting-a-house-in-india/ | distemper, luxury, exterior weatherproof, texture, Tractor | 34 | medium (an interior-only CEI page was also returned) |
| Biddaro | https://www.biddaro.com/cost/painting | grade table, exterior inclusions, 1,500 sq ft example | 30, 31 | high (first result both times). Biddaro appears to be a programmatic Q&A site; weaker evidence |
| IndiaMART | four `proddetail` listings (Royale Lustre ₹34 Pune, Royale Shyne ₹28, Luster ₹35 Pune, internal/external ₹16 Pune) | single-seller listed prices; quote = listing title | 20, 37 | high (title is the quote) |
| Kansai Nerolac Paints | https://www.nerolac.com/wall-paint/exterior-wall-texture-design | exterior texture ~₹60 | 23 | high (title match) |
| Kansai Nerolac Paints | wall-paint/difference-between-distemper-paint-and-emulsion-paint; wall-paint/what-is-paint-coverage; wall-paint/what-is-emulsion-paint | distemper vs emulsion, coverage | 23 | medium |
| Berger Paints | https://www.bergerpaints.com/blogs/tips-before-getting-your-home-painted | fresh painting coats | 7 | medium-low |
| Berger Paints | https://www.bergerpaints.com/blogs/cost-to-paint-interiors-safely | 1,000 sq ft house example | 18 | medium |
| Berger Paints | https://www.bergerpaints.com/blogs/can-you-paint-home-exteriors-in-rainy-season | 24–48 h after rain (prose and FAQ only) | 36 | medium-high |
| Square Yards | https://www.squareyards.com/blog/what-is-2-bhk ; https://www.squareyards.com/sale/guides/what-is-3-bhk | 2 BHK and 3 BHK carpet areas | 10 | high |

## 4. Cost models (12) and their sources

All 12 models have ≥ 2 publishers. Five have exactly two: `interior-painting-fresh-standard`, `interior-painting-repaint-standard`, `interior-painting-lustre-standard`, `exterior-painting-premium-weatherproof-premium` and `exterior-painting-texture-premium`. Tier coverage: interior budget 2, standard 4, premium 2; exterior budget 1, standard 1, premium 2 (all 6 cells filled).

### `interior-painting-distemper-budget`

`interior-painting` · tier `budget` · scope `None` · material `distemper` · ₹7–₹20 per sq ft, expected ₹12. Publisher midpoints: NoBroker 7.5, AapkaPainter 13.25, Asian Paints 12.5, HomeTriangle 10, Construction Estimator India 14, Biddaro 11.5.

| Key | Publisher | Figure (₹/sq ft) | Page |
|---|---|---|---|
| NB_PUNE_DIST | NoBroker | 8 | https://www.nobroker.in/painting-services/painting-cost-in-pune |
| NB_BLOG_DIST | NoBroker | 7 | https://www.nobroker.in/painting-services/home-painting-ideas/painting-costs-in-pune/ |
| AAP_PUNE_INT | AapkaPainter | 11–17 | https://aapkapainter.com/blog/painting-cost-in-pune/ |
| AAP_PUNE_LM | AapkaPainter | 10–15 | https://aapkapainter.com/blog/painting-labour-cost-per-sq-ft-in-pune/ |
| AP_DIST | Asian Paints | 10–15 | https://www.asianpaints.com/blogs/painting-cost-per-sq-ft-india.html |
| HT_GRADES | HomeTriangle | 8–12 | https://hometriangle.com/blogs/house-painting-cost-in-india-2026-the-complete-homeowners-guide/ |
| CEI_DIST | Construction Estimator India | 8–20 | https://constructionestimatorindia.com/cost-of-painting-a-house-in-india/ |
| BID_DIST | Biddaro | 8–15 | https://www.biddaro.com/cost/painting |

### `interior-painting-basic-emulsion-budget`

`interior-painting` · tier `budget` · scope `None` · material `basic-emulsion` · ₹9–₹30 per sq ft, expected ₹15. Publisher midpoints: NoBroker 17, AapkaPainter 15, Construction Estimator India 15, HomeTriangle 14.5, Biddaro 17, Urban Company 15.

| Key | Publisher | Figure (₹/sq ft) | Page |
|---|---|---|---|
| NB_PUNE_START | NoBroker | 9 | https://www.nobroker.in/painting-services/painting-cost-in-pune |
| NB_PUNE_STD | NoBroker | 20–30 | https://www.nobroker.in/painting-services/painting-cost-in-pune |
| AAP_ECON | AapkaPainter | 12–18 | https://aapkapainter.com/resources/painting-cost-calculator |
| CEI_TRACTOR | Construction Estimator India | 12–18 | https://constructionestimatorindia.com/cost-of-painting-a-house-in-india/ |
| HT_GRADES | HomeTriangle | 14–20 | https://hometriangle.com/blogs/house-painting-cost-in-india-2026-the-complete-homeowners-guide/ |
| HT_PUNE_RATES | HomeTriangle | 12 | https://hometriangle.com/pune/house-painting |
| BID_GRADES | Biddaro | 12–22 | https://www.biddaro.com/cost/painting |
| UC_RATES | Urban Company | 10–20 | https://www.urbancompany.com/articles/room-painting-cost-everything-you-need-to-know |

### `interior-painting-premium-emulsion-standard`

`interior-painting` · tier `standard` · scope `None` · material `premium-emulsion` · ₹14–₹40 per sq ft, expected ₹22. Publisher midpoints: NoBroker 19.5, AapkaPainter 23, HomeTriangle 22, Asian Paints 30.

| Key | Publisher | Figure (₹/sq ft) | Page |
|---|---|---|---|
| NB_PUNE_START | NoBroker | 14 | https://www.nobroker.in/painting-services/painting-cost-in-pune |
| NB_PUNE_STD | NoBroker | 20–30 | https://www.nobroker.in/painting-services/painting-cost-in-pune |
| AAP_PREM | AapkaPainter | 18–28 | https://aapkapainter.com/resources/painting-cost-calculator |
| HT_GRADES | HomeTriangle | 20–28 | https://hometriangle.com/blogs/house-painting-cost-in-india-2026-the-complete-homeowners-guide/ |
| HT_PUNE_RATES | HomeTriangle | 20 | https://hometriangle.com/pune/house-painting |
| AP_DIST | Asian Paints | 20–40 | https://www.asianpaints.com/blogs/painting-cost-per-sq-ft-india.html |

### `interior-painting-luxury-emulsion-premium`

`interior-painting` · tier `premium` · scope `None` · material `luxury-emulsion` · ₹23–₹55 per sq ft, expected ₹35. Publisher midpoints: NoBroker 34, AapkaPainter 35.75, HomeTriangle 34, Construction Estimator India 40, IndiaMART 31, Urban Company 40.

| Key | Publisher | Figure (₹/sq ft) | Page |
|---|---|---|---|
| NB_PUNE_START | NoBroker | 23 | https://www.nobroker.in/painting-services/painting-cost-in-pune |
| NB_PUNE_PREM | NoBroker | 35–55 | https://www.nobroker.in/painting-services/painting-cost-in-pune |
| AAP_LUX | AapkaPainter | 28–45 | https://aapkapainter.com/resources/painting-cost-calculator |
| AAP_PUNE_LM | AapkaPainter | 28–42 | https://aapkapainter.com/blog/painting-labour-cost-per-sq-ft-in-pune/ |
| HT_GRADES | HomeTriangle | 28–40 | https://hometriangle.com/blogs/house-painting-cost-in-india-2026-the-complete-homeowners-guide/ |
| CEI_LUX | Construction Estimator India | 25–55 | https://constructionestimatorindia.com/cost-of-painting-a-house-in-india/ |
| IM_ROYALE_LUSTRE | IndiaMART | 34 | https://www.indiamart.com/proddetail/asian-paints-royale-lustre-interior-paint-27088860730.html |
| IM_ROYALE_SHYNE | IndiaMART | 28 | https://www.indiamart.com/proddetail/interior-asian-royale-shyne-13778928412.html |
| UC_RATES | Urban Company | 30–50 | https://www.urbancompany.com/articles/room-painting-cost-everything-you-need-to-know |

### `interior-painting-texture-premium`

`interior-painting` · tier `premium` · scope `None` · material `interior-texture` · ₹80–₹400 per sq ft, expected ₹140. Publisher midpoints: NoBroker 140, AapkaPainter 240, Construction Estimator India 140, HomeTriangle 100.

| Key | Publisher | Figure (₹/sq ft) | Page |
|---|---|---|---|
| NB_PUNE_TEXT | NoBroker | 80–200 | https://www.nobroker.in/painting-services/painting-cost-in-pune |
| AAP_TEXTURE | AapkaPainter | 80–400 | https://aapkapainter.com/blog/what-is-texture-painting-and-types/ |
| CEI_TEXT | Construction Estimator India | 80–200 | https://constructionestimatorindia.com/cost-of-painting-a-house-in-india/ |
| HT_PUNE_TEXT | HomeTriangle | 100 | https://hometriangle.com/pune/house-painting |

### `interior-painting-fresh-standard`

`interior-painting` · tier `standard` · scope `fresh-painting` · material `None` · ₹18–₹62 per sq ft, expected ₹39. Publisher midpoints: AapkaPainter 26.5, NoBroker 52.5.

| Key | Publisher | Figure (₹/sq ft) | Page |
|---|---|---|---|
| AAP_FRESH | AapkaPainter | 18–35 | https://aapkapainter.com/blog/how-to-calculate-painting-cost-per-sq-ft/ |
| NB_PUNE_FRESH | NoBroker | 43–62 | https://www.nobroker.in/painting-services/painting-cost-in-pune |

### `interior-painting-repaint-standard`

`interior-painting` · tier `standard` · scope `repaint` · material `None` · ₹12–₹53 per sq ft, expected ₹30. Publisher midpoints: AapkaPainter 18.5, NoBroker 42.5.

| Key | Publisher | Figure (₹/sq ft) | Page |
|---|---|---|---|
| AAP_REPAINT | AapkaPainter | 12–25 | https://aapkapainter.com/blog/how-to-calculate-painting-cost-per-sq-ft/ |
| NB_PUNE_FRESH | NoBroker | 32–53 | https://www.nobroker.in/painting-services/painting-cost-in-pune |

### `interior-painting-lustre-standard`

`interior-painting` · tier `standard` · scope `None` · material `lustre-finish` · ₹26–₹35 per sq ft, expected ₹31. Publisher midpoints: NoBroker 28, IndiaMART 35.

| Key | Publisher | Figure (₹/sq ft) | Page |
|---|---|---|---|
| NB_PUNE_LUSTRE | NoBroker | 26–30 | https://www.nobroker.in/painting-services/painting-cost-in-pune |
| IM_LUSTER | IndiaMART | 35 | https://www.indiamart.com/proddetail/luster-paint-service-2850870405988.html |

### `exterior-painting-economy-emulsion-budget`

`exterior-painting` · tier `budget` · scope `None` · material `exterior-economy-emulsion` · ₹13–₹30 per sq ft, expected ₹18. Publisher midpoints: AapkaPainter 18.25, NoBroker 17.75, IndiaMART 16, HomeTriangle 20.

| Key | Publisher | Figure (₹/sq ft) | Page |
|---|---|---|---|
| AAP_HYD_EXT | AapkaPainter | 14–22 | https://aapkapainter.com/blog/painting-cost-in-hyderabad/ |
| AAP_EXT_APEX | AapkaPainter | 15–22 | https://aapkapainter.com/resources/painting-cost-calculator |
| NB_APHOME_EXT | NoBroker | 15–30 | https://www.nobroker.in/painting-services/asian-paints-home-painting-cost |
| NB_PUNE_EXT | NoBroker | 13 | https://www.nobroker.in/painting-services/painting-cost-in-pune |
| IM_INTEXT16 | IndiaMART | 16 | https://www.indiamart.com/proddetail/internal-and-external-painting-services-2850868908212.html |
| HT_PUNE_RATES | HomeTriangle | 20 | https://hometriangle.com/pune/house-painting |

### `exterior-painting-weatherproof-emulsion-standard`

`exterior-painting` · tier `standard` · scope `None` · material `exterior-weatherproof-emulsion` · ₹18–₹45 per sq ft, expected ₹32. Publisher midpoints: AapkaPainter 33, Biddaro 26.5, Asian Paints 32.5.

| Key | Publisher | Figure (₹/sq ft) | Page |
|---|---|---|---|
| AAP_PUNE_EXT | AapkaPainter | 26–40 | https://aapkapainter.com/blog/painting-cost-in-pune/ |
| BID_GRADES | Biddaro | 18–35 | https://www.biddaro.com/cost/painting |
| BID_EXT | Biddaro | 18–35 | https://www.biddaro.com/cost/painting |
| AP_HYD_EXT | Asian Paints | 20–45 | https://www.asianpaints.com/blogs/painting-rates-in-hyderabad.html |

### `exterior-painting-premium-weatherproof-premium`

`exterior-painting` · tier `premium` · scope `None` · material `exterior-premium-weatherproof` · ₹20–₹68 per sq ft, expected ₹37. Publisher midpoints: AapkaPainter 40, Construction Estimator India 35.

| Key | Publisher | Figure (₹/sq ft) | Page |
|---|---|---|---|
| AAP_PUNE_EXT | AapkaPainter | 42–68 | https://aapkapainter.com/blog/painting-cost-in-pune/ |
| AAP_EXT_ULTIMA | AapkaPainter | 22–35 | https://aapkapainter.com/resources/painting-cost-calculator |
| AAP_EXT_PROTEK | AapkaPainter | 30–50 | https://aapkapainter.com/resources/painting-cost-calculator |
| CEI_EXT | Construction Estimator India | 20–50 | https://constructionestimatorindia.com/cost-of-painting-a-house-in-india/ |

### `exterior-painting-texture-premium`

`exterior-painting` · tier `premium` · scope `None` · material `exterior-texture` · ₹55–₹85 per sq ft, expected ₹65. Publisher midpoints: Kansai Nerolac Paints 60, AapkaPainter 70.

| Key | Publisher | Figure (₹/sq ft) | Page |
|---|---|---|---|
| NER_EXTTEX | Kansai Nerolac Paints | 60 | https://www.nerolac.com/wall-paint/exterior-wall-texture-design |
| AAP_CHENNAI_EXTTEX | AapkaPainter | 55–85 | https://aapkapainter.com/blog/painting-cost-per-sq-ft-in-chennai-labour-material-rates-explained/ |

## 5. Conflicts between sources

1. **Paintable area per flat.** The multiplier sources disagree: Asian Paints' budget calculator uses carpet area × 2.5, AapkaPainter "3 to 3.5 … with 3.2 used as a working figure", NoBroker × 3.5 ("3 to 3.5" in another result). The presets use 3.2, the median of the three publishers' figures (2.5, 3.2, 3.25 or 3.5). Separately, two sources describe a 2 BHK as having far less paintable area: Biddaro "approx 800–1000 sq ft of paintable area" and AapkaPainter's Pune page "2BHK (850 sqft wall area)". These look like carpet-area figures mislabelled as wall area, because AapkaPainter's own BHK page gives a 2 BHK 2,000–3,200 sq ft of paintable area. This matters for BHK totals: HomeTriangle's 2 BHK mid-range total (₹18,000–₹28,000) is lower than our preset × rate (₹52,800 at ₹22) probably because it assumes a smaller area.
2. **NoBroker Pune fresh/repaint figures are high.** NoBroker's "Fresh painting costs Rs 43 – Rs 62 … repainting costs Rs 32 – Rs 53" are 2–3 times AapkaPainter's national fresh (₹18–₹35) and repaint (₹12–₹25) figures, and above NoBroker's own ₹20–₹30 for putty, primer and two coats of Tractor or Apcolite. Both models were widened to cover both sources; the notes tell readers to prefer the paint-grade models once the product is known.
3. **AapkaPainter's grade labels differ between pages.** Its metro calculator calls Apex Exterior Emulsion "Economy tier" (₹15–₹22) and Apex Ultima "Premium" (₹22–₹35), while its Pune page gives "standard emulsion" ₹26–₹40 and "premium options with waterproofing treatment" ₹42–₹68. The Pune page's interior "standard emulsion" (₹20–₹30), "premium emulsion" (₹36–₹55) and "ultra-premium" (₹58–₹82) do not name products and were not used. AapkaPainter's Pune figures are consistently higher than its metro figures.
4. **Labour-only rates vary widely** (not modelled): Asian Paints ₹8–₹25 per sq ft nationally (₹8–₹12 basic repaint, ₹12–₹18 fresh interior, ₹18–₹25 premium finish, ₹25+ texture); HomeTriangle ₹4–₹12 (30–55% of the all-in rate); Construction Estimator India ₹10–₹12 in Delhi or Mumbai; AapkaPainter Pune ₹16–₹26 for a full interior job and ₹10–₹14 nationally; NoBroker Pune ₹25–₹50 average, ₹30–₹40 fresh, ₹20–₹30 repaint. NoBroker also says labour is about 3/2 of material cost, while Asian Paints says material is 55–65% of the budget. The component splits sit between these (see §1.5).
5. **Starting prices versus ranges.** NoBroker's per-product starting prices (Tractor UNO ₹7, Tractor Emulsion ₹9, premium emulsion ₹14, Royale ₹23), HomeTriangle Pune's listed rates (₹12, ₹20, ₹20, ₹100) and IndiaMART single-seller listings were each treated as a single figure. They pull the low end of ranges down; their effect on `expected` is limited because each publisher counts once.
6. **Repaint discount.** HomeTriangle: repainting 15–25% cheaper than fresh; AapkaPainter: 25–40% less. The model pair gives 23% (₹30 against ₹39).

## 6. ServiceDef notes

- **Structure.** `painting` (parent, no cost models of its own) with nested `interior-painting` and `exterior-painting`. Every cost model has `service_id` `interior-painting` or `exterior-painting`. Model `material_id` and `scope_id` values all exist in their sub-service's `materials` and `scope_options` (checked by script).
- **Unit.** `sqft` of paintable area everywhere.
- **Presets (interior and parent).** Paintable area = carpet area × 3.2 (see §5.1): 1 BHK 500 → 1,600; 2 BHK 750 → 2,400; 3 BHK 1,100 → 3,520; 4 BHK 2,000 → 6,400; independent house 1,000 → 3,200. Carpet areas are picks inside the sourced ranges (AapkaPainter, NoBroker, Square Yards). The 4 BHK size has one source (AapkaPainter 1,800–2,400 sq ft, read as carpet area because the same list states carpet area for 1 BHK). The independent-house size is Berger's 1,000 sq ft example; the multiplier is stated for flats, so this preset is a labelled planning assumption.
- **Presets (exterior).** Only `independent_house`, 1,500 sq ft of exterior wall, Biddaro's example size (NoBroker's example uses 1,000 sq ft). No flat presets, because the outside of an apartment building is painted as a whole.
- **Scope options.** `fresh-painting` and `repaint` for interiors (Berger's coat counts; AapkaPainter and HomeTriangle repaint discounts); `repaint` and `fresh-painting` for exteriors (NoBroker's Apex example: one primer coat, two top coats, minor crack repairs). Exterior models carry `scope_id: null` because no source separates fresh and repaint exterior rates.
- **Durations.** Interior 3–7 days (NoBroker 2 BHK 3–5, 3 BHK 5–7 with up to 15; AapkaPainter 2 BHK 4–5 working days with two painters). Exterior 2–6 days (NoBroker forum). Parent 2–7 days is a planning range across both, stated as such.
- **Prose.** Questions (8 parent, 8 interior, 7 exterior), mistakes (7, 7, 6), quote checklists and FAQs (7, 5, 5) use only figures from this log. FAQ BHK totals are preset × model `expected` (for example 2,400 × ₹22 = ₹52,800). No superlatives; product names appear only where a source names them.
- **Claims used in prose but not in any SourceRef:** Berger "waiting 24–48 hours after rainfall" (query 36), NoBroker "if it rains within 4 hours after applying a coat of paint, there are chances that the paint film may wash away" (query 36, `https://www.nobroker.in/forum/what-if-it-rains-after-painting-house/`), Nerolac "Distemper paints are ideal for painting ceilings and walls in low traffic areas like bedrooms and living rooms" (query 23), NoBroker measuring method (query 9), Urban Company and HomeTriangle Pune package starting prices (queries 11, 41), Asian Paints and HomeTriangle on why exteriors cost more (queries 16, 35), Dulux coverage was not used.

## 7. Gaps

- **No Pune exterior texture rate** and no Pune-specific premium exterior figure other than AapkaPainter's; `exterior-painting-premium-weatherproof-premium` and `exterior-painting-texture-premium` rest on two publishers each.
- **No exterior fresh-vs-repaint split** and no exterior lustre/enamel figures.
- **No second source for 4 BHK carpet area** or for a typical independent-house size.
- **No minimum job values, locality factors or GST statements** in any source.
- **Publishers that returned nothing usable:** housing.com (no links, query 17), Dulux India (coverage only, query 29), Berger (no per-grade per-sq-ft rates; its exterior cost page is titled 2021 and was not used), 99acres (no painting results in query 10 or 27), magicbricks and news sites were not tried because the waterproofing run found them refused.
- **Not pinned to a publisher, so not used:** "Berger WeatherCoat is classified as an economy exterior paint with all-inclusive costs of ₹15–₹22 per sq ft" and "exterior painting with scaffolding adds ₹5–10 per sq ft to labour charges" (query 28, three domains); "For Premium (Apex Ultima) exterior painting, the cost ranges from ₹30 – ₹50 per square foot" and the Delhi Painting Company / Deccan Clap figures (query 33, open search); "Wall textures and design finishes start from ₹50 per sq ft" and "material costs range from ₹25–80/sq ft with labour + material ranging from ₹45–150/sq ft" (query 24, two domains).
- **Re-check before review:** every quote comes from search-result text; open each URL and confirm wording and figures before marking anything `reviewed`.
