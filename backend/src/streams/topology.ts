import type { Request, Response } from 'express';
import { openSseStream } from './sse-base.js';
import { topologyBus } from '../services/topology/topology-bus.js';

export function topologyStreamHandler(req: Request, res: Response): void {
  const stream = openSseStream(req, res);
  if (!stream) return;

  const unsubscribe = topologyBus.subscribe((event) => {
    stream.write('topology', event);
  });

  req.on('close', unsubscribe);
}
