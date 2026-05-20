/**
 * MapCanvas — MapLibre GL JS map with PMTiles base layer.
 * §9: Sudan PMTiles via pmtiles:// protocol, Range requests (T3).
 * §9: sites/links as GeoJSON layers; affected-region as red fill.
 * §11.5: role="application" + keyboard nav (arrows/+/-).
 *
 * The map base layer is loaded from /tiles/sudan.pmtiles served by Express.
 * Sites and links overlay data comes from the topology SSE stream and REST API.
 */

import { useEffect, useRef, useCallback } from "react"
import * as maplibregl from "maplibre-gl"
import { Protocol } from "pmtiles"
import "maplibre-gl/dist/maplibre-gl.css"
import type { SiteRow } from "./MapAriaTable"

// Register PMTiles protocol once at module load
const pmtilesProtocol = new Protocol()
maplibregl.addProtocol("pmtiles", pmtilesProtocol.tile.bind(pmtilesProtocol))

// Sudan approximate bounding box center
const SUDAN_CENTER: [number, number] = [30.2, 15.6]
const SUDAN_ZOOM = 5.5

const STATUS_COLORS: Record<string, string> = {
  UP: "#10b981",       // emerald-500
  DEGRADED: "#f59e0b", // amber-500
  DOWN: "#f43f5e",     // rose-500
  UNKNOWN: "#94a3b8",  // slate-400
}

export interface MapSite {
  id: number
  name: string
  lat: number
  lng: number
  effective_status: "UP" | "DEGRADED" | "DOWN" | "UNKNOWN"
}

export interface MapLink {
  id: number
  source_lat: number
  source_lng: number
  target_lat: number
  target_lng: number
  effective_status: "UP" | "DEGRADED" | "DOWN"
}

interface MapCanvasProps {
  sites: MapSite[]
  links: MapLink[]
  affectedRegion: object | null
  onSiteClick: (siteId: number) => void
}

function buildSitesGeoJSON(sites: MapSite[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: sites
      .filter((s) => s.lat !== null && s.lng !== null)
      .map((s) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
        properties: { id: s.id, name: s.name, effective_status: s.effective_status },
      })),
  }
}

function buildLinksGeoJSON(links: MapLink[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: links.map((l) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [l.source_lng, l.source_lat],
          [l.target_lng, l.target_lat],
        ],
      },
      properties: { id: l.id, effective_status: l.effective_status },
    })),
  }
}

export function MapCanvas({ sites, links, affectedRegion, onSiteClick }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapReadyRef = useRef(false)

  const tilesUrl = `pmtiles://${window.location.origin}/tiles/sudan.pmtiles`

  // Map style — dark theme matching design tokens
  const mapStyle: maplibregl.StyleSpecification = {
    version: 8,
    name: "Neo-Fiber Dark",
    sources: {
      "sudan-tiles": {
        type: "vector",
        url: tilesUrl,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#0f172a" },
      },
      {
        id: "water",
        type: "fill",
        source: "sudan-tiles",
        "source-layer": "water",
        paint: { "fill-color": "#1e3a5f" },
      },
      {
        id: "landcover",
        type: "fill",
        source: "sudan-tiles",
        "source-layer": "landcover",
        paint: { "fill-color": "#131f31" },
      },
      {
        id: "boundary",
        type: "line",
        source: "sudan-tiles",
        "source-layer": "boundary",
        paint: {
          "line-color": "#334155",
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 8, 1.5],
        },
      },
      {
        id: "roads",
        type: "line",
        source: "sudan-tiles",
        "source-layer": "transportation",
        minzoom: 7,
        paint: { "line-color": "#1e293b", "line-width": 0.6 },
      },
    ],
  }

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: SUDAN_CENTER,
      zoom: SUDAN_ZOOM,
      attributionControl: false,
      maxBounds: [
        [10, 2],   // SW — generous bounds around Sudan
        [50, 28],  // NE
      ],
    })

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    )
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    )

    map.on("load", () => {
      mapReadyRef.current = true

      // Affected-region fill layer
      map.addSource("affected-region", {
        type: "geojson",
        data: affectedRegion
          ? ({ type: "Feature", geometry: affectedRegion, properties: {} } as GeoJSON.Feature)
          : ({ type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection),
      })
      map.addLayer({
        id: "affected-region-fill",
        type: "fill",
        source: "affected-region",
        paint: {
          "fill-color": "var(--status-down)",
          "fill-opacity": 0.15,
        },
      })
      map.addLayer({
        id: "affected-region-outline",
        type: "line",
        source: "affected-region",
        paint: {
          "line-color": "#f43f5e",
          "line-width": 1.5,
          "line-opacity": 0.6,
        },
      })

      // Links layer
      map.addSource("links", {
        type: "geojson",
        data: buildLinksGeoJSON(links),
      })
      map.addLayer({
        id: "links-line",
        type: "line",
        source: "links",
        paint: {
          "line-color": [
            "match",
            ["get", "effective_status"],
            "UP", STATUS_COLORS.UP,
            "DEGRADED", STATUS_COLORS.DEGRADED,
            "DOWN", STATUS_COLORS.DOWN,
            STATUS_COLORS.UNKNOWN,
          ],
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.5, 10, 3],
          "line-opacity": 0.8,
        },
      })

      // Sites layer (circles)
      map.addSource("sites", {
        type: "geojson",
        data: buildSitesGeoJSON(sites),
      })
      map.addLayer({
        id: "sites-circle",
        type: "circle",
        source: "sites",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 5, 10, 10],
          "circle-color": [
            "match",
            ["get", "effective_status"],
            "UP", STATUS_COLORS.UP,
            "DEGRADED", STATUS_COLORS.DEGRADED,
            "DOWN", STATUS_COLORS.DOWN,
            STATUS_COLORS.UNKNOWN,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(15,23,42,0.8)",
          "circle-opacity": 0.9,
        },
      })
      map.addLayer({
        id: "sites-label",
        type: "symbol",
        source: "sites",
        minzoom: 7,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-max-width": 8,
        },
        paint: {
          "text-color": "#f1f5f9",
          "text-halo-color": "rgba(15,23,42,0.9)",
          "text-halo-width": 1.5,
        },
      })

      // Click handler for sites
      map.on("click", "sites-circle", (e) => {
        const feature = e.features?.[0]
        if (!feature) return
        const siteId = feature.properties?.["id"] as number | undefined
        if (siteId !== undefined) onSiteClick(siteId)
      })

      // Pointer cursor on site hover
      map.on("mouseenter", "sites-circle", () => {
        map.getCanvas().style.cursor = "pointer"
      })
      map.on("mouseleave", "sites-circle", () => {
        map.getCanvas().style.cursor = ""
      })
    })

    mapRef.current = map

    return () => {
      mapReadyRef.current = false
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update sites data when it changes
  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return
    const src = mapRef.current.getSource("sites") as maplibregl.GeoJSONSource | undefined
    src?.setData(buildSitesGeoJSON(sites))
  }, [sites])

  // Update links data when it changes
  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return
    const src = mapRef.current.getSource("links") as maplibregl.GeoJSONSource | undefined
    src?.setData(buildLinksGeoJSON(links))
  }, [links])

  // Update affected region
  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return
    const src = mapRef.current.getSource("affected-region") as maplibregl.GeoJSONSource | undefined
    src?.setData(
      affectedRegion
        ? ({ type: "Feature", geometry: affectedRegion, properties: {} } as GeoJSON.Feature)
        : ({ type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection),
    )
  }, [affectedRegion])

  // Keyboard navigation for the map canvas (§11.5)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const map = mapRef.current
    if (!map) return
    const PAN = 100
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault()
        map.panBy([-PAN, 0], { animate: true })
        break
      case "ArrowRight":
        e.preventDefault()
        map.panBy([PAN, 0], { animate: true })
        break
      case "ArrowUp":
        e.preventDefault()
        map.panBy([0, -PAN], { animate: true })
        break
      case "ArrowDown":
        e.preventDefault()
        map.panBy([0, PAN], { animate: true })
        break
      case "+":
      case "=":
        e.preventDefault()
        map.zoomIn()
        break
      case "-":
        e.preventDefault()
        map.zoomOut()
        break
    }
  }, [])

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Sudan network status map"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ position: "absolute", inset: 0 }}
    />
  )
}
