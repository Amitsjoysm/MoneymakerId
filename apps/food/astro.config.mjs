import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

// Static site on Cloudflare Workers Static Assets. Routes that must run on the Worker (/api/*) opt out of
// prerendering one by one with `export const prerender = false`. Runtime values come from
// `import { env } from 'cloudflare:workers'` (CONTRACTS §10); build-time values from `import.meta.env`.
export default defineConfig({
  site: 'https://food.marketmindai.com',
  output: 'static',
  // Trailing slashes (plan §6) are enforced by Cloudflare, not here: wrangler.jsonc sets
  // `html_handling: force-trailing-slash`, which redirects /pune to /pune/. Astro must not use 'always': it
  // would also redirect POST /api/lead to /api/lead/ (a 301 turns the POST into a GET; CONTRACTS §7).
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  // Astro 7 targets Workers. Images are optimised at build time ('compile') and served as plain files; the
  // Cloudflare Images binding is outside the free tier.
  adapter: cloudflare({ imageService: 'compile' }),
  // No sessions. Left on, the adapter adds an unused SESSION KV namespace that Cloudflare would provision.
  session: false,
  // English now; Marathi and Hindi are reserved for M6 (plan §6). Links are built by `localizedUrl()`.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'mr', 'hi'],
    routing: { prefixDefaultLocale: false },
  },
});
