#!/usr/bin/env node
// Runs Lighthouse CI once for every lighthouserc*.json in the repo root, and passes when there are none.
// Exits 1 if any run fails. Usage: node scripts/lhci.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const configs = readdirSync(root)
  .filter((name) => /^lighthouserc.*\.json$/.test(name))
  .sort();

if (configs.length === 0) {
  console.log('No lighthouserc*.json found, so there is nothing to run (exit 0).');
  process.exit(0);
}

// This cloud container keeps Chromium at a fixed path. Elsewhere, CHROME_PATH or Lighthouse's own lookup applies.
const containerChromium = '/opt/pw-browsers/chromium';
const env = { ...process.env };
if (!env.CHROME_PATH && existsSync(containerChromium)) env.CHROME_PATH = containerChromium;

let failed = 0;
for (const config of configs) {
  console.log(`\n> lhci autorun --config=${config}`);
  const result = spawnSync('pnpm', ['exec', 'lhci', 'autorun', `--config=${config}`], {
    cwd: root,
    env,
    stdio: 'inherit',
  });
  if (result.status !== 0) failed += 1;
}
process.exit(failed === 0 ? 0 : 1);
