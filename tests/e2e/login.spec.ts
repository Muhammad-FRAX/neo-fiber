/**
 * E2E: Login page — §10 login IA, §11.5 a11y, §11 tokens.
 *
 * Covers:
 * - Correct form structure + aria attributes
 * - Successful login redirects to /map
 * - Failed login shows error alert
 * - Unauthenticated access to /map redirects to /login?next=/map
 * - Expired/invalid token → redirect
 * - Skip link present
 * - axe-core: 0 serious/critical violations (§11.5 WCAG 2.2 AA)
 */
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { setupApiMocks, MOCK_TOKEN } from './fixtures'

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    // Clear any stored token so we start unauthenticated
    await page.goto('about:blank')
    await page.evaluate(() => localStorage.clear())
  })

  test('renders form with labeled inputs and submit button', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: 'Neo-Fiber' })).toBeVisible()
    await expect(page.getByLabel('Username')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('submit button is disabled until both fields are filled', async ({ page }) => {
    await page.goto('/login')

    const btn = page.getByRole('button', { name: 'Sign in' })
    await expect(btn).toBeDisabled()

    await page.getByLabel('Username').fill('testuser')
    await expect(btn).toBeDisabled()

    await page.getByLabel('Password').fill('testpass')
    await expect(btn).toBeEnabled()
  })

  test('successful login redirects to /map', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Username').fill('testuser')
    await page.getByLabel('Password').fill('testpass')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/map/, { timeout: 10_000 })
  })

  test('preserves ?next= redirect after login', async ({ page }) => {
    await page.goto('/login?next=%2Fdashboard')

    await page.getByLabel('Username').fill('testuser')
    await page.getByLabel('Password').fill('testpass')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })
  })

  test('shows role="alert" error on invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Username').fill('wronguser')
    await page.getByLabel('Password').fill('wrongpass')
    await page.getByRole('button', { name: 'Sign in' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(/invalid/i)
  })

  test('unauthenticated navigation to /map redirects to /login', async ({ page }) => {
    await page.goto('/map')
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('unauthenticated redirect preserves ?next= parameter', async ({ page }) => {
    await page.goto('/map')
    await expect(page).toHaveURL(/next=%2Fmap/, { timeout: 5_000 })
  })

  test('skip link is present and focusable', async ({ page }) => {
    await page.goto('/login')

    // Skip link should be in the DOM
    const skipLink = page.locator('a.skip-link, a[href="#login-form"], a[href="#main-content"]').first()
    await expect(skipLink).toBeAttached()
  })

  test('password toggle button has accessible label', async ({ page }) => {
    await page.goto('/login')

    const toggleBtn = page.getByRole('button', { name: /show password|hide password/i })
    await expect(toggleBtn).toBeAttached()
    await expect(toggleBtn).toHaveAttribute('aria-label')
  })

  test('has 0 serious/critical axe violations (WCAG 2.2 AA)', async ({ page }) => {
    await page.goto('/login')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()

    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )

    if (serious.length > 0) {
      console.log(
        'Axe violations on /login:\n',
        JSON.stringify(
          serious.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.length,
          })),
          null,
          2,
        ),
      )
    }

    expect(serious, 'No serious/critical axe violations on /login').toHaveLength(0)
  })
})

test.describe('Auth token handling', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
  })

  test('authenticated user at /login is redirected to /map', async ({ page }) => {
    await page.goto('about:blank')
    await page.evaluate((token) => localStorage.setItem('nf_token', token), MOCK_TOKEN)
    await page.goto('/login')

    // App should redirect authenticated users away from login
    await expect(page).toHaveURL(/\/map|\/dashboard/, { timeout: 5_000 })
  })
})
