/**
 * Dashboard aggregation queries against dwh.fibergis_alarm_log.
 *
 * All functions accept a pg.Pool and a DateRange so they can be called
 * against either the real DWH pool or a testcontainers fixture.
 *
 * Formulas are documented inline so an engineer can replicate them in psql
 * and compare results. (§28 Phase 10 acceptance test requirement.)
 */

import type pg from 'pg';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DateRange {
  from: Date;
  to: Date;
}

export interface AvailabilityDay {
  day: string; // ISO date string 'YYYY-MM-DD'
  availability_pct: number;
}

export interface MttrResult {
  mttr_minutes: number;
  sample_size: number;
}

export interface AlarmDayCount {
  day: string; // ISO date string
  count: number;
}

export interface RecurringIssue {
  alarm_name: string;
  count: number;
  avg_mttr_minutes: number;
}

export interface MttrRegion {
  region: string;
  mttr_minutes: number;
  alarm_count: number;
}

export interface FiberCutEvent {
  log_serial_number: string;
  alarm_name: string;
  site_a_id: string | null;
  site_b_id: string | null;
  fiberlink_site_name: string | null;
  state: string | null;
  occurrence_time: Date;
  clearance_time: Date | null;
  down_time: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Count distinct sites that appear in the log for a given range.
 * Used as the denominator in availability calculations.
 * Falls back to 1 if no site data is present so we never divide by zero.
 */
async function countDistinctSites(pool: pg.Pool, range: DateRange): Promise<number> {
  const result = await pool.query<{ cnt: string }>(
    `SELECT COUNT(DISTINCT "Site_A_ID")::text AS cnt
       FROM dwh.fibergis_alarm_log
      WHERE "Site_A_ID" IS NOT NULL
        AND "OccurrenceTime" >= $1
        AND "OccurrenceTime" < $2`,
    [range.from, range.to],
  );
  return Math.max(1, parseInt(result.rows[0]?.cnt ?? '1', 10));
}

// ── Query functions ──────────────────────────────────────────────────────────

/**
 * Network Availability % per day across the given range.
 *
 * Formula per day:
 *   daily_downtime_hours = SUM(alarm_duration_hours) for cleared alarms on that day
 *   availability_pct = MAX(0, 100 - (daily_downtime_hours / (site_count * 24) * 100))
 *
 * 'site_count' = distinct Site_A_ID values observed in the full range
 * (stable denominator — avoids day-to-day noise from sites appearing/disappearing).
 *
 * Reproducing in psql (substitute $1/$2/$3):
 *   WITH days AS (SELECT generate_series($1::date,$2::date - 1,'1 day') AS day),
 *        dt AS (SELECT DATE("OccurrenceTime") d, SUM(EXTRACT(EPOCH FROM
 *               (COALESCE("ClearanceTime",NOW())-"OccurrenceTime"))/3600) h
 *               FROM dwh.fibergis_alarm_log
 *               WHERE "OccurrenceTime" >= $1 AND "OccurrenceTime" < $2
 *               GROUP BY 1)
 *   SELECT days.day, GREATEST(0,100-COALESCE(dt.h,0)/($3*24)*100)
 *   FROM days LEFT JOIN dt ON days.day=dt.d ORDER BY days.day;
 */
export async function queryNetworkAvailabilitySparkline(
  pool: pg.Pool,
  range: DateRange,
): Promise<AvailabilityDay[]> {
  const siteCount = await countDistinctSites(pool, range);

  const result = await pool.query<{ day: Date; availability_pct: string }>(
    `WITH day_series AS (
       SELECT generate_series(
         $1::timestamptz::date,
         ($2::timestamptz::date - INTERVAL '1 day')::date,
         INTERVAL '1 day'
       )::date AS day
     ),
     daily_downtime AS (
       SELECT
         "OccurrenceTime"::date AS day,
         SUM(
           EXTRACT(EPOCH FROM (
             COALESCE("ClearanceTime", $2::timestamptz) - "OccurrenceTime"
           )) / 3600
         ) AS downtime_hours
       FROM dwh.fibergis_alarm_log
       WHERE "OccurrenceTime" >= $1
         AND "OccurrenceTime" < $2
       GROUP BY 1
     )
     SELECT
       ds.day,
       GREATEST(0, 100 - COALESCE(dd.downtime_hours, 0) / ($3::numeric * 24) * 100
       )::numeric(6,2) AS availability_pct
     FROM day_series ds
     LEFT JOIN daily_downtime dd ON ds.day = dd.day
     ORDER BY ds.day`,
    [range.from, range.to, siteCount],
  );

  return result.rows.map((row) => ({
    day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10),
    availability_pct: parseFloat(row.availability_pct),
  }));
}

/**
 * Mean Time To Repair across all cleared alarms in the range.
 *
 * Formula:
 *   MTTR = AVG(ClearanceTime - OccurrenceTime) in minutes, for cleared alarms only
 *
 * Reproducing in psql:
 *   SELECT ROUND(AVG(EXTRACT(EPOCH FROM ("ClearanceTime"-"OccurrenceTime"))/60),2) AS mttr_minutes,
 *          COUNT(*) AS sample_size
 *   FROM dwh.fibergis_alarm_log
 *   WHERE "ClearanceTime" IS NOT NULL AND "OccurrenceTime">=$1 AND "OccurrenceTime"<$2;
 */
export async function queryMttr(pool: pg.Pool, range: DateRange): Promise<MttrResult> {
  const result = await pool.query<{ mttr_minutes: string; sample_size: string }>(
    `SELECT
       ROUND(AVG(
         EXTRACT(EPOCH FROM ("ClearanceTime" - "OccurrenceTime")) / 60
       ), 2)::text AS mttr_minutes,
       COUNT(*)::text AS sample_size
     FROM dwh.fibergis_alarm_log
     WHERE "ClearanceTime" IS NOT NULL
       AND "OccurrenceTime" >= $1
       AND "OccurrenceTime" < $2`,
    [range.from, range.to],
  );

  const row = result.rows[0];
  return {
    mttr_minutes: parseFloat(row?.mttr_minutes ?? '0'),
    sample_size: parseInt(row?.sample_size ?? '0', 10),
  };
}

/**
 * Alarm count per day over the range (all severities).
 *
 * Reproducing in psql:
 *   SELECT "OccurrenceTime"::date AS day, COUNT(*) AS count
 *   FROM dwh.fibergis_alarm_log
 *   WHERE "OccurrenceTime">=$1 AND "OccurrenceTime"<$2
 *   GROUP BY 1 ORDER BY 1;
 */
export async function queryAlarmsOverTime(
  pool: pg.Pool,
  range: DateRange,
): Promise<AlarmDayCount[]> {
  const result = await pool.query<{ day: Date; count: string }>(
    `SELECT
       "OccurrenceTime"::date AS day,
       COUNT(*)::text AS count
     FROM dwh.fibergis_alarm_log
     WHERE "OccurrenceTime" >= $1
       AND "OccurrenceTime" < $2
     GROUP BY 1
     ORDER BY 1`,
    [range.from, range.to],
  );

  return result.rows.map((row) => ({
    day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10),
    count: parseInt(row.count, 10),
  }));
}

/**
 * Top N recurring issues by alarm count, with avg MTTR.
 *
 * Reproducing in psql:
 *   SELECT "Alarm_Name", COUNT(*) AS count,
 *          ROUND(AVG(EXTRACT(EPOCH FROM ("ClearanceTime"-"OccurrenceTime"))/60),2) AS avg_mttr_minutes
 *   FROM dwh.fibergis_alarm_log
 *   WHERE "Alarm_Name" IS NOT NULL AND "OccurrenceTime">=$1 AND "OccurrenceTime"<$2
 *   GROUP BY 1 ORDER BY 2 DESC LIMIT $3;
 */
export async function queryTopRecurringIssues(
  pool: pg.Pool,
  range: DateRange,
  limit = 10,
): Promise<RecurringIssue[]> {
  const result = await pool.query<{
    alarm_name: string;
    count: string;
    avg_mttr_minutes: string | null;
  }>(
    `SELECT
       "Alarm_Name" AS alarm_name,
       COUNT(*)::text AS count,
       ROUND(AVG(
         CASE WHEN "ClearanceTime" IS NOT NULL
           THEN EXTRACT(EPOCH FROM ("ClearanceTime" - "OccurrenceTime")) / 60
         END
       ), 2)::text AS avg_mttr_minutes
     FROM dwh.fibergis_alarm_log
     WHERE "Alarm_Name" IS NOT NULL
       AND "OccurrenceTime" >= $1
       AND "OccurrenceTime" < $2
     GROUP BY 1
     ORDER BY COUNT(*) DESC
     LIMIT $3`,
    [range.from, range.to, limit],
  );

  return result.rows.map((row) => ({
    alarm_name: row.alarm_name,
    count: parseInt(row.count, 10),
    avg_mttr_minutes: parseFloat(row.avg_mttr_minutes ?? '0'),
  }));
}

/**
 * Average MTTR per region (State column) for cleared alarms.
 *
 * Reproducing in psql:
 *   SELECT "State" AS region,
 *          ROUND(AVG(EXTRACT(EPOCH FROM ("ClearanceTime"-"OccurrenceTime"))/60),2) AS mttr_minutes,
 *          COUNT(*) AS alarm_count
 *   FROM dwh.fibergis_alarm_log
 *   WHERE "State" IS NOT NULL AND "ClearanceTime" IS NOT NULL
 *     AND "OccurrenceTime">=$1 AND "OccurrenceTime"<$2
 *   GROUP BY 1 ORDER BY 2 DESC;
 */
export async function queryMttrByRegion(
  pool: pg.Pool,
  range: DateRange,
): Promise<MttrRegion[]> {
  const result = await pool.query<{
    region: string;
    mttr_minutes: string;
    alarm_count: string;
  }>(
    `SELECT
       "State" AS region,
       ROUND(AVG(
         EXTRACT(EPOCH FROM ("ClearanceTime" - "OccurrenceTime")) / 60
       ), 2)::text AS mttr_minutes,
       COUNT(*)::text AS alarm_count
     FROM dwh.fibergis_alarm_log
     WHERE "State" IS NOT NULL
       AND "ClearanceTime" IS NOT NULL
       AND "OccurrenceTime" >= $1
       AND "OccurrenceTime" < $2
     GROUP BY 1
     ORDER BY AVG(EXTRACT(EPOCH FROM ("ClearanceTime" - "OccurrenceTime")) / 60) DESC`,
    [range.from, range.to],
  );

  return result.rows.map((row) => ({
    region: row.region,
    mttr_minutes: parseFloat(row.mttr_minutes),
    alarm_count: parseInt(row.alarm_count, 10),
  }));
}

/**
 * Fiber-cut alarm history (filtered by FIBER_CUT_ALARM_NAME env var).
 * Returns empty if fiberCutAlarmName is falsy — safe default.
 *
 * Reproducing in psql:
 *   SELECT "Log_Serial_Number","Alarm_Name","Site_A_ID","Site_B_ID",
 *          "FiberLinkSite_Name","State","OccurrenceTime","ClearanceTime","DownTime"
 *   FROM dwh.fibergis_alarm_log
 *   WHERE "Alarm_Name"=$1 AND "OccurrenceTime">=$2 AND "OccurrenceTime"<$3
 *   ORDER BY "OccurrenceTime" DESC LIMIT 100;
 */
export async function queryFiberCutHistory(
  pool: pg.Pool,
  range: DateRange,
  fiberCutAlarmName: string,
  limit = 100,
): Promise<FiberCutEvent[]> {
  if (!fiberCutAlarmName) return [];

  const result = await pool.query<{
    Log_Serial_Number: string;
    Alarm_Name: string;
    Site_A_ID: string | null;
    Site_B_ID: string | null;
    FiberLinkSite_Name: string | null;
    State: string | null;
    OccurrenceTime: Date;
    ClearanceTime: Date | null;
    DownTime: string | null;
  }>(
    `SELECT
       "Log_Serial_Number",
       "Alarm_Name",
       "Site_A_ID",
       "Site_B_ID",
       "FiberLinkSite_Name",
       "State",
       "OccurrenceTime",
       "ClearanceTime",
       "DownTime"
     FROM dwh.fibergis_alarm_log
     WHERE "Alarm_Name" = $1
       AND "OccurrenceTime" >= $2
       AND "OccurrenceTime" < $3
     ORDER BY "OccurrenceTime" DESC
     LIMIT $4`,
    [fiberCutAlarmName, range.from, range.to, limit],
  );

  return result.rows.map((row) => ({
    log_serial_number: row.Log_Serial_Number,
    alarm_name: row.Alarm_Name,
    site_a_id: row.Site_A_ID,
    site_b_id: row.Site_B_ID,
    fiberlink_site_name: row.FiberLinkSite_Name,
    state: row.State,
    occurrence_time: row.OccurrenceTime,
    clearance_time: row.ClearanceTime,
    down_time: row.DownTime,
  }));
}
