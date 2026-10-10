import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

// The admin is rendered entirely on demand, behind Cloudflare Access (plan §14). Its Worker also runs the
// cron triggers, through the custom entry point in wrangler.jsonc (`main`).
export default defineConfig({
  site: 'https://admin.marketmindai.com',
  output: 'server',
  // Private, so no canonical-URL rule; and API-style routes must work with and without a slash.
  trailingSlash: 'ignore',
  // Admin photos come from Supabase Storage and are shown as they are; nothing is optimised.
  adapter: cloudflare({ imageService: 'passthrough' }),
  // No sessions: identity comes from the Cloudflare Access JWT, not from a session store.
  session: false,
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'mr', 'hi'],
    routing: { prefixDefaultLocale: false },
  },
});
