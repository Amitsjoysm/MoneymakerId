// Resolves the custom properties a theme root ends up with, straight from the token CSS, so the contrast test
// measures what browsers apply rather than a copy of it. It models one element (the theme root: `<html>`, or a
// nested element that carries its own `data-theme` and `data-vertical`), the light/dark system preference and
// the cascade (specificity, then source order). Anything outside that model throws instead of being skipped.

export interface ThemeContext {
  /** `<html>` (matches `:root`), or a nested theme root. */
  root: boolean;
  theme: 'light' | 'dark' | null;
  vertical: string;
  prefersDark: boolean;
}

interface Rule {
  selectors: string[];
  media: 'dark' | 'light' | null;
  declarations: Record<string, string>;
  order: number;
}

function parseRules(css: string): Rule[] {
  const rules: Rule[] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');

  const walk = (source: string, media: Rule['media']) => {
    let i = 0;
    while (i < source.length) {
      const open = source.indexOf('{', i);
      if (open === -1) break;
      const prelude = source.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      for (; j < source.length && depth > 0; j++) {
        if (source[j] === '{') depth++;
        else if (source[j] === '}') depth--;
      }
      const body = source.slice(open + 1, j - 1);
      i = j;
      if (prelude.startsWith('@')) {
        const scheme = /^@media\s*\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)$/.exec(prelude);
        if (!scheme) throw new Error(`token CSS may only use @media (prefers-color-scheme): ${prelude}`);
        walk(body, scheme[1] as 'dark' | 'light');
        continue;
      }
      const declarations: Record<string, string> = {};
      for (const part of body.split(';')) {
        const colon = part.indexOf(':');
        if (colon === -1) continue;
        declarations[part.slice(0, colon).trim()] = part.slice(colon + 1).trim();
      }
      rules.push({
        selectors: prelude.split(',').map((s) => s.trim()),
        media,
        declarations,
        order: rules.length,
      });
    }
  };

  walk(text, null);
  return rules;
}

type Simple =
  | { kind: 'root' }
  | { kind: 'attr'; attr: 'theme' | 'vertical'; value: string }
  | { kind: 'class' }
  | { kind: 'not'; inner: Simple[] };

const SIMPLE = /^(?::root|\.[\w-]+|\[data-(theme|vertical)=(['"]?)([a-z-]+)\2\]|:not\((.+?)\)(?=$|[:.[]))/;

/** Splits a compound selector (no combinators) into the simple selectors the token file may use. */
function parseCompound(selector: string): Simple[] {
  if (/\s/.test(selector.replace(/\(.*?\)/g, ''))) {
    throw new Error(`token selectors must not use combinators (they cannot be modelled): ${selector}`);
  }
  const parts: Simple[] = [];
  let rest = selector;
  while (rest.length > 0) {
    const m = SIMPLE.exec(rest);
    if (!m) throw new Error(`unsupported token selector: ${selector}`);
    const [whole, attr, , value, negated] = m;
    if (whole === ':root') parts.push({ kind: 'root' });
    else if (whole.startsWith('.')) parts.push({ kind: 'class' });
    else if (negated !== undefined) parts.push({ kind: 'not', inner: parseCompound(negated) });
    else parts.push({ kind: 'attr', attr: attr as 'theme' | 'vertical', value: value ?? '' });
    rest = rest.slice(whole.length);
  }
  return parts;
}

/** Selector specificity as one number: every simple selector here counts in the class/attribute column. */
function specificity(parts: Simple[]): number {
  return parts.reduce((sum, p) => sum + (p.kind === 'not' ? specificity(p.inner) : 1), 0);
}

function matches(parts: Simple[], ctx: ThemeContext): boolean {
  return parts.every((p) => {
    switch (p.kind) {
      case 'root':
        return ctx.root;
      case 'class':
        return false; // theme roots are identified by attributes only
      case 'attr':
        return (p.attr === 'theme' ? ctx.theme : ctx.vertical) === p.value;
      case 'not':
        return !matches(p.inner, ctx);
    }
  });
}

function resolveVars(tokens: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const resolve = (name: string, seen: Set<string>): string => {
    if (seen.has(name)) throw new Error(`circular var(): ${[...seen, name].join(' -> ')}`);
    const raw = tokens[name];
    if (raw === undefined) throw new Error(`var(${name}) is not defined for this theme root`);
    return raw.replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (_, ref: string) => resolve(ref, new Set([...seen, name])));
  };
  for (const name of Object.keys(tokens)) out[name] = resolve(name, new Set());
  return out;
}

/** The declarations that apply to the theme root, after the cascade and var() resolution. */
export function resolveTokens(css: string, ctx: ThemeContext): Record<string, string> {
  const applied: { specificity: number; order: number; declarations: Record<string, string> }[] = [];
  for (const rule of parseRules(css)) {
    if (rule.media === 'dark' && !ctx.prefersDark) continue;
    if (rule.media === 'light' && ctx.prefersDark) continue;
    const specificities = rule.selectors
      .map(parseCompound)
      .filter((parts) => matches(parts, ctx))
      .map(specificity);
    if (specificities.length === 0) continue;
    applied.push({ specificity: Math.max(...specificities), order: rule.order, declarations: rule.declarations });
  }
  applied.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
  const tokens: Record<string, string> = {};
  for (const { declarations } of applied) Object.assign(tokens, declarations);
  return resolveVars(tokens);
}
