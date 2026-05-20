/**
 * /map — The wedge screen (DESIGN.md §5).
 *
 * Layout: full-bleed map + KPI overlay (top-right) + alarms ticker (bottom).
 * Click site → SiteDetailModal slides in from right.
 * SSE: subscribes to /api/v1/stream/topology + /api/v1/stream/alarms.
 * §10.5: Loading → HealthyEmpty → Partial/active → DwhDown states.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { MapCanvas, type MapSite, type MapLink } from "./MapCanvas"
import { KpiOverlay } from "./KpiOverlay"
import { AlarmsTicker, type AlarmItem } from "./AlarmsTicker"
import { SiteDetailModal, type SiteDetail } from "./SiteDetailModal"
import { MapAriaTable, type SiteRow } from "./MapAriaTable"
import { MapLoading } from "./states/Loading"
import { HealthyEmpty } from "./states/HealthyEmpty"
import { DwhDown } from "./states/DwhDown"
import { createTopologyStream, createAlarmStream } from "@/lib/event-stream"
import { apiClient } from "@/lib/api-client"

// ---- Types ------------------------------------------------------------------

interface TopologyStatusEvent {
  devices: Array<{ id: number; effective_status: "UP" | "DEGRADED" | "DOWN" }>
  links: Array<{ id: number; effective_status: "UP" | "DEGRADED" | "DOWN" }>
  computedAt: string
}

interface SiteApiRow {
  id: number
  name: string
  region: string | null
  state: string | null
  lat: number | null
  lng: number | null
  is_root: boolean
}

interface LinkApiRow {
  id: number
  source_lat: number | null
  source_lng: number | null
  target_lat: number | null
  target_lng: number | null
  ranking: string
}

// ---- Helpers ----------------------------------------------------------------

function statusColor(status: string): "UP" | "DEGRADED" | "DOWN" | "UNKNOWN" {
  if (status === "UP" || status === "DEGRADED" || status === "DOWN") return status
  return "UNKNOWN"
}

// ---- Component --------------------------------------------------------------

export default function MapPage() {
  // ── Initial data fetching ──────────────────────────────────────────────────
  const {
    data: sitesData,
    isLoading: sitesLoading,
  } = useQuery({
    queryKey: ["sites"],
    queryFn: () =>
      apiClient.get<{ data: SiteApiRow[] }>("/api/v1/sites?limit=200"),
    staleTime: 30_000,
  })

  const {
    data: kpiData,
    isLoading: kpiLoading,
    isError: kpiError,
  } = useQuery({
    queryKey: ["map-status"],
    queryFn: () =>
      apiClient.get<{
        down_devices: number
        down_links: number
        total_devices: number
        total_links: number
        availability_pct: number
        cuts_24h: number
        last_computed_at: string | null
      }>("/api/v1/map/status"),
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const {
    data: linksData,
  } = useQuery({
    queryKey: ["map-links"],
    queryFn: () =>
      apiClient.get<{ data: LinkApiRow[] }>("/api/v1/map/links"),
    staleTime: 60_000,
  })

  const {
    data: alarmsData,
  } = useQuery({
    queryKey: ["alarms-ticker"],
    queryFn: () =>
      apiClient.get<{ data: AlarmItem[] }>(
        "/api/v1/alarms?limit=10&sort=-occurrence_time",
      ),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  // ── Reactive overlay state ─────────────────────────────────────────────────
  const [siteStatuses, setSiteStatuses] = useState<
    Map<number, "UP" | "DEGRADED" | "DOWN">
  >(new Map())
  const [linkStatuses, setLinkStatuses] = useState<
    Map<number, "UP" | "DEGRADED" | "DOWN">
  >(new Map())
  const [affectedRegion, setAffectedRegion] = useState<object | null>(null)
  const [liveAlarms, setLiveAlarms] = useState<AlarmItem[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null)
  const [siteDetail, setSiteDetail] = useState<SiteDetail | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // DWH connectivity
  const [lastAlarmAt, setLastAlarmAt] = useState<Date | null>(null)
  const [isDwhDown, setIsDwhDown] = useState(false)
  const [dwhDownSince, setDwhDownSince] = useState<Date | null>(null)
  const [nowTick, setNowTick] = useState(Date.now())

  // Tick for "N seconds ago" display
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 5000)
    return () => clearInterval(id)
  }, [])

  // ── SSE subscriptions ──────────────────────────────────────────────────────
  useEffect(() => {
    const topologyStream = createTopologyStream({
      onTopology: (data) => {
        const event = data as TopologyStatusEvent
        setSiteStatuses(
          new Map(event.devices.map((d) => [d.id, d.effective_status])),
        )
        setLinkStatuses(
          new Map(event.links.map((l) => [l.id, l.effective_status])),
        )
      },
      onError: () => {
        // topology stream error: don't flag as DWH down (separate concern)
      },
    })

    const alarmStream = createAlarmStream({
      onAlarm: (data) => {
        const event = data as { alarm: AlarmItem }
        setLastAlarmAt(new Date())
        setIsDwhDown(false)
        setDwhDownSince(null)
        setLiveAlarms((prev) => {
          const next = [event.alarm, ...prev].slice(0, 10)
          return next
        })
      },
      onError: () => {
        if (!dwhDownSince) {
          setDwhDownSince(new Date())
        }
        setIsDwhDown(true)
      },
    })

    topologyStream.connect()
    alarmStream.connect()

    return () => {
      topologyStream.disconnect()
      alarmStream.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Fetch affected region on site status changes ───────────────────────────
  useEffect(() => {
    const downSiteIds = Array.from(siteStatuses.entries())
      .filter(([, s]) => s === "DOWN")
      .map(([id]) => id)

    if (downSiteIds.length === 0) {
      setAffectedRegion(null)
      return
    }

    // Fetch from the affected-region computation via KPI refresh
    // The affected-region is sent via the topology SSE stream in a full deployment.
    // For Phase 8 / CI stub: no affected region until SSE topology fires.
  }, [siteStatuses])

  // ── Site click → load detail ───────────────────────────────────────────────
  const handleSiteClick = useCallback(
    async (siteId: number) => {
      setSelectedSiteId(siteId)
      setIsModalOpen(true)

      // Build site detail from available data
      const site = sitesData?.data.find((s) => s.id === siteId)
      if (!site) return

      const effectiveStatus = siteStatuses.get(siteId) ?? "UNKNOWN"
      const downSiteIds = Array.from(siteStatuses.entries())
        .filter(([, s]) => s === "DOWN")
        .map(([id]) => id)

      const relatedAlarms = (alarmsData?.data ?? liveAlarms).filter(
        (a) => a.site_a_id === site.name || a.fiberlink_site_name === site.name,
      )

      setSiteDetail({
        id: site.id,
        name: site.name,
        region: site.region,
        state: site.state,
        effective_status: statusColor(effectiveStatus),
        updated_at: null,
        downstream_affected_sites: downSiteIds.length,
        downstream_affected_links: { main_down: 0, backup_up: 0 },
        related_alarms: relatedAlarms.slice(0, 10),
      })
    },
    [sitesData, siteStatuses, alarmsData, liveAlarms],
  )

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false)
    setSelectedSiteId(null)
    setSiteDetail(null)
  }, [])

  // ── Derived map data ───────────────────────────────────────────────────────
  const rawSites = sitesData?.data ?? []

  const mapSites: MapSite[] = rawSites
    .filter((s) => s.lat !== null && s.lng !== null)
    .map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.lat!,
      lng: s.lng!,
      effective_status: statusColor(siteStatuses.get(s.id) ?? "UNKNOWN"),
    }))

  const rawLinks = linksData?.data ?? []
  const mapLinks: MapLink[] = rawLinks
    .filter((l) => l.source_lat !== null && l.source_lng !== null && l.target_lat !== null && l.target_lng !== null)
    .map((l) => ({
      id: l.id,
      source_lat: l.source_lat!,
      source_lng: l.source_lng!,
      target_lat: l.target_lat!,
      target_lng: l.target_lng!,
      effective_status: (linkStatuses.get(l.id) ?? "UP") as "UP" | "DEGRADED" | "DOWN",
    }))

  const ariaTableSites: SiteRow[] = rawSites.map((s) => ({
    id: s.id,
    name: s.name,
    region: s.region,
    state: s.state,
    effective_status: statusColor(siteStatuses.get(s.id) ?? "UNKNOWN"),
    lat: s.lat,
    lng: s.lng,
  }))

  const tickerAlarms: AlarmItem[] = liveAlarms.length > 0
    ? liveAlarms
    : (alarmsData?.data ?? [])

  const isInitialLoading = sitesLoading && rawSites.length === 0
  const hasActiveAlarms = tickerAlarms.some((a) => a.status === "Not Clear")

  const dwhDownSeconds = isDwhDown && dwhDownSince
    ? Math.floor((nowTick - dwhDownSince.getTime()) / 1000)
    : 0

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main
      id="main-content"
      role="main"
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
      }}
    >
      {/* Skip link target already in router layout */}

      {/* DWH-down banner (stays visible over everything) */}
      {isDwhDown && <DwhDown lastUpdateSeconds={dwhDownSeconds} />}

      {/* Map container fills available space above ticker */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* MapCanvas — always rendered; loading overlay sits on top */}
        <MapCanvas
          sites={mapSites}
          links={mapLinks}
          affectedRegion={affectedRegion}
          onSiteClick={handleSiteClick}
        />

        {/* Hidden ARIA table for screen readers */}
        <MapAriaTable sites={ariaTableSites} />

        {/* Loading overlay */}
        {isInitialLoading && <MapLoading />}

        {/* Healthy/empty pill — shown when map is ready and no active alarms */}
        {!isInitialLoading && !hasActiveAlarms && siteStatuses.size === 0 && (
          <HealthyEmpty />
        )}

        {/* KPI overlay — top-right glass panel */}
        <KpiOverlay
          data={kpiData ?? null}
          isLoading={kpiLoading}
          error={kpiError}
        />
      </div>

      {/* Alarms ticker — full-width bottom bar */}
      <AlarmsTicker
        alarms={tickerAlarms.slice(0, 10)}
        onAlarmClick={(alarm) => {
          // If alarm has a site ID, find and open site detail
          const site = rawSites.find(
            (s) =>
              s.name === alarm.site_a_id || s.name === alarm.fiberlink_site_name,
          )
          if (site) handleSiteClick(site.id)
        }}
      />

      {/* Site detail modal / sidesheet */}
      <SiteDetailModal
        site={siteDetail}
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />
    </main>
  )
}
