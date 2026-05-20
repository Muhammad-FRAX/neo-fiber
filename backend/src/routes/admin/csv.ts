import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import { asyncHandler, ValidationError } from '../../middleware/error-handler.js';
import { importCSV, type ImportType } from '../../services/admin/csv-import.js';
import { recordAudit } from '../../services/admin/audit.js';
import { z } from '../../lib/zod.js';

const router = Router();

router.use(requireAuth, requireAdmin);

const ImportTypeSchema = z.enum(['sites', 'devices', 'links']);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const typeParam = ImportTypeSchema.safeParse(req.query['type']);
    if (!typeParam.success) {
      throw new ValidationError('Query param "type" must be one of: sites, devices, links');
    }
    const importType: ImportType = typeParam.data;

    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.includes('text/csv') && !contentType.includes('text/plain')) {
      throw new ValidationError('Content-Type must be text/csv or text/plain');
    }

    const csvText: string = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk: Buffer) => { data += chunk.toString('utf8'); });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

    if (!csvText.trim()) throw new ValidationError('CSV body is empty');

    const summary = await importCSV(csvText, importType);
    await recordAudit(req.user?.sub ?? null, `csv.import.${importType}`, null, summary);

    const totalErrors = summary[importType].errors.length;
    const status = totalErrors > 0 && summary[importType].imported === 0 ? 422 : 200;
    res.status(status).json({ summary });
  }),
);

export default router;
