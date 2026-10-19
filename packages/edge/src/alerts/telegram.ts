import type { AlertEnv, AlertStatus } from './types.ts';
import { truncateChars } from './text.ts';

/** Telegram's limit for a message, counted after it has parsed the HTML entities. */
export const TELEGRAM_MAX_CHARS = 4096;
const TELEGRAM_TIMEOUT_MS = 5000;

/** Telegram HTML mode treats only these three characters as markup. */
export function escapeTelegramHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Sends `text` (plain text; it is escaped here) to the owner's Telegram chat. Never throws.
 *
 * `skipped`: the bot token or chat id is not configured, or there is nothing to send.
 * `failed`: Telegram answered with an error, or the request failed or timed out.
 *
 * The bot token is part of the request URL, so it is never logged: failures log the HTTP status or the
 * error name only.
 */
export async function sendTelegram(env: AlertEnv, text: string): Promise<AlertStatus> {
  try {
    const token = env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = env.TELEGRAM_CHAT_ID?.trim();
    // The limit applies to the text Telegram shows, so cut before escaping.
    const message = truncateChars(text.trim(), TELEGRAM_MAX_CHARS);
    if (!token || !chatId || !message) return 'skipped';

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: escapeTelegramHtml(message),
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
