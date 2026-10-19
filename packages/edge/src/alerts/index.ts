// @mm/edge/alerts (owner E03): Telegram and email alerts for new leads, disabled keys, the dead-man check and
// the daily health report. Nothing here throws. Runs in Workers and in Node (GitHub Actions: Telegram only).
export { alert } from './alert.ts';
export {
  buildRawEmail,
  DEFAULT_ALERT_FROM,
  EMAIL_BODY_MAX_BYTES,
  EMAIL_SUBJECT_MAX_CHARS,
  sendEmail,
} from './email.ts';
export type { EmailContent, RawEmailParts } from './email.ts';
export { escapeTelegramHtml, sendTelegram, TELEGRAM_MAX_CHARS } from './telegram.ts';
export { leadAlert, maskPhone, renderAlert } from './templates.ts';
export type { LeadAlertSource } from './templates.ts';
export type {
  AlertEnv,
  AlertEvent,
  AlertResult,
  AlertStatus,
  DeadManAlert,
  EmailBinding,
  EmailEnvelope,
  HealthAlert,
  KeyDisabledAlert,
  LeadAlert,
} from './types.ts';
