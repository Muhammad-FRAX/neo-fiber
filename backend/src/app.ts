import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { requestContext } from './middleware/request-context.js';
import { errorHandler } from './middleware/error-handler.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import streamRouter from './routes/stream.js';

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

  // 404 handler for unknown routes
  app.use((_req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Route not found', details: {} },
    });
  });

  app.use(errorHandler);

  return app;
}
