/**
 * Regression #2: MAIN link down, BACKUP link up → site must show AMBER (DEGRADED),
 * never RED (DOWN). (§12.5 IRON RULE)
 *
 * This is the single most critical correctness property of the new tool. The old
 * site showed RED for any site whose MAIN link was down, even if backup was active.
 * Directors were calling field teams for sites that were actually still serving
 * traffic on their backup routes.
 *
 * Topology:
 *   Root — [MAIN DOWN] → Regional Hub
 *   Root — [BACKUP UP]  → Regional Hub   ← backup is active
 *
 * Expected:
 *   Regional Hub = DEGRADED (amber).  Old site returned DOWN (red).
 *
 * Also validates a 3-hop chain: root → hub → leaf via backup-only path.
 * All hops should be DEGRADED, none DOWN.
 */
import { describe, it, expect } from 'vitest';
import { computeReachability } from '../../src/services/topology/reachability.js';

describe('Regression #2: MAIN down + BACKUP up = DEGRADED (amber), not DOWN (red)', () => {
  it('single hop: site with MAIN down but BACKUP up is DEGRADED', () => {
    const ROOT = 1;
    const HUB = 2;

    const result = computeReachability({
      devices: [{ id: ROOT }, { id: HUB }],
      links: [
        { id: 10, source_device_id: ROOT, target_device_id: HUB, ranking: 'MAIN', status: 'DOWN' },
        { id: 11, source_device_id: ROOT, target_device_id: HUB, ranking: 'BACKUP', status: 'UP' },
      ],
      rootDeviceIds: [ROOT],
    });

    expect(result.devices.find((d) => d.id === ROOT)!.effective_status).toBe('UP');
    // THE CRITICAL ASSERTION: amber, not red
    expect(result.devices.find((d) => d.id === HUB)!.effective_status).toBe('DEGRADED');
  });

  it('3-hop chain all via backup: every hop shows DEGRADED', () => {
    // Root — [MAIN DOWN, BACKUP UP] → Hub — [MAIN UP] → Leaf
    // Hub is DEGRADED; Leaf is also DEGRADED (inherited via Hub's backup path)
    const ROOT = 1;
    const HUB = 2;
    const LEAF = 3;

    const result = computeReachability({
      devices: [{ id: ROOT }, { id: HUB }, { id: LEAF }],
      links: [
        { id: 10, source_device_id: ROOT, target_device_id: HUB, ranking: 'MAIN', status: 'DOWN' },
        { id: 11, source_device_id: ROOT, target_device_id: HUB, ranking: 'BACKUP', status: 'UP' },
        { id: 12, source_device_id: HUB, target_device_id: LEAF, ranking: 'MAIN', status: 'UP' },
      ],
      rootDeviceIds: [ROOT],
    });

    const deviceStatus = (id: number) =>
      result.devices.find((d) => d.id === id)!.effective_status;

    expect(deviceStatus(ROOT)).toBe('UP');
    expect(deviceStatus(HUB)).toBe('DEGRADED');
    // Leaf is downstream of a degraded hub — it's still reachable via backup path
    expect(deviceStatus(LEAF)).toBe('DEGRADED');
  });

  it('AUX link as last resort also prevents DOWN', () => {
    // Same as above but using AUX ranking (lowest priority)
    const ROOT = 1;
    const SITE = 2;

    const result = computeReachability({
      devices: [{ id: ROOT }, { id: SITE }],
      links: [
        { id: 10, source_device_id: ROOT, target_device_id: SITE, ranking: 'MAIN', status: 'DOWN' },
        { id: 11, source_device_id: ROOT, target_device_id: SITE, ranking: 'AUX', status: 'UP' },
      ],
      rootDeviceIds: [ROOT],
    });

    expect(result.devices.find((d) => d.id === SITE)!.effective_status).toBe('DEGRADED');
  });
});
