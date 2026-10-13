// @mm/core/i18n (owner C05b): locale-aware URLs and the English UI strings. Pure and runtime-neutral (Node and
// Cloudflare Workers). The Marathi and Hindi catalogues (`messages/mr.json`, `messages/hi.json`) are I01's.
export { DEFAULT_LOCALE, PREFIXED_LOCALES, localizedUrl, splitLocalePrefix } from './locale.ts';
export { EN_MESSAGES, MESSAGE_KEYS, isMessageKey, message } from './messages.ts';
export type { MessageKey, MessageParams } from './messages.ts';
