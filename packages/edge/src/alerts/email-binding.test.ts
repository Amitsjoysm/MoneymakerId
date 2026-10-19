import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { sendEmail } from './email.ts';

// No mocking: a real `send_email` binding (declared in vitest.config.ts; Miniflare stores the message in a
// temporary file instead of sending it, and logs one line saying so) and the real `cloudflare:email`.
// Miniflare parses the message and rejects one that is not valid, for example without a Message-ID, so
// this is the check that the raw message sendEmail builds is well formed.
describe('sendEmail through a real send_email binding', () => {
  const config = { ALERT_EMAIL: env.ALERT_EMAIL, ALERT_EMAIL_TO: 'owner@example.com' };

  it('sends a plain alert', async () => {
    await expect(
      sendEmail(config, { subject: '[MarketMind AI] Daily health report', text: 'ok' }),
    ).resolves.toBe('sent');
  });

  it('sends a non-ASCII subject and a body cut at the size limit', async () => {
    await expect(
      sendEmail(config, { subject: 'New lead ₹5,00,000 – वाकड', text: 'line\n'.repeat(20_000) }),
    ).resolves.toBe('sent');
  });
});
