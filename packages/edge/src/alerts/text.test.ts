import { describe, expect, it } from 'vitest';
import { cleanInline, ELLIPSIS, truncateBytes, truncateChars } from './text.ts';

const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

describe('cleanInline', () => {
  it('collapses newlines, tabs and control characters into single spaces and trims', () => {
    expect(cleanInline('  a\r\nb\tc\u0000d\u0007  e  ', 100)).toBe('a b c d e');
  });

  it('turns non-strings into text instead of throwing', () => {
    expect(cleanInline(42, 10)).toBe('42');
    expect(cleanInline(null, 10)).toBe('');
    expect(cleanInline(undefined, 10)).toBe('');
  });

  it('caps the length, ending in an ellipsis', () => {
    const out = cleanInline('x'.repeat(50), 10);
    expect(out).toHaveLength(10);
    expect(out.endsWith(ELLIPSIS)).toBe(true);
  });
});

describe('truncateChars', () => {
  it('leaves text within the limit untouched', () => {
    expect(truncateChars('abc', 3)).toBe('abc');
  });

  it('cuts to exactly the limit, ending in an ellipsis', () => {
    const out = truncateChars('a'.repeat(5000), 4096);
    expect(out).toHaveLength(4096);
    expect(out.endsWith(ELLIPSIS)).toBe(true);
  });

  it('never splits a surrogate pair', () => {
    // 'ab' + an emoji (2 UTF-16 units) + 'c': a limit of 4 would keep 'ab' + the emoji's first half, plus the ellipsis.
    const out = truncateChars('ab\u{1F600}cdef', 4);
    expect(out).toBe(`ab${ELLIPSIS}`);
    expect(out).not.toMatch(/[\uD800-\uDFFF]/);
  });
});

describe('truncateBytes', () => {
  it('leaves text within the limit untouched', () => {
    expect(truncateBytes('hello', 5)).toBe('hello');
  });

  it('cuts ASCII to at most the byte limit, ending in an ellipsis', () => {
    const out = truncateBytes('a'.repeat(1000), 100);
    expect(utf8Bytes(out)).toBeLessThanOrEqual(100);
    expect(out.endsWith(ELLIPSIS)).toBe(true);
  });

  it('cuts multi-byte text on a character boundary, so the result is valid UTF-8', () => {
    const devanagari = 'नमस्ते'.repeat(200); // 3 bytes per character
    for (const limit of [97, 98, 99, 100, 101]) {
      const out = truncateBytes(devanagari, limit);
      expect(utf8Bytes(out)).toBeLessThanOrEqual(limit);
      expect(out).not.toContain('�');
      // A strict decoder throws on malformed UTF-8.
      expect(() =>
        new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(new TextEncoder().encode(out)),
      ).not.toThrow();
    }
  });
});
