import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// @mm/edge code runs on the Cloudflare Workers runtime, so its tests do too (workerd through Miniflare).
// Test files import `env` and friends from 'cloudflare:test'.
export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: '2026-08-01',
        compatibilityFlags: ['nodejs_compat'],
        // CONTRACTS §10: the lead outbox binding.
        kvNamespaces: ['LEADS_OUTBOX'],
      },
    }),
  ],
  test: {
    name: '@mm/edge',
    include: ['src/**/*.test.ts'],
  },
});
