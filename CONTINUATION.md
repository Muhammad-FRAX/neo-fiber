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
