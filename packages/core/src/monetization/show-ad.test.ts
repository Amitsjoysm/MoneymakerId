import { describe, expect, it } from 'vitest';
import { loadAdSlotRules } from '../config/index.ts';
import { NEVER_ADS } from '../constants/index.ts';
import { AdSlotIdSchema, DeviceClassSchema, HostSchema, PageTypeSchema } from '../schema/index.ts';
import type { AdSlotRule, DeviceClass, Host, PageType } from '../schema/index.ts';
import { showAd, type AdFlags } from './show-ad.ts';

const SLOTS = AdSlotIdSchema.options;
const DEVICES = DeviceClassSchema.options;
const HOSTS = HostSchema.options;
const PAGE_TYPES = PageTypeSchema.options;

const ALL_ON: AdFlags = { adsense: true, sponsorships: true };
const ALL_OFF: AdFlags = { adsense: false, sponsorships: false };

const rule = (over: Partial<AdSlotRule> = {}): AdSlotRule => ({
  host: 'food',
  page_types: ['dish_locality'],
  slots: ['AD_SLOT_AFTER_RESULTS'],
  devices: ['mobile', 'desktop'],
  provider: 'adsense',
  enabled: true,
  ...over,
});

/** A rule that matches everything, for every host and page type: only the hard rules can stop it. */
const everything = (provider: AdSlotRule['provider']): AdSlotRule[] =>
  HOSTS.map((host) =>
    rule({ host, page_types: [...PAGE_TYPES], slots: [...SLOTS], devices: [...DEVICES], provider }),
  );

const NO_AD = { show: false };

describe('showAd: pages that never show an ad', () => {
  it('has a never-ads list to test against', () => {
    expect(NEVER_ADS.length).toBeGreaterThan(0);
    expect(NEVER_ADS).toEqual(expect.arrayContaining(['get_quotes', 'thank_you', 'ask']));
  });

  it.each(NEVER_ADS)(
    '%s never shows an ad, whatever the rules, flags, host, slot or device say',
    (pageType) => {
      for (const provider of ['adsense', 'sponsorship'] as const) {
        const rules = everything(provider);
        for (const host of HOSTS) {
          for (const slot of SLOTS) {
            for (const device of DEVICES) {
              expect(
                showAd(slot, pageType, device, host, ALL_ON, rules),
                `${host} ${slot} ${device} ${provider}`,
              ).toEqual(NO_AD);
            }
          }
        }
      }
    },
  );

  it('the admin host never shows an ad on any page type, even with a rule that matches it', () => {
    for (const provider of ['adsense', 'sponsorship'] as const) {
      const rules = everything(provider);
      for (const pageType of PAGE_TYPES) {
        for (const slot of SLOTS) {
          for (const device of DEVICES) {
            expect(
              showAd(slot, pageType, device, 'admin', ALL_ON, rules),
              `${pageType} ${slot} ${device}`,
            ).toEqual(NO_AD);
          }
        }
      }
    }
  });

  it('every other page type on a public host does show when a rule matches (the hard rules are not over-broad)', () => {
    const allowed = PAGE_TYPES.filter((p) => !NEVER_ADS.includes(p));
    expect(allowed.length).toBeGreaterThan(0);
    for (const pageType of allowed) {
      expect(showAd('AD_SLOT_FOOTER', pageType, 'desktop', 'food', ALL_ON, everything('adsense'))).toEqual({
        show: true,
        provider: 'adsense',
      });
    }
  });
});

describe('showAd: matching rules', () => {
  const base = rule();

  it('shows, with the rule provider, when host, page type, slot and device all match an enabled rule', () => {
    expect(showAd('AD_SLOT_AFTER_RESULTS', 'dish_locality', 'mobile', 'food', ALL_ON, [base])).toEqual({
      show: true,
      provider: 'adsense',
    });
    expect(
      showAd('AD_SLOT_TOP', 'locality_hub', 'tablet', 'food', ALL_ON, [
        rule({
          page_types: ['locality_hub'],
          slots: ['AD_SLOT_TOP'],
          devices: ['tablet'],
          provider: 'sponsorship',
        }),
      ]),
    ).toEqual({
      show: true,
      provider: 'sponsorship',
    });
  });

  it.each<[string, AdSlotRule[]]>([
    ['no rules at all', []],
    ['a different host', [rule({ host: 'main' })]],
    ['a different page type', [rule({ page_types: ['dish_city'] })]],
    ['a different slot', [rule({ slots: ['AD_SLOT_SIDEBAR'] })]],
    ['a different device', [rule({ devices: ['desktop'] })]],
    [
      'empty page_types, slots or devices lists',
      [rule({ page_types: [] }), rule({ slots: [] }), rule({ devices: [] })],
    ],
    ['a disabled rule', [rule({ enabled: false })]],
  ])('does not show for %s', (_name, rules) => {
    expect(showAd('AD_SLOT_AFTER_RESULTS', 'dish_locality', 'mobile', 'food', ALL_ON, rules)).toEqual(NO_AD);
  });

  it('a slot is matched exactly: another slot of the same rule still shows', () => {
    const r = rule({ slots: ['AD_SLOT_AFTER_INTRO', 'AD_SLOT_FOOTER'] });
    expect(showAd('AD_SLOT_FOOTER', 'dish_locality', 'mobile', 'food', ALL_ON, [r]).show).toBe(true);
    expect(showAd('AD_SLOT_AFTER_RESULTS', 'dish_locality', 'mobile', 'food', ALL_ON, [r]).show).toBe(false);
  });

  it('skips disabled rules: the first ENABLED matching rule decides', () => {
    const rules = [
      rule({ enabled: false, provider: 'adsense' }),
      rule({ provider: 'sponsorship' }),
      rule({ provider: 'adsense' }),
    ];
    expect(showAd('AD_SLOT_AFTER_RESULTS', 'dish_locality', 'mobile', 'food', ALL_ON, rules)).toEqual({
      show: true,
      provider: 'sponsorship',
    });
  });

  it('skips non-matching rules before it', () => {
    const rules = [
      rule({ host: 'main', provider: 'sponsorship' }),
      rule({ devices: ['desktop'], provider: 'sponsorship' }),
      rule({ provider: 'adsense' }),
    ];
    expect(showAd('AD_SLOT_AFTER_RESULTS', 'dish_locality', 'mobile', 'food', ALL_ON, rules)).toEqual({
      show: true,
      provider: 'adsense',
    });
  });
});

describe('showAd: the feature flags gate the provider', () => {
  const adsense = rule({ provider: 'adsense' });
  const sponsorship = rule({ provider: 'sponsorship' });
  const ask = (rules: AdSlotRule[], flags: AdFlags) =>
    showAd('AD_SLOT_AFTER_RESULTS', 'dish_locality', 'mobile', 'food', flags, rules);

  it('adsense needs flags.adsense, and flags.sponsorships does not help it', () => {
    expect(ask([adsense], { adsense: true, sponsorships: false }).show).toBe(true);
    expect(ask([adsense], { adsense: false, sponsorships: true })).toEqual(NO_AD);
  });

  it('a sponsorship needs flags.sponsorships, and flags.adsense does not help it', () => {
    expect(ask([sponsorship], { adsense: false, sponsorships: true }).show).toBe(true);
    expect(ask([sponsorship], { adsense: true, sponsorships: false })).toEqual(NO_AD);
  });

  it('with both flags off nothing shows', () => {
    expect(ask([adsense], ALL_OFF)).toEqual(NO_AD);
    expect(ask([sponsorship], ALL_OFF)).toEqual(NO_AD);
  });

  it('the first matching rule decides: if its provider is switched off, a later rule does not take the slot', () => {
    expect(ask([adsense, sponsorship], { adsense: false, sponsorships: true })).toEqual(NO_AD);
    expect(ask([sponsorship, adsense], { adsense: true, sponsorships: false })).toEqual(NO_AD);
    expect(ask([adsense, sponsorship], ALL_ON)).toEqual({ show: true, provider: 'adsense' });
  });
});

describe('showAd: returns a fresh object every time', () => {
  it('mutating a result does not leak into the next call', () => {
    const first = showAd('AD_SLOT_FOOTER', 'get_quotes', 'mobile', 'construction', ALL_ON, []);
    (first as { show: boolean }).show = true;
    expect(showAd('AD_SLOT_FOOTER', 'get_quotes', 'mobile', 'construction', ALL_ON, [])).toEqual(NO_AD);
  });
});

describe('showAd against the real data/ad-slots.json', () => {
  const RULES = loadAdSlotRules();

  it('loads rules', () => {
    expect(RULES.length).toBeGreaterThan(0);
  });

  it('no combination on a never-ads page type or on the admin host shows, with every flag on', () => {
    const blocked = (host: Host, pageType: PageType) => host === 'admin' || NEVER_ADS.includes(pageType);
    for (const host of HOSTS) {
      for (const pageType of PAGE_TYPES) {
        if (!blocked(host, pageType)) continue;
        for (const slot of SLOTS) {
          for (const device of DEVICES) {
            expect(
              showAd(slot, pageType, device, host, ALL_ON, RULES),
              `${host} ${pageType} ${slot} ${device}`,
            ).toEqual(NO_AD);
          }
        }
      }
    }
  });

  it('every combination an enabled rule lists shows, with the provider of the first enabled rule that lists it', () => {
    const lists = (r: AdSlotRule, host: Host, pageType: PageType, slot: string, device: DeviceClass) =>
      r.enabled &&
      r.host === host &&
      r.page_types.includes(pageType) &&
      r.slots.includes(slot as never) &&
      r.devices.includes(device);
    let checked = 0;
    for (const r of RULES.filter((x) => x.enabled)) {
      for (const pageType of r.page_types.filter((p) => !NEVER_ADS.includes(p))) {
        for (const slot of r.slots) {
          for (const device of r.devices) {
            const first = RULES.find((x) => lists(x, r.host, pageType, slot, device))!;
            expect(
              showAd(slot, pageType, device, r.host, ALL_ON, RULES),
              `${r.host} ${pageType} ${slot} ${device}`,
            ).toEqual({
              show: true,
              provider: first.provider,
            });
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('the sidebar slot is desktop only and the top slot is a sponsorship, as the real rules say', () => {
    expect(showAd('AD_SLOT_SIDEBAR', 'dish_locality', 'mobile', 'food', ALL_ON, RULES)).toEqual(NO_AD);
    expect(showAd('AD_SLOT_SIDEBAR', 'dish_locality', 'desktop', 'food', ALL_ON, RULES)).toEqual({
      show: true,
      provider: 'adsense',
    });
    expect(showAd('AD_SLOT_TOP', 'locality_hub', 'mobile', 'food', ALL_ON, RULES)).toEqual({
      show: true,
      provider: 'sponsorship',
    });
    expect(
      showAd('AD_SLOT_TOP', 'locality_hub', 'mobile', 'food', { adsense: true, sponsorships: false }, RULES),
    ).toEqual(NO_AD);
  });
});
