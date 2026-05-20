# CONTINUATION — Phase 9 complete; v1.0 ready for local verification

**Branch:** `claude/issue-24-20260520-1201`
**Phases completed:** 1 → 9 (all v1.0 phases)
**Date written:** 2026-05-20

---

## Test results summary (as of Phase 9 completion)

| Suite                                                              | Result   | Notes                                |
| ------------------------------------------------------------------ | -------- | ------------------------------------ |
| `src/services/topology/__tests__/reachability.test.ts`             | ✅ 7/7   | Two-pass BFS (T1)                    |
| `tests/regression/backup-aware-1-cascading-false-positive.test.ts` | ✅ 1/1   | Regression T6                        |
| `tests/regression/backup-aware-2-degraded-not-down.test.ts`        | ✅ 3/3   | Regression T6                        |
| `tests/regression/backup-aware-3-real-historical-incident.test.ts` | ✅ 1/1   | Regression T6                        |
| `src/services/dwh/__tests__/alarm-resolver.test.ts`                | ✅ 10/10 | Alarm resolver (T12)                 |
| `src/services/dwh/__tests__/poller.test.ts`                        | ✅ 7/7   | DWH poller                           |
| `tests/unit/auth/jwt.test.ts`                                      | ✅ 4/4   | JWT sign/verify                      |
| `tests/integration/auth.test.ts`                                   | ✅ 11/11 | Auth HTTP (testcontainers)           |
| `tests/integration/health.test.ts`                                 | ✅       | testcontainers DB                    |
| `tests/integration/tiles.test.ts`                                  | ✅       | Range request (T3)                   |
| Frontend unit tests                                                | ✅ 14/14 | Components + hooks                   |
| Backend typecheck                                                  | ✅ clean |                                      |
| Frontend typecheck                                                 | ✅ clean |                                      |
| Vite production build                                              | ✅       | One chunk-size warning, not blocking |

**Phase 9 IRON RULE re-verify:** 7/7 unit + 3/3 regression tests — all pass. ✅

---

## Local verification required (cannot run in CI)

These §14 acceptance items need the repo owner to verify on a real machine:

### 1. Playwright E2E + axe-core

```bash
# Install Playwright browser (once)
npm run playwright:install

# Run E2E suite against dev server
cd frontend && npm run dev &    # start Vite
cd backend && npm run dev &     # start Express (with local .env)
npm run test:e2e                # run Playwright specs
```

Expected: all specs pass, 0 axe-core serious/critical violations.

### 2. `docker compose up` offline smoke test

```bash
# Build on a connected machine
docker compose build
docker tag neo-fiber-app:latest neo-fiber-app:v1.0.0

# Save to tarball
docker save neo-fiber-app:v1.0.0 postgis/postgis:16-3.4-alpine \
  | gzip > neo-fiber-v1.0.0.tar.gz

# Simulate offline: load and run with no internet
gunzip -c neo-fiber-v1.0.0.tar.gz | docker load
# Start with only the DB connected (no external network):
docker compose up -d

# Verify
curl http://localhost:5000/api/v1/health
# Expected: {"status":"ok","db":"ok",...}

open http://localhost:5000
# Expected: login page loads with self-hosted fonts, map tiles work
```

### 3. FCP ≤ 2.5 s (§14 acceptance)

On a stock corporate laptop, cold cache:

```bash
# Using Chrome DevTools Network tab, throttle to Fast 3G, clear cache
# Navigate to http://localhost:5000/map
# Check First Contentful Paint in Performance panel
```

### 4. Alarm → visual update ≤ 15 s (§14 acceptance)

On the deployment host with real DWH:

```bash
# Insert a test alarm row directly into the DWH (or wait for a real cut)
# Observe the map ticker updates within 15 s
# Observe topology colors update if FIBER_CUT_ALARM_NAME matches
```

---

## What Phase 9 built

| File                               | What it does                                                       |
| ---------------------------------- | ------------------------------------------------------------------ |
| `playwright.config.ts`             | Playwright config: Chromium, dev server, HTML report               |
| `tests/e2e/fixtures.ts`            | API mock helper — all backend routes mocked via page.route()       |
| `tests/e2e/login.spec.ts`          | Login flow, auth guard, axe-core WCAG 2.2 AA                       |
| `tests/e2e/map-cut.spec.ts`        | Map aria roles, KPI panel, ticker, mobile block, axe-core          |
| `tests/e2e/detail-modal.spec.ts`   | Dialog aria, Esc-close, axe-core with modal open                   |
| `tests/e2e/offline-bundle.spec.ts` | Air-gap checks: no CDN fonts/scripts, self-hosted tiles            |
| `Dockerfile`                       | 3-stage: frontend-build → backend-build → runtime (non-root, tini) |
| `docker-compose.yaml`              | Production compose: app + app-db (PostGIS)                         |
| `backend/src/app.ts`               | Added: serve frontend/dist in NODE_ENV=production + SPA catch-all  |
| `README.md`                        | Offline build flow, deployment runbook, env var reference          |
| `package.json`                     | Root: @playwright/test + @axe-core/playwright                      |

---

## Next phases

Per DESIGN.md §28, v1.0 is shipped. Remaining phases are v1.5+:

- **Phase 10** — Dashboard with real DWH aggregations (no mock data)
- **Phase 11** — Topology editor + alternate paths + CSV import + audit
- **Phase 12** — Polish after real usage (only after director uses v1.0 during a real cut)

**Before starting Phase 10,** complete local verification above (especially the `docker compose up` offline test and Playwright E2E run).

when i tested the frontend while being in the isolated environment from the internet and reaching the dwh the map page showed me this with an error

Something went wrong
An unexpected error occurred. Reloading the page will usually fix it.

The requested module '/@fs/D:/BI/Research & Projects/Neo-Fiber/neo-fiber/frontend/node_modules/maplibre-gl/dist/maplibre-gl.js?v=d8137482' does not provide an export named 'default'

also a fix needed in the dashboard and other pages, you are using 7/30/90 days filter only, add additional one to be able to select a customized date for any period

this is backend feed from using the map while connected to the dwh

{"level":30,"time":"2026-05-20T13:40:28.307Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"65db0acb-e9cc-4e2c-bb38-46896887f601","route":"GET /api/v1/dashboard/regions","status":200,"duration_ms":5024,"msg":"GET /api/v1/dashboard/regions"}
{"level":30,"time":"2026-05-20T13:40:37.802Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"9693e088-040f-440b-9143-542531782c05","route":"GET /api/v1/dashboard/recurring","status":200,"duration_ms":14524,"msg":"GET /api/v1/dashboard/recurring"}
{"level":30,"time":"2026-05-20T13:40:37.814Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"e82a9b5b-f7b2-41e5-8542-53144ac53ec8","route":"GET /api/v1/dashboard/alarms","status":200,"duration_ms":14541,"msg":"GET /api/v1/dashboard/alarms"}
{"level":30,"time":"2026-05-20T13:40:41.462Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"206252df-e2ec-4a19-83a9-f4d92c0c482f","route":"GET /api/v1/dashboard/alarms","status":200,"duration_ms":1196,"msg":"GET /api/v1/dashboard/alarms"}
{"level":30,"time":"2026-05-20T13:40:41.793Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"a32b9ee5-e432-4373-ba3c-8648a84834c7","route":"GET /api/v1/dashboard/recurring","status":200,"duration_ms":1520,"msg":"GET /api/v1/dashboard/recurring"}
{"level":30,"time":"2026-05-20T13:40:43.100Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"f8c77c18-8853-4559-a9b8-272380c6d647","route":"GET /api/v1/dashboard/summary","status":200,"duration_ms":19842,"msg":"GET /api/v1/dashboard/summary"}
{"level":30,"time":"2026-05-20T13:40:50.554Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"dd38420d-61d9-45cc-8bc1-068a24fe494c","route":"GET /api/v1/dashboard/alarms","status":200,"duration_ms":1322,"msg":"GET /api/v1/dashboard/alarms"}
{"level":30,"time":"2026-05-20T13:40:50.714Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"b52f6162-6096-492d-8c2a-c381a7607235","route":"GET /api/v1/dashboard/recurring","status":200,"duration_ms":1478,"msg":"GET /api/v1/dashboard/recurring"}
{"level":30,"time":"2026-05-20T13:40:55.474Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"2397a415-abbd-4ba7-b1c3-b763aa8d443d","route":"GET /api/v1/dashboard/recurring","status":200,"duration_ms":1842,"msg":"GET /api/v1/dashboard/recurring"}
{"level":30,"time":"2026-05-20T13:40:55.477Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"d3bcf42a-a00f-485d-890b-05ee89ba7bd8","route":"GET /api/v1/dashboard/alarms","status":200,"duration_ms":1852,"msg":"GET /api/v1/dashboard/alarms"}
{"level":30,"time":"2026-05-20T13:40:55.479Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"b1097ae0-68e5-47b8-bdc2-1a84f3257297","route":"GET /api/v1/dashboard/regions","status":200,"duration_ms":1842,"msg":"GET /api/v1/dashboard/regions"}
{"level":30,"time":"2026-05-20T13:41:00.776Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"b7bd0519-2b34-4a23-9190-e70bead8e97e","route":"GET /api/v1/dashboard/summary","status":200,"duration_ms":7162,"msg":"GET /api/v1/dashboard/summary"}
{"level":30,"time":"2026-05-20T13:41:14.100Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"e34187f7-243d-413d-95c2-2ed9ec0f597a","route":"GET /api/v1/dashboard/alarms","status":200,"duration_ms":1315,"msg":"GET /api/v1/dashboard/alarms"}
{"level":30,"time":"2026-05-20T13:41:14.278Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"4da21fb6-683e-4102-b49f-f02a1627ab1a","route":"GET /api/v1/dashboard/recurring","status":200,"duration_ms":1489,"msg":"GET /api/v1/dashboard/recurring"}
{"level":30,"time":"2026-05-20T13:41:14.621Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"c3d45d73-09fe-4f79-8197-5d2aa01c696f","route":"GET /api/v1/dashboard/regions","status":200,"duration_ms":1257,"msg":"GET /api/v1/dashboard/regions"}
{"level":30,"time":"2026-05-20T13:41:15.944Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"660e393e-54b8-45e5-a90a-a9a3e489a577","route":"GET /api/v1/dashboard/fiber","status":200,"duration_ms":5,"msg":"GET /api/v1/dashboard/fiber"}
{"level":30,"time":"2026-05-20T13:41:18.201Z","pid":11360,"hostname":"KHCMS-INT-IT-04","request_id":"170e6807-5aa8-4c36-9339-187a9d45836f","route":"GET /api/v1/dashboard/regions","status":200,"duration_ms":1174,"msg":"GET /api/v1/dashboard/regions"}

when i tried to login using my ldap connection i got this error

Login server unreachable — contact admin
while local auth was false
and this is from the backend cmd:
te":"POST /api/v1/auth/login","err":"client destroyed","msg":"LDAP unreachable during login"}
{"level":40,"time":"2026-05-20T13:46:29.140Z","pid":25968,"hostname":"KHCMS-INT-IT-04","request_id":"b679bffb-edc4-4965-885d-f4865ddabd98","route":"POST /api/v1/auth/login","error_code":"LDAP_UNREACHABLE","details":{},"msg":"Login server unreachable ΓÇö contact admin"}
{"level":30,"time":"2026-05-20T13:46:29.140Z","pid":25968,"hostname":"KHCMS-INT-IT-04","request_id":"b679bffb-edc4-4965-885d-f4865ddabd98","route":"POST /api/v1/auth/login","status":503,"duration_ms":214,"msg":"POST /api/v1/auth/login"}
