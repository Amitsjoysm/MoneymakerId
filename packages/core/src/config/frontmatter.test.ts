import { describe, expect, it } from 'vitest';
import { ConfigError } from './errors.ts';
import { parseFrontmatter } from './frontmatter.ts';

const doc = (front: string, body = 'Body text.\n') => `---\n${front}\n---\n${body}`;

describe('parseFrontmatter', () => {
  it('parses scalars: quoted, plain, numbers, booleans and null', () => {
    const { data, body } = parseFrontmatter(
      doc(['a: "quoted: with colon"', "b: 'single ''quoted'''", 'c: plain text', 'd: 42', 'e: true', 'f: null', 'g: ~'].join('\n')),
    );
    expect(data).toEqual({ a: 'quoted: with colon', b: "single 'quoted'", c: 'plain text', d: 42, e: true, f: null, g: null });
    expect(body).toBe('Body text.\n');
  });

  it('parses double-quoted escapes and unicode', () => {
    const { data } = parseFrontmatter(doc('a: "tab\\there \\"q\\" \\u20b9 पुणे \\\\"'));
    expect(data).toEqual({ a: 'tab\there "q" \u20b9 पुणे \\' });
  });

  it('parses a list of mappings, the shape of a guide sources list', () => {
    const { data } = parseFrontmatter(
      doc(
        [
          'locality_id: baner',
          'sources:',
          '  - url: "https://example.com/a"',
          '    title: "A"',
          '    quote: "q1"',
          '  - url: "https://example.com/b"',
          '    title: "B"',
          '    quote: null',
        ].join('\n'),
      ),
    );
    expect(data).toEqual({
      locality_id: 'baner',
      sources: [
        { url: 'https://example.com/a', title: 'A', quote: 'q1' },
        { url: 'https://example.com/b', title: 'B', quote: null },
      ],
    });
  });

  it('parses a list of scalars and an empty flow list', () => {
    const { data } = parseFrontmatter(doc(['tags:', '  - one', '  - "two"', 'none: []'].join('\n')));
    expect(data).toEqual({ tags: ['one', 'two'], none: [] });
  });

  it('keeps the body untouched, including later --- rules', () => {
    const { body } = parseFrontmatter(doc('a: 1', 'Intro\n\n---\n\nAfter the rule\n'));
    expect(body).toBe('Intro\n\n---\n\nAfter the rule\n');
  });

  it('ignores comments and blank lines in the front matter', () => {
    const { data } = parseFrontmatter(doc(['# a comment', '', 'a: 1'].join('\n')));
    expect(data).toEqual({ a: 1 });
  });

  it('handles CRLF line endings', () => {
    const { data, body } = parseFrontmatter('---\r\na: 1\r\nb: "x"\r\n---\r\nBody\r\n');
    expect(data).toEqual({ a: 1, b: 'x' });
    expect(body).toBe('Body\r\n');
  });

  it('accepts an empty block', () => {
    expect(parseFrontmatter('---\n---\nBody\n')).toEqual({ data: {}, body: 'Body\n' });
  });

  it('fails loudly on a missing block', () => {
    expect(() => parseFrontmatter('No front matter')).toThrow(ConfigError);
    expect(() => parseFrontmatter('---\na: 1\nno closing rule')).toThrow(/closing/);
  });

  it.each([
    ['a plain scalar containing ": "', 'title: Living in Baner: Area Guide'],
    ['a flow mapping', 'a: {x: 1}'],
    ['a non-empty flow list', 'a: [1, 2]'],
    ['a block scalar', 'a: |\n  text'],
    ['an anchor', 'a: &x 1'],
    ['a duplicate key', 'a: 1\na: 2'],
    ['tab indentation', 'a:\n\t- x'],
    ['an unterminated quote', 'a: "oops'],
    ['an unsupported escape', 'a: "\\x41"'],
  ])('rejects %s instead of guessing', (_name, front) => {
    expect(() => parseFrontmatter(doc(front))).toThrow(ConfigError);
  });
});
