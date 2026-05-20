import { Router } from 'express';
import { appPool } from '../../db/app-pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import { asyncHandler, ValidationError } from '../../middleware/error-handler.js';
import { PaginationParamsSchema } from '../../schemas/common.js';

const router = Router();

router.use(requireAuth, requireAdmin);

interface AuditRow {
  id: number;
  user_id: number | null;
  action: string;
  before_state: unknown;
  after_state: unknown;
  at: Date;
  username: string | null;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = PaginationParamsSchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError('Invalid pagination params', parsed.error.flatten());
    const { page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const [data, count] = await Promise.all([
      appPool.query<AuditRow>(
        `SELECT ta.id, ta.user_id, ta.action, ta.before_state, ta.after_state, ta.at,
                u.ldap_username AS username
         FROM topology_audit ta
         LEFT JOIN users u ON u.id = ta.user_id
         ORDER BY ta.at DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      appPool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM topology_audit'),
    ]);

    res.json({
      data: data.rows.map((r) => ({ ...r, at: r.at.toISOString() })),
      pagination: { page, limit, total: parseInt(count.rows[0].count, 10) },
    });
  }),
);

export default router;
