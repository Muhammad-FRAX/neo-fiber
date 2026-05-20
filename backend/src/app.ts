import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { requestContext } from './middleware/request-context.js';
import { errorHandler } from './middleware/error-handler.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import streamRouter from './routes/stream.js';
import sitesRouter from './routes/sites.js';
import devicesRouter from './routes/devices.js';
import linksRouter from './routes/links.js';
import alternatePathsRouter from './routes/alternate-paths.js';
import alarmsRouter from './routes/alarms.js';
import docsRouter from './routes/docs.js';
import tilesRouter from './routes/tiles.js';
import mapRouter from './routes/map.js';

// Rate limiters are bypassed in test mode to prevent flaky test failures
// (test suites fire many requests in rapid succession by design).
const skipInTest = () => process.env['NODE_ENV'] === 'test';

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again after 15 minutes.',
      details: {},
    },
  },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many login attempts, please try again after 1 minute.',
      details: {},
    },
  },
});

export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(helmet());
  app.use(globalLimiter);
  app.use('/api/v1/auth', authLimiter);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(requestContext);

  app.use('/api/v1', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/stream', streamRouter);
  app.use('/api/v1/sites', sitesRouter);
  app.use('/api/v1/devices', devicesRouter);
  app.use('/api/v1/links', linksRouter);
  app.use('/api/v1/alternate-paths', alternatePathsRouter);
  app.use('/api/v1/alarms', alarmsRouter);
  app.use('/api/v1/map', mapRouter);
  app.use('/tiles', tilesRouter);
  app.use('/api', docsRouter);

  // In production, serve the compiled frontend and fall back to index.html for
  // SPA routing. Must come after all API routes so /api/* is never shadowed.
  if (process.env['NODE_ENV'] === 'production') {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const frontendDist = path.resolve(__dirname, '../../frontend/dist');
    app.use(express.static(frontendDist, { maxAge: '1d', etag: true }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else {
    // Development: 404 JSON for unknown routes
    app.use((_req, res) => {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Route not found', details: {} },
      });
    });
  }

  app.use(errorHandler);

  return app;
}
