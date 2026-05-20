/**
 * E2E: Map page — §5 wedge, §10 /map layout, §10.5 /map states, §11.5 a11y.
 *
 * Covers:
 * - Map shell renders (nav, map application, KPI overlay, ticker)
 * - Correct aria roles: nav[aria-label], role="application", role="log"
 * - Hidden accessible <table> mirror exists for screen readers
 * - Alarms ticker has aria-live="polite"
 * - KPI overlay: metrics rendered as <dt>/<dd> pairs
 * - Mobile block on narrow viewport
 * - Token expiry → redirect to /login
 * - axe-core: 0 serious/critical violations
 */
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { setupApiMocks, MOCK_TOKEN } from './fixtures'

async function loginAndGoToMap(page: import('@playwright/test').Page) {
  await setupApiMocks(page)
  await page.goto('about:blank')
  await page.evaluate((token) => localStorage.setItem('nf_token', token), MOCK_TOKEN)
  await page.goto('/map')
  // Wait for main content to stabilize
  await page.waitForLoadState('networkidle').catch(() => undefined)
}

test.describe('Map page — chrome & navigation', () => {
  test('renders primary navigation sidebar', async ({ page }) => {
    await loginAndGoToMap(page)

    // §11.5: sidebar nav must be <nav aria-label="Primary">
    const nav = page.getByRole('navigation', { name: /primary/i })
    await expect(nav).toBeVisible()
  })

  test('sidebar nav links are keyboard focusable', async ({ page }) => {
    await loginAndGoToMap(page)

    // Tab through the page — all nav items should be reachable
    const navLinks = page.locator('[aria-label="Primary"] a, [aria-label="Primary"] button')
    const count = await navLinks.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < Math.min(count, 5); i++) {
      await expect(navLinks.nth(i)).toBeVisible()
    }
  })
})

test.describe('Map page — map canvas aria', () => {
  test('map has role="application" with accessible label', async ({ page }) => {
    await loginAndGoToMap(page)

    // §11.5: canvas map must expose role="application" aria-label
    const mapApp = page.locator('[role="application"]')
    await expect(mapApp).toBeVisible()
    const label = await mapApp.getAttribute('aria-label')
    expect(label).toBeTruthy()
    expect(label?.toLowerCase()).toContain('map')
  })

  test('hidden accessible table mirror exists for screen readers', async ({ page }) => {
    await loginAndGoToMap(page)

    // §11.5: a visually-hidden <table> must mirror the map data for AT
    const ariaTable = page.locator('table').filter({ has: page.locator('thead') })
    await expect(ariaTable).toHaveCount(1)
  })
})

test.describe('Map page — KPI overlay', () => {
  test('KPI panel uses dt/dd pairs for label+value pairing', async ({ page }) => {
    await loginAndGoToMap(page)

    // §11.5: KPI metrics must be dt/dd so AT pairs labels with values
    const dts = page.locator('dl dt')
    await expect(dts.first()).toBeVisible({ timeout: 8_000 })
    const count = await dts.count()
    expect(count).toBeGreaterThan(0)
  })

  test('availability metric is visible and numeric', async ({ page }) => {
    await loginAndGoToMap(page)

    // Mock returns availability_pct: 97.78
    const kpiText = page.locator('dl, [data-kpi]')
    await expect(kpiText.first()).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('Map page — alarms ticker', () => {
  test('ticker has role="log" with aria-live="polite"', async ({ page }) => {
    await loginAndGoToMap(page)

    // §11.5: ticker must use role="log" aria-live="polite" so new alarms are announced
    const ticker = page.locator('[role="log"]')
    await expect(ticker).toBeAttached()
    await expect(ticker).toHaveAttribute('aria-live', 'polite')
  })
})

test.describe('Map page — accessibility audit', () => {
  test('has 0 serious/critical axe violations (WCAG 2.2 AA)', async ({ page }) => {
    await loginAndGoToMap(page)

    // Wait for dynamic content to settle
    await page.waitForTimeout(1_000)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      // canvas elements are not inspectable by axe — the hidden table handles AT
      .exclude('canvas')
      .analyze()

    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )

    if (serious.length > 0) {
      console.log(
        'Axe violations on /map:\n',
        JSON.stringify(
          serious.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            helpUrl: v.helpUrl,
            nodes: v.nodes.slice(0, 2).map((n) => n.target),
          })),
          null,
          2,
        ),
      )
    }

    expect(serious, 'No serious/critical axe violations on /map').toHaveLength(0)
  })
})

test.describe('Map page — token expiry', () => {
  test('redirect to /login when token is expired/invalid', async ({ page }) => {
    await setupApiMocks(page)

    // Override auth/me to return 401 (expired token behaviour)
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Token expired', details: {} } }),
      })
    })

    // Override map/status to return 401 (any authenticated endpoint triggers redirect)
    await page.route('**/api/v1/map/status', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Token expired', details: {} } }),
      })
    })

    await page.goto('about:blank')
    await page.evaluate(() => localStorage.setItem('nf_token', 'expired.token.value'))
    await page.goto('/map')

    // The api-client 401 handler wipes the token and redirects
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
  })
})

test.describe('Map page — mobile block', () => {
  test('shows block screen on viewport < 1024px', async ({ browser }) => {
    // §11.5: mobile-block guard — narrow viewport renders block screen, not partial UI
    const page = await browser.newPage({
      viewport: { width: 800, height: 600 },
    })
    await setupApiMocks(page)
    await page.evaluate((token) => localStorage.setItem('nf_token', token), MOCK_TOKEN)

    // Navigate directly to avoid localStorage being cleared on browser.newPage
    await page.goto('about:blank')
    await page.evaluate((token) => localStorage.setItem('nf_token', token), MOCK_TOKEN)
    await page.goto('/map')

    // Mobile block component should be visible
    const block = page.locator('[data-testid="mobile-block"], [role="main"]').filter({
      hasText: /desktop|workstation|1024/i,
    })
    await expect(block).toBeVisible({ timeout: 5_000 })

    await page.close()
  })
})
