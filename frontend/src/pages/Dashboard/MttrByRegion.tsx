/**
 * MttrByRegion — horizontal bar chart of avg MTTR per region.
 * §11 dashboard layout: horizontal bar chart with region labels.
 * No mock data — all data from /api/v1/dashboard/regions.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

interface RegionMttr {
  region: string
  mttr_minutes: number
  alarm_count: number
}

interface MttrByRegionProps {
  data: RegionMttr[]
  isLoading: boolean
  error: boolean
}

function formatMttrLabel(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload: RegionMttr }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: "var(--text-xs)",
        color: "var(--text)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ color: "var(--text-muted)" }}>
        MTTR: <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{formatMttrLabel(row.mttr_minutes)}</span>
      </div>
      <div style={{ color: "var(--text-muted)" }}>
        Alarms: <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{row.alarm_count}</span>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 200,
        borderRadius: 6,
        background: "var(--border)",
        opacity: 0.5,
        animation: "shimmer 1.5s ease-in-out infinite",
      }}
    />
  )
}

// MTTR color: short = green, medium = amber, long = red
function mttrColor(minutes: number): string {
  if (minutes <= 60) return "var(--status-up)"
  if (minutes <= 240) return "var(--status-degraded)"
  return "var(--status-down)"
}

export function MttrByRegion({ data, isLoading, error }: MttrByRegionProps) {
  const chartHeight = Math.max(120, data.length * 36 + 40)

  return (
    <section aria-label="MTTR by region chart">
      {isLoading ? (
        <Skeleton />
      ) : error ? (
        <div
          style={{
            height: 160,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
            background: "var(--bg-elevated)",
            borderRadius: 6,
            border: "1px solid var(--border)",
          }}
          role="alert"
        >
          Unable to load region data
        </div>
      ) : data.length === 0 ? (
        <div
          style={{
            height: 160,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
            background: "var(--bg-elevated)",
            borderRadius: 6,
            border: "1px solid var(--border)",
          }}
        >
          <span>No regional data in this period</span>
        </div>
      ) : (
        <div style={{ height: chartHeight }} aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 60, left: 4, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                horizontal={false}
              />
              <XAxis
                type="number"
                tickFormatter={(v) => formatMttrLabel(v)}
                tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="region"
                width={90}
                tick={{ fontSize: 12, fill: "var(--text)", fontFamily: "var(--font-sans)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--border)", opacity: 0.5 }} />
              <Bar dataKey="mttr_minutes" radius={[0, 3, 3, 0]} maxBarSize={24}>
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={mttrColor(entry.mttr_minutes)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
