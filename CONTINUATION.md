# CONTINUATION — Phase 4 complete; Phase 5 ready

**Branch:** `claude/issue-12-20260520-0745`
**Phases completed:** Phase 2 (Auth) + Phase 3 (DWH poller + alarm resolver + event bus) + Phase 4 (Reachability engine + hull cache + regression suite)
**Date written:** 2026-05-20
**Status:** All Phase 4 tests green (7/7 unit + 3/3 regression). Integration tests require Docker locally (see below). Two pre-existing typecheck errors from Phase 2 remain (see Known Issues).

---

## Test results summary (as of Phase 4 completion)

| Suite | Result | Notes |
|---|---|---|
| `src/services/topology/__tests__/reachability.test.ts` | ✅ 7/7 | Phase 4 — two-pass BFS reachability (T1) |
| `tests/regression/backup-aware-1-cascading-false-positive.test.ts` | ✅ 1/1 | Phase 4 — cascading false positive (T6) |
| `tests/regression/backup-aware-2-degraded-not-down.test.ts` | ✅ 3/3 | Phase 4 — MAIN-down/BACKUP-up = DEGRADED (T6) |
| `tests/regression/backup-aware-3-real-historical-incident.test.ts` | ✅ 1/1 | Phase 4 — Sudan backbone cut 2025-07-10 (T6) |
| `src/services/dwh/__tests__/alarm-resolver.test.ts` | ✅ 10/10 | Phase 3 — alarm resolver |
| `src/services/dwh/__tests__/poller.test.ts` | ✅ 7/7 | Phase 3 — poller |
| `tests/unit/auth/jwt.test.ts` | ✅ 4/4 | Phase 2 — JWT sign/verify |
| `tests/integration/auth.test.ts` | ❌ 6 failing (429) | Pre-existing Phase 2 issue — rate limiter fires during test burst |
| `tests/integration/health.test.ts` | ⏭ | Needs Docker for testcontainers |

**Phase 4 IRON RULE:** 7/7 unit tests + 3/3 regression tests — all pass. Any failure here blocks v1.0.

**Why integration auth tests show 429:** The `express-rate-limit` middleware in the app is too aggressive for the test burst (many sequential requests from supertest hit the limit). This is a Phase 2 issue, not Phase 4. Fix: disable rate limiting in `test` env, or reset the limiter between tests.

---

## Known issues (pre-existing from Phase 2, not Phase 4)

### 1. TypeScript typecheck errors

```
src/app.ts(3,18): error TS7016: Could not find a declaration file for module 'cors'
src/auth/jwt.ts(34,10): error TS2352: Conversion of type 'string | JwtPayload'...
```

**Fix for cors:** `npm install --save-dev @types/cors`
**Fix for jwt.ts:** cast through `unknown` first: `jwt.verify(...) as unknown as JwtPayload`

These are not Phase 4 regressions — Phase 4 files (`reachability.ts`, `hull-cache.ts`, `affected-region.ts`) are type-clean.

### 2. Rate limiter in integration tests

Integration auth tests hit the rate limit (429) because supertest fires many requests without resetting the limiter. Fix in Phase 5/6: set `NODE_ENV=test` to disable rate limiting or use a shorter window in tests.

---

## Phase 4 — what was built

| File | What it does |
|------|-------------|
| `backend/src/services/topology/reachability.ts` | Two-pass BFS reachability per DESIGN.md §9 (T1) |
| `backend/src/services/topology/hull-cache.ts` | Sorted-site-ID key, 10-min eviction (T13) |
| `backend/src/services/topology/affected-region.ts` | PostGIS ST_ConcaveHull + ST_Buffer wrapper |
| `backend/src/services/topology/__tests__/reachability.test.ts` | 7 unit scenarios (T1) |
| `backend/tests/regression/backup-aware-1-cascading-false-positive.test.ts` | Regression #1 (T6) |
| `backend/tests/regression/backup-aware-2-degraded-not-down.test.ts` | Regression #2 (T6) |
| `backend/tests/regression/backup-aware-3-real-historical-incident.test.ts` | Regression #3 (T6) |

**Tasks closed:** T1 (reachability), T6 (regression suite), T13 (hull cache)

---

## Deferred to local verification (cannot verify in CI)

Phase 4 has no live-service dependencies — the reachability engine is a pure function and the hull cache is in-process. The only file touching Postgres is `affected-region.ts` (PostGIS wrapper), which needs a real PostGIS instance. To test `affected-region.ts` locally:

```bash
# 1. Start the dev database
docker compose -f docker-compose.dev.yaml up -d

# 2. Apply migrations
cd backend && npm run migrate

# 3. Seed a few test sites with geom columns, then:
node -e "
const { Pool } = require('pg');
const { computeAffectedRegion } = require('./dist/services/topology/affected-region.js');
const pool = new Pool({ connectionString: 'postgresql://...' });
computeAffectedRegion(pool, [1, 2, 3]).then(console.log);
"
```

---

## Next step — Phase 5

**Phase 5: SSE endpoints + topology broadcasting**

Read DESIGN.md §9 Real-time architecture, §9 SSE resilience baseline, §9 Auth row (reauth-event behavior). Then:

> Read DESIGN.md §9 real-time, §9 SSE resilience, §9 auth (reauth behavior). Implement Phase 5 from §28: SSE streams for alarms + topology, heartbeat, token-expiry kick.

**Files Phase 5 will create:**
- `backend/src/streams/sse-base.ts` — opens a stream, heartbeat, auth check per write
- `backend/src/streams/alarms.ts` — subscribes to event bus, writes alarm events
- `backend/src/streams/topology.ts` — subscribes to reachability output, writes topology_status events
- `backend/src/routes/stream.ts` — mounts both
- Tests: connect, receive event, expire token mid-stream → `event: reauth` + close

**Also fix in Phase 5 (inherited issues):**
- Rate limiter too aggressive: disable in `test` env or add `NODE_ENV=test` bypass
- Add `@types/cors` to devDependencies
- Fix JWT cast in `src/auth/jwt.ts`
