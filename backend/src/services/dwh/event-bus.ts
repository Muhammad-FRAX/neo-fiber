import { EventEmitter } from 'events';
import type { DwhAlarmRow } from './queries.js';

export interface AlarmEvent {
  alarm: DwhAlarmRow;
  /** Internal app DB link.id if the alarm resolved to a known topology link, null otherwise. */
  resolvedLinkId: number | null;
  /** True when Alarm_Name === FIBER_CUT_ALARM_NAME env var (non-empty match). */
  isFiberCut: boolean;
}

// Minimal typed wrapper so callers get autocomplete without a third-party lib.
class AlarmBus extends EventEmitter {
  publish(event: AlarmEvent): void {
    this.emit('alarm', event);
  }

  subscribe(listener: (event: AlarmEvent) => void): () => void {
    this.on('alarm', listener);
    return () => this.off('alarm', listener);
  }
}

export const alarmBus = new AlarmBus();
