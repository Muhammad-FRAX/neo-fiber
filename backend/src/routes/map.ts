/**
 * Map status endpoint — GET /api/v1/map/status
 *
 * Returns KPI data for the map overlay:
 *   down_devices, down_links, total_devices, total_links,
 *   availability_pct, cuts_24h, last_computed_at
 *
 * Data sources:
 *   - Device/link counts: app DB
 *   - Effective-status counts: topologyBus.lastEvent (in-memory, null until first alarm)
 *   - Cuts 24h: DWH query (falls back to 0 if DWH unreachable)
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { appPool } from '../db/app-pool.js';
import { dwhPool } from '../db/dwh-pool.js';
import { topologyBus } from '../services/topology/topology-bus.js';
import { registry } from '../openapi/registry.js';
import { z } from '../lib/zod.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const router = Router();

const MapStatusSchema = z.object({
  down_devices: z.number(),
  down_links: z.number(),
  total_devices: z.number(),
  total_links: z.number(),
  availability_pct: z.number(),
  cuts_24h: z.number(),
  last_computed_at: z.string().nullable(),
});

registry.registerPath({
  method: 'get',
  path: '/map/status',
  summary: 'Map KPI status (device/link health + cuts 24h)',
  tags: ['Map'],
  responses: {
    200: {
      description: 'Map KPI data',
      content: { 'application/json': { schema: MapStatusSchema } },
    },
  },
});

router.get(
  '/status',
  requireAuth,
  asyncHandler(async (_req, res) => {
    // Total counts from app DB
    const [devResult, linkResult] = await Promise.all([
      appPool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM devices'),
      appPool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM links'),
    ]);

    const totalDevices = parseInt(devResult.rows[0]?.count ?? '0', 10);
    const totalLinks = parseInt(linkResult.rows[0]?.count ?? '0', 10);

    // Effective-status counts from last topology computation
    const lastEvent = topologyBus.lastEvent;
    let downDevices = 0;
    let downLinks = 0;

    if (lastEvent) {
      downDevices = lastEvent.devices.filter((d) => d.effective_status === 'DOWN').length;
      downLinks = lastEvent.links.filter((l) => l.effective_status === 'DOWN').length;
    }

    const availabilityPct =
      totalDevices > 0
        ? Math.round(((totalDevices - downDevices) / totalDevices) * 10000) / 100
        : 100;

    // Cuts in last 24h from DWH (best-effort, falls back to 0)
    let cuts24h = 0;
    if (env.FIBER_CUT_ALARM_NAME) {
      try {
        const cutResult = await dwhPool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count
             FROM dwh.fibergis_alarm_log
            WHERE "Alarm_Name" = $1
              AND "OccurrenceTime" >= NOW() - INTERVAL '24 hours'`,
          [env.FIBER_CUT_ALARM_NAME],
        );
        cuts24h = parseInt(cutResult.rows[0]?.count ?? '0', 10);
      } catch (err) {
        logger.warn({ err }, 'DWH cuts_24h query failed — returning 0');
      }
    }

    res.json({
      down_devices: downDevices,
      down_links: downLinks,
      total_devices: totalDevices,
      total_links: totalLinks,
      availability_pct: availabilityPct,
      cuts_24h: cuts24h,
      last_computed_at: lastEvent?.computedAt ?? null,
    });
  }),
);

export default router;
