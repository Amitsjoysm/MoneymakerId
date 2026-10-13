// Word lists for `parseIntent`: Hinglish and Marathi (Latin script, a little Devanagari) as people type them.
// These are query words, not place or dish names: names come from the reference data passed in.
import type { Craving, Diet } from '../schema/index.ts';

export interface LexiconEntry<T> {
  /** Lowercase normalised words separated by single spaces. */
  phrase: string;
  value: T;
}

const entries = <T>(value: T, phrases: string[]): LexiconEntry<T>[] =>
  phrases.map((phrase) => ({ phrase, value }));

export const DIET_LEXICON: LexiconEntry<Diet>[] = [
  ...entries<Diet>('non_veg', ['non veg', 'nonveg', 'non vegetarian', 'mansahari', 'masahari', 'मांसाहारी']),
  ...entries<Diet>('veg', [
    'veg',
    'pure veg',
    'vegetarian',
    'vegeterian',
    'jain',
    'shakahari',
    'shudh shakahari',
    'शाकाहारी',
    'शुद्ध शाकाहारी',
  ]),
  ...entries<Diet>('egg', ['egg', 'eggs', 'anda', 'ande']),
];

export const CRAVING_LEXICON: LexiconEntry<Craving>[] = [
  ...entries<Craving>('spicy', [
    'spicy',
    'spice',
    'teekha',
    'tikha',
    'tikhat',
    'jhanjhanit',
    'zhanzhanit',
    'chatpata',
    'masaledar',
  ]),
  ...entries<Craving>('sweet', ['sweet', 'sweets', 'meetha', 'mitha', 'mithai']),
  ...entries<Craving>('savoury', ['savoury', 'savory', 'salty', 'namkeen']),
  ...entries<Craving>('light', ['light', 'halka', 'halke']),
  ...entries<Craving>('filling', ['filling', 'heavy', 'hearty', 'bharpur', 'pet bhar']),
  ...entries<Craving>('street', ['street food', 'street', 'thela']),
  ...entries<Craving>('breakfast', ['breakfast', 'brunch', 'nashta', 'nasta', 'naashta']),
  ...entries<Craving>('late_night', ['late night', 'latenight', 'midnight', 'mid night', 'raat ko']),
  ...entries<Craving>('healthy', ['healthy', 'low calorie', 'low cal', 'diet food']),
];

/**
 * "Open now" phrases. "late night" is deliberately not here: it names a kind of place (open late), not a request for
 * what is open at this minute (see the C01 report).
 */
export const OPEN_NOW_LEXICON: LexiconEntry<true>[] = entries(true as const, [
  'open now',
  'open right now',
  'currently open',
  'right now',
  'abhi',
  'abhi khula',
  'abhi khula hai',
  'khula hai',
  'अभी',
]);

/** Words that mark a food query. */
export const FOOD_WORDS: ReadonlySet<string> = new Set([
  'food',
  'restaurant',
  'restaurants',
  'restro',
  'cafe',
  'cafes',
  'hotel',
  'hotels',
  'eat',
  'eating',
  'khana',
  'khane',
  'khaana',
  'jevan',
  'jevayla',
  'lunch',
  'dinner',
  'snack',
  'snacks',
  'hungry',
  'bhook',
  'bhuk',
  'tiffin',
  'meal',
  'meals',
  'dine',
  'dining',
  'takeaway',
]);

/** Phrases (single words or several) that mark a construction query. */
export const CONSTRUCTION_LEXICON: LexiconEntry<true>[] = entries(true as const, [
  'per sq ft',
  'sq ft',
  'sqft',
  'sft',
  'rft',
  'square feet',
  'square foot',
  'bhk',
  'cost',
  'costs',
  'rate',
  'rates',
  'estimate',
  'estimates',
  'quote',
  'quotes',
  'quotation',
  'contractor',
  'contractors',
  'thekedar',
  'mistri',
  'labour',
  'labor',
  'builder',
  'builders',
  'renovation',
  'repair',
  'repairs',
  'construction',
  'kharcha',
  'kharch',
]);

/**
 * Function words and particles that carry no entity. They are dropped before dish and service names are matched.
 * Locality matching keeps any of them that a locality name or alias uses (see `parseIntent`), so a name such as
 * "Sector A" still matches. "i" is not listed: it is also the Roman numeral in "Hinjewadi Phase I".
 */
export const NEUTRAL_WORDS: ReadonlySet<string> = new Set([
  // English
  'a',
  'an',
  'the',
  'of',
  'for',
  'to',
  'and',
  'or',
  'with',
  'in',
  'on',
  'at',
  'near',
  'nearby',
  'around',
  'me',
  'my',
  'we',
  'is',
  'are',
  'there',
  'any',
  'some',
  'find',
  'show',
  'get',
  'want',
  'need',
  'looking',
  'suggest',
  'recommend',
  'please',
  'pls',
  'where',
  'can',
  'how',
  'much',
  'what',
  'which',
  'place',
  'places',
  'shop',
  'shops',
  'area',
  'pune',
  'per',
  'person',
  'head',
  'plate',
  'cheap',
  'cheapest',
  'famous',
  'popular',
  // Hinglish
  'ke',
  'ka',
  'ki',
  'ko',
  'se',
  'mein',
  'mai',
  'paas',
  'pass',
  'accha',
  'achha',
  'acha',
  'achi',
  'achhi',
  'sasta',
  'saste',
  'sastha',
  'chahiye',
  'chahie',
  'chaiye',
  'batao',
  'bataiye',
  'dikhao',
  'dikhaiye',
  'hai',
  'hain',
  'ho',
  'milega',
  'milegi',
  'milta',
  'milte',
  'kahan',
  'kaha',
  'kidhar',
  'bhav',
  'bhaav',
  'daam',
  'kitna',
  'kitne',
  'kitni',
  'mujhe',
  'mere',
  'aur',
  'ya',
  'wala',
  'wali',
  'wale',
  'liye',
  // Marathi
  'madhe',
  'jawal',
  'javal',
  'kuthe',
  'kithe',
  'kiti',
  'cha',
  'chi',
  'che',
  'chya',
  'la',
  'mala',
  'pahije',
  'pahiye',
  'aahe',
  'ahe',
  'milel',
  'milto',
  'sanga',
  'dakhva',
  'changla',
  'changli',
  'chaan',
  'swasta',
  'ani',
  'kinva',
  'aani',
]);

/**
 * Words too general to stand for a service on their own ("repair" is not leakage repair). They are not used as part
 * forms of a service name and do not count as a construction hint.
 */
export const GENERIC_SERVICE_WORDS: ReadonlySet<string> = new Set([
  'house',
  'home',
  'repair',
  'repairs',
  'renovation',
  'external',
  'internal',
  'service',
  'services',
  'work',
  'works',
]);

export interface LexiconHit<T> {
  value: T;
  /** Word span `[start, end)`. */
  start: number;
  end: number;
}

interface Compiled<T> {
  words: string[];
  value: T;
}

const compiled = new WeakMap<readonly unknown[], Map<string, Compiled<unknown>[]>>();

function compile<T>(lexicon: readonly LexiconEntry<T>[]): Map<string, Compiled<T>[]> {
  const cached = compiled.get(lexicon);
  if (cached) return cached as Map<string, Compiled<T>[]>;
  const byFirst = new Map<string, Compiled<T>[]>();
  for (const e of lexicon) {
    const words = e.phrase.split(' ');
    const list = byFirst.get(words[0]!);
    if (list) list.push({ words, value: e.value });
    else byFirst.set(words[0]!, [{ words, value: e.value }]);
  }
  for (const list of byFirst.values()) list.sort((a, b) => b.words.length - a.words.length);
  compiled.set(lexicon, byFirst);
  return byFirst;
}

/**
 * Whole-word phrase matches, left to right, longest phrase first at each position, never reusing a word. Words with
 * `claimed[i]` set are skipped and make a phrase fail. The lexicon arrays are module constants, so the compiled form
 * is cached by array identity.
 */
export function scanLexicon<T>(
  tokens: readonly string[],
  claimed: readonly boolean[],
  lexicon: readonly LexiconEntry<T>[],
): LexiconHit<T>[] {
  const byFirst = compile(lexicon);
  const hits: LexiconHit<T>[] = [];
  let i = 0;
  while (i < tokens.length) {
    let hit: LexiconHit<T> | null = null;
    if (!claimed[i]) {
      for (const c of byFirst.get(tokens[i]!) ?? []) {
        const end = i + c.words.length;
        if (end <= tokens.length && c.words.every((w, k) => tokens[i + k] === w && !claimed[i + k])) {
          hit = { value: c.value, start: i, end };
          break;
        }
      }
    }
    if (hit) {
      hits.push(hit);
      i = hit.end;
    } else {
      i++;
    }
  }
  return hits;
}
