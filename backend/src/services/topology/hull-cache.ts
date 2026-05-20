/**
 * Hull cache (DESIGN.md §9 — Hull cache, locked in D4).
 *
 * Caches the PostGIS ST_ConcaveHull GeoJSON result for a set of affected site IDs.
 * Key: affected site IDs sorted and joined with ','. Prevents redundant PostGIS
 * work during steady-state (same sites stay down for hours during a long restoration).
 *
 * Eviction: entries older than 10 minutes are evicted on lookup and on scheduled sweep.
 */

const TTL_MS = 10 * 60 * 1_000; // 10 minutes

interface CacheEntry {
  geojson: object;
  storedAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(affectedSiteIds: number[]): string {
  return [...affectedSiteIds].sort((a, b) => a - b).join(',');
}

function isExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.storedAt > TTL_MS;
}

export function getHull(affectedSiteIds: number[]): object | null {
  if (affectedSiteIds.length === 0) return null;
  const key = cacheKey(affectedSiteIds);
  const entry = cache.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    cache.delete(key);
    return null;
  }
  return entry.geojson;
}

export function setHull(affectedSiteIds: number[], geojson: object): void {
  if (affectedSiteIds.length === 0) return;
  cache.set(cacheKey(affectedSiteIds), { geojson, storedAt: Date.now() });
}

export function clearHullCache(): void {
  cache.clear();
}

// Evict stale entries. Call this periodically (e.g., every 5 minutes) to avoid
// unbounded memory growth during a long-running incident with many unique affected sets.
export function evictStaleHulls(): void {
  for (const [key, entry] of cache) {
    if (isExpired(entry)) cache.delete(key);
  }
}

export { TTL_MS as HULL_CACHE_TTL_MS };
