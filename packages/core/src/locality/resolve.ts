// Free text -> locality id. Exact id/name/alias first, then spacing, then Damerau-Levenshtein within the limits of
// `maxEdits`. Reads no files and knows no locality names: aliases come in with the `Locality[]`. Pure.
import { PRIORITY_LOCALITY_IDS } from '../constants/index.ts';
import type { Locality } from '../schema/index.ts';
import { buildPhraseIndex, findPhraseMatches, pickBest } from './match.ts';
import type { BestMatch, PhraseEntry, PhraseIndex } from './match.ts';
import { tokenise } from './text.ts';

/** Words that point at a place without naming one ("near", "in", "Pune", Hinglish "ke paas", Marathi "jawal"). */
export const LOCALITY_FILLER: ReadonlySet<string> = new Set([
  'pune',
  'near',
  'nearby',
  'in',
  'at',
  'around',
  'area',
  'me',
  'mein',
  'mai',
  'ke',
  'paas',
  'madhe',
  'jawal',
  'javal',
  // Devanagari: Pune, in (Hindi, Marathi), near
  'पुणे',
  'पुना',
  'में',
  'मे',
  'मध्ये',
  'के',
  'पास',
  'जवळ',
]);

export interface LocalityMatch {
  locality_id: string;
  /** 0..1. 1 for an exact id, name or alias; 0.95 when only the spacing differed; 0.8 and 0.65 for one and two edits. */
  confidence: number;
  /** The words of the text that matched, normalised. */
  matched: string;
}

const priorityRank = (id: string) => {
  const i = PRIORITY_LOCALITY_IDS.indexOf(id as (typeof PRIORITY_LOCALITY_IDS)[number]);
  return i === -1 ? 1000 : i;
};

function entryOf(l: Locality): PhraseEntry {
  const forms = [l.name, l.id.replaceAll('-', ' '), ...l.aliases];
  if (l.i18n.mr) forms.push(l.i18n.mr.name);
  if (l.i18n.hi) forms.push(l.i18n.hi.name);
  return { id: l.id, forms, rank: priorityRank(l.id) };
}

// Building the index normalises every name and alias, which is most of the cost of a lookup. A Worker keeps its
// reference arrays for its lifetime, so the index is kept per array. Treat the arrays as read-only.
const indexCache = new WeakMap<readonly Locality[], PhraseIndex>();

export function buildLocalityIndex(localities: readonly Locality[]): PhraseIndex {
  let index = indexCache.get(localities);
  if (!index) {
    index = buildPhraseIndex(localities.map(entryOf), { skipWords: LOCALITY_FILLER });
    indexCache.set(localities, index);
  }
  return index;
}

/** Resolve already-tokenised words (filler words are dropped here). */
export function resolveLocalityTokens(tokens: readonly string[], index: PhraseIndex): BestMatch | null {
  const words = tokens.filter((w) => !LOCALITY_FILLER.has(w));
  return pickBest(findPhraseMatches(words, index), words);
}

/**
 * The locality `text` mentions, or `null`. `text` may be a bare name ("Wakad") or a whole sentence ("best biryani near
 * wakad pune"). When it names several places the strongest wins; a more specific one beats the place that contains it
 * ("hinjewadi phase 1" over "hinjewadi"). For separate mentions the longer name wins ("kothrud near baner" is
 * `kothrud`, in either order) and the confidence is lowered by 0.15 to show it was not clear; only names of equal
 * length go to the higher-priority locality, then the shorter id.
 *
 * A word that only begins a longer name ("pimple" for "Pimple Saudagar" and "Pimple Nilakh") is not guessed at: the
 * result is `null`, not a near neighbour such as "Pimpri". A typo of a whole name still matches.
 *
 * Only the first 64 words are read. `localities` is indexed once per array and the index is kept (see
 * `buildLocalityIndex`), so treat the array and its entries as read-only; pass a new array when the data changes.
 */
export function resolveLocality(text: string, localities: readonly Locality[]): LocalityMatch | null {
  const tokens = tokenise(text);
  if (tokens.length === 0 || localities.length === 0) return null;
  const best = resolveLocalityTokens(tokens, buildLocalityIndex(localities));
  return best && { locality_id: best.id, confidence: best.confidence, matched: best.matched };
}
