// Phone normalisation (CONTRACTS §1: stored as E.164, Indian mobiles match ^\+91[6-9]\d{9}$ afterwards).
// Pure and runtime-neutral: it runs in the browser form, the Workers and the admin.
import { PhoneE164Schema } from '../schema/index.ts';

/** Devanagari digits U+0966..U+096F, which NFKC leaves alone but Marathi and Hindi keyboards produce. */
const DEVANAGARI_DIGITS = /[०-९]/g;

/** Separators people type or paste: whitespace, hyphens (incl. the Unicode dashes), dots, parentheses. */
const SEPARATORS = /[\s().‐-―-]/g;

/**
 * Turns what a visitor typed into an Indian mobile number in E.164, or `null` when it is not one.
 *
 * Accepted: `98765 43210`, `+91 98765-43210`, `0919876543210`, `09876543210`, `919876543210`, `0091…`.
 * Rejected: landlines (a ten-digit number must start 6-9), numbers of other countries, wrong lengths, letters.
 * Only the shape is checked; it cannot tell whether the number is in service.
 */
export function normalisePhone(input: string): string | null {
  if (typeof input !== 'string') return null;

  const text = input
    .normalize('NFKC')
    .replace(DEVANAGARI_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0966))
    .replace(SEPARATORS, '');

  // Only digits, with at most one `+` and only at the very start.
  if (!/^\+?\d+$/.test(text)) return null;
  const international = text.startsWith('+');
  const digits = international ? text.slice(1) : text;

  const national = nationalNumber(digits, international);
  if (national === null) return null;

  const e164 = `+91${national}`;
  return PhoneE164Schema.safeParse(e164).success ? e164 : null;
}

/** The ten-digit national number inside `digits`, or `null` when the length and prefix fit no accepted form. */
function nationalNumber(digits: string, international: boolean): string | null {
  // After a `+` the country code is mandatory: `+91` and ten digits, nothing else.
  if (international) return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : null;

  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1); // trunk 0
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2); // country code, no plus
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3); // trunk 0 + country code
  if (digits.length === 14 && digits.startsWith('0091')) return digits.slice(4); // 00 international prefix
  return null;
}
