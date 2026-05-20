/**
 * SSE stream factory (DESIGN.md §9 SSE resilience baseline A6).
 *
 * - Validates JWT at connect time (401 inline on failure).
 * - Re-validates JWT on every write; on expiry sends `event: reauth` and closes.
 * - Sends `: ping\n\n` heartbeat every SSE_HEARTBEAT_MS (default 25 s) to defeat
 *   corporate proxy idle-timeouts.
 * - Logs every connect/disconnect with duration + client IP (§9 observation plan).
 */

import type { Request, Response } from 'express';
import { verifyToken } from '../auth/jwt.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface SseStreamContext {
  /** Write an SSE event. Returns false if the stream was already closed. */
  write(event: string, data: unknown): boolean;
  /** Explicitly close the stream from the server side. */
  close(): void;
}

function extractToken(req: Request): string | null {
  // Standard Bearer header (used by REST endpoints)
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

  // EventSource doesn't support custom headers, so the client sends the
  // JWT as a ?token= query parameter for SSE streams.
  const queryToken = req.query['token'];
  if (typeof queryToken === 'string' && queryToken) return queryToken;

  return null;
}

/**
 * Opens an SSE stream on res and returns a write/close context.
 * Returns null if authentication fails (401 already sent).
 *
 * opts.heartbeatMs overrides env.SSE_HEARTBEAT_MS — use in tests for speed.
 */
export function openSseStream(
  req: Request,
  res: Response,
  opts?: { heartbeatMs?: number },
): SseStreamContext | null {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Missing token', details: {} },
    });
    return null;
  }

  try {
    verifyToken(token);
  } catch {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Token expired or invalid', details: {} },
    });
    return null;
  }

  const clientIp = req.ip ?? 'unknown';
  const connectedAt = Date.now();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  logger.info({ event: 'sse_connect', path: req.path, clientIp }, 'SSE client connected');

  const heartbeatMs = opts?.heartbeatMs ?? env.SSE_HEARTBEAT_MS;
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, heartbeatMs);

  let closed = false;

  function cleanup() {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    logger.info(
      {
        event: 'sse_disconnect',
        path: req.path,
        clientIp,
        durationMs: Date.now() - connectedAt,
      },
      'SSE client disconnected',
    );
  }

  req.on('close', cleanup);

  return {
    write(event: string, data: unknown): boolean {
      if (closed) return false;
      try {
        verifyToken(token);
      } catch {
        res.write(`event: reauth\ndata: {}\n\n`);
        cleanup();
        res.end();
        return false;
      }
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      return true;
    },

    close() {
      cleanup();
      res.end();
    },
  };
}
