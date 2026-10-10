// Invariants of the four Astro app shells (T05): the product rules that live in config files, so that a later
// task which edits a config cannot silently break them. The builds, `astro check` and the Wrangler dry runs
// are separate acceptance commands (see the T05 report).
// Run with: node --test scripts/app-shells.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const path = (...parts) => `${root}${parts.join('/')}`;
const text = (...parts) => readFileSync(path(...parts), 'utf8');
const jsonc = (...parts) => {
  const parsed = ts.parseConfigFileTextToJson(path(...parts), text(...parts));
  if (parsed.error) throw new Error(`cannot parse ${parts.join('/')}`);
  return parsed.config;
};

const SITES = {
  main: 'https://marketmindai.com',
  food: 'https://food.marketmindai.com',
  construction: 'https://construction.marketmindai.com',
  admin: 'https://admin.marketmindai.com',
};

const APPS = {
  main: { worker: 'mm-main', host: 'marketmindai.com', isPublic: true },
  food: { worker: 'mm-food', host: 'food.marketmindai.com', isPublic: true },
  construction: { worker: 'mm-construction', host: 'construction.marketmindai.com', isPublic: true },
  admin: { worker: 'mm-admin', host: 'admin.marketmindai.com', isPublic: false },
};

// CONTRACTS §10 secrets. They are set with `wrangler secret put`, so they must never be written in a config.
const SECRETS = [
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'TURNSTILE_SECRET_KEY',
  'VISITOR_HMAC_SECRET',
  'SYNTHETIC_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'GROQ_API_KEYS',
  'EXA_API_KEYS',
  'FIRECRAWL_API_KEYS',
  'GITHUB_DISPATCH_TOKEN',
];

// docs/DEPLOY.md part M: the plain (non-secret) values that live in each Worker's config.
const COMMON_VARS = ['SITE_URL_CONSTRUCTION', 'SITE_URL_FOOD', 'SITE_URL_MAIN', 'SUPABASE_URL', 'WHATSAPP_NUMBER'];
const EXPECTED_VARS = {
  main: [...COMMON_VARS, 'EVENTS_ENABLED'].sort(),
  food: [...COMMON_VARS, 'EVENTS_ENABLED', 'LIVE_ASK_DAILY_CAP'].sort(),
  construction: [...COMMON_VARS, 'EVENTS_ENABLED', 'LIVE_ASK_DAILY_CAP'].sort(),
  admin: [...COMMON_VARS, 'ACCESS_AUD', 'ACCESS_TEAM_DOMAIN', 'GITHUB_REPO'].sort(),
};

for (const [app, expected] of Object.entries(APPS)) {
  describe(`apps/${app}: Wrangler config`, () => {
    it('has the shell files', () => {
      for (const file of ['astro.config.mjs', 'wrangler.jsonc', 'tsconfig.json', 'src/env.d.ts']) {
        assert.ok(existsSync(path('apps', app, file)), file);
      }
    });

    const config = jsonc('apps', app, 'wrangler.jsonc');

    it('is the right Worker, on the pinned compatibility date', () => {
      assert.equal(config.name, expected.worker);
      assert.equal(config.compatibility_date, '2026-10-01');
    });

    it('has no workers.dev or preview URL back door (CONTRACTS §10)', () => {
      assert.equal(config.workers_dev, false);
      assert.equal(config.preview_urls, false);
    });

    it('attaches its own custom domain', () => {
      assert.deepEqual(config.routes, [{ pattern: expected.host, custom_domain: true }]);
    });

    it('binds the leads outbox KV namespace, with the placeholder id until the owner creates it', () => {
      assert.deepEqual(config.kv_namespaces, [
        { binding: 'LEADS_OUTBOX', id: '00000000000000000000000000000000' },
      ]);
    });

    it('binds the alert email sender', () => {
      assert.equal(config.send_email.length, 1);
      assert.equal(config.send_email[0].name, 'ALERT_EMAIL');
    });

    it(expected.isPublic ? 'binds a rate limiter' : 'has no rate limiter (admin is behind Cloudflare Access)', () => {
      if (expected.isPublic) {
        assert.equal(config.ratelimits.length, 1);
        assert.equal(config.ratelimits[0].name, 'RATE_LIMITER');
        // Workers Rate Limiting accepts a period of 10 or 60 seconds only.
        assert.ok([10, 60].includes(config.ratelimits[0].simple.period));
        assert.ok(config.ratelimits[0].simple.limit > 0);
      } else {
        assert.equal(config.ratelimits, undefined);
      }
    });

    it('declares exactly the plain variables DEPLOY.md lists, and no secret', () => {
      assert.deepEqual(Object.keys(config.vars ?? {}).sort(), EXPECTED_VARS[app]);
      for (const secret of SECRETS) assert.ok(!(secret in config.vars), `${secret} must not be in the config`);
    });

    it('uses the site URLs and WhatsApp number from the contracts', () => {
      assert.equal(config.vars.SITE_URL_MAIN, SITES.main);
      assert.equal(config.vars.SITE_URL_FOOD, SITES.food);
      assert.equal(config.vars.SITE_URL_CONSTRUCTION, SITES.construction);
      assert.equal(config.vars.WHATSAPP_NUMBER, '919834346179');
    });

    if (expected.isPublic) {
      it('serves the static 404 page for unknown paths, with a trailing slash on every page', () => {
        assert.equal(config.assets.not_found_handling, '404-page');
        assert.equal(config.assets.html_handling, 'force-trailing-slash');
      });

      // With `not_found_handling` set, the asset layer answers unknown paths itself, so /api/* only reaches the
      // Worker if run_worker_first says so. But Wrangler rejects run_worker_first when no Worker is built, which
      // is the case until the app has an on-demand route.
      it('runs the Worker first for /api/* exactly when the app has on-demand API routes', () => {
        const hasApiRoutes = existsSync(path('apps', app, 'src', 'pages', 'api'));
        assert.deepEqual(config.assets.run_worker_first, hasApiRoutes ? ['/api/*'] : undefined);
      });

      it('has no cron triggers', () => {
        assert.equal(config.triggers, undefined);
      });
    } else {
      it('is rendered on demand: it has a custom entry point and no static 404 handling', () => {
        assert.equal(config.main, './src/worker.ts');
        assert.equal(config.assets?.not_found_handling, undefined);
      });

      it('runs its crons at 01:01 and 07:31 IST, written in UTC', () => {
        // IST = UTC+5:30. 01:01 IST = 19:31 UTC the day before; 07:31 IST = 02:01 UTC.
        assert.deepEqual(config.triggers.crons, ['31 19 * * *', '1 2 * * *']);
      });
    }
  });
}

describe('apps/admin: custom entry point', () => {
  it('exports fetch and scheduled', () => {
    const worker = text('apps', 'admin', 'src', 'worker.ts');
    assert.match(worker, /from '@astrojs\/cloudflare\/handler'/);
    assert.match(worker, /from '\.\/scheduled\.ts'/);
    assert.match(worker, /export default \{[^}]*fetch[^}]*scheduled[^}]*\}/s);
  });
});

for (const app of Object.keys(APPS)) {
  describe(`apps/${app}: Astro config`, () => {
    it('sets site, trailing slashes and the i18n routing from the plan', async () => {
      const mod = await import(pathToFileURL(path('apps', app, 'astro.config.mjs')).href);
      const config = mod.default;
      assert.equal(config.site, SITES[app]);
      // Not 'always': Astro would redirect POST /api/lead to /api/lead/. Cloudflare's `html_handling` (checked
      // above) gives the static pages their trailing slash instead (plan §6).
      assert.equal(config.trailingSlash, 'ignore');
      assert.deepEqual(config.i18n, {
        defaultLocale: 'en',
        locales: ['en', 'mr', 'hi'],
        routing: { prefixDefaultLocale: false },
      });
      assert.equal(config.adapter?.name, '@astrojs/cloudflare');
      // Sessions would make the adapter add (and Cloudflare provision) an unused KV namespace.
      assert.equal(config.session, false);
      assert.equal(config.output, app === 'admin' ? 'server' : 'static');
    });
  });
}

describe('placeholders and stubs', () => {
  it('main and admin have a 404 page, and the admin has the Today placeholder', () => {
    assert.ok(existsSync(path('apps', 'main', 'src', 'pages', '404.astro')));
    assert.ok(existsSync(path('apps', 'admin', 'src', 'pages', '404.astro')));
    assert.match(text('apps', 'admin', 'src', 'pages', 'index.astro'), /Admin \(AD1a\)/);
  });

  it('keeps the admin out of search engines in the page itself, not only behind Access', () => {
    for (const page of ['index.astro', '404.astro']) {
      assert.match(text('apps', 'admin', 'src', 'pages', page), /name="robots"\s+content="noindex/, page);
    }
  });

  it('builds the construction UI fixtures page only when DATA_SOURCE is "fixtures"', () => {
    const page = text('apps', 'construction', 'src', 'pages', 'ui-fixtures', '[x].astro');
    assert.match(page, /getStaticPaths/);
    assert.match(page, /DATA_SOURCE === 'fixtures'/);
    assert.match(page, /UI fixtures \(T03 fills this\)/);
    assert.match(page, /params:\s*\{\s*x:\s*'components'\s*\}/);
  });

  it('scheduled.ts is a stub that logs and does nothing else', () => {
    const stub = text('apps', 'admin', 'src', 'scheduled.ts');
    assert.match(stub, /export async function scheduled/);
    assert.match(stub, /console\.log/);
  });
});

describe('packages/edge/src/worker-env.d.ts', () => {
  const declaration = text('packages', 'edge', 'src', 'worker-env.d.ts');
  const declares = (name) => new RegExp(`\\b${name}\\??:`).test(declaration);

  it('declares every binding and variable the Wrangler configs define, on Cloudflare.Env', () => {
    assert.match(declaration, /namespace Cloudflare\s*\{\s*interface Env\b/);
    for (const app of Object.keys(APPS)) {
      const config = jsonc('apps', app, 'wrangler.jsonc');
      const names = [
        ...config.kv_namespaces.map((kv) => kv.binding),
        ...config.send_email.map((mail) => mail.name),
        ...(config.ratelimits ?? []).map((limit) => limit.name),
        ...Object.keys(config.vars),
      ];
      for (const name of names) assert.ok(declares(name), `${app}: ${name} is not declared on Cloudflare.Env`);
    }
  });

  it('declares the secrets too, so handlers read them with types', () => {
    for (const secret of SECRETS) assert.ok(declares(secret), `${secret} is not declared on Cloudflare.Env`);
  });
});
