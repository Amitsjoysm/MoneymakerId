// Text helpers shared by the alert templates and the two senders. Pure; no runtime-specific APIs.

export const ELLIPSIS = '…';

/**
 * A value as a single line of text: control characters and line breaks become one space, the result is
 * trimmed and capped at `max` characters. Anything a visitor or a provider can influence goes through
 * this before it is put in a message, so it cannot add lines or headers to it.
 */
export function cleanInline(value: unknown, max: number): string {
  const text = value === null || value === undefined ? '' : String(value);
  return truncateChars(text.replace(/[\p{Cc}\p{Zl}\p{Zp}\s]+/gu, ' ').trim(), max);
}

/** At most `max` UTF-16 characters, ending in an ellipsis when cut. Never splits a surrogate pair. */
export function truncateChars(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 0) return '';
  let end = max - ELLIPSIS.length;
  const last = text.charCodeAt(end - 1);
  if (end > 0 && last >= 0xd800 && last <= 0xdbff) end -= 1; // the first half of a surrogate pair
  return text.slice(0, end) + ELLIPSIS;
}

/** At most `maxBytes` bytes of UTF-8, ending in an ellipsis when cut. Cuts on a character boundary. */
export function truncateBytes(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  if (bytes.length <= maxBytes) return text;
  let end = Math.max(0, maxBytes - encoder.encode(ELLIPSIS).length);
  // `bytes[end]` is the first byte that is cut off. A continuation byte (10xxxxxx) means the cut is in the
  // middle of a character, so step back to the start of that character.
  while (end > 0 && ((bytes[end] ?? 0) & 0xc0) === 0x80) end -= 1;
  return new TextDecoder().decode(bytes.subarray(0, end)) + ELLIPSIS;
}
