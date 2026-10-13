// `showAd` (CONTRACTS §9): the one gate every ad and sponsorship slot passes through. Pure: the rules
// (data/ad-slots.json) and the feature flags are arguments.
//
// Two hard rules come before the data: the page types in NEVER_ADS and the whole admin host never show an ad,
// whatever the rules or flags say. After that, the first enabled rule that matches host, page type, slot and
// device decides the provider, and the feature flag of that provider has the last word.
import { NEVER_ADS } from '../constants/index.ts';
import type { AdProvider, AdSlotId, AdSlotRule, DeviceClass, Host, PageType } from '../schema/index.ts';

/** The runtime switches: AdSense and sponsorships can each be turned off without touching the rules. */
export interface AdFlags {
  adsense: boolean;
  sponsorships: boolean;
}

/** `provider` is present exactly when `show` is true. */
export type AdDecision = { show: false } | { show: true; provider: AdProvider };

const NEVER_ADS_SET: ReadonlySet<PageType> = new Set(NEVER_ADS);

export function showAd(
  slot: AdSlotId,
  pageType: PageType,
  device: DeviceClass,
  host: Host,
  flags: AdFlags,
  rules: readonly AdSlotRule[],
): AdDecision {
  if (host === 'admin' || NEVER_ADS_SET.has(pageType)) return { show: false };

  const rule = rules.find(
    (r) =>
      r.enabled &&
      r.host === host &&
      r.page_types.includes(pageType) &&
      r.slots.includes(slot) &&
      r.devices.includes(device),
  );
  if (rule === undefined) return { show: false };

  const switchedOn = rule.provider === 'adsense' ? flags.adsense : flags.sponsorships;
  return switchedOn ? { show: true, provider: rule.provider } : { show: false };
}
