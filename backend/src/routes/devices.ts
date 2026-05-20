/**
 * Devices CRUD — list (filterable by site_id), GET :id, POST, PATCH :id, DELETE :id.
 * Query convention (D3): list uses 2 queries max (data + count).
 */

import { Router } from 'express';
import { z } from '../lib/zod.js';
import { appPool } from '../db/app-pool.js';
import { requireAuth } from '../middleware/auth.js';
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../middleware/error-handler.js';
import { registry } from '../openapi/registry.js';
import {
  DeviceSchema,
  CreateDeviceSchema,
  UpdateDeviceSchema,
  type DeviceRow,
} from '../schemas/devices.js';
import { PaginationParamsSchema, paginatedResponse } from '../schemas/common.js';

const router = Router();

const DeviceQuerySchema = PaginationParamsSchema.extend({
  site_id: z.string().optional().openapi({ description: 'Filter by site ID' }),
});

// ---- OpenAPI registrations --------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/devices',
  summary: 'List devices',
  tags: ['Devices'],
  request: { query: DeviceQuerySchema },
  responses: {
    200: {
      description: 'Paginated device list',
      content: { 'application/json': { schema: paginatedResponse(DeviceSchema) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/devices/{id}',
  summary: 'Get device by ID',
  tags: ['Devices'],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Device', content: { 'application/json': { schema: DeviceSchema } } },
    404: { description: 'Not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/devices',
  summary: 'Create a device',
  tags: ['Devices'],
  request: { body: { content: { 'application/json': { schema: CreateDeviceSchema } } } },
  responses: {
    201: { description: 'Created device', content: { 'application/json': { schema: DeviceSchema } } },
    400: { description: 'Validation error' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/devices/{id}',
  summary: 'Update a device',
  tags: ['Devices'],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: UpdateDeviceSchema } } },
  },
  responses: {
    200: { description: 'Updated device', content: { 'application/json': { schema: DeviceSchema } } },
    404: { description: 'Not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/devices/{id}',
  summary: 'Delete a device',
  tags: ['Devices'],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: { description: 'Deleted' },
    404: { description: 'Not found' },
  },
});

// ---- Route handlers ---------------------------------------------------------

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = DeviceQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError('Invalid query params', parsed.error.flatten());
    const { page, limit, site_id } = parsed.data;
    const offset = (page - 1) * limit;

    const siteFilter = site_id ? parseInt(site_id, 10) : null;

    const [dataResult, countResult] = await Promise.all([
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

    res.json({
      data: dataResult.rows,
      pagination: { page, limit, total: parseInt(countResult.rows[0].count, 10) },
    });
  }),
);

router.get(
  '/:id',
  requireAuth,
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
  requireAuth,
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
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === '23505') throw new ConflictError('device_id_external already exists');
      if ((err as { code?: string })?.code === '23503') throw new ValidationError('site_id does not exist');
      throw err;
    }

    res.status(201).json(result.rows[0]);
  }),
);

router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');

    const parsed = UpdateDeviceSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid update data', parsed.error.flatten());

    const updates = parsed.data;
    if (Object.keys(updates).length === 0) throw new ValidationError('No fields to update');

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
        `UPDATE devices SET ${setClauses.join(', ')}
         WHERE id = $${idx}
         RETURNING id, device_id_external, site_id, name, type, vendor`,
        values,
      );
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === '23505') throw new ConflictError('device_id_external already exists');
      throw err;
    }

    if (!result.rows[0]) throw new NotFoundError(`Device ${id} not found`);
    res.json(result.rows[0]);
  }),
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');

    const result = await appPool.query('DELETE FROM devices WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) throw new NotFoundError(`Device ${id} not found`);
    res.status(204).send();
  }),
);

export default router;
