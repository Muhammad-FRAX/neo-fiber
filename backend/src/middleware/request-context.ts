import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger, requestStorage } from '../lib/logger.js';

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const request_id = randomUUID();
  const route = `${req.method} ${req.path}`;
  const start = Date.now();

  requestStorage.run({ request_id, route }, () => {
    res.setHeader('X-Request-Id', request_id);

    res.on('finish', () => {
      const duration_ms = Date.now() - start;
      logger.info({ status: res.statusCode, duration_ms }, route);
    });

    next();
  });
}
