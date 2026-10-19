import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, oklchToSrgb, parseOklch } from './color.ts';
import { COLOR_TOKENS, MIN_CONTRAST, TOKEN_PAIRS } from './pairs.ts';
import { resolveTokens, type ThemeContext } from './resolve.ts';

const CSS = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');

const VERTICALS = ['main', 'construction', 'food'] as const;

/** Every way a page or a nested panel can end up light or dark. */
const SCENARIOS: { name: string; mode: 'light' | 'dark'; ctx: Omit<ThemeContext, 'vertical'> }[] = [
  { name: 'system light', mode: 'light', ctx: { root: true, theme: null, prefersDark: false } },
  { name: 'system dark', mode: 'dark', ctx: { root: true, theme: null, prefersDark: true } },
  { name: 'forced light on a dark system', mode: 'light', ctx: { root: true, theme: 'light', prefersDark: true } },
  { name: 'forced dark on a light system', mode: 'dark', ctx: { root: true, theme: 'dark', prefersDark: false } },
  { name: 'nested light panel', mode: 'light', ctx: { root: false, theme: 'light', prefersDark: true } },
  { name: 'nested dark panel', mode: 'dark', ctx: { root: false, theme: 'dark', prefersDark: false } },
];

const CASES = VERTICALS.flatMap((vertical) =>
  SCENARIOS.map((s) => ({ ...s, vertical, tokens: resolveTokens(CSS, { ...s.ctx, vertical }) })),
);

const rgb = (tokens: Record<string, string>, name: string) => {
  const value = tokens[name];
  if (value === undefined) throw new Error(`${name} is not defined`);
  return oklchToSrgb(parseOklch(value));
};

describe('design tokens', () => {
  it.each(CASES)('$vertical / $name defines every colour token in OKLCH, inside sRGB', ({ tokens }) => {
    for (const name of COLOR_TOKENS) {
      expect(tokens[name], name).toMatch(/^oklch\(/);
      expect(rgb(tokens, name).inGamut, `${name} = ${tokens[name]}`).toBe(true);
    }
  });

  it.each(CASES)('$vertical / $name meets WCAG 2.2 AA for every declared pair', ({ tokens }) => {
    const failures = TOKEN_PAIRS.flatMap(({ fg, bg, kind }) => {
      const ratio = contrastRatio(rgb(tokens, fg).rgb, rgb(tokens, bg).rgb);
      return ratio >= MIN_CONTRAST[kind] ? [] : [`${fg} on ${bg} (${kind}) is ${ratio.toFixed(2)}:1`];
    });
    expect(failures).toEqual([]);
  });

  it.each(CASES)('$vertical / $name sets color-scheme to its mode', ({ tokens, mode }) => {
    expect(tokens['color-scheme']).toBe(mode);
  });

  it.each(VERTICALS)('%s: every route to dark (system, forced, nested) gives the same tokens', (vertical) => {
    const dark = CASES.filter((c) => c.vertical === vertical && c.mode === 'dark').map((c) => pickColors(c.tokens));
    const light = CASES.filter((c) => c.vertical === vertical && c.mode === 'light').map((c) => pickColors(c.tokens));
    for (const t of dark) expect(t).toEqual(dark[0]);
    for (const t of light) expect(t).toEqual(light[0]);
  });

  it('gives each vertical its own place accent and nothing else', () => {
    const light = (v: string) => CASES.find((c) => c.vertical === v && c.name === 'system light')!.tokens;
    const differing = (a: Record<string, string>, b: Record<string, string>) =>
      COLOR_TOKENS.filter((name) => a[name] !== b[name]);
    expect(differing(light('main'), light('construction'))).toEqual(['--mm-place', '--mm-place-ink']);
    expect(differing(light('construction'), light('food'))).toEqual(['--mm-place', '--mm-place-ink']);
  });
});

function pickColors(tokens: Record<string, string>) {
  return Object.fromEntries(COLOR_TOKENS.map((name) => [name, tokens[name]]));
}
