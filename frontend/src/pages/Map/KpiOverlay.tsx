/**
 * KPI overlay panel — top-right glass card over the map.
 * §10: "KPI panel: top-right glass card, 280px wide, 4 stacked KPIs"
 * §11: backdrop-blur, shadow-glass
 * §10.5: skeleton state while loading, "—" on error
 */

interface KpiData {
  down_devices: number
  down_links: number
  total_devices: number
  total_links: number
  availability_pct: number
  cuts_24h: number
  last_computed_at: string | null
}

interface KpiOverlayProps {
  data: KpiData | null
  isLoading: boolean
  error: boolean
}

interface KpiRowProps {
  label: string
  value: string | number | null
  unit?: string
  valueColor?: string
  isLoading: boolean
  error: boolean
}

function KpiRow({ label, value, unit, valueColor, isLoading, error }: KpiRowProps) {
  const displayValue = error
    ? "—"
    : isLoading || value === null
      ? null
      : unit
        ? `${value}${unit}`
        : String(value)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <dt
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 500,
          color: "rgba(148,163,184,0.7)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          fontSize: "var(--text-md)",
          fontWeight: 600,
          color: valueColor ?? "#f1f5f9",
          fontFamily: displayValue && /^\d/.test(String(displayValue)) ? "var(--font-mono)" : undefined,
        }}
        aria-label={error ? `${label}: unavailable` : undefined}
      >
        {displayValue !== null ? (
          displayValue
        ) : (
          /* Loading skeleton */
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 64,
              height: 16,
              borderRadius: 4,
              background: "rgba(148,163,184,0.15)",
              animation: "shimmer 1.5s ease-in-out infinite",
            }}
          />
        )}
      </dd>
    </div>
  )
}

export function KpiOverlay({ data, isLoading, error }: KpiOverlayProps) {
  const downDevices = data?.down_devices ?? null
  const downLinks = data?.down_links ?? null
  const availPct = data?.availability_pct !== undefined ? `${data.availability_pct}%` : null
  const cuts24h = data?.cuts_24h ?? null

  return (
    <aside
      aria-label="Network KPIs"
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        zIndex: "var(--z-overlay)" as React.CSSProperties["zIndex"],
        width: 200,
        background: "rgba(15,23,42,0.80)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-glass)",
        padding: "14px 16px",
      }}
    >
      <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <KpiRow
          label="Down devices"
          value={downDevices}
          valueColor={
            downDevices === null ? undefined : downDevices > 0 ? "var(--status-down)" : "var(--status-up)"
          }
          isLoading={isLoading}
          error={error}
        />
        <KpiRow
          label="Down links"
          value={downLinks}
          valueColor={
            downLinks === null ? undefined : downLinks > 0 ? "var(--status-down)" : "var(--status-up)"
          }
          isLoading={isLoading}
          error={error}
        />
        <KpiRow
          label="Availability"
          value={availPct}
          valueColor={
            data?.availability_pct === undefined
              ? undefined
              : data.availability_pct >= 99
                ? "var(--status-up)"
                : data.availability_pct >= 90
                  ? "var(--status-degraded)"
                  : "var(--status-down)"
          }
          isLoading={isLoading}
          error={error}
        />
        <KpiRow
          label="Cuts (24h)"
          value={cuts24h}
          valueColor={
            cuts24h === null ? undefined : cuts24h > 0 ? "var(--sev-critical)" : "#f1f5f9"
          }
          isLoading={isLoading}
          error={error}
        />
      </dl>

      {/* Shimmer keyframe — injected once */}
      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </aside>
  )
}
