import { Router } from 'express';
import { appPool } from '../../db/app-pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../../middleware/error-handler.js';
import { recordAudit } from '../../services/admin/audit.js';
import {
  CreateLinkSchema,
  UpdateLinkSchema,
  type LinkRow,
} from '../../schemas/links.js';
import { PaginationParamsSchema } from '../../schemas/common.js';
import { z } from '../../lib/zod.js';

const router = Router();

router.use(requireAuth, requireAdmin);

const LinkQuerySchema = PaginationParamsSchema.extend({
  device_id: z.string().optional(),
  ranking: z.enum(['MAIN', 'BACKUP', 'AUX']).optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = LinkQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError('Invalid query params', parsed.error.flatten());
    const { page, limit, device_id, ranking } = parsed.data;
    const offset = (page - 1) * limit;
    const deviceFilter = device_id ? parseInt(device_id, 10) : null;
    const [data, count] = await Promise.all([
      appPool.query<LinkRow>(
        `SELECT id, link_id_external, source_device_id, target_device_id, ranking, capacity_gbps
         FROM links
         WHERE ($1::int IS NULL OR source_device_id = $1 OR target_device_id = $1)
           AND ($2::text IS NULL OR ranking = $2)
         ORDER BY id LIMIT $3 OFFSET $4`,
        [deviceFilter, ranking ?? null, limit, offset],
      ),
      appPool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM links
         WHERE ($1::int IS NULL OR source_device_id = $1 OR target_device_id = $1)
           AND ($2::text IS NULL OR ranking = $2)`,
        [deviceFilter, ranking ?? null],
      ),
    ]);
    res.json({ data: data.rows, pagination: { page, limit, total: parseInt(count.rows[0].count, 10) } });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');
    const result = await appPool.query<LinkRow>(
      'SELECT id, link_id_external, source_device_id, target_device_id, ranking, capacity_gbps FROM links WHERE id = $1',
      [id],
    );
    if (!result.rows[0]) throw new NotFoundError(`Link ${id} not found`);
    res.json(result.rows[0]);
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = CreateLinkSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid link data', parsed.error.flatten());
    const { link_id_external, source_device_id, target_device_id, ranking, capacity_gbps } = parsed.data;
    let result;
    try {
      result = await appPool.query<LinkRow>(
        `INSERT INTO links (link_id_external, source_device_id, target_device_id, ranking, capacity_gbps)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, link_id_external, source_device_id, target_device_id, ranking, capacity_gbps`,
        [link_id_external ?? null, source_device_id, target_device_id, ranking, capacity_gbps ?? null],
      );
    } catch (err) {
      if ((err as { code?: string })?.code === '23505') throw new ConflictError('link_id_external already exists');
      if ((err as { code?: string })?.code === '23503') throw new ValidationError('device ID does not exist');
      throw err;
    }
    const row = result.rows[0];
    await recordAudit(req.user?.sub ?? null, 'link.create', null, row);
    res.status(201).json(row);
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');
    const parsed = UpdateLinkSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid update data', parsed.error.flatten());
    const updates = parsed.data;
    if (Object.keys(updates).length === 0) throw new ValidationError('No fields to update');

    const before = await appPool.query<LinkRow>(
      'SELECT id, link_id_external, source_device_id, target_device_id, ranking, capacity_gbps FROM links WHERE id = $1',
      [id],
    );
    if (!before.rows[0]) throw new NotFoundError(`Link ${id} not found`);

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(updates)) {
      setClauses.push(`${key} = $${idx++}`);
      values.push(val);
    }
    values.push(id);
    const result = await appPool.query<LinkRow>(
      `UPDATE links SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, link_id_external, source_device_id, target_device_id, ranking, capacity_gbps`,
      values,
    );
    if (!result.rows[0]) throw new NotFoundError(`Link ${id} not found`);
    await recordAudit(req.user?.sub ?? null, 'link.update', before.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');
    const result = await appPool.query<LinkRow>(
      'DELETE FROM links WHERE id = $1 RETURNING id, link_id_external, source_device_id, target_device_id, ranking, capacity_gbps',
      [id],
    );
    if (!result.rows[0]) throw new NotFoundError(`Link ${id} not found`);
    await recordAudit(req.user?.sub ?? null, 'link.delete', result.rows[0], null);
    res.status(204).send();
  }),
);

export default router;
