/**
 * API documentation routes (T8 — DESIGN.md §9 API conventions).
 *
 * GET /api/docs      → Swagger UI (served from local swagger-ui-dist, air-gap safe)
 * GET /api/openapi.json → Raw OpenAPI 3.1 document
 *
 * The Swagger UI HTML loads assets from /api/swagger-ui-assets/ which are
 * served as static files from the local swagger-ui-dist package.
 * No CDN references anywhere — air-gap compliant (§6 constraint).
 */

import { Router } from 'express';
import { createRequire } from 'module';
import path from 'path';
import { generateOpenApiDocument } from '../openapi/registry.js';

const router = Router();
const require = createRequire(import.meta.url);

// Resolve swagger-ui-dist absolute path from node_modules
const swaggerDistPath: string = path.dirname(require.resolve('swagger-ui-dist/package.json'));

// Serve swagger-ui-dist static assets (no CDN)
import express from 'express';
router.use('/swagger-ui-assets', express.static(swaggerDistPath));

// GET /api/openapi.json
router.get('/openapi.json', (_req, res) => {
  try {
    const doc = generateOpenApiDocument();
    res.json(doc);
  } catch (err) {
    res.status(500).json({
      error: { code: 'INTERNAL', message: 'Failed to generate OpenAPI spec', details: {} },
    });
  }
});

// GET /api/docs  — minimal Swagger UI HTML using local assets
router.get('/docs', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Neo-Fiber API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/api/swagger-ui-assets/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api/swagger-ui-assets/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
    });
  </script>
</body>
</html>`);
});

export default router;
