// Lead scoring (plan §13, "Lead grade A/B/C"). Pure: the Worker (E02) calls it at submit time and the admin calls it
// again when a contact is confirmed.
//
// The plan fixes the inputs (timeline, ownership, property type, estimate size, served area, valid phone, WhatsApp
// confirmed, notes) and the qualified rule (grade A/B + contact confirmed + timeline within 3 months). It gives no
// points, so the weights below are a first hypothesis that the owner can tune once real leads show what sells.
// They add up to 100: timeline 30, ownership 15, property 10, estimate 15, served area 10, phone 5, WhatsApp 10,
// notes 5.
import { LOCALITY_IDS, SUB_LOCALITY_IDS } from '../constants/index.ts';
import { PhoneE164Schema } from '../schema/index.ts';
import type { LeadGrade, LeadInsert, Ownership, PropertyType, Timeline } from '../schema/index.ts';

const TIMELINE_POINTS: Readonly<Record<Timeline, number>> = {
  within_2_weeks: 30,
  within_1_month: 22,
  '1_to_3_months': 12,
  researching: 0,
};

/** Timelines that count as "within 3 months" for the qualified rule. */
const WITHIN_THREE_MONTHS: ReadonlySet<Timeline> = new Set<Timeline>([
  'within_2_weeks',
  'within_1_month',
  '1_to_3_months',
]);

const OWNERSHIP_POINTS: Readonly<Record<Ownership, number>> = { owner: 15, society: 10, tenant: 3 };

const PROPERTY_POINTS: Readonly<Record<PropertyType, number>> = {
  independent_house: 10,
  commercial: 10,
  society_common: 8,
  flat: 6,
};

/** Estimate size by the calculator's expected cost in whole INR: the first row the estimate reaches wins. */
const ESTIMATE_POINTS: readonly (readonly [minInr: number, points: number])[] = [
  [500_000, 15],
  [100_000, 10],
  [25_000, 6],
  [1, 2],
];

const SERVED_AREA_POINTS = 10;
const VALID_PHONE_POINTS = 5;
const WHATSAPP_CONFIRMED_POINTS = 10;
const NOTES_POINTS = 5;
/** A note shorter than this ("ok", "asap") says nothing about the job. */
const NOTES_MIN_CHARS = 10;

const GRADE_A_MIN = 70;
const GRADE_B_MIN = 45;

/** Landmark ids are `near-…` and each has a parent locality in Pune (CONTRACTS §4a). */
const LANDMARK_PREFIX = 'near-';
const DEFAULT_SERVED_LOCALITIES: ReadonlySet<string> = new Set<string>([
  ...LOCALITY_IDS,
  ...SUB_LOCALITY_IDS,
]);

/** The fields of a `LeadInsert` that scoring reads, plus the contact flag that only exists on the stored lead. */
export type LeadScoreInput = Pick<LeadInsert, 'lead_type' | 'phone_e164' | 'quote'> & {
  /**
   * True once the admin has confirmed the contact on WhatsApp (`LeadRecord.whatsapp_confirmed`). A lead being
   * submitted has not been confirmed yet, so the Worker leaves it out and the admin scores again after confirming.
   */
  whatsapp_confirmed?: boolean;
};

export type LeadScore = {
  grade: LeadGrade;
  /** Grade A/B + contact confirmed + timeline within 3 months (plan §13). */
  qualified: boolean;
  /** 0-100, the sum of the rules. The grade is derived from it (and from the caps below). */
  score: number;
  /** One line per rule, then any cap and the qualified verdict, for the admin to read. */
  reasons: string[];
};

export type LeadScoreOptions = {
  /** Replaces the default served-area list (the Pune localities, sub-localities and `near-…` landmarks). */
  servedLocalityIds?: readonly string[];
};

/**
 * Scores a lead for the admin inbox and for resale pricing (`lead_prices` is keyed by service x grade).
 *
 * Only quote requests are graded. Any other lead type, and a quote lead with no quote details, is grade C and
 * unqualified. A phone that is not a valid Indian mobile, or a locality outside the served area, caps the grade at
 * C however the rest scores, because such a lead cannot be sold (refund reasons `wrong_number`, `out_of_area`).
 */
export function leadScore(lead: LeadScoreInput, options: LeadScoreOptions = {}): LeadScore {
  if (lead.lead_type !== 'quote') {
    return {
      grade: 'C',
      qualified: false,
      score: 0,
      reasons: ['Not a quote request: only quote leads are graded'],
    };
  }
  const { quote } = lead;
  if (quote === null) {
    return {
      grade: 'C',
      qualified: false,
      score: 0,
      reasons: ['Quote details are missing: nothing to grade'],
    };
  }

  const reasons: string[] = [];
  let score = 0;
  const add = (rule: string, detail: string, points: number) => {
    score += points;
    reasons.push(`${rule}: ${detail} (+${points})`);
  };

  add('Timeline', quote.timeline, TIMELINE_POINTS[quote.timeline]);
  add('Ownership', quote.ownership, OWNERSHIP_POINTS[quote.ownership]);
  add('Property', quote.property_type, PROPERTY_POINTS[quote.property_type]);

  const expected = quote.estimate?.expected ?? null;
  const estimatePoints =
    expected === null ? 0 : (ESTIMATE_POINTS.find(([minInr]) => expected >= minInr)?.[1] ?? 0);
  add('Estimate', expected === null ? 'none' : `INR ${expected}`, estimatePoints);

  const served = options.servedLocalityIds
    ? options.servedLocalityIds.includes(quote.locality_id)
    : DEFAULT_SERVED_LOCALITIES.has(quote.locality_id) || quote.locality_id.startsWith(LANDMARK_PREFIX);
  add(
    'Served area',
    served ? quote.locality_id : `${quote.locality_id} is outside the served area`,
    served ? SERVED_AREA_POINTS : 0,
  );

  const validPhone = PhoneE164Schema.safeParse(lead.phone_e164).success;
  add(
    'Phone',
    validPhone ? 'valid Indian mobile' : 'not a valid Indian mobile',
    validPhone ? VALID_PHONE_POINTS : 0,
  );

  const hasNotes = (quote.notes?.trim().length ?? 0) >= NOTES_MIN_CHARS;
  add('Notes', hasNotes ? 'provided' : 'none', hasNotes ? NOTES_POINTS : 0);

  const confirmed = lead.whatsapp_confirmed === true;
  add(
    'Contact',
    confirmed ? 'WhatsApp confirmed' : 'WhatsApp not confirmed',
    confirmed ? WHATSAPP_CONFIRMED_POINTS : 0,
  );

  let grade: LeadGrade = score >= GRADE_A_MIN ? 'A' : score >= GRADE_B_MIN ? 'B' : 'C';
  if (grade !== 'C' && !served) {
    grade = 'C';
    reasons.push('Grade capped at C: outside the served area');
  }
  if (grade !== 'C' && !validPhone) {
    grade = 'C';
    reasons.push('Grade capped at C: phone is not a valid Indian mobile');
  }

  const withinThreeMonths = WITHIN_THREE_MONTHS.has(quote.timeline);
  const qualified = grade !== 'C' && confirmed && withinThreeMonths;
  if (qualified) {
    reasons.push(`Qualified: grade ${grade}, contact confirmed, timeline within 3 months`);
  } else {
    if (grade === 'C') reasons.push('Not qualified: grade C');
    if (!confirmed) reasons.push('Not qualified: contact is not confirmed');
    if (!withinThreeMonths) reasons.push('Not qualified: timeline is beyond 3 months');
  }

  return { grade, qualified, score, reasons };
}
