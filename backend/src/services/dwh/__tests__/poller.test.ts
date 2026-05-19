/**
 * Unit tests for DwhPoller.
 *
 * Uses fake timers (vi.useFakeTimers) to control setTimeout.
 * vi.runOnlyPendingTimersAsync() is used to run exactly one tick at a time.
 * DWH pool and app pool are both mocked — no real Postgres needed.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import type { DwhAlarmRow } from '../queries.js';
import type { AlarmEvent } from '../event-bus.js';

// Set env vars BEFORE any dynamic import that transitively loads env.ts
beforeAll(() => {
  process.env['APP_DB_URL'] = 'postgres://unused:unused@localhost:5432/unused';
  process.env['DWH_URL'] = 'postgres://unused:unused@localhost:5432/unused';
  process.env['JWT_SECRET'] = 'unit-test-secret-that-is-exactly-32ch!';
  process.env['LOG_LEVEL'] = 'silent';
  process.env['NODE_ENV'] = 'test';
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAlarmRow(overrides: Partial<DwhAlarmRow> = {}): DwhAlarmRow {
  return {
    Log_Serial_Number: '100',
    Alarm_key: 1,
    Alarm_Name: 'R_LOS',
    Alarm_Severity: 'Critical',
    Alarm_Source: 'SRC_NE',
    Status: 'Not Clear',
    OccurrenceTime: new Date('2026-01-01T10:00:00Z'),
    ClearanceTime: null,
    DownTime: null,
    LocationInformation: null,
    Contractor: null,
    FiberlinkSite_ID: 'LINK-EXT-001',
    FiberLinkSite_Name: null,
    Site_A_ID: null,
    Site_A_Latitude: null,
    Site_A_Longitude: null,
    State: null,
    Zone: null,
    Vendor: null,
    Site_Priority: null,
    Is_Hub: null,
    Is_VIP: null,
    Site_B_ID: null,
    Site_B_Latitude: null,
    Site_B_Longitude: null,
    Source_NE: null,
    Sink_NE: null,
    ...overrides,
  };
}

function makeDwhPool(queryImpl: () => Promise<{ rows: DwhAlarmRow[] }>) {
  return { query: vi.fn().mockImplementation(queryImpl) } as unknown as import('pg').Pool;
}

function makeAppPool() {
  return {} as unknown as import('pg').Pool;
}

const noopLookup = {
  byFiberlinkSiteId: vi.fn().mockResolvedValue(null),
  byNePair: vi.fn().mockResolvedValue(null),
  bySiteIdPair: vi.fn().mockResolvedValue(null),
};

const resolvedLookup = {
  byFiberlinkSiteId: vi.fn().mockResolvedValue({ id: 42 }),
  byNePair: vi.fn().mockResolvedValue(null),
  bySiteIdPair: vi.fn().mockResolvedValue(null),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DwhPoller', () => {
  let events: AlarmEvent[];
  let unsubscribeFn: (() => void) | undefined;

  beforeEach(() => {
    events = [];
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    unsubscribeFn?.();
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  it('publishes alarm event on first tick', async () => {
    const { DwhPoller } = await import('../poller.js');
    const { alarmBus } = await import('../event-bus.js');
    unsubscribeFn = alarmBus.subscribe((e) => events.push(e));

    const row = makeAlarmRow();
    const poller = new DwhPoller({
      dwhPool: makeDwhPool(async () => ({ rows: [row] })),
      appPool: makeAppPool(),
      linkLookup: resolvedLookup,
      pollIntervalMs: 5_000,
      fiberCutAlarmName: 'R_LOS',
    });

    poller.start();
    // Run only the immediately-scheduled timer (delay=0), not the next one (5s)
    await vi.runOnlyPendingTimersAsync();

    expect(events).toHaveLength(1);
    expect(events[0].alarm.Log_Serial_Number).toBe('100');
    expect(events[0].resolvedLinkId).toBe(42);
    expect(events[0].isFiberCut).toBe(true);

    poller.stop();
  });

  it('isFiberCut=false when alarm name does not match', async () => {
    const { DwhPoller } = await import('../poller.js');
    const { alarmBus } = await import('../event-bus.js');
    unsubscribeFn = alarmBus.subscribe((e) => events.push(e));

    const row = makeAlarmRow({ Alarm_Name: 'ETH_LOS' });
    const poller = new DwhPoller({
      dwhPool: makeDwhPool(async () => ({ rows: [row] })),
      appPool: makeAppPool(),
      linkLookup: resolvedLookup,
      pollIntervalMs: 5_000,
      fiberCutAlarmName: 'R_LOS',
    });

    poller.start();
    await vi.runOnlyPendingTimersAsync();

    expect(events[0].isFiberCut).toBe(false);
    poller.stop();
  });

  it('isFiberCut=false when fiberCutAlarmName is empty string (safe default)', async () => {
    const { DwhPoller } = await import('../poller.js');
    const { alarmBus } = await import('../event-bus.js');
    unsubscribeFn = alarmBus.subscribe((e) => events.push(e));

    const row = makeAlarmRow({ Alarm_Name: 'R_LOS' });
    const poller = new DwhPoller({
      dwhPool: makeDwhPool(async () => ({ rows: [row] })),
      appPool: makeAppPool(),
      linkLookup: resolvedLookup,
      pollIntervalMs: 5_000,
      fiberCutAlarmName: '',
    });

    poller.start();
    await vi.runOnlyPendingTimersAsync();

    expect(events[0].isFiberCut).toBe(false);
    poller.stop();
  });

  it('resolvedLinkId=null for unresolvable alarm row', async () => {
    const { DwhPoller } = await import('../poller.js');
    const { alarmBus } = await import('../event-bus.js');
    unsubscribeFn = alarmBus.subscribe((e) => events.push(e));

    const row = makeAlarmRow({
      FiberlinkSite_ID: null,
      Source_NE: null,
      Sink_NE: null,
      Site_A_ID: null,
      Site_B_ID: null,
    });
    const poller = new DwhPoller({
      dwhPool: makeDwhPool(async () => ({ rows: [row] })),
      appPool: makeAppPool(),
      linkLookup: noopLookup,
      pollIntervalMs: 5_000,
      fiberCutAlarmName: 'R_LOS',
    });

    poller.start();
    await vi.runOnlyPendingTimersAsync();

    expect(events).toHaveLength(1);
    expect(events[0].resolvedLinkId).toBeNull();
    poller.stop();
  });

  it('advances lastSeen cursor to prevent re-publishing', async () => {
    const { DwhPoller } = await import('../poller.js');
    const { alarmBus } = await import('../event-bus.js');
    unsubscribeFn = alarmBus.subscribe((e) => events.push(e));

    const t1 = new Date('2026-01-01T10:00:00Z');
    const t2 = new Date('2026-01-01T10:00:05Z');
    const row1 = makeAlarmRow({ Log_Serial_Number: '1', OccurrenceTime: t1 });
    const row2 = makeAlarmRow({ Log_Serial_Number: '2', OccurrenceTime: t2 });

    let callCount = 0;
    const dwhPool = {
      query: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return { rows: [row1, row2] };
        return { rows: [] };
      }),
    } as unknown as import('pg').Pool;

    const poller = new DwhPoller({
      dwhPool,
      appPool: makeAppPool(),
      linkLookup: noopLookup,
      pollIntervalMs: 5_000,
      fiberCutAlarmName: '',
    });

    poller.start();
    // First tick
    await vi.runOnlyPendingTimersAsync();
    expect(events).toHaveLength(2);

    // Advance to second tick
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.runOnlyPendingTimersAsync();
    // Cursor moved past t2 → no new events
    expect(events).toHaveLength(2);

    // Second query's `after` argument must be >= t2
    const secondArgs = (dwhPool.query as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(secondArgs[1][0] >= t2).toBe(true);

    poller.stop();
  });

  it('uses exponential backoff: 1s → 2s → reset on success', async () => {
    const { DwhPoller } = await import('../poller.js');

    let callCount = 0;
    const dwhPool = {
      query: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) throw new Error('connection refused');
        return { rows: [] };
      }),
    } as unknown as import('pg').Pool;

    const poller = new DwhPoller({
      dwhPool,
      appPool: makeAppPool(),
      linkLookup: noopLookup,
      pollIntervalMs: 5_000,
      fiberCutAlarmName: '',
    });

    poller.start();

    // First tick (delay=0) → fails → schedules 1s retry
    await vi.runOnlyPendingTimersAsync();
    expect(dwhPool.query).toHaveBeenCalledTimes(1);

    // Advance 1s → second tick → fails → schedules 2s retry
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();
    expect(dwhPool.query).toHaveBeenCalledTimes(2);

    // Advance 2s → third tick → succeeds → resets to pollIntervalMs (5s)
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.runOnlyPendingTimersAsync();
    expect(dwhPool.query).toHaveBeenCalledTimes(3);

    poller.stop();
  });

  it('stop() halts polling — no further ticks after stop', async () => {
    const { DwhPoller } = await import('../poller.js');

    const dwhPool = makeDwhPool(async () => ({ rows: [] }));

    const poller = new DwhPoller({
      dwhPool,
      appPool: makeAppPool(),
      linkLookup: noopLookup,
      pollIntervalMs: 5_000,
      fiberCutAlarmName: '',
    });

    poller.start();
    await vi.runOnlyPendingTimersAsync(); // first tick
    poller.stop();

    // Advance well beyond one interval — should not trigger any more queries
    await vi.advanceTimersByTimeAsync(20_000);
    await vi.runOnlyPendingTimersAsync();

    expect((dwhPool.query as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });
});
