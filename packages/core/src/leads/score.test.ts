import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LOCALITY_IDS, SUB_LOCALITY_IDS } from '../constants/index.ts';
import { OwnershipSchema, PropertyTypeSchema, TimelineSchema } from '../schema/index.ts';
import type { LeadInsert, LeadType, Ownership, PropertyType, Timeline } from '../schema/index.ts';
import { leadScore } from './score.ts';
import type { LeadScore, LeadScoreInput } from './score.ts';

// Invented fixture phone; never MarketMind AI's own WhatsApp number.
const PHONE = '+919876543210';

type QuoteOverrides = Partial<NonNullable<LeadScoreInput['quote']>>;
type Overrides = Omit<Partial<LeadScoreInput>, 'quote'> & { quote?: QuoteOverrides | null };

/**
 * A lead that earns exactly 24 points: researching (0) + tenant (3) + flat (6) + no estimate (0) + served
 * area (10) + valid phone (5) + no notes (0) + WhatsApp not confirmed (0). Each test changes one thing.
 */
function lead(overrides: Overrides = {}): LeadScoreInput {
  const { quote, ...rest } = overrides;
  return {
    lead_type: 'quote',
    phone_e164: PHONE,
    whatsapp_confirmed: false,
    quote:
      quote === null
        ? null
        : {
            service_id: 'terrace-waterproofing',
            locality_id: 'wakad',
            property_type: 'flat',
            ownership: 'tenant',
            timeline: 'researching',
            area: { preset: '2bhk', quantity: null },
            tier: null,
            estimate: null,
            requested_provider_id: null,
            notes: null,
            ...quote,
          },
    ...rest,
  };
}

const estimate = (expected: number) => ({ low: expected, expected, high: expected });
const BASELINE = 24;

describe('leadScore: the baseline', () => {
  it('takes a LeadInsert as is, which is what the Worker holds (checked by tsc in tsconfig.test.json)', () => {
    const fromWorker: (insert: LeadInsert) => LeadScore = leadScore;
    expect(fromWorker).toBe(leadScore);
  });

  it('scores 24 and grades C, with every rule listed in the reasons', () => {
    const result = leadScore(lead());
    expect(result.score).toBe(BASELINE);
    expect(result.grade).toBe('C');
    expect(result.qualified).toBe(false);
    expect(result.reasons.slice(0, 8)).toEqual([
      'Timeline: researching (+0)',
      'Ownership: tenant (+3)',
      'Property: flat (+6)',
      'Estimate: none (+0)',
      'Served area: wakad (+10)',
      'Phone: valid Indian mobile (+5)',
      'Notes: none (+0)',
      'Contact: WhatsApp not confirmed (+0)',
    ]);
  });
});

describe('leadScore: each scoring rule', () => {
  it.each<[Timeline, number]>([
    ['within_2_weeks', 30],
    ['within_1_month', 22],
    ['1_to_3_months', 12],
    ['researching', 0],
  ])('timeline %s earns %i', (timeline, points) => {
    const result = leadScore(lead({ quote: { timeline } }));
    expect(result.score).toBe(BASELINE + points);
    expect(result.reasons).toContain(`Timeline: ${timeline} (+${points})`);
  });

  it.each<[Ownership, number]>([
    ['owner', 15],
    ['society', 10],
    ['tenant', 3],
  ])('ownership %s earns %i', (ownership, points) => {
    const result = leadScore(lead({ quote: { ownership } }));
    expect(result.score).toBe(BASELINE - 3 + points);
    expect(result.reasons).toContain(`Ownership: ${ownership} (+${points})`);
  });

  it.each<[PropertyType, number]>([
    ['independent_house', 10],
    ['commercial', 10],
    ['society_common', 8],
    ['flat', 6],
  ])('property type %s earns %i', (property_type, points) => {
    const result = leadScore(lead({ quote: { property_type } }));
    expect(result.score).toBe(BASELINE - 6 + points);
    expect(result.reasons).toContain(`Property: ${property_type} (+${points})`);
  });

  it.each([
    ['no estimate', null, 0],
    ['an estimate of 0', estimate(0), 0],
    ['INR 1', estimate(1), 2],
    ['INR 24,999', estimate(24_999), 2],
    ['INR 25,000', estimate(25_000), 6],
    ['INR 99,999', estimate(99_999), 6],
    ['INR 100,000', estimate(100_000), 10],
    ['INR 499,999', estimate(499_999), 10],
    ['INR 500,000', estimate(500_000), 15],
    ['INR 5,000,000', estimate(5_000_000), 15],
  ])('%s earns %i', (_label, est, points) => {
    const result = leadScore(lead({ quote: { estimate: est } }));
    expect(result.score).toBe(BASELINE + points);
    expect(result.reasons).toContain(
      est === null ? 'Estimate: none (+0)' : `Estimate: INR ${est.expected} (+${points})`,
    );
  });

  it('a served locality earns 10 and an unserved one 0', () => {
    expect(leadScore(lead({ quote: { locality_id: 'baner' } })).score).toBe(BASELINE);
    const outside = leadScore(lead({ quote: { locality_id: 'mumbai' } }));
    expect(outside.score).toBe(BASELINE - 10);
    expect(outside.reasons).toContain('Served area: mumbai is outside the served area (+0)');
  });

  it('a valid phone earns 5 and an invalid one 0', () => {
    expect(leadScore(lead({ phone_e164: '9876543210' })).score).toBe(BASELINE - 5);
    expect(leadScore(lead({ phone_e164: '+442071234567' })).reasons).toContain(
      'Phone: not a valid Indian mobile (+0)',
    );
    expect(leadScore(lead({ phone_e164: '' })).score).toBe(BASELINE - 5);
  });

  it.each([
    ['empty', '', 0],
    ['spaces only', '          ', 0],
    ['9 characters', 'too short', 0],
    ['10 characters', 'ten chars!', 5],
    ['10 characters padded with spaces', '  ten chars!  ', 5],
    ['a real note', 'Seepage on the terrace after every monsoon; 2nd floor.', 5],
  ])('notes: %s', (_label, notes, points) => {
    const result = leadScore(lead({ quote: { notes } }));
    expect(result.score).toBe(BASELINE + points);
    expect(result.reasons).toContain(points > 0 ? 'Notes: provided (+5)' : 'Notes: none (+0)');
  });

  it('confirmed WhatsApp earns 10; absent or false earns 0', () => {
    const confirmed = leadScore(lead({ whatsapp_confirmed: true }));
    expect(confirmed.score).toBe(BASELINE + 10);
    expect(confirmed.reasons).toContain('Contact: WhatsApp confirmed (+10)');
    expect(leadScore(lead({ whatsapp_confirmed: false })).score).toBe(BASELINE);
    const { whatsapp_confirmed: _omit, ...withoutFlag } = lead();
    expect(leadScore(withoutFlag).score).toBe(BASELINE);
  });
});

describe('leadScore: served area', () => {
  it.each([...LOCALITY_IDS, ...SUB_LOCALITY_IDS, 'near-example-landmark'])('%s is served', (locality_id) => {
    expect(leadScore(lead({ quote: { locality_id } })).score).toBe(BASELINE);
  });

  it.each(['pune', 'mumbai', 'nashik', 'wakad-extension', 'nearby'])('%s is not served', (locality_id) => {
    expect(leadScore(lead({ quote: { locality_id } })).score).toBe(BASELINE - 10);
  });

  it('the caller can pass the live catalogue, which then replaces the default list exactly', () => {
    const options = { servedLocalityIds: ['wakad', 'sus-road'] };
    expect(leadScore(lead({ quote: { locality_id: 'sus-road' } }), options).score).toBe(BASELINE);
    expect(leadScore(lead({ quote: { locality_id: 'baner' } }), options).score).toBe(BASELINE - 10);
  });
});

describe('leadScore: grade thresholds (A >= 70, B >= 45, otherwise C)', () => {
  it.each([
    [
      'score 70 is A',
      70,
      'A',
      { quote: { timeline: 'within_2_weeks', ownership: 'owner', property_type: 'independent_house' } },
    ],
    [
      'score 69 is B',
      69,
      'B',
      {
        quote: {
          timeline: 'within_2_weeks',
          ownership: 'society',
          property_type: 'society_common',
          estimate: estimate(25_000),
        },
      },
    ],
    [
      'score 45 is B',
      45,
      'B',
      { quote: { timeline: '1_to_3_months', ownership: 'society', property_type: 'society_common' } },
    ],
    [
      'score 44 is C',
      44,
      'C',
      {
        quote: {
          timeline: '1_to_3_months',
          ownership: 'tenant',
          property_type: 'society_common',
          estimate: estimate(25_000),
        },
      },
    ],
  ] as const)('%s', (_label, score, grade, overrides) => {
    const result = leadScore(lead(overrides));
    expect(result.score).toBe(score);
    expect(result.grade).toBe(grade);
  });

  it('the best possible lead scores 100', () => {
    const best = leadScore(
      lead({
        whatsapp_confirmed: true,
        quote: {
          timeline: 'within_2_weeks',
          ownership: 'owner',
          property_type: 'commercial',
          estimate: estimate(1_000_000),
          notes: 'Terrace leaks in three places; need work before June.',
        },
      }),
    );
    expect(best.score).toBe(100);
    expect(best.grade).toBe('A');
  });
});

describe('leadScore: caps', () => {
  const strong: Overrides = {
    whatsapp_confirmed: true,
    quote: { timeline: 'within_2_weeks', ownership: 'owner', property_type: 'independent_house' },
  };

  it('a strong lead outside the served area is capped at C and never qualifies', () => {
    const inArea = leadScore(lead(strong));
    expect(inArea.grade).toBe('A');
    const out = leadScore(lead({ ...strong, quote: { ...strong.quote, locality_id: 'mumbai' } }));
    expect(out.score).toBeGreaterThanOrEqual(45);
    expect(out.grade).toBe('C');
    expect(out.qualified).toBe(false);
    expect(out.reasons).toContain('Grade capped at C: outside the served area');
  });

  it('a strong lead with an invalid phone is capped at C and never qualifies', () => {
    const result = leadScore(lead({ ...strong, phone_e164: '9876543210' }));
    expect(result.score).toBeGreaterThanOrEqual(45);
    expect(result.grade).toBe('C');
    expect(result.qualified).toBe(false);
    expect(result.reasons).toContain('Grade capped at C: phone is not a valid Indian mobile');
  });

  it('a lead under the cap is not capped, and says nothing about it', () => {
    expect(leadScore(lead(strong)).reasons.some((reason) => reason.startsWith('Grade capped'))).toBe(false);
  });
});

describe('leadScore: qualified = grade A or B + contact confirmed + timeline within 3 months', () => {
  // Three ownership + property combinations, so the table covers leads that end up A, B and C. The grade each
  // one gets depends on the timeline, so the expected `qualified` is derived from the grade the lead actually got.
  const profiles: Record<string, QuoteOverrides> = {
    strong: { ownership: 'owner', property_type: 'independent_house' },
    middling: { ownership: 'society', property_type: 'society_common' },
    weak: { ownership: 'tenant', property_type: 'flat' },
  };
  const cases = TimelineSchema.options.flatMap((timeline) =>
    Object.keys(profiles).flatMap((profile) =>
      [false, true].map((confirmed): [string, Timeline, string, boolean] => [
        `${timeline} / ${profile} / confirmed=${confirmed}`,
        timeline,
        profile,
        confirmed,
      ]),
    ),
  );

  it.each(cases)('truth table: %s', (_label, timeline, profile, confirmed) => {
    const result = leadScore(
      lead({ whatsapp_confirmed: confirmed, quote: { ...profiles[profile], timeline } }),
    );
    const expected =
      (result.grade === 'A' || result.grade === 'B') && confirmed && timeline !== 'researching';
    expect(result.qualified).toBe(expected);
  });

  it('the truth table reaches qualified and unqualified outcomes for every grade', () => {
    const outcomes = new Set<string>();
    for (const [, timeline, profile, confirmed] of cases) {
      const result = leadScore(
        lead({ whatsapp_confirmed: confirmed, quote: { ...profiles[profile], timeline } }),
      );
      outcomes.add(`${result.grade}/${result.qualified}`);
    }
    expect([...outcomes].sort()).toEqual(['A/false', 'A/true', 'B/false', 'B/true', 'C/false']);
  });

  it('is true for an A lead, confirmed, starting within 2 weeks', () => {
    const result = leadScore(
      lead({
        whatsapp_confirmed: true,
        quote: { timeline: 'within_2_weeks', ownership: 'owner', property_type: 'independent_house' },
      }),
    );
    expect(result.grade).toBe('A');
    expect(result.qualified).toBe(true);
    expect(result.reasons).toContain('Qualified: grade A, contact confirmed, timeline within 3 months');
  });

  it('is true for a B lead at the 3-month edge, confirmed', () => {
    const result = leadScore(
      lead({
        whatsapp_confirmed: true,
        quote: {
          timeline: '1_to_3_months',
          ownership: 'owner',
          property_type: 'flat',
          estimate: estimate(80_000),
        },
      }),
    );
    expect(result.score).toBe(12 + 15 + 6 + 6 + 10 + 5 + 10);
    expect(result.grade).toBe('B');
    expect(result.qualified).toBe(true);
  });

  it('is false when the contact is not confirmed, and says why', () => {
    const result = leadScore(
      lead({
        whatsapp_confirmed: false,
        quote: { timeline: 'within_2_weeks', ownership: 'owner', property_type: 'independent_house' },
      }),
    );
    expect(result.grade).toBe('A');
    expect(result.qualified).toBe(false);
    expect(result.reasons).toContain('Not qualified: contact is not confirmed');
  });

  it('is false when the visitor is just researching, however good the lead looks, and says why', () => {
    const result = leadScore(
      lead({
        whatsapp_confirmed: true,
        quote: {
          timeline: 'researching',
          ownership: 'owner',
          property_type: 'commercial',
          estimate: estimate(1_000_000),
          notes: 'Planning a full terrace redo next year.',
        },
      }),
    );
    expect(result.grade).toBe('A');
    expect(result.qualified).toBe(false);
    expect(result.reasons).toContain('Not qualified: timeline is beyond 3 months');
  });

  it('is false for grade C, and says why', () => {
    // 24 - 10 (outside the served area) + 12 (1-3 months) + 10 (confirmed) = 36: C on its own score.
    const result = leadScore(
      lead({ whatsapp_confirmed: true, quote: { timeline: '1_to_3_months', locality_id: 'mumbai' } }),
    );
    expect(result.score).toBe(36);
    expect(result.grade).toBe('C');
    expect(result.qualified).toBe(false);
    expect(result.reasons).toContain('Not qualified: grade C');
  });
});

describe('leadScore: leads that are not quote requests', () => {
  it.each<LeadType>(['featured_enquiry', 'advertise', 'claim', 'contact', 'for_contractors', 'reminder'])(
    '%s is grade C, unqualified, score 0, even with a confirmed contact',
    (lead_type) => {
      const result = leadScore(lead({ lead_type, whatsapp_confirmed: true, quote: null }));
      expect(result).toEqual({
        grade: 'C',
        qualified: false,
        score: 0,
        reasons: ['Not a quote request: only quote leads are graded'],
      });
    },
  );

  it('a reminder that carries quote details is still not graded as a quote', () => {
    const result = leadScore(
      lead({
        lead_type: 'reminder',
        whatsapp_confirmed: true,
        quote: { timeline: 'within_2_weeks', ownership: 'owner' },
      }),
    );
    expect(result.grade).toBe('C');
    expect(result.qualified).toBe(false);
  });

  it('a quote lead with no quote details is grade C and unqualified', () => {
    const result = leadScore(lead({ lead_type: 'quote', whatsapp_confirmed: true, quote: null }));
    expect(result.grade).toBe('C');
    expect(result.qualified).toBe(false);
    expect(result.reasons).toEqual(['Quote details are missing: nothing to grade']);
  });
});

describe('leadScore: properties', () => {
  const quote = fc.record({
    timeline: fc.constantFrom(...TimelineSchema.options),
    ownership: fc.constantFrom(...OwnershipSchema.options),
    property_type: fc.constantFrom(...PropertyTypeSchema.options),
    locality_id: fc.constantFrom('wakad', 'baner', 'near-example-landmark', 'mumbai'),
    estimate: fc.option(fc.integer({ min: 0, max: 20_000_000 }).map(estimate), { nil: null }),
    notes: fc.option(fc.string({ maxLength: 40 }), { nil: null }),
  });

  it('score stays within 0..100, qualified implies A/B + confirmed + within 3 months, grade matches the score', () => {
    fc.assert(
      fc.property(quote, fc.boolean(), fc.constantFrom(PHONE, '9876543210', ''), (q, confirmed, phone) => {
        const result = leadScore(lead({ whatsapp_confirmed: confirmed, phone_e164: phone, quote: q }));
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        const capped = q.locality_id === 'mumbai' || phone !== PHONE;
        const fromScore = result.score >= 70 ? 'A' : result.score >= 45 ? 'B' : 'C';
        expect(result.grade).toBe(capped ? 'C' : fromScore);
        if (result.qualified) {
          expect(['A', 'B']).toContain(result.grade);
          expect(confirmed).toBe(true);
          expect(q.timeline).not.toBe('researching');
        }
        expect(result.reasons.length).toBeGreaterThan(0);
      }),
      { numRuns: 500 },
    );
  });

  it('is pure: it does not change its input and gives the same answer twice', () => {
    const input = lead({
      whatsapp_confirmed: true,
      quote: { timeline: 'within_1_month', notes: 'Leak near the lift room.' },
    });
    const snapshot = structuredClone(input);
    const first = leadScore(input);
    expect(input).toEqual(snapshot);
    expect(leadScore(input)).toEqual(first);
  });
});
