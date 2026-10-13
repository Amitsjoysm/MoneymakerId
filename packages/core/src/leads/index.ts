// @mm/core/leads (owner C06): the lead logic shared by the forms, the Workers and the admin. Pure and
// runtime-neutral (Node and Cloudflare Workers). The consent texts live in @mm/core/constants and are re-exported
// here so a form needs one import; they are never copied.
export { LEAD_CONSENT_V1, REMINDER_CONSENT_V1 } from '../constants/index.ts';
export { ctaCopy } from './cta.ts';
export type { CtaCopy } from './cta.ts';
export { dedupeKey } from './dedupe.ts';
export { normalisePhone } from './phone.ts';
export { refCode, SERVICE_REF_ABBR } from './ref-code.ts';
export { leadScore } from './score.ts';
export type { LeadScore, LeadScoreInput, LeadScoreOptions } from './score.ts';
export { WHATSAPP_NUMBER, whatsappUrl } from './whatsapp.ts';
