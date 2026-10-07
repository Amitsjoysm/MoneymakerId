import { existsSync } from 'node:fs';
import { chromium, defineConfig, devices } from '@playwright/test';

// End-to-end tests live in e2e/ (CONTRACTS §1). The app under test is expected to be running already
// (for example `astro preview`); pass its address as E2E_BASE_URL.
//
// Browser: Playwright's own Chromium is used when it is installed (CI). This cloud container instead has
// Chromium at /opt/pw-browsers/chromium, a different build from the one Playwright expects, so that
// path is used when the expected build is missing. Never run `playwright install` here.
const containerChromium = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (!existsSync(chromium.executablePath()) && existsSync(containerChromium) ? containerChromium : undefined);

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4321',
    trace: 'on-first-retry',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
});
