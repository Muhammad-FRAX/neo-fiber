/**
 * Two-pass BFS reachability (DESIGN.md §9 — Backup-aware reachability).
 *
 * Pass 1: BFS over status=UP AND ranking=MAIN edges only.
 * Pass 2: BFS over status=UP edges of any ranking.
 *
 * Device status:
 *   in pass1       → UP
 *   in pass2 only  → DEGRADED (on backup, not main)
 *   in neither     → DOWN
 *
 * Link status (per §9 spec):
 *   l.status = DOWN              → DOWN
 *   l is BACKUP/AUX carrying traffic (either endpoint in pass2-only) → DEGRADED
 *   otherwise                   → UP
 *
 * Complexity: O(V+E) per pass — two passes total. Cycle-safe via visited set.
 */

export type LinkStatus = 'UP' | 'DOWN';
export type LinkRanking = 'MAIN' | 'BACKUP' | 'AUX';
export type EffectiveStatus = 'UP' | 'DEGRADED' | 'DOWN';

export interface TopologyDevice {
  id: number;
}

export interface TopologyLink {
  id: number;
  source_device_id: number;
  target_device_id: number;
  ranking: LinkRanking;
  status: LinkStatus;
}

export interface ReachabilityInput {
  devices: TopologyDevice[];
  links: TopologyLink[];
  rootDeviceIds: number[];
}

export interface DeviceReachability {
  id: number;
  effective_status: EffectiveStatus;
}

export interface LinkReachability {
  id: number;
  effective_status: EffectiveStatus;
}

export interface ReachabilityResult {
  devices: DeviceReachability[];
  links: LinkReachability[];
}

function bfs(
  roots: number[],
  links: TopologyLink[],
  filter: (l: TopologyLink) => boolean,
): Set<number> {
  const visited = new Set<number>(roots);
  const queue = [...roots];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const l of links) {
      if (!filter(l)) continue;

      let neighbor: number | null = null;
      if (l.source_device_id === current) {
        neighbor = l.target_device_id;
      } else if (l.target_device_id === current) {
        neighbor = l.source_device_id;
      }

      if (neighbor !== null && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return visited;
}

export function computeReachability(input: ReachabilityInput): ReachabilityResult {
  const { devices, links, rootDeviceIds } = input;

  const pass1 = bfs(rootDeviceIds, links, (l) => l.status === 'UP' && l.ranking === 'MAIN');
  const pass2 = bfs(rootDeviceIds, links, (l) => l.status === 'UP');

  const deviceResults: DeviceReachability[] = devices.map((d) => {
    let effective_status: EffectiveStatus;
    if (pass1.has(d.id)) {
      effective_status = 'UP';
    } else if (pass2.has(d.id)) {
      effective_status = 'DEGRADED';
    } else {
      effective_status = 'DOWN';
    }
    return { id: d.id, effective_status };
  });

  const linkResults: LinkReachability[] = links.map((l) => {
    if (l.status === 'DOWN') {
      return { id: l.id, effective_status: 'DOWN' };
    }

    if (l.ranking === 'MAIN') {
      return { id: l.id, effective_status: 'UP' };
    }

    // BACKUP or AUX link that is UP — DEGRADED if either endpoint is on backup-only path
    const srcDegraded = pass2.has(l.source_device_id) && !pass1.has(l.source_device_id);
    const tgtDegraded = pass2.has(l.target_device_id) && !pass1.has(l.target_device_id);

    return {
      id: l.id,
      effective_status: srcDegraded || tgtDegraded ? 'DEGRADED' : 'UP',
    };
  });

  return { devices: deviceResults, links: linkResults };
}
