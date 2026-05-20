/**
 * Alarms ticker — full-width 56px scrolling bar at map bottom.
 * §11 (P7-2A): scrolls right-to-left ~30s end-to-end, pause on hover,
 * click-to-pin, prefers-reduced-motion → static list.
 * §11.5: role="log" aria-live="polite" for AT.
 */

import { useEffect, useRef, useState } from "react"

export interface AlarmItem {
  log_serial_number: string
  alarm_name: string | null
  alarm_severity: string | null
  status: "Clear" | "Not Clear"
  occurrence_time: string
  site_a_id: string | null
  fiberlink_site_name: string | null
  location_information: string | null
}

interface AlarmsTickerProps {
  alarms: AlarmItem[]
  onAlarmClick?: (alarm: AlarmItem) => void
}

const SEV_COLOR: Record<string, string> = {
  Critical: "var(--sev-critical)",
  Major: "var(--sev-major)",
  Minor: "var(--sev-minor)",
  Info: "var(--sev-info)",
}

function AlarmChip({
  alarm,
  isActive,
  onClick,
}: {
  alarm: AlarmItem
  isActive: boolean
  onClick: () => void
}) {
  const color = SEV_COLOR[alarm.alarm_severity ?? ""] ?? "var(--text-muted)"
  const locationStr =
    alarm.fiberlink_site_name ?? alarm.site_a_id ?? alarm.location_information ?? "Unknown site"
  const timeStr = new Date(alarm.occurrence_time).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <button
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={`Alarm: ${alarm.alarm_name ?? "Unknown"} at ${locationStr}, ${timeStr}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        border: "none",
        borderRadius: "var(--radius-sm)",
        background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
        transition: "background var(--duration-75) var(--ease-default)",
        outline: "none",
      }}
      className="alarm-chip"
    >
      <span
        style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }}
        aria-hidden="true"
      />
      <span
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          color,
          fontFamily: "var(--font-mono)",
        }}
      >
        {alarm.alarm_severity ?? "?"}
      </span>
      <span style={{ fontSize: "var(--text-xs)", color: "#cbd5e1", fontWeight: 500 }}>
        {locationStr}
      </span>
      <span
        style={{
          fontSize: "var(--text-xs)",
          color: "rgba(148,163,184,0.6)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {timeStr}
      </span>
      {alarm.status === "Not Clear" && (
        <span
          aria-hidden="true"
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--status-down)",
            flexShrink: 0,
          }}
        />
      )}
    </button>
  )
}

export function AlarmsTicker({ alarms, onAlarmClick }: AlarmsTickerProps) {
  const [isPaused, setIsPaused] = useState(false)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const handleAlarmClick = (alarm: AlarmItem) => {
    setPinnedId((prev) => (prev === alarm.log_serial_number ? null : alarm.log_serial_number))
    setIsPaused(true)
    onAlarmClick?.(alarm)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setPinnedId(null)
      setIsPaused(false)
    }
  }

  if (alarms.length === 0) {
    return (
      <div
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Active alarms"
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(15,23,42,0.75)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "0 16px",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "rgba(148,163,184,0.5)",
            fontStyle: "italic",
          }}
        >
          No active alarms
        </span>
      </div>
    )
  }

  // Reduced motion: static list of top 5
  if (prefersReducedMotion) {
    return (
      <div
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Active alarms"
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 4,
          overflowX: "auto",
          background: "rgba(15,23,42,0.75)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "0 8px",
        }}
      >
        {alarms.slice(0, 5).map((a) => (
          <AlarmChip
            key={a.log_serial_number}
            alarm={a}
            isActive={pinnedId === a.log_serial_number}
            onClick={() => handleAlarmClick(a)}
          />
        ))}
      </div>
    )
  }

  // Scrolling marquee — duplicated for seamless loop
  const scrollDuration = Math.max(alarms.length * 6, 30)

  return (
    <div
      role="log"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Active alarms"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        if (!pinnedId) setIsPaused(false)
      }}
      onKeyDown={handleKeyDown}
      style={{
        height: 56,
        overflow: "hidden",
        background: "rgba(15,23,42,0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        position: "relative",
      }}
    >
      {/* Fade edges */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 40,
          background: "linear-gradient(to right, rgba(15,23,42,0.75), transparent)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 40,
          background: "linear-gradient(to left, rgba(15,23,42,0.75), transparent)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      <div
        ref={trackRef}
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          gap: 4,
          // Duplicate for seamless loop
          animation: `ticker-scroll ${scrollDuration}s linear infinite`,
          animationPlayState: isPaused ? "paused" : "running",
          width: "max-content",
        }}
      >
        {/* Original + duplicate for seamless loop */}
        {[...alarms, ...alarms].map((a, i) => (
          <AlarmChip
            key={`${a.log_serial_number}-${i}`}
            alarm={a}
            isActive={pinnedId === a.log_serial_number}
            onClick={() => handleAlarmClick(a)}
          />
        ))}
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .alarm-chip:focus-visible {
          outline: 2px solid var(--accent-500);
          outline-offset: 2px;
          border-radius: var(--radius-sm);
        }
        .alarm-chip:hover {
          background: rgba(255,255,255,0.06) !important;
        }
      `}</style>
    </div>
  )
}
