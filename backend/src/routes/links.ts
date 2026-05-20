/**
 * Links CRUD — list (filterable by source/target device), GET :id, POST, PATCH, DELETE.
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
  LinkSchema,
  CreateLinkSchema,
  UpdateLinkSchema,
  type LinkRow,
} from '../schemas/links.js';
import { PaginationParamsSchema, paginatedResponse } from '../schemas/common.js';

const router = Router();

const LinkQuerySchema = PaginationParamsSchema.extend({
  device_id: z.string().optional().openapi({ description: 'Filter by source or target device ID' }),
  ranking: z.enum(['MAIN', 'BACKUP', 'AUX']).optional(),
});

// ---- OpenAPI registrations --------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/links',
  summary: 'List links',
  tags: ['Links'],
  request: { query: LinkQuerySchema },
  responses: {
    200: {
      description: 'Paginated link list',
      content: { 'application/json': { schema: paginatedResponse(LinkSchema) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/links/{id}',
  summary: 'Get link by ID',
  tags: ['Links'],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Link', content: { 'application/json': { schema: LinkSchema } } },
    404: { description: 'Not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/links',
  summary: 'Create a link',
  tags: ['Links'],
  request: { body: { content: { 'application/json': { schema: CreateLinkSchema } } } },
  responses: {
    201: { description: 'Created link', content: { 'application/json': { schema: LinkSchema } } },
    400: { description: 'Validation error' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/links/{id}',
  summary: 'Update a link',
  tags: ['Links'],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: UpdateLinkSchema } } },
  },
  responses: {
    200: { description: 'Updated link', content: { 'application/json': { schema: LinkSchema } } },
    404: { description: 'Not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/links/{id}',
  summary: 'Delete a link',
  tags: ['Links'],
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
    const parsed = LinkQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError('Invalid query params', parsed.error.flatten());
    const { page, limit, device_id, ranking } = parsed.data;
    const offset = (page - 1) * limit;

    const deviceFilter = device_id ? parseInt(device_id, 10) : null;

    const [dataResult, countResult] = await Promise.all([
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
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = CreateLinkSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid link data', parsed.error.flatten());
    const { link_id_external, source_device_id, target_device_id, ranking, capacity_gbps } =
      parsed.data;

    let result;
    try {
      result = await appPool.query<LinkRow>(
        `INSERT INTO links (link_id_external, source_device_id, target_device_id, ranking, capacity_gbps)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, link_id_external, source_device_id, target_device_id, ranking, capacity_gbps`,
        [link_id_external ?? null, source_device_id, target_device_id, ranking, capacity_gbps ?? null],
      );
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === '23505') throw new ConflictError('link_id_external already exists');
      if ((err as { code?: string })?.code === '23503') throw new ValidationError('device ID does not exist');
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

    const parsed = UpdateLinkSchema.safeParse(req.body);
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
    const result = await appPool.query<LinkRow>(
      `UPDATE links SET ${setClauses.join(', ')}
       WHERE id = $${idx}
       RETURNING id, link_id_external, source_device_id, target_device_id, ranking, capacity_gbps`,
      values,
    );

    if (!result.rows[0]) throw new NotFoundError(`Link ${id} not found`);
    res.json(result.rows[0]);
  }),
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');

    const result = await appPool.query('DELETE FROM links WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) throw new NotFoundError(`Link ${id} not found`);
    res.status(204).send();
  }),
);

export default router;
