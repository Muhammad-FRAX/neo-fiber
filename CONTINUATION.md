# CONTINUATION — Phase 1 Local Verification Required

**Branch:** `claude/issue-4-20260519-1711`
**Phase:** Phase 1 — Backend skeleton + DB tooling
**Date written:** 2026-05-19
**Status:** Code complete; npm install and tests could NOT run in CI (see below).

---

## Why tests didn't run in CI

The GitHub Actions runner that executed this PR does not have `npm install`
in its allowed-tools list (`.claude/settings.json` controls which Bash commands
Claude Code can run without user approval). The npm/npx binaries are
blocked by this session's security policy.

**To fix for future Claude sessions:** add `"Bash(npm *)"` to
`.claude/settings.json` allow list. The file at `.claude/settings.json` is
write-protected from the Claude Code session — a human must edit it.

---

## Exact commands to run locally (Phase 1 verification)

Run from the repo root on a machine with Docker installed:

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Start the dev database
cd ..
docker compose -f docker-compose.dev.yaml up -d
# Wait for healthy: docker compose -f docker-compose.dev.yaml ps

# 3. Copy and configure env
cp backend/.env.example backend/.env
# Edit backend/.env:
#   APP_DB_URL=postgres://neo_fiber:neo_fiber_dev@localhost:5432/neo_fiber
#   DWH_URL=<your DWH connection string>   # or same as APP_DB_URL for initial test
#   JWT_SECRET=<openssl rand -hex 32>

# 4. Apply migrations
cd backend && npm run migrate
# Expected output:
#   applying: 0001_init.sql
#   applied:  0001_init.sql
#   Migration complete.

# 5. Start the server
npm run dev
# Expected: {"level":"info","port":5000,"node_env":"development","msg":"Server started"}

# 6. Test the health endpoint
curl http://localhost:5000/api/v1/health
# Expected: {"status":"ok","app_db":"connected","dwh":"connected"}
# (dwh will be "error" if DWH_URL doesn't point to a reachable server)

# 7. Run the integration test suite (uses testcontainers — Docker required)
npm test
# Expected: 6 tests pass (health endpoint + schema assertions)

# 8. Type-check
npm run typecheck
# Expected: no errors

# 9. Roll back (optional sanity check)
npm run migrate:down
# Expected:
#   rolling back: 0001_init.sql
#   rolled back:  0001_init.sql
#   Rollback complete.
```

---

## Deferred to local verification (per §12.5)

The following §14 acceptance bullets require local access and are NOT gates
for this PR's CI run:

- `docker compose up` on a no-internet machine (Phase 9)
- Real DWH connectivity (`DWH_URL` pointing to `172.18.x.x`)
- LDAP connectivity (`LDAP_URL` pointing to `ldap.sd.zain.com`)
- `npm run dev` auto-watching TS changes with `tsx watch`

---

## Next step (Phase 2)

Once local verification passes, start Phase 2:

> Read DESIGN.md §9 auth row, §10 IA (login layout), §21 reuse map
> (LDAP code in old-website/server.js). Implement Phase 2 from §28.

Also: update `.claude/settings.json` to add `"Bash(npm *)"` to the
allow list so future Claude sessions can run npm install without blocking.
