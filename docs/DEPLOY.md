# MarketMind AI: Deployment Guide (free tiers only)

This guide takes you, the owner, from "I own `marketmindai.com`" to "four live hosts, leads arriving on my phone". You do not need to be a developer. Every service used here is on a **free plan**. Nothing in this guide needs a credit card, except AdSense payouts much later.

**What you will end up with**

| Host | What it is | Who can see it before launch | After launch |
|---|---|---|---|
| `marketmindai.com` | Brand site, Pune locality guides, legal and business pages | Only you (Cloudflare Access) | Public |
| `food.marketmindai.com` | Food discovery | Only you | Public |
| `construction.marketmindai.com` | Cost guides, calculator, quote forms (launches first) | Only you | Public |
| `admin.marketmindai.com` | Your private admin | Only you, always | Only you, always |

**How to read this guide**

- Do the parts in order (A → K); Part L (AdSense) comes months later and Part M is a reference table. Each part ends with a short "Done when" check.
- Dashboards get renamed often. If a button has a slightly different name, pick the closest match; the **why** in each step tells you what you are trying to achieve.
- Facts marked *(PLAN §N)* were verified against official vendor documentation on 6 Oct 2026 (see `docs/PLAN.md`, Appendix). Click paths are written from general product knowledge and could not be re-checked from this build environment, so trust what the live dashboard shows over this text.
- Text like `{{SOMETHING}}` is a value you fill in. Nothing else in this guide is a placeholder.

**Golden rules for secrets**

1. Secrets (keys, tokens, passwords) go **only** into Cloudflare and GitHub settings. Never paste them into chat, email, WhatsApp, an issue, a pull request or a file in the repository *(PLAN §17, §22)*.
2. Keep a password manager (Bitwarden, 1Password, or your phone's built-in one) and store every value from this guide there as you create it.
3. Turn on two-factor authentication for Cloudflare, Supabase, GitHub, Google and Telegram.
4. If a secret ever leaks, rotate it (create a new one, update it everywhere, delete the old one) the same day.

---

## Part A · Before you start (15 minutes)

1. Create a dedicated Gmail address for the business if you do not have one, for example the address you will use for alerts and logins. Use the **same** address for Cloudflare Access login (Part C4), alert emails (Part D) and Search Console (Part I).
2. Find out **where `marketmindai.com` is registered** (GoDaddy, Hostinger, BigRock, Namecheap…) and make sure you can log in there. You only need it once, to change the nameservers.
3. Write down whether the domain currently:
   - **receives email** (for example `you@marketmindai.com` through Google Workspace or Zoho). If yes, read the warning in Part D before turning on Email Routing.
   - **serves a website** you want to keep online until launch. If yes, keep its DNS records when Cloudflare imports them (Part B2).
4. On your computer, have a terminal available only if you want to generate random values yourself (Part F1). Otherwise you can generate them in GitHub Actions (also Part F1).

**Done when:** you can log in to your registrar, and you know whether the domain has email or a live site.

---

## Part B · Cloudflare account and moving DNS (30 minutes, then up to 48 hours of waiting)

### B1. Create the account

1. Go to `https://dash.cloudflare.com/` and sign up with your business email. Verify the email.
2. Turn on two-factor authentication: **My Profile → Authentication**.

### B2. Add the domain (Free plan)

1. In the dashboard choose **Add a domain** (sometimes "Onboard a domain").
2. Enter `marketmindai.com`. Choose a quick scan of existing DNS records.
3. Pick the **Free** plan.
4. **Review the imported DNS records carefully.** Keep every `MX` and `TXT` record (email and verification) exactly as imported. If the domain currently serves a site you want to keep, keep its `A`/`CNAME` records too. You will replace the apex and subdomain records with Workers in Part G.
5. Cloudflare now shows **two nameservers** (each ends in `ns.cloudflare.com`). Copy both.

### B3. Change the nameservers at your registrar

1. **First, turn off DNSSEC at your registrar** if it is on. Changing nameservers with DNSSEC still on can make the domain unreachable.
2. In your registrar's domain settings, find **Nameservers**, switch to **custom nameservers**, delete the old ones and paste the two Cloudflare nameservers.
3. Save. The change usually takes effect within a few hours but can take up to two days. Cloudflare emails you when the domain is **Active**.
4. After it is active: in Cloudflare go to **DNS → Settings → DNSSEC → Enable**, copy the DS record it shows, and add it at your registrar (registrars call this "DNSSEC" or "DS records").

> **Why move DNS now, before launch?** Cloudflare Access, Turnstile, Email Routing and Workers custom domains all need the domain on Cloudflare. Moving DNS early does **not** make the sites public: the public hosts stay behind Cloudflare Access with `noindex` until the launch gate passes *(PLAN §20)*. "Pointing DNS at launch" in the plan therefore means removing the pre-launch lock (Part K), not changing nameservers again.

### B4. Baseline zone settings

In the dashboard, open `marketmindai.com`:

1. **SSL/TLS → Edge Certificates:** turn on **Always Use HTTPS**; set **Minimum TLS Version** to 1.2. Leave Cloudflare's own HSTS setting **off**: our `_headers` files already send HSTS *(PLAN §17)*, and HSTS "preload" is hard to undo, so do not enable preload at launch.
2. **Security → Bots:** leave **Bot Fight Mode off**. It challenges automated traffic, which can include our own GitHub Actions health checks and the AI crawlers we want to allow *(PLAN §1: allow all AI bots)*.
3. **Speed / Caching:** leave defaults. Static pages are served from Workers static assets; the code controls caching.
4. Do **not** turn on any Cloudflare feature that injects scripts into pages (for example automatic Web Analytics injection or "Rocket Loader"). Our pages use a hash-based Content-Security-Policy *(PLAN §17)*, so injected scripts would be blocked or would break the policy.

**Done when:** the domain shows **Active** in Cloudflare, DNSSEC is re-enabled, and Always Use HTTPS is on.

---

## Part C · Security: AI crawlers, rate limit, Turnstile, Access (45 minutes)

### C1. AI Crawl Control: allow every AI crawler

The plan's decision is to **allow all AI bots**: search, user-fetch and training *(PLAN §1, §12)*. Cloudflare blocks AI training and AI agent bots **by default on new domains** *(PLAN §12; Cloudflare changelog "AI traffic options", listed in the PLAN Appendix)*, so you must switch this off by hand.

1. Open the zone → **AI Crawl Control** (older dashboards call it "AI Audit"; the setting also appears under **Security → Bots** as "Block AI bots" / "AI Scrapers and Crawlers").
2. Set the zone-level choice to **do not block / allow**.
3. On the **Crawlers** list, make sure every crawler shows **Allow**, including GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended and CCBot *(PLAN §12)*.
4. Turn **off** any option that writes AI rules into `robots.txt` for you ("managed robots.txt" or similar). Our own `robots.txt` already allows every bot, and the build fails if it ever contains `Disallow: /` *(PLAN §20)*.
5. Turn **off** "AI Labyrinth" or any decoy/trap feature for bots, and leave "pay per crawl" off.
6. If your dashboard offers to **sync bot preferences** across zones or into other settings (the build brief calls this "Bot Preference Sync"), make sure the preference it syncs is **Allow** for every AI crawler. This guide could not verify how that option behaves; check it once more on launch day (Part K).

**Done when:** every AI crawler shows Allow, and no managed `robots.txt` is active.

### C2. One WAF rate-limiting rule on `/api/*`

The free plan includes one rate-limiting rule; we use it on the API *(PLAN §17)*.

1. Zone → **Security → WAF → Rate limiting rules → Create rule**.
2. Name: `api-burst`.
3. **If incoming requests match:** field **URI Path**, operator **starts with** (or **contains** if "starts with" is not offered on the free plan), value `/api/`.
4. **Counting characteristic:** IP (the only one on the free plan).
5. **Rate:** start at **20 requests per 10 seconds**; **action: Block**; duration: the shortest offered. The free plan only offers a few fixed choices; pick the closest.
6. Deploy the rule.

Why 20 per 10 seconds: a real visitor sends a few event beacons, one form submission and, on the Ask page, a short burst of result polls. Twenty leaves room for that and for several people behind one mobile carrier IP, while stopping scripted floods. The code has its own per-visitor limits as a second layer *(PLAN §9, §17)*.

**Done when:** the rule is listed as active.

### C3. Turnstile (bot check on forms and live Ask)

1. Dashboard (account level) → **Turnstile → Add widget** (or "Add site").
2. Name: `marketmindai-forms`.
3. Hostnames: add all three public hosts: `marketmindai.com`, `food.marketmindai.com`, `construction.marketmindai.com`.
4. Widget mode: **Managed**.
5. Create. Copy the **Site key** and the **Secret key** into your password manager.
6. Where they go:
   - **Site key** → GitHub secret `TURNSTILE_SITE_KEY` (it is rendered into the forms at build time).
   - **Secret key** → Cloudflare Worker secret `TURNSTILE_SECRET_KEY` on the **main, food and construction** Workers (Part G4). Never in GitHub *(CONTRACTS §10)*.

**Done when:** both keys are saved.

### C4. Cloudflare Access (Zero Trust, free): the admin and the pre-launch lock

You will create **two** Access applications:

- **`mm-admin`**: protects `admin.marketmindai.com` **forever**.
- **`mm-prelaunch`**: protects the three public hosts **until launch day**, so nobody (and no search engine) sees unfinished pages *(PLAN §20; TASKS DOC1 acceptance: pre-launch Access on all four hosts)*.

**Set up Zero Trust once**

1. Go to the Zero Trust dashboard (from the main dashboard choose **Zero Trust**, or open `https://one.dash.cloudflare.com/`).
2. Choose a **team name** (for example `marketmind`). Your **team domain** becomes `https://{{TEAM_NAME}}.cloudflareaccess.com`. Save it: this is `ACCESS_TEAM_DOMAIN`.
3. Choose the **Free** plan.
4. **Settings → Authentication → Login methods:** make sure **One-time PIN** is available. It is the only login method we use *(PLAN §1)*.

**Application 1: `mm-admin`**

1. **Access → Applications → Add an application → Self-hosted**.
2. Name `mm-admin`; session duration 24 hours (shorter is safer; longer is more convenient).
3. Public hostname: subdomain `admin`, domain `marketmindai.com`, path empty.
4. Identity providers: **One-time PIN** only. Turn on "instant auth" if offered, so you go straight to the PIN screen.
5. Policy: name `owner-only`, action **Allow**, **Include → Emails →** your own email address. Nothing else.
6. Save. Open the application again and copy the **Application Audience (AUD) Tag** from its overview. Save it: this is `ACCESS_AUD`.

The admin Worker checks the `Cf-Access-Jwt-Assertion` header's signature, audience and issuer on every request, using `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` *(PLAN §14)*. If either value is wrong, the admin refuses every request; that is the intended failure mode.

**Application 2: `mm-prelaunch`**

1. Add another **Self-hosted** application named `mm-prelaunch`.
2. Add **three** public hostnames: `marketmindai.com` (subdomain empty), `food.marketmindai.com`, `construction.marketmindai.com`.
3. Same login method and the same `owner-only` policy. Add the emails of anyone reviewing the site with you (a lawyer, a friend testing on their phone).
4. Save.

> **Known gap (reported to the orchestrator):** while `mm-prelaunch` is on, GitHub Actions health checks and synthetic lead tests cannot reach the public hosts, because Access will ask them to log in. The fix is an Access **service token** whose ID and secret GitHub Actions send as headers. That needs two new GitHub secrets that are not yet in `CONTRACTS.md` §10, so it is not set up here. Until it is, expect the pre-launch health report to show the public hosts as "blocked by Access". That is not an outage.

**Done when:** opening `https://admin.marketmindai.com/` in a private browser window asks for your email and a PIN (it will show an error page after login until Part G is done; that is fine).

---

## Part D · Alerts: email and Telegram (20 minutes)

Every new lead, disabled key, dead-man alert and daily health report goes to **both** Telegram (instant push) and email (searchable record) *(PLAN, Resolved questions Q-D)*.

### D1. Cloudflare Email Routing and the `send_email` binding

> **Warning: check this before you start.** Email Routing replaces the domain's `MX` records. If `marketmindai.com` already receives email through another provider (Part A3), **stop here** and ask the developer: alerts can then be sent through a different route, and enabling Email Routing would cut off your existing mailbox.

1. Zone → **Email → Email Routing → Get started / Enable**. Let Cloudflare add the `MX` and `TXT` (SPF) records it proposes.
2. **Destination addresses → Add** your personal alert inbox (for example your Gmail). Open the verification email and click the link. The address must show **Verified**.
3. Add a custom address `alerts@marketmindai.com` that forwards to the same verified inbox (useful for replies).
4. The Workers send alerts through a **`send_email` binding** named `ALERT_EMAIL`, restricted to that verified destination *(CONTRACTS §10)*. The binding itself lives in each Worker's Wrangler config file in the repository; you only need to give the developer the **verified destination address** (it is not a secret).
5. When the first alert arrives, mark it **Not spam** in Gmail so later alerts land in your inbox.

**Done when:** your destination address shows Verified.

### D2. Telegram bot and chat id

1. In Telegram, open a chat with **@BotFather** (`https://t.me/BotFather`; check for the blue verified tick).
2. Send `/newbot`. Give it a name (`MarketMind Alerts`) and a username ending in `bot` (for example `marketmind_alerts_bot`).
3. BotFather replies with a **token**. Save it as `TELEGRAM_BOT_TOKEN`. Anyone with this token controls the bot, so treat it like a password.
4. Open your new bot in Telegram and press **Start**, then send it any message ("hello").
5. In a browser, open `https://api.telegram.org/bot{{TELEGRAM_BOT_TOKEN}}/getUpdates` (paste your token in place of `{{TELEGRAM_BOT_TOKEN}}`, with no space after `bot`).
6. In the text that appears, find `"chat":{"id":` followed by a number. Save that number as `TELEGRAM_CHAT_ID`. (If you see `"result":[]`, send the bot another message and reload.)
7. Close that browser tab and clear it from history: the URL contains your token.

**Done when:** you have `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in your password manager.

---

## Part E · Supabase (database) (30 minutes)

### E1. Create the project

1. Go to `https://supabase.com/dashboard`, sign up (GitHub login is fine), and turn on two-factor authentication.
2. **New project**: organisation on the **Free** plan; name `marketmind`; **Region: Mumbai (`ap-south-1`)**, which keeps Indian visitors' lead data close and fast.
3. Generate a strong **database password** and save it in your password manager. You need it for `SUPABASE_DB_URL`.
4. Wait for the project to finish provisioning.

Free-plan limits to know *(PLAN §6, §19, §23)*: 500 MB of database, **no backups** (we make our own nightly, encrypted), and the project **pauses when inactive** (our nightly jobs count as activity, and the dead-man alert catches gaps).

### E2. Create the NEW API keys (publishable + secret)

The plan uses Supabase's new API keys, not the legacy `anon` / `service_role` JWT keys *(PLAN §0 item 6)*.

1. **Project Settings → API Keys**. Open the tab for the new **publishable and secret** keys and create them if they do not exist yet.
2. Copy:
   - the **publishable key** (starts with `sb_publishable_`) → `SUPABASE_PUBLISHABLE_KEY`. It is safe in public Workers because those can call only the vetted `api.*` functions *(PLAN §6)*.
   - the **secret key** (starts with `sb_secret_`) → `SUPABASE_SECRET_KEY`. It goes **only** into the admin Worker and GitHub Actions *(PLAN §17)*. CI fails the build if `sb_secret_` ever appears in build output.
3. Copy the **Project URL** (`https://{{PROJECT_REF}}.supabase.co`) → `SUPABASE_URL`.
4. **After the first successful deploy** (Part G), come back and **disable the legacy JWT-based keys** so that only the new keys work.

### E3. Lock down what the API exposes

1. **Project Settings → Data API** (sometimes under Integrations): set **Exposed schemas** to exactly `api` and `admin_api` *(CONTRACTS §5)*. The `app` schema, which holds every table, must never be exposed. (If the migrations' own README later says otherwise, follow it.)
2. **Authentication → Sign In / Providers:** turn **off** "Allow new users to sign up". We do not use Supabase logins; admin login is Cloudflare Access.

### E4. Session pooler connection string (for backups and migrations)

1. Click **Connect** at the top of the project.
2. Choose **Session pooler** (not "Direct connection", which is IPv6-only and does not work from GitHub Actions; the plan uses the IPv4 session pooler *(PLAN §19)*).
3. Copy the URI. It looks like `postgresql://postgres.{{PROJECT_REF}}:{{DB_PASSWORD}}@{{POOLER_HOST}}:5432/postgres`. Replace the password part with your database password.
4. Save the whole string as `SUPABASE_DB_URL`. It goes **only** into GitHub Actions.

### E5. Backup encryption key (`age`)

Backups are encrypted with `age` to a public key; the private key never leaves your possession *(PLAN §19)*.

1. On your own computer, install `age` (from your package manager), then run `age-keygen -o marketmind-backup.key`.
2. The command prints a **public key** starting with `age1`. Save it as `BACKUP_AGE_RECIPIENT` (GitHub secret).
3. Copy `marketmind-backup.key` (the **private** key) to **two offline places** (a USB stick in a drawer and a printed copy). Without it, backups cannot be restored. Do not upload it anywhere.

**Done when:** you have `SUPABASE_URL`, both keys, `SUPABASE_DB_URL`, and `BACKUP_AGE_RECIPIENT`; legacy-key disabling is on your list for after Part G.

---

## Part F · GitHub: secrets, variables and tokens (30 minutes)

Repository: `Amitsjoysm/MoneymakerId` *(PLAN §22)*. Go to **Settings → Secrets and variables → Actions**. If the workflow files use a GitHub **environment** (look for `environment:` in `.github/workflows/deploy.yml`), add the values under **Settings → Environments → that environment** instead.

### F1. Generate random values

Several values are just long random strings. Either:

- on a computer with a terminal: run `openssl rand -hex 32` once per value; or
- ask the developer to run the repository's "generate secrets" helper if one exists. Never reuse one random value for two purposes.

You need random values for: `VISITOR_HMAC_SECRET`, `SYNTHETIC_SECRET`, `INDEXNOW_KEY` (use `openssl rand -hex 16` for this one).

### F2. Cloudflare API token and account id (for `wrangler deploy` from GitHub Actions)

1. Cloudflare dashboard → **My Profile → API Tokens → Create Token**.
2. Use the **Edit Cloudflare Workers** template.
3. **Account Resources:** Include → your account. **Zone Resources:** Include → Specific zone → `marketmindai.com`.
4. Leave client IP filtering empty (GitHub's runners use changing IPs). Set an expiry date about a year out and put a renewal reminder in your calendar.
5. Create, copy the token **once** → `CLOUDFLARE_API_TOKEN`.
6. Your **Account ID** is shown on the **Workers & Pages** overview page (right-hand side) and in the dashboard URL right after `dash.cloudflare.com/`. Copy it → `CLOUDFLARE_ACCOUNT_ID`.

If a deploy later fails with a permissions error, the log names the missing permission; edit the token and add exactly that.

### F3. GitHub dispatch token (admin "Rebuild" button and nightly schedule)

The admin Worker and the Cloudflare Cron Trigger start GitHub workflows *(PLAN §3, §14)*.

1. GitHub → your avatar → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Repository access: **Only select repositories → `MoneymakerId`**.
3. Permissions → Repository permissions → **Actions: Read and write**. Nothing else.
4. Expiry: up to a year, with a calendar reminder.
5. Save as `GITHUB_DISPATCH_TOKEN` (a **Cloudflare** secret on the admin Worker, Part G4, not a GitHub secret). `GITHUB_REPO` is `Amitsjoysm/MoneymakerId`.

### F4. What goes into GitHub Actions

From `CONTRACTS.md` §10, column "GH Actions". **Secrets** are encrypted and hidden in logs; **Variables** are plain, non-sensitive settings.

| Name | Type | Value / where it comes from |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret | F2 |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | F2 |
| `SUPABASE_URL` | Variable | E2 |
| `SUPABASE_PUBLISHABLE_KEY` | Secret | E2 |
| `SUPABASE_SECRET_KEY` | Secret | E2 |
| `SUPABASE_DB_URL` | Secret | E4 |
| `BACKUP_AGE_RECIPIENT` | Secret | E5 (public key, but keep it with the others) |
| `TURNSTILE_SITE_KEY` | Secret | C3 |
| `SYNTHETIC_SECRET` | Secret | F1 (the **same** value goes on the main, food and construction Workers) |
| `TELEGRAM_BOT_TOKEN` | Secret | D2 |
| `TELEGRAM_CHAT_ID` | Secret | D2 |
| `GROQ_API_KEYS` / `EXA_API_KEYS` / `FIRECRAWL_API_KEYS` | Secret | Part H; format `label:key,label2:key2` |
| `GSC_SERVICE_ACCOUNT_JSON` | Secret | I2 (the whole JSON file contents) |
| `INDEXNOW_KEY` | Secret | F1 |
| `GSC_VERIFICATION` | Variable | Optional; only needed for URL-prefix properties (I1) |
| `BING_VERIFICATION` | Variable | Optional; only if Bing import fails (I3) |
| `GA4_MEASUREMENT_ID` | Variable | I4 (starts with `G-`) |
| `CF_WEB_ANALYTICS_TOKEN` | Variable | I5 |
| `ADSENSE_PUBLISHER_ID` | Variable | Part L (starts with `ca-pub-`); leave empty until then |
| `ADSENSE_ENABLED` | Variable | `false` until AdSense approval (Part L) |
| `DIRECT_SPONSORSHIPS_ENABLED` | Variable | `false` until you sell a sponsorship |
| `EVENTS_ENABLED` | Variable | `true` (the kill switch for our own anonymous events) |
| `WHATSAPP_NUMBER` | Variable | `919834346179` |
| `SITE_URL_MAIN` | Variable | `https://marketmindai.com` |
| `SITE_URL_FOOD` | Variable | `https://food.marketmindai.com` |
| `SITE_URL_CONSTRUCTION` | Variable | `https://construction.marketmindai.com` |
| `DATA_SOURCE` | Variable | `supabase` for production deploys *(PLAN §3)* |
| `PUBLIC_LAUNCHED` | Variable | `false` until launch day (Part K). While false, pages send `X-Robots-Tag: noindex` |
| `MM_MANIFEST_PATH` | Variable | Leave as the workflow's default unless the developer says otherwise |

Also in **Settings → Actions → General**, set **artifact and log retention** to 30 days, which matches the backup retention *(PLAN §19)*.

**Done when:** every row above that is available now is filled in.

---

## Part G · First deploy and the four Workers (30 minutes)

The code defines **four Workers** (main, food, construction, admin), each with its own Wrangler config file in `apps/*/`. GitHub Actions builds all four from one catalogue snapshot and runs `wrangler deploy` for each *(PLAN §3)*. Every Worker has `workers_dev = false` and `preview_urls = false`, so there is no `*.workers.dev` back door *(CONTRACTS §10, PLAN §14)*.

### G1. Create the KV namespace `LEADS_OUTBOX`

If the database is down when someone submits a lead, the lead is kept in Workers KV and replayed later, so no lead is lost *(PLAN §13, CONTRACTS §7)*.

1. Dashboard → **Storage & Databases → KV → Create namespace** (or **Workers & Pages → KV**).
2. Name it `LEADS_OUTBOX`. Create.
3. Copy its **Namespace ID** and give it to the developer (not secret). All four Workers bind this one namespace under the binding name `LEADS_OUTBOX` *(CONTRACTS §10)*.

### G2. Run the first deploy

1. GitHub → **Actions → deploy** (the `deploy.yml` workflow) → **Run workflow**. Give a reason such as "first deploy".
2. Wait for it to finish. Read the summary: it lists the gate report (how many pages qualified) and the four `wrangler deploy` results.
3. If it fails at "fetch catalogue", check `SUPABASE_URL` and the keys, and check that the database migrations have been applied (the developer runs them with the Supabase CLI against `SUPABASE_DB_URL`).

### G3. Attach the custom domains

If each Worker's Wrangler config declares its custom domain, the first deploy attaches it automatically. Check, and attach by hand if needed:

1. **Workers & Pages →** each Worker **→ Settings → Domains & Routes → Add → Custom domain**.
2. Attach: main Worker → `marketmindai.com`; food Worker → `food.marketmindai.com`; construction Worker → `construction.marketmindai.com`; admin Worker → `admin.marketmindai.com`.
3. If Cloudflare says a DNS record already exists for that name (for example the old website's `A` record), delete that record in **DNS → Records**, then attach again. **Do not** delete `MX` or `TXT` records.
4. Optional: make `www.marketmindai.com` redirect to `https://marketmindai.com/` with a **Rules → Redirect Rules** rule (the dashboard has a ready-made "www to root" template).

Certificates for the apex and the three subdomains are issued automatically.

### G4. Set the Worker runtime secrets

Runtime values are read inside the Workers *(CONTRACTS §10)*. Non-secret values (site URLs, the WhatsApp number, `LIVE_ASK_DAILY_CAP`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `GITHUB_REPO`, `EVENTS_ENABLED`) are written in the repository's Wrangler configs by the developer; you give them the values. **Secrets** you add yourself:

**Workers & Pages →** Worker **→ Settings → Variables and Secrets → Add →** type **Secret**.

| Secret | main | food | construction | admin |
|---|:-:|:-:|:-:|:-:|
| `SUPABASE_PUBLISHABLE_KEY` | ✓ | ✓ | ✓ | |
| `SUPABASE_SECRET_KEY` | | | | ✓ |
| `TURNSTILE_SECRET_KEY` | ✓ | ✓ | ✓ | |
| `VISITOR_HMAC_SECRET` | ✓ | ✓ | ✓ | |
| `SYNTHETIC_SECRET` (same value as GitHub) | ✓ | ✓ | ✓ | |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | ✓ | ✓ | ✓ | ✓ |
| `GROQ_API_KEYS` / `EXA_API_KEYS` / `FIRECRAWL_API_KEYS` | | ✓ | ✓ | ✓ |
| `GITHUB_DISPATCH_TOKEN` | | | | ✓ |

Always choose the **Secret** type: secrets survive every later deploy. Plain-text variables typed into the dashboard can be overwritten by the next `wrangler deploy`, because the repository's config is the source of truth for plain values.

`VISITOR_HMAC_SECRET` must rotate daily *(CONTRACTS §10, PLAN §9)*; the Workers' code handles the rotation from the value you set. If the developer's notes say it must be changed by hand instead, follow them.

### G5. Check it works (still private)

1. Open each host in a private window: you should get the Cloudflare Access PIN screen, then the site.
2. In the browser's developer tools (Network tab → the page request → Response headers), confirm `X-Robots-Tag: noindex` is present on the three public hosts.
3. Submit a test quote request on `construction.marketmindai.com` with your own phone number. Within a minute you should get **a Telegram message and an email**. Then open the admin and mark that lead as **spam** so it does not count.
4. Go back to Supabase (E2 step 4) and disable the legacy JWT keys. Repeat the test lead to make sure nothing broke.

**Done when:** all four hosts load behind Access, the test lead produced both alerts, and legacy keys are off.

---

## Part H · AI and search provider keys (Groq, Exa, Firecrawl) (20 minutes)

These power the nightly pipeline and the live Ask (milestone M4); M1 (construction launch) does not need them.

1. Create a free account and an API key at each provider. Save each key with a short **account label**, for example `acct1`.
2. Format each value as a comma list: `acct1:{{KEY}}` (add `,acct2:{{KEY}}` for more accounts).
3. Add `GROQ_API_KEYS`, `EXA_API_KEYS`, `FIRECRAWL_API_KEYS` to GitHub (F4) and to the food, construction and admin Workers (G4).

> **Risk you accepted** *(PLAN §10)*: Groq's acceptable use policy forbids exceeding its limits by registering multiple accounts, Exa gives free credits only to a user's first team, and Firecrawl limits each team across all its keys. Providers can ban **all** linked accounts. The code does normal failover and labels each key so a ban is spotted quickly; it does not hide accounts' links to each other.

---

## Part I · Search engines and analytics (45 minutes)

### I1. Google Search Console: one Domain property

1. Go to `https://search.google.com/search-console` with your business Google account.
2. **Add property → Domain** → enter `marketmindai.com` (no `https://`, no `www`).
3. Google shows a **TXT record** (`google-site-verification=…`). In Cloudflare **DNS → Records → Add record**: type `TXT`, name `@`, content = the full value. Save, then click **Verify** in Search Console (it can take a few minutes).
4. One Domain property covers the apex and every subdomain *(PLAN §2)*.
5. **Settings:** make sure **"Search generative AI features"** is set to **Include** *(PLAN §2, §12)*.
6. Do **not** submit sitemaps yet; that happens on launch day (Part K).

### I2. Service account for the Search Console API (daily import)

The pipeline imports Search Console data daily into `search_demand` *(PLAN §16)*.

1. Go to `https://console.cloud.google.com/`, create a project named `marketmind`.
2. **APIs & Services → Library →** search "Google Search Console API" → **Enable**.
3. **IAM & Admin → Service accounts → Create service account**, name `mm-gsc-reader`. Skip the optional role steps.
4. Open it → **Keys → Add key → Create new key → JSON**. A file downloads.
5. Open the file in a text editor, copy **everything**, and save it as the GitHub secret `GSC_SERVICE_ACCOUNT_JSON`. Then delete the downloaded file.
6. Copy the service account's email (ends in `iam.gserviceaccount.com`).
7. Search Console → **Settings → Users and permissions → Add user** → paste that email → permission **Restricted** (read-only is enough).

### I3. Bing Webmaster Tools

1. Go to `https://www.bing.com/webmasters` and sign in.
2. Choose **Import from Google Search Console**, allow access, and import `marketmindai.com`. This verifies the site and copies sitemaps later.
3. If the import does not offer the Domain property, add each host by hand and verify with the meta-tag method: put the code into the GitHub variable `BING_VERIFICATION`, redeploy, and click Verify.

Bing matters beyond Bing itself: IndexNow submissions are shared with Bing and Yandex, and ChatGPT search uses third-party providers including Bing *(PLAN §12)*.

### I4. Google Analytics 4 (with Consent Mode)

1. Go to `https://analytics.google.com/` → **Admin → Create → Property**. Time zone **India**, currency **INR**.
2. Create one **Web data stream** for `https://marketmindai.com` (the subdomains share it). Copy the **Measurement ID** (starts with `G-`) → GitHub variable `GA4_MEASUREMENT_ID`.
3. **Admin → Data collection and modification → Data retention:** choose the **shortest** option.
4. Leave **Google signals off**.
5. After the first lead, mark the `generate_lead` event as a **key event** (conversion).

The code sets Consent Mode defaults in the page: denied for the EEA, UK and Switzerland, granted elsewhere *(PLAN §16)*. Our own database, not GA4, is the source of truth for leads.

### I5. Cloudflare Web Analytics (cookieless)

1. Dashboard (account) → **Analytics & Logs → Web Analytics → Add a site**.
2. Choose the **manual JavaScript snippet** option, **not** automatic injection (B4 step 4 explains why).
3. Copy the **token** from the snippet → GitHub variable `CF_WEB_ANALYTICS_TOKEN`.

### I6. IndexNow

1. You generated `INDEXNOW_KEY` in F1 and stored it in GitHub.
2. The build publishes the key file on each host and the deploy pipeline submits **only changed URLs** after each deploy *(PLAN §3, §12)*. Nothing else to do. Before launch (`PUBLIC_LAUNCHED=false`) nothing should be submitted; check the deploy log says IndexNow was skipped.

**Done when:** the Domain property is verified with the AI setting on Include, the service account has Restricted access, Bing is set up, and the analytics IDs are in GitHub.

---

## Part J · Marking prose as reviewed (before launch, and whenever content changes)

No AI-drafted text appears on an indexable page until you mark it reviewed; the build fails otherwise *(PLAN §5, CONTRACTS §8)*. Until the admin's Content screen exists (milestone M2), you mark prose reviewed by **editing a status field in the repository files**:

| What you reviewed | File | Field to change from `draft` to `reviewed` |
|---|---|---|
| A service guide (e.g. terrace waterproofing) | `data/services/{{SERVICE_ID}}.json` | `"prose_status"` of that service, or of the entry inside `sub_services` |
| A cost model | `data/cost-models/{{SERVICE_ID}}.json` | `"status"` of that model |
| A dish description | `data/dishes.json` | `"prose_status"` of that dish |
| A Pune locality guide | `content/locality-guides/{{LOCALITY_ID}}.md` | `status:` in the frontmatter at the top |
| A locality's local facts | `data/localities.json` | `"status"` of each fact in `construction_facts` / `food_notes` |

How to do it without a developer:

1. **Read the text first**: on GitHub open the file, read the prose and its sources. Fix anything wrong, unclear or unsupported. If something is not backed by its sources, delete it rather than mark it reviewed.
2. Click the **pencil (Edit)** icon, change `draft` to `reviewed` for exactly the items you read, and **Commit changes** to a new branch with a pull request titled "Review: …". Ask the developer to merge it.
3. After merging, the developer runs `pnpm mm import:reference` so the database picks up the change. After the first import the database is authoritative, and a row you already edited in the database is updated only with `--force {{ID}}` *(CONTRACTS §5)*. Then rebuild (GitHub Actions → deploy, or the admin's "Rebuild now").
4. Reviewing is a promise that you have read it and it is accurate. Never bulk-replace `draft` with `reviewed`.

From M2 onwards you use the admin **Content** screen instead; it writes the same status *(CONTRACTS §8, the `prose_reviews` table)*.

> **Open question (reported):** `CONTRACTS.md` §5 says `import:reference` loads `data/*.json`; it does not say how a locality guide's `status` in `content/locality-guides/` reaches the production snapshot. Until that is confirmed, ask the developer to check that a reviewed guide actually builds.

---

## Part K · Launch day (follow `docs/PLAN.md` §20, the launch gate)

Nothing becomes public until **`pnpm launch:check` passes and you sign off** *(PLAN §0 item 7, §20)*.

### K1. One week before

- [ ] All legal pages are reviewed by a lawyer, and every double-brace placeholder in `content/legal/*.md` is filled in (`{{LEGAL_NAME}}`, `{{CONTACT_EMAIL}}`, `{{GRIEVANCE_OFFICER}}`, `{{POSTAL_ADDRESS}}`, `{{EFFECTIVE_DATE}}`). Ask the developer to confirm that no double-brace placeholder remains in any built page.
- [ ] The cost guides, locality guides and facts you want live are marked reviewed (Part J).
- [ ] At least one nightly backup artifact exists in GitHub Actions, and a test restore has been done once *(PLAN §19)*.
- [ ] You have received at least one daily health report (07:30 IST) on Telegram and email.
- [ ] Your Google Business Profile and social profiles for MarketMind AI exist (off-site mentions help AI engines recommend you, *PLAN §23*).

### K2. The gate (developer runs, you watch)

- [ ] `pnpm launch:check` passes. It covers *(PLAN §20, spec §102)*: HTTPS and HSTS; mobile Lighthouse scores; a real 404 page; canonicals, sitemaps, robots and structured data; legal, contact and claim pages; source attribution and freshness on every claim; the lead alert and outbox tested end to end.
- [ ] You read the gate report (which pages are built, which are `noindex`) and **sign off in writing** (a comment on the launch pull request is enough).

### K3. Open the doors (in this order)

1. **Remove the pre-launch lock:** Zero Trust → Access → Applications → delete **`mm-prelaunch`**. **Do not touch `mm-admin`.**
2. In a private window, confirm the three public hosts load **without** a PIN, and `admin.marketmindai.com` **still asks** for one.
3. Set the GitHub variable **`PUBLIC_LAUNCHED` = `true`** and run the **deploy** workflow.
4. Confirm the `X-Robots-Tag: noindex` header is **gone** on the public hosts (G5 step 2), and that `robots.txt` on each host has **no** `Disallow: /` and lists the sitemap.
5. Re-check **AI Crawl Control**: every AI crawler still on Allow (C1).
6. **Search Console → Sitemaps:** submit `https://marketmindai.com/sitemap.xml`, `https://construction.marketmindai.com/sitemap.xml` and `https://food.marketmindai.com/sitemap.xml`. Bing picks them up from the import, or submit the same three in Bing Webmaster Tools.
7. Check the deploy log shows **IndexNow** submitted the changed URLs.
8. From your phone, on mobile data, submit one real quote request. Check: the thank-you state shows a reference; the **Send on WhatsApp** button opens WhatsApp to 91 98343 46179 with the reference in the text; the Telegram and email alerts arrive. Mark the lead as spam afterwards.

### K4. The first week

- [ ] Daily: Telegram alerts and the 07:30 IST health report.
- [ ] Search Console → Pages: watch for "Crawled – currently not indexed" on important pages and tell the developer.
- [ ] AI Crawl Control: requests from AI crawlers should show as **allowed**, not blocked.
- [ ] Cloudflare → Security → Events: make sure the `/api/*` rate rule is not blocking real people (many blocks from Indian mobile IPs at normal hours means the limit is too low).

---

## Part L · Later: Google AdSense (only when the plan's conditions are met)

Apply only when **all legal pages are live, at least 50 pages are indexed in Search Console, and you have at least 4 weeks of real organic visitors** *(PLAN §13)*.

1. Sign up at `https://www.google.com/adsense/` and add the site as the **root domain `marketmindai.com` only**. AdSense no longer accepts subdomains separately; once the root is approved, ads can serve on `food.` and `construction.` with the same publisher ID *(PLAN §2)*.
2. Copy your publisher ID (starts with `ca-pub-`) → GitHub variable `ADSENSE_PUBLISHER_ID`, keep `ADSENSE_ENABLED=false`, and redeploy. This publishes the AdSense site-verification meta tag on the root domain and generates **one `ads.txt` at `https://marketmindai.com/ads.txt`**, which covers all subdomains *(PLAN §2, §13)*. Then request review in AdSense.
3. **Privacy & messaging:** create and publish the **European regulations** (GDPR) message for the EEA, UK and Switzerland. This is AdSense's free Google-certified consent tool; visitors who do not consent see non-personalised ads *(PLAN §2)*.
4. **Blocking controls:** before ads go live anywhere, block the competitor advertiser URLs on the list the developer prepares *(PLAN §13)*.
5. **Auto ads:** keep it off; we use manual units in fixed slots. If you ever turn Auto ads on, keep its in-page formats and vignettes off *(PLAN §13)*.
6. After approval, set `ADSENSE_ENABLED=true` and redeploy. Ads appear only where the slot config allows them, and never on forms, contact, legal, feature, claim, for-contractors, Ask, 404, thank-you or admin pages *(CONTRACTS §9, PLAN §13)*.
7. Check that `content/legal/privacy.md` and `cookie-policy.md` (the live `/privacy/` and `/cookie-policy/` pages) still describe AdSense correctly.

---

## Part M · Where every value lives (one-page reference)

| Value | Created in | Cloudflare Worker secret on | GitHub |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | F2 | | Secret |
| `SUPABASE_URL` | E2 | in Wrangler config (all 4) | Variable |
| `SUPABASE_PUBLISHABLE_KEY` | E2 | main, food, construction | Secret |
| `SUPABASE_SECRET_KEY` | E2 | admin | Secret |
| `SUPABASE_DB_URL` | E4 | | Secret |
| `TURNSTILE_SITE_KEY` | C3 | | Secret |
| `TURNSTILE_SECRET_KEY` | C3 | main, food, construction | |
| `VISITOR_HMAC_SECRET` | F1 | main, food, construction | |
| `SYNTHETIC_SECRET` | F1 | main, food, construction | Secret |
| `LEADS_OUTBOX` (KV namespace id) | G1 | binding in Wrangler config (all 4) | |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | D2 | all 4 | Secret |
| `ALERT_EMAIL` (verified destination) | D1 | binding in Wrangler config (all 4) | |
| `GROQ_API_KEYS`, `EXA_API_KEYS`, `FIRECRAWL_API_KEYS` | H | food, construction, admin | Secret |
| `LIVE_ASK_DAILY_CAP` (default 50) | | in Wrangler config (food, construction) | |
| `WHATSAPP_NUMBER` = `919834346179` | | in Wrangler config (all 4) | Variable |
| `EVENTS_ENABLED` | | in Wrangler config (main, food, construction) | Variable |
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | C4 | in Wrangler config (admin) | |
| `GITHUB_DISPATCH_TOKEN` | F3 | admin | |
| `GITHUB_REPO` = `Amitsjoysm/MoneymakerId` | | in Wrangler config (admin) | |
| `GA4_MEASUREMENT_ID`, `CF_WEB_ANALYTICS_TOKEN` | I4, I5 | | Variable |
| `INDEXNOW_KEY` | F1 | | Secret |
| `GSC_VERIFICATION`, `BING_VERIFICATION` | I1, I3 (optional) | | Variable |
| `GSC_SERVICE_ACCOUNT_JSON` | I2 | | Secret |
| `BACKUP_AGE_RECIPIENT` | E5 | | Secret |
| `ADSENSE_PUBLISHER_ID`, `ADSENSE_ENABLED`, `DIRECT_SPONSORSHIPS_ENABLED` | L | | Variable |
| `DATA_SOURCE`, `PUBLIC_LAUNCHED`, `MM_MANIFEST_PATH`, `SITE_URL_*` | | | Variable |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Domain stuck on "Pending" in Cloudflare | Nameservers not changed, or DNSSEC still on at the registrar | Re-check B3; wait up to 48 hours |
| Admin shows "forbidden" after the PIN | `ACCESS_AUD` or `ACCESS_TEAM_DOMAIN` wrong | Copy both again from C4 and redeploy |
| No Telegram alert | Wrong chat id, or you never pressed Start in the bot | Redo D2 steps 4–6 |
| No alert email | Destination not verified, or it went to spam | D1 steps 2 and 5 |
| Deploy fails at "fetch catalogue" | Supabase paused, wrong key, or migrations not applied | Restore the project in Supabase, re-check E2, ask the developer about migrations |
| Deploy aborts with "shrinkage guard" | Indexable URLs dropped by more than 5%, or a page that produced a lead would disappear *(PLAN §3)* | Read the report; override only from the admin Publish screen if you are sure |
| Real visitors see "too many requests" | The `/api/*` rate rule is too tight | Raise the threshold in C2 |
| AI crawler requests show "blocked" | AI Crawl Control reverted or a sync setting changed it | Redo C1 |
