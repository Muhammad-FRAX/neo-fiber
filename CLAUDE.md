# Neo-Fiber — agent guide

This file is loaded into every Claude Code session in this repo. Read it before
doing anything. The detailed plan lives in [DESIGN.md](DESIGN.md); this file is the
*how to work* layer on top.

---

## What this is

A rebuild of the Zain Sudan fiber-optics monitoring tool. The wedge: a director
gets a WhatsApp ping about a cut, opens `/map`, and sees the impact in under 30
seconds without making a phone call. Read [DESIGN.md §1-§5](DESIGN.md) once at the start
of any new session for full context.

Old broken version lives in [old-website/](old-website/). **Do NOT port it
wholesale** — see DESIGN.md §21 for the explicit reuse map (what to port, what to
drop). Notably: drop Neo4j, drop the mock dashboard, drop the hardcoded dashed line
in MapView.js.

---

## How to work in this repo

Execution is phased. Phases are in [DESIGN.md §28](DESIGN.md). Each phase has its
own starter prompt — paste it into a fresh Claude Code session and follow only that
phase. Do NOT try to build the whole project in one session; you'll run out of
context, lose the design constraints, and ship sloppy work.

### Phase workflow (per phase)

1. Open the phase in `DESIGN.md §28`. Read ONLY the listed "Read first" sections.
2. Invoke the right skill (see Skill routing below) before writing code.
3. Build the listed files. Use TDD — tests first when a function has meaningful
   branches.
4. Run the listed verification step. If green, commit. If red, fix in the same
   session while context is still warm.
5. Stop. Don't roll into the next phase the same session — start fresh.

**Suggested cadence:** one phase per session, ~10-14 sessions to v1.0.

---

## Skill routing

Invoke skills via the `Skill` tool. When the request matches a skill, USE it.

### Frontend design work → invoke `impeccable`

For Phase 7 (frontend scaffold), Phase 8 (map page), Phase 10 (dashboard),
Phase 11 (admin), and any UI polish — invoke `impeccable` BEFORE writing
component code. `impeccable` handles the design refinement: visual hierarchy,
spacing, typography, motion, micro-interactions, edge cases, anti-AI-slop
guards. Give it the DESIGN.md sections for the screen you're building (§10
layout, §10.5 states, §11 visual direction + tokens, §11.5 responsive + a11y).

Specifically use `impeccable` when:
- Designing a new screen or component for the first time
- Making something feel premium / less generic
- Auditing whether a UI matches the locked design tokens
- Adding motion or micro-interactions
- Fixing visual hierarchy or alignment issues

### Implementation work → use the `superpowers:` skills

The superpowers skills are the implementation toolkit. The most useful ones here:

| Skill | Use it when |
|---|---|
| `superpowers:writing-plans` | Before a non-trivial phase. Write the plan, get it reviewed, then execute. |
| `superpowers:executing-plans` | Executing a written plan with checkpoints. Default for most phases. |
| `superpowers:test-driven-development` | Phase 4 (reachability, MANDATORY — IRON RULE on regression suite), and any other branching logic. Tests first. |
| `superpowers:subagent-driven-development` | When a phase's tasks are independent (e.g., several REST endpoints in Phase 6). |
| `superpowers:dispatching-parallel-agents` | When DESIGN.md §24 shows two lanes can run in parallel and you have worktrees. |
| `superpowers:using-git-worktrees` | Before splitting work across parallel agents. |
| `superpowers:systematic-debugging` | When verification fails. No "guess-and-check" debugging. |
| `superpowers:verification-before-completion` | Always, before claiming a phase done. The §14 acceptance checklist in DESIGN.md is the bar. |
| `superpowers:requesting-code-review` | Before merging a phase branch to main. |
| `superpowers:receiving-code-review` | When acting on review feedback. |
| `superpowers:finishing-a-development-branch` | Closing out a phase. |

### Other repo skills

- `/office-hours`, `/plan-eng-review`, `/plan-design-review` — already done.
  Their outputs are baked into DESIGN.md. Do NOT re-run unless the design
  fundamentally changes.
- `/ship` — once you have a working git remote, use this to land a phase branch.
- `/qa` — after Phase 8 and 9 for QA passes on the live app.
- `/investigate` — for any bug. Iron law: find root cause, don't patch symptoms.

---

## Non-negotiables (will break the project if forgotten)

These come from the eng + design reviews already applied to DESIGN.md.

1. **Air-gapped.** No CDN fonts, no Mapbox/Google tiles, no remote icons, no
   third-party telemetry, no inline `<script src="https://...">`. **Every asset
   ships in the Docker image.** Verify in Phase 9 with a no-internet
   `docker compose up`.
2. **No mock data anywhere.** The old site died because the dashboard was 16
   hardcoded cards. Every number on every screen must trace to a real Postgres
   aggregation. Especially in `/dashboard` (Phase 10). If you find yourself
   typing `78.31%` in JSX, stop and write the SQL.
3. **Backup-aware status: green / amber / red, NOT green / red.** A site whose
   MAIN link is down but BACKUP is up is `DEGRADED` (amber), not `DOWN` (red).
   This is the IRON RULE regression suite in §12.5. Three known incidents must
   pass before v1.0 ships.
4. **Two-pass BFS reachability, not all-paths enumeration.** Found in eng
   review A1. All-paths is exponential on cyclic graphs and answers the wrong
   question. See [DESIGN.md §9 backup-aware reachability](DESIGN.md).
5. **Drop Neo4j entirely.** Postgres + PostGIS is the single source of truth.
   Topology lives in `sites`, `devices`, `links`, `alternate_paths` tables.
   Don't be tempted to "keep Neo4j for the graph parts" — that's how
   distributed-system bugs get born.
6. **SSE push, not polling.** The client never polls the app. The only polling
   in the system is the server's DWH poller (we can't avoid that — DWH is
   external and won't push to us). The client uses `EventSource` against
   `/api/v1/stream/alarms` and `/api/v1/stream/topology`.
7. **`localStorage` JWT, no refresh token, hard kick on expiry.** Decided in
   A4. Don't add silent re-auth without re-opening the decision.
8. **`FIBER_CUT_ALARM_NAME` env var filters topology recompute.** The DWH has
   many alarm types; only one specific name represents a fiber cut. All other
   alarms still flow to the ticker and dashboard, but they don't trigger
   reachability. Empty env var = no alarm triggers recompute (safe default).
9. **No 3-column equal-weight KPI card grid on the dashboard.** That's the
   textbook AI-slop pattern. Use the hero-KPI + supporting-strip + data-tables
   pattern from [DESIGN.md §11](DESIGN.md). Locked in P4A.
10. **Desktop-only for v1.0.** Viewport `< 1024px` shows a polite block screen.
    Mobile is explicit v2.0 scope. Don't try to be helpful and add responsive
    behavior in v1.0 — it'll be half-broken.
11. **A11y is mandatory in v1.0.** WCAG 2.2 AA, axe-core in Playwright CI,
    keyboard nav for every interactive element, hidden `<table>` mirror of the
    map for screen readers (canvas is invisible to AT). See §11.5.

---

## Stack quick-reference

Don't memorize — when you need the why, read DESIGN.md §9. When you just need to
know what to import:

**Frontend** (`frontend/`): Vite 7, React 19, Tailwind v4 (`@tailwindcss/vite`),
shadcn/ui + Radix, lucide-react, Recharts, TanStack Query v5, `nuqs` for URL state,
Zustand for ephemeral UI state, React Router v7, MapLibre GL JS + PMTiles,
date-fns. Inter + JetBrains Mono fonts, self-hosted woff2.

**Backend** (`backend/`): Node 20, Express 5 (ESM), Helmet, express-rate-limit,
CORS, `pg` (TWO pools — `dwhPool` read-only, `appPool` read-write), Drizzle ORM for
app DB only (raw `pg` for DWH SELECTs), ldapjs, jsonwebtoken, bcrypt, Zod,
`@asteasolutions/zod-to-openapi`, Pino, native SSE.

**Databases:** existing DWH Postgres (read-only, `dwh.fibergis_alarm_log` view) +
new app Postgres (`postgis/postgis:16-3.4-alpine`).

**Testing:** Vitest (unit + frontend), Supertest (HTTP), Playwright (E2E),
testcontainers-postgres (DB integration). Real PostGIS in tests, NEVER mock the DB.

---

## Docker timing (the question you might be asking)

**Phase 1 ships `docker-compose.dev.yaml`** — just the `app-db` Postgres+PostGIS
service. You can't develop against PostGIS without it. The app itself runs locally
via `npm run dev`.

**Phase 9 ships the production `Dockerfile` + `docker-compose.yaml`** — multi-stage
build, frontend bundled in, PMTiles as the last COPY layer, runs as non-root `node`
user, supports `docker save | docker load` for offline transport.

Don't build the production Dockerfile early. It's pointless — there's nothing to
ship until the app actually does something, and you'll burn time maintaining it
through every phase. The dev compose file is enough to develop against.

---

## Commit conventions

- **Small, atomic commits.** One logical change per commit. Don't bundle
  unrelated work.
- **No co-authorship.** Per the repo owner's preference, do NOT add yourself
  (Claude / any AI) as a Co-Authored-By. Commits are authored solely by Mohamed.
- **Conventional-ish prefixes** are fine but not required: `feat:`, `fix:`,
  `chore:`, `test:`, `docs:`. Match what's already in the log.
- **Reference the DESIGN.md decision** in non-trivial commits (e.g., "implement
  two-pass BFS reachability (A1 / DESIGN.md §9)"). The audit trail matters
  later.

---

## Testing conventions

- **TDD for branching logic.** Phase 4 reachability is mandatory TDD (regression
  IRON RULE). Other phases: TDD when a function has 3+ branches.
- **Tests live alongside code.** `foo.ts` + `foo.test.ts` in the same folder.
- **No DB mocking.** Use testcontainers for integration tests against real
  PostGIS. The few extra seconds in CI are worth not shipping bugs PostGIS
  divergence hides.
- **Coverage target:** ≥80% line coverage for backend (CI-enforced), ≥60% for
  frontend.
- **Axe-core in every Playwright E2E.** Fails CI on serious or critical
  violations.

---

## What NOT to do

- **Don't port from `old-website/` blindly.** §21 has the explicit reuse map.
  Everything else is to be re-derived. The old code has bugs that we know about
  (Neo4j naive propagation, hardcoded dashed line, mock dashboard) and bugs we
  don't.
- **Don't add a feature that's not in DESIGN.md without updating DESIGN.md
  first.** Scope creep is the #1 way solo projects die. If you find a real gap,
  update the relevant section in DESIGN.md, then build it.
- **Don't re-run `/office-hours`, `/plan-eng-review`, or `/plan-design-review`
  on the current design** unless the foundations have changed. They're done.
- **Don't introduce a new dependency without naming it in DESIGN.md §9.** The
  stack is locked. Adding a dep without recording it makes handoff harder later.
- **Don't ship without running the §14 acceptance checklist.** Especially the
  no-internet `docker compose up` test in Phase 9 — that's the one that catches
  air-gap regressions.

---

## When in doubt

1. Read the relevant DESIGN.md section.
2. If the section doesn't have the answer, the decision hasn't been made yet —
   surface it as an AskUserQuestion to the repo owner. Don't guess.
3. If the section has the answer but you think it's wrong: say so explicitly,
   explain why, propose an alternative. Don't silently go around it.

---

## File map

```
DESIGN.md                  # source of truth — what to build, why, in what order
CLAUDE.md                  # this file — how to work in the repo
README.md                  # public-facing, kept short
old-website/               # the broken predecessor, read-only reference
  ├── backend/             # port per DESIGN.md §21 (alarm.service.js, db.js, LDAP)
  └── src/                 # don't port — UI is being redone from scratch
frontend/                  # Vite + React 19, scaffolded
backend/                   # Express 5 ESM, scaffolded
Dockerfile                 # empty stub — finalized in Phase 9
docker-compose.yaml        # empty stub — finalized in Phase 9
docker-compose.dev.yaml    # created in Phase 1 — local dev DB only
```
