/**
 * Affected-region polygon (DESIGN.md §9 — Affected-region polygon).
 *
 * Given a list of DOWN site IDs, returns a GeoJSON polygon representing the
 * geographic extent of the outage, computed using PostGIS:
 *   ST_ConcaveHull(ST_Collect(site.geom), 0.5)
 *   → ST_Buffer(hull::geography, 15000)::geometry  (15 km buffer)
 *
 * Results are cached via hull-cache.ts (D4 — sorted-site-ID key, 10-min eviction).
 * Returns null when the affected set is empty or all sites have no coordinates.
 */

import type pg from 'pg';
import { getHull, setHull } from './hull-cache.js';

export async function computeAffectedRegion(
  pool: pg.Pool,
  downSiteIds: number[],
): Promise<object | null> {
  if (downSiteIds.length === 0) return null;

  const cached = getHull(downSiteIds);
  if (cached) return cached;

  const { rows } = await pool.query<{ geojson: string }>(
    `SELECT ST_AsGeoJSON(
       ST_Buffer(
         ST_ConcaveHull(ST_Collect(geom::geometry), 0.5)::geography,
         15000
       )::geometry
     ) AS geojson
     FROM sites
     WHERE id = ANY($1::int[])
       AND geom IS NOT NULL`,
    [downSiteIds],
  );

  if (!rows[0]?.geojson) return null;

  const geojson = JSON.parse(rows[0].geojson) as object;
  setHull(downSiteIds, geojson);
  return geojson;
}
