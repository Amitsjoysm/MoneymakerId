// CONTRACTS §9. Page types that never show an ad or sponsorship (the whole admin host never does either).
// C07's `showAd` consumes this list.
import type { PageType } from '../schema/enums.ts';
import { deepFreeze } from './freeze.ts';

export const NEVER_ADS: readonly PageType[] = deepFreeze([
  'get_quotes',
  'for_contractors',
  'ask',
  'legal',
  'business',
  'contact',
  'not_found',
  'thank_you',
] as const);
