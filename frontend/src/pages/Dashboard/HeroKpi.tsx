/**
 * HeroKpi — Network Availability % with 30-day sparkline.
 *
 * §11 dashboard layout pattern: one hero KPI (the big number) + sparkline.
 * text-hero: 48/56/700.  Delta vs prior period shown as a chip.
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface SparklineDay {
  day: string
  availability_pct: number
}

interface HeroKpiProps {
  currentPct: number | null
  deltaPct: number | null
  sparkline: SparklineDay[]
  isLoading: boolean
  error: boolean
  rangeLabel: string
}

function Skeleton({ width, height }: { width: number | string; height: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width,
        height,
        borderRadius: 6,
        background: "var(--border)",
        opacity: 0.6,
        animation: "shimmer 1.5s ease-in-out infinite",
      }}
    />
  )
}

function DeltaChip({ delta }: { delta: number }) {
  const positive = delta >= 0
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const color = delta > 0
    ? "var(--status-up)"
    : delta < 0
      ? "var(--status-down)"
      : "var(--text-muted)"

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 9999,
        background: delta > 0
          ? "rgba(16,185,129,0.12)"
          : delta < 0
            ? "rgba(244,63,94,0.12)"
            : "rgba(148,163,184,0.12)",
        fontSize: "var(--text-sm)",
        fontWeight: 600,
        color,
      }}
      aria-label={`${positive ? "+" : ""}${delta}% vs prior period`}
    >
      <Icon size={13} aria-hidden="true" />
      {positive && delta > 0 ? "+" : ""}{delta}%
    </span>
  )
}

function SparklineTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: SparklineDay }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "6px 10px",
        fontSize: "var(--text-xs)",
        color: "var(--text)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{d.payload.day}</div>
      <div style={{ fontWeight: 600 }}>{d.value.toFixed(2)}%</div>
    </div>
  )
}

export function HeroKpi({ currentPct, deltaPct, sparkline, isLoading, error, rangeLabel }: HeroKpiProps) {
  const displayPct = error ? null : currentPct

  return (
    <section
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "24px 28px",
        boxShadow: "var(--shadow-sm)",
      }}
      aria-label="Network availability hero KPI"
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 4 }}>
        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Network Availability
        </h2>
        {!isLoading && deltaPct !== null && !error && (
          <DeltaChip delta={deltaPct} />
        )}
      </div>

      {/* Big number */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 20 }}>
        {isLoading ? (
          <Skeleton width={200} height={56} />
        ) : error || displayPct === null ? (
          <span
            style={{
              fontSize: "var(--text-hero)",
              fontWeight: 700,
              lineHeight: "56px",
              color: "var(--text-muted)",
            }}
            aria-label="Network availability unavailable"
          >
            —
          </span>
        ) : (
          <span
            style={{
              fontSize: "var(--text-hero)",
              fontWeight: 700,
              lineHeight: "56px",
              color: displayPct >= 99
                ? "var(--status-up)"
                : displayPct >= 95
                  ? "var(--status-degraded)"
                  : "var(--status-down)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {displayPct.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Sparkline */}
      {isLoading ? (
        <div style={{ height: 72 }}>
          <Skeleton width="100%" height={72} />
        </div>
      ) : sparkline.length > 0 ? (
        <div style={{ height: 72 }} aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="availGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-500)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--accent-500)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={[90, 100]} hide />
              <XAxis dataKey="day" hide />
              <Tooltip content={<SparklineTooltip />} />
              <Area
                type="monotone"
                dataKey="availability_pct"
                stroke="var(--accent-500)"
                strokeWidth={1.5}
                fill="url(#availGrad)"
                dot={false}
                activeDot={{ r: 3, fill: "var(--accent-500)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div
          style={{
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
          }}
        >
          No data for this range
        </div>
      )}

      <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
        {rangeLabel}
      </p>
    </section>
  )
}
