// Lead de-duplication key (plan §13: the same phone + service within 30 days is one lead, never sold twice).
//
// `api.submit_lead` itself dedupes on the raw columns `(phone_e164, service_id, created_at)` (index
// `leads_dedupe_idx`), so the database does not need this key. It exists for the places that must compare leads
// without holding the phone number: the Workers KV outbox, alert de-duplication and logs.
import { PhoneE164Schema, SlugSchema } from '../schema/index.ts';

/** Versioned, so a changed recipe is a new prefix and never silently reinterprets stored keys. */
const PREIMAGE_PREFIX = 'mm:lead-dedupe:v1';

/**
 * A stable key for "this phone asked for this service": the SHA-256 hex of `prefix \n phone \n service`
 * (64 lowercase characters), computed with Web Crypto, which Node 22 and Workers both provide.
 *
 * The raw number is not in the key, but the key is not anonymous: a ten-digit number can be brute-forced from
 * its hash, so treat it as personal data, with the same care and retention as the phone itself.
 *
 * `phoneE164` must already be normalised (`normalisePhone`) and `serviceId` a service slug; anything else throws
 * `RangeError`, because a loose key would merge unrelated leads.
 */
export async function dedupeKey(phoneE164: string, serviceId: string): Promise<string> {
  if (!PhoneE164Schema.safeParse(phoneE164).success) {
    throw new RangeError('dedupeKey: phone must be a normalised E.164 Indian mobile (+91…)');
  }
  if (!SlugSchema.safeParse(serviceId).success) {
    throw new RangeError('dedupeKey: service must be a lowercase ASCII service id');
  }
  const preimage = new TextEncoder().encode(`${PREIMAGE_PREFIX}\n${phoneE164}\n${serviceId}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', preimage));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
