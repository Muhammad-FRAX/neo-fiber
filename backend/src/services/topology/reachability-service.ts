/**
 * Reachability service (DESIGN.md §9 real-time architecture step 3).
 *
 * Subscribes to alarmBus; on every fiber-cut event loads the current topology
 * from appPool, runs computeReachability, and publishes to topologyBus.
 *
 * Link-status state: maintained in-memory.
 *   - 'Not Clear' alarm → link DOWN
 *   - 'Clear' alarm     → link UP (restored)
 *
 * Tolerates empty topology tables gracefully (skips publish if no devices).
 */

import type pg from 'pg';
import { alarmBus } from '../dwh/event-bus.js';
import { topologyBus } from './topology-bus.js';
import { computeReachability } from './reachability.js';
import type { TopologyDevice, TopologyLink } from './reachability.js';
import { logger } from '../../lib/logger.js';

// In-memory link status: overrides the default UP for links touched by alarms.
const linkStatusStore = new Map<number, 'UP' | 'DOWN'>();

async function loadTopology(appPool: pg.Pool): Promise<{
  devices: TopologyDevice[];
  links: TopologyLink[];
  rootDeviceIds: number[];
}> {
  const [devicesResult, linksResult, rootsResult] = await Promise.all([
    appPool.query<{ id: number }>('SELECT id FROM devices'),
    appPool.query<{
      id: number;
      source_device_id: number;
      target_device_id: number;
      ranking: string;
    }>('SELECT id, source_device_id, target_device_id, ranking FROM links'),
    appPool.query<{ id: number }>(
      `SELECT d.id
         FROM devices d
         JOIN sites s ON d.site_id = s.id
        WHERE s.is_root = true`,
    ),
  ]);

  const links: TopologyLink[] = linksResult.rows.map((l) => ({
    id: l.id,
    source_device_id: l.source_device_id,
    target_device_id: l.target_device_id,
    ranking: l.ranking as 'MAIN' | 'BACKUP' | 'AUX',
    status: linkStatusStore.get(l.id) ?? 'UP',
  }));

  return {
    devices: devicesResult.rows,
    links,
    rootDeviceIds: rootsResult.rows.map((r) => r.id),
  };
}

export function startReachabilityService(appPool: pg.Pool): () => void {
  const unsubscribe = alarmBus.subscribe(async (event) => {
    if (!event.isFiberCut || event.resolvedLinkId === null) return;

    const status: 'UP' | 'DOWN' = event.alarm.Status === 'Clear' ? 'UP' : 'DOWN';
    linkStatusStore.set(event.resolvedLinkId, status);

    try {
      const topology = await loadTopology(appPool);
      if (topology.devices.length === 0) return; // Topology not seeded yet

      const result = computeReachability(topology);
      topologyBus.publish({ ...result, computedAt: new Date().toISOString() });

      logger.info(
        { event: 'topology_recomputed', linkId: event.resolvedLinkId, linkStatus: status },
        'Topology recomputed after fiber-cut event',
      );
    } catch (err) {
      logger.error({ err, event: 'topology_recompute_error' }, 'Failed to recompute topology');
    }
  });

  logger.info({ event: 'reachability_service_start' }, 'Reachability service started');
  return unsubscribe;
}
