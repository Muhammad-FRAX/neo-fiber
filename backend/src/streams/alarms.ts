import type { Request, Response } from 'express';
import { openSseStream } from './sse-base.js';
import { alarmBus } from '../services/dwh/event-bus.js';

export function alarmsStreamHandler(req: Request, res: Response): void {
  const stream = openSseStream(req, res);
  if (!stream) return;

  const unsubscribe = alarmBus.subscribe((event) => {
    stream.write('alarm', event);
  });

  req.on('close', unsubscribe);
}
