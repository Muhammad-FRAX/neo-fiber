/**
 * TopRecurringIssues — sortable table of alarm types by frequency.
 * §11 dashboard layout pattern: data table, sortable.
 * No mock data — all rows come from /api/v1/dashboard/recurring.
 */

import { useState } from "react"
import { ChevronUp, ChevronDown } from "lucide-react"

interface RecurringIssue {
  alarm_name: string
  count: number
  avg_mttr_minutes: number
}

interface TopRecurringIssuesProps {
  data: RecurringIssue[]
  isLoading: boolean
  error: boolean
}

type SortKey = "alarm_name" | "count" | "avg_mttr_minutes"
type SortDir = "asc" | "desc"

function formatMttr(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function SkeletonRow() {
  return (
    <tr>
      {[160, 60, 80].map((w, i) => (
        <td key={i} style={{ padding: "10px 12px" }}>
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: w,
              height: 14,
              borderRadius: 4,
              background: "var(--border)",
              opacity: 0.6,
              animation: "shimmer 1.5s ease-in-out infinite",
            }}
          />
        </td>
      ))}
    </tr>
  )
}

interface SortHeaderProps {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  align?: "left" | "right"
}

function SortHeader({ label, sortKey, current, dir, onSort, align = "left" }: SortHeaderProps) {
  const isActive = current === sortKey
  return (
    <th
      scope="col"
      style={{
        padding: "8px 12px",
        textAlign: align,
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        color: isActive ? "var(--text)" : "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none",
        borderBottom: "1px solid var(--border)",
      }}
      onClick={() => onSort(sortKey)}
      aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        {isActive ? (
          dir === "asc" ? (
            <ChevronUp size={12} aria-hidden="true" />
          ) : (
            <ChevronDown size={12} aria-hidden="true" />
          )
        ) : (
          <ChevronDown size={12} aria-hidden="true" style={{ opacity: 0.3 }} />
        )}
      </span>
    </th>
  )
}

export function TopRecurringIssues({ data, isLoading, error }: TopRecurringIssuesProps) {
  const [sortKey, setSortKey] = useState<SortKey>("count")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "alarm_name" ? "asc" : "desc")
    }
  }

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    const cmp = typeof av === "string" ? av.localeCompare(String(bv)) : (av as number) - (bv as number)
    return sortDir === "asc" ? cmp : -cmp
  })

  return (
    <section aria-label="Top recurring alarm types">
      {error ? (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
            background: "var(--bg-elevated)",
            borderRadius: 6,
            border: "1px solid var(--border)",
          }}
          role="alert"
        >
          Unable to load recurring issues
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "var(--text-sm)",
            }}
            aria-label="Top recurring alarm types sorted by frequency"
          >
            <thead style={{ background: "var(--bg-elevated)" }}>
              <tr>
                <SortHeader label="Alarm type" sortKey="alarm_name" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Count" sortKey="count" current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                <SortHeader label="Avg MTTR" sortKey="avg_mttr_minutes" current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : sorted.length === 0
                  ? (
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          padding: "24px",
                          textAlign: "center",
                          color: "var(--text-muted)",
                          fontSize: "var(--text-sm)",
                        }}
                      >
                        No alarms in this period — try a wider range
                      </td>
                    </tr>
                  )
                  : sorted.map((row) => (
                    <tr
                      key={row.alarm_name}
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      <td
                        style={{
                          padding: "10px 12px",
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-xs)",
                          color: "var(--text)",
                        }}
                      >
                        {row.alarm_name}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          color: "var(--text)",
                        }}
                      >
                        {row.count.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {formatMttr(row.avg_mttr_minutes)}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
