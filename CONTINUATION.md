# CONTINUATION — Phase 3 complete; Phase 4 ready

**Branch:** `claude/issue-10-20260520-0537`
**Phases completed:** Phase 2 (Auth) + Phase 3 (DWH poller + alarm resolver + event bus)
**Date written:** 2026-05-20
**Status:** All unit tests green. Integration tests require Docker locally (see below).

---

## Test results summary (as of 2026-05-20)

| Suite | Result | Notes |
|---|---|---|
| `src/services/dwh/__tests__/alarm-resolver.test.ts` | ✅ 10/10 | Phase 3 — alarm resolver |
| `src/services/dwh/__tests__/poller.test.ts` | ✅ 7/7 | Phase 3 — poller (backoff test bug fixed) |
| `tests/unit/auth/jwt.test.ts` | ✅ 4/4 | Phase 2 — JWT sign/verify |
| `tests/integration/auth.test.ts` | ⏭ 11 skipped | Needs Docker Desktop running (testcontainers) |
| `tests/integration/health.test.ts` | ⏭ 6 skipped | Needs Docker Desktop running (testcontainers) |

**Why integration tests skip:** testcontainers requires Docker to spin up a real
PostgreSQL container. If Docker Desktop is not running on your machine, all
integration tests skip with `Could not find a working container runtime strategy`.

**Fix:** start Docker Desktop, then re-run `npm test`. All integration tests should pass.

---

## What was fixed in this session

### Poller backoff test bug (poller.test.ts line 266–272)

**Root cause:** `vi.runOnlyPendingTimersAsync()` fires *all* timers currently in
the queue regardless of remaining delay — not just elapsed ones. After
`advanceTimersByTimeAsync(1_000)` fired the 1s retry and queued the 2s retry,
calling `runOnlyPendingTimersAsync()` immediately fired the 2s retry too,
producing 3 query calls when only 2 were expected.

**Fix:** removed the two redundant `runOnlyPendingTimersAsync()` calls that
followed `advanceTimersByTimeAsync(...)`. `advanceTimersByTimeAsync` already
awaits the full async tick before returning, so the extra call is both wrong and
unnecessary.

---

## Phase 2 — what was built

| File | What it does |
|------|-------------|
| `backend/src/auth/ldap.ts` | LDAP bind via ldapjs; UPN format; LdapUnreachableError + LdapInvalidCredentialsError |
| `backend/src/auth/jwt.ts` | Sign + verify with HS256; 8h TTL from JWT_TTL_SECONDS |
| `backend/src/auth/bcrypt.ts` | Local fallback; constant-time compare; AUTH_LOCAL_ONLY gate |
| `backend/src/middleware/auth.ts` | requireAuth middleware; attaches req.user |
| `backend/src/routes/auth.ts` | POST /login, POST /logout, GET /me |
| `backend/src/db/migrations/0002_users_password_hash.sql` | Adds password_hash to users table |
| `backend/tests/unit/auth/jwt.test.ts` | JWT sign/verify unit tests (4 cases) |
| `backend/tests/integration/auth.test.ts` | Auth route integration tests (11 cases, AUTH_LOCAL_ONLY) |

**Deferred to local verification (needs real LDAP + environment):**
- Real LDAP bind against `ldap.sd.zain.com`
- LDAP unreachable scenario: `LDAP_URL=ldap://127.0.0.1:9999 npm run dev` → 503 `LDAP_UNREACHABLE`
- Actual 8-hour token expiry kick

---

## Phase 3 — what was built

| File | What it does |
|------|-------------|
| `backend/src/services/dwh/poller.ts` | setInterval poller with cursor-based WHERE clause and exponential backoff |
| `backend/src/services/dwh/alarm-resolver.ts` | FiberlinkSite_ID → Source_NE/Sink_NE → Site_A/B_ID fallback chain (T12) |
| `backend/src/services/dwh/event-bus.ts` | In-process EventEmitter; subscribe/publish/unsubscribe |
| `backend/src/services/dwh/queries.ts` | fetchNewAlarms — raw pg query against dwh.fibergis_alarm_log |
| `backend/src/services/dwh/__tests__/alarm-resolver.test.ts` | 10 resolver unit tests covering all fallback chain variants |
| `backend/src/services/dwh/__tests__/poller.test.ts` | 7 poller unit tests including backoff, cursor, isFiberCut, stop() |

**Tasks closed:** T12

---

## Local verification commands (run on a machine with Docker + Node 20)

```bash
# 1. Start the dev database
docker compose -f docker-compose.dev.yaml up -d

# 2. Install backend dependencies
cd backend && npm install

# 3. Set up .env
cp backend/.env.example backend/.env
# Edit APP_DB_URL, DWH_URL, JWT_SECRET, AUTH_LOCAL_ONLY=true

# 4. Apply migrations
cd backend && npm run migrate

# 5. Run all tests (Docker must be running for integration tests)
npm test

# 6. Type-check
npm run typecheck

# 7. Smoke test auth locally
curl -X POST http://localhost:5000/api/v1/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"username":"testuser","password":"correct-password"}'
# → { "token": "eyJ...", "user": { ... } }
```

---

## Next step — Phase 4

Once local tests are green (Docker running, all 5 suites pass):

> Read DESIGN.md §9 reachability, §9 affected-region, §12.5 testing CRITICAL
> regression. Implement Phase 4 from §28: two-pass BFS, hull cache, and the 3
> critical regression tests. Pick test fixtures with a senior engineer — provide
> one real historical incident.

**Phase 4 starter prompt (paste into a fresh Claude Code session):**

> Read DESIGN.md §9 reachability, §9 affected-region, §12.5 testing CRITICAL regression. Implement Phase 4 from §28: two-pass BFS, hull cache, and the 3 critical regression tests. Pick test fixtures with me — I'll provide one real historical incident.

**Files Phase 4 will create:**
- `backend/src/services/topology/reachability.ts` — two-pass BFS (T1)
- `backend/src/services/topology/hull-cache.ts` — sorted-site-IDs key, 10-min eviction (T13)
- `backend/src/services/topology/affected-region.ts` — PostGIS ST_ConcaveHull + ST_Buffer
- `backend/src/services/topology/__tests__/reachability.test.ts` — 7 unit scenarios from §25 T1
- `tests/regression/backup-aware-1-cascading-false-positive.test.ts`
- `tests/regression/backup-aware-2-degraded-not-down.test.ts`
- `tests/regression/backup-aware-3-real-historical-incident.test.ts`

**IRON RULE:** all 3 regression tests must pass before v1.0. Any failure blocks the release.
