/**
 * System status banners for degraded conditions.
 *
 * DWH-down: top banner "Alarm data is delayed — last update Ns ago."
 * App-DB-down: full-page "Service is starting" with auto-retry.
 *
 * T7 (FE half) — §9 frontend error handling B1
 */

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react"
import { apiClient } from "@/lib/api-client"

/* ── DWH-down banner ─────────────────────────────────────────────────────── */

interface DwhDownBannerProps {
  lastUpdateAt: Date | null
}

export function DwhDownBanner({ lastUpdateAt }: DwhDownBannerProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!lastUpdateAt) return
    const update = () => setElapsed(Math.floor((Date.now() - lastUpdateAt.getTime()) / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [lastUpdateAt])

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-4 py-2 text-sm"
      style={{
        background: "color-mix(in srgb, var(--sev-minor) 15%, transparent)",
        borderBottom: "1px solid color-mix(in srgb, var(--sev-minor) 30%, transparent)",
        color: "var(--text)",
        zIndex: "var(--z-toast)",
      }}
    >
      <WifiOff size={14} style={{ color: "var(--sev-minor)", flexShrink: 0 }} />
      <span>
        Alarm data is delayed
        {lastUpdateAt && elapsed > 0 && (
          <> — last update <strong>{elapsed}s ago</strong></>
        )}
      </span>
    </div>
  )
}

/* ── App-DB-down screen ──────────────────────────────────────────────────── */

interface AppDbDownScreenProps {
  onHealthy: () => void
}

export function AppDbDownScreen({ onHealthy }: AppDbDownScreenProps) {
  const [checking, setChecking] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkHealth = async () => {
    if (checking) return
    setChecking(true)
    try {
      await apiClient.get("/api/v1/health")
      clearInterval(intervalRef.current!)
      onHealthy()
    } catch {
      // still down
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    intervalRef.current = setInterval(checkHealth, 10_000)
    return () => clearInterval(intervalRef.current!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        >
          <AlertTriangle size={32} style={{ color: "var(--sev-minor)" }} />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Service is starting</h1>
          <p className="mt-2 max-w-sm text-sm" style={{ color: "var(--text-muted)" }}>
            The application database is initializing. This usually takes a few seconds.
          </p>
        </div>
        <button
          onClick={checkHealth}
          disabled={checking}
          className="flex items-center gap-2 rounded px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-60 hover:opacity-90"
          style={{ background: "var(--accent-500)", color: "#fff" }}
        >
          <RefreshCw size={14} className={checking ? "animate-spin" : ""} />
          {checking ? "Checking…" : "Retry now"}
        </button>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Auto-retrying every 10 seconds
        </p>
      </div>
    </div>
  )
}
