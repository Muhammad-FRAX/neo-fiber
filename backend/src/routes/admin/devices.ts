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
  CreateDeviceSchema,
  UpdateDeviceSchema,
  type DeviceRow,
} from '../../schemas/devices.js';
import { PaginationParamsSchema } from '../../schemas/common.js';
import { z } from '../../lib/zod.js';

const router = Router();

router.use(requireAuth, requireAdmin);

const DeviceQuerySchema = PaginationParamsSchema.extend({
  site_id: z.string().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = DeviceQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError('Invalid query params', parsed.error.flatten());
    const { page, limit, site_id } = parsed.data;
    const offset = (page - 1) * limit;
    const siteFilter = site_id ? parseInt(site_id, 10) : null;
    const [data, count] = await Promise.all([
      appPool.query<DeviceRow>(
        `SELECT id, device_id_external, site_id, name, type, vendor FROM devices
         WHERE ($1::int IS NULL OR site_id = $1)
         ORDER BY id LIMIT $2 OFFSET $3`,
        [siteFilter, limit, offset],
      ),
      appPool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM devices WHERE ($1::int IS NULL OR site_id = $1)`,
        [siteFilter],
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
    const result = await appPool.query<DeviceRow>(
      'SELECT id, device_id_external, site_id, name, type, vendor FROM devices WHERE id = $1',
      [id],
    );
    if (!result.rows[0]) throw new NotFoundError(`Device ${id} not found`);
    res.json(result.rows[0]);
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = CreateDeviceSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid device data', parsed.error.flatten());
    const { device_id_external, site_id, name, type, vendor } = parsed.data;
    let result;
    try {
      result = await appPool.query<DeviceRow>(
        `INSERT INTO devices (device_id_external, site_id, name, type, vendor)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, device_id_external, site_id, name, type, vendor`,
        [device_id_external ?? null, site_id, name, type ?? null, vendor ?? null],
      );
    } catch (err) {
      if ((err as { code?: string })?.code === '23505') throw new ConflictError('device_id_external already exists');
      if ((err as { code?: string })?.code === '23503') throw new ValidationError('site_id does not exist');
      throw err;
    }
    const row = result.rows[0];
    await recordAudit(req.user?.sub ?? null, 'device.create', null, row);
    res.status(201).json(row);
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');
    const parsed = UpdateDeviceSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid update data', parsed.error.flatten());
    const updates = parsed.data;
    if (Object.keys(updates).length === 0) throw new ValidationError('No fields to update');

    const before = await appPool.query<DeviceRow>(
      'SELECT id, device_id_external, site_id, name, type, vendor FROM devices WHERE id = $1',
      [id],
    );
    if (!before.rows[0]) throw new NotFoundError(`Device ${id} not found`);

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(updates)) {
      setClauses.push(`${key} = $${idx++}`);
      values.push(val);
    }
    values.push(id);
    let result;
    try {
      result = await appPool.query<DeviceRow>(
        `UPDATE devices SET ${setClauses.join(', ')} WHERE id = $${idx}
         RETURNING id, device_id_external, site_id, name, type, vendor`,
        values,
      );
    } catch (err) {
      if ((err as { code?: string })?.code === '23505') throw new ConflictError('device_id_external already exists');
      throw err;
    }
    if (!result.rows[0]) throw new NotFoundError(`Device ${id} not found`);
    await recordAudit(req.user?.sub ?? null, 'device.update', before.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');
    const result = await appPool.query<DeviceRow>(
      'DELETE FROM devices WHERE id = $1 RETURNING id, device_id_external, site_id, name, type, vendor',
      [id],
    );
    if (!result.rows[0]) throw new NotFoundError(`Device ${id} not found`);
    await recordAudit(req.user?.sub ?? null, 'device.delete', result.rows[0], null);
    res.status(204).send();
  }),
);

export default router;
