import { defineConfig, devices } from '@playwright/test';

const HARNESS_ORIGIN = 'http://127.0.0.1:4173';
const HARNESS_URL = `${HARNESS_ORIGIN}/tests/browser/harness.html`;
const ENGINE_BROWSER_SPECS =
  /(?:clipboard|focus|print|writing-diagnostics)\.browser\.spec\.ts/u;

export default defineConfig({
  testDir: './specs',
  outputDir: './test-results',
  globalSetup: './globalSetup.ts',
  fullyParallel: false,
  workers: 3,
  retries: 0,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  reporter: [['line']],
  use: { baseURL: HARNESS_ORIGIN },
  webServer: {
    command:
      'pnpm --dir ../.. build && pnpm --dir ../.. exec vite --config tests/browser/vite.config.ts --host 127.0.0.1 --port 4173 --strictPort',
    url: HARNESS_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      testMatch: ENGINE_BROWSER_SPECS,
      use: { ...devices['Desktop Chrome'], browserName: 'chromium' },
    },
    {
      name: 'firefox',
      testMatch: ENGINE_BROWSER_SPECS,
      use: { ...devices['Desktop Firefox'], browserName: 'firefox' },
    },
    {
      name: 'webkit',
      testMatch: ENGINE_BROWSER_SPECS,
      use: { ...devices['Desktop Safari'], browserName: 'webkit' },
    },
    {
      name: 'chromium-mobile-diagnostics',
      testMatch: /writing-diagnostics\.browser\.spec\.ts/u,
      use: { ...devices['Pixel 7'], browserName: 'chromium' },
    },
    {
      name: 'consensus',
      testMatch: /clipboard\.consensus\.spec\.ts/u,
      dependencies: ['chromium', 'firefox', 'webkit'],
    },
  ],
});
