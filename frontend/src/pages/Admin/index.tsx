/**
 * /admin — tabbed shell: Topology | Alternate Paths | Audit Log.
 * Admin-only: the sidebar already guards the nav item with requiresAdmin.
 * Route: /admin/* with sub-routes handled here via NavLink.
 */

import { NavLink, Routes, Route, Navigate } from "react-router-dom"
import { TopologyPage } from "./Topology"
import { AlternatePathsPage } from "./AlternatePaths"
import { AuditPage } from "./Audit"

const TAB_ITEMS = [
  { to: "/admin/topology", label: "Topology" },
  { to: "/admin/alternate-paths", label: "Alternate Paths" },
  { to: "/admin/audit", label: "Audit Log" },
]

export default function AdminPage() {
  return (
    <main
      id="main-content"
      style={{ display: "flex", flexDirection: "column", flex: 1, background: "var(--bg)", minHeight: 0 }}
    >
      {/* Top nav bar */}
      <nav
        aria-label="Admin sections"
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--border)",
          padding: "0 32px",
          background: "var(--bg-elevated)",
        }}
      >
        {TAB_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: "inline-flex",
              alignItems: "center",
              padding: "14px 16px",
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--accent-500)" : "var(--text-muted)",
              textDecoration: "none",
              borderBottom: isActive ? "2px solid var(--accent-500)" : "2px solid transparent",
              marginBottom: -1,
              transition: "color 0.15s, border-color 0.15s",
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Sub-route content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <Routes>
          <Route index element={<Navigate to="topology" replace />} />
          <Route path="topology" element={<TopologyPage />} />
          <Route path="alternate-paths" element={<AlternatePathsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="*" element={<Navigate to="topology" replace />} />
        </Routes>
      </div>
    </main>
  )
}
