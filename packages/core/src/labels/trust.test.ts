import { describe, expect, it } from 'vitest';
import { CLAIM_TIER, MIN_LABEL_EVIDENCE, TIER_TTL_DAYS } from '../constants/index.ts';
import type { ClaimType } from '../schema/index.ts';
import { DAY_MS, NOW, daysAgo, makeEvidence, makePlace, makeProvider } from './fixtures/views.ts';
import { RECENTLY_CHECKED_DAYS } from './thresholds.ts';
import { trustLabels } from './trust.ts';
import { isLive, lastChecked } from './validity.ts';

const verifiedPlace = (over = {}) =>
  makePlace({ verification_status: 'verified', verified_at: daysAgo(10), ...over });

const inDays = (days: number) => new Date(NOW.getTime() + days * DAY_MS).toISOString();

describe('isLive: validity windows (CLAIM_TIER and TIER_TTL_DAYS)', () => {
  it('lasts the tier TTL of the claim type after retrieval, the last instant included', () => {
    for (const type of ['price', 'dish', 'address', 'cost_rate'] as ClaimType[]) {
      const ttl = TIER_TTL_DAYS[CLAIM_TIER[type]];
      expect(isLive(makeEvidence(type, ttl), NOW), `${type} at ttl`).toBe(true);
      expect(isLive(makeEvidence(type, ttl + 0.001), NOW), `${type} past ttl`).toBe(false);
    }
  });
  it('takes the TTL from the claim type, not from the stored tier column', () => {
    const mislabelled = makeEvidence('price', 30, { tier: 'COLD' });
    expect(isLive(mislabelled, NOW)).toBe(false);
  });
  it('lets the source-stated valid_until replace the TTL, in both directions', () => {
    expect(isLive(makeEvidence('price', 30, { valid_until: inDays(1) }), NOW)).toBe(true);
    expect(isLive(makeEvidence('address', 1, { valid_until: daysAgo(0.5) }), NOW)).toBe(false);
  });
  it('rejects non-active rows, future retrievals and unreadable or inverted timestamps', () => {
    expect(isLive(makeEvidence('dish', 1, { status: 'superseded' }), NOW)).toBe(false);
    expect(isLive(makeEvidence('dish', 1, { status: 'rejected' }), NOW)).toBe(false);
    expect(isLive(makeEvidence('dish', -1), NOW)).toBe(false);
    expect(isLive(makeEvidence('dish', 1, { retrieved_at: 'x' }), NOW)).toBe(false);
    expect(isLive(makeEvidence('dish', 1, { valid_until: 'x' }), NOW)).toBe(false);
    expect(isLive(makeEvidence('dish', 1, { valid_until: daysAgo(3) }), NOW)).toBe(false);
  });
});

describe('lastChecked', () => {
  it('is the newest live row of the claim type, or null', () => {
    const rows = [
      makeEvidence('price', 9),
      makeEvidence('price', 3),
      makeEvidence('price', 1, { status: 'superseded' }),
      makeEvidence('price', 20),
      makeEvidence('hours', 5),
    ];
    expect(lastChecked(rows, NOW, 'price')?.toISOString()).toBe(daysAgo(3));
    expect(lastChecked(rows, NOW, 'hours')?.toISOString()).toBe(daysAgo(5));
    expect(lastChecked(rows, NOW, 'offer')).toBeNull();
    expect(lastChecked(rows, NOW)?.toISOString()).toBe(daysAgo(3));
    expect(lastChecked([], NOW)).toBeNull();
  });
  it('ignores rows that cannot be cited: aggregator sources', () => {
    const aggregator = makeEvidence('price', 0, {
      source: {
        kind: 'aggregator',
        url: 'https://example.com/listing',
        title: null,
        publisher: null,
        experience_id: null,
      },
    });
    expect(lastChecked([aggregator], NOW, 'price')).toBeNull();
  });
});

describe('trustLabels', () => {
  it('returns nothing for an unverified business with no evidence', () => {
    expect(trustLabels([], makePlace(), NOW)).toEqual([]);
    expect(trustLabels([], makeProvider(), NOW)).toEqual([]);
  });

  describe('source_backed', () => {
    it('needs one live sourced row; it is not gated by MIN_LABEL_EVIDENCE', () => {
      expect(MIN_LABEL_EVIDENCE).toBeGreaterThan(1);
      expect(trustLabels([makeEvidence('dish', 40)], makePlace(), NOW)).toEqual(['source_backed']);
    });
    it('accepts a first-hand row without a URL', () => {
      const firstHand = makeEvidence('dish', 1, {
        source: {
          kind: 'first_hand',
          url: null,
          title: null,
          publisher: null,
          experience_id: '44444444-4444-4444-8444-444444444444',
        },
      });
      expect(trustLabels([firstHand], makePlace(), NOW)).toContain('source_backed');
    });
    it('does not count aggregator rows, a row without any source URL, or rows that are not active', () => {
      const aggregator = makeEvidence('dish', 1, {
        source: {
          kind: 'aggregator',
          url: 'https://example.com/listing',
          title: null,
          publisher: null,
          experience_id: null,
        },
      });
      const noUrl = makeEvidence('dish', 1, {
        source: { kind: 'menu', url: null, title: null, publisher: null, experience_id: null },
      });
      const rows = [
        aggregator,
        noUrl,
        makeEvidence('dish', 1, { status: 'superseded' }),
        makeEvidence('dish', 1, { status: 'rejected' }),
      ];
      expect(trustLabels(rows, makePlace(), NOW)).toEqual([]);
    });
  });

  describe('recently_checked', () => {
    it('needs a live row retrieved within the last 30 days, the 30th day included', () => {
      expect(RECENTLY_CHECKED_DAYS).toBe(30);
      expect(trustLabels([makeEvidence('dish', 30)], makePlace(), NOW)).toEqual([
        'recently_checked',
        'source_backed',
      ]);
      expect(trustLabels([makeEvidence('dish', 30.01)], makePlace(), NOW)).toEqual(['source_backed']);
    });
    it('is decided by the newest row, whatever the claim type', () => {
      const rows = [makeEvidence('address', 200), makeEvidence('dish', 3)];
      expect(trustLabels(rows, makePlace(), NOW)).toContain('recently_checked');
    });
    it('is not given for a row retrieved in the future', () => {
      expect(trustLabels([makeEvidence('dish', -2)], makePlace(), NOW)).toEqual([]);
    });
  });

  describe('price_checked and hours_checked', () => {
    it('come from a live price or hours row', () => {
      const labels = trustLabels([makeEvidence('price', 2), makeEvidence('hours', 2)], makePlace(), NOW);
      expect(labels).toEqual(['recently_checked', 'source_backed', 'price_checked', 'hours_checked']);
      expect(trustLabels([makeEvidence('price', 2)], makePlace(), NOW)).toEqual([
        'recently_checked',
        'source_backed',
        'price_checked',
      ]);
      expect(trustLabels([makeEvidence('hours', 2)], makePlace(), NOW)).toEqual([
        'recently_checked',
        'source_backed',
        'hours_checked',
      ]);
    });
    it('lapse when the HOT tier TTL passes, even though the row is still on file', () => {
      const ttl = TIER_TTL_DAYS.HOT;
      const stale = [makeEvidence('price', ttl + 1), makeEvidence('hours', ttl + 1), makeEvidence('dish', 1)];
      expect(trustLabels(stale, makePlace(), NOW)).toEqual(['recently_checked', 'source_backed']);
    });
    it('follow a source-stated valid_until past the TTL', () => {
      const row = makeEvidence('hours', 40, { valid_until: inDays(5) });
      expect(trustLabels([row], makePlace(), NOW)).toEqual(['source_backed', 'hours_checked']);
    });
    it('are not given for other claim types', () => {
      expect(
        trustLabels([makeEvidence('offer', 1), makeEvidence('availability', 1)], makePlace(), NOW),
      ).toEqual(['recently_checked', 'source_backed']);
    });
  });

  describe('verified', () => {
    it('needs the admin-set status and date, and evidence that has not all expired', () => {
      const live = [makeEvidence('dish', 5)];
      expect(trustLabels(live, verifiedPlace(), NOW)).toEqual([
        'verified',
        'recently_checked',
        'source_backed',
      ]);
      expect(
        trustLabels(live, makePlace({ verification_status: 'unverified', verified_at: daysAgo(1) }), NOW),
      ).not.toContain('verified');
      expect(trustLabels(live, verifiedPlace({ verified_at: null }), NOW)).not.toContain('verified');
    });
    it('works for providers too', () => {
      const provider = makeProvider({ verification_status: 'verified', verified_at: daysAgo(10) });
      expect(trustLabels([makeEvidence('service', 5)], provider, NOW)).toContain('verified');
    });
    it('is never given on expired or inactive evidence alone', () => {
      const expired = [makeEvidence('price', 100), makeEvidence('dish', 100), makeEvidence('hours', 100)];
      expect(trustLabels(expired, verifiedPlace(), NOW)).toEqual([]);
      expect(trustLabels([], verifiedPlace(), NOW)).toEqual([]);
      expect(trustLabels([makeEvidence('dish', 1, { status: 'rejected' })], verifiedPlace(), NOW)).toEqual(
        [],
      );
    });
  });

  it('never gives a fresh or verified label from expired evidence of any kind', () => {
    const types: ClaimType[] = [
      'price',
      'hours',
      'offer',
      'availability',
      'dish',
      'service',
      'phone',
      'rating',
      'mention',
    ];
    const rows = types.map((t) => makeEvidence(t, TIER_TTL_DAYS[CLAIM_TIER[t]] + 1));
    expect(trustLabels(rows, verifiedPlace(), NOW)).toEqual([]);
  });

  it('returns each label once, in TrustLabel order, however many rows there are', () => {
    const rows = [
      makeEvidence('price', 1),
      makeEvidence('price', 2),
      makeEvidence('hours', 1),
      makeEvidence('dish', 1),
    ];
    expect(trustLabels(rows, verifiedPlace(), NOW)).toEqual([
      'verified',
      'recently_checked',
      'source_backed',
      'price_checked',
      'hours_checked',
    ]);
  });

  it('does not mutate its inputs', () => {
    const rows = [makeEvidence('price', 1)];
    const place = verifiedPlace();
    const before = JSON.stringify([rows, place]);
    trustLabels(rows, place, NOW);
    expect(JSON.stringify([rows, place])).toBe(before);
  });
});
