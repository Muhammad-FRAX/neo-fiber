/**
 * /map — placeholder (Phase 8 implements the full map page).
 * Routes and chrome are live in Phase 7; map content ships in Phase 8.
 */

import { Map as MapIcon } from "lucide-react"

export default function MapPage() {
  return (
    <div
      role="main"
      id="main-content"
      className="flex flex-1 flex-col items-center justify-center gap-4"
      style={{ background: "var(--bg)", color: "var(--text-muted)" }}
    >
      <MapIcon size={48} style={{ opacity: 0.3 }} aria-hidden="true" />
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
          Map — Phase 8
        </p>
        <p className="mt-1 text-xs">
          The Sudan map, KPI overlay, and alarm ticker are implemented in Phase 8.
        </p>
      </div>
    </div>
  )
}
