import type { AlertEnv, AlertStatus, TelegramLink } from './types.ts';
import { truncateChars } from './text.ts';

/** Telegram's limit for a message, counted after it has parsed the HTML entities. */
export const TELEGRAM_MAX_CHARS = 4096;
const TELEGRAM_TIMEOUT_MS = 5000;

/** Telegram HTML mode treats only these three characters as markup. */
export function escapeTelegramHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** The same, for a value inside a double-quoted HTML attribute. */
function escapeTelegramAttribute(value: string): string {
  return escapeTelegramHtml(value).replaceAll('"', '&quot;');
}

/**
 * Sends `text` (plain text; it is escaped here) to the owner's Telegram chat. Never throws. With `link`, one
 * HTML link goes on its own line after the text; the label counts toward the limit, the address does not, and
 * it is the text that is cut when the message is too long, never the link.
 *
 * `skipped`: the bot token or chat id is not configured, or there is nothing to send.
 * `failed`: Telegram answered with an error, or the request failed or timed out.
 *
 * The bot token is part of the request URL, so it is never logged: failures log the HTTP status or the
 * error name only.
 */
export async function sendTelegram(
  env: AlertEnv,
  text: string,
  options: { link?: TelegramLink } = {},
): Promise<AlertStatus> {
  try {
    const token = env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = env.TELEGRAM_CHAT_ID?.trim();
    const link = options.link;
    // The limit applies to the text Telegram shows (after it parses the entities and tags), so cut before
    // escaping, and leave room for the new line and the label of the link.
    const room = TELEGRAM_MAX_CHARS;
    const message = truncateChars(text.trim(), room);
    if (!token || !chatId || !message) return 'skipped';
    const html = link
      ? `${escapeTelegramHtml(message)}\n<a href="${escapeTelegramAttribute(link.url)}">${escapeTelegramHtml(link.label)}</a>`
      : escapeTelegramHtml(message);

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
    // Free the connection; the answer carries nothing the caller needs.
    await response.body?.cancel().catch(() => {});
    if (response.ok) return 'sent';
    console.warn(`[alerts] telegram: HTTP ${response.status}`);
    return 'failed';
  } catch (error) {
    console.warn(
      `[alerts] telegram: request failed (${error instanceof Error ? error.name : 'unknown error'})`,
    );
    return 'failed';
  }
}
