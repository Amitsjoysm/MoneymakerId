import { sendEmail } from './email.ts';
import { sendTelegram } from './telegram.ts';
import { renderAlert, whatsappReplyLink } from './templates.ts';
import type { AlertEnv, AlertEvent, AlertResult, AlertStatus } from './types.ts';

const EMAIL_SUBJECT_PREFIX = '[MarketMind AI] ';

/** Runs a sender so that even a synchronous throw becomes a rejection of its own promise. */
async function start(send: () => Promise<AlertStatus>): Promise<AlertStatus> {
  return send();
}

function outcome(result: PromiseSettledResult<AlertStatus>): AlertStatus {
  return result.status === 'fulfilled' ? result.value : 'failed';
}

/**
 * Sends an alert to both channels (the owner's decision: Telegram and email), at the same time. Never
 * throws: a channel that is not configured is `skipped`, one that fails is `failed`, and one failing does
 * not stop the other. Callers in a request path run it in `ctx.waitUntil`.
 */
export async function alert(env: AlertEnv, event: AlertEvent): Promise<AlertResult> {
  try {
    const { subject, body } = renderAlert(event);
    // The reply link goes to Telegram only; the email is the masked, searchable record.
    const link = whatsappReplyLink(event) ?? undefined;
    const [telegram, email] = await Promise.allSettled([
      start(() => sendTelegram(env, `${subject}\n\n${body}`, { link })),
      start(() => sendEmail(env, { subject: `${EMAIL_SUBJECT_PREFIX}${subject}`, text: body })),
    ]);
    return { telegram: outcome(telegram), email: outcome(email) };
  } catch (error) {
    console.warn(
      `[alerts] could not render the alert (${error instanceof Error ? error.name : 'unknown error'})`,
    );
    return { telegram: 'failed', email: 'failed' };
  }
}
