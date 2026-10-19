import { createEmailMessage } from './email-message.ts';
import { cleanInline, ELLIPSIS, truncateBytes } from './text.ts';
import type { AlertEnv, AlertStatus } from './types.ts';

export const EMAIL_SUBJECT_MAX_CHARS = 120;
export const EMAIL_BODY_MAX_BYTES = 50 * 1024;
/** docs/DEPLOY.md D1 step 3: the custom address on the Email Routing zone. */
export const DEFAULT_ALERT_FROM = 'alerts@marketmindai.com';

const FROM_NAME = 'MarketMind AI';
const FALLBACK_SUBJECT = 'MarketMind AI alert';
/** Bytes of UTF-8 per RFC 2047 encoded-word: 36 bytes become 48 base64 characters, 60 with the wrapper. */
const ENCODED_WORD_BYTES = 36;
const BASE64_LINE = 76;

// A plain address: dot-atom local part, a domain with at least one dot. No display names, no comments, no
// quotes, no whitespace. That is all a configured alert address needs, and it rules out header injection.
const ADDRESS =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

function isAddress(value: string): boolean {
  return value.length <= 254 && ADDRESS.test(value);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += width) lines.push(text.slice(i, i + width));
  return lines;
}

/** The `Subject` value: plain when it is printable ASCII, else RFC 2047 encoded-words, folded one per line. */
function encodeSubject(subject: string): string {
  if (/^[\x20-\x7e]*$/.test(subject)) return subject;
  const encoder = new TextEncoder();
  const words: string[] = [];
  let chunk = '';
  let chunkBytes = 0;
  const flush = () => {
    if (chunk) words.push(`=?UTF-8?B?${toBase64(encoder.encode(chunk))}?=`);
    chunk = '';
    chunkBytes = 0;
  };
  for (const character of subject) {
    const size = encoder.encode(character).length;
    if (chunkBytes + size > ENCODED_WORD_BYTES) flush();
    chunk += character;
    chunkBytes += size;
  }
  flush();
  return words.join('\r\n ');
}

export interface RawEmailParts {
  from: string;
  to: string;
  subject: string;
  text: string;
  date: Date;
  /** Unique id; the Message-ID is `<messageId@domain-of-from>`. */
  messageId: string;
}

/**
 * A minimal RFC 5322 text/plain message with CRLF line endings. The subject is one line of at most 120
 * characters (encoded if it is not ASCII); the body is at most 50 KB of UTF-8, sent as base64 so that any
 * text and any line length is safe.
 */
export function buildRawEmail(parts: RawEmailParts): string {
  const subject = cleanInline(parts.subject, EMAIL_SUBJECT_MAX_CHARS) || FALLBACK_SUBJECT;
  const domain = parts.from.slice(parts.from.lastIndexOf('@') + 1);

  const normalised = parts.text.replace(/\r\n?|\n/g, '\r\n');
  // If the cut falls between a CR and its LF, drop the CR so the body has no bare carriage return.
  const body = truncateBytes(normalised, EMAIL_BODY_MAX_BYTES).replace(new RegExp(`\\r(?=${ELLIPSIS}$)`), '');

  const headers = [
    `From: ${FROM_NAME} <${parts.from}>`,
    `To: ${parts.to}`,
    `Subject: ${encodeSubject(subject)}`,
    `Date: ${parts.date.toUTCString().replace(/GMT$/, '+0000')}`,
    `Message-ID: <${parts.messageId}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  return [...headers, '', ...wrap(toBase64(new TextEncoder().encode(body)), BASE64_LINE)].join('\r\n');
}

export interface EmailContent {
  subject: string;
  text: string;
}

/**
 * Sends a plain-text email through the `ALERT_EMAIL` `send_email` binding. Never throws.
 *
 * `skipped`: the binding or the destination address (`ALERT_EMAIL_TO`) is not configured.
 * `failed`: an address is malformed, the message could not be built, or the binding refused it.
 */
export async function sendEmail(env: AlertEnv, content: EmailContent): Promise<AlertStatus> {
  try {
    const binding = env.ALERT_EMAIL;
    const to = env.ALERT_EMAIL_TO?.trim();
    if (!binding || !to) return 'skipped';
    const from = env.ALERT_EMAIL_FROM?.trim() || DEFAULT_ALERT_FROM;
    if (!isAddress(to) || !isAddress(from)) {
      console.warn('[alerts] email: ALERT_EMAIL_TO or ALERT_EMAIL_FROM is not a plain email address');
      return 'failed';
    }

    const raw = buildRawEmail({
      from,
      to,
      subject: content.subject,
      text: content.text,
      date: new Date(),
      messageId: crypto.randomUUID(),
    });
    await binding.send(await createEmailMessage(from, to, raw));
    return 'sent';
  } catch (error) {
    console.warn(`[alerts] email: send failed (${error instanceof Error ? error.name : 'unknown error'})`);
    return 'failed';
  }
}
