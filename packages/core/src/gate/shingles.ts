// Content uniqueness (PLAN §5): `unique = 1 - (the highest 5-word-shingle Jaccard similarity of a page's main text
// against any sibling of the same template)`. The caller removes template sentences before it builds `main_text`.

export const SHINGLE_WORDS = 5;

const NOT_WORD = /[^\p{L}\p{M}\p{N}]+/u;

/** NFKC-normalised, lowercased words. Combining marks stay inside the word, so Devanagari words are not cut. */
export function words(text: string): string[] {
  return text.normalize('NFKC').toLowerCase().split(NOT_WORD).filter(Boolean);
}

/**
 * The set of word 5-shingles. A text of fewer than five words is one shingle (all its words), so a very short
 * page can still be compared; empty text has none.
 */
export function shingleSet(text: string): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  if (w.length === 0) return out;
  if (w.length < SHINGLE_WORDS) return out.add(w.join(' '));
  for (let i = 0; i + SHINGLE_WORDS <= w.length; i++) out.add(w.slice(i, i + SHINGLE_WORDS).join(' '));
  return out;
}

/** |A ∩ B| / |A ∪ B|. Two empty sets are identical (1); one empty set shares nothing (0). */
export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const s of small) if (large.has(s)) shared++;
  return shared / (a.size + b.size - shared);
}

interface HasText {
  main_text: string;
}

// A manifest build compares every page with all its siblings; each page's shingles are built once. An entry is valid
// only for the exact text it was built from, so a page whose `main_text` is changed after it was scored is re-read.
const cache = new WeakMap<HasText, { text: string; set: Set<string> }>();

/** The (cached) shingle set of a page's main text. */
export function shinglesOf(page: HasText): Set<string> {
  const cached = cache.get(page);
  if (cached !== undefined && cached.text === page.main_text) return cached.set;
  const set = shingleSet(page.main_text);
  cache.set(page, { text: page.main_text, set });
  return set;
}

/** `1 - max jaccard(page, sibling)`; 1 when there are no siblings. `others` must not contain `page` itself. */
export function uniquenessScore(page: HasText, others: readonly HasText[]): number {
  const own = shinglesOf(page);
  let highest = 0;
  for (const other of others) {
    const theirs = shinglesOf(other);
    // Jaccard can be at most smaller/larger, so a set that cannot beat the highest so far need not be intersected.
    const larger = Math.max(own.size, theirs.size);
    if (larger > 0 && Math.min(own.size, theirs.size) / larger <= highest) continue;
    highest = Math.max(highest, jaccard(own, theirs));
    if (highest === 1) break;
  }
  return 1 - highest;
}
