/**
 * Regression #3: Real historical incident — Sudan backbone cut, 2025-07-10
 * (§12.5 IRON RULE — pick one real historical incident where the old map lied)
 *
 * Incident context (derived from database sample.txt, 2025-07-10 ~17:52 UTC):
 *   - Multiple T_ALOS / ETH_LOS alarms fired on the HADALYA–DORDAIB segment
 *     (Kassala region, Zone 4). Alarm source: RDE0024-DOR3217.
 *   - The MAIN fiber link between the Kassala aggregation hub and the Dordaib
 *     sub-station was reported cut.
 *   - Kassala hub has a backup path through the Port Sudan coastal ring
 *     (pre-declared in alternate_paths by the network team).
 *   - Dordaib has no backup and genuinely lost service.
 *   - Hadalya is downstream of Dordaib; it also lost service.
 *
 * What the old map showed:
 *   - Kassala hub: RED (wrong — backup was active)
 *   - Dordaib: RED (correct — no backup)
 *   - Hadalya: RED (correct — downstream of genuinely down Dordaib)
 *   - All downstream sites of Kassala: RED (wrong — they had backup via Kassala)
 *
 * What the new map must show:
 *   - Kassala hub: AMBER/DEGRADED (backup active)
 *   - Kassala downstream sites (not on the cut segment): DEGRADED
 *   - Dordaib: RED/DOWN (no backup exists)
 *   - Hadalya: RED/DOWN (downstream of Dordaib, no alternative path)
 *
 * Network topology modeled here (simplified from DWH data):
 *
 *   ROOT (Khartoum HQ)
 *     ├──[MAIN DOWN]──→ KASSALA_HUB ←──[BACKUP UP]── ROOT  (via Port Sudan ring)
 *     └──[MAIN UP]───→ PORT_SUDAN_AGG
 *
 *   KASSALA_HUB
 *     ├──[MAIN DOWN]──→ DORDAIB          (the cut link, RDE0024-DOR3217)
 *     └──[MAIN UP]───→ KASSALA_DOWNSTREAM
 *
 *   DORDAIB
 *     └──[MAIN UP]───→ HADALYA           (downstream of Dordaib, no alternate)
 */
import { describe, it, expect } from 'vitest';
import { computeReachability } from '../../src/services/topology/reachability.js';

describe('Regression #3: Sudan backbone cut 2025-07-10 (Kassala/Dordaib segment)', () => {
  // Device IDs
  const ROOT = 1;              // Khartoum HQ (anchor root)
  const PORT_SUDAN = 2;        // Port Sudan aggregation
  const KASSALA_HUB = 3;       // Kassala regional hub
  const KASSALA_DOWNSTREAM = 4; // Sites served by Kassala hub (not on cut segment)
  const DORDAIB = 5;           // Cut end-point (RDE0024-DOR3217)
  const HADALYA = 6;           // Downstream of Dordaib

  it('correctly colors affected vs backup-protected sites', () => {
    const result = computeReachability({
      devices: [
        { id: ROOT },
        { id: PORT_SUDAN },
        { id: KASSALA_HUB },
        { id: KASSALA_DOWNSTREAM },
        { id: DORDAIB },
        { id: HADALYA },
      ],
      links: [
        // Main backbone — Root → Kassala (cut by the 2025-07-10 incident)
        { id: 10, source_device_id: ROOT, target_device_id: KASSALA_HUB, ranking: 'MAIN', status: 'DOWN' },
        // Backup path to Kassala via Port Sudan coastal ring
        { id: 11, source_device_id: ROOT, target_device_id: PORT_SUDAN, ranking: 'MAIN', status: 'UP' },
        { id: 12, source_device_id: PORT_SUDAN, target_device_id: KASSALA_HUB, ranking: 'BACKUP', status: 'UP' },
        // Kassala hub to its healthy downstream sites (not cut)
        { id: 13, source_device_id: KASSALA_HUB, target_device_id: KASSALA_DOWNSTREAM, ranking: 'MAIN', status: 'UP' },
        // Cut link — Kassala to Dordaib (this is the actual RDE0024-DOR3217 alarm)
        { id: 14, source_device_id: KASSALA_HUB, target_device_id: DORDAIB, ranking: 'MAIN', status: 'DOWN' },
        // Dordaib to Hadalya — hardware up, but no traffic (upstream is cut)
        { id: 15, source_device_id: DORDAIB, target_device_id: HADALYA, ranking: 'MAIN', status: 'UP' },
      ],
      rootDeviceIds: [ROOT],
    });

    const deviceStatus = (id: number) =>
      result.devices.find((d) => d.id === id)!.effective_status;
    const linkStatus = (id: number) =>
      result.links.find((l) => l.id === id)!.effective_status;

    // Root and Port Sudan: full MAIN path → UP
    expect(deviceStatus(ROOT)).toBe('UP');
    expect(deviceStatus(PORT_SUDAN)).toBe('UP');

    // Kassala hub: reachable via backup (Port Sudan ring) → DEGRADED
    // Old map showed RED here — this was the primary false positive.
    expect(deviceStatus(KASSALA_HUB)).toBe('DEGRADED');

    // Sites served by Kassala's healthy downstream links: also DEGRADED
    // (reachable, but path goes through the degraded Kassala hub)
    expect(deviceStatus(KASSALA_DOWNSTREAM)).toBe('DEGRADED');

    // Dordaib: the Kassala→Dordaib MAIN link is DOWN, no backup declared → DOWN (red)
    // This one should be RED — the cut actually took this site offline.
    expect(deviceStatus(DORDAIB)).toBe('DOWN');

    // Hadalya: downstream of Dordaib, no path → DOWN (red)
    expect(deviceStatus(HADALYA)).toBe('DOWN');

    // Link statuses
    expect(linkStatus(10)).toBe('DOWN');      // Main backbone cut
    expect(linkStatus(11)).toBe('UP');        // Root→Port Sudan intact
    expect(linkStatus(12)).toBe('DEGRADED'); // Backup link carrying traffic
    expect(linkStatus(13)).toBe('UP');        // Kassala to healthy downstream (hardware UP, but source is degraded)
    expect(linkStatus(14)).toBe('DOWN');      // Cut link to Dordaib
  });
});
