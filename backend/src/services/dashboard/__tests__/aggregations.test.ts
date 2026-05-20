/**
 * Integration tests for dashboard aggregation queries.
 *
 * Uses testcontainers to spin up a real Postgres, creates a `dwh` schema
 * with a `fibergis_alarm_log` table matching the real view column set, and
 * seeds known rows so we can assert exact output.
 *
 * The real DWH is not reachable from CI (§12.5); this is the canonical
 * verification substitute — see Phase 10 PR notes.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import {
  queryNetworkAvailabilitySparkline,
  queryMttr,
  queryAlarmsOverTime,
  queryTopRecurringIssues,
  queryMttrByRegion,
  queryFiberCutHistory,
  type DateRange,
} from '../aggregations.js';

// ── Container setup ──────────────────────────────────────────────────────────

let container: StartedPostgreSqlContainer;
let pool: pg.Pool;

const DDL = `
CREATE SCHEMA IF NOT EXISTS dwh;

CREATE TABLE dwh.fibergis_alarm_log (
  "Log_Serial_Number"  TEXT,
  "Alarm_key"          INTEGER,
  "Alarm_Name"         TEXT,
  "Alarm_Severity"     TEXT,
  "Alarm_Source"       TEXT,
  "Status"             TEXT NOT NULL,
  "OccurrenceTime"     TIMESTAMPTZ NOT NULL,
  "ClearanceTime"      TIMESTAMPTZ,
  "DownTime"           TEXT,
  "LocationInformation" TEXT,
  "Contractor"         TEXT,
  "FiberlinkSite_ID"   TEXT,
  "FiberLinkSite_Name" TEXT,
  "Site_A_ID"          TEXT,
  "Site_A_Latitude"    TEXT,
  "Site_A_Longitude"   TEXT,
  "State"              TEXT,
  "Zone"               TEXT,
  "Vendor"             TEXT,
  "Site_Priority"      TEXT,
  "Is_Hub"             TEXT,
  "Is_VIP"             TEXT,
  "Site_B_ID"          TEXT,
  "Site_B_Latitude"    TEXT,
  "Site_B_Longitude"   TEXT,
  "Source_NE"          TEXT,
  "Sink_NE"            TEXT
);
`;

// Fixed reference window: 2025-01-01 → 2025-01-08 (7 full days = 168 hours)
// 3 distinct sites (A, B, C), each with one cleared alarm.
const SEED_SQL = `
INSERT INTO dwh.fibergis_alarm_log
  ("Log_Serial_Number","Alarm_Name","Alarm_Severity","Status",
   "OccurrenceTime","ClearanceTime","DownTime",
   "Site_A_ID","State","FiberlinkSite_ID")
VALUES
  -- Site A: 1-hour alarm on day 1 (Khartoum)
  ('1','T_ALOS','Major','Clear',
   '2025-01-01 08:00:00+00','2025-01-01 09:00:00+00','01:00:00',
   'SITE_A','Khartoum','A-B'),
  -- Site B: 2-hour alarm on day 2 (Kassala)
  ('2','T_ALOS','Major','Clear',
   '2025-01-02 10:00:00+00','2025-01-02 12:00:00+00','02:00:00',
   'SITE_B','Kassala','B-C'),
  -- Site C: 30-min alarm on day 3 (Khartoum) — different alarm name
  ('3','ETH_LOS','Minor','Clear',
   '2025-01-03 06:00:00+00','2025-01-03 06:30:00+00','00:30:00',
   'SITE_C','Khartoum','C-D'),
  -- Site A again: 45-min alarm on day 3 (for recurring issues check)
  ('4','T_ALOS','Major','Clear',
   '2025-01-03 14:00:00+00','2025-01-03 14:45:00+00','00:45:00',
   'SITE_A','Khartoum','A-B'),
  -- Unclaimed alarm (outside window, must NOT appear in range queries)
  ('5','T_ALOS','Major','Clear',
   '2024-12-15 00:00:00+00','2024-12-15 01:00:00+00','01:00:00',
   'SITE_X','Khartoum','X-Y');
`;

const RANGE: DateRange = {
  from: new Date('2025-01-01T00:00:00.000Z'),
  to: new Date('2025-01-08T00:00:00.000Z'),
};

// 7 days * 24h = 168 site-hours per site, 3 sites = 504 total site-hours
// Alarms in range: 1h (A) + 2h (B) + 0.5h (C) + 0.75h (A) = 4.25 hours total
// Availability = 1 - (4.25 / 504) = 0.99157... → 99.16%

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgis/postgis:16-3.4-alpine').start();
  pool = new pg.Pool({ connectionString: container.getConnectionUri() });
  await pool.query(DDL);
  await pool.query(SEED_SQL);
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('queryNetworkAvailabilitySparkline', () => {
  it('returns one data point per day in the range', async () => {
    const rows = await queryNetworkAvailabilitySparkline(pool, RANGE);
    // 7 days: Jan 1 → Jan 7 (inclusive, since "to" is Jan 8 00:00)
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({ day: expect.any(String), availability_pct: expect.any(Number) });
  });

  it('day-1 availability reflects the 1-hour alarm on SITE_A out of 3 sites * 24h', async () => {
    const rows = await queryNetworkAvailabilitySparkline(pool, RANGE);
    const day1 = rows.find((r) => r.day.startsWith('2025-01-01'));
    expect(day1).toBeDefined();
    // 1h downtime / (3 sites * 24h) * 100 = 1.39% downtime → 98.61% availability
    expect(day1!.availability_pct).toBeGreaterThan(98);
    expect(day1!.availability_pct).toBeLessThanOrEqual(100);
  });

  it('days with no alarms show 100% availability', async () => {
    const rows = await queryNetworkAvailabilitySparkline(pool, RANGE);
    // Days 4–7 have no alarms
    const day4 = rows.find((r) => r.day.startsWith('2025-01-04'));
    expect(day4!.availability_pct).toBe(100);
  });
});

describe('queryMttr', () => {
  it('computes average MTTR in minutes across all cleared alarms in range', async () => {
    const result = await queryMttr(pool, RANGE);
    // Cleared alarms: 60m, 120m, 30m, 45m → avg = 255/4 = 63.75 min
    expect(result.mttr_minutes).toBeCloseTo(63.75, 0);
    expect(result.sample_size).toBe(4);
  });
});

describe('queryAlarmsOverTime', () => {
  it('returns daily alarm counts in the range', async () => {
    const rows = await queryAlarmsOverTime(pool, RANGE);
    expect(rows.length).toBeGreaterThan(0);
    // Day 1: 1 alarm, Day 2: 1 alarm, Day 3: 2 alarms
    const day1 = rows.find((r) => r.day.startsWith('2025-01-01'));
    const day3 = rows.find((r) => r.day.startsWith('2025-01-03'));
    expect(day1?.count).toBe(1);
    expect(day3?.count).toBe(2);
  });

  it('excludes alarms outside the date range', async () => {
    const rows = await queryAlarmsOverTime(pool, RANGE);
    // Alarm #5 is in Dec 2024 — must not appear
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    expect(total).toBe(4); // only the 4 alarms in range
  });
});

describe('queryTopRecurringIssues', () => {
  it('returns top issues sorted by count descending', async () => {
    const rows = await queryTopRecurringIssues(pool, RANGE);
    expect(rows.length).toBeGreaterThan(0);
    // T_ALOS appears 3 times, ETH_LOS appears 1 time
    expect(rows[0].alarm_name).toBe('T_ALOS');
    expect(rows[0].count).toBe(3);
  });

  it('does not exceed the requested limit', async () => {
    const rows = await queryTopRecurringIssues(pool, RANGE, 1);
    expect(rows).toHaveLength(1);
  });
});

describe('queryMttrByRegion', () => {
  it('returns MTTR grouped by State', async () => {
    const rows = await queryMttrByRegion(pool, RANGE);
    const khartoum = rows.find((r) => r.region === 'Khartoum');
    const kassala = rows.find((r) => r.region === 'Kassala');
    expect(khartoum).toBeDefined();
    expect(kassala).toBeDefined();
    // Khartoum: (60 + 30 + 45) / 3 = 45 min
    expect(khartoum!.mttr_minutes).toBeCloseTo(45, 0);
    // Kassala: 120 / 1 = 120 min
    expect(kassala!.mttr_minutes).toBeCloseTo(120, 0);
  });
});

describe('queryFiberCutHistory', () => {
  it('returns only alarms matching the given alarm name', async () => {
    const rows = await queryFiberCutHistory(pool, RANGE, 'T_ALOS');
    expect(rows).toHaveLength(3); // alarms 1, 2, 4 — alarm 5 is out of range
    expect(rows.every((r) => r.alarm_name === 'T_ALOS')).toBe(true);
  });

  it('returns empty array when alarm name matches nothing', async () => {
    const rows = await queryFiberCutHistory(pool, RANGE, 'NONEXISTENT_ALARM');
    expect(rows).toHaveLength(0);
  });

  it('returns empty array when fiberCutAlarmName is empty', async () => {
    const rows = await queryFiberCutHistory(pool, RANGE, '');
    expect(rows).toHaveLength(0);
  });
});
