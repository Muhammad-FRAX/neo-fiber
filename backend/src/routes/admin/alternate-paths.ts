import { Router } from 'express';
import { appPool } from '../../db/app-pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
} from '../../middleware/error-handler.js';
import { recordAudit } from '../../services/admin/audit.js';
import {
  CreateAlternatePathSchema,
  UpdateAlternatePathSchema,
  type AlternatePathRow,
} from '../../schemas/alternate-paths.js';
import { PaginationParamsSchema } from '../../schemas/common.js';
import { z } from '../../lib/zod.js';

const router = Router();

router.use(requireAuth, requireAdmin);

const QuerySchema = PaginationParamsSchema.extend({
  device_id: z.string().optional(),
});

function toJson(row: AlternatePathRow) {
  return { ...row, declared_at: row.declared_at.toISOString() };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError('Invalid query params', parsed.error.flatten());
    const { page, limit, device_id } = parsed.data;
    const offset = (page - 1) * limit;
    const deviceFilter = device_id ? parseInt(device_id, 10) : null;
    const [data, count] = await Promise.all([
      appPool.query<AlternatePathRow>(
        `SELECT id, device_id, alternate_link_ids, declared_by, declared_at
         FROM alternate_paths
         WHERE ($1::int IS NULL OR device_id = $1)
         ORDER BY id LIMIT $2 OFFSET $3`,
        [deviceFilter, limit, offset],
      ),
      appPool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM alternate_paths WHERE ($1::int IS NULL OR device_id = $1)`,
        [deviceFilter],
      ),
    ]);
    res.json({ data: data.rows.map(toJson), pagination: { page, limit, total: parseInt(count.rows[0].count, 10) } });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');
    const result = await appPool.query<AlternatePathRow>(
      'SELECT id, device_id, alternate_link_ids, declared_by, declared_at FROM alternate_paths WHERE id = $1',
      [id],
    );
    if (!result.rows[0]) throw new NotFoundError(`AlternatePath ${id} not found`);
    res.json(toJson(result.rows[0]));
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = CreateAlternatePathSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid alternate path data', parsed.error.flatten());
    const { device_id, alternate_link_ids } = parsed.data;
    const userId = req.user?.sub ?? null;
    let result;
    try {
      result = await appPool.query<AlternatePathRow>(
        `INSERT INTO alternate_paths (device_id, alternate_link_ids, declared_by)
         VALUES ($1, $2, $3)
         RETURNING id, device_id, alternate_link_ids, declared_by, declared_at`,
        [device_id, alternate_link_ids, userId],
      );
    } catch (err) {
      if ((err as { code?: string })?.code === '23503') throw new ValidationError('device_id does not exist');
      throw err;
    }
    const row = result.rows[0];
    await recordAudit(req.user?.sub ?? null, 'alternate_path.create', null, toJson(row));
    res.status(201).json(toJson(row));
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');
    const parsed = UpdateAlternatePathSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid update data', parsed.error.flatten());
    const updates = parsed.data;
    if (Object.keys(updates).length === 0) throw new ValidationError('No fields to update');

    const before = await appPool.query<AlternatePathRow>(
      'SELECT id, device_id, alternate_link_ids, declared_by, declared_at FROM alternate_paths WHERE id = $1',
      [id],
    );
    if (!before.rows[0]) throw new NotFoundError(`AlternatePath ${id} not found`);

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if ('device_id' in updates) { setClauses.push(`device_id = $${idx++}`); values.push(updates.device_id); }
    if ('alternate_link_ids' in updates) { setClauses.push(`alternate_link_ids = $${idx++}`); values.push(updates.alternate_link_ids); }
    values.push(id);
    const result = await appPool.query<AlternatePathRow>(
      `UPDATE alternate_paths SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, device_id, alternate_link_ids, declared_by, declared_at`,
      values,
    );
    if (!result.rows[0]) throw new NotFoundError(`AlternatePath ${id} not found`);
    await recordAudit(req.user?.sub ?? null, 'alternate_path.update', toJson(before.rows[0]), toJson(result.rows[0]));
    res.json(toJson(result.rows[0]));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');
    const result = await appPool.query<AlternatePathRow>(
      'DELETE FROM alternate_paths WHERE id = $1 RETURNING id, device_id, alternate_link_ids, declared_by, declared_at',
      [id],
    );
    if (!result.rows[0]) throw new NotFoundError(`AlternatePath ${id} not found`);
    await recordAudit(req.user?.sub ?? null, 'alternate_path.delete', toJson(result.rows[0]), null);
    res.status(204).send();
  }),
);

export default router;
