import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration — Phase 9 (DESIGN.md §28).
 *
 * Tests run against the Vite dev server (port 3000) with all backend API
 * calls mocked via page.route() in each spec. This allows CI to run E2E
 * tests without a live database, LDAP, or DWH (per §12.5 CI reality).
 *
 * For full end-to-end verification against a real stack, run locally with:
 *   docker compose up -d && npm -C frontend run dev &
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Run each file in series; tests within files run in parallel
  fullyParallel: false,

  // Fail the build on CI if test.only() was left in
  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    // Frontend dev server
    baseURL: 'http://localhost:3000',

    // Desktop-only app — §11.5 responsive strategy: ≥1024px
    viewport: { width: 1440, height: 900 },

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start Vite dev server before running tests
  webServer: {
    command: 'cd frontend && npm run dev',
    url: 'http://localhost:3000',
    // Reuse server in local dev; always start fresh in CI
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
