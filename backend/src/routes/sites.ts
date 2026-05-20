/**
 * Sites CRUD — GET list, GET :id (with devices), POST, PATCH :id, DELETE :id.
 *
 * Query convention (D3): list uses 2 queries max (data + count).
 * Detail uses 2 queries (site + devices via site_id).
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
  SiteSchema,
  CreateSiteSchema,
  UpdateSiteSchema,
  SiteWithDevicesSchema,
  type SiteRow,
} from '../schemas/sites.js';
import { PaginationParamsSchema, paginatedResponse } from '../schemas/common.js';

const router = Router();

// ---- OpenAPI registrations --------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/sites',
  summary: 'List sites',
  tags: ['Sites'],
  request: { query: PaginationParamsSchema },
  responses: {
    200: {
      description: 'Paginated site list',
      content: { 'application/json': { schema: paginatedResponse(SiteSchema) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/sites/{id}',
  summary: 'Get site by ID (includes devices)',
  tags: ['Sites'],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Site with devices', content: { 'application/json': { schema: SiteWithDevicesSchema } } },
    404: { description: 'Not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/sites',
  summary: 'Create a site',
  tags: ['Sites'],
  request: { body: { content: { 'application/json': { schema: CreateSiteSchema } } } },
  responses: {
    201: { description: 'Created site', content: { 'application/json': { schema: SiteSchema } } },
    400: { description: 'Validation error' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/sites/{id}',
  summary: 'Update a site',
  tags: ['Sites'],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: UpdateSiteSchema } } },
  },
  responses: {
    200: { description: 'Updated site', content: { 'application/json': { schema: SiteSchema } } },
    404: { description: 'Not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/sites/{id}',
  summary: 'Delete a site',
  tags: ['Sites'],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: { description: 'Deleted' },
    404: { description: 'Not found' },
  },
});

// ---- Route handlers ---------------------------------------------------------

// GET /api/v1/sites
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = PaginationParamsSchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError('Invalid pagination params', parsed.error.flatten());
    const { page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    // Two queries max: data + count (D3 — no N+1)
    const [dataResult, countResult] = await Promise.all([
      appPool.query<SiteRow>(
        'SELECT id, site_id_external, name, region, state, lat, lng, is_root FROM sites ORDER BY id LIMIT $1 OFFSET $2',
        [limit, offset],
      ),
      appPool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM sites'),
    ]);

    res.json({
      data: dataResult.rows,
      pagination: { page, limit, total: parseInt(countResult.rows[0].count, 10) },
    });
  }),
);

// GET /api/v1/sites/:id
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');

    // Two queries: site + its devices (D3 — batch by site_id, not per-device)
    const [siteResult, devicesResult] = await Promise.all([
      appPool.query<SiteRow>(
        'SELECT id, site_id_external, name, region, state, lat, lng, is_root FROM sites WHERE id = $1',
        [id],
      ),
      appPool.query<{
        id: number;
        device_id_external: string | null;
        name: string;
        type: string | null;
        vendor: string | null;
      }>(
        'SELECT id, device_id_external, name, type, vendor FROM devices WHERE site_id = $1 ORDER BY id',
        [id],
      ),
    ]);

    if (!siteResult.rows[0]) throw new NotFoundError(`Site ${id} not found`);

    res.json({ ...siteResult.rows[0], devices: devicesResult.rows });
  }),
);

// POST /api/v1/sites
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = CreateSiteSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid site data', parsed.error.flatten());
    const { site_id_external, name, region, state, lat, lng, is_root } = parsed.data;

    let result;
    try {
      result = await appPool.query<SiteRow>(
        `INSERT INTO sites (site_id_external, name, region, state, lat, lng, is_root, geom)
         VALUES ($1, $2, $3, $4, $5, $6, $7,
           CASE WHEN $5 IS NOT NULL AND $6 IS NOT NULL
             THEN ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography
             ELSE NULL END)
         RETURNING id, site_id_external, name, region, state, lat, lng, is_root`,
        [site_id_external ?? null, name, region ?? null, state ?? null, lat ?? null, lng ?? null, is_root ?? false],
      );
    } catch (err: unknown) {
      if (isUniqueViolation(err)) throw new ConflictError('site_id_external already exists');
      throw err;
    }

    res.status(201).json(result.rows[0]);
  }),
);

// PATCH /api/v1/sites/:id
router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');

    const parsed = UpdateSiteSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid update data', parsed.error.flatten());

    const updates = parsed.data;
    if (Object.keys(updates).length === 0) throw new ValidationError('No fields to update');

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const fieldMap: Record<string, string> = {
      site_id_external: 'site_id_external',
      name: 'name',
      region: 'region',
      state: 'state',
      lat: 'lat',
      lng: 'lng',
      is_root: 'is_root',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in updates) {
        setClauses.push(`${col} = $${idx++}`);
        values.push((updates as Record<string, unknown>)[key]);
      }
    }

    // Recompute geom if lat/lng changed
    if ('lat' in updates || 'lng' in updates) {
      setClauses.push(
        `geom = CASE WHEN lat IS NOT NULL AND lng IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
          ELSE NULL END`,
      );
    }

    values.push(id);
    let result;
    try {
      result = await appPool.query<SiteRow>(
        `UPDATE sites SET ${setClauses.join(', ')}
         WHERE id = $${idx}
         RETURNING id, site_id_external, name, region, state, lat, lng, is_root`,
        values,
      );
    } catch (err: unknown) {
      if (isUniqueViolation(err)) throw new ConflictError('site_id_external already exists');
      throw err;
    }

    if (!result.rows[0]) throw new NotFoundError(`Site ${id} not found`);
    res.json(result.rows[0]);
  }),
);

// DELETE /api/v1/sites/:id
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');

    const result = await appPool.query('DELETE FROM sites WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) throw new NotFoundError(`Site ${id} not found`);

    res.status(204).send();
  }),
);

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === '23505';
}

export default router;
