# CONTINUATION — Phase 2 Local Verification Required

**Branch:** `claude/issue-6-20260519-1739`
**Phase:** Phase 2 — Auth (LDAP + JWT + 8h kick)
**Date written:** 2026-05-19
**Status:** Code complete; `npm install` and tests could NOT run in CI (see below).

---

## Why tests didn't run in CI

The GitHub Actions runner does not allow `npm install` without explicit approval
in `.claude/settings.json`. The `node_modules/` directory is empty, so Vitest
cannot execute.

**To fix for future Claude sessions:** add `"Bash(npm *)"` to
`.claude/settings.json` allow list. A human must edit `.claude/settings.json`
since Claude Code write-protects it from automated changes.

---

## Exact commands to run locally (Phase 2 verification)

Run from the repo root on a machine with Docker + Node 20 installed:

```bash
# 1. Install backend dependencies (includes Phase 2 additions: bcrypt, jsonwebtoken, ldapjs)
cd backend
npm install

# 2. Start the dev database (if not already running from Phase 1)
cd ..
docker compose -f docker-compose.dev.yaml up -d
# Wait: docker compose -f docker-compose.dev.yaml ps

# 3. Configure .env (copy from example)
cp backend/.env.example backend/.env
# Edit backend/.env:
#   APP_DB_URL=postgres://neo_fiber:neo_fiber_dev@localhost:5432/neo_fiber
#   DWH_URL=<your DWH connection string>
#   JWT_SECRET=<openssl rand -hex 32>
#   LDAP_URL=ldap://ldap.sd.zain.com          # real LDAP for prod test
#   AUTH_LOCAL_ONLY=true                       # use this for local dev without LDAP

# 4. Apply migrations (includes new 0002_users_password_hash.sql)
cd backend && npm run migrate

# 5. Run the full test suite
npm test
# Expected: all tests pass — includes:
#   - JWT unit tests (sign, verify, expired, malformed, wrong-secret)
#   - Auth integration tests (login, logout, /me) using testcontainers + AUTH_LOCAL_ONLY=true
#   - Phase 1 health + schema tests still pass

# 6. Type-check
npm run typecheck

# 7. Verify POST /login with curl (LDAP path — requires real LDAP):
#    curl -X POST http://localhost:5000/api/v1/auth/login \
#         -H 'Content-Type: application/json' \
#         -d '{"username":"youruser","password":"yourpass"}'
#    # → { "token": "eyJ...", "user": { "id": 1, "username": "youruser", ... } }
#
#    TOKEN=$(curl -s -X POST http://localhost:5000/api/v1/auth/login \
#         -H 'Content-Type: application/json' \
#         -d '{"username":"youruser","password":"yourpass"}' | jq -r .token)
#
#    curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/v1/auth/me
#    # → { "user": { ... } }
#
# 8. Verify 401 on expired token:
#    JWT_TTL_SECONDS=5 npm run dev
#    # login, wait 6 seconds, hit /me → 401 UNAUTHENTICATED
```

---

## Deferred to local verification (per §12.5)

- Real LDAP bind against `ldap.sd.zain.com` (not reachable from CI)
- LDAP unreachable scenario: `LDAP_URL=ldap://127.0.0.1:9999 npm run dev` → login
  should return 503 with `"LDAP_UNREACHABLE"` code
- Actual 8-hour token expiry kick (test uses TTL=1s; production uses TTL=28800)

---

## What Phase 2 built

| File | What it does |
|------|-------------|
| `backend/src/auth/ldap.ts` | LDAP bind via ldapjs; UPN format; LdapUnreachableError + LdapInvalidCredentialsError |
| `backend/src/auth/jwt.ts` | Sign + verify with HS256; 8h TTL from JWT_TTL_SECONDS |
| `backend/src/auth/bcrypt.ts` | Local fallback; constant-time compare; AUTH_LOCAL_ONLY gate |
| `backend/src/middleware/auth.ts` | requireAuth middleware; attaches req.user |
| `backend/src/routes/auth.ts` | POST /login, POST /logout, GET /me |
| `backend/src/db/migrations/0002_users_password_hash.sql` | Adds password_hash to users table |
| `backend/tests/unit/auth/jwt.test.ts` | JWT sign/verify unit tests (4 cases) |
| `backend/tests/integration/auth.test.ts` | Auth route integration tests (9 cases, AUTH_LOCAL_ONLY) |

---

## Next step (Phase 3)

Once local verification passes (tests green, type-check clean, curl output as above):

> Read DESIGN.md §9 real-time architecture, §7 premise 8 (FIBER_CUT_ALARM_NAME),
> §21 reuse map (alarm.service.js). Implement Phase 3 from §28:
> DWH poller + alarm resolver + event bus.

Also: update `.claude/settings.json` to add `"Bash(npm *)"` to the allow list
so future Claude sessions can run npm install without blocking.



update: from me the developer:
i ran npm install and then npm test in the backend and got this result from the tests



 RUN  v3.2.4 N:/backend

 ✓ src/services/dwh/__tests__/alarm-resolver.test.ts (10 tests) 15ms
 ❯ src/services/dwh/__tests__/poller.test.ts (7 tests | 1 failed) 2151ms
   ✓ DwhPoller > publishes alarm event on first tick  2140ms
   ✓ DwhPoller > isFiberCut=false when alarm name does not match 1ms
   ✓ DwhPoller > isFiberCut=false when fiberCutAlarmName is empty string (safe default) 1ms        
   ✓ DwhPoller > resolvedLinkId=null for unresolvable alarm row 1ms
   ✓ DwhPoller > advances lastSeen cursor to prevent re-publishing 1ms
   × DwhPoller > uses exponential backoff: 1s → 2s → reset on success 4ms
     → expected "spy" to be called 2 times, but got 3 times
   ✓ DwhPoller > stop() halts polling — no further ticks after stop 1ms
 ✓ tests/unit/auth/jwt.test.ts (4 tests) 3268ms
   ✓ signToken / verifyToken > signs a token that can be verified  2140ms
   ✓ signToken / verifyToken > throws on an expired token (TTL=1s)  1118ms
 ❯ tests/integration/auth.test.ts (11 tests | 11 skipped) 106ms
   ↓ POST /api/v1/auth/login > returns 400 for empty username
   ↓ POST /api/v1/auth/login > returns 400 for username with spaces
   ↓ POST /api/v1/auth/login > returns 400 for missing password
   ↓ POST /api/v1/auth/login > returns 401 for wrong password
   ↓ POST /api/v1/auth/login > returns 401 for unknown user
   ↓ POST /api/v1/auth/login > returns 200 with token + user for valid credentials
   ↓ POST /api/v1/auth/logout > returns 200 with message
   ↓ GET /api/v1/auth/me > returns 401 with no token
   ↓ GET /api/v1/auth/me > returns 401 with malformed token
   ↓ GET /api/v1/auth/me > returns 401 with expired token
   ↓ GET /api/v1/auth/me > returns 200 with user data for a valid token
 ❯ tests/integration/health.test.ts (6 tests | 6 skipped) 103ms
   ↓ GET /api/v1/health > returns 200 with connected status when both pools are up
   ↓ GET /api/v1/health > returns 404 for unknown routes
   ↓ Schema migration > creates expected tables
   ↓ Schema migration > sites table has is_root column (T2)
   ↓ Schema migration > sites table starts empty (no pre-seeded root — Phase 0 Q1)
   ↓ Schema migration > postgis extension is enabled

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Suites 2 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/integration/auth.test.ts [ tests/integration/auth.test.ts ]
Error: Could not find a working container runtime strategy
 ❯ getContainerRuntimeClient D:/BI/Research & Projects/Neo-Fiber/neo-fiber/backend/node_modules/testcontainers/src/container-runtime/clients/client.ts:63:9
 ❯ PostgreSqlContainer.start D:/BI/Research & Projects/Neo-Fiber/neo-fiber/backend/node_modules/testcontainers/src/generic-container/generic-container.ts:86:20
 ❯ PostgreSqlContainer.start D:/BI/Research & Projects/Neo-Fiber/neo-fiber/backend/node_modules/@testcontainers/postgresql/src/postgresql-container.ts:49:43
 ❯ tests/integration/auth.test.ts:27:15

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  tests/integration/health.test.ts [ tests/integration/health.test.ts ]
Error: Could not find a working container runtime strategy
 ❯ getContainerRuntimeClient D:/BI/Research & Projects/Neo-Fiber/neo-fiber/backend/node_modules/testcontainers/src/container-runtime/clients/client.ts:63:9
 ❯ PostgreSqlContainer.start D:/BI/Research & Projects/Neo-Fiber/neo-fiber/backend/node_modules/testcontainers/src/generic-container/generic-container.ts:86:20
 ❯ PostgreSqlContainer.start D:/BI/Research & Projects/Neo-Fiber/neo-fiber/backend/node_modules/@testcontainers/postgresql/src/postgresql-container.ts:49:43
 ❯ tests/integration/health.test.ts:30:15

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯


⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/services/dwh/__tests__/poller.test.ts > DwhPoller > uses exponential backoff: 1s → 2s → reset on success
AssertionError: expected "spy" to be called 2 times, but got 3 times
 ❯ src/services/dwh/__tests__/poller.test.ts:268:27

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯


 Test Files  3 failed | 2 passed (5)
      Tests  1 failed | 20 passed | 17 skipped (38)
   Start at  22:18:01
   Duration  47.97s (transform 535ms, setup 0ms, collect 93.29s, tests 5.64s, environment 3ms, prepare 4.55s)
