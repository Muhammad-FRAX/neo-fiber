/**
 * AlarmsOverTime — daily alarm count bar chart (Recharts).
 * §11 dashboard layout pattern: full-width, section header with date range label.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { format, parseISO } from "date-fns"

interface AlarmDay {
  day: string
  count: number
}

interface AlarmsOverTimeProps {
  data: AlarmDay[]
  isLoading: boolean
  error: boolean
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

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  let displayDate = label ?? ""
  try {
    displayDate = format(parseISO(label ?? ""), "d MMM yyyy")
  } catch {
    /* keep raw */
  }
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
      <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{displayDate}</div>
      <div style={{ fontWeight: 600 }}>{payload[0].value} alarms</div>
    </div>
  )
}

function shortenDay(day: string): string {
  try {
    return format(parseISO(day), "d MMM")
  } catch {
    return day.slice(5)
  }
}

export function AlarmsOverTime({ data, isLoading, error }: AlarmsOverTimeProps) {
  // Show every Nth label to avoid overcrowding
  const tickInterval = data.length > 14 ? Math.ceil(data.length / 10) - 1 : 0

  return (
    <section aria-label="Alarms over time chart">
      {isLoading ? (
        <Skeleton />
      ) : error ? (
        <div
          style={{
            height: 200,
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
          Unable to load alarm data
        </div>
      ) : data.length === 0 ? (
        <div
          style={{
            height: 200,
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
          <span>No alarms in this period</span>
          <span style={{ fontSize: "var(--text-xs)" }}>Try a wider date range</span>
        </div>
      ) : (
        <div style={{ height: 200 }} aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tickFormatter={shortenDay}
                tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
                interval={tickInterval}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--border)", opacity: 0.5 }} />
              <Bar
                dataKey="count"
                fill="var(--accent-500)"
                radius={[3, 3, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
