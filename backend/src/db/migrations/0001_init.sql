-- 0001_init.sql
-- Initial schema: sites, devices, links, alternate_paths, users, topology_audit,
-- alarm_acks, incident_notes, saved_views.
--
-- Notes from Phase 0 answers:
--   Q1: is_root has no default seed rows — admin UI designates roots.
--   Q2: TIMESTAMP WITHOUT TIME ZONE for DWH-mirroring columns (DWH stores
--       OccurrenceTime in local time; no conversion at the boundary).
--   Q5: Tables ship empty; admin topology editor fills them.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---- Users ---------------------------------------------------------------
-- Stores LDAP-synced users. Local admin accounts use the same table;
-- AUTH_LOCAL_ONLY=true in dev/CI bypasses LDAP and uses bcrypt-hashed app users.
CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  ldap_username  VARCHAR(255) NOT NULL UNIQUE,
  display_name   VARCHAR(255),
  role           VARCHAR(50)  NOT NULL DEFAULT 'viewer',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_login     TIMESTAMPTZ
);

-- ---- Topology: sites, devices, links -------------------------------------

CREATE TABLE sites (
  id               SERIAL PRIMARY KEY,
  site_id_external VARCHAR(255) UNIQUE,
  name             VARCHAR(255) NOT NULL,
  region           VARCHAR(255),
  state            VARCHAR(255),
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  geom             GEOGRAPHY(POINT, 4326),
  -- Phase 0 Q1: seeds empty; admin UI sets is_root=true on head sites.
  -- BFS reachability runs from ALL is_root=true sites (see DESIGN.md §9).
  is_root          BOOLEAN      NOT NULL DEFAULT false
);

CREATE TABLE devices (
  id                 SERIAL PRIMARY KEY,
  -- device_id_external matches DWH Source_NE / Sink_NE strings
  device_id_external VARCHAR(255) UNIQUE,
  site_id            INTEGER      NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name               VARCHAR(255) NOT NULL,
  type               VARCHAR(100),
  vendor             VARCHAR(100)
);

CREATE TABLE links (
  id                 SERIAL PRIMARY KEY,
  -- link_id_external matches DWH FiberlinkSite_ID
  link_id_external   VARCHAR(255) UNIQUE,
  source_device_id   INTEGER      NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  target_device_id   INTEGER      NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  ranking            VARCHAR(10)  NOT NULL CHECK (ranking IN ('MAIN', 'BACKUP', 'AUX')),
  capacity_gbps      DOUBLE PRECISION,
  geom               GEOGRAPHY(LINESTRING, 4326)
);

-- ---- Alternate paths ("topology gets smarter over time") -----------------
-- Engineers declare which links can serve as alternates for a device.
-- alternate_link_ids FK-integrity is advisory — Postgres arrays can't enforce it.
CREATE TABLE alternate_paths (
  id                 SERIAL    PRIMARY KEY,
  device_id          INTEGER   NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  alternate_link_ids INTEGER[] NOT NULL DEFAULT '{}',
  declared_by        INTEGER   REFERENCES users(id),
  declared_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Audit ---------------------------------------------------------------
CREATE TABLE topology_audit (
  id           SERIAL    PRIMARY KEY,
  user_id      INTEGER   REFERENCES users(id),
  action       VARCHAR(255) NOT NULL,
  before_state JSONB,
  after_state  JSONB,
  at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Alarm-side state (can't write to read-only DWH) ---------------------
-- alarm_log_serial = dwh.fibergis_alarm_log.Log_Serial_Number.
-- DWH is append-only with in-place row updates; serial is stable for the
-- row's lifetime and safe as a cross-reference. Confirmed A5.

CREATE TABLE alarm_acks (
  id               SERIAL  PRIMARY KEY,
  alarm_log_serial BIGINT  NOT NULL UNIQUE,
  user_id          INTEGER REFERENCES users(id),
  acked_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note             TEXT
);

CREATE TABLE incident_notes (
  id               SERIAL  PRIMARY KEY,
  alarm_log_serial BIGINT  NOT NULL,
  user_id          INTEGER REFERENCES users(id),
  body             TEXT    NOT NULL,
  at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- UI state ------------------------------------------------------------
CREATE TABLE saved_views (
  id      SERIAL  PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name    VARCHAR(255) NOT NULL,
  config  JSONB        NOT NULL DEFAULT '{}'
);

-- ---- Indexes (per §9 schema notes) --------------------------------------
CREATE INDEX alarm_acks_serial_idx    ON alarm_acks(alarm_log_serial);
CREATE INDEX incident_notes_serial_idx ON incident_notes(alarm_log_serial);
