/**
 * Tiles route — serves PMTiles file via Express static middleware.
 *
 * Express.static honors Range headers natively, so MapLibre's pmtiles
 * client can fetch byte ranges instead of downloading the full 80 MB file.
 *
 * T3 (DESIGN.md §9 map data row): smoke-tested by tiles.test.ts asserting
 * that Range: bytes=0-15 returns 206 Partial Content.
 */

import { Router } from 'express';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TILES_DIR = path.resolve(__dirname, '../../public/tiles');

const router = Router();

router.use(
  '/',
  express.static(TILES_DIR, {
    maxAge: '1d',
    immutable: false,
    etag: true,
    lastModified: true,
    acceptRanges: true,
  }),
);

export default router;
