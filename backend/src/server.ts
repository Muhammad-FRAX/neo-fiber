import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { createApp } from './app.js';
import { dwhPool } from './db/dwh-pool.js';
import { appPool } from './db/app-pool.js';
import { DwhPoller } from './services/dwh/poller.js';
import { startReachabilityService } from './services/topology/reachability-service.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, node_env: env.NODE_ENV }, 'Server started');
});

// Start the DWH alarm poller (background worker — see DESIGN.md §9 real-time)
const poller = new DwhPoller({
  dwhPool,
  appPool,
  pollIntervalMs: env.DWH_POLL_INTERVAL_MS,
  fiberCutAlarmName: env.FIBER_CUT_ALARM_NAME,
});
poller.start();

// Start the reachability service (wires alarmBus fiber-cut events → computeReachability → topologyBus)
const stopReachabilityService = startReachabilityService(appPool);

// Graceful shutdown
function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down');
  poller.stop();
  stopReachabilityService();
  server.close(() => {
    dwhPool.end().catch(() => undefined);
    appPool.end().catch(() => undefined);
    process.exit(0);
  });
  // Force exit if close takes too long
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
