/**
 * Polite block screen for viewports < 1024px.
 * v1.0 is desktop-only. Mobile redesign is explicit v2.0 scope (§11.5).
 * No partial UI, no broken layouts — just a clear, kind explanation.
 */

import { Monitor } from "lucide-react"

export function MobileBlock() {
  return (
    <div
      role="main"
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        aria-hidden="true"
      >
        <Monitor size={32} style={{ color: "var(--text-muted)" }} />
      </div>

      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
          Neo-Fiber is designed for desktop
        </h1>
        <p
          className="mt-3 max-w-xs text-sm leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          Please open this on a workstation for the full network view. The map, KPI
          overlay, and alarm details require a larger screen.
        </p>
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        v1.0 · Zain Sudan internal
      </p>
    </div>
  )
}
