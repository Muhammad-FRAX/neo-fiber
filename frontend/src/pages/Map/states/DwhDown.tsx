/**
 * DWH-down banner — shown when alarm data stream is delayed.
 * §10.5: 'Banner: "Alarm data delayed — last update Ns ago."'
 * §9 error handling B1: map keeps last known state, self-clears on reconnect.
 */

interface DwhDownProps {
  lastUpdateSeconds: number
}

export function DwhDown({ lastUpdateSeconds }: DwhDownProps) {
  const timeStr =
    lastUpdateSeconds < 60
      ? `${lastUpdateSeconds}s ago`
      : `${Math.floor(lastUpdateSeconds / 60)}m ago`

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: "var(--z-toast)" as React.CSSProperties["zIndex"],
        background: "rgba(234,179,8,0.12)",
        borderBottom: "1px solid rgba(234,179,8,0.3)",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--sev-minor)"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--sev-minor)",
          fontWeight: 500,
        }}
      >
        Alarm data delayed — last update {timeStr}
      </span>
    </div>
  )
}
