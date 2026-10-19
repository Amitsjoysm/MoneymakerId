// The only file that touches `cloudflare:email`, so unit tests can replace it (`vi.mock('./email-message.ts')`)
// and so the rest of @mm/edge/alerts loads in Node, where that module does not exist. The import is dynamic:
// it is resolved the first time an email is sent, which only happens in a Worker that has the `send_email`
// binding.
import type { EmailEnvelope } from './types.ts';

/** Builds the Workers runtime `EmailMessage` for a raw RFC 5322 message. */
export async function createEmailMessage(from: string, to: string, raw: string): Promise<EmailEnvelope> {
  const { EmailMessage } = await import('cloudflare:email');
  return new EmailMessage(from, to, raw);
}
