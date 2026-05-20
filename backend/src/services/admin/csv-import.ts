/**
 * CSV import service — bulk loads sites, devices, and links from CSV text.
 *
 * CSV format per entity:
 *
 * sites.csv:
 *   site_id_external,name,region,state,lat,lng,is_root
 *
 * devices.csv:
 *   device_id_external,site_id_external,name,type,vendor
 *   (site_id_external is resolved to sites.id at import time)
 *
 * links.csv:
 *   link_id_external,source_device_external,target_device_external,ranking,capacity_gbps
 *   (device externals are resolved to devices.id at import time)
 *
 * All imports run in a single transaction — all or nothing.
 */

import type { PoolClient } from 'pg';
import { appPool } from '../../db/app-pool.js';
import { z } from '../../lib/zod.js';

// ---- CSV parser (no external dep) ----------------------------------------

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    rows.push(splitCSVLine(trimmed));
  }
  return rows;
}

function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function rowToObject(headers: string[], values: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    obj[headers[i].trim()] = values[i] ?? '';
  }
  return obj;
}

// ---- Validators ----------------------------------------------------------

const SiteCSVRowSchema = z.object({
  site_id_external: z.string().optional(),
  name: z.string().min(1),
  region: z.string().optional(),
  state: z.string().optional(),
  lat: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v) : null))
    .refine((v) => v === null || (!isNaN(v) && v >= -90 && v <= 90), 'lat out of range'),
  lng: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v) : null))
    .refine((v) => v === null || (!isNaN(v) && v >= -180 && v <= 180), 'lng out of range'),
  is_root: z
    .string()
    .optional()
    .transform((v) => (v === 'true' || v === '1')),
});

const DeviceCSVRowSchema = z.object({
  device_id_external: z.string().optional(),
  site_id_external: z.string().min(1, 'site_id_external is required'),
  name: z.string().min(1),
  type: z.string().optional(),
  vendor: z.string().optional(),
});

const LinkCSVRowSchema = z.object({
  link_id_external: z.string().optional(),
  source_device_external: z.string().min(1, 'source_device_external is required'),
  target_device_external: z.string().min(1, 'target_device_external is required'),
  ranking: z.enum(['MAIN', 'BACKUP', 'AUX']),
  capacity_gbps: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v) : null))
    .refine((v) => v === null || (!isNaN(v) && v > 0), 'capacity_gbps must be positive'),
});

// ---- Import result -------------------------------------------------------

export interface ImportSummary {
  sites: { imported: number; errors: string[] };
  devices: { imported: number; errors: string[] };
  links: { imported: number; errors: string[] };
}

// ---- Entity imports (inside transaction) ---------------------------------

async function importSites(
  client: PoolClient,
  rows: Record<string, string>[],
  summary: ImportSummary,
): Promise<void> {
  for (let i = 0; i < rows.length; i++) {
    const parsed = SiteCSVRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      summary.sites.errors.push(`Row ${i + 2}: ${parsed.error.issues.map((e) => e.message).join('; ')}`);
      continue;
    }
    const { site_id_external, name, region, state, lat, lng, is_root } = parsed.data;
    try {
      await client.query(
        `INSERT INTO sites (site_id_external, name, region, state, lat, lng, is_root, geom)
         VALUES ($1, $2, $3, $4, $5, $6, $7,
           CASE WHEN $5 IS NOT NULL AND $6 IS NOT NULL
             THEN ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography
             ELSE NULL END)
         ON CONFLICT (site_id_external) DO UPDATE SET
           name = EXCLUDED.name,
           region = EXCLUDED.region,
           state = EXCLUDED.state,
           lat = EXCLUDED.lat,
           lng = EXCLUDED.lng,
           is_root = EXCLUDED.is_root,
           geom = EXCLUDED.geom`,
        [site_id_external || null, name, region || null, state || null, lat, lng, is_root],
      );
      summary.sites.imported++;
    } catch (err) {
      summary.sites.errors.push(`Row ${i + 2}: ${(err as Error).message}`);
    }
  }
}

async function importDevices(
  client: PoolClient,
  rows: Record<string, string>[],
  summary: ImportSummary,
): Promise<void> {
  for (let i = 0; i < rows.length; i++) {
    const parsed = DeviceCSVRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      summary.devices.errors.push(`Row ${i + 2}: ${parsed.error.issues.map((e) => e.message).join('; ')}`);
      continue;
    }
    const { device_id_external, site_id_external, name, type, vendor } = parsed.data;
    try {
      const siteRes = await client.query<{ id: number }>(
        'SELECT id FROM sites WHERE site_id_external = $1',
        [site_id_external],
      );
      if (!siteRes.rows[0]) {
        summary.devices.errors.push(`Row ${i + 2}: site_id_external "${site_id_external}" not found`);
        continue;
      }
      await client.query(
        `INSERT INTO devices (device_id_external, site_id, name, type, vendor)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (device_id_external) DO UPDATE SET
           site_id = EXCLUDED.site_id,
           name = EXCLUDED.name,
           type = EXCLUDED.type,
           vendor = EXCLUDED.vendor`,
        [device_id_external || null, siteRes.rows[0].id, name, type || null, vendor || null],
      );
      summary.devices.imported++;
    } catch (err) {
      summary.devices.errors.push(`Row ${i + 2}: ${(err as Error).message}`);
    }
  }
}

async function importLinks(
  client: PoolClient,
  rows: Record<string, string>[],
  summary: ImportSummary,
): Promise<void> {
  for (let i = 0; i < rows.length; i++) {
    const parsed = LinkCSVRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      summary.links.errors.push(`Row ${i + 2}: ${parsed.error.issues.map((e) => e.message).join('; ')}`);
      continue;
    }
    const { link_id_external, source_device_external, target_device_external, ranking, capacity_gbps } = parsed.data;
    try {
      const [srcRes, tgtRes] = await Promise.all([
        client.query<{ id: number }>('SELECT id FROM devices WHERE device_id_external = $1', [source_device_external]),
        client.query<{ id: number }>('SELECT id FROM devices WHERE device_id_external = $1', [target_device_external]),
      ]);
      if (!srcRes.rows[0]) {
        summary.links.errors.push(`Row ${i + 2}: source_device_external "${source_device_external}" not found`);
        continue;
      }
      if (!tgtRes.rows[0]) {
        summary.links.errors.push(`Row ${i + 2}: target_device_external "${target_device_external}" not found`);
        continue;
      }
      await client.query(
        `INSERT INTO links (link_id_external, source_device_id, target_device_id, ranking, capacity_gbps)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (link_id_external) DO UPDATE SET
           source_device_id = EXCLUDED.source_device_id,
           target_device_id = EXCLUDED.target_device_id,
           ranking = EXCLUDED.ranking,
           capacity_gbps = EXCLUDED.capacity_gbps`,
        [link_id_external || null, srcRes.rows[0].id, tgtRes.rows[0].id, ranking, capacity_gbps],
      );
      summary.links.imported++;
    } catch (err) {
      summary.links.errors.push(`Row ${i + 2}: ${(err as Error).message}`);
    }
  }
}

// ---- Public API ----------------------------------------------------------

export type ImportType = 'sites' | 'devices' | 'links';

export async function importCSV(
  csvText: string,
  importType: ImportType,
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    sites: { imported: 0, errors: [] },
    devices: { imported: 0, errors: [] },
    links: { imported: 0, errors: [] },
  };

  const rawRows = parseCSV(csvText);
  if (rawRows.length < 2) {
    summary[importType].errors.push('CSV must have a header row and at least one data row');
    return summary;
  }

  const headers = rawRows[0];
  const dataRows = rawRows.slice(1).map((row) => rowToObject(headers, row));

  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    if (importType === 'sites') await importSites(client, dataRows, summary);
    if (importType === 'devices') await importDevices(client, dataRows, summary);
    if (importType === 'links') await importLinks(client, dataRows, summary);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return summary;
}
