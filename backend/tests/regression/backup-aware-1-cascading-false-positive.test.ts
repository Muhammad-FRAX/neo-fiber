/**
 * Regression #1: Cascading false positive prevention (§12.5 IRON RULE)
 *
 * Old behavior: if a backbone link was cut, the old site propagated DOWN
 * naively to ALL downstream sites, coloring them RED — even those with
 * working backup paths. This was the primary trust-destroying failure mode.
 *
 * New behavior: sites downstream of the cut that are reachable via a backup
 * path must show DEGRADED (amber), never DOWN (red).
 *
 * Topology for this test:
 *   Root (Khartoum HQ)
 *     ├── [MAIN DOWN] ──→ Hub (Khartoum North Aggregation)
 *     └── [BACKUP UP] ──→ Hub (via Port Sudan ring)
 *   Hub
 *     ├── [MAIN UP] ──→ Site A (downstream, still reachable via Hub's backup path)
 *     └── [MAIN UP] ──→ Site B (downstream, still reachable via Hub's backup path)
 *
 * Cut event: MAIN link Root→Hub is DOWN.
 * Expected: Hub=DEGRADED, Site A=DEGRADED, Site B=DEGRADED. NOT DOWN/red.
 */
import { describe, it, expect } from 'vitest';
import { computeReachability } from '../../src/services/topology/reachability.js';

describe('Regression #1: cascading false positive — backup path prevents red', () => {
  it('downstream sites on backup path show DEGRADED, not DOWN', () => {
    // Device IDs
    const ROOT = 1;
    const HUB = 2;
    const SITE_A = 3;
    const SITE_B = 4;

    const result = computeReachability({
      devices: [{ id: ROOT }, { id: HUB }, { id: SITE_A }, { id: SITE_B }],
      links: [
        // Backbone link — cut
        { id: 10, source_device_id: ROOT, target_device_id: HUB, ranking: 'MAIN', status: 'DOWN' },
        // Backup path to hub (e.g., via Port Sudan ring)
        { id: 11, source_device_id: ROOT, target_device_id: HUB, ranking: 'BACKUP', status: 'UP' },
        // Downstream links from hub — still UP (the cut is upstream)
        { id: 12, source_device_id: HUB, target_device_id: SITE_A, ranking: 'MAIN', status: 'UP' },
        { id: 13, source_device_id: HUB, target_device_id: SITE_B, ranking: 'MAIN', status: 'UP' },
      ],
      rootDeviceIds: [ROOT],
    });

    const deviceStatus = (id: number) =>
      result.devices.find((d) => d.id === id)!.effective_status;

    // Root itself is fine
    expect(deviceStatus(ROOT)).toBe('UP');

    // Hub is on backup — DEGRADED, not DOWN.
    // Old site returned DOWN here (the cascading false positive).
    expect(deviceStatus(HUB)).toBe('DEGRADED');

    // Downstream sites remain reachable through hub's backup path.
    // Old site returned DOWN for these too.
    expect(deviceStatus(SITE_A)).toBe('DEGRADED');
    expect(deviceStatus(SITE_B)).toBe('DEGRADED');

    // The cut backbone link is DOWN
    expect(result.links.find((l) => l.id === 10)!.effective_status).toBe('DOWN');
    // The backup link is carrying traffic → DEGRADED
    expect(result.links.find((l) => l.id === 11)!.effective_status).toBe('DEGRADED');
  });
});
