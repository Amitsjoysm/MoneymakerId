import { describe, expect, it } from 'vitest';
import { joinText, plainText, wordCount } from './text.ts';

describe('plainText', () => {
  it('keeps link text and drops link and image targets, bare URLs and HTML', () => {
    const md =
      'See [the map](https://example.com/a/b "t") and ![a photo](https://example.com/p.png) at https://example.org/x <b>now</b> <https://example.net>';
    expect(plainText(md)).toBe('See the map and a photo at now');
  });

  it('removes heading, emphasis, quote and table markers and tidies the whitespace', () => {
    expect(plainText('# Title\n\n  *bold*   and _italic_ \n> quoted\n| a | b |')).toBe(
      'Title\nbold and italic\nquoted\na b',
    );
  });
});

describe('wordCount', () => {
  it('counts words the way the uniqueness check splits them', () => {
    expect(wordCount('Terrace-waterproofing costs ₹55, per sq.ft.')).toBe(7);
    expect(wordCount('')).toBe(0);
  });

  it('does not cut Devanagari words at their combining marks', () => {
    expect(wordCount('पुणे में बारिश')).toBe(3);
  });
});

describe('joinText', () => {
  it('joins the non-empty blocks with a newline and ignores empty, blank, null and undefined ones', () => {
    expect(joinText(['a', '', '  ', null, undefined, ' b '])).toBe('a\nb');
  });
});
