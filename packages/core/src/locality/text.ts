// Text helpers for matching (CONTRACTS §1 "Text": NFKC-normalised before matching). Pure; Node and Workers.

/**
 * NFKC, lowercase, zero-width characters removed, Latin diacritics dropped (so "Hinjewadī" reads as "hinjewadi"),
 * Devanagari digits turned into ASCII digits. Punctuation is kept: the budget parser needs "₹" and "/-".
 */
export function foldText(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/(\p{Script=Latin})\p{M}+/gu, '$1') // marks on Latin letters only; Devanagari vowel signs stay
    .normalize('NFC')
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/[\u0966-\u096f]/g, (d) => String(d.charCodeAt(0) - 0x0966));
}

/** `foldText`, then every run of characters that are not letters, marks or digits becomes one space; trimmed. */
export function normaliseText(s: string): string {
  return foldText(s)
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim();
}

/** The normalised words of `s`. */
export function tokenise(s: string): string[] {
  const n = normaliseText(s);
  return n === '' ? [] : n.split(' ');
}

// Scratch space for `damerauLevenshtein`, so the many small comparisons of one lookup allocate nothing. Strings up to
// SCRATCH_LEN code points use it; longer ones get their own arrays.
const SCRATCH_LEN = 48;
const SCRATCH_W = SCRATCH_LEN + 2;
const scratch = new Int32Array(SCRATCH_W * SCRATCH_W);
const scratchRows = new Int32Array(128); // last row in which each ASCII code point was seen

/**
 * Damerau-Levenshtein distance (insert, delete, substitute, and swap two neighbours, each 1), the unrestricted
 * Lowrance-Wagner form. Works on code points. With `max`, an answer above it is reported as `max + 1`.
 */
export function damerauLevenshtein(a: string, b: string, max = Number.POSITIVE_INFINITY): number {
  if (a === b) return 0;
  const x = Array.from(a);
  const y = Array.from(b);
  if (Math.abs(x.length - y.length) > max) return max + 1;
  // Common start and end never change the distance, so only the middle is compared.
  let from = 0;
  while (from < x.length && from < y.length && x[from] === y[from]) from++;
  let xe = x.length;
  let ye = y.length;
  while (xe > from && ye > from && x[xe - 1] === y[ye - 1]) {
    xe--;
    ye--;
  }
  const xs = x.slice(from, xe);
  const ys = y.slice(from, ye);
  const d = middleDistance(xs, ys);
  return d > max ? max + 1 : d;
}

function middleDistance(x: string[], y: string[]): number {
  if (x.length === 0) return y.length;
  if (y.length === 0) return x.length;
  const w = y.length + 2;
  const small = x.length <= SCRATCH_LEN && y.length <= SCRATCH_LEN;
  const h = small ? scratch : new Int32Array((x.length + 2) * w);
  const stride = small ? SCRATCH_W : w;
  const inf = x.length + y.length;
  h[0] = inf;
  for (let i = 0; i <= x.length; i++) {
    h[(i + 1) * stride] = inf;
    h[(i + 1) * stride + 1] = i;
  }
  for (let j = 0; j <= y.length; j++) {
    h[j + 1] = inf;
    h[stride + j + 1] = j;
  }
  const ascii = scratchRows;
  ascii.fill(0);
  const other = new Map<string, number>(); // rows for code points outside ASCII
  const rowOf = (c: string) =>
    c.charCodeAt(0) < 128 && c.length === 1 ? ascii[c.charCodeAt(0)]! : (other.get(c) ?? 0);
  const setRow = (c: string, i: number) => {
    if (c.charCodeAt(0) < 128 && c.length === 1) ascii[c.charCodeAt(0)] = i;
    else other.set(c, i);
  };
  for (let i = 1; i <= x.length; i++) {
    let lastMatchCol = 0;
    for (let j = 1; j <= y.length; j++) {
      const i1 = rowOf(y[j - 1]!);
      const j1 = lastMatchCol;
      let cost = 1;
      if (x[i - 1] === y[j - 1]) {
        cost = 0;
        lastMatchCol = j;
      }
      h[(i + 1) * stride + j + 1] = Math.min(
        h[i * stride + j]! + cost, // substitute
        h[(i + 1) * stride + j]! + 1, // insert
        h[i * stride + j + 1]! + 1, // delete
        h[i1 * stride + j1]! + (i - i1 - 1) + 1 + (j - j1 - 1), // swap
      );
    }
    setRow(x[i - 1]!, i);
  }
  return h[(x.length + 1) * stride + y.length + 1]!;
}

/** Shorter words are matched exactly only (see `maxEdits`). Callers use it to skip words that cannot fuzzy-match. */
export const MIN_FUZZY_LENGTH = 5;

/**
 * How many edits a fuzzy match may use, by the length of the shorter side (spaces ignored). Short forms must match
 * exactly: with one edit allowed, "damp" (a waterproofing word) would read as the locality "camp", and "came" would
 * too. Five characters allow one edit ("wakad" for "wakda"); longer ones allow two.
 */
export function maxEdits(len: number): 0 | 1 | 2 {
  if (len < MIN_FUZZY_LENGTH) return 0;
  return len === MIN_FUZZY_LENGTH ? 1 : 2;
}
