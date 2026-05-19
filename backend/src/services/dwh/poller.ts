import type pg from 'pg';
import { fetchNewAlarms } from './queries.js';
import { resolveAlarm, createDbLinkLookup } from './alarm-resolver.js';
import type { LinkLookup } from './alarm-resolver.js';
import { alarmBus } from './event-bus.js';
import { logger } from '../../lib/logger.js';

export interface DwhPollerOptions {
  dwhPool: pg.Pool;
  appPool: pg.Pool;
  /** Overrides createDbLinkLookup — used in tests. */
  linkLookup?: LinkLookup;
  /** ms between successful polls; defaults to env.DWH_POLL_INTERVAL_MS */
  pollIntervalMs: number;
  /** Alarm name that triggers reachability recompute (DESIGN.md §7 premise 8). */
  fiberCutAlarmName: string;
}

// Exponential backoff bounds (ms)
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 60_000;

/**
 * Background worker that polls dwh.fibergis_alarm_log for new rows and
 * publishes each to the in-process alarmBus.
 *
 * Design constraints (DESIGN.md §9 real-time):
 * - setInterval-based; never polls faster than configured interval on success.
 * - On DWH connection failure: exponential backoff 1s → 2s → ... → 60s max.
 * - Unresolvable alarms are logged and published (resolvedLinkId = null); they
 *   still reach the ticker and dashboard.
 * - Only alarms where Alarm_Name === fiberCutAlarmName set isFiberCut = true.
 *   Empty fiberCutAlarmName → no alarm ever triggers reachability (safe default).
 */
export class DwhPoller {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastSeen: Date = new Date();
  private backoffMs: number = BACKOFF_MIN_MS;
  private running = false;
  private readonly lookup: LinkLookup;

  constructor(private readonly opts: DwhPollerOptions) {
    this.lookup = opts.linkLookup ?? createDbLinkLookup(opts.appPool);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastSeen = new Date();
    logger.info({ event: 'dwh_poller_start', pollIntervalMs: this.opts.pollIntervalMs }, 'DWH poller starting');
    this.scheduleNext(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info({ event: 'dwh_poller_stop' }, 'DWH poller stopped');
  }

  private scheduleNext(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.tick().catch(() => {
        // tick() handles its own error logging and reschedules with backoff
      });
    }, delayMs);
  }

  private async tick(): Promise<void> {
    try {
      const rows = await fetchNewAlarms(this.opts.dwhPool, this.lastSeen);

      for (const alarm of rows) {
        const resolved = await resolveAlarm(alarm, this.lookup, logger).catch((err) => {
          logger.error({ err, serial: alarm.Log_Serial_Number }, 'alarm resolver threw unexpectedly');
          return null;
        });

        const isFiberCut =
          !!this.opts.fiberCutAlarmName &&
          alarm.Alarm_Name === this.opts.fiberCutAlarmName;

        alarmBus.publish({
          alarm,
          resolvedLinkId: resolved?.id ?? null,
          isFiberCut,
        });

        logger.info(
          {
            event: 'alarm_received',
            serial: alarm.Log_Serial_Number,
            alarm_name: alarm.Alarm_Name,
            severity: alarm.Alarm_Severity,
            resolvedLinkId: resolved?.id ?? null,
            isFiberCut,
          },
          'alarm_received',
        );

        // Advance cursor to prevent re-processing
        if (alarm.OccurrenceTime > this.lastSeen) {
          this.lastSeen = alarm.OccurrenceTime;
        }
      }

      // Success — reset backoff
      this.backoffMs = BACKOFF_MIN_MS;
      this.scheduleNext(this.opts.pollIntervalMs);
    } catch (err) {
      logger.error(
        { err, event: 'dwh_poll_error', nextRetryMs: this.backoffMs },
        'DWH poll failed; backing off',
      );
      const delay = this.backoffMs;
      this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX_MS);
      this.scheduleNext(delay);
    }
  }
}
