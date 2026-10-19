// English display text for the contract's label enums (CONTRACTS §3). The M6 Marathi and Hindi pages will
// take these from @mm/core/i18n; the keys stay the contract values.
import type { BadgeLabel, TempLabel, TrustLabel } from '@mm/core/schema';

const TEMP_TEXT: Readonly<Record<TempLabel, string>> = {
  hot: 'Hot',
  trending: 'Trending',
  warm: 'Warm',
  cold: 'Cold',
};

const BADGE_TEXT: Readonly<Record<BadgeLabel, string>> = {
  hidden_gem: 'Hidden gem',
  best_value: 'Best value',
  late_night: 'Late night',
  family: 'Family',
  office_lunch: 'Office lunch',
};

export const TRUST_TEXT: Readonly<Record<TrustLabel, string>> = {
  verified: 'Verified',
  recently_checked: 'Recently checked',
  source_backed: 'Source-backed',
  price_checked: 'Price checked',
  hours_checked: 'Hours checked',
};

export function labelText(label: TempLabel | BadgeLabel): string {
  return label in TEMP_TEXT ? TEMP_TEXT[label as TempLabel] : BADGE_TEXT[label as BadgeLabel];
}
