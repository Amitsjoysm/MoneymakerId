// Pulls a rupee amount out of a query: "under 200", "₹200", "200 rs", "200 ke andar", "under 2 lakh". Pure.

const MAX_BUDGET_INR = 100_000_000;

// An integer (Indian digit grouping allowed) with an optional fraction, and no further digit after it.
const NUM = String.raw`(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d+))?(?!\d)`;
// "k", "thousand", "hazar", "lakh", "lac" after the number.
const MULT = String.raw`(?:\s*(k|thousand|hazar|hazaar|hajar|lakhs?|lacs?)(?![a-z]))?`;
const CUR = String.raw`(?:rs\.?|inr|₹|rupees?|rupaye|rupaiye|rupay)`;
// A number followed by a unit of area is an area ("1200 sqft"), and one followed by "per sq ft" is a rate.
const NOT_AREA = String.raw`(?!\s*(?:${CUR})?\s*(?:/|per\b)?\s*(?:sq|sft|sqft|square|rft|running|ft\b|feet|foot|bhk))`;

const UPPER_BOUND_WORDS = String.raw`(?:under|below|less\s+than|lesser\s+than|upto|up\s+to|within|maximum|max|budget(?:\s+of)?|around|about|at\s+most|not\s+more\s+than|<=|<|≤)`;

const PATTERNS: RegExp[] = [
  // "under 200", "budget of ₹200 rupees"
  new RegExp(
    `${UPPER_BOUND_WORDS}\\s*(?:${CUR}\\s*)?${NUM}${MULT}${NOT_AREA}(?:\\s*${CUR}(?![a-z]))?`,
    'giu',
  ),
  // "₹200", "rs.200", "inr 200"
  new RegExp(`(?<![a-z])${CUR}\\s*${NUM}${MULT}${NOT_AREA}`, 'giu'),
  // "200 rs", "200/-", "200 ke andar", "250 tak", "100 paryant", "200 se kam"
  new RegExp(
    `(?<![\\d.,])${NUM}${MULT}${NOT_AREA}\\s*(?:${CUR}(?![a-z])|/-|k[ei]\\s+(?:andar|ander|under|neeche|niche)|andar|ander|tak(?![a-z])|paryanta?|chya\\s+(?:aat|khali)|cha\\s+aat|se\\s+(?:kam|neeche|niche)|kami)`,
    'giu',
  ),
];

function amount(m: RegExpExecArray): number | null {
  // Groups 1..3 of every pattern are: integer part, fraction, multiplier.
  const whole = m[1]!.replaceAll(',', '');
  const value = Number(m[2] ? `${whole}.${m[2]}` : whole);
  const unit = m[3]?.toLowerCase();
  const factor = !unit ? 1 : /^(k|thousand|hazar|hazaar|hajar)$/.test(unit) ? 1000 : 100_000;
  const inr = Math.round(value * factor);
  return inr >= 1 && inr <= MAX_BUDGET_INR ? inr : null;
}

/**
 * The first rupee amount in `folded` (text already through `foldText`: lowercase, Devanagari digits turned into
 * ASCII) and the text with every amount phrase blanked, so the numbers cannot be read as place names later. An amount
 * of 0, one above 100 million, or one that is an area or a per-sq-ft rate is not a budget and stays in the text.
 */
export function extractBudget(folded: string): { budget_inr: number | null; rest: string } {
  const found: { start: number; end: number; value: number }[] = [];
  for (const pattern of PATTERNS) {
    for (const m of folded.matchAll(pattern)) {
      const value = amount(m);
      if (value !== null) found.push({ start: m.index, end: m.index + m[0].length, value });
    }
  }
  if (found.length === 0) return { budget_inr: null, rest: folded };
  found.sort((a, b) => a.start - b.start);
  let rest = '';
  let at = 0;
  for (const f of found) {
    if (f.end <= at) continue;
    rest += `${folded.slice(at, Math.max(at, f.start))} `;
    at = f.end;
  }
  rest += folded.slice(at);
  return { budget_inr: found[0]!.value, rest };
}
