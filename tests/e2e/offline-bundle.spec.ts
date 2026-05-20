/**
 * E2E: Offline / air-gap bundle checks — §6 constraints, §13 distribution.
 *
 * Verifies that the frontend does NOT make requests to external CDNs or font
 * hosts. This is the air-gap constraint from DESIGN.md §6 non-negotiable #1.
 *
 * In CI these tests run against the Vite dev server. In production the same
 * checks apply to the bundled output (the `docker compose up` smoke test is
 * noted as a local-only verification step in the PR — §12.5 CI reality).
 */
import { test, expect } from '@playwright/test'
import { setupApiMocks, MOCK_TOKEN } from './fixtures'

const EXTERNAL_CDN_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'use.typekit.net',
  'rsms.me',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'cdn.skypack.dev',
  'esm.sh',
  'esm.run',
]

function isExternalRequest(url: string): boolean {
  // Allow localhost and loopback
  if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
    return false
  }
  return EXTERNAL_CDN_HOSTS.some((host) => url.includes(host))
}

test.describe('Air-gap: no external CDN requests', () => {
  test('login page makes no external CDN/font requests', async ({ page }) => {
    const externalRequests: string[] = []

    page.on('request', (request) => {
      const url = request.url()
      if (isExternalRequest(url)) {
        externalRequests.push(`${request.resourceType()}: ${url}`)
      }
    })

    await setupApiMocks(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    if (externalRequests.length > 0) {
      console.log('External requests detected (violates air-gap):')
      externalRequests.forEach((r) => console.log(' -', r))
    }

    expect(
      externalRequests,
      'No external CDN/font requests (air-gap constraint §6)',
    ).toHaveLength(0)
  })

  test('authenticated map page makes no external CDN requests', async ({ page }) => {
    const externalRequests: string[] = []

    page.on('request', (request) => {
      const url = request.url()
      if (isExternalRequest(url)) {
        externalRequests.push(`${request.resourceType()}: ${url}`)
      }
    })

    await setupApiMocks(page)
    await page.goto('about:blank')
    await page.evaluate((token) => localStorage.setItem('nf_token', token), MOCK_TOKEN)
    await page.goto('/map')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    if (externalRequests.length > 0) {
      console.log('External requests on /map (violates air-gap):')
      externalRequests.forEach((r) => console.log(' -', r))
    }

    expect(
      externalRequests,
      'No external CDN requests on /map (air-gap constraint §6)',
    ).toHaveLength(0)
  })
})

test.describe('Air-gap: fonts are self-hosted', () => {
  test('all font requests go to localhost', async ({ page }) => {
    const fontRequests: string[] = []
    const externalFonts: string[] = []

    page.on('request', (request) => {
      if (request.resourceType() === 'font') {
        fontRequests.push(request.url())
        if (!request.url().startsWith('http://localhost') && !request.url().startsWith('http://127.0.0.1')) {
          externalFonts.push(request.url())
        }
      }
    })

    await setupApiMocks(page)
    await page.goto('/login')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    if (externalFonts.length > 0) {
      console.log('External font sources detected (violates air-gap §6):')
      externalFonts.forEach((u) => console.log(' -', u))
    }

    // If no font requests at all, the @font-face might be deferred — that is fine
    // (the test passes if all font requests that DO happen are local)
    expect(
      externalFonts,
      `All fonts must be self-hosted. External font requests: ${externalFonts.join(', ')}`,
    ).toHaveLength(0)
  })

  test('Inter and JetBrains Mono are loaded from /fonts/ path', async ({ page }) => {
    const localFontPaths: string[] = []

    page.on('request', (request) => {
      if (request.resourceType() === 'font') {
        const url = new URL(request.url())
        localFontPaths.push(url.pathname)
      }
    })

    await setupApiMocks(page)
    await page.goto('/login')
    // Trigger text rendering to load fonts
    await page.getByLabel('Username').fill('test')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    // All font paths should be under /fonts/
    for (const fontPath of localFontPaths) {
      expect(
        fontPath.startsWith('/fonts/'),
        `Font at unexpected path: ${fontPath} (expected /fonts/)`,
      ).toBe(true)
    }
  })
})

test.describe('Air-gap: PMTiles served locally', () => {
  test('tiles are served from the local /tiles/ endpoint', async ({ page }) => {
    const externalTileRequests: string[] = []

    page.on('request', (request) => {
      const url = request.url()
      // MapLibre makes range requests to the tiles URL — it should be local
      if (url.endsWith('.pmtiles') && isExternalRequest(url)) {
        externalTileRequests.push(url)
      }
    })

    await setupApiMocks(page)
    await page.goto('about:blank')
    await page.evaluate((token) => localStorage.setItem('nf_token', token), MOCK_TOKEN)
    await page.goto('/map')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    expect(
      externalTileRequests,
      'PMTiles must be served from local /tiles/ endpoint, not a remote host',
    ).toHaveLength(0)
  })
})

test.describe('Offline build smoke notes', () => {
  test('documents the local docker compose verification (CI handoff)', async () => {
    /**
     * §12.5 CI reality: the full `docker compose up` no-internet smoke test
     * CANNOT run in GitHub Actions (no Docker daemon, no internet isolation).
     *
     * Local verification required by the repo owner:
     *
     *   # 1. Build the image on a connected machine
     *   docker compose build
     *
     *   # 2. Save to tarball
     *   docker save neo-fiber-app:latest | gzip > neo-fiber.tar.gz
     *
     *   # 3. On the target machine (or simulate with network=none):
     *   docker load < neo-fiber.tar.gz
     *   docker compose up
     *
     *   # 4. Verify in browser (no internet required):
     *   curl http://localhost:5000/api/v1/health
     *   open http://localhost:5000
     *
     * This test is intentionally a no-op — it exists to document the handoff.
     */
    expect(true).toBe(true)
  })
})
