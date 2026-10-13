// The only place a wa.me link is built (CONTRACTS §7, "WhatsApp links"). The number is MarketMind AI's own
// contact line: it belongs on contact/CTA surfaces and never in business data or business JSON-LD.

/** MarketMind AI's WhatsApp number (CONTRACTS §10 `WHATSAPP_NUMBER`): digits only, country code first. */
export const WHATSAPP_NUMBER = '919834346179';

/** wa.me wants the number without `+`, spaces or a trunk 0: a country code and 9-14 more digits. */
const WA_NUMBER = /^[1-9]\d{9,14}$/;

/** Matches the attribution `ref_code` limit (64) and covers both `C-WAKAD-WP` and a lead ref such as `MM-AB12CD`. */
const REF = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/**
 * `https://wa.me/<number>?text=<encoded>` where the text is `text`, a blank line, then `Ref <ref>`, so every
 * prefilled message carries its reference code (plan §13). Builds a plain link: the visitor taps it; it is
 * never an automatic redirect.
 *
 * `number` defaults to MarketMind AI's number; callers pass the `WHATSAPP_NUMBER` env value (an unset value,
 * `undefined`, keeps the default). Throws `RangeError` for a number that is not digits only or a missing or
 * malformed `ref`, because a wrong link must fail loudly at build time rather than ship.
 */
export function whatsappUrl(
  { text, ref }: { text: string; ref: string },
  number: string = WHATSAPP_NUMBER,
): string {
  if (!WA_NUMBER.test(number)) {
    throw new RangeError(
      'whatsappUrl: number must be digits only, with the country code and no "+" or spaces',
    );
  }
  if (!REF.test(ref)) {
    throw new RangeError('whatsappUrl: ref must be a non-empty code of letters, digits, "-" or "_" (max 64)');
  }
  const body = text.trim();
  const message = body === '' ? `Ref ${ref}` : `${body}\n\nRef ${ref}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
