import { describe, expect, it } from 'vitest';
import { resolveTokens } from './resolve.ts';

const CSS = `
/* light defaults */
:root, [data-theme='light'] { color-scheme: light; --mm-ink: oklch(0.2 0.05 320); --mm-focus: var(--mm-ink); }
[data-vertical='food'] { --mm-place: oklch(0.6 0.1 70); }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { color-scheme: dark; --mm-ink: oklch(0.9 0.02 320); }
  :root:not([data-theme='light'])[data-vertical='food'] { --mm-place: oklch(0.8 0.1 80); }
}
[data-theme='dark'] { color-scheme: dark; --mm-ink: oklch(0.9 0.02 320); }
[data-theme='dark'][data-vertical='food'] { --mm-place: oklch(0.8 0.1 80); }
.unrelated { --mm-ink: red; }
`;

describe('resolveTokens', () => {
  it('applies the light defaults to a root element under a light system theme', () => {
    const t = resolveTokens(CSS, { root: true, theme: null, vertical: 'food', prefersDark: false });
    expect(t['--mm-ink']).toBe('oklch(0.2 0.05 320)');
    expect(t['--mm-place']).toBe('oklch(0.6 0.1 70)');
    expect(t['color-scheme']).toBe('light');
  });

  it('follows the system dark theme unless the page forces light', () => {
    const system = resolveTokens(CSS, { root: true, theme: null, vertical: 'food', prefersDark: true });
    expect(system['--mm-ink']).toBe('oklch(0.9 0.02 320)');
    expect(system['--mm-place']).toBe('oklch(0.8 0.1 80)');
    const forced = resolveTokens(CSS, { root: true, theme: 'light', vertical: 'food', prefersDark: true });
    expect(forced['--mm-ink']).toBe('oklch(0.2 0.05 320)');
    expect(forced['--mm-place']).toBe('oklch(0.6 0.1 70)');
  });

  it('lets data-theme="dark" win over a light system theme, on the root or a nested theme root', () => {
    for (const root of [true, false]) {
      const t = resolveTokens(CSS, { root, theme: 'dark', vertical: 'food', prefersDark: false });
      expect(t['--mm-ink']).toBe('oklch(0.9 0.02 320)');
      expect(t['--mm-place']).toBe('oklch(0.8 0.1 80)');
    }
  });

  it('resolves var() references against the same element', () => {
    const t = resolveTokens(CSS, { root: true, theme: null, vertical: 'main', prefersDark: false });
    expect(t['--mm-focus']).toBe('oklch(0.2 0.05 320)');
  });

  it('refuses selectors and at-rules it cannot model, rather than skipping them', () => {
    expect(() => resolveTokens(`:root .card { --mm-ink: red; }`, ctx())).toThrow(/combinator/);
    expect(() => resolveTokens(`@media (min-width: 40em) { :root { --mm-ink: red; } }`, ctx())).toThrow(/@media/);
  });
});

function ctx() {
  return { root: true, theme: null, vertical: 'main', prefersDark: false } as const;
}
