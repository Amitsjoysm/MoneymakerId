# MarketMind AI: Data Policy

**Applies to:** every path that puts data into MarketMind AI (admin, CSV import, nightly pipeline, live Ask) and every page that shows it, on `marketmindai.com`, `food.marketmindai.com`, `construction.marketmindai.com` and `admin.marketmindai.com`.
**Implements:** spec §87 (Data Policy), §46–47 (evidence, freshness), §79 (verification), §96 (images); plan §6, §7, §8, §17, §19.
**Owner of this policy:** the site owner (MarketMind AI / Sarbanand). Changes need the owner's approval and a matching change to the code, tests and `CONTRACTS.md` where a literal value is involved.

The one-sentence version: **we derive small, dated, attributed facts from sources we are allowed to read; we never copy other people's content; and the only personal data we hold is what people send us in our own forms.**

---

## 1. Principles (spec §87)

1. **Attribution.** Every factual statement on a page carries at least one source (`SourceRef`: URL, title, publisher, retrieval date, optional short quote) and shows the date it was checked *(CONTRACTS §4; PLAN §0 item 5)*. A page claim without a source and a date fails the build *(PLAN §20)*.
2. **Retrieval dates.** Every source and every evidence row records `retrieved_at`. Every claim has a `valid_until` (Section 3). Visible "Updated" dates, sitemap `lastmod` and IndexNow submissions use the date the page's **content** last changed, never the build date *(PLAN §5)*.
3. **Derived facts only.** We store structured facts (a price, opening hours, "serves chicken biryani", "offers terrace waterproofing", a locality fact) rather than the source text. The system "should derive structured information rather than becoming a content-copying engine" (spec §87).
4. **Minimal reproduction.** The only text we keep from a source is a **supporting quote of 8–300 characters** that proves the claim *(PLAN §8)*. Raw HTML is never stored, only a content hash *(PLAN §6)*.
5. **No copying without rights.** We do not reproduce copyrighted articles, complete reviews, proprietary databases or images without rights (spec §87). In practice:
   - **Reviews:** never copy review text. A numeric rating may be used only from sources whose terms allow it, and only as a number *(PLAN §8)*.
   - **Articles and guides:** facts may be derived and cited; sentences are not copied beyond the short supporting quote.
   - **Photos:** only our own first-hand photos, or images a business has given us written permission to use (spec §96). We never hot-link or download images found on the web.
   - **Menus:** dish names and prices are facts; the menu's design, descriptions and photos are not copied.
6. **Aggregators are discovery-only.** Zomato, Swiggy, Justdial, Google Maps, Sulekha and similar platforms (the maintained list is `data/aggregators.json`) are **never scraped or fetched for content**. We may store an aggregator URL and its title as a pointer that a business exists, nothing more *(PLAN §8; spec §87; their terms)*. An aggregator page never counts as an independent source for auto-publishing.
7. **Respect for sources.** The pipeline fetches only public pages (official business sites, menus, articles, directories that permit it). It never logs in, never bypasses paywalls or bot protection, and backs off on errors *(PLAN §10)*.
8. **No fabrication, anywhere.** No invented businesses, prices, ratings, reviews, quotes, "verified" badges or scarcity *(PLAN §0 item 5, §13)*. Test fixtures are named "Example …" and the build fails if one reaches production *(CONTRACTS §6)*.

---

## 2. Where data comes from

| Path | What | How it is evidenced | Plan |
|---|---|---|---|
| **A. Admin** | Places, dishes, prices, hours, first-hand experiences and photos, providers, cost data, local facts | Each claim needs a source URL, or "visited" (first-hand) / owner-entered, plus the date checked | §7 |
| **B. CSV** | Bulk import using the templates in `data/curation/` | Required `source_url` (an `https://` URL, `visited` or `owner`) and `retrieved_at`; a dry run shows the diff first; rows starting with `EXAMPLE` are skipped | §7; CONTRACTS §6 |
| **C. Nightly pipeline** | Discover → fetch changed pages → extract → ground → dedup | Deterministic extraction first; Groq only for normalisation and classification; every claim grounded in a quote | §7, §8 |
| **D. Live Ask** | A database miss triggers a capped live lookup | Same grounding and independence rules; shown as "found on the web just now" | §7, §9 |

All four paths write through **one** database function (`upsert_business`), so no path can create duplicates or bypass the rules *(PLAN §7)*.

**Source kinds** *(CONTRACTS §3)*: `first_hand`, `owner_manual`, `csv`, `official_site`, `menu`, `directory`, `article`, `aggregator`. A `first_hand` source has no URL and links to an experience record instead.

---

## 3. Evidence and freshness tiers

Every claim is an **evidence row**: claim type, the claim, the supporting quote, the source, `retrieved_at`, `valid_until`, a confidence between 0 and 1, the extractor version, and a status (`active`, `superseded`, `rejected`) *(CONTRACTS §5)*.

`valid_until` = `retrieved_at` + the tier's time-to-live, unless the source states its own date (an offer's end date, for example) *(PLAN §8)*.

| Tier | Claim types *(CONTRACTS §8a, `CLAIM_TIER`)* | Time-to-live *(`TIER_TTL_DAYS`)* | What happens when stale |
|---|---|---|---|
| **HOT** | price, hours, offer, availability | 14 days (an offer lasts until its stated end) | Shown with a "Price last checked" date, or hidden; a build check enforces this |
| **WARM** | dish, service, phone, rating, mention | 60 days | Drops out of gate counts and the ranking's freshness score |
| **COLD** | address, locality fact | 365 days | As above |
| **COST** | cost rate (cost models) | 180 days | The page shows "being re-verified" with the last-reviewed date; the admin is alerted 30 days before expiry |

A claim is **stale** when the current time is after `valid_until`. Stale claims stop counting towards the quality gate, labels and freshness, but stay in history *(PLAN §5, §8)*.

### Grounding (how we stop invented facts)

- The supporting quote must be found in **the exact text chunk that was read**, after normalisation (NFKC, whitespace, Rs./INR/₹, Devanagari digits) *(PLAN §8)*.
- Code **re-derives the value from the quote**: the price in the quote must equal the claimed price, and the dish or locality name must appear in it. Any mismatch rejects the claim.

### Independence (what "two sources agree" means)

Two sources are independent only if they are on different registrable domains (eTLD+1), belong to different owner groups (the aggregator list), and their quoted passages are not near-duplicates *(PLAN §8)*.

### Auto-publish and review

- **Restaurants:** at least 2 independent sources agree on name and locality, and at least one dish claim is grounded.
- **Providers:** at least 2 independent sources agree on name and locality, and a service claim is grounded.
- Everything else waits in the admin approval queue. Auto-published places stay out of sitemaps until the owner reviews them *(PLAN §5, §8)*.
- **"Verified" is never automatic.** Only the owner sets it, with a method (website, phone, business documents, visit) and a date. A business is never marked verified because an AI found it (spec §79; PLAN §8).

### History

Changes to tracked fields are recorded automatically in an append-only `observations` table by a database trigger, whatever the write path (spec §68; PLAN §6). Superseded evidence is kept as history, not deleted.

---

## 4. AI providers and what they see

| Provider | Used for | Data it receives |
|---|---|---|
| **Exa** | Web search (pipeline discovery and live Ask) | Search queries built from the visitor's parsed intent (dish/service, locality, budget). Never lead data. |
| **Firecrawl** | Fetching public pages (pipeline) | Public URLs only. Never aggregator pages. |
| **Groq** | Normalisation, classification, ambiguous matching, review-signal extraction and summaries (spec §51) | Short chunks of public web text. **Never lead data, names or phone numbers of people who contact us.** |

Groq is **never authoritative** for prices, addresses or hours: those come from deterministic extraction or grounded quotes checked by code *(PLAN §8)*. If Groq is down or over budget, deterministic results continue and ambiguous items are queued. AI-drafted prose never appears on an indexable page until the owner marks it reviewed *(PLAN §5)*.

---

## 5. Personal data: leads only

**Rule:** personal data exists only where a person gave it to us through our own forms or messages: leads (`leads`, `lead_assignments`), business claims (`business_claims`) and the owner's alert channels. Phone numbers of people who contact us exist **only** in leads and claims *(PLAN §17)*.

| We collect | Where | Why |
|---|---|---|
| Name, phone (stored as E.164), service, locality, property type, ownership, timeline, area, tier, estimate, notes (≤ 500 characters) | `leads` | To handle the quote request and, with consent, share it with up to 3 matched contractors |
| Consent text version and time | `leads` | Proof of consent *(PLAN §13)* |
| Business name, category, locality, website, WhatsApp, email, description, services | `leads` (`business`) / `business_claims` | Featured, advertising, claim and for-contractors enquiries |
| Attribution: landing path, page type, referrer class, UTM tags, ranking run, ref code, experiment variant | `leads` | To know which pages produce leads; no browsing history beyond the landing page |
| `visitor_hmac`: a keyed hash of the IP address, with a secret that rotates daily | `leads`, rate limits, demand counts | Abuse limits and distinct-visitor counts **without storing the IP address**; it cannot be linked across days |
| Assignment, quoted and final amounts, outcome | `lead_assignments` | Resale accounting and anonymised local quote statistics |

What we **do not** collect or store:
- IP addresses, user agents or cookies in our own events. Events are aggregated into daily counts (`events_daily`) *(PLAN §16)*.
- Free text beyond 200 characters in Ask queries, and no IP address with them *(CONTRACTS §5)*.
- Precise location. "Near me" runs in the browser; the location is never sent to our servers *(PLAN §15)*.
- Personal data in analytics: names, phone numbers and emails are never sent to GA4 or Cloudflare Web Analytics.

**Business data is not personal data by default, with one exception.** A business's own published contact details (a restaurant's landline on its website) are business data. A number that belongs to an individual (a contractor's personal mobile) is never shown on public pages, never put in structured data, and never included in the public catalogue export *(CONTRACTS §5, §6a: "no individuals' phone numbers")*. The MarketMind AI WhatsApp number never appears inside business records or business structured data (spec §35; CONTRACTS §7).

**Sharing with contractors.** Only with the person's recorded consent; at most 3 contractors (shared) or 1 (exclusive). The admin forwards a **masked summary first** and releases the phone number only after a contractor accepts the assignment *(PLAN §13; CONTRACTS §5)*.

**Alerts.** Lead alerts go to the owner's private Telegram chat and the owner's verified inbox. These contain lead details, so the owner keeps the bot token secret, uses two-factor authentication on both accounts, and deletes old alerts on the retention schedule below.

**Synthetic tests** create no lead row and no alert *(CONTRACTS §7)*.

---

## 6. Retention

**Status: proposed defaults for owner approval.** The `prune` job (task P04c) implements them; the privacy policy states the lead periods publicly. Changing a period means changing this table, the privacy policy and the prune config together.

| Data | Kept for | Then |
|---|---|---|
| Leads (all `lead_type`s), including assignments | **24 months** from creation, or less if the person withdraws consent or asks for deletion | **Anonymise** with `admin_api.lead_anonymise`: remove name, phone, notes, message, business contact fields and `visitor_hmac`; keep service, locality, area, tier, estimate and quoted/final amounts for anonymised quote statistics |
| Leads marked `spam`, and test leads | 30 days | Delete |
| Lead outbox entries in KV (`LEADS_OUTBOX`) | Until replayed into the database (normally minutes); any entry older than 30 days is reviewed and deleted. `synthetic:` keys are purged automatically | Delete |
| Telegram and email lead alerts | Same as the lead (24 months) | Owner deletes them in a quarterly clean-up |
| Business claims and business enquiries | 24 months after the last contact | Anonymise or delete. **Reviewer:** paid customers' invoices may need to be kept longer under tax and accounting law; confirm with an accountant |
| Feedback notes (≤ 500 characters) | 24 months | Delete the note, keep the count |
| Ask queries (`queries`, ≤ 200 characters of text) | 12 months | Keep the parsed intent only; delete the text |
| `ask_lookups` results | 90 days | Delete (the useful results already live as evidence) |
| Aggregated events (`events_daily`), demand counts (`demand_daily`) | 24 months | Delete. These hold no personal data |
| Search Console imports (`search_demand`) | 16 months | Delete |
| `rate_buckets` | 2 days | Delete |
| `system_events` | 90 days | Delete |
| `jobs` | 180 days | Delete |
| Sources and evidence | While the entity exists; superseded or rejected rows 24 months | Delete old superseded rows. Hashes only, never raw HTML |
| `observations` (history of changes) | Kept: it is the spec §69 training dataset and holds no personal data | Review size in the health report |
| Encrypted database backups | 30 days *(PLAN §19)* | Expire automatically |
| GitHub Actions logs and artifacts | 30 days (repository setting) | Expire automatically. Logs must never contain personal data or secrets |

---

## 7. Storage limits

- **Supabase Free: 500 MB** of database *(PLAN §6, §23)*. The health report shows the database size every day.
- **Warning thresholds (proposed):** a warning in the health report at 350 MB (70%), an owner alert at 425 MB (85%). At the alert level, the prune job runs immediately and new pipeline discovery pauses until the owner decides.
- Keep the database small by design: raw HTML is never stored (hashes only); events are aggregated, never stored one row per event; old rows are pruned on schedule *(PLAN §6)*.
- **Photos:** resized to WebP on the owner's phone before upload, stored in a private bucket, and copied into the static build. Public pages never load images from Supabase *(PLAN §19; CONTRACTS §6)*.

---

## 8. Requests about personal data

### 8.1 Deletion, correction or access (people who sent us a form)

1. **Channels:** email to the contact address on the privacy page, or WhatsApp to 91 98343 46179.
2. **Check identity** without collecting more data: the request must come from the same phone number (WhatsApp) or email address that is on the lead. Otherwise, send a confirmation message to the number on the lead and act only after a reply.
3. **Acknowledge within 7 days; complete within 30 days** (proposed service levels, stated in the privacy policy).
4. **Steps for deletion:**
   - find every lead and claim with that phone or email in the admin;
   - run **anonymise** on each one (`admin_api.lead_anonymise`);
   - delete any matching `LEADS_OUTBOX` entries;
   - delete the matching Telegram and email alerts;
   - tell any contractor who received the details to delete them, and note the date you did so on the lead (no personal data in the note);
   - add a line to the **deletion log**: lead id(s) and date only. If a backup is ever restored, re-apply every deletion in the log before the restored database goes live.
5. **Confirm** to the person when it is done.
6. **Correction:** edit the lead in the admin. **Access:** send the person a summary of what we hold about them and who it was shared with.
7. **Withdrawal of consent:** stop any further sharing at once, tell contractors who already received the lead, and anonymise it unless the person only wants to stop contact (then set the lead status to `lost` and stop follow-ups).

### 8.2 Businesses and individuals named in listings

- A business can correct its listing through `/claim-business/` or by contacting us. Corrections follow the Editorial Policy (corrections process).
- An individual whose personal details appear in a listing (for example a sole contractor's personal number) can ask us to remove them; we do so within 7 days.
- We do not remove accurate, sourced **business** information only because a business asks, unless the law requires it.

### 8.3 Breaches

If personal data is exposed (a leaked key, a lost device with alerts on it), the owner: rotates the affected secrets the same day (see `docs/DEPLOY.md`, Golden rules), records what happened in `system_events`, and informs affected people and the authorities as Indian law requires. **Reviewer:** confirm the notification duties and deadlines under the DPDP Act and Rules.

---

## 9. Checks that enforce this policy

From PLAN §17 and §20 (the build fails if any is broken):
- every rendered claim shows a source and a date; no stale claim is unlabelled;
- no "#1 best" copy; no unreviewed AI prose on an indexable page;
- no WhatsApp number inside business data;
- no secret patterns (`sb_secret_`, `gsk_`, `fc-`, the Exa key format) in any build output;
- no fixture ("Example …") business in a production build;
- pgTAP: public roles have zero table privileges, and `api.export_catalogue()` returns no leads and no individuals' phone numbers.

---

## 10. Gaps and open items

- Retention periods in Section 6 and the storage thresholds in Section 7 are **proposals** awaiting owner approval.
- The legal timetable of India's Digital Personal Data Protection Rules (which obligations apply on which date) could not be verified while drafting; the privacy policy is written to meet the Act's obligations from launch day regardless. A lawyer should confirm before launch.
- Accounting retention for paid customers (Section 6) needs an accountant's confirmation.
