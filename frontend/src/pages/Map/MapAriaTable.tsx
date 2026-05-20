/**
 * Hidden table mirror for screen readers.
 * §11.5: "a hidden <table> with the same data accessible to screen readers
 * (because canvas-based maps are invisible to AT)."
 */

export interface SiteRow {
  id: number
  name: string
  region: string | null
  state: string | null
  effective_status: "UP" | "DEGRADED" | "DOWN" | "UNKNOWN"
  lat: number | null
  lng: number | null
}

interface MapAriaTableProps {
  sites: SiteRow[]
}

const STATUS_LABEL: Record<string, string> = {
  UP: "Up — all links healthy",
  DEGRADED: "Degraded — running on backup",
  DOWN: "Down — no active paths",
  UNKNOWN: "Unknown",
}

export function MapAriaTable({ sites }: MapAriaTableProps) {
  return (
    <table
      // Visually hidden but present in accessibility tree
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        margin: -1,
        padding: 0,
        border: 0,
        overflow: "hidden",
        clip: "rect(0,0,0,0)",
        whiteSpace: "nowrap",
      }}
      aria-label="Sudan network sites status"
    >
      <caption>Current status of all network sites on the Sudan map</caption>
      <thead>
        <tr>
          <th scope="col">Site name</th>
          <th scope="col">Region</th>
          <th scope="col">State</th>
          <th scope="col">Status</th>
          <th scope="col">Latitude</th>
          <th scope="col">Longitude</th>
        </tr>
      </thead>
      <tbody>
        {sites.map((site) => (
          <tr key={site.id}>
            <td>{site.name}</td>
            <td>{site.region ?? "—"}</td>
            <td>{site.state ?? "—"}</td>
            <td>{STATUS_LABEL[site.effective_status] ?? site.effective_status}</td>
            <td>{site.lat ?? "—"}</td>
            <td>{site.lng ?? "—"}</td>
          </tr>
        ))}
        {sites.length === 0 && (
          <tr>
            <td colSpan={6}>No sites loaded yet</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
