/// <reference types="@cloudflare/workers-types" />

// The type of `env` in every Worker (`import { env } from 'cloudflare:workers'`), and of `env` in @mm/edge
// tests (`cloudflare:test`). One interface covers all four Workers (CONTRACTS §10, docs/DEPLOY.md part M):
// what is required here is present on every Worker, and what only some Workers have is optional, so a
// handler has to deal with it being absent. The apps pull this file in from their src/env.d.ts.
//
// Owner: T05. The Wrangler configs in apps/*/wrangler.jsonc are the source of truth; scripts/app-shells.test.mjs
// fails if a binding or variable declared there is missing here.
declare namespace Cloudflare {
  interface Env {
    // Bindings (wrangler.jsonc)
    /** KV outbox for leads that could not reach the database: key `lead:{idempotency_key}`. All Workers. */
    LEADS_OUTBOX: KVNamespace;
    /** Alert emails (`send_email`). All Workers. */
    ALERT_EMAIL: SendEmail;
    /** Burst limiter for the public API. Main, food and construction only; the admin has none. */
    RATE_LIMITER?: RateLimit;

    // Plain variables (wrangler.jsonc `vars`)
    SITE_URL_MAIN: string;
    SITE_URL_FOOD: string;
    SITE_URL_CONSTRUCTION: string;
    SUPABASE_URL: string;
    /** Digits only, no plus sign: `919834346179`. Used only by `@mm/core/leads.whatsappUrl`. */
    WHATSAPP_NUMBER: string;
    /** `"true"` or `"false"`: the runtime kill switch for `/api/event`. Main, food and construction. */
    EVENTS_ENABLED?: string;
    /** Live Ask lookups per day, as a decimal string; the code defaults to 50. Food and construction. */
    LIVE_ASK_DAILY_CAP?: string;
    /** Cloudflare Access team domain and application audience tag. Admin only. */
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
    /** `owner/repo` that workflows are dispatched to. Admin only. */
    GITHUB_REPO?: string;

    // Secrets (`wrangler secret put`; never in wrangler.jsonc). Which Workers hold which: docs/DEPLOY.md G4.
    SUPABASE_PUBLISHABLE_KEY?: string;
    SUPABASE_SECRET_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    VISITOR_HMAC_SECRET?: string;
    SYNTHETIC_SECRET?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
    /** Provider key lists, `label:key,label:key`. Food, construction and admin. */
    GROQ_API_KEYS?: string;
    EXA_API_KEYS?: string;
    FIRECRAWL_API_KEYS?: string;
    GITHUB_DISPATCH_TOKEN?: string;
  }
}
