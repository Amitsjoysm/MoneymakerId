#!/usr/bin/env node
// Runs `node <script> [args...]` when the script exists, and otherwise says so and exits 0.
// Used by `pnpm checks` (scripts/run-checks.mjs) and `pnpm launch:check` (scripts/launch-check.mjs),
// which later tasks create. Until then these commands pass without checking anything.
// Usage: node scripts/run-if-present.mjs <script> [args...]
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const [script, ...args] = process.argv.slice(2);

if (!script) {
  console.error('usage: node scripts/run-if-present.mjs <script> [args...]');
  process.exit(2);
}

const file = resolve(root, script);
if (!existsSync(file)) {
  console.log(`${script} does not exist yet, so nothing was run (exit 0).`);
  process.exit(0);
}

const result = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit' });
process.exit(result.status ?? 1);
