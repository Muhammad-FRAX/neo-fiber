/**
 * Healthy/empty state pill — shown when no alarms are active.
 * §10.5: '"All networks healthy" headline pill top-center'
 * Background is neutral (not green/red) — status color appears only on data.
 */
export function HealthyEmpty() {
  return (
    <div
      role="status"
      aria-label="Network status: all healthy"
      style={{
        position: "absolute",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "var(--z-overlay)" as React.CSSProperties["zIndex"],
        background: "rgba(15,23,42,0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "var(--radius-full)",
        padding: "6px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--status-up)",
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: 500,
          color: "#f1f5f9",
          whiteSpace: "nowrap",
        }}
      >
        All networks healthy
      </span>
    </div>
  )
}
