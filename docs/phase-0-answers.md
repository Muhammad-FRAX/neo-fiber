# Phase 0 — Human prep answers

**Date answered:** 2026-05-19
**Answered by:** Mohamed Alsiddig (repo owner)
**Phase:** DESIGN.md §28 Phase 0
**Closes:** §15 Q1-Q5, §18 director quote

This file is the canonical record of the Phase 0 deliverable. Downstream
phases (1, 3, 4, 6, 11) read from here when the answer affects code.

---

## §15 Q1 — Root site for reachability

**Answer:** Sudan has 3-4 datacenter "heads" today. Exact identities (name +
`Site_A_ID`) are NOT known yet. The app must support **N roots** and let an
operator designate **any** site as a root through the admin UI. Reachability
treats a device as UP if it can reach **any** `is_root = true` site — so
losing one or two heads still leaves the network UP for whatever the survivors
can reach.

**Implementation directives:**

- Schema: `sites.is_root BOOLEAN NOT NULL DEFAULT false` per §25 T2.
- **Seed: empty.** Do NOT hardcode "Khartoum HQ" as a default root. §25 T2
  says "seed Khartoum HQ as default root" — that is now stale. The owner
  doesn't know the exact head identities, so the seed must be empty and the
  admin topology editor (Phase 11) is responsible for marking roots.
- Admin UI: the topology editor (§10 /admin/topology, Phase 11) MUST expose
  an `is_root` toggle on each site row.
- Reachability (Phase 4 / T1): BFS from the **set** of roots, not a single
  root. The §9 spec already says "reached from ANY root" — confirmed.
- Empty-roots case is now the **expected initial state**, not an edge case.
  Reachability with zero roots returns: every device DOWN, no reachable set.
  The /map first-run empty state (§10.5) must read sensibly under this
  condition — already covered by P1B "All networks healthy" calm-day default
  needs an additional "No roots configured — add one in Admin → Topology"
  empty-state copy. **Flag for Phase 8.**

---

## §15 Q2 — DWH `OccurrenceTime` timezone

**Answer:** Use the DWH datetime as-is. No conversion at the DWH→app boundary.

**Interpretation:** The DWH stores `OccurrenceTime` in whatever timezone the
DWH was configured with (most likely Africa/Khartoum local time, since Sudan
doesn't observe DST and is UTC+2 year-round). The app reads the value, stores
it, and displays it without conversion. The user-facing time on the ticker
and modal will therefore match what an engineer sees if they query the DWH
directly — which is the right behavior for an internal Sudan-only tool.

**Implementation directives:**

- App DB column type: `TIMESTAMP WITHOUT TIME ZONE` for any column that
  mirrors DWH timestamps (e.g., `alarm_acks.dwh_occurrence_time`,
  `incidents.occurrence_time`). **Deviation from the §9 spec** which says
  "App DB stores `TIMESTAMPTZ` in UTC" — that was contingent on confirming
  UTC, which is not what we got. Adjust §9 accordingly when locking Phase 1
  migrations.
- UI display: render as-is, no `formatInTimeZone` conversion. Use `date-fns`
  `format(...)` directly on the parsed value.
- Pino logs: continue to use ISO 8601 with timezone offset for server-side
  log timestamps (those come from the Node process, not the DWH). Don't
  conflate the two.
- Phase 3 poller: `WHERE OccurrenceTime > last_seen` — compare DWH-native
  values against a DWH-native `last_seen` watermark. Store the watermark as
  `TIMESTAMP WITHOUT TIME ZONE` to match.
- If a later operator ever runs this tool outside Sudan, this decision must
  be revisited. Document the assumption in `backend/README.md` when Phase 1
  ships.

---

## §15 Q3 — LDAP reachability

**Answer:** LDAP is reachable from the air-gapped deployment server. LDAP is
**not** reachable from the GitHub Actions CI runner.

**Implementation directives:**

- Production auth (Phase 2): pure LDAP per §9. No bcrypt local-fallback path
  needed in production — keep the code simple, drop §25 T4's implied
  fallback branch.
- Tests (Phase 2): every auth integration test MUST mock LDAP via `ldapjs`'s
  test harness or by spinning up a small in-process ldapjs server (the §21
  reuse map already covers this pattern — `old-website/server.js:122-166`).
  Never reach the real LDAP from CI; it cannot resolve.
- `backend/.env.example`: keep `AUTH_LOCAL_ONLY` as documented but DEFAULT
  to `false`. The bcrypt module (`backend/src/auth/bcrypt.ts`) is still
  built — it serves as the dev/test seam, not a production fallback.
- CI workflow: needs explicit `AUTH_LOCAL_ONLY=true` env in any e2e tests
  that hit `/api/v1/auth/login` so the test harness uses bcrypt-seeded
  accounts rather than attempting an LDAP bind. Capture in Phase 2 docs.

---

## §15 Q4 — DWH new-row latency

**Answer:** 1-2 minutes between an alarm firing upstream and `dwh.fibergis_alarm_log`
having a new row.

**Implementation directives:**

- Poller cadence (Phase 3 / §9): the §9 spec implied `setInterval` every 5-10
  seconds. Given a 60-120s new-row latency, polling that fast is wasted DB
  load and gives no fresher data. **Use `POLL_INTERVAL_MS=30000` (30s) as
  the env default**, configurable down to 5s for debugging. 30s gives at
  worst a 30s-after-row-arrival p99 — which is well under the 30-second
  wedge SLA from §5 even accounting for SSE fanout.
- The SSE heartbeat interval (§9) is unaffected — keep it at 15s.
- Document in `backend/.env.example` that the bottleneck is DWH-side, not
  poller-side. Lowering `POLL_INTERVAL_MS` below 30s gives diminishing
  returns and proportional DB cost.
- §16 risk row "DWH alarm data quality is worse than expected" — re-read
  during Phase 3 build with the actual DWH attached, not before. The
  1-2-minute number is the owner's estimate; the real number may move
  during Phase 3 and we adjust the poller cadence then.

---

## §15 Q5 — Topology seed source

**Answer:** None. Start empty. The admin UI (Phase 11) is the only way
sites, devices, and links get into the system.

**Implementation directives:**

- Phase 1 migrations (T2): create the tables, do NOT seed any rows.
- Phase 11 (admin topology editor) is on the critical path for v1.0
  shipping, not deferable. Without it, there is literally no data — /map
  shows nothing, /dashboard aggregates over zero rows. **This re-prioritizes
  Phase 11 from "v1.7" to "must-ship-before-real-usage."** §28 currently
  labels Phase 11 as v1.7 — that label is now wrong. Suggest re-labeling
  Phase 11 as part of v1.0 in the §28 phased plan when locking Phase 1.
- CSV import (T?): not needed for Phase 0/1 — can stay deferred. If the
  owner later receives a topology export from a colleague, the admin UI
  can absorb it row-by-row, or we add a CSV import in v1.5.
- /map first-run empty state (§10.5): "No topology imported yet — go to
  Admin → Topology to add sites and links." Already in the design but now
  it is THE default starting state, not an edge case.
- /dashboard first-run empty state: must read sensibly with zero rows
  in `sites` / `links`. KPIs render as `0` or `—`, not `NaN`. Confirm
  in Phase 10.

---

## §18 — Director quote

**Source:** Director (name withheld in-doc; on file with repo owner)
**Question asked:** "When you hear about a fiber cut, what's the FIRST
thing you want to see in the next 60 seconds?"
**Verbatim answer:** *"The impacted zones in the map."*

**What this confirms:**

This is direct validation of the wedge §5 item 1: *"Sudan map (full-bleed)
with cut location pinned, **affected region filled red**, unaffected greyed."*
The director's mental model is **zones** (geographic regions), not site dots
or link lines. The site/device/link dots on the map are supporting; the
ST_ConcaveHull-derived affected-region polygon (§9) is THE primary visual.

**What this rules out (or at least de-prioritizes):**

- They did NOT ask for: customer count, revenue at risk, SLA exposure,
  ticket count, ETA-to-fix, vendor name, contractor name, or alarm
  severity breakdown.
- §5 KPI strip (Down Devices / Down Links / Availability / Cuts in 24h)
  is still useful — but it's secondary to the zone polygon. The director
  doesn't articulate it as the FIRST thing they want.

**Implementation directives:**

- Phase 4 affected-region: this is now the v1.0 hero artifact. ST_ConcaveHull
  + ST_Buffer must produce a polygon that reads cleanly from a default-zoom
  Sudan view. Tune `ST_Buffer` distance during Phase 4 against real data.
- Phase 8 /map: the affected-region polygon layer must render **above**
  the basemap and **below** the site dots, with high enough opacity (~30%
  red fill, full-opacity red stroke) that a director glancing at the screen
  for 5 seconds catches it. Lock the exact tokens in §11 during impeccable
  pass.
- Empty-affected-region case (calm day): the polygon layer is absent, the
  map reads as "all clear" — matches the §10.5 "All networks healthy" calm-day
  default that's already in the design.
- KPI overlay (top-right glass panel): keep, but visually it should NOT
  compete with the zone polygon for attention. The polygon is the primary
  visual element; the KPI panel is secondary chrome.

---

## Surprised by / things the doc got wrong

1. **§25 T2 "seed Khartoum HQ as default root" is stale.** The owner does
   not know which sites are the heads; the seed must be empty and the
   admin UI handles root designation. Update §25 T2 in Phase 1.
2. **§9 "App DB stores TIMESTAMPTZ in UTC" is contingent and now wrong.**
   Owner decided to use DWH-native timestamps with no conversion. Use
   `TIMESTAMP WITHOUT TIME ZONE` for DWH-mirroring columns. Update §9 in
   Phase 1.
3. **§9 implied poll interval of 5-10s is overkill.** With 1-2 min new-row
   latency, 30s is the right default. Update `.env.example` in Phase 1.
4. **§25 T4's local-fallback bcrypt branch is unnecessary in production.**
   LDAP is reachable from the deploy host. Keep bcrypt as a dev/test seam
   only; do not surface it as a production toggle.
5. **Phase 11 is on the v1.0 critical path, not v1.7.** With "start empty"
   as the seed strategy, the admin topology editor is the only way data
   enters the system. v1.0 cannot ship without it. Re-label Phase 11 in
   §28 when locking Phase 1.
6. **The director quote is shorter than the §18 prompt asked for.** The
   prompt said "one-paragraph quote"; the answer was one sentence. The
   sentence is precise enough to anchor the wedge so this is not a
   blocker — but if future passes need richer signal, schedule a
   follow-up 30-min session with the same director.

---

## Gate (§28 Phase 0)

> Gate: all five answered + the director quote in hand → start Phase 1.

**Status:** GATE CLEAR. Phase 1 unblocked.
