import type pg from 'pg';

/**
 * One row from dwh.fibergis_alarm_log.
 * Column order and nullability derived from the view definition in database sample.txt.
 *
 * Key data-quality note (§7 premise 7 / DESIGN.md): many rows have empty
 * geo / FiberLink / NE fields — every consumer must handle nulls.
 */
export interface DwhAlarmRow {
  Log_Serial_Number: string; // bigint — pg returns as string to avoid precision loss
  Alarm_key: number | null;
  Alarm_Name: string | null;
  Alarm_Severity: string | null;
  Alarm_Source: string | null;
  Status: string; // 'Clear' | 'Not Clear' (computed by the view)
  OccurrenceTime: Date;
  ClearanceTime: Date | null;
  DownTime: string | null; // interval rendered as string by pg
  LocationInformation: string | null;
  Contractor: string | null;
  FiberlinkSite_ID: string | null;
  FiberLinkSite_Name: string | null;
  Site_A_ID: string | null;
  Site_A_Latitude: string | null;
  Site_A_Longitude: string | null;
  State: string | null;
  Zone: string | null;
  Vendor: string | null;
  Site_Priority: string | null;
  Is_Hub: string | null;
  Is_VIP: string | null;
  Site_B_ID: string | null;
  Site_B_Latitude: string | null;
  Site_B_Longitude: string | null;
  Source_NE: string | null;
  Sink_NE: string | null;
}

const SELECT_COLUMNS = `
  "Log_Serial_Number",
  "Alarm_key",
  "Alarm_Name",
  "Alarm_Severity",
  "Alarm_Source",
  "Status",
  "OccurrenceTime",
  "ClearanceTime",
  "DownTime",
  "LocationInformation",
  "Contractor",
  "FiberlinkSite_ID",
  "FiberLinkSite_Name",
  "Site_A_ID",
  "Site_A_Latitude",
  "Site_A_Longitude",
  "State",
  "Zone",
  "Vendor",
  "Site_Priority",
  "Is_Hub",
  "Is_VIP",
  "Site_B_ID",
  "Site_B_Latitude",
  "Site_B_Longitude",
  "Source_NE",
  "Sink_NE"
`.trim();

/**
 * Fetch all alarm rows from the DWH whose OccurrenceTime is strictly after
 * `after`. Results are ordered oldest-first so the poller can safely advance
 * its cursor row-by-row.
 *
 * `limit` prevents the first poll after a long outage from reading millions of rows.
 */
export async function fetchNewAlarms(
  pool: pg.Pool,
  after: Date,
  limit = 1000,
): Promise<DwhAlarmRow[]> {
  const result = await pool.query<DwhAlarmRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM dwh.fibergis_alarm_log
     WHERE "OccurrenceTime" > $1
     ORDER BY "OccurrenceTime" ASC
     LIMIT $2`,
    [after, limit],
  );
  return result.rows;
}
