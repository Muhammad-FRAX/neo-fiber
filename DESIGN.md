# Design: Neo-Fiber Network Operations Dashboard

**Generated:** 2026-05-18 via /office-hours
**Author:** Mohamed Alsiddig (lordraxos@gmail.com)
**Status:** APPROVED (2026-05-18) + ENG-REVIEW APPLIED (2026-05-18) + DESIGN-REVIEW APPLIED (2026-05-18)
**Mode:** Intrapreneurship (Zain Sudan internal tool)
**Supersedes:** original `old-website/` implementation (React 17 + CRA + Leaflet + Neo4j)

---

## 1. Problem Statement

When a fiber cut or device failure happens on the Zain Sudan backbone, regional managers and directors today learn about it through WhatsApp messages and have to call engineers and technicians to understand the impact. They wait **more than an hour** to receive a human-written report. They trust the information when it arrives, but they cannot **see** the impact visually, and they cannot **dig into it themselves**. That delay and lack of self-service is the actual pain point.

The previous version of this tool (in `old-website/`) tried to solve this and failed for three reasons:

1. **The dashboard was 100% mock data.** Sixteen cards, four tabs, all hardcoded — no connection to real alarms.
2. **The "down" status logic was incorrect.** The system propagated DOWN naively (if MAIN link down → device DOWN), ignoring backup routes. Red zones on the map were lying.
3. **The design wasn't fit for any single user.** Cramped, three competing layouts on one screen (NOC console + executive view + maintenance log), inconsistent visual language, no real component system.

Combined effect: directors didn't trust it, didn't open it, and continued making phone calls.

---

## 2. Demand Evidence

- **Directors and regional managers explicitly asked for the tool.** That is the strongest internal-demand signal available — a sponsor with intent, not a hypothetical user.
- **They have follow-on intent**: they want this to grow into something bigger, with someone else they hire — meaning the rebuild has a path to longer-term investment if v1 lands well.
- **The previous version exists and is not used** — proof that the pull is real but the supply is broken.

**Strength of demand: high.** Internal sponsor, clear ask, repeat investment intent.

---

## 3. Status Quo (the current loop being replaced)

A fiber cut happens at 14:32. The next 30+ minutes from a director's POV:

1. WhatsApp message arrives (sometimes late).
2. Director calls the manager OR reads the WhatsApp group thread.
3. They wait for an engineer or NOC to send a written report.
4. **>1 hour** later, report arrives by message — text only, no visualization, no drill-down.
5. They trust the report but cannot ask follow-up questions without making more calls.

**This is what we replace with self-service visual impact in <30 seconds.**

---

## 4. Target Users

| Persona                                           | Frequency                          | Session length  | What they want                                             | Technical depth |
| ------------------------------------------------- | ---------------------------------- | --------------- | ---------------------------------------------------------- | --------------- |
| **Regional manager / director** (primary)         | Episodic — when they hear of a cut | 30-90 seconds   | "Where is the impact, how big is it, who's hurt?"          | Low             |
| **NOC engineer** (secondary)                      | Sometimes daily                    | Several minutes | Same as above + raw alarm details, time filtering, history | High            |
| **Engineer/admin (topology editor)** (occasional) | Weekly-ish                         | Several minutes | Edit network topology, declare backup routes               | High            |

Design for the harder case (director, glanceable, non-technical). Engineers get the same view plus a few power features (raw alarm list, filters, exports).

---

## 5. Narrowest Wedge — the 30-second view

A director gets a WhatsApp ping, opens the tool. They must see in ONE screen:

1. **Sudan map (full-bleed)** with cut location pinned, affected region filled red, unaffected greyed.
2. **KPI overlay (top-right, glass panel)**: Down Devices, Down Links, Network Availability %, Cuts in last 24h.
3. **Backup-aware status colors** on sites and links: green = up, amber = degraded (running on backup), red = all paths down.
4. **Active alarms ticker** (bottom of map): scrolling list of latest critical/major alarms.
5. **Click site → detail modal**: which links are down, what's downstream, what's the inferred impact, ack alarm.

That's v1. Anything else (full alarm history, advanced filters, the dashboard tab, the topology editor) is v1.5+ and explicitly out of scope for the wedge.

---

## 6. Constraints

- **Air-gapped deployment.** The app might run in environments isolated from the internet. **No CDN fonts, no Mapbox/Google tiles, no remote icons, no telemetry, no external chart-rendering services.** Every asset ships in the Docker image.
- **Two databases**: an existing data warehouse Postgres (read-only, contains `dwh.fibergis_alarm_log`) and a new application Postgres (read-write, owned by this app).
- **Docker-based deployment**: 2 containers (app, app-DB). DWH is external.
- **LDAP auth** (`@sd.zain.com`) — keep, since it already works.
- **Solo dev (you)** building this evenings/weekends.
- **The DWH alarm table is the only source of changing data.** No NetFlow, no SNMP, no traffic counters available for v1.

---

## 7. Premises (agreed)

1. **Primary persona = directors. Engineers can use it too** — don't fragment the product.
2. **Home screen = Sudan map (hero) + KPI strip below**, not a dashboard, not pure-map.
3. **Status must be backup-aware** — green/amber/red, not green/red. **Backup topology is initially unknown, so the system supports editable topology**: an engineer declares "Device X's traffic can come from Link A, B, or C." Reachability gets smarter as the model gets enriched.
4. **Drop Neo4j.** Postgres + PostGIS is the single source of truth.
5. **SSE push, not polling** — alarm events stream from server to clients.
6. **Dashboard ships in v1**, not v2 — wired to real Postgres aggregations from the alarm log. No mock data anywhere, ever.
7. **`dwh.fibergis_alarm_log` is a VIEW**, not a table, defined as `dwh.fact_fiber LEFT JOIN dwh.dim_dwdm_site` on `Site_A_ID`. Real column list (from sample): `Log_Serial_Number`, `Alarm_key`, `Alarm_Name`, `Alarm_Severity`, `Alarm_Source`, `Status` (computed: 'Clear' / 'Not Clear'), `OccurrenceTime`, `ClearanceTime`, `DownTime` (computed interval), `LocationInformation`, `Contractor`, `FiberlinkSite_ID`, `FiberLinkSite_Name`, `Site_A_ID`, `Site_A_Latitude`, `Site_A_Longitude`, `State`, `Zone`, `Vendor`, `Site_Priority`, `Is_Hub`, `Is_VIP`, `Site_B_ID`, `Site_B_Latitude`, `Site_B_Longitude`, `Source_NE`, `Sink_NE`. **Data quality reality**: many alarms have empty geo / FiberLink fields (sample row 2 has only Source_NE/Sink_NE; row 3 has almost everything empty). The poller must be robust to nulls.

8. **Only one alarm name = a fiber cut.** The DWH receives many alarm types (T_ALOS, ETH_LOS, etc.), but only one specific name represents an actual fiber-cut event that should change topology status. The exact name is TBD by the user. **Solution**: `FIBER_CUT_ALARM_NAME` env var (e.g. `FIBER_CUT_ALARM_NAME=R_LOS`). The DWH poller filters by this name to trigger reachability recompute. All other alarms are still ingested into the in-memory event bus and visible in the live alarms ticker + dashboard aggregations, but they do NOT trigger reachability or map color changes. This reduces D1 (alarm storm) risk and D4 (hull recompute) cost by ~10×+ in practice.

---

## 8. Approaches Considered

### Approach A — Patch and polish the existing CRA stack

Keep React 17 + CRA + Leaflet, drop Neo4j, wire real data, modernize UI with shadcn/Tailwind, add SSE. **Rejected:** doesn't deliver the perceptual leap; CRA is deprecated; Leaflet looks dated.

### Approach B — Next.js 15 + MapLibre + Postgres

Full Next.js App Router rebuild with TypeScript end-to-end. **Rejected by user:** more learning curve than needed, and the user wants a clean React SPA + Express split, not Next.js.

### Approach C — Custom map + Grafana for dashboard

Embed Grafana for the dashboard tab. **Rejected:** visual seams (Grafana iframe ≠ custom shell), Grafana customization limits, embedding auth tricky.

### Approach D — Vite + React 19 + Express 5 + MapLibre + PMTiles (CHOSEN)

Self-contained offline-capable stack matching the existing scaffolding. Details below.

---

## 9. Recommended Approach — Approach D

### Frontend (`frontend/`)

| Layer                | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Why                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Build tool           | **Vite 7** (already scaffolded)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Fast HMR, modern bundling, ESM-first                                                      |
| Framework            | **React 19** (already scaffolded)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Latest, fine-grained reactivity, Suspense-ready                                           |
| Styling              | **Tailwind CSS v4** (`@tailwindcss/vite`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Compiled at build, no runtime, no CDN                                                     |
| Component primitives | **shadcn/ui** + **Radix UI** (NPM)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Accessible, headless, you own the code                                                    |
| Icons                | **lucide-react**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Bundled, no CDN                                                                           |
| Charts               | **Recharts** (or **visx** for advanced)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | NPM, no CDN, declarative                                                                  |
| Server state         | **TanStack Query v5**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Caching, deduping, SSE-friendly                                                           |
| Client state         | **URL params (via `nuqs`) for shareable state** (filters, viewport, severity, time range) + **Zustand** for ephemeral UI (theme, sidebar). Locked in B2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | URL state makes WhatsApp-shareable director views work. Saved views = stored URL configs. |
| Routing              | **React Router v7**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | SPA routing                                                                               |
| Map                  | **MapLibre GL JS** + **PMTiles** for Sudan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | WebGL vector tiles, single ~80MB file, premium look                                       |
| Map data             | **Sudan PMTiles** generated from OSM (Geofabrik) via `tippecanoe`, bundled in `backend/public/tiles/sudan.pmtiles` and served by Express static middleware. **HTTP Range support required** (Express `express.static` honors `Range:` headers natively for static files). MapLibre fetches byte ranges via the `pmtiles://` protocol — the `pmtiles` JS client converts these into `Range: bytes=X-Y` HTTP requests. **Verification step**: a smoke test must assert that `curl -H 'Range: bytes=0-15' /tiles/sudan.pmtiles` returns HTTP 206 Partial Content. Without this, the entire 80 MB file is downloaded on every map load. |
| Fonts                | **Inter** (UI) + **JetBrains Mono** (IDs/timestamps) — self-hosted woff2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Date handling        | **date-fns**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Tree-shakeable, no moment.js                                                              |

### Backend (`backend/`)

| Layer       | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Why                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Runtime     | **Node.js LTS** (current)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |                                                                                            |
| Framework   | **Express 5** (already scaffolded, ESM)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |                                                                                            |
| Security    | **Helmet** + **express-rate-limit** + **cors** (already scaffolded)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |                                                                                            |
| DB driver   | **pg** (node-postgres) with two pools: `dwhPool` (read-only) and `appPool`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Explicit separation, never confuse the two                                                 |
| Query layer | **Drizzle ORM** for `app` DB; raw `pg` for `dwh` (read-only SELECTs)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Type-safe app schema, flexibility for DWH                                                  |
| Auth        | **ldapjs** + **jsonwebtoken** + **bcrypt** for local admin. **JWT in `localStorage`**, sent via `Authorization: Bearer ...` header. **No refresh token** — when the JWT expires, the next protected request returns 401, the frontend deletes the token and redirects to `/login`. SSE: server validates token on stream connect and on each event; on expiry the server emits a final `event: reauth` and closes the stream, client triggers the same kick-to-login. JWT lifetime: **8 hours** (one work shift). Accepted trade: localStorage is XSS-vulnerable; mitigated by Helmet CSP, no inline scripts, no third-party scripts at all (we're air-gapped), and React's default escaping. Internal corp network, low blast radius. | Decision locked in A4.                                                                     |
| Real-time   | **Native SSE** (`text/event-stream` over Express response stream)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | No socket.io needed; firewalls love SSE                                                    |
| Validation  | **Zod**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Schema once, types + runtime checks free                                                   |
| API docs    | **`@asteasolutions/zod-to-openapi`** → served at `/api/docs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | OpenAPI 3.1 auto-generated from the same Zod schemas. One source of truth, no duplication. |
| Logging     | **Pino**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Fast, structured                                                                           |

### Databases

**Application DB (`app`, owned by us, PostGIS-enabled):**

```sql
-- Users (LDAP-synced + local admin)
users (id, ldap_username, display_name, role, created_at, last_login)

-- Topology: sites, devices, links
sites    (id, site_id_external, name, region, state, lat, lng, geom GEOGRAPHY(POINT),
          is_root BOOLEAN DEFAULT false)   -- anchors for reachability BFS, see A2
devices  (id, device_id_external, site_id FK, name, type, vendor)
links    (id, link_id_external, source_device_id FK, target_device_id FK,
          ranking ENUM('MAIN','BACKUP','AUX'), capacity_gbps, geom GEOGRAPHY(LINESTRING))

-- The "topology gets smarter over time" table
alternate_paths (id, device_id FK, alternate_link_ids INT[], declared_by FK, declared_at)

-- Audit
topology_audit (id, user_id FK, action, before_state JSONB, after_state JSONB, at)

-- Alarm-side state we can't write to DWH.
-- alarm_log_serial = dwh.fibergis_alarm_log.Log_Serial_Number. DWH is
-- append-only with in-place updates on the same row (e.g., setting ClearanceTime
-- when an alarm clears) — the serial is therefore stable for the row's lifetime
-- and safe to use as a foreign reference. Confirmed by user, A5.
alarm_acks      (id, alarm_log_serial BIGINT NOT NULL UNIQUE, user_id FK, acked_at, note)
incident_notes  (id, alarm_log_serial BIGINT NOT NULL, user_id FK, body, at)
CREATE INDEX alarm_acks_serial_idx ON alarm_acks(alarm_log_serial);
CREATE INDEX incident_notes_serial_idx ON incident_notes(alarm_log_serial);

-- UI state
saved_views (id, user_id FK, name, config JSONB)
```

**Data warehouse (`dwh`, read-only, NOT touched by writes):**

- `dwh.fibergis_alarm_log` — existing, already populated externally.

### Error handling (locked in B1)

**Server (Express):**

- Custom `AppError` class with subtypes (`ValidationError`, `NotFoundError`, `UnauthenticatedError`, `ForbiddenError`, `ConflictError`, `RateLimitError`, `InternalError`).
- Global Express error middleware catches everything thrown from routes, maps to the A7 error shape with a stable `code`, logs via Pino with `request_id` correlation, returns the appropriate HTTP status.
- Unhandled exceptions in async handlers caught by an `asyncHandler` wrapper so they reach the global middleware.
- Background worker errors (DWH polling) logged but never crash the process — exponential backoff on connection failure (1 s → 2 s → 4 s → ... → max 60 s).

**Frontend:**

- One root `<ErrorBoundary>` in `App.jsx` catches React render crashes → full-page fallback with "Reload" button.
- Per-route `<ErrorBoundary>` inside `/map`, `/dashboard`, `/admin` so a crash in one section doesn't blank the whole app.
- TanStack Query handles fetch errors per-query → inline `<ErrorState />` component with retry button.
- **DWH-unreachable behavior**: a top banner appears reading "Alarm data is delayed — last update {N}s ago." The map keeps the last known state instead of going blank. The dashboard freezes its numbers and shows the same banner. Self-clears when SSE reconnects.
- **App-DB-unreachable behavior**: full-page "Service is starting, please refresh in a moment" with an auto-retry button that pings `/api/v1/health` every 10 s; auto-redirects to the previous route once healthy.
- **Auth expiry behavior**: any 401 response → wipe `localStorage` token → redirect to `/login?next={current_path}`. After re-auth, restore to `next`.

### Query conventions (locked in D3)

**No N+1 queries**, ever. Any endpoint returning nested topology (sites with devices, devices with links) MUST use either:

- A single JOIN'd query that returns the flattened result, then assembled in code, OR
- Two queries with `WHERE id = ANY($1::int[])` for the children, never one query per parent.

`pg_stat_statements` is enabled in the app DB; a startup script flags any query that appears with identical text and parameter shape >50 times in a minute as a likely N+1. CI also runs an integration test that hits each list endpoint and asserts query count stays under a threshold.

### Logging schema (locked in B4)

Every log line, structured JSON via Pino:

| Field         | When                  | Example                                                                      |
| ------------- | --------------------- | ---------------------------------------------------------------------------- |
| `time`        | always                | `2026-05-18T14:32:17.482Z`                                                   |
| `level`       | always                | `info` / `warn` / `error`                                                    |
| `request_id`  | per-request           | `01HFK8...` ULID, propagated via `AsyncLocalStorage`                         |
| `user_id`     | when authed           | integer                                                                      |
| `route`       | per-request           | `GET /api/v1/sites`                                                          |
| `duration_ms` | on response           | `47`                                                                         |
| `status`      | on response           | `200` / `404` / `500`                                                        |
| `error_code`  | on errors             | `VALIDATION_ERROR`, `NOT_FOUND`, ... (same enum as A7)                       |
| `event`       | optional named events | `sse_connect`, `sse_disconnect`, `alarm_received`, `reachability_recomputed` |

Pino bindings + a small Express middleware wire this up in ~20 lines. Pays for itself the first time you grep production logs at 3 AM.

### API conventions (locked in A7)

- **Base path**: `/api/v1/...`. The `/v1/` prefix is cheap insurance for the day someone wants to evolve the shape without breaking existing clients.
- **REST shape**: `GET /api/v1/sites`, `GET /api/v1/sites/:id`, `POST /api/v1/sites`, `PATCH /api/v1/sites/:id`, `DELETE /api/v1/sites/:id`. Same pattern for `devices`, `links`, `alternate_paths`, `users`.
- **Live streams** under `/api/v1/stream/...` (e.g., `/api/v1/stream/alarms`, `/api/v1/stream/topology`).
- **Error shape** (always, on every 4xx/5xx):
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "human-readable", "details": { ... } } }
  ```
  `code` is from a fixed enum (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`). Frontend switches on `code`, not on `message`.
- **Pagination**: `?page=N&limit=M`, response includes `{ data: [...], pagination: { page, limit, total } }`. Default `limit=50`, max `200`.
- **Filtering**: query params with explicit names (`?severity=Critical&state=Khartoum`). No nested filter DSL.
- **Sorting**: `?sort=-occurrence_time` (prefix `-` for descending). Whitelist of sortable columns per endpoint.
- **Auto-generated OpenAPI** lives at `GET /api/docs` (Swagger UI) and `GET /api/openapi.json`. Built from the same Zod schemas used for runtime validation.

### Containers

```
docker-compose.yaml:
  app:        Node 20 alpine, builds frontend then serves dist/ + APIs
              port 5000 -> exposes 8080 (or behind nginx if needed)
  app-db:     postgis/postgis:16-3.4-alpine
              volumes: ./db/init/*.sql for schema bootstrap
              backups: nightly pg_dump to volume

External:
  dwh-db:     existing Postgres elsewhere in Zain Sudan infra, configured via .env
```

The `app` container builds `frontend/dist` during the Docker build, then Express serves both the API and the static SPA from the same origin — no CORS in production, single port to expose.

### Real-time architecture

1. A background worker polls `dwh.fibergis_alarm_log` every 5-10s (since DWH is external and we can't have it push to us) for new rows where `OccurrenceTime > last_seen`.
2. Each new alarm event is published to an in-memory event bus, **regardless of name** — the dashboard ticker and aggregations consume everything.
3. **Reachability filter**: only alarms where `Alarm_Name = process.env.FIBER_CUT_ALARM_NAME` trigger reachability recomputation. Other alarm types fire the alarm-ticker SSE event but skip the topology pipeline. See §7 premise 8.
4. The SSE endpoint `/api/v1/stream/alarms` keeps an open connection per client and pushes alarm event JSON.
5. The SSE endpoint `/api/v1/stream/topology` pushes site/link effective_status changes whenever the filtered reachability pass produces a change.
6. Frontend `EventSource` consumes both streams; TanStack Query cache updates in place. The dashboard ticker subscribes to `/stream/alarms`; the map subscribes to `/stream/topology` and also to `/stream/alarms` filtered by `Alarm_Name === FIBER_CUT_ALARM_NAME` for the "cut just happened" pulse animation.

**Mapping DWH alarms to topology**: the DWH has both site-level keys (`Site_A_ID`, `Site_B_ID`) and device-level keys (`Source_NE`, `Sink_NE`). Our app DB stores devices with `device_id_external` matching the NE strings, and sites with `site_id_external` matching Site IDs. The DWH poller resolves an incoming alarm to a topology link by:

1. If `FiberlinkSite_ID` is set, look up the link by that external ID directly.
2. Else if `Source_NE` and `Sink_NE` are both set, look up the link between those two devices.
3. Else if `Site_A_ID` and `Site_B_ID` are both set, look up the link between sites.
4. Else log an unresolvable-alarm warning and skip topology side; the alarm still goes to the ticker and dashboard.

This is the only "polling" in the system, and it's contained to the server-to-DWH boundary (which we can't avoid). Client never polls.

**SSE resilience baseline (v1.0)**, locked in A6:

- **Heartbeat**: server sends `: ping\n\n` comment every 25 s on each open stream to defeat corporate-proxy idle-timeout (most proxies kill idle connections at 60 s).
- **Reconnect**: on disconnect, browser `EventSource` auto-reconnects after ~3 s. Client refetches full state from REST on reconnect (`GET /api/sites/status`) — that fills any gap. Acceptable because the worst-case lost interval is small.
- **Backpressure**: not handled in v1.0. If we observe slow-client problems in real use, escalate to the full Last-Event-ID + ring-buffer approach (see TODOS).
- **Auth**: each SSE event runs through the same JWT middleware; on expiry server sends `event: reauth\n` and closes the stream (see A4).
- **Observation plan**: log every connect/disconnect with duration and client IP for the first 4 weeks. If we see >5% of streams dying inside 60 s with no client-side trigger, that means a proxy is killing them and we need to shorten the heartbeat interval.

### Backup-aware reachability

Algorithm (runs in Node, not Postgres — small dataset, fits in memory).
**Two-pass BFS reachability.** We do NOT enumerate all paths (that would be
exponential on a cyclic graph and is the wrong question). We answer "is there
ANY up path from root to device?" twice, once over MAIN-only edges and once
over MAIN+BACKUP+AUX edges. Both passes are O(V+E).

```
INPUTS:
  - devices[]        — node set
  - links[]          — edges with { status: UP|DOWN, ranking: MAIN|BACKUP|AUX }
  - roots[]          — set of devices that anchor the network (see A2 / §15 Q4)

ALGORITHM:
  pass1_reached = BFS from roots over edges where (status=UP AND ranking=MAIN)
  pass2_reached = BFS from roots over edges where  status=UP   (any ranking)

  for device d in devices:
    if d in pass1_reached:           effective_status[d] = UP
    elif d in pass2_reached:         effective_status[d] = DEGRADED   // on backup
    else:                            effective_status[d] = DOWN       // no path at all

  link_effective_status[l] =
      UP        if l.status = UP
      DEGRADED  if l is BACKUP/AUX currently carrying traffic
                (i.e., the source device is in pass2_reached but not pass1_reached)
      DOWN      if l.status = DOWN

  emit changed-status SSE events for devices and links whose effective_status changed.
```

Cost: O(V+E) per pass, two passes per alarm event. For ~250 sites and ~1000 links
this completes in well under 10 ms.

**Coalescing:** Not added in v1.0 — based on operator's domain knowledge of the
network, correlated alarm bursts are not expected to be large enough to matter
(D1). Recompute runs per event. If we ever observe Node event-loop stalls during
a real burst, add a debounce at that point. This is a deliberate "no premature
optimization" call backed by network-size context, not an oversight.

**Cycle safety:** BFS naturally handles cycles via a visited set. No path
enumeration, so no exponential blowup even if the graph has redundant rings.

### Affected-region polygon (the "geographic red")

When a cut happens, on the server:

1. Identify all sites with `effective_status = DOWN`.
2. Use PostGIS `ST_ConcaveHull(ST_Collect(site.geom), 0.5)` to compute a hull around affected sites.
3. Buffer it slightly with `ST_Buffer(hull::geography, 15000)::geometry` (15 km).
4. Emit as GeoJSON → MapLibre renders as a smooth red fill layer with feather opacity.

This replaces the old site's hardcoded 45 km red circles per device (which looked crude and didn't compose).

**Hull cache (locked in D4):** the computed GeoJSON is cached in a Node `Map` keyed by `sortedAffectedSiteIds.join(',')`. Reused whenever the same affected set returns. Entries older than 10 min are evicted. Prevents redundant PostGIS work in steady state where the same set of sites stays down for hours during a long restoration.

### Configuration (env vars)

| Var                                  | Purpose                                                      | Default                                                                                          |
| ------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `DWH_URL`                            | Read-only connection string to `dwh.fibergis_alarm_log` view | required                                                                                         |
| `APP_DB_URL`                         | Read-write connection to app Postgres                        | required                                                                                         |
| `LDAP_URL` / `LDAP_BIND_DN_TEMPLATE` | LDAP server + bind template                                  | required (or set `AUTH_LOCAL_ONLY=true`)                                                         |
| `AUTH_LOCAL_ONLY`                    | Bypass LDAP, use only bcrypt-hashed app users                | `false`                                                                                          |
| `JWT_SECRET`                         | Token signing key (32+ random bytes)                         | required                                                                                         |
| `JWT_TTL_SECONDS`                    | Token lifetime, see A4                                       | `28800` (8 h)                                                                                    |
| `FIBER_CUT_ALARM_NAME`               | The exact `Alarm_Name` that triggers reachability recompute  | TBD by user, leave empty until known — when empty, NO alarm triggers reachability (safe default) |
| `DWH_POLL_INTERVAL_MS`               | How often the DWH poller checks for new rows                 | `5000`                                                                                           |
| `SSE_HEARTBEAT_MS`                   | Server keepalive interval, see A6                            | `25000`                                                                                          |
| `LOG_LEVEL`                          | Pino level                                                   | `info`                                                                                           |
| `NODE_ENV`                           | `development` / `production`                                 | `development`                                                                                    |

Loaded via `dotenv` from `backend/.env` and validated at startup by Zod — process exits with a clear error if any required var is missing.

---

## 10. Information architecture

### Global chrome (locked in P1)

Collapsible icon-only left sidebar, 64 px wide by default, expands to 240 px on hover/click. Persistent on every authenticated route. Items: Map, Dashboard, Admin (if role allows), Profile, Logout. Visual style: dark surface in light theme (creates separation from white content), inverted in dark theme.

### Screen layouts

**`/map` (HOME)** — map is the hero, chrome floats over it:

```
+----+--------------------------------------------------------------+
|    |                                                              |
| ☰  |                                              [ KPI panel ]   |
| 🗺 |                                              | Down dev: 7  |
| 📊 |                                              | Down link: 2 |
| ⚙  |             SUDAN MAP                        | Avail: 78%   |
| 👤 |    (MapLibre full-bleed)                     | Cuts 24h: 3  |
|    |                                                              |
| ➡  |       affected region (red fill)                             |
|    |       sites: green / amber / red                             |
|    |       links: same                                            |
|    |                                                              |
|    +--------------------------------------------------------------+
|    | [ Alarms ticker — last 5 critical/major alarms, scrolls ]    |
+----+--------------------------------------------------------------+
```

- Sidebar: 64 px (collapsed) / 240 px (expanded), background `slate-900` in light theme.
- KPI panel: top-right glass card, 280 px wide, 4 stacked KPIs, `backdrop-blur` over the map.
- Alarms ticker: 56 px tall, full-width bottom bar, glass background, latest 5 critical/major alarms scrolling.
- Map: fills remaining viewport.

**`/login`**:

```
+--------------------------------------------------------------+
|                                                              |
|                    [ logo + product name ]                   |
|                                                              |
|              +----------------------------+                  |
|              |  Username                  |                  |
|              |  [ jdoe@sd.zain.com   ]    |                  |
|              |                            |                  |
|              |  Password                  |                  |
|              |  [ ●●●●●●●●           ]    |                  |
|              |                            |                  |
|              |  [ Sign in              ]  |                  |
|              |                            |                  |
|              |  [error message slot]      |                  |
|              +----------------------------+                  |
|                                                              |
|              v1.0  •  Zain Sudan internal                    |
+--------------------------------------------------------------+
```

Centered card, 360 px wide, on a neutral background. No marketing copy, no hero. Single purpose: log in.

**`/dashboard/*`** — sidebar on left, content area scrolls vertically. Avoid 3-column KPI card grids (see Pass 4). Instead: hero KPI strip at top (Network Availability as the big number with a sparkline + delta vs. last week), then table-led content blocks below. See Pass 4 for the no-AI-slop pattern.

**`/admin/topology`** — sidebar + content. Content is a data table (sites/devices/links) with:

- Sticky header with search + filter + "Import CSV" + "Add new" buttons
- Inline edit on row click
- Detail panel slides in from the right at 480 px wide on row expand

No graphical topology editor in v1.0. Tables are faster for engineers to scan and edit; a graph view is v2.0+ scope creep.

### Detail modal (click a site on the map)

Slides in from the right, 480 px wide, stays open while user pans/zooms the map underneath. Closeable via ✕, ESC key, or click-outside.

```
+------------------------------------------+
| ✕  Khartoum North #5             [ Ack ] |
+------------------------------------------+
|                                          |
|  Status:    🟡 DEGRADED (on backup)     |
|  Region:    Khartoum                     |
|  Updated:   2 min ago                    |
|                                          |
|  --- DOWNSTREAM IMPACT ---               |
|  Affected sites:   3                     |
|  Affected links:   1 MAIN, 2 BACKUP up   |
|                                          |
|  --- RELATED ALARMS ---                  |
|  [ alarm list, scrollable ]              |
|                                          |
|  --- ACTION ---                          |
|  [ Ack ]  [ Add note ]  [ Share view ]   |
+------------------------------------------+
```

```
/                       — redirects to /map or /login depending on auth
/login                  — LDAP login form
/map                    — HOME. Map + KPI overlay + alarms ticker + side panels
  └─ click site         — modal: details, downstream impact, alarm history, ack button
/dashboard              — Dashboard tab. Real KPIs from DWH aggregations + charts
  /dashboard/alarms     — historic alarm explorer w/ filters
  /dashboard/regions    — per-region MTTR, uptime, cuts
  /dashboard/fiber      — fiber-cut log + most-affected routes
/admin                  — admin only
  /admin/topology       — sites/devices/links CRUD + import CSV
  /admin/alternates     — declare backup paths (the topology-editor)
  /admin/users          — user/role management
  /admin/audit          — topology + alarm-ack audit log
/profile                — saved views, theme preference
```

Five screens for v1. No more.

---

## 10.5 Interaction states (locked in P2)

Every screen has at least four states. The default is healthy/calm, NOT empty.

| Screen / element          | Loading                                                                                     | Healthy / empty                                                                                                                                                                                           | Partial                                                                            | Error                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **`/map`**                | Map shell + KPI panel skeleton (shimmer), 'Connecting to alarm stream...' subtle bottom bar | **"All networks healthy"** headline pill top-center, KPIs show all green, faint base map without overlays, ticker reads "Last incident: Khartoum-Atbara, 3 days ago, resolved in 47 min."                 | Map renders + KPIs show, ticker shows "Reconnecting to alarm stream..." amber chip | Banner: "Alarm data delayed — last update Ns ago." Map keeps last known state. (B1)         |
| **KPI panel**             | 4 skeleton rectangles, no numbers                                                           | Big numbers in `slate-700`, sparkline trending flat, "vs last 24h" delta in `slate-500`                                                                                                                   | Number visible, sparkline placeholder                                              | Each KPI shows "—" with a tooltip on hover explaining what's wrong                          |
| **Alarms ticker**         | Shimmer rows                                                                                | "No active alarms — last one cleared X ago" in muted text, neutral background (NOT red)                                                                                                                   | "Reconnecting..." chip + last known alarms greyed                                  | Same as Healthy but with a small "stream offline" indicator                                 |
| **Detail modal**          | Site name + skeleton rows                                                                   | (only opens for a site, so always populated)                                                                                                                                                              | Status + region visible, downstream/related still loading                          | "Couldn't load details" + retry button                                                      |
| **`/dashboard`**          | Hero KPI strip skeleton, table skeletons below                                              | First-load: "No alarm data yet for this period — try a wider range" with date-picker emphasized                                                                                                           | Some cards loaded, others spinning                                                 | Per-card error with retry; overall page still works                                         |
| **`/admin/topology`**     | Table skeleton                                                                              | **First-run:** centered card: "No sites yet. Import a CSV to get started, or add one manually." Two equal-weight buttons: [ Import CSV ] [ Add site ]. This is the most important empty state in the app. | Some rows loaded; "Loading more..." footer                                         | Inline row error; rest of table works                                                       |
| **`/login`**              | Sign-in button shows spinner, form disabled                                                 | Default state on first arrival                                                                                                                                                                            | —                                                                                  | Inline error message below form: "Invalid credentials" or "LDAP unreachable, contact admin" |
| **Toast / system status** | —                                                                                           | (hidden by default)                                                                                                                                                                                       | —                                                                                  | DWH-down banner (B1), token-expired toast                                                   |

**Success / confirmation feedback:**

- Alarm acknowledged: subtle toast bottom-right, "Alarm acknowledged" + undo (5s window).
- Topology edit saved: same.
- View shared: copies URL to clipboard, toast "Link copied — share via WhatsApp."

**First-paint hierarchy:** when `/map` loads, render in this order so the user sees the most reassuring thing first: map base layer → KPI numbers → status overlays → ticker. Never block the map base layer on data.

## 11. Visual design direction

**Reference points:** Linear, Stripe Dashboard, Vercel, Cloudflare Radar. Serious, calm, data-as-hero, no decoration.

- **Color**: muted neutrals for chrome (slate/zinc), status color reserved for data — never for buttons or chrome.
  - Status: `emerald-500` (up), `amber-500` (degraded/backup), `rose-500` (down), `slate-400` (unknown).
  - Severity: `rose-600` critical, `orange-500` major, `amber-400` minor, `sky-500` info.
  - Accent: **indigo-500** (`#6366f1`) for chrome (sidebar active, focused inputs, primary buttons). Zain red is reserved exclusively for status — using it as a brand accent would erode the meaning of red. Locked in P5 design tokens.
- **Typography**: Inter for UI (14/13/12px scale), JetBrains Mono for site IDs, alarm codes, timestamps.
- **Density**: medium-high. Generous padding inside cards, tight padding between cards. White space is hierarchy.
- **Themes**: **dark default** (locked in P7-3C), manual light toggle in `/profile`. NOC-friendly out of the box. User preference persisted in localStorage; falls back to dark on first run regardless of OS preference.
- **Motion**: subtle. Cut alarm = brief pulse on map at the cut location (200ms ease-out, then settle). No bouncy spring animations, no gradient backgrounds, no glassmorphism overdose.
- **The map is the hero**: full-bleed on `/map`, no chrome competing for attention. KPI panel floats top-right as glass overlay; alarms ticker is a thin bar at bottom.
- **Alarms ticker (locked in P7-2A)**: 56 px tall, full-width, latest 5 critical/major alarms scrolling right-to-left at a slow walking pace (~30 s end-to-end). Hover or click pauses + highlights the row. Click any alarm to open the related site's detail modal. Click outside or press `Esc` to resume scrolling. Respects `prefers-reduced-motion` — falls back to static-list mode (top 5, refresh in place) if user has motion preferences disabled.

**Anti-goals:** marketing-y gradients, emoji status indicators, cute illustrations, "AI-powered" badges, Material-Design surface elevation pile-ups, anything that would make a director think "this is for kids."

### Design tokens (locked in P5)

Tailwind v4 + custom theme. All Tailwind-class-compatible names so tokens map directly to utility classes (e.g. `p-4` = `--space-4`).

**Spacing scale (px):**

| Token      | Value | Use                                   |
| ---------- | ----- | ------------------------------------- |
| `space-1`  | 4     | Tight icon-text gap, badge padding    |
| `space-2`  | 8     | Default gap inside compact components |
| `space-3`  | 12    | Small section spacing                 |
| `space-4`  | 16    | Default card padding, default gap     |
| `space-6`  | 24    | Major section separator               |
| `space-8`  | 32    | Page padding                          |
| `space-12` | 48    | Hero spacing on dashboard             |
| `space-16` | 64    | Login form vertical centering         |

**Type scale (Inter for UI, JetBrains Mono for IDs/timestamps):**

| Token       | Size / line-height / weight  | Use                                         |
| ----------- | ---------------------------- | ------------------------------------------- |
| `text-xs`   | 12 / 16 / 500                | Captions, microcopy, table cell metadata    |
| `text-sm`   | 13 / 18 / 500                | Default UI text, secondary content          |
| `text-base` | 14 / 20 / 500                | Body, table cells, default                  |
| `text-md`   | 16 / 22 / 500                | Card headers, modal titles                  |
| `text-lg`   | 20 / 28 / 600                | Section headings                            |
| `text-xl`   | 24 / 32 / 600                | Page titles                                 |
| `text-2xl`  | 32 / 40 / 600                | Dashboard secondary KPIs                    |
| `text-hero` | 48 / 56 / 700                | Dashboard hero KPI (Network Availability %) |
| `font-mono` | (Inter sizes) JetBrains Mono | Site IDs, alarm codes, timestamps, lat/lng  |

Min body size: 14 px. No text below 12 px anywhere (accessibility floor, Pass 6).

**Border radii:**

| Token          | Value   | Use                                               |
| -------------- | ------- | ------------------------------------------------- |
| `rounded-sm`   | 4 px    | Badges, chips, inline tags                        |
| `rounded`      | 6 px    | Buttons, inputs, table cells                      |
| `rounded-md`   | 8 px    | Cards, panels                                     |
| `rounded-lg`   | 12 px   | Modals, sidesheets, floating panels (KPI overlay) |
| `rounded-full` | 9999 px | Status dots, avatars                              |

**No uniform bubbly radius across all elements** (AI-slop trap). Radius scales with element size.

**Shadows:**

| Token          | Value                                                              | Use                                          |
| -------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| `shadow-xs`    | `0 1px 2px rgba(0,0,0,0.04)`                                       | Default card resting                         |
| `shadow-sm`    | `0 2px 4px rgba(0,0,0,0.06)`                                       | Hover lift                                   |
| `shadow-md`    | `0 4px 12px rgba(0,0,0,0.08)`                                      | Floating panels (KPI overlay)                |
| `shadow-lg`    | `0 12px 32px rgba(0,0,0,0.12)`                                     | Modal/sidesheet                              |
| `shadow-glass` | `0 4px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.4)` | KPI overlay on map (with `backdrop-blur-md`) |

**Focus rings (a11y, Pass 6):**

```
focus-visible:
  outline: 2px solid var(--accent-500);
  outline-offset: 2px;
  border-radius: inherit;
```

Every interactive element gets a visible focus ring. No `outline: none`.

**Z-index scale:**

| Token           | Value | Use                                             |
| --------------- | ----- | ----------------------------------------------- |
| `z-base`        | 0     | Map base layer                                  |
| `z-map-overlay` | 100   | Map fills, polylines, markers                   |
| `z-sticky`      | 200   | Sticky table headers                            |
| `z-overlay`     | 300   | KPI panel, alarms ticker, glass overlays on map |
| `z-modal`       | 400   | Detail modal, sidesheets                        |
| `z-toast`       | 500   | Toast notifications, system banners             |
| `z-popover`     | 600   | Dropdown menus, tooltips                        |

**Motion durations & easing:**

| Token            | Value                           | Use                                    |
| ---------------- | ------------------------------- | -------------------------------------- |
| `duration-75`    | 75 ms                           | Hover state changes (color, scale)     |
| `duration-150`   | 150 ms                          | Default UI transitions (modal opacity) |
| `duration-200`   | 200 ms                          | Modal slide-in, alarm pulse            |
| `duration-300`   | 300 ms                          | Page transitions, large layout shifts  |
| `ease-default`   | `cubic-bezier(0.4, 0, 0.2, 1)`  | Default (Tailwind's ease-in-out)       |
| `ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` | Modal entry, settling motions          |

**Brand accent (resolves §15 question #6):** **indigo-500** (`#6366f1`) for chrome accents — sidebar active state, focused inputs, primary button. Zain red is reserved for status only (the bleeding-red of a real fiber cut). Mixing them would erode the meaning of red.

**CSS variables in `:root`:**

```css
:root {
  /* Status (the only sacred colors) */
  --status-up: #10b981; /* emerald-500 */
  --status-degraded: #f59e0b; /* amber-500 */
  --status-down: #f43f5e; /* rose-500 */
  --status-unknown: #94a3b8; /* slate-400 */

  /* Severity (alarms) */
  --sev-critical: #dc2626; /* rose-600 */
  --sev-major: #f97316; /* orange-500 */
  --sev-minor: #fbbf24; /* amber-400 */
  --sev-info: #0ea5e9; /* sky-500 */

  /* Chrome (light theme default) */
  --bg: #ffffff;
  --bg-elevated: #f8fafc; /* slate-50 */
  --border: #e2e8f0; /* slate-200 */
  --text: #0f172a; /* slate-900 */
  --text-muted: #64748b; /* slate-500 */

  /* Sidebar (always dark in light theme) */
  --sidebar-bg: #0f172a; /* slate-900 */
  --sidebar-text: #cbd5e1; /* slate-300 */
  --sidebar-active: #6366f1; /* indigo-500 */

  /* Accent */
  --accent-500: #6366f1; /* indigo-500 */
  --accent-600: #4f46e5; /* hover */
}
```

Dark theme overrides via `[data-theme="dark"]`.

**Dashboard layout pattern (locked in P4)** — explicitly NOT the AI-slop 3-column equal-weight KPI grid.

```
+----+--------------------------------------------------------------+
| ☰  |  NETWORK AVAILABILITY                                        |
| 🗺 |  ┌───────────────────────────────────────────────────┐      |
| 📊 |  │   99.87%        ↑ +0.2% vs last week              │      |
| ⚙  |  │   [—————————/\—————————/\———————————]            │      |
| 👤 |  │   Last 30 days                                    │      |
|    |  └───────────────────────────────────────────────────┘      |
|    |                                                              |
|    |  [ Down dev: 7 ] [ Down link: 2 ] [ MTTR: 4.2h ] [ Cuts 24h: 3 ]
|    |                                                              |
|    |  ─── ALARMS OVER TIME ─────────────────────  Last 30 days ▾  |
|    |  [ time-series chart, full width ]                           |
|    |                                                              |
|    |  ─── TOP RECURRING ISSUES ──────────────────────────────────  |
|    |  [ data table, sortable, exportable ]                        |
|    |                                                              |
|    |  ─── MTTR BY REGION ────────────────────────────────────────  |
|    |  [ horizontal bar chart with region labels ]                 |
+----+--------------------------------------------------------------+
```

Pattern: **one hero KPI** (the big number that means "is the network healthy?"), **thin supporting strip** of 4 smaller KPIs, **real data blocks** below (charts and tables, not card grids). Each block is full-width, stacked vertically, separated by quiet horizontal rules with section labels. No card grids. No icons in colored circles. No "feature tile" patterns.

---

## 11.5 Responsive & accessibility (locked in P6)

### Responsive strategy: desktop-only for v1.0

| Viewport                               | Behavior                                                                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `< 1024 px` (mobile + tablet portrait) | Show a polite block screen: _"Neo-Fiber is designed for desktop. Please open this on a workstation for the full network view."_ + a small logo. No partial UI, no broken layouts. |
| `1024 - 1440 px`                       | Full app, sidebar collapsed by default to 64 px.                                                                                                                                  |
| `>= 1440 px`                           | Full app, sidebar can be expanded to 240 px persistently.                                                                                                                         |

Detection via JS-level `window.innerWidth` check on app mount; React Router blocks all routes except `/login` and shows the polite block screen.

**Mobile-friendly redesign is explicit v2.0 scope.** Listed in §12 and §22 TODOs.

### Accessibility (non-negotiable, v1.0)

Internal corp tool or not, the basics ship in v1.0. A director using a screen reader or someone with low vision must be able to read the alarm impact.

**WCAG 2.2 AA baseline:**

- **Color contrast**: all body text ≥ 4.5:1 against background. All UI controls ≥ 3:1. Status colors (rose / amber / emerald) verified against both light and dark themes; status NEVER communicated by color alone — always paired with an icon and a label.
- **Keyboard nav**: every interactive element reachable by Tab; focus visible (focus ring tokens P5); focus order matches visual order; `Esc` closes modals and sidesheets; `/` focuses search where available; map zoom/pan via keyboard arrows + plus/minus.
- **Screen reader**:
  - Sidebar nav: `<nav aria-label="Primary">` + each item has an `aria-label`.
  - Map: `<div role="application" aria-label="Sudan network status map">` + a hidden `<table>` with the same data accessible to screen readers (because canvas-based maps are invisible to AT).
  - Alarms ticker: `<div role="log" aria-live="polite" aria-atomic="false">` so new alarms are announced.
  - Detail modal: `<dialog>` or `role="dialog" aria-modal="true" aria-labelledby="..."`.
  - KPI panel: each metric is `<dt>`/`<dd>` so labels and values are paired for AT.
- **Touch targets**: not relevant for v1.0 (desktop-only), defer to v2.0.
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables the cut-alarm map pulse and all non-functional animations. Keep only opacity transitions for modals.
- **Form labels**: every input has a visible `<label>` (no placeholder-as-label).
- **Error messages**: linked to inputs via `aria-describedby`.
- **Skip-link**: at the top of every page, "Skip to main content" anchored to the main `<main>` element.

**Testing:** axe-core integrated into Playwright E2E tests; CI fails on any "serious" or "critical" violation.

## 12. Phased plan

| Phase                                                   | Scope                                                                                                                                                                                                                                       | Est. duration |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **v1.0 — Map + Auth + Real-time + Backup-aware status** | LDAP login, map page, KPI overlay, SSE alarm stream, PostGIS affected-region polygon, click-site modal, minimal admin (site CRUD). Acceptable to ship with naive single-link propagation until alternate_paths are seeded.                  | **6 weeks**   |
| **v1.5 — Dashboard tab with real aggregations**         | All KPI cards wired to real `dwh.fibergis_alarm_log` aggregations. Charts (alarms over time, by severity, by region). MTTR computed from `OccurrenceTime`/`ClearanceTime`. Top recurring issues. Fiber-cut history table. **No mock data.** | **+3 weeks**  |
| **v1.7 — Topology editor + alternate paths + audit**    | Admin route for declaring backup paths. CSV import for topology bootstrap. Audit log. Backup-aware reachability becomes meaningful as topology gets enriched.                                                                               | **+2 weeks**  |
| **v2.0 — Polish + iterate based on real usage**         | Time-scrubber on map ("network state 2h ago"), saved views, sharable links, mobile-friendly, dark mode, PDF export of incident reports.                                                                                                     | **+3 weeks**  |

**Total to v1.0 (the wedge): ~6 weeks solo.**

---

## 12.5 Testing strategy (locked in C1)

Tests land alongside features, not as a follow-up.

| Layer          | Tool                                         | Scope                                                                                                                                                                                                                                                    |
| -------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend unit   | **Vitest**                                   | Pure functions, services (reachability, debounced recompute, DWH adapters).                                                                                                                                                                              |
| Backend HTTP   | **Supertest**                                | Every route in the OpenAPI spec: happy + 4xx + 5xx paths.                                                                                                                                                                                                |
| DB integration | **testcontainers** + real Postgres + PostGIS | Migrations apply cleanly. PostGIS functions (`ST_ConcaveHull`, `ST_Buffer`, geography indexes) produce expected output. Recursive CTEs return correct rows. **No mocking the DB** — PostGIS divergence between mock and real is exactly where bugs hide. |
| Frontend unit  | **Vitest + React Testing Library**           | Components, hooks, URL-state helpers.                                                                                                                                                                                                                    |
| E2E            | **Playwright**                               | Critical user flows (see test diagram above). Runs offline in CI.                                                                                                                                                                                        |

**CRITICAL regression suite (acceptance gate for v1.0):** Three backup-aware-status scenarios where the _old_ site produced wrong colors. The new site must produce the right colors. Concrete cases to be defined with a senior network engineer in week 1, but the shape is:

- **Regression #1**: a cut on a known backbone segment must color only directly-affected sites red, never the cascading downstream sites that have working backup paths. (The old site's primary failure mode.)
- **Regression #2**: a site whose MAIN link is down but BACKUP is up must show AMBER (degraded), never RED.
- **Regression #3**: TBD — pick one real historical incident from WhatsApp / postmortem records where the old map lied. Replay it.

Per the test-review IRON RULE: these are not optional and not deferrable. They're the test of whether v1.0 actually fixes the trust problem.

**Coverage target:** ≥80% line coverage for backend (enforced in CI). ≥60% for frontend (lower bar because UI tests have diminishing returns past the critical flows).

**CI**: GitHub Actions (or your internal CI) runs lint + unit + integration + E2E on every push. Migration drift check: a job that builds a fresh DB from migrations and diffs it against the live schema dump.

### CI verification reality (for GitHub-Actions Claude agents)

When a phase is executed by a remote Claude Code agent triggered from a GitHub
issue (`@claude` on an issue or PR), the runner is a clean Ubuntu container in
GitHub's cloud. It **cannot reach**:

- The real Zain Sudan DWH Postgres
- The real LDAP server
- Any internal `172.18.x.x` address
- The deployment VM

So §28 verify steps that look like `curl http://localhost:5000/api/v1/health`
expecting live DB connectivity will NOT pass in CI. The agent must substitute:

| Live service                            | CI fallback                                                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| DWH Postgres                            | **testcontainers** + a fixture schema mirroring `dwh.fibergis_alarm_log`, seeded with sample rows from `old-website/database sample.txt` |
| LDAP server                             | `ldap-server-mock` npm container in tests, OR run with `AUTH_LOCAL_ONLY=true` and bcrypt-hashed test users in the app DB                 |
| App Postgres                            | **testcontainers** (`postgis/postgis:16-3.4-alpine`) — works fine in Actions runners, Docker is available                                |
| PMTiles HTTP Range                      | local file via `express.static` — works identically in CI                                                                                |
| Real-time end-to-end (alarm → SSE → UI) | testcontainers-fed events through the event bus; Playwright asserts the UI update                                                        |

**Acceptance criteria for "phase complete in CI":**

- Backend phases: `npm test` green, integration tests pass against testcontainers, lint clean, typecheck clean.
- Frontend phases: `npm test` green, Playwright passes against `npm run dev` + a mocked backend, axe-core clean.
- The §14 acceptance bullets that depend on live services (alarm row → visual update ≤ 15 s end-to-end, `docker compose up` on a no-internet machine, real-director-uses-it) are **explicit handoff items the repo owner runs on a real host**, not gates the CI agent owns. The agent's PR should note these as "deferred to local verification" with the exact command for the owner to run.

**What the agent should do when blocked:** if a verify step genuinely cannot be substituted (e.g., proving LDAP works against the real Active Directory server), commit the code with the CI-substitute test passing, and leave a clear `CONTINUATION.md` block in the PR titled "Local verification required" listing the exact command the repo owner needs to run on their machine. Don't pretend it's verified.

## 13. Distribution plan

- **Build artifact:** single `docker compose up` that pulls/builds two images (app, app-db) and starts them.
- **Tile data:** `sudan.pmtiles` shipped INSIDE the app image (built at Docker build time via tippecanoe in a multi-stage build, OR pre-generated and committed if size <100 MB — recommend committed for reproducibility). **Dockerfile note**: `COPY sudan.pmtiles` is the final layer before `CMD` so that code-only rebuilds reuse the cached 80 MB tile layer instead of reshipping it. Locked in D2.
- **Topology data:** seeded via CSV in `db/init/topology_seed.sql`. Engineers can later edit via the admin UI.
- **Deployment target:** on-prem Linux VM inside Zain Sudan network (likely same host as the old `172.18.207.52`).
- **Updates:** new versions deployed by pulling a new image.
- **DB migrations (locked in B3):** Migrations are generated during dev with `drizzle-kit generate` and committed to `backend/db/migrations/`. On deploy the operator runs `npm run migrate` explicitly — there is no auto-migration on container start. Roll-back: revert the migration file in git, run `npm run migrate:down`, redeploy. This is deliberately boring: a quiet hour debugging a botched migration at 2 AM beats a fancy auto-apply flow every time.
- **Backups:** nightly `pg_dump` of app DB to a Docker volume + (optional) off-host copy if Zain Sudan has a backup network.

---

## 14. Success criteria

A director can open the tool from a WhatsApp link, see a current cut's impact within **30 seconds** of opening, **without making a phone call**, and trust what they see ≥95% of the time.

**Measurable v1 acceptance:**

- [ ] First-contentful-paint of `/map` ≤ 2.5s on a stock corporate laptop with no warm cache.
- [ ] Time from alarm row appearing in `dwh.fibergis_alarm_log` to visual update on `/map` ≤ 15s end-to-end.
- [ ] All dashboard numbers match an engineer's manual SQL against `dwh.fibergis_alarm_log` within ±0%.
- [ ] Backup-aware logic verified against ≥3 known incidents where the old site was wrong.
- [ ] `docker compose up` on a machine with no internet succeeds and the full app works (map, fonts, charts, everything).
- [ ] At least one regional manager / director uses it without coaching and self-describes the impact of a real cut.

---

## 15. Open questions

**WEEK 1 BLOCKERS (must answer before code starts):**

1. **Network "root" for reachability (A2).** Which site(s) anchor the network for BFS? Reachability cannot run without at least one `is_root = true` site. Default seed: Khartoum HQ aggregation point as single root, then revise once a senior engineer confirms multi-root layout (likely Khartoum, Port Sudan, El Obeid, Nyala). Reachability treats "reached from ANY root" as UP.
2. **DWH timezone (A8).** Confirm with the DWH owner what timezone `OccurrenceTime` is actually stored in (UTC? Africa/Khartoum? Naive local?). Match end-to-end. App DB stores `TIMESTAMPTZ` in UTC; UI displays `Africa/Khartoum` by default; the DWH→app boundary needs explicit conversion logic based on this answer.
3. **LDAP server reachability from the deployment host.** If the host is air-gapped from LDAP too, we need a local-fallback auth mode (bcrypt-hashed passwords in the app DB for a small list of bootstrap users).
4. **DWH refresh cadence.** How quickly does `dwh.fibergis_alarm_log` get new rows after an alarm fires upstream? If it's already 10+ minutes late, our 5-10 s polling doesn't matter much — we should know before optimizing.
5. **Topology seed source.** Master Excel / OSS export of sites and links, or manual entry to start? The CSV importer (v1.0) handles either, but knowing now informs how much data we have for the wedge demo.

**TASTE / NON-BLOCKING (resolved in design review):**

6. ~~Brand accent color.~~ **RESOLVED in P5**: indigo-500 for chrome, Zain red reserved for status.
7. ~~PMTiles licensing.~~ **RESOLVED**: subtle bottom-right map tag `© OpenStreetMap contributors`.

---

## 16. Risks & mitigations

| Risk                                                                             | Mitigation                                                                                                                                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Topology data is messy or doesn't exist — we can't seed sites/links              | Build CSV import in v1.0 from day one. Start with whatever incomplete data exists; the admin UI fixes it incrementally.                                                               |
| DWH alarm data quality is worse than expected                                    | Spend day 1 of build sitting with the actual data and writing the queries that power the dashboard. If quality is bad, we discover it before designing around it.                     |
| Backup-aware logic is more complex than expected (cycles, multi-rooted graphs)   | Naive single-link propagation works for v1.0 even without alternate_paths populated. The "smart" version layers on as topology is enriched. Don't block v1.0 on perfect reachability. |
| Air-gapped deployment is stricter than expected (no NPM at build, no Docker Hub) | Build images once on a connected machine, then `docker save` to tar and load on the target. Document the offline build flow in `README.md`.                                           |
| User adoption fails — directors still call instead of opening the tool           | After v1.0 ships, sit with one director for 30 min during a real cut. Watch what they do. Iterate. (See "The Assignment.")                                                            |
| Project takes longer than estimated (very likely for solo evening/weekend work)  | Phases are intentionally shippable on their own. v1.0 without the dashboard is still useful. Don't try to ship all phases at once.                                                    |

---

## 17. Dependencies

- Existing `dwh.fibergis_alarm_log` Postgres connection details + read-only credentials.
- LDAP service URL + bind credentials.
- A list of sites / devices / links from somewhere — even if it's a half-broken CSV.
- A deployment target (Linux VM, IP, port permission).
- ~80MB of disk space inside the container for Sudan PMTiles.

---

## 18. THE ASSIGNMENT

Before writing a single line of code, do this **one thing**:

**Find ONE specific regional manager or director — name them. Spend 30 minutes with them. Ask exactly one question: _"When you hear about a fiber cut, what's the FIRST thing you want to see in the next 60 seconds?"_ Write down their literal answer.**

That answer either confirms or breaks Premise #5 (the 30-second view contents). If they say something we already have on the wedge list, we're aligned. If they say something different — "I want to see which customers are affected," or "I want to see the SLA penalty exposure," or "I just want to know if the news is going to call us" — that's the real product, and we revise.

This is the single highest-leverage hour of work in this entire project. It costs nothing, it de-risks 6 weeks of build, and it gives you a sponsor quote you can reference at every later decision point. Do it before the code.

---

## 19. What I noticed about how you think

- You said: _"the dirctors might not know immediately the effects of a cut until they see it. this tool might not be used every day by everyone but there are individuals who would come to it once they hear a cut happen to see the effects."_ That's a precise behavioral description of episodic, executive use — not a category-level "decision makers need data" answer. That specificity is what changed the product from "monitoring dashboard" to "30-second impact viewer."

- You said: _"they trust what they get, the problem is they have to wait to get it and it isnt visual nor they can they dig through."_ This sentence is the entire product spec. You diagnosed the status quo as a **delivery problem**, not a **data problem**. Most engineers misdiagnose this and go build more data pipelines. You went straight to the medium.

- On Premise #3, you wrote: _"i actually don't know how they are connected or if they are activated in those areas, so if the system can be flexible to change what it thinks on a device and link when the ones near it go off it would be great."_ Instead of pretending the backup data exists or punting, you proposed editable topology. That's a designer's instinct — building a system whose accuracy grows with use, not one that demands perfect inputs on day one.

- You surfaced the air-gapped constraint **late** in the session. That's a near-catastrophic disclosure pattern — easy to forget, would have invalidated half the design — and you caught it before locking the doc. The lesson for future work: front-load infra constraints, they cascade through everything.

- You set up clean project scaffolding (Vite + React 19 + Express 5 ESM, proper MVC folder structure, Docker stubs) **before** asking for design help. That signals you take this seriously enough to do the boring prep work. It's also why we could move so fast in this session — we weren't designing in a vacuum.

---

**Status: APPROVED — 2026-05-18.**

---

## 20. NOT in scope (deferred work, explicit)

The following were considered and explicitly left out of v1.0:

- **Customer-impact dashboard** (subscribers / revenue at risk per cut). Requires CRM / billing integration. Defer — useful for v2.x.
- **SLA penalty calculation.** Requires contracts data. Defer.
- **Predictive analytics** (which links likely to fail next). Requires history + model. Out of scope, possibly never.
- **Multi-tenancy / multi-operator.** Single-org tool. Don't build for hypothetical Sudatel/MTN clones.
- **Mobile-native app.** Web only. PWA with mobile-friendly CSS in v2.0 is enough.
- **Email/SMS alerting.** Directors already get WhatsApp pings — we're not the alert source.
- **Auto-dispatch of field teams.** Out of scope; that's a separate operations product.
- **NetFlow / SNMP integration.** DWH alarm log is the only data source for v1.0 (§6).
- **Real-time traffic counters** (Gbps per link). Not in the DWH; defer.
- **Distribution to other Zain operating companies.** Single-deploy for Zain Sudan only.
- **Last-Event-ID SSE catch-up** (locked in A6 as TODO-only). Heartbeat-only baseline ships in v1.0.
- **Backpressure handling for slow SSE clients.** Same as above.
- **Auth refresh tokens** (locked in A4). Hard kick to login on JWT expiry is the v1.0 behavior.

## 21. What already exists (reuse map)

**"Port" here means "use as a working reference for behavior, then rewrite cleanly."**
The `old-website/` code works — that's why it's valuable — but it isn't clean. It
has ad-hoc filter strings instead of Zod, no standardized error response shape, no
`request_id` correlation in logs, mixed concerns inside controllers, and React 17
patterns that don't fit React 19. When porting, **study the old flow to understand
the behavior** (the LDAP bind sequence, the alarm filter logic, the severity
ordering, the lat/lng for the initial map view), **then write the new file from
scratch** using the §9 conventions (API shape A7, error handler B1, logging B4,
auth A4, token system P5, etc.). Copy-paste is not the goal. Behavior parity plus
clean code is.

The `old-website/` folder is the inheritance — port these, don't re-derive:

| Old file                                                                                                                                                                          | What to reuse                                                                 | How                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [old-website/backend/services/alarm.service.js](old-website/backend/services/alarm.service.js)                                                                                    | Working `dwh.fibergis_alarm_log` SELECTs, severity ordering, pagination shape | Port the SQL into Drizzle raw queries. Replace ad-hoc filter strings with Zod-validated input. |
| [old-website/backend/controllers/alarm.controller.js](old-website/backend/controllers/alarm.controller.js) + [routes/alarm.routes.js](old-website/backend/routes/alarm.routes.js) | REST handler shape, error-response examples                                   | Port the route shapes onto the A7 conventions.                                                 |
| [old-website/backend/db/db.js](old-website/backend/db/db.js)                                                                                                                      | `pg` connection pool pattern                                                  | Replicate as `dwhPool` (read-only). Add `appPool`.                                             |
| [old-website/server.js:122-166](old-website/server.js#L122-L166)                                                                                                                  | Working LDAP bind + JWT mint                                                  | Port wholesale. Already validated against `@sd.zain.com`.                                      |
| [old-website/src/services/mapService.js](old-website/src/services/mapService.js)                                                                                                  | Sudan center coords + zoom for the initial map view                           | Lift the constants. Throw away the Leaflet API and use MapLibre.                               |
| [old-website/src/components/Alarms/ActiveAlarms.js](old-website/src/components/Alarms/ActiveAlarms.js)                                                                            | Timestamp formatting, severity → CSS class mapping                            | Port the formatter helpers. UI layer is being rebuilt.                                         |

Do NOT port: the Neo4j service (`src/services/neo4jService.js`), the broken dependent-nodes overlay, the hardcoded grey-dashed-line in [MapView.js:27-36](old-website/src/components/Map/MapView.js#L27-L36), the mock dashboard cards in [Dashboard.js](old-website/src/pages/Dashboard.js).

## 22. Implementation TODOs (deferred work captured)

Tracked here because there's no `TODOS.md` yet. Create one in week 1 and migrate these.

1. **Add Last-Event-ID SSE catch-up + ring buffer** — only if real-world reconnect gaps become a noticed problem (A6C deferral).
2. **Backpressure / slow-client drop for SSE** — only if observed (A6C deferral).
3. **Refresh token / silent re-auth** — only if 8-hour-kick is too disruptive in practice (A4 deferral).
4. **Customer-impact overlay on the map** (subscribers affected per cut) — when CRM access is granted.
5. **PostGIS spatial index review** — add `GIST` indexes on `sites.geom` and `links.geom` after first dashboard query plans show actual bottlenecks.
6. **Migration drift CI check** — ensure migrations file = live schema dump.
7. **Replace `is_root BOOLEAN` with `network_roots` join table** if multi-root logic turns out to need per-region metadata beyond a flag.

## 23. Failure modes (per the eng review)

| Failure mode                                                                      | Has test?                   | Error handling?                                 | User sees?                                 | Critical gap?                                    |
| --------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------- | ------------------------------------------ | ------------------------------------------------ |
| Reachability returns wrong status (algorithm bug, A1)                             | ✅ Regression suite §12.5   | ✅ Two-pass BFS                                 | Wrong color on map                         | No                                               |
| Reachability hangs on a cyclic graph                                              | ✅ Cycle test §12.5         | ✅ Visited set                                  | Browser freezes                            | No                                               |
| DWH connection drops                                                              | ⚠️ Integration test needed  | ✅ Exponential backoff                          | Banner: "Alarm data delayed"               | No                                               |
| App DB connection drops                                                           | ⚠️ Integration test needed  | ✅ Health endpoint + UI fallback                | "Service starting" page + auto-retry       | No                                               |
| LDAP unreachable from app host                                                    | ⚠️ Manual test only         | ✅ `AUTH_LOCAL_ONLY` fallback                   | "Login server unavailable, contact admin"  | No                                               |
| JWT expires mid-SSE-stream                                                        | ✅ Unit test (A4)           | ✅ `reauth` event + kick                        | Redirect to /login                         | No                                               |
| PMTiles Range header stripped by reverse proxy                                    | ✅ Smoke test (A3)          | ❌ — fails silently with 80MB fetch             | Slow map load, no error                    | **POTENTIAL CRITICAL GAP** if smoke test missing |
| Topology lookup fails to resolve alarm (no FiberlinkSite_ID, no NEs, no Site IDs) | ⚠️ Unit test needed         | ✅ Log + skip topology side                     | No map change; alarm still in ticker       | No                                               |
| `FIBER_CUT_ALARM_NAME` env var unset                                              | ✅ Startup validation (Zod) | ✅ Safe default: no alarms trigger reachability | Reachability passive; admin warned in logs | No                                               |
| DWH returns timestamps in unexpected TZ                                           | ⚠️ Confirm in week 1 (A8)   | Needs explicit conversion                       | All dashboard numbers off by N hours       | **CRITICAL until A8 is answered**                |

**One critical gap pending**: A8 (timezone). Must be resolved week 1.

## 24. Worktree parallelization strategy

| Step                                                                                    | Modules touched                                                  | Depends on |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------- |
| S1. Backend bootstrap (Express+helmet+zod+pino+drizzle, two DB pools, OpenAPI scaffold) | `backend/src/config`, `backend/src/db`, `backend/src/middleware` | —          |
| S2. Auth (LDAP+local, JWT middleware, /login, /logout, /me)                             | `backend/src/auth`, `backend/src/middleware`                     | S1         |
| S3. DWH adapter + alarm poller + event bus + SSE endpoints                              | `backend/src/services/dwh`, `backend/src/streams`                | S1         |
| S4. Topology services (sites/devices/links CRUD + reachability BFS + hull)              | `backend/src/services/topology`                                  | S1         |
| S5. Frontend bootstrap (Vite+Tailwind+router+TanStack+API client+ErrorBoundary)         | `frontend/src/lib`, `frontend/src/components/shared`             | —          |
| S6. Map page (MapLibre+PMTiles+layers+overlay+detail modal)                             | `frontend/src/pages/Map`                                         | S5, S3, S4 |
| S7. Dashboard tab (real Postgres aggregations + charts)                                 | `frontend/src/pages/Dashboard`, `backend/src/services/dashboard` | S5, S3     |
| S8. Admin / topology editor                                                             | `frontend/src/pages/Admin`, `backend/src/services/topology`      | S5, S4     |
| S9. Test harness (vitest + supertest + playwright + testcontainers)                     | `tests/`, root CI                                                | S1, S5     |

**Parallel lanes:**

- **Lane A**: S1 → S2 → S3 (backend backbone + auth + DWH ingestion)
- **Lane B**: S5 (frontend bootstrap, can start immediately, no backend dep)
- **Lane C**: S9 (test infra, can start in parallel with S1 and S5)
- **Lane D**: S4 (topology services) — depends only on S1, parallel with S2/S3
- **Lane E**: S6 (map page) — waits on S3+S4+S5
- **Lane F**: S7 (dashboard) — waits on S3+S5, parallel with S6
- **Lane G**: S8 (admin) — waits on S4+S5, parallel with S6/S7

Execution order: launch A, B, C, D in parallel from day 1. As they merge, launch E, F, G in parallel. Solo-dev reality: you'll work serially across these but the dependency map tells you what NOT to start prematurely.

**Conflict flags:** S2 and S3 both touch `backend/src/middleware/` (auth middleware). Sequence them OR coordinate file ownership.

## 25. Implementation tasks (synthesized from review findings)

Derived from this review. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~2h / CC: ~30min)** — Reachability — Implement two-pass BFS per §9 with cycle visited-set and unit tests for empty roots, simple chain, multi-root, cycle, MAIN-down/BACKUP-up, all-paths-down, disconnected graph.

  - Surfaced by: A1 — algorithm bug fix
  - Files: `backend/src/services/topology/reachability.ts`, `backend/src/services/topology/__tests__/reachability.test.ts`
  - Verify: `npm run test backend/src/services/topology`

- [ ] **T2 (P1, human: ~30min / CC: ~10min)** — Schema — Add `is_root BOOLEAN` to `sites` table and seed Khartoum HQ as default root.

  - Surfaced by: A2 — week-1 blocker
  - Files: `backend/db/migrations/0001_init.sql`, `backend/db/seed.sql`
  - Verify: query for `SELECT * FROM sites WHERE is_root = true` returns ≥1 row.

- [ ] **T3 (P1, human: ~1h / CC: ~15min)** — PMTiles — Confirm Express static middleware serves Range requests; write smoke test asserting `curl -H 'Range: bytes=0-15' /tiles/sudan.pmtiles` returns 206.

  - Surfaced by: A3 — silent 80MB-on-every-load risk
  - Files: `backend/src/routes/tiles.ts`, `tests/integration/tiles.test.ts`
  - Verify: integration test passes; manual `curl -v -H 'Range: bytes=0-15' http://localhost:5000/tiles/sudan.pmtiles | head` shows 206 + 16 bytes.

- [ ] **T4 (P1, human: ~2h / CC: ~30min)** — Auth — JWT in localStorage, `Authorization: Bearer` header, 401 → wipe + redirect to /login, SSE reauth-event + close on expiry.

  - Surfaced by: A4 — auth spec underspecified
  - Files: `backend/src/auth/`, `frontend/src/lib/api-client.ts`, `frontend/src/lib/event-stream.ts`
  - Verify: e2e test loads /map with expired token, asserts redirect to /login?next=/map.

- [ ] **T5 (P1, human: ~30min / CC: ~10min)** — Env vars — Add Zod-validated startup config; `FIBER_CUT_ALARM_NAME` defaults to empty (no reachability triggers) until user fills it.

  - Surfaced by: §9 configuration table + premise 8
  - Files: `backend/src/config/env.ts`, `backend/.env.example`
  - Verify: starting backend with missing required vars exits with clear error.

- [ ] **T6 (P1, human: ~3h / CC: ~30min)** — Backup-aware regression test suite — Three known incidents replayed against the new reachability; each asserts correct color where the old site was wrong.

  - Surfaced by: §12.5 IRON RULE for regressions
  - Files: `tests/regression/backup-aware-*.test.ts`
  - Verify: all three pass; failing any blocks v1.0 acceptance.

- [ ] **T7 (P2, human: ~1h / CC: ~15min)** — Error handling — Global Express error middleware mapping to A7 shape; root ErrorBoundary + per-route boundaries; DWH-down banner; app-DB-down "Service starting" screen.

  - Surfaced by: B1 — full error strategy
  - Files: `backend/src/middleware/error-handler.ts`, `frontend/src/components/ErrorBoundary.tsx`, `frontend/src/components/SystemStatusBanner.tsx`
  - Verify: integration test kills DWH connection, asserts banner appears.

- [ ] **T8 (P2, human: ~2h / CC: ~30min)** — OpenAPI auto-generation — `@asteasolutions/zod-to-openapi` wired up; spec served at `/api/docs` (Swagger UI) and `/api/openapi.json`.

  - Surfaced by: A7 — handoff readiness
  - Files: `backend/src/openapi/`, `backend/src/routes/docs.ts`
  - Verify: GET /api/docs renders Swagger UI; every route in src/routes has a Zod schema.

- [ ] **T9 (P2, human: ~30min / CC: ~10min)** — URL state — `nuqs` integration for map viewport + filter state.

  - Surfaced by: B2 — shareable views
  - Files: `frontend/src/lib/url-state.ts`, `frontend/src/pages/Map/index.tsx`
  - Verify: pasting a URL into a new tab reproduces the same map view.

- [ ] **T10 (P2, human: ~30min / CC: ~10min)** — DB migration workflow — `npm run migrate` and `npm run migrate:down` documented in `backend/README.md`; no auto-migrate on container start.

  - Surfaced by: B3
  - Files: `backend/package.json`, `backend/README.md`
  - Verify: fresh container does NOT run migrations until `npm run migrate` is called.

- [ ] **T11 (P2, human: ~1h / CC: ~15min)** — Logging schema — Pino bindings + `AsyncLocalStorage` request-context for `request_id` correlation; field set per §B4 table.

  - Surfaced by: B4
  - Files: `backend/src/lib/logger.ts`, `backend/src/middleware/request-context.ts`
  - Verify: log lines contain all required fields in JSON output.

- [ ] **T12 (P2, human: ~1h / CC: ~15min)** — Alarm resolver — Map DWH alarm rows → topology link by FiberlinkSite_ID → Source/Sink_NE → Site_A/B_ID fallback chain; log unresolvable.

  - Surfaced by: new info on DWH view shape
  - Files: `backend/src/services/dwh/alarm-resolver.ts`, `backend/src/services/dwh/__tests__/`
  - Verify: unit test feeds sample rows (all variants from `database sample.txt`) and asserts correct mapping or warning.

- [ ] **T13 (P3, human: ~30min / CC: ~10min)** — Hull cache — Node Map keyed by sorted-affected-site-IDs; 10-min eviction.

  - Surfaced by: D4
  - Files: `backend/src/services/topology/hull-cache.ts`
  - Verify: repeated cuts to the same set hit the cache (visible in logs).

- [ ] **T14 (P3, human: ~1h / CC: ~15min)** — N+1 guard — pg_stat_statements check at startup; integration test asserting `GET /api/v1/sites` runs ≤2 queries.
  - Surfaced by: D3
  - Files: `tests/integration/n-plus-one.test.ts`
  - Verify: integration test passes.

## 26. Completion summary (eng review)

- Step 0: Scope Challenge — scope accepted as-is (no reduction needed)
- Architecture Review: 8 issues found (all addressed: A1-A8)
- Code Quality Review: 4 issues found (all addressed: B1-B4)
- Test Review: coverage diagram produced, 45 gaps identified, stack locked, regression IRON RULE applied for backup-aware status
- Performance Review: 4 issues found (D1 rejected per operator domain knowledge, D2-D4 addressed)
- NOT in scope: §20 written (12 items)
- What already exists: §21 written (6 reusable patterns from old-website)
- TODOS.md updates: §22 written (7 deferred items)
- Failure modes: §23 written (10 modes; 1 critical gap pending A8 timezone resolution)
- Outside voice: skipped (single-operator session, no Codex on Windows)
- Parallelization: 7 lanes (A-G), 4 parallel from day 1, 3 deferred-parallel after dependencies clear
- Lake Score: 12/14 recommendations chose complete option (high completeness posture)

## 27. Design review completion summary

- **Initial score:** 5/10 overall design completeness
- **Pass 1 (Information Architecture)**: 5/10 → 9/10. Locked sidebar layout (P1B), added ASCII layouts for /map, /login, /dashboard, /admin/topology, and detail modal.
- **Pass 2 (Interaction States)**: 4/10 → 9/10. Added full state matrix (loading / healthy-empty / partial / error) per screen, with explicit "All networks healthy" calm-day default for /map and explicit first-run empty state for /admin/topology.
- **Pass 3 (User Journey)**: 6/10 → 6/10. User chose to skip storyboard (P3B); wedge §5 stands.
- **Pass 4 (AI Slop Risk)**: 7/10 → 9/10. Locked hero-KPI + supporting-strip + data-tables dashboard pattern (P4A), explicit anti-pattern guidance.
- **Pass 5 (Design System Alignment)**: 3/10 → 10/10. Full token spec added: spacing scale, type scale, radii, shadows (incl. `shadow-glass` for KPI overlay), focus rings, z-index, motion durations + easing, CSS variables, brand accent (indigo-500) resolved.
- **Pass 6 (Responsive + a11y)**: 2/10 → 8/10. v1.0 desktop-only with polite mobile block (P6B). Full WCAG 2.2 AA a11y baseline mandatory: keyboard nav, screen-reader patterns for map + ticker + modal, focus rings, reduced-motion, axe-core in CI.
- **Pass 7 (Unresolved Decisions)**: Topology editor → table-driven (P7-1A confirmed). Ticker → auto-scroll marquee with click-to-pin (P7-2A). Theme → dark default with light toggle (P7-3C). §15 open questions #6 and #7 resolved.

**Overall design score: 5/10 → 9/10.**

**Mockups:** none generated — gstack design binary not available on Windows. ASCII layout diagrams stand in for visual references in the doc. If you want real mockups before coding, run on a system with the design binary or use Figma to mock against the locked token spec.

## GSTACK REVIEW REPORT

| Review        | Trigger               | Why                             | Runs | Status       | Findings                               |
| ------------- | --------------------- | ------------------------------- | ---- | ------------ | -------------------------------------- |
| CEO Review    | `/plan-ceo-review`    | Scope & strategy                | 0    | —            | —                                      |
| Codex Review  | `/codex review`       | Independent 2nd opinion         | 0    | —            | —                                      |
| Eng Review    | `/plan-eng-review`    | Architecture & tests (required) | 1    | CLEAR (PLAN) | 16 issues, 1 critical gap pending (A8) |
| Design Review | `/plan-design-review` | UI/UX gaps                      | 1    | CLEAR (PLAN) | score 5/10 → 9/10, 8 decisions added   |
| DX Review     | `/plan-devex-review`  | Developer experience gaps       | 0    | —            | —                                      |

- **UNRESOLVED:** 0 decisions left open across both reviews. All design and architecture decisions answered. One critical gap remains pending until you act on it: A8 timezone resolution with the DWH owner in week 1.
- **VERDICT:** ENG + DESIGN CLEARED — design doc is implementation-ready once the 5 week-1 blockers in §15 are answered. Build can begin.

---

## 28. Phased execution plan (for AI implementers)

Each phase is sized to fit comfortably in a single Claude Code session without losing context. Each phase:

- Names the DESIGN.md sections to read first (minimal context fetch — not the whole doc)
- Lists concrete files to create / change
- Maps to the §25 task list (T1-T14) where applicable
- Has a single verification step that proves the phase is done
- Ships something runnable at the end (not "scaffolding for a future thing")

Run phases sequentially. Do not skip ahead — each phase's verification gates the next.

**Context budget legend:** S = light (read 1-2 sections), M = medium (read 3-4 sections), L = heavy (read 5+ sections). Stay under L per phase.

**For GitHub-Actions agents (`@claude` on issues):** the runner cannot reach the
real DWH, LDAP, or any internal Zain network address. Verify steps that depend on
live services must be substituted with testcontainers + mocks per **§12.5 → CI
verification reality**. The fully-live `docker compose up` test only makes sense
on the repo owner's laptop or the deployment VM, and is an explicit handoff item
listed in the PR description, not a CI gate.

---

### Phase 0 — Human prep (no AI work)

**Goal:** unblock the 5 week-1 questions before any code is written. Answer the §18 assignment.

**Deliverables (you, not the AI):**

- §15 Q1: a named site marked `is_root = true` (e.g., Khartoum HQ).
- §15 Q2: DWH `OccurrenceTime` confirmed timezone (UTC or Africa/Khartoum).
- §15 Q3: LDAP reachability from the deployment host (yes/no + fallback decision).
- §15 Q4: rough DWH new-row latency in seconds.
- §15 Q5: pointer to whatever topology data exists (CSV, Excel, "none — start empty").
- §18: a one-paragraph quote from one director answering "what's the FIRST thing you want to see in the next 60 seconds when a cut happens?"

**Gate:** all five answered + the director quote in hand → start Phase 1. Don't compress this step.

---

### Phase 1 — Backend skeleton + DB tooling

**Goal:** `npm run dev` boots Express, two pg pools connect, migrations apply against a real PostGIS container, /api/v1/health returns 200.

**Read first:** §9 Backend, §9 Databases, §9 Logging schema, §9 Configuration env vars, §13 DB migrations. (Context: M)

**Build:**

- `backend/src/config/env.ts` — Zod-validated env loader (T5)
- `backend/src/db/dwh-pool.ts` — read-only pg pool to DWH
- `backend/src/db/app-pool.ts` — read-write pg pool to app DB
- `backend/src/db/migrations/0001_init.sql` — sites, devices, links, alternate_paths, users, topology_audit, alarm_acks, incident_notes, saved_views, incident_notes (T2)
- `backend/src/lib/logger.ts` — Pino + AsyncLocalStorage request_id (T11)
- `backend/src/middleware/request-context.ts`
- `backend/src/middleware/error-handler.ts` — AppError class + global handler (T7 backend half)
- `backend/src/routes/health.ts` — `/api/v1/health` returns DB connectivity status
- `backend/package.json` — `npm run migrate`, `migrate:down` scripts (T10)
- `docker-compose.dev.yaml` — **DEV-ONLY**, runs just the `app-db` service (`postgis/postgis:16-3.4-alpine`). The app itself runs locally via `npm run dev`. Production Dockerfile is deferred to Phase 9 — there's no point building a shippable image until the app actually does something.
- `.env.example`

**Tasks closed:** T2, T5, T7 (backend), T10, T11

**Verify:**

```
docker compose up -d app-db
npm run migrate
npm run dev
curl http://localhost:5000/api/v1/health
# → { "status": "ok", "dwh": "connected", "app_db": "connected" }
```

**Starter prompt:**

> Read DESIGN.md §9 backend, §9 databases, §9 logging, §9 configuration, §13 distribution, §25 tasks T2/T5/T7/T10/T11. Implement Phase 1 from §28. After each file, show me the diff and wait for approval before moving on.

**Context budget:** M. Ships: bootable backend with DBs.

---

### Phase 2 — Auth (LDAP + JWT + 8h kick)

**Goal:** users can log in via LDAP, get a JWT, hit a protected route. Expired tokens kick to /login.

**Read first:** §9 Auth row, §10 IA (login layout), §21 reuse map (LDAP code in old-website/server.js). (Context: S)

**Build:**

- `backend/src/auth/ldap.ts` — port from `old-website/server.js:122-166`
- `backend/src/auth/jwt.ts` — sign + verify, 8h TTL from env
- `backend/src/auth/bcrypt.ts` — local-fallback auth (gated on `AUTH_LOCAL_ONLY`)
- `backend/src/middleware/auth.ts` — verify JWT, attach `req.user`
- `backend/src/routes/auth.ts` — `POST /api/v1/auth/login`, `POST /logout`, `GET /me`
- Tests: valid token, expired token, malformed token, LDAP unreachable fallback

**Tasks closed:** T4 (backend half)

**Verify:**

```
curl -X POST /api/v1/auth/login -d '{"username":"...","password":"..."}'
# → { "token": "eyJ..." }
curl -H "Authorization: Bearer eyJ..." /api/v1/me
# → { "user": { ... } }
# wait 8 hours OR shorten JWT_TTL_SECONDS=5, retry → 401 UNAUTHENTICATED
```

**Starter prompt:**

> Read DESIGN.md §9 auth row, §21 reuse map. Implement Phase 2 from §28: LDAP + JWT auth, 8h TTL, no refresh token, 401 wipes context. Port from old-website/server.js where noted.

**Context budget:** S. Ships: working auth.

---

### Phase 3 — DWH adapter + alarm poller + event bus

**Goal:** background worker polls DWH every 5s, new alarms hit an in-memory event bus. Alarm resolver maps DWH rows to topology links via the fallback chain.

**Read first:** §9 Real-time architecture, §7 premise 8 (FIBER_CUT_ALARM_NAME), §21 reuse map (alarm.service.js). (Context: M)

**Build:**

- `backend/src/services/dwh/poller.ts` — `setInterval` + `WHERE OccurrenceTime > last_seen`, exponential backoff
- `backend/src/services/dwh/alarm-resolver.ts` — FiberlinkSite_ID → Source_NE/Sink_NE → Site_A/B_ID fallback (T12)
- `backend/src/services/dwh/event-bus.ts` — small in-process EventEmitter
- `backend/src/services/dwh/queries.ts` — port from `old-website/backend/services/alarm.service.js`
- Tests with fixtures from your `database sample.txt` (every alarm-row variant)

**Tasks closed:** T12

**Verify:**

```
# With the real DWH connected:
NODE_ENV=development npm run dev
# Logs show: "alarm_received { Log_Serial_Number: 12345, ... }" within 10s of new DWH rows
# Unresolvable alarms log a warning, don't crash
```

**Starter prompt:**

> Read DESIGN.md §9 real-time, §7 premise 8, §21 reuse map for alarm.service.js. Implement Phase 3 from §28: DWH poller + alarm resolver + event bus. Use fixtures from old-website's database sample.txt for tests.

**Context budget:** M. Ships: alarms flowing into the bus.

---

### Phase 4 — Reachability engine + hull cache + regression suite

**Goal:** two-pass BFS works. Three regression tests pass against known historical incidents. PostGIS hull computation cached.

**Read first:** §9 Backup-aware reachability, §9 Affected-region polygon, §12.5 testing strategy (CRITICAL regression suite). (Context: S)

**Build:**

- `backend/src/services/topology/reachability.ts` — two-pass BFS (T1)
- `backend/src/services/topology/hull-cache.ts` — sorted-site-IDs key, 10-min eviction (T13)
- `backend/src/services/topology/affected-region.ts` — PostGIS ST_ConcaveHull + ST_Buffer wrapper
- `backend/src/services/topology/__tests__/reachability.test.ts` — all 7 unit scenarios from §25 T1
- `tests/regression/backup-aware-1-cascading-false-positive.test.ts`
- `tests/regression/backup-aware-2-degraded-not-down.test.ts`
- `tests/regression/backup-aware-3-real-historical-incident.test.ts` (pick the case with a senior engineer)

**Tasks closed:** T1, T6, T13

**Verify:**

```
npm test backend/src/services/topology
# 7/7 unit tests pass
npm test tests/regression
# 3/3 regression tests pass — IRON RULE: any failure blocks v1.0
```

**Starter prompt:**

> Read DESIGN.md §9 reachability, §9 affected-region, §12.5 testing CRITICAL regression. Implement Phase 4 from §28: two-pass BFS, hull cache, and the 3 critical regression tests. Pick test fixtures with me — I'll provide one real historical incident.

**Context budget:** S. Ships: provably-correct backup-aware status.

---

### Phase 5 — SSE endpoints + topology broadcasting

**Goal:** clients connect to `/api/v1/stream/alarms` and `/api/v1/stream/topology` via `EventSource`, receive live events, get kicked on token expiry. 25s heartbeat keeps connections alive.

**Read first:** §9 Real-time architecture, §9 SSE resilience baseline, §9 Auth row (reauth-event behavior). (Context: S)

**Build:**

- `backend/src/streams/sse-base.ts` — opens a stream, heartbeat, auth check per write
- `backend/src/streams/alarms.ts` — subscribes to event bus, writes alarm events
- `backend/src/streams/topology.ts` — subscribes to reachability output, writes topology_status events
- `backend/src/routes/stream.ts` — mounts both
- Tests: connect, receive event, expire token mid-stream → `event: reauth` + close

**Tasks closed:** (no T# — comes from §9 baseline)

**Verify:**

```
# In one terminal:
curl -N -H "Authorization: Bearer eyJ..." http://localhost:5000/api/v1/stream/alarms
# Wait for an alarm in DWH, see it stream through
# Wait 25s, see a ": ping" comment heartbeat
```

**Starter prompt:**

> Read DESIGN.md §9 real-time, §9 SSE resilience, §9 auth (reauth behavior). Implement Phase 5 from §28: SSE streams for alarms + topology, heartbeat, token-expiry kick.

**Context budget:** S. Ships: live push pipeline.

---

### Phase 6 — REST endpoints + OpenAPI + N+1 guard

**Goal:** all CRUD endpoints for sites/devices/links/alternate_paths/alarms exist with Zod validation. Swagger UI at `/api/docs`. N+1 guard verifies no list endpoint runs > 2 queries.

**Read first:** §9 API conventions, §9 Query conventions, §10 IA (which routes the FE will hit). (Context: M)

**Build:**

- `backend/src/routes/sites.ts`, `devices.ts`, `links.ts`, `alternate-paths.ts`, `alarms.ts` (read DWH)
- `backend/src/schemas/*.ts` — Zod schemas, both for validation and OpenAPI generation (T8)
- `backend/src/openapi/registry.ts` — `@asteasolutions/zod-to-openapi` setup
- `backend/src/routes/docs.ts` — Swagger UI + openapi.json
- `tests/integration/n-plus-one.test.ts` — query-count assertion per endpoint (T14)

**Tasks closed:** T8, T14

**Verify:**

```
curl http://localhost:5000/api/docs   # → renders Swagger UI
curl http://localhost:5000/api/v1/sites | jq .pagination
npm test tests/integration/n-plus-one
# all list endpoints <= 2 queries
```

**Starter prompt:**

> Read DESIGN.md §9 API conventions, §9 query conventions, §10 IA. Implement Phase 6 from §28: REST endpoints with Zod, OpenAPI auto-gen, N+1 guard test.

**Context budget:** M. Ships: full backend surface for the frontend.

---

### Phase 7 — Frontend scaffold + login + chrome

**Goal:** Vite + React + Tailwind + Router + TanStack Query + ErrorBoundary + URL-state + api-client all wired. `/login` works end-to-end. Sidebar chrome renders on authed routes. Mobile-block screen appears < 1024 px.

**Read first:** §9 Frontend stack, §10 IA (chrome + /login layout), §11 visual direction, §11 design tokens (all of P5), §11.5 responsive + a11y. (Context: L — but worth it; this is the foundation for every frontend phase.)

**Build:**

- `frontend/tailwind.config.js` + `frontend/src/index.css` — design tokens from §11 (CSS variables, theme switching)
- `frontend/src/lib/api-client.ts` — fetch wrapper, 401 → wipe localStorage + `/login?next=...` (T4 FE half)
- `frontend/src/lib/event-stream.ts` — EventSource wrapper, reauth handling
- `frontend/src/lib/url-state.ts` — `nuqs` integration (T9)
- `frontend/src/components/ErrorBoundary.tsx` (T7 FE half)
- `frontend/src/components/SystemStatusBanner.tsx` — DWH-down + app-DB-down banners
- `frontend/src/components/Sidebar.tsx` — collapsible 64/240px (P1B)
- `frontend/src/components/MobileBlock.tsx` — <1024px polite block (P6B)
- `frontend/src/pages/Login.tsx` — centered card, no marketing
- `frontend/src/router/index.tsx` — React Router, route guards, mobile-block guard
- `frontend/src/App.jsx` — replace placeholder

**Tasks closed:** T4 (FE half), T7 (FE half), T9

**Verify:**

- `npm run dev` → open `localhost:3000` → /login renders
- Log in → redirect to /map (placeholder) → sidebar visible
- Resize browser to <1024 px → mobile block appears
- Expire JWT in localStorage → next nav → redirected to /login?next=/map

**Starter prompt:**

> Read DESIGN.md §9 frontend, §10 IA (chrome + /login), §11 visual direction + tokens, §11.5 responsive + a11y. Implement Phase 7 from §28: frontend scaffold with auth flow, sidebar chrome, mobile block, error boundaries, URL state. Apply the full design token CSS variables from §11.

**Context budget:** L. Ships: frontend that you can navigate.

---

### Phase 8 — Map page (the wedge — most important phase)

**Goal:** `/map` renders the Sudan PMTiles map, sites as green/amber/red dots, links as colored polylines, affected-region as red fill, KPI overlay, scrolling alarms ticker, click-site detail modal. Live updates via SSE.

**Read first:** §5 wedge, §9 backend map data row (PMTiles serving), §9 reachability + affected-region, §9 real-time architecture, §10 IA `/map` layout + detail modal, §10.5 states for `/map`, §11 ticker behavior, §11 design tokens. (Context: L)

**Build:**

- `backend/src/routes/tiles.ts` — `express.static('backend/public/tiles')` with Range support smoke test (T3)
- `backend/public/tiles/sudan.pmtiles` — generate via tippecanoe from Geofabrik Sudan OSM extract
- `frontend/public/fonts/inter.woff2`, `jetbrains-mono.woff2` — self-hosted
- `frontend/src/pages/Map/index.tsx` — full layout
- `frontend/src/pages/Map/MapCanvas.tsx` — MapLibre + PMTiles loader + sites/links/affected-region layers
- `frontend/src/pages/Map/KpiOverlay.tsx` — glass panel, 4 KPIs
- `frontend/src/pages/Map/AlarmsTicker.tsx` — auto-scroll marquee, pause-on-hover, click-to-pin (P7-2A), `prefers-reduced-motion` fallback
- `frontend/src/pages/Map/SiteDetailModal.tsx` — 480px right sidesheet, status + downstream + alarms + actions
- `frontend/src/pages/Map/MapAriaTable.tsx` — hidden table mirror for screen readers
- `frontend/src/pages/Map/states/HealthyEmpty.tsx`, `Loading.tsx`, `DwhDown.tsx`

**Tasks closed:** T3

**Verify:**

- Open `/map` → tiles load (verify with `curl -H 'Range: bytes=0-15' /tiles/sudan.pmtiles` returns 206)
- Trigger a fiber-cut alarm in DWH → see SSE event → site turns red within 15 s
- Click a degraded site → modal opens with status + downstream
- Browser DevTools Lighthouse → first-contentful-paint ≤ 2.5 s (§14 acceptance)
- Tab through the page → focus rings visible, escape closes modal

**Starter prompt:**

> Read DESIGN.md §5 wedge, §9 map data + reachability + real-time, §10 /map layout + detail modal, §10.5 /map states, §11 ticker, §11 tokens. Implement Phase 8 from §28: the map page. Generate the Sudan PMTiles file (or stub with a small extract if not yet ready). This is the wedge — get it right.

**Context budget:** L. Ships: the actual product. v1.0 demo-able.

---

### Phase 9 — A11y polish + Playwright E2E + offline build verification

**Goal:** axe-core passes in CI. The three regression scenarios are reproducible in Playwright. `docker compose up` on a machine with no internet boots a fully working app.

**Read first:** §11.5 a11y, §12.5 testing strategy, §13 distribution, §14 acceptance criteria. (Context: M)

**Build:**

- `tests/e2e/login.spec.ts`, `map-cut.spec.ts`, `detail-modal.spec.ts`, `offline-bundle.spec.ts`
- `playwright.config.ts` with axe-core plugin
- **`Dockerfile`** (the production artifact, deferred from Phase 1 on purpose):
  - Stage 1 `frontend-build`: `node:20-alpine`, install + `vite build` → `/app/frontend/dist`
  - Stage 2 `backend-build`: install + bundle backend (esbuild or tsc) → `/app/backend/dist`
  - Stage 3 `runtime`: `node:20-alpine` (slim), copy backend dist + frontend dist + bundled assets (fonts, icons, **sudan.pmtiles as the very last COPY layer per D2**) → `CMD ["node", "backend/dist/server.js"]`
  - Runs as a non-root `node` user. No build tools or NPM cache in the final image.
- **`docker-compose.yaml`** (production, separate from `docker-compose.dev.yaml`): `app` service built from the Dockerfile + `app-db` service. One file the operator runs with `docker compose up`. DWH connection comes from `.env`.
- `README.md` — offline build flow: build on a connected machine, `docker save neo-fiber:vX.Y.Z | gzip > neo-fiber.tar.gz`, `scp` to the target, `docker load`. Step-by-step so it can be handed to an ops person.
- Smoke test: pull the saved image onto a machine with no internet, `docker compose up`, verify everything works end-to-end.

**Verify (all §14 acceptance criteria):**

- [ ] First-contentful-paint of `/map` ≤ 2.5 s on cold cache
- [ ] Alarm row → visual update ≤ 15 s end-to-end
- [ ] All dashboard numbers match manual SQL within ±0% (deferred to Phase 11)
- [ ] 3 backup-aware regression tests pass (Phase 4 — re-verify)
- [ ] `docker compose up` on a machine with no internet succeeds
- [ ] axe-core: 0 serious/critical violations on every route

**Starter prompt:**

> Read DESIGN.md §11.5 a11y, §12.5 testing, §13 distribution, §14 acceptance. Implement Phase 9 from §28: Playwright E2E suite, axe-core CI, finalize Dockerfile + offline build. Run §14 acceptance checklist and report any reds.

**Context budget:** M. **Ships: v1.0.**

---

### Phase 10 — v1.5 Dashboard (real aggregations from DWH)

**Goal:** `/dashboard` tab wired to real Postgres aggregations. Zero mock data. Hero KPI + supporting strip + data tables pattern (P4A). All numbers match manual SQL.

**Read first:** §11 dashboard layout pattern, §10 dashboard IA, §10.5 dashboard states. (Context: M)

**Build:**

- `backend/src/services/dashboard/aggregations.ts` — SQL for: Network Availability %, MTTR (from OccurrenceTime/ClearanceTime), top recurring issues, MTTR by region, alarms over time, fiber-cut history
- `backend/src/routes/dashboard.ts` — REST endpoints
- `frontend/src/pages/Dashboard/index.tsx` — hero KPI layout, sub-tabs (alarms / regions / fiber)
- `frontend/src/pages/Dashboard/HeroKpi.tsx` — Network Availability with sparkline
- `frontend/src/pages/Dashboard/AlarmsOverTime.tsx`, `TopRecurringIssues.tsx`, `MttrByRegion.tsx` (Recharts)
- Acceptance test: every number on the page produced by a single SQL query that an engineer can run manually and compare.

**Verify:**

- Compare each KPI / chart against `psql` results — ±0%
- No mock data anywhere in `frontend/src/pages/Dashboard/`

**Context budget:** M. Ships: v1.5.

---

### Phase 11 — v1.7 Topology editor + alternate paths + CSV import + audit

**Goal:** engineers can edit sites/devices/links via tables, declare alternate paths, import CSV, all changes audited.

**Read first:** §9 databases (alternate_paths + topology_audit), §10 `/admin/topology` IA, §10.5 admin first-run state, §11 (no graph view, tables only). (Context: M)

**Build:**

- `backend/src/routes/admin/sites.ts`, `devices.ts`, `links.ts`, `alternate-paths.ts` — full CRUD with audit middleware
- `backend/src/services/admin/csv-import.ts`
- `backend/src/services/admin/audit.ts`
- `frontend/src/pages/Admin/Topology.tsx` — sortable filterable inline-editable tables
- `frontend/src/pages/Admin/AlternatePaths.tsx`
- `frontend/src/pages/Admin/Audit.tsx`
- First-run empty state: `[Import CSV]` + `[Add site]` from §10.5

**Verify:** declare an alternate path, then take down a MAIN link in DWH → site goes AMBER not RED.

**Context budget:** M. Ships: v1.7.

---

### Phase 12 — v2.0 Polish (only after v1.0/1.5/1.7 are in real use)

**Goal:** time-scrubber, saved views, sharable URL views, mobile-friendly redesign, PDF export, dark-mode refinement, light-mode polish.

Do NOT start this phase until you've watched a real director use v1.0 during a real cut. The features here should be driven by what you actually saw fail or feel missing — not by this list.

**Context budget:** N/A. Driven by observation, not spec.

---

### How to drive this from Claude Code

For each phase, in a fresh session, paste the **Starter prompt** verbatim. The AI will read only the listed sections (not the whole doc), build only the listed files, and verify against the listed check. Don't ask it to "build the whole project" in one go — that loses context and ships sloppy work.

At the end of each phase, run the verification step manually. If green, start the next phase. If red, fix in the same session (the context is still warm).

**Suggested cadence:** 1 phase per evening, ~10-14 evenings to v1.0. Faster if you batch related phases.
