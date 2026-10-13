---
version: 1
slug: "packages-ui"
primary_target: "packages/ui"
related_targets: ["apps/construction","apps/food","apps/main"]
---

# Surface brief: MarketMind AI design system and first surface

## Scope and mode
The shared design system in `packages/ui` (tokens, layout, components) for all three public hosts, proven on the first real surface: the construction locality × service cost page (for example "Terrace waterproofing cost in Wakad, Pune"). Visitor mode: **Read**, with one action (get quotes). Food pages and the brand host inherit the same world later.

## Audience, job and action
A Pune flat owner on an Android phone, arriving from Google or an AI answer, who wants to know what the job should cost in their locality, whether to believe it, and how to get quotes. Owner's answers (13 Oct 2026): the price range and an estimate come first, with "Get quotes" right below; a generic agency or SaaS look (gradients, glass, 3D blobs) would feel wrong; TechResona is the master brand, with a construction accent and a food accent.

## Proof and constraints
Every figure shows its source and check date (PRODUCT.md). There are no invented prices, ratings or reviews: fixtures use real `data/cost-models` values with their real sources, or are labelled synthetic. Paid placement is always labelled. WCAG 2.2 AA. Phones first.

## Direction contract
THESIS: Every number is a claim with a custody line. One magenta evidence ribbon threads each price to its sources and check dates: solid where sourced, dashed where estimated. Trust is shown, not asserted. It refuses the category default of anonymous price cards, star badges and stock-photo hero banners.

OWN-WORLD:
- Plum-tinted paper ground (`#FAF6FA`, surface `#F3E9F4`, border `#D9C0DE`) and plum ink (`#2A1130`, muted `#6E4A72`).
- One magenta ribbon (`#A6237F`) is both the evidence line and the only action colour. Signal `#E0435F` marks stale or outdated facts only.
- Accents: construction in blueprint ink, food in turmeric, on locality and place markers only.
- Space Grotesk for display numerals and tracked uppercase labels; Manrope for the reading column.
- Ribbon-tab section markers, round date stamps for first-hand visits, dashed hairlines for inference.
- Dark theme: a plum-black ground with a brighter ribbon.

STORY: The visitor sees the locality's range, sees who says so and when, estimates their own job, and taps "Get quotes on WhatsApp", believing the figure because they can trace it.

FIRST VIEWPORT (390px phone):
- a host strip with the wordmark and the vertical's label;
- the breadcrumb Pune › Wakad › Waterproofing;
- the H1;
- the ribbon starting at the range (per-unit, Space Grotesk, the largest thing on screen) and branching to 2–3 dated source nodes;
- estimate chips (BHK presets, quantity input) whose live total rides a dashed ribbon segment;
- "Get quotes on WhatsApp" (primary) and "Report outdated" where the ribbon splits, above the fold.

Signature interaction: tapping a source node unfolds its slip (publisher, quote, retrieved date) in place. The ribbon draws on scroll, and with reduced motion it renders already drawn.

FORM: Evidence ribbon, a fusion of the catalogue challenger "provenance ribbon" (verdict: competitive). The owner chose it over the assigned grounded direction (#5 of 7, the society notice board) and the pick (#1, the contractor's estimate sheet). Seed key 5acfbb60.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- Whether a "by TechResona" endorsement appears (owner decision; keep a footer slot, off by default).
- Marathi and Hindi type pairing for M6. Anek Devanagari is installed; confirm it in M6.
