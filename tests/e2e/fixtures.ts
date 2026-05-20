/**
 * Shared API mock fixtures for E2E tests.
 *
 * All backend calls are intercepted via page.route() so tests run without
 * a live server (§12.5 CI reality). The mock responses match the actual
 * API shapes defined by the Zod schemas in backend/src/routes/.
 */
import type { Page } from '@playwright/test'

export const MOCK_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiJ0ZXN0dXNlciIsInJvbGUiOiJ2aWV3ZXIiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.' +
  'mock-signature-for-testing-only'

export const MOCK_SITES = [
  {
    id: 1,
    name: 'Khartoum Hub',
    lat: 15.5007,
    lng: 32.5599,
    effective_status: 'UP',
    is_hub: true,
    is_vip: false,
    is_root: true,
    zone: 'Khartoum',
    state: 'Khartoum',
  },
  {
    id: 2,
    name: 'Omdurman',
    lat: 15.6445,
    lng: 32.4777,
    effective_status: 'DEGRADED',
    is_hub: false,
    is_vip: false,
    is_root: false,
    zone: 'Khartoum',
    state: 'Khartoum',
  },
  {
    id: 3,
    name: 'Port Sudan',
    lat: 19.6187,
    lng: 37.2164,
    effective_status: 'DOWN',
    is_hub: false,
    is_vip: false,
    is_root: false,
    zone: 'Red Sea',
    state: 'Red Sea',
  },
]

export async function setupApiMocks(page: Page): Promise<void> {
  // Auth — POST /api/v1/auth/login
  await page.route('**/api/v1/auth/login', async (route) => {
    const body = await route.request().postDataJSON().catch(() => ({}))
    if (body?.username === 'testuser' && body?.password === 'testpass') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: MOCK_TOKEN }),
      })
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'UNAUTHENTICATED', message: 'Invalid credentials', details: {} },
        }),
      })
    }
  })

  // Auth — GET /api/v1/auth/me
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'testuser', display_name: 'Test User', role: 'viewer' }),
    })
  })

  // Auth — POST /api/v1/auth/logout
  await page.route('**/api/v1/auth/logout', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  // Health
  await page.route('**/api/v1/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', db: 'ok', dwh: 'ok', uptime_seconds: 3600 }),
    })
  })

  // Map status — KPI overlay data
  await page.route('**/api/v1/map/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        down_devices: 1,
        down_links: 2,
        total_devices: 45,
        total_links: 52,
        availability_pct: 97.78,
        cuts_24h: 1,
        last_computed_at: new Date().toISOString(),
      }),
    })
  })

  // Sites list
  await page.route('**/api/v1/sites', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SITES),
    })
  })

  // Individual site detail (matched after the list route above)
  await page.route('**/api/v1/sites/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 2,
        name: 'Omdurman',
        lat: 15.6445,
        lng: 32.4777,
        effective_status: 'DEGRADED',
        is_hub: false,
        is_vip: false,
        is_root: false,
        zone: 'Khartoum',
        state: 'Khartoum',
        links: [
          { id: 1, link_name: 'KHR-OMD-MAIN', effective_status: 'DOWN', is_backup: false },
          { id: 2, link_name: 'KHR-OMD-BACKUP', effective_status: 'UP', is_backup: true },
        ],
        active_alarms: [
          {
            id: 1,
            alarm_name: 'R_LOS',
            severity: 'Critical',
            source_ne: 'KHR-HUB-01',
            occurrence_time: new Date().toISOString(),
          },
        ],
      }),
    })
  })

  // Links list
  await page.route('**/api/v1/links', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, link_name: 'KHR-OMD-MAIN', site_a_id: 1, site_b_id: 2, is_backup: false, effective_status: 'DOWN' },
        { id: 2, link_name: 'KHR-OMD-BACKUP', site_a_id: 1, site_b_id: 2, is_backup: true, effective_status: 'UP' },
      ]),
    })
  })

  // Alarms
  await page.route('**/api/v1/alarms*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        alarms: [
          {
            id: 1,
            alarm_name: 'R_LOS',
            severity: 'Critical',
            status: 'Not Clear',
            source_ne: 'KHR-HUB-01',
            occurrence_time: new Date().toISOString(),
            clearance_time: null,
          },
        ],
        total: 1,
      }),
    })
  })

  // SSE streams — return a minimal valid SSE response so EventSource doesn't error
  await page.route('**/api/v1/stream/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: {
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      body: ': heartbeat\n\n',
    })
  })

  // OpenAPI docs (not critical for E2E but avoids 404 noise)
  await page.route('**/api/openapi.json', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}
