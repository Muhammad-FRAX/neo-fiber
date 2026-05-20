/**
 * Unit tests for two-pass BFS reachability (§25 T1, §9 Backup-aware reachability).
 * 7 scenarios covering all branches in computeReachability.
 *
 * These are pure function tests — no DB required.
 */
import { describe, it, expect } from 'vitest';
import { computeReachability } from '../reachability.js';
import type { TopologyDevice, TopologyLink } from '../reachability.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function device(id: number): TopologyDevice {
  return { id };
}

function link(
  id: number,
  src: number,
  tgt: number,
  ranking: 'MAIN' | 'BACKUP' | 'AUX',
  status: 'UP' | 'DOWN',
): TopologyLink {
  return { id, source_device_id: src, target_device_id: tgt, ranking, status };
}

function statusOf(
  result: ReturnType<typeof computeReachability>,
  type: 'device' | 'link',
  id: number,
) {
  const list = type === 'device' ? result.devices : result.links;
  const entry = list.find((x) => x.id === id);
  if (!entry) throw new Error(`${type} ${id} not found in result`);
  return entry.effective_status;
}

// ── test scenarios ────────────────────────────────────────────────────────────

describe('computeReachability', () => {
  // Scenario 1: empty roots → all devices DOWN
  it('empty roots — all devices DOWN regardless of links', () => {
    const result = computeReachability({
      devices: [device(1), device(2), device(3)],
      links: [link(10, 1, 2, 'MAIN', 'UP'), link(11, 2, 3, 'MAIN', 'UP')],
      rootDeviceIds: [],
    });

    expect(statusOf(result, 'device', 1)).toBe('DOWN');
    expect(statusOf(result, 'device', 2)).toBe('DOWN');
    expect(statusOf(result, 'device', 3)).toBe('DOWN');
  });

  // Scenario 2: simple chain via MAIN UP links → all UP
  it('simple chain — root→A→B→C via MAIN UP → all UP', () => {
    // root(1) — MAIN UP → A(2) — MAIN UP → B(3) — MAIN UP → C(4)
    const result = computeReachability({
      devices: [device(1), device(2), device(3), device(4)],
      links: [
        link(10, 1, 2, 'MAIN', 'UP'),
        link(11, 2, 3, 'MAIN', 'UP'),
        link(12, 3, 4, 'MAIN', 'UP'),
      ],
      rootDeviceIds: [1],
    });

    expect(statusOf(result, 'device', 1)).toBe('UP');
    expect(statusOf(result, 'device', 2)).toBe('UP');
    expect(statusOf(result, 'device', 3)).toBe('UP');
    expect(statusOf(result, 'device', 4)).toBe('UP');
    expect(statusOf(result, 'link', 10)).toBe('UP');
    expect(statusOf(result, 'link', 11)).toBe('UP');
    expect(statusOf(result, 'link', 12)).toBe('UP');
  });

  // Scenario 3: multi-root — two roots anchor independent subtrees
  it('multi-root — root1 anchors A-B, root2 anchors C-D — all UP', () => {
    // root1(1)—MAIN UP→A(2)—MAIN UP→B(3)
    // root2(4)—MAIN UP→C(5)—MAIN UP→D(6)
    const result = computeReachability({
      devices: [device(1), device(2), device(3), device(4), device(5), device(6)],
      links: [
        link(10, 1, 2, 'MAIN', 'UP'),
        link(11, 2, 3, 'MAIN', 'UP'),
        link(12, 4, 5, 'MAIN', 'UP'),
        link(13, 5, 6, 'MAIN', 'UP'),
      ],
      rootDeviceIds: [1, 4],
    });

    for (let id = 1; id <= 6; id++) {
      expect(statusOf(result, 'device', id)).toBe('UP');
    }
  });

  // Scenario 4: cycle — BFS visited set prevents infinite loop
  it('cycle — ring topology, BFS terminates and all reachable devices UP', () => {
    // root(1) — MAIN UP → A(2) — MAIN UP → B(3) — MAIN UP → A(2) (cycle back)
    // Also: root(1) — MAIN UP → B(3) (another edge creating a ring)
    const result = computeReachability({
      devices: [device(1), device(2), device(3)],
      links: [
        link(10, 1, 2, 'MAIN', 'UP'),
        link(11, 2, 3, 'MAIN', 'UP'),
        link(12, 3, 1, 'MAIN', 'UP'), // closes the ring back to root
      ],
      rootDeviceIds: [1],
    });

    expect(statusOf(result, 'device', 1)).toBe('UP');
    expect(statusOf(result, 'device', 2)).toBe('UP');
    expect(statusOf(result, 'device', 3)).toBe('UP');
    // No infinite loop: the function returned, so BFS terminated correctly.
  });

  // Scenario 5: MAIN link DOWN, BACKUP link UP → downstream device DEGRADED (not DOWN)
  // This is the IRON RULE regression case: amber, never red.
  it('MAIN-down/BACKUP-up — downstream device DEGRADED, backup link DEGRADED', () => {
    // root(1) —[MAIN DOWN]→ A(2)   (pass1 cannot reach A)
    // root(1) —[BACKUP UP]→ A(2)   (pass2 reaches A via backup)
    const result = computeReachability({
      devices: [device(1), device(2)],
      links: [
        link(10, 1, 2, 'MAIN', 'DOWN'),
        link(11, 1, 2, 'BACKUP', 'UP'),
      ],
      rootDeviceIds: [1],
    });

    expect(statusOf(result, 'device', 1)).toBe('UP');   // root always UP
    expect(statusOf(result, 'device', 2)).toBe('DEGRADED'); // on backup, NOT DOWN
    expect(statusOf(result, 'link', 10)).toBe('DOWN');  // MAIN link is physically DOWN
    expect(statusOf(result, 'link', 11)).toBe('DEGRADED'); // BACKUP is carrying traffic
  });

  // Scenario 6: all paths down → device is DOWN
  it('all-paths-down — device with no UP path from root is DOWN', () => {
    // root(1) —[MAIN DOWN]→ A(2) —[BACKUP DOWN]→ B(3)
    // No UP link at all — A and B are DOWN
    const result = computeReachability({
      devices: [device(1), device(2), device(3)],
      links: [
        link(10, 1, 2, 'MAIN', 'DOWN'),
        link(11, 2, 3, 'BACKUP', 'DOWN'),
      ],
      rootDeviceIds: [1],
    });

    expect(statusOf(result, 'device', 1)).toBe('UP');  // root itself
    expect(statusOf(result, 'device', 2)).toBe('DOWN');
    expect(statusOf(result, 'device', 3)).toBe('DOWN');
    expect(statusOf(result, 'link', 10)).toBe('DOWN');
    expect(statusOf(result, 'link', 11)).toBe('DOWN');
  });

  // Scenario 7: disconnected graph — island devices are DOWN
  it('disconnected graph — isolated island devices are DOWN', () => {
    // root(1) —[MAIN UP]→ A(2)
    // B(3) —[MAIN UP]→ C(4)  (disconnected island — no path from root)
    const result = computeReachability({
      devices: [device(1), device(2), device(3), device(4)],
      links: [
        link(10, 1, 2, 'MAIN', 'UP'),
        link(11, 3, 4, 'MAIN', 'UP'), // island — not reachable from root
      ],
      rootDeviceIds: [1],
    });

    expect(statusOf(result, 'device', 1)).toBe('UP');
    expect(statusOf(result, 'device', 2)).toBe('UP');
    expect(statusOf(result, 'device', 3)).toBe('DOWN'); // island
    expect(statusOf(result, 'device', 4)).toBe('DOWN'); // island
  });
});
