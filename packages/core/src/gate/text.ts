// Plain-text helpers for page candidates: markdown to text, word counts, joining text blocks. Pure.
import { words } from './shingles.ts';

/** Markdown to plain text. Link and image targets, bare URLs and HTML tags go; the link text and the prose stay. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/<[^>]*>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[`*_~>#|]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** The number of words of a text, counted the way the uniqueness check splits it. */
export function wordCount(text: string): number {
  return words(text).length;
}

/** Joins the non-empty blocks with a newline. */
export function joinText(blocks: readonly (string | null | undefined)[]): string {
  return blocks
    .map((block) => block?.trim() ?? '')
    .filter((block) => block !== '')
    .join('\n');
}
