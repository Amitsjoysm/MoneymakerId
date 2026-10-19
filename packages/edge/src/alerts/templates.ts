import { whatsappUrl } from '@mm/core/leads';
import { cleanInline } from './text.ts';
import type { AlertEvent, LeadAlert, TelegramLink } from './types.ts';

const FIELD_MAX = 120;
const SUMMARY_LINE_MAX = 500;
/** A key fingerprint is a 12-character sha256 prefix. Anything longer is not one. */
const FINGERPRINT_MAX = 16;
const REDACTED = '[redacted]';

/** One line of text for a field value: clean, short, or `fallback` when empty. */
function field(value: unknown, fallback = 'n/a'): string {
  return cleanInline(value, FIELD_MAX) || fallback;
}

/** Hides anything that looks like an API key (a run of 20 or more key characters). */
function redactSecrets(value: string): string {
  return value.replace(/[A-Za-z0-9_-]{20,}/g, REDACTED);
}

/**
 * `+91 98xxx xx210`: the first two and the last three digits of an Indian mobile number. Anything that is
 * not a ten-digit number shows only its last three digits. The text of an alert never has the full number;
 * the Telegram reply link (`whatsappReplyLink`) and the lead record in the admin do.
 */
export function maskPhone(phone: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length >= 10) {
    const national = digits.slice(-10);
    return `+91 ${national.slice(0, 2)}xxx xx${national.slice(7)}`;
  }
  if (digits.length > 3) return 'x'.repeat(digits.length - 3) + digits.slice(-3);
  return 'x'.repeat(digits.length);
}

/** The fields of a stored lead (`LeadRecord`) that the lead alert needs. */
export interface LeadAlertSource {
  ref: string;
  grade: LeadAlert['grade'];
  phone_e164: string;
  lead_type: NonNullable<LeadAlert['lead_type']>;
  quote: { service_id: string; locality_id: string } | null;
  business: { locality_id: string } | null;
}

/** Builds the lead alert for a stored lead: the service and locality come from its quote or its business. */
export function leadAlert(lead: LeadAlertSource): LeadAlert {
  return {
    kind: 'lead',
    ref: lead.ref,
    grade: lead.grade,
    lead_type: lead.lead_type,
    service: lead.quote?.service_id ?? null,
    locality: lead.quote?.locality_id ?? lead.business?.locality_id ?? null,
    phone: lead.phone_e164,
  };
}

const REPLY_LABEL = 'Reply on WhatsApp';
/** E.164: a `+`, then a country code and the number, 10 to 15 digits in all. */
const E164 = /^\+[1-9]\d{9,14}$/;

/**
 * The "Reply on WhatsApp" link under a Telegram lead alert, so the owner can answer within two working hours
 * (plan §13). It opens a chat with the CUSTOMER (`wa.me/<their digits>`), with a short greeting that carries
 * the lead ref; it never uses MarketMind AI's own number. Only Telegram gets it: the email is the searchable
 * record and stays masked.
 *
 * Returns `null` for every other kind of alert, and for a lead whose phone is not E.164 or whose ref
 * `whatsappUrl` cannot carry, so a bad value drops the link and never the alert.
 */
export function whatsappReplyLink(event: AlertEvent): TelegramLink | null {
  if (event.kind !== 'lead' || !E164.test(event.phone)) return null;
  const about = event.lead_type === 'quote' ? 'your quote request' : 'your enquiry';
  try {
    const url = whatsappUrl(
      { text: `Hi, this is MarketMind AI about ${about}.`, ref: event.ref },
      event.phone.slice(1),
    );
    return { label: REPLY_LABEL, url };
  } catch {
    return null;
  }
}

/**
 * The plain-text subject and body for an alert. The same text goes to Telegram and to email. Every value is
 * one line (`cleanInline`), so nothing a visitor typed can add lines to a message. Throws for an event it
 * does not know; `alert()` catches that.
 */
export function renderAlert(event: AlertEvent): { subject: string; body: string } {
  switch (event.kind) {
    case 'lead': {
      const ref = field(event.ref, 'unknown');
      const lines = [`Ref: ${ref}`, `Grade: ${field(event.grade)}`];
      if (event.lead_type) lines.push(`Type: ${field(event.lead_type)}`);
      lines.push(
        `Service: ${field(event.service)}`,
        `Locality: ${field(event.locality)}`,
        `Phone: ${maskPhone(event.phone)}`,
      );
      return { subject: `New lead ${ref} (grade ${field(event.grade)})`, body: lines.join('\n') };
    }
    case 'key_disabled': {
      const provider = field(event.provider);
      const account = redactSecrets(field(event.account_label));
      const fingerprint = field(event.fingerprint);
      return {
        subject: `API key disabled: ${provider} (${account})`,
        body: [
          `Provider: ${provider}`,
          `Account: ${account}`,
          `Fingerprint: ${fingerprint.length > FINGERPRINT_MAX ? REDACTED : fingerprint}`,
          `Reason: ${redactSecrets(field(event.reason))}`,
        ].join('\n'),
      };
    }
    case 'dead_man': {
      const job = field(event.job);
      return {
        subject: `Dead-man alert: ${job} has not reported`,
        body: [`Job: ${job}`, `Last seen: ${field(event.last_seen, 'never')}`].join('\n'),
      };
    }
    case 'health': {
      const lines = event.summary.map((line) => cleanInline(line, SUMMARY_LINE_MAX));
      return { subject: 'Daily health report', body: lines.length > 0 ? lines.join('\n') : 'No details.' };
    }
    default:
      throw new Error(`Unknown alert kind: ${field((event as { kind?: unknown }).kind)}`);
  }
}
