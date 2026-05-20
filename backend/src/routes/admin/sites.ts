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
  CreateSiteSchema,
  UpdateSiteSchema,
  type SiteRow,
} from '../../schemas/sites.js';
import { PaginationParamsSchema } from '../../schemas/common.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = PaginationParamsSchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError('Invalid pagination params', parsed.error.flatten());
    const { page, limit } = parsed.data;
    const offset = (page - 1) * limit;
    const [data, count] = await Promise.all([
      appPool.query<SiteRow>(
        'SELECT id, site_id_external, name, region, state, lat, lng, is_root FROM sites ORDER BY id LIMIT $1 OFFSET $2',
        [limit, offset],
      ),
      appPool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM sites'),
    ]);
    res.json({ data: data.rows, pagination: { page, limit, total: parseInt(count.rows[0].count, 10) } });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');
    const result = await appPool.query<SiteRow>(
      'SELECT id, site_id_external, name, region, state, lat, lng, is_root FROM sites WHERE id = $1',
      [id],
    );
    if (!result.rows[0]) throw new NotFoundError(`Site ${id} not found`);
    res.json(result.rows[0]);
  }),
);

router.post(
  '/',
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
    } catch (err) {
      if ((err as { code?: string })?.code === '23505') throw new ConflictError('site_id_external already exists');
      throw err;
    }
    const row = result.rows[0];
    await recordAudit(req.user?.sub ?? null, 'site.create', null, row);
    res.status(201).json(row);
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');
    const parsed = UpdateSiteSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid update data', parsed.error.flatten());
    const updates = parsed.data;
    if (Object.keys(updates).length === 0) throw new ValidationError('No fields to update');

    const before = await appPool.query<SiteRow>(
      'SELECT id, site_id_external, name, region, state, lat, lng, is_root FROM sites WHERE id = $1',
      [id],
    );
    if (!before.rows[0]) throw new NotFoundError(`Site ${id} not found`);

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    const fieldMap: Record<string, string> = {
      site_id_external: 'site_id_external', name: 'name', region: 'region',
      state: 'state', lat: 'lat', lng: 'lng', is_root: 'is_root',
    };
    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in updates) {
        setClauses.push(`${col} = $${idx++}`);
        values.push((updates as Record<string, unknown>)[key]);
      }
    }
    if ('lat' in updates || 'lng' in updates) {
      setClauses.push(
        `geom = CASE WHEN lat IS NOT NULL AND lng IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography ELSE NULL END`,
      );
    }
    values.push(id);
    let result;
    try {
      result = await appPool.query<SiteRow>(
        `UPDATE sites SET ${setClauses.join(', ')} WHERE id = $${idx}
         RETURNING id, site_id_external, name, region, state, lat, lng, is_root`,
        values,
      );
    } catch (err) {
      if ((err as { code?: string })?.code === '23505') throw new ConflictError('site_id_external already exists');
      throw err;
    }
    if (!result.rows[0]) throw new NotFoundError(`Site ${id} not found`);
    await recordAudit(req.user?.sub ?? null, 'site.update', before.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(String(req.params['id'] ?? ''), 10);
    if (isNaN(id)) throw new ValidationError('id must be an integer');
    const result = await appPool.query<SiteRow>(
      'DELETE FROM sites WHERE id = $1 RETURNING id, site_id_external, name, region, state, lat, lng, is_root',
      [id],
    );
    if (!result.rows[0]) throw new NotFoundError(`Site ${id} not found`);
    await recordAudit(req.user?.sub ?? null, 'site.delete', result.rows[0], null);
    res.status(204).send();
  }),
);

export default router;
