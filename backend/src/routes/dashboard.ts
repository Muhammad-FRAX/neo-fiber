/**
 * Dashboard REST endpoints — all numbers come from real DWH aggregations.
 *
 * Routes:
 *   GET /api/v1/dashboard/summary   — hero KPI + supporting strip (availability sparkline, MTTR, cuts)
 *   GET /api/v1/dashboard/alarms    — alarms over time (daily counts)
 *   GET /api/v1/dashboard/recurring — top recurring issues
 *   GET /api/v1/dashboard/regions   — MTTR by region
 *   GET /api/v1/dashboard/fiber     — fiber-cut history
 *
 * Date range query params: ?from=ISO&to=ISO (default: last 30 days).
 * All queries go to dwhPool (read-only). Falls back gracefully if DWH is down.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { ValidationError } from '../middleware/error-handler.js';
import { dwhPool } from '../db/dwh-pool.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { z } from '../lib/zod.js';
import { registry } from '../openapi/registry.js';
import {
  queryNetworkAvailabilitySparkline,
  queryMttr,
  queryAlarmsOverTime,
  queryTopRecurringIssues,
  queryMttrByRegion,
  queryFiberCutHistory,
  type DateRange,
} from '../services/dashboard/aggregations.js';

const router = Router();

// ── Date range parsing ───────────────────────────────────────────────────────

const DateRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

function parseDateRange(query: Record<string, unknown>): DateRange {
  const parsed = DateRangeSchema.safeParse(query);
  if (!parsed.success) throw new ValidationError('Invalid date range parameters');

  const to = parsed.data.to ? new Date(parsed.data.to) : new Date();
  const from = parsed.data.from
    ? new Date(parsed.data.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new ValidationError('Invalid date format — use ISO 8601 (e.g. 2025-01-01T00:00:00Z)');
  }
  if (from >= to) {
    throw new ValidationError('"from" must be earlier than "to"');
  }

  return { from, to };
}

// ── OpenAPI registration ─────────────────────────────────────────────────────

const DashboardSummarySchema = z.object({
  availability_sparkline: z.array(
    z.object({ day: z.string(), availability_pct: z.number() }),
  ),
  current_availability_pct: z.number(),
  delta_vs_prior_pct: z.number().nullable(),
  mttr_minutes: z.number(),
  mttr_sample_size: z.number(),
  cuts_24h: z.number(),
  range: z.object({ from: z.string(), to: z.string() }),
});

registry.registerPath({
  method: 'get',
  path: '/dashboard/summary',
  summary: 'Dashboard hero KPI: network availability sparkline + MTTR + cuts',
  tags: ['Dashboard'],
  responses: {
    200: {
      description: 'Dashboard summary',
      content: { 'application/json': { schema: DashboardSummarySchema } },
    },
  },
});

// ── GET /summary ─────────────────────────────────────────────────────────────

router.get(
  '/summary',
  requireAuth,
  asyncHandler(async (req, res) => {
    const range = parseDateRange(req.query as Record<string, unknown>);

    // Fetch sparkline + MTTR in parallel
    const [sparkline, mttr] = await Promise.all([
      queryNetworkAvailabilitySparkline(dwhPool, range).catch((err) => {
        logger.warn({ err }, 'dashboard: availability sparkline query failed');
        return [];
      }),
      queryMttr(dwhPool, range).catch((err) => {
        logger.warn({ err }, 'dashboard: MTTR query failed');
        return { mttr_minutes: 0, sample_size: 0 };
      }),
    ]);

    // Current availability = average of sparkline values (last N days)
    const currentPct =
      sparkline.length > 0
        ? Math.round(
            (sparkline.reduce((s, d) => s + d.availability_pct, 0) / sparkline.length) * 100,
          ) / 100
        : 100;

    // Delta vs prior same-length period
    let deltaPct: number | null = null;
    const periodMs = range.to.getTime() - range.from.getTime();
    const priorRange: DateRange = {
      from: new Date(range.from.getTime() - periodMs),
      to: range.from,
    };
    try {
      const priorSparkline = await queryNetworkAvailabilitySparkline(dwhPool, priorRange);
      if (priorSparkline.length > 0) {
        const priorPct =
          priorSparkline.reduce((s, d) => s + d.availability_pct, 0) / priorSparkline.length;
        deltaPct = Math.round((currentPct - priorPct) * 100) / 100;
      }
    } catch (err) {
      logger.warn({ err }, 'dashboard: prior-period availability query failed');
    }

    // Cuts in last 24h from DWH
    let cuts24h = 0;
    if (env.FIBER_CUT_ALARM_NAME) {
      try {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const cutRows = await queryFiberCutHistory(dwhPool, { from: yesterday, to: now }, env.FIBER_CUT_ALARM_NAME, 1000);
        cuts24h = cutRows.length;
      } catch (err) {
        logger.warn({ err }, 'dashboard: cuts_24h query failed');
      }
    }

    res.json({
      availability_sparkline: sparkline,
      current_availability_pct: currentPct,
      delta_vs_prior_pct: deltaPct,
      mttr_minutes: mttr.mttr_minutes,
      mttr_sample_size: mttr.sample_size,
      cuts_24h: cuts24h,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
    });
  }),
);

// ── GET /alarms ───────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/dashboard/alarms',
  summary: 'Alarms over time (daily counts)',
  tags: ['Dashboard'],
  responses: {
    200: {
      description: 'Daily alarm counts',
      content: {
        'application/json': {
          schema: z.object({
            rows: z.array(z.object({ day: z.string(), count: z.number() })),
            range: z.object({ from: z.string(), to: z.string() }),
          }),
        },
      },
    },
  },
});

router.get(
  '/alarms',
  requireAuth,
  asyncHandler(async (req, res) => {
    const range = parseDateRange(req.query as Record<string, unknown>);
    const rows = await queryAlarmsOverTime(dwhPool, range).catch((err) => {
      logger.warn({ err }, 'dashboard: alarms-over-time query failed');
      return [];
    });
    res.json({ rows, range: { from: range.from.toISOString(), to: range.to.toISOString() } });
  }),
);

// ── GET /recurring ────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/dashboard/recurring',
  summary: 'Top recurring alarm types with avg MTTR',
  tags: ['Dashboard'],
  responses: {
    200: {
      description: 'Top recurring issues',
      content: {
        'application/json': {
          schema: z.object({
            rows: z.array(
              z.object({
                alarm_name: z.string(),
                count: z.number(),
                avg_mttr_minutes: z.number(),
              }),
            ),
            range: z.object({ from: z.string(), to: z.string() }),
          }),
        },
      },
    },
  },
});

router.get(
  '/recurring',
  requireAuth,
  asyncHandler(async (req, res) => {
    const range = parseDateRange(req.query as Record<string, unknown>);
    const limitParam = req.query['limit'];
    const limit = limitParam ? Math.min(parseInt(String(limitParam), 10) || 10, 50) : 10;
    const rows = await queryTopRecurringIssues(dwhPool, range, limit).catch((err) => {
      logger.warn({ err }, 'dashboard: top-recurring query failed');
      return [];
    });
    res.json({ rows, range: { from: range.from.toISOString(), to: range.to.toISOString() } });
  }),
);

// ── GET /regions ──────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/dashboard/regions',
  summary: 'MTTR by region (State)',
  tags: ['Dashboard'],
  responses: {
    200: {
      description: 'MTTR per region',
      content: {
        'application/json': {
          schema: z.object({
            rows: z.array(
              z.object({
                region: z.string(),
                mttr_minutes: z.number(),
                alarm_count: z.number(),
              }),
            ),
            range: z.object({ from: z.string(), to: z.string() }),
          }),
        },
      },
    },
  },
});

router.get(
  '/regions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const range = parseDateRange(req.query as Record<string, unknown>);
    const rows = await queryMttrByRegion(dwhPool, range).catch((err) => {
      logger.warn({ err }, 'dashboard: mttr-by-region query failed');
      return [];
    });
    res.json({ rows, range: { from: range.from.toISOString(), to: range.to.toISOString() } });
  }),
);

// ── GET /fiber ────────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/dashboard/fiber',
  summary: 'Fiber-cut history (filtered by FIBER_CUT_ALARM_NAME)',
  tags: ['Dashboard'],
  responses: {
    200: {
      description: 'Fiber-cut events',
      content: {
        'application/json': {
          schema: z.object({
            rows: z.array(
              z.object({
                log_serial_number: z.string(),
                alarm_name: z.string(),
                site_a_id: z.string().nullable(),
                site_b_id: z.string().nullable(),
                fiberlink_site_name: z.string().nullable(),
                state: z.string().nullable(),
                occurrence_time: z.string(),
                clearance_time: z.string().nullable(),
                down_time: z.string().nullable(),
              }),
            ),
            range: z.object({ from: z.string(), to: z.string() }),
          }),
        },
      },
    },
  },
});

router.get(
  '/fiber',
  requireAuth,
  asyncHandler(async (req, res) => {
    const range = parseDateRange(req.query as Record<string, unknown>);
    const rows = await queryFiberCutHistory(dwhPool, range, env.FIBER_CUT_ALARM_NAME).catch(
      (err) => {
        logger.warn({ err }, 'dashboard: fiber-cut-history query failed');
        return [];
      },
    );

    res.json({
      rows: rows.map((r) => ({
        ...r,
        occurrence_time: r.occurrence_time.toISOString(),
        clearance_time: r.clearance_time?.toISOString() ?? null,
      })),
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
    });
  }),
);

export default router;
