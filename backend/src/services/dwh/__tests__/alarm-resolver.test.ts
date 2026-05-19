import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAlarm } from '../alarm-resolver.js';
import type { DwhAlarmRow } from '../queries.js';
import type { LinkLookup } from '../alarm-resolver.js';

// ---------------------------------------------------------------------------
// Fixtures — one row per variant in database sample.txt
// ---------------------------------------------------------------------------

/** Row 1: has FiberlinkSite_ID + Site_A/B_ID (no NEs). Resolves by FiberlinkSite_ID. */
const rowWithFiberlinkSiteId: DwhAlarmRow = {
  Log_Serial_Number: '257589719',
  Alarm_key: 6,
  Alarm_Name: 'T_ALOS',
  Alarm_Severity: 'Major',
  Alarm_Source: 'RDE0024_DWDM Site_RTN 905',
  Status: 'Clear',
  OccurrenceTime: new Date('2025-07-10T17:52:03.000Z'),
  ClearanceTime: new Date('2025-07-10T17:52:08.000Z'),
  DownTime: '00:00:05',
  LocationInformation: '9-MP1-1(SDH_TU-1)-PPI:1',
  Contractor: 'Sudatel',
  FiberlinkSite_ID: 'RDE0024-DOR3217',
  FiberLinkSite_Name: 'HADALYA - DORDAIB',
  Site_A_ID: 'RDE0024',
  Site_A_Latitude: '16.1425',
  Site_A_Longitude: '36.1136',
  State: 'Kassala',
  Zone: 'Zone4',
  Vendor: 'Huawei',
  Site_Priority: 'B',
  Is_Hub: 'No',
  Is_VIP: 'No',
  Site_B_ID: 'DOR3217',
  Site_B_Latitude: '17.54012',
  Site_B_Longitude: '36.08081',
  Source_NE: null,
  Sink_NE: null,
};

/** Row 2: no FiberlinkSite_ID, has Source_NE + Sink_NE only. Resolves by NE pair. */
const rowWithNePair: DwhAlarmRow = {
  Log_Serial_Number: '257589696',
  Alarm_key: 6,
  Alarm_Name: 'T_ALOS',
  Alarm_Severity: 'Major',
  Alarm_Source: 'RDS0074_ATBHYA7',
  Status: 'Clear',
  OccurrenceTime: new Date('2025-07-10T17:52:03.000Z'),
  ClearanceTime: new Date('2025-07-10T17:52:08.000Z'),
  DownTime: '00:00:05',
  LocationInformation: '19-SP3S-1(SDH_TU-1)-PPI:1',
  Contractor: null,
  FiberlinkSite_ID: null,
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
  Source_NE: 'RDS0074_ATBHYA7',
  Sink_NE: 'RDS0075_ATB-HYA8',
};

/** Row 3: almost everything empty — unresolvable. */
const rowUnresolvable: DwhAlarmRow = {
  Log_Serial_Number: '257588375',
  Alarm_key: 0,
  Alarm_Name: null,
  Alarm_Severity: 'Minor',
  Alarm_Source: null,
  Status: 'Clear',
  OccurrenceTime: new Date('2025-07-10T17:52:03.000Z'),
  ClearanceTime: new Date('2025-07-10T17:52:18.000Z'),
  DownTime: '00:00:15',
  LocationInformation: 'Slot ID=0 Card ID=4 Port ID=0 HpIndex=1 LpIndex=42',
  Contractor: null,
  FiberlinkSite_ID: null,
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
};

/** Row 4: no FiberlinkSite_ID, has Source_NE + Sink_NE (Critical severity). */
const rowWithNePairCritical: DwhAlarmRow = {
  Log_Serial_Number: '257589694',
  Alarm_key: 9,
  Alarm_Name: 'ETH_LOS',
  Alarm_Severity: 'Critical',
  Alarm_Source: 'AZH3922_AZAZAH_RTN 905',
  Status: 'Clear',
  OccurrenceTime: new Date('2025-07-10T17:52:02.000Z'),
  ClearanceTime: new Date('2025-07-10T17:52:05.000Z'),
  DownTime: '00:00:03',
  LocationInformation: '7-EG6-2(2G)-MAC:1',
  Contractor: null,
  FiberlinkSite_ID: null,
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
  Source_NE: 'AZH3922_AZAZAH_RTN 905',
  Sink_NE: 'UBG3923_UMBGRA_RTN 950A',
};

/** Row 5: no FiberlinkSite_ID, has Source_NE + Sink_NE (Major, no alarm name). */
const rowWithNePairMajor: DwhAlarmRow = {
  Log_Serial_Number: '257589693',
  Alarm_key: 0,
  Alarm_Name: null,
  Alarm_Severity: 'Major',
  Alarm_Source: 'BRG5433_ALBARGANA_RTN 910A',
  Status: 'Clear',
  OccurrenceTime: new Date('2025-07-10T17:52:02.000Z'),
  ClearanceTime: new Date('2025-07-10T17:52:02.000Z'),
  DownTime: '00:00:00',
  LocationInformation: null,
  Contractor: null,
  FiberlinkSite_ID: null,
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
  Source_NE: 'BRG5433_ALBARGANA_RTN 910A',
  Sink_NE: 'HMR0532_OM-HAMRA_RTN 950A',
};

/** Synthetic row: no FiberlinkSite_ID, no NEs, but has Site_A_ID + Site_B_ID. */
const rowWithSiteIdPair: DwhAlarmRow = {
  ...rowUnresolvable,
  Log_Serial_Number: '999999999',
  Site_A_ID: 'SITE_ALPHA',
  Site_B_ID: 'SITE_BETA',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLookup(overrides: Partial<LinkLookup> = {}): LinkLookup {
  return {
    byFiberlinkSiteId: vi.fn().mockResolvedValue(null),
    byNePair: vi.fn().mockResolvedValue(null),
    bySiteIdPair: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveAlarm', () => {
  let warnSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    warnSpy = vi.fn();
  });

  it('resolves by FiberlinkSite_ID when present (row 1)', async () => {
    const lookup = makeLookup({
      byFiberlinkSiteId: vi.fn().mockResolvedValue({ id: 42 }),
    });

    const result = await resolveAlarm(rowWithFiberlinkSiteId, lookup, { warn: warnSpy });

    expect(result).toEqual({ id: 42 });
    expect(lookup.byFiberlinkSiteId).toHaveBeenCalledWith('RDE0024-DOR3217');
    expect(lookup.byNePair).not.toHaveBeenCalled();
    expect(lookup.bySiteIdPair).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('falls through to NE pair when FiberlinkSite_ID resolves to null', async () => {
    const lookup = makeLookup({
      byFiberlinkSiteId: vi.fn().mockResolvedValue(null),
      byNePair: vi.fn().mockResolvedValue({ id: 7 }),
    });

    // rowWithFiberlinkSiteId has no NEs — it won't reach byNePair step.
    // Use a row that has both FiberlinkSite_ID AND NEs to test fall-through.
    const rowBothKeys: DwhAlarmRow = {
      ...rowWithFiberlinkSiteId,
      Source_NE: 'NE_A',
      Sink_NE: 'NE_B',
    };

    const result = await resolveAlarm(rowBothKeys, lookup, { warn: warnSpy });

    expect(result).toEqual({ id: 7 });
    expect(lookup.byFiberlinkSiteId).toHaveBeenCalled();
    expect(lookup.byNePair).toHaveBeenCalledWith('NE_A', 'NE_B');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('resolves by Source_NE + Sink_NE when FiberlinkSite_ID absent (row 2)', async () => {
    const lookup = makeLookup({
      byNePair: vi.fn().mockResolvedValue({ id: 55 }),
    });

    const result = await resolveAlarm(rowWithNePair, lookup, { warn: warnSpy });

    expect(result).toEqual({ id: 55 });
    expect(lookup.byFiberlinkSiteId).not.toHaveBeenCalled();
    expect(lookup.byNePair).toHaveBeenCalledWith('RDS0074_ATBHYA7', 'RDS0075_ATB-HYA8');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('resolves by Source_NE + Sink_NE for Critical row (row 4)', async () => {
    const lookup = makeLookup({
      byNePair: vi.fn().mockResolvedValue({ id: 100 }),
    });

    const result = await resolveAlarm(rowWithNePairCritical, lookup, { warn: warnSpy });

    expect(result).toEqual({ id: 100 });
    expect(lookup.byNePair).toHaveBeenCalledWith(
      'AZH3922_AZAZAH_RTN 905',
      'UBG3923_UMBGRA_RTN 950A',
    );
  });

  it('resolves by Source_NE + Sink_NE for Major row with null alarm name (row 5)', async () => {
    const lookup = makeLookup({
      byNePair: vi.fn().mockResolvedValue({ id: 200 }),
    });

    const result = await resolveAlarm(rowWithNePairMajor, lookup, { warn: warnSpy });

    expect(result).toEqual({ id: 200 });
    expect(lookup.byNePair).toHaveBeenCalledWith(
      'BRG5433_ALBARGANA_RTN 910A',
      'HMR0532_OM-HAMRA_RTN 950A',
    );
  });

  it('resolves by Site_A_ID + Site_B_ID when NEs are absent but site IDs present', async () => {
    const lookup = makeLookup({
      bySiteIdPair: vi.fn().mockResolvedValue({ id: 77 }),
    });

    const result = await resolveAlarm(rowWithSiteIdPair, lookup, { warn: warnSpy });

    expect(result).toEqual({ id: 77 });
    expect(lookup.byNePair).not.toHaveBeenCalled();
    expect(lookup.bySiteIdPair).toHaveBeenCalledWith('SITE_ALPHA', 'SITE_BETA');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns null and logs warning for fully unresolvable row (row 3)', async () => {
    const lookup = makeLookup();

    const result = await resolveAlarm(rowUnresolvable, lookup, { warn: warnSpy });

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatchObject({
      serial: '257588375',
    });
  });

  it('returns null and logs warning when all lookups return null', async () => {
    const lookup = makeLookup({
      byFiberlinkSiteId: vi.fn().mockResolvedValue(null),
      byNePair: vi.fn().mockResolvedValue(null),
      bySiteIdPair: vi.fn().mockResolvedValue(null),
    });

    // Row with all keys present but no matching DB entry
    const rowAllKeysMiss: DwhAlarmRow = {
      ...rowWithFiberlinkSiteId,
      Source_NE: 'NE_X',
      Sink_NE: 'NE_Y',
    };

    const result = await resolveAlarm(rowAllKeysMiss, lookup, { warn: warnSpy });

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('skips NE lookup when only one of Source_NE / Sink_NE is set', async () => {
    const lookup = makeLookup();
    const halfNe: DwhAlarmRow = {
      ...rowUnresolvable,
      Source_NE: 'ONLY_SOURCE',
      Sink_NE: null,
    };

    const result = await resolveAlarm(halfNe, lookup, { warn: warnSpy });

    expect(result).toBeNull();
    expect(lookup.byNePair).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('skips site-pair lookup when only one of Site_A_ID / Site_B_ID is set', async () => {
    const lookup = makeLookup();
    const halfSite: DwhAlarmRow = {
      ...rowUnresolvable,
      Site_A_ID: 'SITE_ONLY_A',
      Site_B_ID: null,
    };

    const result = await resolveAlarm(halfSite, lookup, { warn: warnSpy });

    expect(result).toBeNull();
    expect(lookup.bySiteIdPair).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});
