// Shapes for @mm/edge/alerts. Type-only (erased at build time). The module also runs in Node (GitHub Actions:
// the health report and the dead-man check), so nothing here depends on the Workers global types.
import type { LeadGrade, LeadType, Provider } from '@mm/core/schema';

/** What happened to one channel. `skipped` means it is not configured (or there was nothing to send). */
export type AlertStatus = 'sent' | 'skipped' | 'failed';

export interface AlertResult {
  telegram: AlertStatus;
  email: AlertStatus;
}

/** One tap-to-open link under a Telegram message: `label` is what the owner reads, `url` is where it goes. */
export interface TelegramLink {
  label: string;
  url: string;
}

/** The envelope of an email, as the Workers runtime `EmailMessage` exposes it. */
export interface EmailEnvelope {
  readonly from: string;
  readonly to: string;
}

/** The part of the `send_email` binding (`SendEmail` in the Workers types) that the sender uses. */
export interface EmailBinding {
  send(message: EmailEnvelope): Promise<unknown>;
}

/**
 * The bindings and variables the senders read. Every Worker's `env` satisfies it (all fields are optional,
 * so a Worker or a Node script without a channel configured simply skips that channel).
 *
 * `ALERT_EMAIL_TO` is the verified destination address of the `send_email` binding (docs/DEPLOY.md D1).
 * `ALERT_EMAIL_FROM` is optional and defaults to `alerts@marketmindai.com`.
 */
export interface AlertEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  ALERT_EMAIL?: EmailBinding;
  ALERT_EMAIL_TO?: string;
  ALERT_EMAIL_FROM?: string;
}

/**
 * A new lead. The message text shows the phone masked. The Telegram message also carries a "Reply on
 * WhatsApp" link to the customer's number (plan Q-D); the email never has the full number.
 */
export interface LeadAlert {
  kind: 'lead';
  ref: string;
  grade: LeadGrade;
  /** E.164 as stored (`+919876543210`). The text shows only the masked form; the reply link needs the whole number. */
  phone: string;
  lead_type?: LeadType;
  service?: string | null;
  locality?: string | null;
}

/** A provider key was disabled. Carries the fingerprint and account label, never the key. */
export interface KeyDisabledAlert {
  kind: 'key_disabled';
  provider: Provider;
  account_label: string;
  fingerprint: string;
  reason: string;
}

/** A scheduled job has not reported in. `last_seen` is an ISO timestamp, or null if it never has. */
export interface DeadManAlert {
  kind: 'dead_man';
  job: string;
  last_seen: string | null;
}

/** The daily health report: one line per item. */
export interface HealthAlert {
  kind: 'health';
  summary: string[];
}

export type AlertEvent = LeadAlert | KeyDisabledAlert | DeadManAlert | HealthAlert;
