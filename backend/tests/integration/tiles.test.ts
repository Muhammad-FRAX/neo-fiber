/**
 * T3 — PMTiles Range request smoke test (DESIGN.md §25 T3).
 *
 * Verifies that Express static middleware serving backend/public/tiles/
 * honors HTTP Range headers and returns 206 Partial Content. Without this,
 * MapLibre's pmtiles client would download the full 80 MB file on every load.
 *
 * This test does NOT require a database — it only tests static file serving.
 *
 * CI fallback per §12.5: works identically in GitHub Actions (no external services needed).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

let app: Express;

beforeAll(async () => {
  process.env['APP_DB_URL'] = process.env['APP_DB_URL'] ?? 'postgresql://ignored:ignored@localhost/ignored';
  process.env['DWH_URL'] = process.env['DWH_URL'] ?? 'postgresql://ignored:ignored@localhost/ignored';
  process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'test-secret-that-is-exactly-32-chars-a!';
  process.env['LOG_LEVEL'] = 'silent';
  process.env['NODE_ENV'] = 'test';

  const { createApp } = await import('../../src/app.js');
  app = createApp();
});

describe('GET /tiles/sudan.pmtiles (T3)', () => {
  it('returns 200 for a full request', async () => {
    const res = await request(app).get('/tiles/sudan.pmtiles');
    expect([200, 206]).toContain(res.status);
  });

  it('returns 206 Partial Content for Range: bytes=0-15 (T3 smoke test)', async () => {
    const res = await request(app)
      .get('/tiles/sudan.pmtiles')
      .set('Range', 'bytes=0-15');

    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toMatch(/^bytes 0-15\//);
    expect(res.headers['accept-ranges']).toBe('bytes');
    // 16 bytes: "PMTiles" (7) + version (1) + 8 zero bytes
    expect(res.body.length ?? parseInt(res.headers['content-length'] ?? '0', 10)).toBeGreaterThan(0);
  });

  it('returns the PMTiles magic header in the first 7 bytes', async () => {
    const res = await request(app)
      .get('/tiles/sudan.pmtiles')
      .set('Range', 'bytes=0-6')
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(206);
    expect(res.body.toString('utf8', 0, 7)).toBe('PMTiles');
  });

  it('returns 404 for a non-existent tile file', async () => {
    const res = await request(app).get('/tiles/does-not-exist.pmtiles');
    expect(res.status).toBe(404);
  });
});
