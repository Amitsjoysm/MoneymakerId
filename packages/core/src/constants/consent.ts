// Versioned consent texts (DPDP Act, plan §13). A lead stores the version id of the text the visitor saw and
// the time they accepted it. A new wording is a new constant (`...-v2`); a published version is never edited.
import { deepFreeze } from './freeze.ts';

export const LEAD_CONSENT_V1 = deepFreeze({
  id: 'lead-consent-v1',
  text: 'Share my details with up to 3 verified contractors and let MarketMind AI contact me on WhatsApp/phone about this request',
} as const);

// DRAFT WORDING: the contract names this constant but gives no text. It is the "remind me before monsoon"
// opt-in for visitors who are just researching (plan §13), so it asks only for contact by MarketMind AI.
// The owner reviews it with the other legal copy (CLAUDE.md, owner inputs pending) before launch.
export const REMINDER_CONSENT_V1 = deepFreeze({
  id: 'reminder-consent-v1',
  text: 'Remind me before the monsoon about waterproofing and let MarketMind AI contact me on WhatsApp/phone for this reminder',
} as const);

/** Every consent text by version id, so a server can check the version a client sent. */
export const CONSENT_VERSIONS = deepFreeze({
  [LEAD_CONSENT_V1.id]: LEAD_CONSENT_V1,
  [REMINDER_CONSENT_V1.id]: REMINDER_CONSENT_V1,
} as const);
