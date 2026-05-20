/**
 * Alternate paths CRUD — list, GET :id, POST, PATCH :id, DELETE :id.
 * These let engineers declare which links can serve as alternates for a device.
 */

import { Router } from 'express';
import { z } from '../lib/zod.js';
import { appPool } from '../db/app-pool.js';
import { requireAuth } from '../middleware/auth.js';
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
} from '../middleware/error-handler.js';
import { registry } from '../openapi/registry.js';
import {
  AlternatePathSchema,
  CreateAlternatePathSchema,
  UpdateAlternatePathSchema,
  type AlternatePathRow,
} from '../schemas/alternate-paths.js';
import { PaginationParamsSchema, paginatedResponse } from '../schemas/common.js';

const router = Router();

const AlternatePathQuerySchema = PaginationParamsSchema.extend({
  device_id: z.string().optional().openapi({ description: 'Filter by device ID' }),
});

// ---- OpenAPI registrations --------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/alternate-paths',
  summary: 'List alternate paths',
  tags: ['Alternate Paths'],
  request: { query: AlternatePathQuerySchema },
  responses: {
    200: {
      description: 'Paginated alternate path list',
      content: { 'application/json': { schema: paginatedResponse(AlternatePathSchema) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/alternate-paths/{id}',
  summary: 'Get alternate path by ID',
  tags: ['Alternate Paths'],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Alternate path', content: { 'application/json': { schema: AlternatePathSchema } } },
    404: { description: 'Not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/alternate-paths',
  summary: 'Declare an alternate path for a device',
  tags: ['Alternate Paths'],
  request: {
    body: { content: { 'application/json': { schema: CreateAlternatePathSchema } } },
  },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: AlternatePathSchema } } },
    400: { description: 'Validation error' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/alternate-paths/{id}',
  summary: 'Update an alternate path',
  tags: ['Alternate Paths'],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: UpdateAlternatePathSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: AlternatePathSchema } } },
    404: { description: 'Not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/alternate-paths/{id}',
  summary: 'Delete an alternate path',
  tags: ['Alternate Paths'],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: { description: 'Deleted' },
    404: { description: 'Not found' },
  },
});

// ---- Route handlers ---------------------------------------------------------

function rowToJson(row: AlternatePathRow) {
  return {
    ...row,
    declared_at: row.declared_at.toISOString(),
  };
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = AlternatePathQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError('Invalid query params', parsed.error.flatten());
    const { page, limit, device_id } = parsed.data;
    const offset = (page - 1) * limit;

    const deviceFilter = device_id ? parseInt(device_id, 10) : null;

    const [dataResult, countResult] = await Promise.all([
      appPool.query<AlternatePathRow>(
        `SELECT id, device_id, alternate_link_ids, declared_by, declared_at
         FROM alternate_paths
         WHERE ($1::int IS NULL OR device_id = $1)
         ORDER BY id LIMIT $2 OFFSET $3`,
        [deviceFilter, limit, offset],
      ),
      appPool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM alternate_paths
         WHERE ($1::int IS NULL OR device_id = $1)`,
        [deviceFilter],
      ),
    ]);

    res.json({
      data: dataResult.rows.map(rowToJson),
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

    const result = await appPool.query<AlternatePathRow>(
      'SELECT id, device_id, alternate_link_ids, declared_by, declared_at FROM alternate_paths WHERE id = $1',
      [id],
    );
    if (!result.rows[0]) throw new NotFoundError(`AlternatePath ${id} not found`);
    res.json(rowToJson(result.rows[0]));
  }),
);

router.post(
  '/',
  requireAuth,
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
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === '23503') throw new ValidationError('device_id does not exist');
      throw err;
    }

    res.status(201).json(rowToJson(result.rows[0]));
  }),
);

router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');

    const parsed = UpdateAlternatePathSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid update data', parsed.error.flatten());

    const updates = parsed.data;
    if (Object.keys(updates).length === 0) throw new ValidationError('No fields to update');

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if ('device_id' in updates) {
      setClauses.push(`device_id = $${idx++}`);
      values.push(updates.device_id);
    }
    if ('alternate_link_ids' in updates) {
      setClauses.push(`alternate_link_ids = $${idx++}`);
      values.push(updates.alternate_link_ids);
    }

    values.push(id);
    const result = await appPool.query<AlternatePathRow>(
      `UPDATE alternate_paths SET ${setClauses.join(', ')}
       WHERE id = $${idx}
       RETURNING id, device_id, alternate_link_ids, declared_by, declared_at`,
      values,
    );

    if (!result.rows[0]) throw new NotFoundError(`AlternatePath ${id} not found`);
    res.json(rowToJson(result.rows[0]));
  }),
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');

    const result = await appPool.query(
      'DELETE FROM alternate_paths WHERE id = $1 RETURNING id',
      [id],
    );
    if (!result.rows[0]) throw new NotFoundError(`AlternatePath ${id} not found`);
    res.status(204).send();
  }),
);

export default router;
