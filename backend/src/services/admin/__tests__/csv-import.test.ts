/**
 * Unit tests for csv-import.ts — pure parsing / validation logic.
 * DB calls are NOT tested here (no testcontainers); those are covered by
 * the integration suite. These tests check the CSV parser, row validator,
 * and error accumulation paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the DB pool so no real connection is attempted ───────────────────
vi.mock('../../../db/app-pool.js', () => ({
  appPool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

// Import AFTER mocks so module uses the mocked pool
import { importCSV } from '../csv-import.js';
import { appPool } from '../../../db/app-pool.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeMockClient(queryResponses: Array<{ rows: unknown[] }>) {
  let call = 0;
  return {
    query: vi.fn().mockImplementation(() => Promise.resolve(queryResponses[call++] ?? { rows: [] })),
    release: vi.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('importCSV — sites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error on empty CSV', async () => {
    const summary = await importCSV('', 'sites');
    expect(summary.sites.errors).toHaveLength(1);
    expect(summary.sites.imported).toBe(0);
  });

  it('returns error on header-only CSV', async () => {
    const csv = 'name,region,state,lat,lng,is_root\n';
    const summary = await importCSV(csv, 'sites');
    expect(summary.sites.errors).toHaveLength(1);
    expect(summary.sites.imported).toBe(0);
  });

  it('imports valid sites row', async () => {
    const mockClient = makeMockClient([
      { rows: [] }, // BEGIN
      { rows: [] }, // INSERT site
      { rows: [] }, // COMMIT
    ]);
    (appPool.connect as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    const csv = 'site_id_external,name,region,state,lat,lng,is_root\nSDN-KRT-001,Khartoum North,Khartoum,KH State,15.5,32.5,false\n';
    const summary = await importCSV(csv, 'sites');
    expect(summary.sites.imported).toBe(1);
    expect(summary.sites.errors).toHaveLength(0);
  });

  it('records row error for invalid lat', async () => {
    const mockClient = makeMockClient([{ rows: [] }, { rows: [] }]);
    (appPool.connect as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    const csv = 'name,lat,lng,is_root\nBad Site,999,32.5,false\n';
    const summary = await importCSV(csv, 'sites');
    expect(summary.sites.errors[0]).toContain('Row 2');
    expect(summary.sites.imported).toBe(0);
  });

  it('records row error for missing name', async () => {
    const mockClient = makeMockClient([{ rows: [] }, { rows: [] }]);
    (appPool.connect as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    const csv = 'name,lat,lng\n,15.5,32.5\n';
    const summary = await importCSV(csv, 'sites');
    expect(summary.sites.errors[0]).toContain('Row 2');
  });

  it('handles Windows CRLF line endings', async () => {
    const mockClient = makeMockClient([{ rows: [] }, { rows: [] }, { rows: [] }]);
    (appPool.connect as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    const csv = 'name,region\r\nKhartoum Central,Khartoum\r\n';
    const summary = await importCSV(csv, 'sites');
    expect(summary.sites.imported).toBe(1);
  });
});

describe('importCSV — devices', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns error when site_id_external not found in DB', async () => {
    const mockClient = makeMockClient([
      { rows: [] },             // BEGIN
      { rows: [] },             // SELECT site — not found
      { rows: [] },             // COMMIT
    ]);
    (appPool.connect as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    const csv = 'device_id_external,site_id_external,name\nNE-001,NONEXISTENT,Router A\n';
    const summary = await importCSV(csv, 'devices');
    expect(summary.devices.errors[0]).toContain('not found');
  });

  it('returns error for missing required site_id_external', async () => {
    const mockClient = makeMockClient([{ rows: [] }, { rows: [] }]);
    (appPool.connect as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    const csv = 'device_id_external,site_id_external,name\nNE-001,,Router A\n';
    const summary = await importCSV(csv, 'devices');
    expect(summary.devices.errors[0]).toContain('Row 2');
  });
});

describe('importCSV — links', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns error for invalid ranking value', async () => {
    const mockClient = makeMockClient([{ rows: [] }, { rows: [] }]);
    (appPool.connect as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    const csv = 'link_id_external,source_device_external,target_device_external,ranking\nL1,DEV-A,DEV-B,INVALID\n';
    const summary = await importCSV(csv, 'links');
    expect(summary.links.errors[0]).toContain('Row 2');
  });

  it('returns error when source device not found', async () => {
    const mockClient = makeMockClient([
      { rows: [] },         // BEGIN
      { rows: [] },         // SELECT source device — not found
      { rows: [{ id: 2 }] }, // SELECT target device (still called)
      { rows: [] },         // COMMIT
    ]);
    (appPool.connect as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    const csv = 'source_device_external,target_device_external,ranking\nMISSING-DEV,DEV-B,MAIN\n';
    const summary = await importCSV(csv, 'links');
    expect(summary.links.errors[0]).toContain('not found');
  });
});
