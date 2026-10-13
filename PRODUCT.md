# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary audiences carry equal weight (owner's answer, 13 Oct 2026):

- **Homeowners pricing home work.** Pune flat and house owners who want to know what waterproofing, painting, a bathroom renovation, a modular kitchen or house construction should cost in their locality, and then get quotes from local providers. They usually arrive from a Google search or an AI answer, on a phone.
- **People deciding where to eat.** Pune residents, office-goers (for example in Hinjewadi or Kharadi) and visitors choosing where to get a specific dish (biryani, misal pav, vada pav…) in or near a specific locality, often with a budget, a diet (veg, Jain) or a time constraint ("open now", late night).

Secondary audiences:

- **Local contractors and service providers** who receive quote leads, apply through `/for-contractors/`, and may buy featured placement.
- **Local businesses and advertisers** who claim a listing, buy featured listings or sponsor a locality or category.
- **The owner** (Sarbanand, MarketMind AI), who runs the private admin: lead follow-ups, first-hand experiences, curation, publishing and revenue.
- **Search engines and AI answer engines**, which should be able to cite the site's pages and recommend them.

## Product Purpose

MarketMind AI is a Pune local decision engine. It answers "what should this cost here?" and "where should I get this dish here?" for one locality at a time, with every claim cited and dated.

Success means local search traffic that turns into revenue: construction quote leads first, then featured listings and sponsorships, then ads. Launch is construction first (M1), food follows (M3).

## Positioning

Visitors should trust MarketMind AI over Zomato, Justdial or UrbanCompany for four reasons, all of which the owner confirmed:

1. **Cited, dated facts.** Every price, cost range and recommendation shows its source and the date it was checked. Nothing is invented, and paid placement is always labelled and never changes organic ranking.
2. **Hyper-local answers.** Answers are specific to one Pune locality (Wakad, Baner, Hinjewadi Phase 1…), not city-wide lists.
3. **The owner's first-hand visits.** The owner's own visits and judgement are a visible part of recommendations, backed by sources.
4. **Fast free quotes.** The quickest route from a cost estimate to quotes from local providers, with a one-tap WhatsApp handoff.

## Operating Context

- **Hosts:** `marketmindai.com` (brand, trust and locality guides), `food.marketmindai.com` (dish × locality recommendations), `construction.marketmindai.com` (cost guides, calculator and quote leads), and the private `admin.marketmindai.com` behind Cloudflare Access.
- **Visitors** are mostly on phones, on Indian mobile networks, arriving from Google or an AI answer. WhatsApp is the channel they expect for follow-up.
- **Units and conventions:** rupees (integer INR), square feet and running feet, IST (Asia/Kolkata), Pune locality names and their common misspellings.
- **Languages:** English first; Marathi and Hindi versions of the top pages come in M6 (Devanagari).
- **Delivery:** static pages built from a database snapshot; live lookups happen only through the capped Ask feature (50 a day).

## Capabilities and Constraints

- **Construction (M1):** cost guides for 5 services and 7 sub-services, a cost calculator with BHK presets, locality × service pages, an inline quote funnel with consent, a thank-you state with a reference code and a WhatsApp button, provider profiles, and `/for-contractors/`.
- **Food (M3):** dish × locality recommendation pages, place profiles, filters (open now in IST, opt-in "near me" that never sends location to the server) and an Ask box.
- **Brand host:** locality guides, about, editorial policy, legal and trust pages, advertise, feature-your-business and claim-a-business.
- **Admin:** a leads inbox with follow-ups and assignments, provider and place management, first-hand experiences with photos, curation and publishing.
- **Hard rules:**
  - No fabricated businesses, prices, ratings, reviews, sources or search volumes.
  - A page that fails the quality gate is not built, and thin pages are never padded.
  - Paid placement is always labelled.
  - The WhatsApp number 919834346179 appears only on MarketMind AI contact and CTA surfaces, never in business data or business JSON-LD.
  - Page views never call AI or crawlers.
  - Free tiers only.
- **Terminology:** "locality" (not "area" or "neighbourhood"), "provider" (a contractor or service business), "place" (a food business), "cost guide", "quote", "featured" (paid placement), "first-hand" (the owner's own visit).
- **Undecided:**
  - the legal entity name and other legal placeholders (`{{LEGAL_NAME}}`, `{{CONTACT_EMAIL}}`, `{{GRIEVANCE_OFFICER}}`, `{{POSTAL_ADDRESS}}`);
  - the final reminder-consent wording;
  - whether TechResona appears as an endorsement ("by TechResona") or as the legal entity.

## Brand Commitments

- **Name:** MarketMind AI.
- **Brand assets come from techresona.com** (owner's answer, 13 Oct 2026). This is binding, and where it conflicts with the earlier plan §15 palette and type notes, the TechResona identity wins. Whether §15's vertical accents survive as secondary tints is a design-system decision. As published at techresona.com on 13 Oct 2026, the assets are:
  - **Colour tokens:**
    - text `#2A1130`, muted `#6E4A72`, faint `#9C7CA0`;
    - background `#FAF6FA`, surface `#F3E9F4`, elevated `#FFFFFF`, border `#D9C0DE`;
    - accent `#A6237F` (hover `#861C67`), signal `#E0435F`.
  - **Typefaces:** Space Grotesk (display), Manrope (body), JetBrains Mono (mono).
  - **Radii:** 8 / 14 / 24 px.
  - **Logo mark:** a cloud with circuit traces, rising buildings and a sweeping orbit in a magenta-to-red gradient (`https://techresona.com/assets/img/logo-mark.png`).
- **Voice:** the owner chose all three offered voices together: plain local English, friendly with the occasional Hindi or Marathi word, and the measured tone of an expert. _Inferred mapping, to confirm in review:_
  - plain local English is the default everywhere;
  - friendly, light Hinglish fits food pages and conversational microcopy;
  - the expert register fits cost guides, methodology and trust pages.

  There is never hype, and never jargon without a plain explanation.

## Evidence on Hand

- `data/cost-models/*.json`: 48 cited cost models, one or more for every one of the 10 leaf construction services. Citations were verified against the research transcripts.
- `data/services/*.json`: 5 construction service packs. `data/*.json` holds the configs (gate, lead pricing, ad slots, experiments, seasonal calendar, aggregators).
- `data/sources/locality-facts-*.json`: 72 locality facts, unverified drafts.
- `content/locality-guides/*.md`: 8 locality guides, AI-drafted and awaiting the owner's review.
- `content/legal/*.md`: legal drafts with placeholders.
- **Absent, and must not be fabricated:**
  - customer testimonials, reviews, ratings, lead counts or traffic numbers;
  - partner logos or press mentions;
  - real business listings (fixtures use "Example …" names only);
  - photos (the owner's experience photos arrive through the admin later).

## Product Principles

1. **Show the source, show the date.** A claim without a visible source and check date does not ship.
2. **The visitor's task comes first.** Price range, recommendation or quote form before anything else; no popups, no autoplay, no hero padding.
3. **Local or nothing.** Every page earns its place with locality-specific substance; a page that cannot do so is not built.
4. **Paid never looks organic.** Featured, sponsored and ad placements are labelled and never change organic ranking.
5. **Quick to quote, easy to trust.** The path from estimate to quote is short, honest about how many providers will respond, and ends in a WhatsApp handoff the visitor controls.

## Accessibility & Inclusion

- WCAG 2.2 AA:
  - semantic HTML and full keyboard use;
  - visible focus and contrast of at least 4.5:1;
  - labelled forms, with errors announced to screen readers.
- Mobile-first on low-end Android phones and slow networks: large tap targets, a dismissible sticky action bar, light pages.
- Marathi and Hindi (Devanagari) support in M6, so type choices must have a Devanagari path.
