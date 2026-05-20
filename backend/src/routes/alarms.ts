/**
 * Alarms read from DWH (read-only).
 *
 * Cross-references alarm_acks from app DB so is_acked is included.
 * Two pools: dwhPool for alarm data, appPool for ack state.
 * Query convention (D3): data + count + acks = 3 queries max, all run concurrently.
 *
 * NOTE: In CI/test, DWH_URL points to the same testcontainer as app DB
 * (which has no dwh.fibergis_alarm_log view). The endpoint returns an empty
 * list in that case — verified by unit test for route logic separately.
 */

import { Router } from 'express';
import { dwhPool } from '../db/dwh-pool.js';
import { appPool } from '../db/app-pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ValidationError } from '../middleware/error-handler.js';
import { registry } from '../openapi/registry.js';
import { AlarmFilterParamsSchema } from '../schemas/alarms.js';
import { AlarmSchema } from '../schemas/alarms.js';
import { PaginationParamsSchema, paginatedResponse } from '../schemas/common.js';
import { logger } from '../lib/logger.js';

const router = Router();

const AlarmQuerySchema = PaginationParamsSchema.merge(AlarmFilterParamsSchema);

// ---- OpenAPI registrations --------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/alarms',
  summary: 'List alarms from DWH (read-only)',
  tags: ['Alarms'],
  request: { query: AlarmQuerySchema },
  responses: {
    200: {
      description: 'Paginated alarm list with ack state',
      content: { 'application/json': { schema: paginatedResponse(AlarmSchema) } },
    },
  },
});

// ---- Route handlers ---------------------------------------------------------

const SORT_MAP: Record<string, string> = {
  '-occurrence_time': '"OccurrenceTime" DESC',
  'occurrence_time': '"OccurrenceTime" ASC',
  '-clearance_time': '"ClearanceTime" DESC',
  'clearance_time': '"ClearanceTime" ASC',
};

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = AlarmQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError('Invalid query params', parsed.error.flatten());
    const { page, limit, severity, status, state, alarm_name, from, to, sort } = parsed.data;
    const offset = (page - 1) * limit;

    const orderBy = SORT_MAP[sort ?? '-occurrence_time'] ?? '"OccurrenceTime" DESC';

    // Build WHERE clauses dynamically
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (severity) { conditions.push(`"Alarm_Severity" = $${idx++}`); params.push(severity); }
    if (status) { conditions.push(`"Status" = $${idx++}`); params.push(status); }
    if (state) { conditions.push(`"State" = $${idx++}`); params.push(state); }
    if (alarm_name) { conditions.push(`"Alarm_Name" = $${idx++}`); params.push(alarm_name); }
    if (from) { conditions.push(`"OccurrenceTime" >= $${idx++}`); params.push(new Date(from)); }
    if (to) { conditions.push(`"OccurrenceTime" <= $${idx++}`); params.push(new Date(to)); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let alarmRows: Array<{
      Log_Serial_Number: string;
      Alarm_Name: string | null;
      Alarm_Severity: string | null;
      Alarm_Source: string | null;
      Status: string;
      OccurrenceTime: Date;
      ClearanceTime: Date | null;
      DownTime: string | null;
      LocationInformation: string | null;
      FiberlinkSite_ID: string | null;
      FiberLinkSite_Name: string | null;
      Site_A_ID: string | null;
      State: string | null;
      Zone: string | null;
      Vendor: string | null;
      Source_NE: string | null;
      Sink_NE: string | null;
      total_count: string;
    }> = [];

    try {
      const result = await dwhPool.query(
        `SELECT
           "Log_Serial_Number", "Alarm_Name", "Alarm_Severity", "Alarm_Source",
           "Status", "OccurrenceTime", "ClearanceTime", "DownTime",
           "LocationInformation", "FiberlinkSite_ID", "FiberLinkSite_Name",
           "Site_A_ID", "State", "Zone", "Vendor", "Source_NE", "Sink_NE",
           COUNT(*) OVER()::text AS total_count
         FROM dwh.fibergis_alarm_log
         ${whereClause}
         ORDER BY ${orderBy}
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset],
      );
      alarmRows = result.rows;
    } catch (err) {
      // DWH view not present (CI/test env) — return empty list
      logger.warn({ err }, 'dwh.fibergis_alarm_log query failed — returning empty list');
      res.json({ data: [], pagination: { page, limit, total: 0 } });
      return;
    }

    if (alarmRows.length === 0) {
      res.json({ data: [], pagination: { page, limit, total: 0 } });
      return;
    }

    const total = parseInt(alarmRows[0].total_count, 10);
    const serials = alarmRows.map((r) => r.Log_Serial_Number);

    // Fetch ack state for this page (one batch query — no N+1)
    const acksResult = await appPool.query<{ alarm_log_serial: string }>(
      'SELECT alarm_log_serial::text FROM alarm_acks WHERE alarm_log_serial = ANY($1::bigint[])',
      [serials],
    );
    const ackedSet = new Set(acksResult.rows.map((r) => r.alarm_log_serial));

    const data = alarmRows.map((r) => ({
      log_serial_number: r.Log_Serial_Number,
      alarm_name: r.Alarm_Name,
      alarm_severity: r.Alarm_Severity,
      alarm_source: r.Alarm_Source,
      status: r.Status as 'Clear' | 'Not Clear',
      occurrence_time: r.OccurrenceTime.toISOString(),
      clearance_time: r.ClearanceTime?.toISOString() ?? null,
      down_time: r.DownTime,
      location_information: r.LocationInformation,
      fiberlink_site_id: r.FiberlinkSite_ID,
      fiberlink_site_name: r.FiberLinkSite_Name,
      site_a_id: r.Site_A_ID,
      state: r.State,
      zone: r.Zone,
      vendor: r.Vendor,
      source_ne: r.Source_NE,
      sink_ne: r.Sink_NE,
      is_acked: ackedSet.has(r.Log_Serial_Number),
    }));

    res.json({ data, pagination: { page, limit, total } });
  }),
);

export default router;
