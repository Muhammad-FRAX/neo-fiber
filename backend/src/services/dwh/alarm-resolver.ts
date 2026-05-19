import type pg from 'pg';
import type { DwhAlarmRow } from './queries.js';

export interface ResolvedLink {
  id: number;
}

/**
 * Injected lookup interface — production code passes DB queries; tests pass mocks.
 * All three methods must handle bidirectional matching (the DWH doesn't guarantee
 * consistent source/sink ordering relative to our topology).
 */
export interface LinkLookup {
  /** Step 1 — look up link by FiberlinkSite_ID (matches links.link_id_external). */
  byFiberlinkSiteId(id: string): Promise<ResolvedLink | null>;
  /** Step 2 — look up link by Source_NE / Sink_NE device pair (bidirectional). */
  byNePair(sourceNe: string, sinkNe: string): Promise<ResolvedLink | null>;
  /** Step 3 — look up link by Site_A_ID / Site_B_ID pair (bidirectional). */
  bySiteIdPair(siteAId: string, siteBId: string): Promise<ResolvedLink | null>;
}

interface Logger {
  warn(obj: Record<string, unknown>, msg: string): void;
}

/**
 * Map a DWH alarm row to a topology link using the 4-step fallback chain
 * from DESIGN.md §9 "Mapping DWH alarms to topology":
 *
 *   1. FiberlinkSite_ID present → byFiberlinkSiteId
 *   2. Source_NE AND Sink_NE present → byNePair
 *   3. Site_A_ID AND Site_B_ID present → bySiteIdPair
 *   4. Nothing matched → log unresolvable warning, return null
 *
 * Returns null in case 4. The alarm still flows to the event bus and ticker;
 * callers skip the topology update when resolvedLinkId is null.
 */
export async function resolveAlarm(
  alarm: DwhAlarmRow,
  lookup: LinkLookup,
  log: Logger,
): Promise<ResolvedLink | null> {
  // Step 1: FiberlinkSite_ID
  if (alarm.FiberlinkSite_ID) {
    const link = await lookup.byFiberlinkSiteId(alarm.FiberlinkSite_ID);
    if (link) return link;
  }

  // Step 2: NE pair (both must be present)
  if (alarm.Source_NE && alarm.Sink_NE) {
    const link = await lookup.byNePair(alarm.Source_NE, alarm.Sink_NE);
    if (link) return link;
  }

  // Step 3: Site ID pair (both must be present)
  if (alarm.Site_A_ID && alarm.Site_B_ID) {
    const link = await lookup.bySiteIdPair(alarm.Site_A_ID, alarm.Site_B_ID);
    if (link) return link;
  }

  // Step 4: unresolvable — log and skip topology side
  log.warn(
    {
      serial: alarm.Log_Serial_Number,
      alarm_name: alarm.Alarm_Name,
      fiberlinkSiteId: alarm.FiberlinkSite_ID,
      sourceNe: alarm.Source_NE,
      sinkNe: alarm.Sink_NE,
      siteAId: alarm.Site_A_ID,
      siteBId: alarm.Site_B_ID,
    },
    'alarm_unresolvable: no topology link found; alarm still flows to ticker',
  );
  return null;
}

/**
 * Create a LinkLookup backed by the app Postgres pool.
 * Bidirectional: checks both orderings (source↔target) in a single query.
 */
export function createDbLinkLookup(pool: pg.Pool): LinkLookup {
  return {
    async byFiberlinkSiteId(id) {
      const { rows } = await pool.query<{ id: number }>(
        `SELECT id FROM links WHERE link_id_external = $1 LIMIT 1`,
        [id],
      );
      return rows[0] ?? null;
    },

    async byNePair(sourceNe, sinkNe) {
      const { rows } = await pool.query<{ id: number }>(
        `SELECT l.id
         FROM links l
         JOIN devices d1 ON l.source_device_id = d1.id
         JOIN devices d2 ON l.target_device_id = d2.id
         WHERE
           (d1.device_id_external = $1 AND d2.device_id_external = $2)
           OR
           (d1.device_id_external = $2 AND d2.device_id_external = $1)
         LIMIT 1`,
        [sourceNe, sinkNe],
      );
      return rows[0] ?? null;
    },

    async bySiteIdPair(siteAId, siteBId) {
      const { rows } = await pool.query<{ id: number }>(
        `SELECT l.id
         FROM links l
         JOIN devices d1 ON l.source_device_id = d1.id
         JOIN devices d2 ON l.target_device_id = d2.id
         JOIN sites  s1 ON d1.site_id = s1.id
         JOIN sites  s2 ON d2.site_id = s2.id
         WHERE
           (s1.site_id_external = $1 AND s2.site_id_external = $2)
           OR
           (s1.site_id_external = $2 AND s2.site_id_external = $1)
         LIMIT 1`,
        [siteAId, siteBId],
      );
      return rows[0] ?? null;
    },
  };
}
