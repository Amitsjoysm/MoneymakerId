// Performance budget (plan §18) on what the fixture pages really ship. The test runs its own `astro build` of
// the construction app with DATA_SOURCE=fixtures into a temporary folder, then reads each page's HTML and
// weighs every stylesheet and script it loads (linked files, inline blocks, and the chunks a script imports).
// Plan §18: CSS < 25 KB in a single cached file; our JavaScript < 15 KB on calculator and form pages. Sizes
// are uncompressed bytes (the T03 brief's ruling).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const KB = 1024;
const CSS_BUDGET = 25 * KB;
const JS_BUDGET = 15 * KB;
const PAGES = ['components', 'cost-page'] as const;

const app = fileURLToPath(new URL('../../../apps/construction/', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'mm-ui-budget-'));
const client = join(out, 'client');

/** Reads a root-relative asset path ("/_astro/x.css") from the build output. */
function asset(href: string): string {
  const file = join(client, href.split(/[?#]/)[0]!);
  if (!existsSync(file)) throw new Error(`budget: ${href} is linked but was not built`);
  return readFileSync(file, 'utf8');
}

/** A script and every chunk it imports statically, each counted once. */
function scriptWeight(href: string, seen: Set<string>): number {
  if (seen.has(href)) return 0;
  seen.add(href);
  const code = asset(href);
  let bytes = Buffer.byteLength(code);
  for (const [, spec] of code.matchAll(/(?:^|[;}\s])import\s*(?:[^'"`;]*?from\s*)?["']([^"']+)["']/g)) {
    if (spec!.startsWith('.')) bytes += scriptWeight(new URL(spec!, `https://x${href}`).pathname, seen);
  }
  return bytes;
}

interface Weight {
  css: number;
  js: number;
  stylesheets: string[];
}

function weigh(page: string): Weight {
  const html = readFileSync(join(client, 'ui-fixtures', page, 'index.html'), 'utf8');
  const stylesheets = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]!);
  let css = stylesheets.reduce((sum, href) => sum + Buffer.byteLength(asset(href)), 0);
  for (const [, body] of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) css += Buffer.byteLength(body!);

  const seen = new Set<string>();
  let js = 0;
  for (const [tag, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/type="application\/ld\+json"/.test(tag)) continue;
    const src = /src="([^"]+)"/.exec(tag)?.[1];
    js += src ? scriptWeight(src, seen) : Buffer.byteLength(body!);
  }
  return { css, js, stylesheets };
}

const weights = new Map<string, Weight>();

beforeAll(() => {
  // The app's own CLI, in a child process: the build runs exactly as in CI, outside this test's Vite graph.
  execFileSync(join(app, 'node_modules/.bin/astro'), ['build', '--outDir', out], {
    cwd: app,
    env: { ...process.env, DATA_SOURCE: 'fixtures' },
    stdio: 'pipe',
  });
  for (const page of PAGES) weights.set(page, weigh(page));
}, 180_000);

afterAll(() => {
  rmSync(out, { recursive: true, force: true });
});

describe('performance budget of the fixture pages (plan §18)', () => {
  it.each(PAGES)('%s: all its CSS is under 25 KB, uncompressed', (page) => {
    const { css } = weights.get(page)!;
    expect(css, `${page} CSS is ${(css / KB).toFixed(1)} KB`).toBeLessThan(CSS_BUDGET);
  });

  it.each(PAGES)('%s: CSS comes in a single cached file', (page) => {
    expect(weights.get(page)!.stylesheets).toHaveLength(1);
  });

  it.each(PAGES)('%s: our JavaScript is under 15 KB, uncompressed', (page) => {
    const { js } = weights.get(page)!;
    expect(js, `${page} JS is ${(js / KB).toFixed(1)} KB`).toBeLessThan(JS_BUDGET);
  });
});
