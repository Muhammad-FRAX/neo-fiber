import { Router } from 'express';
import { appPool } from '../db/app-pool.js';
import { dwhPool } from '../db/dwh-pool.js';

const router = Router();

/**
 * GET /api/v1/health
 *
 * Returns DB connectivity status for both pools.
 * 200 = both connected.
 * 503 = one or more unreachable (app still running, just degraded).
 *
 * Response shape:
 *   { "status": "ok"|"degraded", "app_db": "connected"|"error", "dwh": "connected"|"error" }
 */
router.get('/health', async (_req, res) => {
  const checks = {
    app_db: 'error' as 'connected' | 'error',
    dwh: 'error' as 'connected' | 'error',
  };

  await Promise.allSettled([
    appPool.query('SELECT 1').then(() => { checks.app_db = 'connected'; }),
    dwhPool.query('SELECT 1').then(() => { checks.dwh = 'connected'; }),
  ]);

  const allOk = checks.app_db === 'connected' && checks.dwh === 'connected';
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    ...checks,
  });
});

export default router;
