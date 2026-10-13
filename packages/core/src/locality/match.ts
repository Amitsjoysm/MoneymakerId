// A small phrase matcher shared by the locality resolver and the intent parser: it finds which entries (localities,
// dishes, services) a list of words mentions, allowing for spacing and spelling mistakes. Pure; no state.
import { damerauLevenshtein, MIN_FUZZY_LENGTH, maxEdits, tokenise } from './text.ts';

/** Only this many words of a text are searched, so a pasted page cannot burn the CPU budget of a Worker. */
export const MAX_TOKENS = 64;
/** Longest phrase (in words) a form may have. Longer forms are cut off from matching. */
const MAX_FORM_TOKENS = 6;
/** A stem (a word that is the start of a longer word) must be this long, and at most this many letters short. */
const MIN_STEM_LENGTH = 5;
const MAX_STEM_GAP = 4;

export type MatchKind = 'exact' | 'compact' | 'fuzzy' | 'stem';

export interface PhraseEntry {
  id: string;
  /** Full forms: name, id with spaces, aliases, translated names. Raw text; it is normalised here. */
  forms: readonly string[];
  /** Weaker forms: single words that may stand for the entry alone ("terrace" for "terrace waterproofing"). */
  partForms?: readonly string[];
  /** Lower wins a tie. Default 0. */
  rank?: number;
}

export interface IndexOptions {
  /** Words dropped from every form before indexing (the same words are dropped from the text by the caller). */
  skipWords?: ReadonlySet<string>;
  /** Let a word of five or more letters match the start of a longer one-word form ("paint" for "painting"). */
  stems?: boolean;
}

interface Form {
  id: string;
  text: string;
  compact: string;
  part: boolean;
  rank: number;
  length: number;
  /** Which letters the form has, as bits (see `letterMask`). */
  mask: number;
}

export interface PhraseIndex {
  byText: Map<string, Form[]>;
  byCompact: Map<string, Form[]>;
  byLength: Map<number, Form[]>;
  singles: Form[];
  /** Every word of every indexed form (after `skipWords`), so a caller can tell which words a name may use. */
  words: Set<string>;
  /** The first word of each full form of two or more words ("pimple" in "pimple saudagar"): an unfinished name. */
  heads: Set<string>;
  maxTokens: number;
  stems: boolean;
}

export interface PhraseMatch {
  id: string;
  /** Word span in the token list given to `findPhraseMatches`: `[start, end)`. */
  start: number;
  end: number;
  kind: MatchKind;
  edits: number;
  /** True when a part form matched. */
  part: boolean;
  /** Letters covered (spaces ignored). */
  coverage: number;
  /** 0..1: how sure this match is. */
  quality: number;
  /** An exact or spacing-only match of a full form. Strong matches always outrank weak ones. */
  strong: boolean;
  rank: number;
}

export interface BestMatch extends PhraseMatch {
  /** `quality`, less 0.15 when another entry matched just as well. */
  confidence: number;
  /** The matched words, normalised. */
  matched: string;
}

const BASE_QUALITY = { exact: 1, compact: 0.95, stem: 0.7 } as const;
const FUZZY_QUALITY = [1, 0.8, 0.65] as const;
const PART_FACTOR = 0.85;
const AMBIGUITY_PENALTY = 0.15;

const lengthOf = (s: string) => Array.from(s).length;

/**
 * One bit per letter (letters share bits once past 32 distinct code points). If `a` can become `b` in `k` edits, then
 * at most `k` bits are set in `a`'s mask and not in `b`'s, and the same the other way round: each edit removes at
 * most one letter from the set. So a larger difference rules a pair out without the costly distance.
 */
function letterMask(s: string): number {
  let mask = 0;
  for (const ch of s) mask |= 1 << (ch.codePointAt(0)! % 32);
  return mask;
}

function bitCount(n: number): number {
  let v = n - ((n >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export function buildPhraseIndex(entries: readonly PhraseEntry[], options: IndexOptions = {}): PhraseIndex {
  const skip = options.skipWords;
  const index: PhraseIndex = {
    byText: new Map(),
    byCompact: new Map(),
    byLength: new Map(),
    singles: [],
    words: new Set(),
    heads: new Set(),
    maxTokens: 1,
    stems: options.stems === true,
  };
  const push = <K>(map: Map<K, Form[]>, key: K, form: Form) => {
    const list = map.get(key);
    if (list) list.push(form);
    else map.set(key, [form]);
  };
  for (const entry of entries) {
    const seen = new Set<string>();
    const add = (raw: string, part: boolean) => {
      const words = tokenise(raw).filter((w) => !skip?.has(w));
      if (words.length === 0 || words.length > MAX_FORM_TOKENS) return;
      const text = words.join(' ');
      const key = `${part ? 'p' : 'f'}|${text}`;
      if (seen.has(key)) return;
      seen.add(key);
      const compact = words.join('');
      const form: Form = {
        id: entry.id,
        text,
        compact,
        part,
        rank: entry.rank ?? 0,
        length: lengthOf(compact),
        mask: letterMask(compact),
      };
      push(index.byText, text, form);
      push(index.byCompact, compact, form);
      push(index.byLength, form.length, form);
      if (words.length === 1) index.singles.push(form);
      for (const w of words) index.words.add(w);
      if (!part && words.length > 1) index.heads.add(words[0]!);
      index.maxTokens = Math.max(index.maxTokens, words.length);
    };
    for (const f of entry.forms) add(f, false);
    for (const f of entry.partForms ?? []) add(f, true);
  }
  return index;
}

/** Orders matches best first. Ties after quality fall to rank, then the shorter id, then id order. */
function compare(a: PhraseMatch, b: PhraseMatch): number {
  return (
    Number(b.strong) - Number(a.strong) ||
    b.coverage - a.coverage ||
    b.quality - a.quality ||
    a.rank - b.rank ||
    a.id.length - b.id.length ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

function quality(kind: MatchKind, edits: number, part: boolean): number {
  const base = kind === 'fuzzy' ? FUZZY_QUALITY[edits]! : BASE_QUALITY[kind];
  return part ? base * PART_FACTOR : base;
}

/**
 * Every entry the words mention, with its best match, in no particular order. A span matches an entry when it equals
 * one of its forms (`exact`), equals it once spaces are ignored (`compact`), or is within the edit limit of it
 * (`fuzzy`; see `maxEdits`; a two-edit match must keep the first letter). A lone word that is the first word of a
 * longer form ("pimple" in "pimple saudagar") is an unfinished name and is never fuzzy-matched. With `stems` a
 * one-word span may also be the start of a longer one-word form.
 */
export function findPhraseMatches(tokens: readonly string[], index: PhraseIndex): PhraseMatch[] {
  const words = tokens.length > MAX_TOKENS ? tokens.slice(0, MAX_TOKENS) : tokens;
  const best = new Map<string, PhraseMatch>();
  const consider = (m: PhraseMatch) => {
    const current = best.get(m.id);
    if (!current || compare(m, current) < 0) best.set(m.id, m);
  };
  const make = (f: Form, start: number, end: number, kind: MatchKind, edits: number, coverage: number) =>
    consider({
      id: f.id,
      start,
      end,
      kind,
      edits,
      part: f.part,
      coverage,
      quality: quality(kind, edits, f.part),
      strong: (kind === 'exact' || kind === 'compact') && !f.part,
      rank: f.rank,
    });

  for (let i = 0; i < words.length; i++) {
    let text = '';
    for (let len = 1; len <= index.maxTokens && i + len <= words.length; len++) {
      text = len === 1 ? words[i]! : `${text} ${words[i + len - 1]!}`;
      const compact = text.replaceAll(' ', '');
      const end = i + len;
      const coverage = lengthOf(compact);

      const exact = index.byText.get(text);
      if (exact) {
        for (const f of exact) make(f, i, end, 'exact', 0, coverage);
        continue;
      }
      const spaced = index.byCompact.get(compact);
      if (spaced) {
        for (const f of spaced) make(f, i, end, 'compact', 0, coverage);
        continue;
      }
      // A lone word that starts a longer name is an unfinished name ("pimple" for "pimple saudagar"), not a typo of
      // another place's name ("pimpri"), so it is not guessed at. The whole name is still found, typos and all.
      const unfinished = len === 1 && index.heads.has(text);
      if (coverage >= MIN_FUZZY_LENGTH && !unfinished) {
        const mask = letterMask(compact);
        for (let l = Math.max(coverage - 2, MIN_FUZZY_LENGTH); l <= coverage + 2; l++) {
          for (const f of index.byLength.get(l) ?? []) {
            const limit = maxEdits(Math.min(coverage, f.length));
            if (limit === 0) continue;
            if (bitCount(mask & ~f.mask) > limit || bitCount(f.mask & ~mask) > limit) continue;
            const d = damerauLevenshtein(compact, f.compact, limit);
            if (d > limit) continue;
            if (d === 2 && compact[0] !== f.compact[0]) continue;
            make(f, i, end, 'fuzzy', d, coverage);
          }
        }
      }
      if (index.stems && len === 1 && coverage >= MIN_STEM_LENGTH) {
        for (const f of index.singles) {
          if (f.length > coverage && f.length - coverage <= MAX_STEM_GAP && f.compact.startsWith(compact)) {
            make(f, i, end, 'stem', 0, coverage);
          }
        }
      }
    }
  }
  return [...best.values()];
}

const overlaps = (a: PhraseMatch, b: PhraseMatch) => a.start < b.end && b.start < a.end;

/** True when another entry matched with the same strength and either the same words or a separate, equal mention. */
function isAmbiguous(top: PhraseMatch, sorted: readonly PhraseMatch[]): boolean {
  return sorted.some(
    (m) =>
      m !== top &&
      m.strong === top.strong &&
      (overlaps(top, m) ? m.coverage === top.coverage && m.quality === top.quality : true),
  );
}

/**
 * The best of `matches`, or `null`. The confidence is the match quality, less 0.15 when the text is ambiguous: another
 * entry matched with the same strength and either the same words or a separate mention of equal standing. A longer
 * match that contains a shorter one ("hinjewadi phase 1" over "hinjewadi") is not ambiguous.
 *
 * For separate mentions the longer name (more letters) wins, whatever the ranks; `rank` decides only between names of
 * equal length and quality. (Nested matches must be judged by length, and one sort order cannot use length for nested
 * pairs and rank for separate ones.)
 *
 * Strong matches outrank weak ones, with one exception: a one-edit match that contains the strong match and is the
 * only such candidate wins ("terace waterproofing" is the terrace service, not plain "waterproofing"). When the longer
 * match is not unique ("hinjewadi phase" fits phases 1, 2 and 3 equally) the strong match stands.
 */
export function pickBest(matches: readonly PhraseMatch[], tokens: readonly string[]): BestMatch | null {
  if (matches.length === 0) return null;
  const sorted = [...matches].sort(compare);
  let top = sorted[0]!;
  if (top.strong) {
    const anchor = top;
    const longer = sorted.find(
      (m) =>
        m.kind === 'fuzzy' &&
        m.edits === 1 &&
        !m.part &&
        m.start <= anchor.start &&
        m.end >= anchor.end &&
        m.end - m.start > anchor.end - anchor.start,
    );
    if (longer && !isAmbiguous(longer, sorted)) top = longer;
  }
  const ambiguous = isAmbiguous(top, sorted);
  const confidence =
    Math.round(Math.min(1, Math.max(0, top.quality - (ambiguous ? AMBIGUITY_PENALTY : 0))) * 100) / 100;
  return { ...top, confidence, matched: tokens.slice(top.start, top.end).join(' ') };
}
