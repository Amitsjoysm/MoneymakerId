TASK-MARKER: retryA-modular-kitchen

# Research log: modular-kitchen service pack (D03, retry A)

- **Owner files:** `data/services/modular-kitchen.json`, `data/cost-models/modular-kitchen.json`, this log
- **Researched:** 2026-10-06. Every `retrieved_at` and `reviewed_at` is `2026-10-06`, and every `valid_until` is `2027-04-04`.
- **Status:** everything is `draft`. The owner must review the prose before it can render on an indexable page.
- **Result:** 7 cost models covering all 3 tiers (budget, standard, premium), each with 3–4 independent publishers, and a ServiceDef with 4 layout scopes, 12 sourced materials and a sourced `duration_days`. `area_presets` is `[]` (see §2).
- **This run replaces the blocked first run.** That run gathered no sources. Its query table and reachability tests are no longer relevant and are not repeated here. §7 lists what was kept from its ServiceDef draft.

## 1. Method and constraints

1. **WebSearch only.** 34 WebSearch calls were made, within the 35-call budget. Call 34 ran two internal queries, so it may count twice against the shared cap, and I stopped there. WebFetch was not used. The first run found every publisher domain blocked (`EGRESS_BLOCKED`).
2. **Attribution by domain-restricted search.** Every query except #10 used `allowed_domains`, so the publisher of each figure is certain. The exact page is the result whose title matches the figure's topic. Where I ran a pinning query with the figure's own wording and the page came first, confidence is **high**. Otherwise it is **medium**, or **low** where the publisher has several candidate pages (§4).
3. **Quotes** are copied character-for-character from the WebSearch output, which is the search tool's rendering of the page (snippet text). Markdown bold markers were dropped. No quote has been checked against the live page. The reviewer should open each URL and confirm the wording and figures before marking anything `reviewed`. The two HDHMR guides were seen only as titles, so they carry `quote: null`.
4. **Publishers that returned nothing usable:**
   - housing.com returned no links (#13). Its tool summary was not grounded in any page and is not used.
   - urbancompany.com returned layout articles with no prices (#14).
   - 99acres.com returned a 2024 article (#15), used only in §6.
   - indiamart.com Pune listings quote per sq ft (#16), which does not fit the per-kitchen unit (§2).
5. **Rules applied to every model:**
   - `low` = the lowest cited low and `high` = the highest cited high, so the range widens whenever sources disagree.
   - `expected` = the median of one midpoint per publisher, rounded to the nearest ₹5,000 with ties rounded down. When a publisher gives several closed ranges, its own median midpoint is used.
   - Open-ended figures ("from ₹3 lakh", "₹4 lakh and above") give no midpoint. They are cited only where they sit inside the range.
   - Pages from the same publisher count as one publisher.
   - `min_job_inr` is `null` and `locality_factors` is `[]`: no source states a minimum order or a Pune locality difference.
   - `components` is a labelled editorial assumption, the same for all models: materials 0.74, labour 0.15, preparation 0.03, repair 0, transport 0.04, waste 0.04. Search text from NoBroker or Livspace pages, not pinned to a page and not cited, put installation or labour at 10–25% of the total ("installation expenses usually comprise 10% to 15% of the total kitchen cost"; labour "forming 15–25% of total project cost"). 0.15 sits inside that band.
   - **GST:** none of the sources says whether its figures include GST. This is stated in every model's notes.

## 2. Unit decision: `unit` (one kitchen), with layouts as scopes

**Chosen:** `unit` = price per complete kitchen. `scope_options` are the four layouts: `straight`, `l-shaped`, `u-shaped` and `parallel`. All 7 models use `unit`, and none is per sq ft.

**Why not sq ft.** Every publisher found gives whole-kitchen prices in lakh, by layout, by tier or by finish:
- HomeLane: Pune and national, by layout and tier
- NoBroker: Pune, by layout × tier and by package
- Design Cafe: Pune tiers and finishes; Mumbai and Ahmedabad layouts
- Livspace: by finish and layout
- Asian Paints (Beautiful Homes): by layout
- 99acres: by layout

Their per-sq-ft figures use at least three different areas that cannot be converted without unsourced assumptions:
- **Kitchen floor area.** Livspace gives ₹2,600–₹4,000 per sq ft for an average 80–100 sq ft parallel kitchen.
- **Shutter or finish area.** HomeLane gives laminate at ₹700–₹900 and acrylic at ₹1,500+ per sq ft. Livspace gives acrylic shutters at ₹1,500–₹5,500 per sq ft. NoBroker's Pune text gives shutter finishes of laminate ₹400–₹800 and acrylic ₹1,000–₹1,600.
- **Running feet.** NoBroker Pune gives base units at ₹4,000–₹8,000 per ft and wall units at ₹3,500–₹6,500 per ft.
- **Unstated.** HomeLane gives ₹1,200–₹2,500 per sq ft for Pune. Design Cafe gives ₹900–₹1,600 per sq ft for cabinets and shutters. IndiaMART Pune listings range from ₹1,050 to ₹5,500 per sq ft.

A per-sq-ft model would also need sourced cabinet areas for each BHK, and none was found.

**Consequence for `area_presets`.** With a per-kitchen unit the quantity is 1 kitchen for every BHK. Presets would all give the same estimate, so `area_presets` is `[]` and the calculator asks for the quantity. Layout (scope) and tier carry the size and grade difference. The scope descriptions give NoBroker's reference sizes for each layout.

**Contract note for the orchestrator.** `CONTRACTS §4a` says that only the house-construction guide title uses "per sq ft", so a per-kitchen unit needs no title change. The calculator (C02, A02) must handle `unit: 'unit'`, with quantity = number of kitchens, and an empty preset list.

## 3. Queries run

"Domains" = the `allowed_domains` filter. All queries ran in standard mode.

| # | Domains | Query | Useful result |
|---|---|---|---|
| 1 | nobroker.in | modular kitchen cost per sq ft Pune 2025 laminate acrylic | NB_PUNE overall and layout figures; per-sq-ft text (not used) |
| 2 | homelane.com | modular kitchen cost per sq ft price guide laminate acrylic PU | HomeLane finish per sq ft; acrylic +15–25%, PU +30–45% |
| 3 | homelane.com | HomeLane 2026 Modular Kitchen Cost in Pune price per sq ft L-shaped U-shaped parallel | HL_PUNE layouts, granite, accessories (pinned) |
| 4 | homelane.com | modular kitchen cost Pune laminate finish per sq ft acrylic PU finish per sq ft plywood carcass | HL_PUNE plywood recommendation |
| 5 | livspace.com | modular kitchen price per sq ft India laminate acrylic PU membrane cost | LS finish per-kitchen figures; acrylic shutter prices |
| 6 | designcafe.com | modular kitchen cost Pune 2026 price L-shaped U-shaped straight parallel laminate acrylic | DC tiers and layouts (pinned later) |
| 7 | livspace.com | modular kitchen cost calculator L-shaped U-shaped parallel straight kitchen price range lakh | LS layout table, version 1 (see conflict C1) |
| 8 | homelane.com | HomeLane modular kitchen cost calculator Pune L-shaped kitchen price Essentials Premium Luxe | No package-tier prices; repeats HL_PUNE |
| 9 | nobroker.in | Modular Kitchen Cost and Design Guide in Pune 2026 straight L-shaped U-shaped parallel price low-cost premium | NB_PUNE layout × tier bands (pinned) |
| 10 | — | L-shaped modular kitchen price India laminate vs acrylic vs PU per kitchen table 2026 | Pointer to Beautiful Homes; nothing citable |
| 11 | beautifulhomes.asianpaints.com | modular kitchen India design cost price laminate acrylic L-shaped parallel lakh | BH layout figures (page not pinned) |
| 12 | designcafe.com | Design Cafe modular kitchen price L-shaped kitchen laminate finish acrylic finish cost table parallel U-shaped | DC national layouts (page not pinned); acrylic +15–30% |
| 13 | housing.com | modular kitchen cost price per sq ft India L-shaped U-shaped parallel laminate acrylic | No links (gap) |
| 14 | urbancompany.com | modular kitchen price Pune L-shaped straight parallel starting price | No prices (gap) |
| 15 | 99acres.com | modular kitchen cost India price L-shaped U-shaped parallel straight laminate acrylic lakh | 2024 article (not used in models) |
| 16 | indiamart.com | modular kitchen Pune price L shape kitchen laminate plywood | Pune per-sq-ft listings (unit mismatch; not used) |
| 17 | livspace.com | low cost modular kitchen price guide particle board MDF vs plywood laminate kitchen cost lakh | LS board prices; LS cost-per-sq-ft page identified |
| 18 | nobroker.in | mid-range modular kitchen BWP plywood laminate cost lakh Pune budget MDF particle board kitchen cost | NB package bands; NB_BWP |
| 19 | nobroker.in | "Budget packages" particle board or MDF with laminates ₹1.8-2.6L mid-range BWR plywood ₹2.7-3.8L modular kitchen | NB_KID packages (pinned) and package inclusions |
| 20 | homelane.com | Decoding Modular Kitchen Prices in India with Real Costs budget mid-range premium kitchen lakh plywood laminate | HL_INDIA layouts, finishes, core material |
| 21 | homelane.com | "Mid-Range Kitchens" ₹2 lakh – ₹3.5 lakh BWR plywood cabinets … | HL_CAB mid-range (pinned to the cabinet-design page) |
| 22 | homelane.com | Modern Modular Kitchen Cabinets Design "Budget Kitchens" "Premium Kitchens" lakh MDF laminate acrylic PU cabinets cost | HL_CAB budget, luxury, MDF, laminate, acrylic and PU text |
| 23 | designcafe.com | "Basic modular kitchens" ₹2–2.5 Lakhs … "Premium modular kitchens" ₹4 Lakhs Pune | DC_PUNE tiers and finishes (pinned) |
| 24 | designcafe.com | Pune "L-shaped kitchens" ₹2.5 lakh–₹4.5 lakh "parallel kitchens" … | DC layout figures are from the **Mumbai** page (DC_MUM) |
| 25 | livspace.com, homelane.com, designcafe.com | how long does modular kitchen installation take days from design to installation | "around 45 days" (HL_45), "4–6 weeks" |
| 26 | designcafe.com | modular kitchen installation timeline weeks design manufacturing on-site installation working days | DC_TIME 4–6 weeks; on-site 4–7 days |
| 27 | livspace.com, nobroker.in | kitchen countertop price per sq ft granite vs quartz India | LS_GQ granite vs quartz |
| 28 | livspace.com, homelane.com, designcafe.com | HDHMR board vs BWP plywood kitchen cabinets moisture resistance difference BWR MR grade | HDHMR guide titles (HL_HDHMR, DC_HDHMR) |
| 29 | livspace.com | Modular Kitchen Cost Per Sq. Ft. 2026 straight kitchen average size 50–70 sq. ft. … | LS layout table, version 2 (conflict C1); parallel row confirmed |
| 30 | livspace.com | Livspace modular kitchen cost by finish "Laminate" ₹1.5L – ₹2.5L … | Did not pin the finish figures (see §4, LS_SQFT) |
| 31 | designcafe.com | "U-shaped kitchens cost" ₹4–₹6 lakh L-shaped ₹2.5 to ₹5 lakh … | DC layout figures are from the **Ahmedabad** page (DC_AMD) |
| 32 | beautifulhomes.asianpaints.com | L-shaped modular kitchen design estimated cost range Rs. 1.5 lakh – Rs. 5 lakh+ … | BH_L (Sleek Kitchens L-shaped page) |
| 33 | nobroker.in, homelane.com, livspace.com | modular kitchen cost breakdown percentage cabinets hardware accessories countertop installation labour share of total cost | Labour share 10–25% (unpinned; used only to justify the component assumption) |
| 34 | livspace.com, homelane.com | what is membrane finish kitchen shutters PVC foil … ; PU finish … (the tool ran two internal queries) | LS_MEMB definition; PU text (not pinned; PU description kept minimal) |

## 4. Sources and what each supports

Confidence = confidence that the figure is on **this exact URL**. The publisher is certain in every row.

| Key | Publisher | URL | What it supports | Key quote (as seen in search output) | Confidence |
|---|---|---|---|---|---|
| NB_PUNE | NoBroker | https://www.nobroker.in/interiors/design-guides/modular-kitchen-cost-in-pune/ | Pune overall (₹1.5–8 L); layouts (straight 1.5–4.5, L 2–5.5, U 2.8–7); layout × tier bands for L, U and parallel; low-cost and premium package contents; base and wall units per ft | "Modular kitchen prices in Pune depend on the type of kitchen: straight (1.5L-4.5L), L-shaped (2L-5.5L), and U-shaped (2.8L-7L)." | High: the page title was in queries 9 and 1. The band lines ("Mid-range: ₹2.9L - ₹4L" and the others) appeared under headings for each layout. |
| NB_KID | NoBroker | https://www.nobroker.in/interiors/design-guides/kitchen-interior-design/ | Budget packages ₹1.8–2.6 L (particle board/MDF + laminate, including a basic chimney, hob and sink); mid-range ₹2.7–3.8 L (BWR plywood); high-end ₹4 L+ (marine plywood, acrylic) | "Budget packages (₹1.8-2.6L) are made of particle board or MDF with laminates, mid-range (₹2.7-3.8L) are made of BWR plywood with quality finishes." | Medium-high: first result of pinning query 19 |
| NB_BWP | NoBroker | https://www.nobroker.in/forum/what-is-bwp-plywood-modular-kitchen-cost/ | BWP plywood kitchens ₹1,800–2,800 per sq ft (material description only) | "Standard or mid-range kitchens using BWP plywood with laminate or membrane finish cost Rs. 1,800 to Rs. 2,800 per sq ft." | Medium: the page topic matches |
| HL_PUNE | HomeLane | https://www.homelane.com/design-ideas/modular-kitchen-design/modular-kitchen-cost-pune/ | Pune layouts (L 2.4–3 L, straight 1.1–2 L, U from 3 L); granite ₹100–300/sq ft; BWP/BWR plywood for Pune; accessories ₹18,000–35,000; ₹1,200–2,500/sq ft | "L-shaped kitchens are the most popular in Pune apartments, usually ranging between INR 2.4 to INR 3 lakhs depending on materials, finish, area and storage depth." | High: the page title was in query 3 |
| HL_INDIA | HomeLane | https://www.homelane.com/design-ideas/modular-kitchen-design/modular-kitchen-prices-in-india/ | National layouts (straight 0.75–1.5 L, L 1.5–3 L, U 1.8–3.5 L, island 2.5–5 L+); finish per sq ft; BWP/BWR core | "Straight Kitchen: ₹75,000-1,50,000; L-Shaped Kitchen: ₹150,000–300,000; U-Shaped Kitchen: ₹1,80,000-3,50,000; Island Kitchen: ₹2,50,000-5,00,000+." | Medium: query 20 used the page title, but other HomeLane city pages were returned too |
| HL_CAB | HomeLane | https://www.homelane.com/design-ideas/modular-kitchen-design/modular-kitchen-cabinet-design/ | Tiers: low-budget ₹0.8–1.5 L, mid-range ₹2–3.5 L (BWR plywood), luxury ₹4–5 L+ (veneer, acrylic, glass, built-in appliances); MDF, laminate, acrylic and PU text | "Mid-range kitchens priced at ₹2 lakh – ₹3.5 lakh include BWR plywood cabinets, high-quality laminates or acrylic finishes, and storage accessories." | Medium: first result in pinning queries 21 and 22 |
| HL_45 | HomeLane | https://www.homelane.com/interior-design/modular-kitchen-design | About 45 days from first design conversation to handover | "For most standard projects, the entire journey—from the first design conversation to final handover—takes around 45 days." | **Low-medium.** Query 25 mixed three publishers. The 45-day text did not appear in the Design Cafe-only query 26, so it is attributed to HomeLane's first-listed page. |
| HL_HDHMR | HomeLane | https://www.homelane.com/design-ideas/home-interior-design/hdhmr-board-materials/ | HDHMR exists as a kitchen-cabinet board (title only) | null | Title only |
| DC_PUNE | Design Cafe | https://www.designcafe.com/interior-design/modular-kitchen-design/city/pune/ | Pune tiers: basic ₹2–2.5 L, mid-range ₹3–3.5 L, premium ₹4 L+; finishes: laminate from 1.5 L, acrylic from 3 L, veneer from 4 L, PU from 4.5 L | "Basic modular kitchens (₹2–2.5 Lakhs) are perfect for 1–2 BHK homes and include laminate finishes, standard hardware, and essential storage modules like base and overhead cabinets." | High: first result of pinning query 23. The title was seen as both "Best Modular Kitchens In Pune At Best Prices" and "Best Modular Kitchen Designs In Pune"; the first is used. |
| DC_MUM | Design Cafe | https://www.designcafe.com/blog/modular-kitchen-interiors/kitchen-interior-design-cost-in-mumbai/ | **Mumbai** layouts: L 2.5–4.5 L, parallel 3–5 L, straight 1.8–3 L | "Popular kitchen styles include L-shaped kitchens ₹2.5 lakh–₹4.5 lakh, parallel kitchens ₹3 lakh–₹5 lakh, and straight kitchens ₹1.8 lakh–₹3 lakh." | Medium: query 24's summary named Mumbai as the source city |
| DC_AMD | Design Cafe | https://www.designcafe.com/blog/modular-kitchen-interiors/modular-kitchen-cost-ahmedabad/ | **Ahmedabad** layouts: L 2.5–5 L, U 4–6 L | "In Ahmedabad: L-shaped kitchens cost ₹2.5–₹5 lakh, while U-shaped kitchens cost ₹4–₹6 lakh" | Medium (query 31) |
| DC_TIME | Design Cafe | https://www.designcafe.com/interior-design/modular-kitchen-design/ | 4–6 weeks from design to installation; on-site installation 4–7 days | "The entire process of designing and installing a modular kitchen usually takes around 4–6 weeks" | Medium: first result in query 26 |
| DC_HDHMR | Design Cafe | https://www.designcafe.com/blog/home-interiors/hdhmr-sheets-guide/ | HDHMR (title only) | null | Title only |
| LS_SQFT | Livspace | https://www.livspace.com/in/magazine/modular-kitchen-cost-per-sq-ft | Per-kitchen figures by finish (laminate 1.5–2.5 L, acrylic 2.5–4 L, PU 3–5 L); parallel row (80–100 sq ft, ₹2–3.8 L, ₹2,600–4,000/sq ft); city variation of 15–20% | "Laminate: ₹1.5L – ₹2.5L (budget-friendly and durable)" | **Low-medium.** Pinning query 30 did not return the finish lines. The page is the likeliest of the Livspace results in queries 5 and 17. The parallel row is medium (query 29 used the page title). |
| LS_ACR | Livspace | https://www.livspace.com/in/magazine/materials-101-acrylic-kitchen-cabinets | Acrylic shutter price ₹1,500–5,500/sq ft | "Premium acrylic finish costs ₹5,500 per sq ft (shutter price), though acrylic finishes start from ₹1500/sq. ft. (shutter price)" | Medium |
| LS_MDF | Livspace | https://www.livspace.com/in/magazine/mdf-vs-particle-board-differences-everything-you-need-to-know | Board prices: MDF ₹40–90, particle board ₹30–60 per sq ft | "MDF costs ₹40 – ₹90 per sq. ft., compared to particle board at ₹30 – ₹60 per sq. ft." | Medium |
| LS_MEMB | Livspace | https://www.livspace.com/in/magazine/materials101-laminate-membrane-guide | Membrane definition | "Membrane is essentially Polyvinyl Chloride (PVC) foil that is wrapped around either MDF or HDF-HMR under a high vacuum pressure to produce a membrane finish panel." | Medium |
| LS_GQ | Livspace | https://www.livspace.com/in/magazine/materials101-granite-vs-quartz-countertops | Quartz is man-made and priced by the maker; granite costs less | "The cost of quartz kitchen countertops may significantly increase as it is manmade and its price is determined by the manufacturer, while granite countertops are made from 100% natural granite and cost comparatively less than quartz." | Medium (query 27 also covered NoBroker) |
| BH_L | Asian Paints (Beautiful Homes) | https://www.beautifulhomes.asianpaints.com/sleek-kitchens/l-shaped.html | L-shaped ₹1.5–5 L+ (national) | "The estimated cost range for an L-shaped modular kitchen is Rs. 1.5 lakh – Rs. 5 lakh+, depending on size, materials, and finishes." | Medium. Query 11 listed a second Beautiful Homes L-shaped page (`/interior-design-ideas/l-shaped-modular-kitchen-design.html`); pinning query 32 listed this one. |

**Seen but not cited:**
- Beautiful Homes per-sq-ft finish prices (laminate ₹700–1,200, acrylic ₹1,200–1,500) and the parallel "₹1.5 lakh+" figure: the page was not pinned.
- Design Cafe national layouts from query 12 (L ₹2.5–5 L, U ₹4–6 L): the same figures as DC_AMD, so they were not counted twice.
- HomeLane per-sq-ft range for tier-2 cities (₹1,200–2,500): sq-ft basis.
- IndiaMART Pune listings: per sq ft.
- 99acres 2024 layout prices: older than 2025, and its U-shaped range (₹55,000–1.5 L) is below its own L-shaped range.
- Godrej Properties, interiorcompany.com and tinttoneandshade.com: appeared in unrestricted query 10, but no figure was attributable.

## 5. Cost models: derivation, conflicts and resolution

All figures are ₹ lakh per kitchen. "Mid" = the publisher's midpoint used for `expected`.

| Model id | Cited figures (publisher: range → mid) | Result low / expected / high (₹) | Conflict and resolution |
|---|---|---|---|
| modular-kitchen-laminate-board-budget | NoBroker: Pune low-cost 1.5–2.5 (2.0) and budget package 1.8–2.6 (2.2) → 2.1; HomeLane low-budget 0.8–1.5 → 1.15; Livspace laminate 1.5–2.5 → 2.0; Design Cafe Pune basic 2–2.5 → 2.25 | 80,000 / 205,000 / 260,000 | HomeLane's figure is for smaller kitchens and sets the low end. Only NoBroker names the board (particle board or MDF). NoBroker's package includes a basic chimney, hob and sink, while the other sources do not say what is included. All of this is in the notes. |
| modular-kitchen-bwr-plywood-standard | HomeLane mid-range 2–3.5 → 2.75; NoBroker mid-range package 2.7–3.8 → 3.25; Design Cafe Pune mid-range 3–3.5 → 3.25 | 200,000 / 325,000 / 380,000 | The finish varies: HomeLane allows acrylic, Design Cafe mixes in glass, and NoBroker says "quality finishes". Filed as standard because all three are the publishers' mid tiers and two name BWR plywood. |
| modular-kitchen-acrylic-pu-premium | Livspace acrylic 2.5–4 (3.25) and PU 3–5 (4.0) → 3.625; HomeLane luxury 4–5+ → 4.5; NoBroker Pune premium L 4.1–5.5 (4.8), U 5.3–7 (6.15), P 4.9–6.5 (5.7) → 5.7; Design Cafe Pune premium "₹4 L and above" (open-ended, no midpoint) | 250,000 / 450,000 / 700,000 | NoBroker's and HomeLane's premium figures include appliances, so the upper half may include them. Design Cafe's open-ended figures (acrylic from 3, PU from 4.5) sit inside the range. |
| modular-kitchen-straight-standard | HomeLane Pune 1.1–2 → 1.55; NoBroker Pune 1.5–4.5 → 3.0; Design Cafe Mumbai 1.8–3 → 2.4 | 110,000 / 240,000 / 450,000 | NoBroker gives no finish split for straight kitchens, so its full range is used. HomeLane's national 0.75–1.5 is not used, because the Pune figure is preferred. |
| modular-kitchen-l-shaped-standard | HomeLane Pune 2.4–3 → 2.7; NoBroker Pune mid-range 2.9–4 → 3.45; Design Cafe Mumbai 2.5–4.5 (3.5) and Ahmedabad 2.5–5 (3.75) → 3.625; Asian Paints (BH) 1.5–5+ → 3.25 | 150,000 / 335,000 / 500,000 | Wide range, because only NoBroker splits by tier. NoBroker's other bands: low-cost 2–2.8, premium 4.1–5.5. |
| modular-kitchen-u-shaped-standard | NoBroker Pune mid-range 3.9–5.2 → 4.55; HomeLane national 1.8–3.5 → 2.65 (HomeLane Pune "from 3", open-ended); Design Cafe Ahmedabad 4–6 → 5.0 | 180,000 / 455,000 / 600,000 | **C2:** HomeLane's national U-shaped range (to 3.5) conflicts with its Pune page ("from 3 lakhs and go upward"). Only the closed national range gives a midpoint, and both are cited. No second Pune closed range was found. |
| modular-kitchen-parallel-standard | NoBroker Pune mid-range 3.6–4.8 → 4.2; Livspace 2–3.8 → 2.9; Design Cafe Mumbai 3–5 → 4.0 | 200,000 / 400,000 / 500,000 | This model is higher than the L-shaped one. NoBroker's reference parallel kitchen has 24 ft of counter against 14 ft for its L-shaped one, which explains it. |

**Layout models are filed under `standard`.** Only NoBroker publishes layout × finish bands. For L-shaped, U-shaped and parallel, its mid-range band is used. The other publishers give one range per layout across all finishes, so these models' low and high span budget to premium finishes. If the calculator selects a layout with the budget or premium tier, no layout model matches. It should fall back to the scope-null tier model, which is a decision for C02.

**C1: the Livspace layout table read two ways.**
- Query 7 returned four rows: straight (50–70 sq ft, ₹1.5–2.5 L); L-shaped (70–100, ₹2–3.5 L); U-shaped (90–120, ₹2.5–4 L); parallel (80–100, ₹2–3.8 L).
- Query 29 returned "Straight/Parallel 80–100, ₹2–3.8 L"; "L-Shaped 90–120, ₹2.5–4 L"; and a U-shaped "starting" figure of ₹1,83,170–2,10,646. The labels look shifted by one row.

Only the 80–100 sq ft, ₹2–3.8 L row is the same in both readings, and both readings tie it to parallel kitchens. Livspace is therefore used only for the parallel model. Its straight, L-shaped and U-shaped rows are left out until the page is checked.

## 6. ServiceDef: what changed from the first-run draft

- **Unit:** `sqft` → `unit` (§2).
- **Scopes:** the four inclusion-based scopes are replaced by the four layouts. Those were cabinets-only, cabinets-and-countertop, full-kitchen-remodel and shutter-replacement, and no source priced them per kitchen. The old inclusion items are kept in the questions and quote checklist.
- **Materials:**
  - Every material now has 2–3 sources.
  - Removed: `bwr-mr-plywood`, because MR grade text came only from an unpinned result.
  - Split: BWR and BWP plywood are now separate entries.
  - Renamed: `pu-lacquer-finish` → `pu-finish`. "Lacquer" was unsourced.
  - Added: `glass-shutters`, because the sources name glass as a finish.
  - Rewritten from sourced text: the descriptions of particle board/MDF, membrane, acrylic, granite and quartz.
  - HDHMR: definition only, citing two guide titles with `quote: null`.
- **Duration:** the `{0,0}` placeholder is replaced by 28–45 days, from Design Cafe's 4–6 weeks and HomeLane's ~45 days. On-site installation is 4–7 days per Design Cafe.
- **Questions, mistakes and checklist:** kept from the first run. Edited: question 1 and checklist item 1 (price basis), and question 2 (BWP as an example for the sink unit). Added mistake: comparing packages without checking appliance inclusion, based on NoBroker's budget package and HomeLane's luxury tier. Totals: 10 questions, 9 mistakes, 13 checklist items.
- **FAQ:** 8 entries.
  - Added: "How much does a modular kitchen cost in Pune?" and "Why do per-sq-ft prices differ so much?"
  - Rewritten with publisher-attributed figures: inclusions, sink board, finishes and duration.
  - Kept unchanged: measurement timing and the housing-society entry, which are procedural advice.
  - Dropped: "Can I keep my existing stone platform?". Its claim that masonry supports limit cabinet widths had no source.

## 7. Gaps (open)

- **Layout × tier models.** No second publisher splits layouts by finish. Budget and premium cells for each layout need a source beyond NoBroker.
- **Island kitchens.** Only HomeLane's national figure (₹2.5–5 L+) was found. Island has no scope and no model.
- **Shutter replacement and full remodel.** No per-kitchen source was found, so these have no scope and no model.
- **`area_presets`:** intentionally `[]` (§2). A per-sq-ft calculator would need sourced cabinet areas for each BHK.
- **GST basis:** unknown for every figure.
- **Pune-specific figures:** Design Cafe's layout figures come from its Mumbai and Ahmedabad pages, labelled in the notes. Livspace, HomeLane national and Beautiful Homes figures are national.
- **Publishers without data:** Housing.com and Urban Company. Magicbricks and news sites were not tried, because the previous pack found them refused.
- **To re-check before review:** the pages marked low or medium in §4, especially LS_SQFT's finish figures and HL_45.

## 8. Verification

- `node scripts/data-coverage.mjs` shows no ERROR line for modular-kitchen and no tier-gap warning (all 3 tiers have a model). The run reports 10 errors, all for files owned by other tasks: `data/localities.json`, `data/dishes.json` and 8 locality guides. The modular-kitchen warnings are the shared locality-facts coverage warnings.
- A stricter local check passed:
  - exact §4 key sets
  - every `scope_id` and `material_id` exists in the ServiceDef
  - `unit` is `unit` in the ServiceDef and in all models
  - integer rates with low ≤ expected ≤ high
  - components sum to 1.00
  - ≥ 2 publishers per model (each has 3–4), with no duplicate URL inside a model
  - all dates and statuses correct
- A superlative scan of the prose I wrote found none. "Most" appears only as a quantifier.

## Verification (transcript-based, 2026-10-06)

Independent check of this pack against the builder's own session transcript. Where this section and §1–§8 disagree, this section supersedes them.

### Method

1. **Transcript.** I located the builder transcript by its TASK-MARKER. It is the workflow agent file with 34 WebSearch calls. The newer marker match is this verifier's own session, which contains no builder searches. I extracted all 34 WebSearch result texts (link lists plus result text). There were no WebFetch calls.
2. **Ref test.** Every SourceRef in both JSON files was tested: 28 material refs, 28 model refs, 0 preset refs and 0 locality-factor refs, 56 in all. A ref passes only if three things hold:
   - its `url` is in a result's link list;
   - the `title` matches that link's title;
   - the `quote` appears verbatim, ignoring markdown bold and whitespace, **in the same result that lists the URL**. This is a co-occurrence test: a quote taken from a result that did not list the cited page is treated as misattributed.
3. **Recompute.** I recomputed every model from the per-publisher figures in its notes, after checking each figure against the transcript. Rule: one midpoint per publisher (the publisher's own median when it gives several closed ranges), then the median across publishers, rounded to the nearest ₹5,000 with ties rounded down. I also checked that low and high cover the cited sources, along with units, components, dates and status.
4. **Spot checks.** I ran 3 WebSearch calls of the 5 allowed:

| # | Domains | Query | Result |
|---|---|---|---|
| V1 | livspace.com | Modular Kitchen Cost Per Sq. Ft. 2026 cost by finish Laminate ₹1.5L – ₹2.5L budget-friendly and durable Acrylic ₹2.5L – ₹4L PU Finish ₹3L – ₹5L | Figures returned. The cost-per-sq-ft article was **not** in the link list; `kitchen-price-calculator` was. |
| V2 | homelane.com | modular kitchen from the first design conversation to final handover takes around 45 days | "For most standard projects, the entire journey from the first design conversation to final handover takes around 45 days." HomeLane-only result, with `homelane.com/interior-design/modular-kitchen-design` listed first. **HL_45 is confirmed** at the publisher level. |
| V3 | livspace.com | Livspace modular kitchen cost calculator price by finish laminate acrylic PU lakh budget-friendly high-gloss sleek finish luxury seamless | Figures returned, and the result text names "Livspace's calculator". Both the article and `kitchen-price-calculator` were listed. |

### Findings

- **53 of 56 refs passed as written.** No fabricated URL, title, publisher or quote was found: every URL, title and quote occurs in the builder's results.
- **3 refs failed the co-occurrence test**, all of them Livspace refs citing `https://www.livspace.com/in/magazine/modular-kitchen-cost-per-sq-ft` (LS_SQFT):
  - **Budget model**, quote "Laminate: ₹1.5L – ₹2.5L (budget-friendly and durable)". The verbatim text is only in builder result #5, whose link list does not include the article. Misattributed.
  - **Premium model**, quote "Acrylic: ₹2.5L – ₹4L (mid-range premium option with a high-gloss, sleek finish)". Also only in result #5, without the article. Misattributed.
  - **Parallel model**, quote "Cost Range: ₹2 Lakhs–₹3.8 Lakhs". The verbatim text is only in builder result #7, whose link list does not include the article. Result #29, which lists the article first, carries the same figure in different wording.
- **Where the Livspace finish figures come from.** Four result sets carry them: builder #5 and #17, and verifier V1 and V3. The only Livspace page listed in all four is `https://www.livspace.com/in/interiors/kitchen-price-calculator` ("Modular Kitchen Cost Calculator"). The article appears in only two (#17 and V3), and the builder's own pinning query #30 did not confirm it. The figures are therefore re-attributed to the calculator page, at medium page-level confidence. The publisher (Livspace) is certain.
- **Model values reproduce exactly.** All 7 expected values reproduce under the documented rule: 205,000; 325,000; 450,000; 240,000; 335,000; 455,000; 400,000. All lows and highs cover their cited closed ranges.
- **Structure is correct.** Units are `unit` everywhere, matching the ServiceDef. Components sum to 1.00. Rates are integers with low ≤ expected ≤ high. Every model has 3–4 publishers and no duplicate URLs. `valid_until` is 2027-04-04 and status is `draft`.
- **GST and labour basis.** No source states its GST basis. All figures are installed per-kitchen prices, so no material-only figure is mixed with labour-included ones. Appliance inclusion still differs between publishers, as already flagged in the notes.
- **Prose figures checked.** Figures in the FAQ, the duration basis and the material descriptions all trace to the results. These include ₹1,200–2,500/sq ft for Pune, accessories at ₹18,000–35,000, "4–6 weeks", "4 to 7 days", "around 45 days" and NoBroker's per-running-foot rates. "HomeLane's guides put acrylic at roughly 15–30%" combines two HomeLane results (15–25% and 20–30%) and is accurate.

### Changes made

1. **`modular-kitchen-laminate-board-budget`.** The Livspace ref now points to `https://www.livspace.com/in/interiors/kitchen-price-calculator` ("Modular Kitchen Cost Calculator"), with the verbatim V3 quote "Laminate costs ₹1.5L – ₹2.5L and is budget-friendly and durable, ideal for essential kitchens with simple designs." The notes name the calculator page. Figures and rates are unchanged.
2. **`modular-kitchen-acrylic-pu-premium`.** The Livspace ref is re-attributed to the same calculator page, with the verbatim V3 quote "Acrylic ranges from ₹2.5L – ₹4L and is a mid-range premium option with a high-gloss, sleek finish for a modern look." The notes name the calculator page. Figures and rates are unchanged.
3. **`modular-kitchen-parallel-standard`.** The Livspace ref keeps the article URL. Its quote is replaced with result #29's verbatim text, the result that lists the article first: "Straight/Parallel Kitchen: Average size 80-100 sq. ft., cost range ₹2 Lakhs–₹3.8 Lakhs, with cost per sq. ft. of ₹2,600–₹4,000". The notes now record that the row reads "Straight/Parallel" in one search reading and "Parallel" in the other (conflict C1). Rates are unchanged.
4. **NoBroker reference sizes.** The source says "workspace" (for example "8×6 ft, 14 ft workspace"), and the pack had rendered it as "of counter". It now says "of workspace" in 3 ServiceDef scope descriptions and in the L-shaped, U-shaped and parallel notes. The parallel note now gives the numbers: "more workspace (24 ft) than its L-shaped one (14 ft)".
5. **`hdhmr-board` description.** Removed the acronym expansion and the "alternative to plywood" claim, which no result supported because both refs are title-only. Corrected "Design Cafe ... guides on HDHMR for kitchen cabinets": its title says "for Home Interiors". The description now states only what the two titles support.
6. **No model was deleted.** No ref was removed outright, and every model keeps 3–4 publishers.

### Remaining caveats

- **Page-level attribution is inferred.** For every figure, the page comes from the search tool's synthesized text plus its link list. No page has been fetched. The Livspace calculator attribution is medium confidence. Re-open the pages before review.
- **The research log's §1–§8 is not rewritten.** It still describes LS_SQFT as the source of the finish figures and rates HL_45 as low-medium confidence. Read those rows with this section.
- **`node scripts/data-coverage.mjs`** shows 0 ERROR lines for modular-kitchen after these changes. Its 10 errors are files owned by other tasks: `data/localities.json`, `data/dishes.json` and 8 locality guides.
