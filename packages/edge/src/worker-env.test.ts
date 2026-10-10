import { env } from 'cloudflare:workers';
import { describe, expect, expectTypeOf, it } from 'vitest';

// worker-env.d.ts is types only. The `expectTypeOf` lines are checked by `tsc -p packages/edge` (pnpm typecheck),
// not by Vitest: they fail the typecheck if a binding is missing, mistyped or has silently become `any`.
describe('Cloudflare.Env (worker-env.d.ts)', () => {
  it('types the bindings that every Wrangler config declares', () => {
    expectTypeOf(env.LEADS_OUTBOX).toEqualTypeOf<KVNamespace>();
    expectTypeOf(env.LEADS_OUTBOX).not.toBeAny();
    expectTypeOf(env.ALERT_EMAIL).toEqualTypeOf<SendEmail>();
    expectTypeOf(env.ALERT_EMAIL).not.toBeAny();
  });

  it('types the rate limiter as optional, because the admin Worker has none', () => {
    expectTypeOf(env.RATE_LIMITER).toEqualTypeOf<RateLimit | undefined>();
    expectTypeOf(env.RATE_LIMITER).not.toBeAny();
  });

  it('types the plain variables as strings, required where every Worker has them', () => {
    expectTypeOf(env.SITE_URL_MAIN).toBeString();
    expectTypeOf(env.SITE_URL_FOOD).toBeString();
    expectTypeOf(env.SITE_URL_CONSTRUCTION).toBeString();
    expectTypeOf(env.SUPABASE_URL).toBeString();
    expectTypeOf(env.WHATSAPP_NUMBER).toBeString();
    expectTypeOf(env.LIVE_ASK_DAILY_CAP).toEqualTypeOf<string | undefined>();
    expectTypeOf(env.EVENTS_ENABLED).toEqualTypeOf<string | undefined>();
  });

  it('types the secrets as optional strings, so a missing secret has to be handled', () => {
    expectTypeOf(env.SUPABASE_SECRET_KEY).toEqualTypeOf<string | undefined>();
    expectTypeOf(env.TURNSTILE_SECRET_KEY).toEqualTypeOf<string | undefined>();
    expectTypeOf(env.GROQ_API_KEYS).toEqualTypeOf<string | undefined>();
  });

  it('has the LEADS_OUTBOX namespace bound in the test runtime (vitest.config.ts)', async () => {
    await env.LEADS_OUTBOX.put('lead:00000000-0000-4000-8000-000000000000', '{"ok":true}');
    expect(await env.LEADS_OUTBOX.get('lead:00000000-0000-4000-8000-000000000000')).toBe('{"ok":true}');
  });
});
