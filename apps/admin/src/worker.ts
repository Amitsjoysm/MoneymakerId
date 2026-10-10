import { handle } from '@astrojs/cloudflare/handler';
import { scheduled } from './scheduled.ts';

// Custom Worker entry point (wrangler.jsonc `main`). It does what the adapter's default entry does for requests,
// and adds the `scheduled` handler that Cloudflare calls for the cron triggers.
export default {
  fetch: handle,
  scheduled,
} satisfies ExportedHandler<Cloudflare.Env>;
