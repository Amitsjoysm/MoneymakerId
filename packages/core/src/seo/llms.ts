// `/llms.txt` (plan §12: a cheap bonus for AI engines). The layout follows the llms.txt convention: an H1 with the
// site name, a blockquote summary, optional details, then H2 sections of links, each with an optional one-line note.
// All content is passed in; the apps decide which pages to list (only indexable ones).
import { normaliseUrl } from './url.ts';

export type LlmsTxtLink = { title: string; url: string; note?: string };
export type LlmsTxtSection = { title: string; links: readonly LlmsTxtLink[] };
export type LlmsTxtInput = {
  name: string;
  summary: string;
  /** Optional paragraphs between the summary and the first section. */
  details?: string;
  /** In order. By convention a section titled `Optional` holds what a short context may skip. */
  sections: readonly LlmsTxtSection[];
};

/** One line of text: whitespace collapsed, and never empty. */
function line(value: string, field: string): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text === '') throw new RangeError(`llms.txt: ${field} must not be empty`);
  return text;
}

function linkLine(link: LlmsTxtLink): string {
  const title = line(link.title, 'link title').replace(/[[\]]/g, (bracket) => `\\${bracket}`);
  const note = link.note === undefined || link.note.trim() === '' ? '' : `: ${line(link.note, 'link note')}`;
  return `- [${title}](${normaliseUrl(link.url)})${note}`;
}

/**
 * The text of `/llms.txt`. Link URLs must be absolute https URLs (a link may point to another host) and are written
 * in canonical form. A section without links is left out. Throws `RangeError` for an empty name, summary or title,
 * or a URL that is not https.
 */
export function llmsTxt(input: LlmsTxtInput): string {
  const summary = input.summary
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '');
  if (summary.length === 0) throw new RangeError('llms.txt: summary must not be empty');

  const blocks: string[] = [`# ${line(input.name, 'name')}`, summary.map((l) => `> ${l}`).join('\n')];

  const details = input.details
    ?.split(/\r?\n/)
    .map((l) => l.trimEnd())
    .join('\n')
    .trim()
    .replace(/\n{3,}/g, '\n\n');
  if (details) blocks.push(details);

  for (const section of input.sections) {
    if (section.links.length === 0) continue;
    blocks.push(`## ${line(section.title, 'section title')}`, section.links.map(linkLine).join('\n'));
  }
  return `${blocks.join('\n\n')}\n`;
}
