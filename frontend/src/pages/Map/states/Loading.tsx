/**
 * Map loading state — shown while initial data is fetching.
 * §10.5: "Map shell + KPI panel skeleton (shimmer)"
 */
export function MapLoading() {
  return (
    <div
      role="status"
      aria-label="Loading map"
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
        <svg
          className="animate-spin"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style={{ color: "var(--accent-500)", margin: "0 auto 12px" }}
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2.5"
            opacity="0.25"
          />
          <path
            d="M22 12a10 10 0 0 0-10-10"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <p style={{ fontSize: "var(--text-sm)", margin: 0 }}>
          Connecting to alarm stream…
        </p>
      </div>
    </div>
  )
}
