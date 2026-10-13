// Free text -> `ParsedIntent` (CONTRACTS §6a). No AI, no network: word lists, the shared phrase matcher and the
// reference data that is passed in. Pure, so it runs the same on the build, a Worker and in tests.
import { buildPhraseIndex, findPhraseMatches, pickBest } from '../locality/match.ts';
import type { BestMatch, PhraseEntry, PhraseIndex } from '../locality/match.ts';
import { buildLocalityIndex, resolveLocalityTokens } from '../locality/resolve.ts';
import { foldText, tokenise } from '../locality/text.ts';
import type { Diet, Dish, Locality, ParsedIntent, ServiceDef } from '../schema/index.ts';
import { extractBudget } from './budget.ts';
import {
  CONSTRUCTION_LEXICON,
  CRAVING_LEXICON,
  DIET_LEXICON,
  FOOD_WORDS,
  GENERIC_SERVICE_WORDS,
  NEUTRAL_WORDS,
  OPEN_NOW_LEXICON,
  scanLexicon,
} from './lexicon.ts';
import type { LexiconHit } from './lexicon.ts';

/** Only this many characters of a query are read. */
const MAX_QUERY_CHARS = 400;
/** A word must be this long to stand for a service on its own. */
const MIN_PART_LENGTH = 5;

/**
 * The reference data `parseIntent` reads. The indexes built from it are kept per array (and `serviceAliases` object),
 * so treat all of it as read-only; pass a new array or object when the data changes.
 */
export interface IntentRefs {
  localities: readonly Locality[];
  dishes: readonly Dish[];
  /** The top-level services, sub-services nested (the shape of `data/services/*.json`). */
  services: readonly ServiceDef[];
  /**
   * Extra names for services, by service id, because a `ServiceDef` has no alias field. Without it only the service
   * names (and the words only one service uses) match, so "roof waterproofing" or "ghar bandhkam" need an entry here.
   * The caller (the /api/ask card) supplies it.
   */
  serviceAliases?: Readonly<Record<string, readonly string[]>> | undefined;
}

const lengthOf = (s: string) => Array.from(s).length;
const spaced = (id: string) => id.replaceAll('-', ' ');
const round2 = (x: number) => Math.round(x * 100) / 100;

function flattenServices(services: readonly ServiceDef[], depth = 0): ServiceDef[] {
  if (depth > 5) return [];
  return services.flatMap((s) => [s, ...flattenServices(s.sub_services, depth + 1)]);
}

function dishEntries(dishes: readonly Dish[]): PhraseEntry[] {
  return dishes.map((d) => {
    const forms = [d.name, spaced(d.id), ...d.aliases];
    if (d.i18n.mr) forms.push(d.i18n.mr.name);
    if (d.i18n.hi) forms.push(d.i18n.hi.name);
    return { id: d.id, forms };
  });
}

/**
 * Service entries. A word of a service name that no other service uses may stand for it alone ("terrace" for terrace
 * waterproofing). A word several services share ("bathroom", "waterproofing") does not pick one, but is a hint that
 * the query is about construction. Generic words ("house", "repair") are neither.
 */
function serviceEntries(
  services: readonly ServiceDef[],
  aliases: IntentRefs['serviceAliases'],
): { entries: PhraseEntry[]; hints: Set<string> } {
  const flat = flattenServices(services);
  const wordsOf = (s: ServiceDef) =>
    new Set(
      tokenise(`${s.name} ${spaced(s.id)}`).filter(
        (w) => lengthOf(w) >= MIN_PART_LENGTH && !GENERIC_SERVICE_WORDS.has(w) && !NEUTRAL_WORDS.has(w),
      ),
    );
  const owners = new Map<string, number>();
  const words = new Map<string, Set<string>>();
  for (const s of flat) {
    const w = wordsOf(s);
    words.set(s.id, w);
    for (const word of w) owners.set(word, (owners.get(word) ?? 0) + 1);
  }
  const hints = new Set<string>();
  for (const [word, n] of owners) if (n > 1) hints.add(word);
  const entries = flat.map((s) => ({
    id: s.id,
    forms: [s.name, spaced(s.id), ...(aliases?.[s.id] ?? [])],
    partForms: [...words.get(s.id)!].filter((w) => owners.get(w) === 1),
  }));
  return { entries, hints };
}

// The indexes are built once per reference array (see `buildLocalityIndex`); treat the arrays as read-only.
const dishIndexCache = new WeakMap<readonly Dish[], PhraseIndex>();
const NO_ALIASES = {};
const serviceCache = new WeakMap<
  readonly ServiceDef[],
  WeakMap<object, { index: PhraseIndex; hints: Set<string> }>
>();

function dishIndexOf(dishes: readonly Dish[]): PhraseIndex {
  let index = dishIndexCache.get(dishes);
  if (!index) {
    index = buildPhraseIndex(dishEntries(dishes), { skipWords: NEUTRAL_WORDS });
    dishIndexCache.set(dishes, index);
  }
  return index;
}

function serviceIndexOf(refs: IntentRefs): { index: PhraseIndex; hints: Set<string> } {
  let byAliases = serviceCache.get(refs.services);
  if (!byAliases) {
    byAliases = new WeakMap();
    serviceCache.set(refs.services, byAliases);
  }
  const key = refs.serviceAliases ?? NO_ALIASES;
  let built = byAliases.get(key);
  if (!built) {
    const { entries, hints } = serviceEntries(refs.services, refs.serviceAliases);
    built = { index: buildPhraseIndex(entries, { skipWords: NEUTRAL_WORDS, stems: true }), hints };
    byAliases.set(key, built);
  }
  return built;
}

function dietOf(hits: readonly LexiconHit<Diet>[]): Diet | null {
  const found = new Set(hits.map((h) => h.value));
  if (found.has('non_veg') && (found.has('veg') || found.has('egg'))) return 'both';
  if (found.has('egg')) return 'egg';
  if (found.has('veg')) return 'veg';
  if (found.has('non_veg')) return 'non_veg';
  return null;
}

/**
 * Turn a query ("biryani near wakad under 300 veg", "wakad ke paas accha biryani chahiye", "terrace waterproofing
 * cost in wakad") into a `ParsedIntent`.
 *
 * - `vertical`: what the query names decides. A dish or service counts most, then cravings and diet words, then
 *   words like "cost", "contractor", "restaurant". With nothing recognised it is `food` and the confidence is 0.
 * - `subject_id`: the dish (food) or service (construction), including a typo or alias, else null.
 * - `locality_id`: from `resolveLocality`'s rules, on the words that are left (so the two agree on every name and
 *   alias; a neutral word that a locality name uses, such as the "i" of "Phase I", is kept for this step). A word that
 *   only begins a longer name ("pimple") gives `null`.
 * - `budget_inr`: "under 200", "₹200", "200 rs", "200 ke andar", "2 lakh". A per-sq-ft rate is not a budget.
 * - `diet`: veg (also "jain", "pure veg"), non_veg, egg, or both when veg and non-veg are both named.
 * - `open_now`: "open now", "abhi". "late night" is a craving (`late_night`), not `open_now`.
 * - `intent_key`: `vertical|subject|locality|under-N|diet|open|craving`, a `-` for a gap and trailing gaps dropped,
 *   built only from the parsed fields, so the same meaning gives the same key whatever the wording.
 * - `confidence`: 0.5 x subject match + 0.3 x locality match + 0.1 for a vertical signal word + 0.1 for a budget or
 *   "open now". Each match counts at its own confidence (1 for exact down to 0.65 for a two-edit typo).
 *
 * Only the first 400 characters are read. `refs` is read-only (see `IntentRefs`).
 */
export function parseIntent(q: string, refs: IntentRefs): ParsedIntent {
  const { budget_inr, rest } = extractBudget(foldText(q).slice(0, MAX_QUERY_CHARS));
  const tokens = tokenise(rest);
  const claimed = new Array<boolean>(tokens.length).fill(false);
  const claim = (start: number, end: number) => {
    for (let i = start; i < end; i++) claimed[i] = true;
  };
  const scan = <T>(lexicon: Parameters<typeof scanLexicon<T>>[2]) => {
    const hits = scanLexicon(tokens, claimed, lexicon);
    for (const h of hits) claim(h.start, h.end);
    return hits;
  };

  // Query words with a fixed meaning. The order matters: "street food" must be read before "food".
  const openHits = scan(OPEN_NOW_LEXICON);
  const cravingHits = scan(CRAVING_LEXICON);
  const dietHits = scan(DIET_LEXICON);
  const constructionHits = scan(CONSTRUCTION_LEXICON);
  let foodWords = 0;
  tokens.forEach((t, i) => {
    if (!claimed[i] && FOOD_WORDS.has(t)) {
      claimed[i] = true;
      foodWords++;
    }
  });

  // Names. The words that carry no entity are dropped first; `at[k]` maps a kept word back to its place in `tokens`.
  const words: string[] = [];
  const at: number[] = [];
  tokens.forEach((t, i) => {
    if (!NEUTRAL_WORDS.has(t)) {
      words.push(t);
      at.push(i);
    }
  });
  const { index: serviceIndex, hints } = serviceIndexOf(refs);
  const dish = pickBest(findPhraseMatches(words, dishIndexOf(refs.dishes)), words);
  const service = pickBest(findPhraseMatches(words, serviceIndex), words);
  const hint = service === null && words.some((w) => hints.has(w));

  // A dish or service named outright weighs most. If both are named, the longer name wins.
  const foodScore =
    (dish ? 3 + dish.coverage / 1000 : 0) +
    (cravingHits.length > 0 ? 2 : 0) +
    (dietHits.length > 0 ? 1 : 0) +
    Math.min(foodWords, 2);
  const constructionScore =
    (service ? 3 + service.coverage / 1000 : 0) + Math.min(constructionHits.length, 2) + (hint ? 1 : 0);
  const vertical: ParsedIntent['vertical'] = constructionScore > foodScore ? 'construction' : 'food';
  const subject: BestMatch | null = vertical === 'construction' ? service : dish;
  if (subject) claim(at[subject.start]!, at[subject.end - 1]! + 1);

  // Locality names are matched on the words that are left. A neutral word stays when some locality name or alias
  // uses it ("Sector A", "Popular Colony"); otherwise such a name could never match, though `resolveLocality` finds it.
  const localityIndex = buildLocalityIndex(refs.localities);
  const localityWords = tokens.filter(
    (t, i) => !claimed[i] && (!NEUTRAL_WORDS.has(t) || localityIndex.words.has(t)),
  );
  const locality = resolveLocalityTokens(localityWords, localityIndex);

  const craving =
    cravingHits.length > 0 ? cravingHits.reduce((a, b) => (b.start < a.start ? b : a)).value : null;
  const diet = dietOf(dietHits);
  const open_now = openHits.length > 0;
  const budget = budget_inr;

  const hasSignal =
    constructionHits.length > 0 || foodWords > 0 || cravingHits.length > 0 || dietHits.length > 0 || hint;
  const confidence = round2(
    0.5 * (subject?.confidence ?? 0) +
      0.3 * (locality?.confidence ?? 0) +
      (hasSignal ? 0.1 : 0) +
      (budget !== null || open_now ? 0.1 : 0),
  );

  const key = [
    vertical,
    subject?.id ?? '-',
    locality?.id ?? '-',
    budget !== null ? `under-${budget}` : '-',
    diet ?? '-',
    open_now ? 'open' : '-',
    craving ?? '-',
  ];
  while (key.length > 1 && key[key.length - 1] === '-') key.pop();

  return {
    vertical,
    subject_id: subject?.id ?? null,
    craving,
    locality_id: locality?.id ?? null,
    budget_inr: budget,
    diet,
    open_now,
    intent_key: key.join('|'),
    confidence: Math.min(1, Math.max(0, confidence)),
  };
}
