/**
 * /admin — placeholder (Phase 11).
 */

import { Settings } from "lucide-react"

export default function AdminPage() {
  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center justify-center gap-4"
      style={{ background: "var(--bg)", color: "var(--text-muted)" }}
    >
      <Settings size={48} style={{ opacity: 0.3 }} aria-hidden="true" />
      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
        Admin — Phase 11
      </p>
    </main>
  )
}
