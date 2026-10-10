// CONTRACTS §8a: which freshness tier each claim type belongs to, and how long each tier lasts.
import type { ClaimType, FreshnessTier } from '../schema/enums.ts';
import { deepFreeze } from './freeze.ts';

/** `satisfies` makes adding a ClaimType without a tier a compile error. */
export const CLAIM_TIER = deepFreeze({
  price: 'HOT',
  hours: 'HOT',
  offer: 'HOT',
  availability: 'HOT',
  dish: 'WARM',
  service: 'WARM',
  phone: 'WARM',
  rating: 'WARM',
  mention: 'WARM',
  address: 'COLD',
  locality_fact: 'COLD',
  cost_rate: 'COST',
} as const satisfies Record<ClaimType, FreshnessTier>);

/** Days a claim stays valid after `retrieved_at`, unless its source states its own date (plan §8). */
export const TIER_TTL_DAYS = deepFreeze({ HOT: 14, WARM: 60, COLD: 365, COST: 180 } as const satisfies Record<
  FreshnessTier,
  number
>);
