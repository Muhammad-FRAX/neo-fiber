/**
 * /dashboard — placeholder (Phase 10).
 */

import { LayoutDashboard } from "lucide-react"

export default function DashboardPage() {
  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center justify-center gap-4"
      style={{ background: "var(--bg)", color: "var(--text-muted)" }}
    >
      <LayoutDashboard size={48} style={{ opacity: 0.3 }} aria-hidden="true" />
      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
        Dashboard — Phase 10
      </p>
    </main>
  )
}
