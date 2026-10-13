// The English UI strings the components and pages share (nav, CTAs, form labels, errors, empty states). Keys are flat
// and dotted (`cta.get_quotes`); `{name}` marks a placeholder. Marathi and Hindi catalogues (`messages/mr.json`,
// `messages/hi.json`) are I01's, so for now every locale reads the English text.
//
// Not here, on purpose: the legal and consent texts and the paid-placement labels (`@mm/core/constants`), anything
// that comes from data (names, prices, sources), and any phone number.
import en from './messages/en.json' with { type: 'json' };

export type MessageKey = keyof typeof en;

export type MessageParams = Readonly<Record<string, string | number>>;

export const EN_MESSAGES: Readonly<Record<MessageKey, string>> = en;

export const MESSAGE_KEYS = Object.keys(EN_MESSAGES) as readonly MessageKey[];

export function isMessageKey(key: string): key is MessageKey {
  return Object.hasOwn(EN_MESSAGES, key);
}

const PLACEHOLDER = /\{([a-z][a-z0-9_]*)\}/g;

/**
 * The English text for `key` with each `{name}` replaced by `params.name`. Values go in literally. A placeholder
 * without a value throws `RangeError`: a page that prints `{field}` to a visitor is a bug the build should catch.
 */
export function message(key: MessageKey, params: MessageParams = {}): string {
  return EN_MESSAGES[key].replace(PLACEHOLDER, (_match, name: string) => {
    if (!Object.hasOwn(params, name)) throw new RangeError(`message "${key}" needs the parameter "${name}"`);
    return String(params[name]);
  });
}
