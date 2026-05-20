import { EventEmitter } from 'events';
import type { ReachabilityResult } from './reachability.js';

export type TopologyStatusEvent = ReachabilityResult & { computedAt: string };

class TopologyBus extends EventEmitter {
  publish(event: TopologyStatusEvent): void {
    this.emit('topology_status', event);
  }

  subscribe(listener: (event: TopologyStatusEvent) => void): () => void {
    this.on('topology_status', listener);
    return () => this.off('topology_status', listener);
  }
}

export const topologyBus = new TopologyBus();
