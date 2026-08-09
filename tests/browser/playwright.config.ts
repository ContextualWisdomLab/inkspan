import { defineConfig, devices } from '@playwright/test';

const HARNESS_URL = 'http://127.0.0.1:4173/tests/browser/harness.html';

export default defineConfig({
  testDir: './specs',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 3,
  retries: 0,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  reporter: [['line']],
  webServer: {
    command:
      'pnpm --dir ../.. exec vite --host 127.0.0.1 --port 4173 --strictPort',
    url: HARNESS_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      testMatch: /clipboard\.browser\.spec\.ts/u,
      use: { ...devices['Desktop Chrome'], browserName: 'chromium' },
    },
    {
      name: 'firefox',
      testMatch: /clipboard\.browser\.spec\.ts/u,
      use: { ...devices['Desktop Firefox'], browserName: 'firefox' },
    },
    {
      name: 'webkit',
      testMatch: /clipboard\.browser\.spec\.ts/u,
      use: { ...devices['Desktop Safari'], browserName: 'webkit' },
    },
    {
      name: 'consensus',
      testMatch: /clipboard\.consensus\.spec\.ts/u,
      dependencies: ['chromium', 'firefox', 'webkit'],
    },
  ],
});
