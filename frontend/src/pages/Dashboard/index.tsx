/**
 * /dashboard — v1.5 Dashboard with real DWH aggregations.
 *
 * Layout (§11 dashboard pattern):
 *   - Date range selector (7d / 30d / 90d)
 *   - HeroKpi: Network Availability % + sparkline
 *   - Supporting strip: Down dev · Down link · MTTR · Cuts 24h
 *   - Sub-tabs: Overview | Alarms | Regions | Fiber
 *   - Tab content: AlarmsOverTime, TopRecurringIssues, MttrByRegion, FiberCutHistory
 *
 * No mock data — every number traces to a SQL query in aggregations.ts.
 * §10.5 states: loading (skeletons), empty, partial, error (per-card).
 */

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { NavLink, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { apiClient } from "@/lib/api-client"
import { HeroKpi } from "./HeroKpi"
import { AlarmsOverTime } from "./AlarmsOverTime"
import { TopRecurringIssues } from "./TopRecurringIssues"
import { MttrByRegion } from "./MttrByRegion"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SummaryData {
  availability_sparkline: Array<{ day: string; availability_pct: number }>
  current_availability_pct: number
  delta_vs_prior_pct: number | null
  mttr_minutes: number
  mttr_sample_size: number
  cuts_24h: number
  range: { from: string; to: string }
}

interface AlarmsData {
  rows: Array<{ day: string; count: number }>
}

interface RecurringData {
  rows: Array<{ alarm_name: string; count: number; avg_mttr_minutes: number }>
}

interface RegionsData {
  rows: Array<{ region: string; mttr_minutes: number; alarm_count: number }>
}

interface FiberData {
  rows: Array<{
    log_serial_number: string
    alarm_name: string
    site_a_id: string | null
    site_b_id: string | null
    fiberlink_site_name: string | null
    state: string | null
    occurrence_time: string
    clearance_time: string | null
    down_time: string | null
  }>
}

// ── Date range helpers ────────────────────────────────────────────────────────

type RangePreset = "7d" | "30d" | "90d"

const RANGE_LABELS: Record<RangePreset, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
}

function rangeToQueryParams(preset: RangePreset): string {
  const to = new Date()
  const daysMap: Record<RangePreset, number> = { "7d": 7, "30d": 30, "90d": 90 }
  const from = new Date(to.getTime() - daysMap[preset] * 24 * 60 * 60 * 1000)
  return `?from=${from.toISOString()}&to=${to.toISOString()}`
}

// ── Supporting KPI strip ──────────────────────────────────────────────────────

interface KpiChipProps {
  label: string
  value: string | null
  isLoading: boolean
}

function KpiChip({ label, value, isLoading }: KpiChipProps) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 140,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "16px 20px",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <dt
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
          marginBottom: 8,
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0 }}>
        {isLoading ? (
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 64,
              height: 28,
              borderRadius: 4,
              background: "var(--border)",
              opacity: 0.6,
              animation: "shimmer 1.5s ease-in-out infinite",
            }}
          />
        ) : (
          <span
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              color: "var(--text)",
            }}
          >
            {value ?? "—"}
          </span>
        )}
      </dd>
    </div>
  )
}

function formatMttr(minutes: number | null): string {
  if (minutes === null) return "—"
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ── Section separator ─────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string
  action?: React.ReactNode
}

function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 12,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-muted)",
        }}
      >
        {title}
      </h3>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} aria-hidden="true" />
      {action}
    </div>
  )
}

// ── Fiber cut history table ───────────────────────────────────────────────────

interface FiberHistoryProps {
  data: FiberData["rows"]
  isLoading: boolean
  error: boolean
}

function FiberCutHistory({ data, isLoading, error }: FiberHistoryProps) {
  if (error) {
    return (
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
        Unable to load fiber-cut history
      </div>
    )
  }

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}
        aria-label="Fiber-cut history"
      >
        <thead style={{ background: "var(--bg-elevated)" }}>
          <tr>
            {["Link", "Region", "Occurred", "Cleared", "Duration"].map((h) => (
              <th
                key={h}
                scope="col"
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-muted)",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {[200, 100, 120, 120, 60].map((w, j) => (
                  <td key={j} style={{ padding: "10px 12px" }}>
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
            ))
            : data.length === 0
              ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: "24px",
                      textAlign: "center",
                      color: "var(--text-muted)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {/* Could be empty because FIBER_CUT_ALARM_NAME isn't set or no cuts in range */}
                    No fiber-cut events in this period
                  </td>
                </tr>
              )
              : data.map((row) => (
                <tr key={row.log_serial_number} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text)" }}>
                    {row.fiberlink_site_name ?? row.site_a_id ?? row.log_serial_number}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    {row.state ?? "—"}
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {new Date(row.occurrence_time).toLocaleString("en-GB", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {row.clearance_time
                      ? new Date(row.clearance_time).toLocaleString("en-GB", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })
                      : "Active"}
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    {row.down_time ?? "—"}
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tab navigation ────────────────────────────────────────────────────────────

const TABS = [
  { path: "/dashboard", label: "Overview", end: true },
  { path: "/dashboard/alarms", label: "Alarms" },
  { path: "/dashboard/regions", label: "Regions" },
  { path: "/dashboard/fiber", label: "Fiber cuts" },
]

function TabNav() {
  return (
    <nav
      aria-label="Dashboard sections"
      style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border)", marginBottom: 24 }}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          end={tab.end}
          style={({ isActive }) => ({
            padding: "8px 16px",
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            textDecoration: "none",
            color: isActive ? "var(--accent-500)" : "var(--text-muted)",
            borderBottom: isActive ? "2px solid var(--accent-500)" : "2px solid transparent",
            marginBottom: -1,
            transition: "color var(--duration-75) var(--ease-default)",
            borderRadius: "4px 4px 0 0",
          })}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}

// ── Date range selector ───────────────────────────────────────────────────────

interface RangeSelectorProps {
  value: RangePreset
  onChange: (v: RangePreset) => void
}

function RangeSelector({ value, onChange }: RangeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Date range"
      style={{
        display: "flex",
        gap: 4,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 3,
      }}
    >
      {(["7d", "30d", "90d"] as RangePreset[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-pressed={value === p}
          style={{
            padding: "4px 12px",
            borderRadius: 4,
            border: "none",
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            cursor: "pointer",
            background: value === p ? "var(--accent-500)" : "transparent",
            color: value === p ? "#fff" : "var(--text-muted)",
            transition: "background var(--duration-75) var(--ease-default), color var(--duration-75) var(--ease-default)",
          }}
        >
          {RANGE_LABELS[p].split(" ")[1]}
        </button>
      ))}
    </div>
  )
}

// ── Overview tab (all charts) ─────────────────────────────────────────────────

interface OverviewProps {
  range: RangePreset
  queryParams: string
}

function Overview({ range, queryParams }: OverviewProps) {
  const summary = useQuery<SummaryData>({
    queryKey: ["dashboard-summary", queryParams],
    queryFn: () => apiClient.get(`/api/v1/dashboard/summary${queryParams}`),
    staleTime: 60_000,
  })

  const alarms = useQuery<AlarmsData>({
    queryKey: ["dashboard-alarms", queryParams],
    queryFn: () => apiClient.get(`/api/v1/dashboard/alarms${queryParams}`),
    staleTime: 60_000,
  })

  const recurring = useQuery<RecurringData>({
    queryKey: ["dashboard-recurring", queryParams],
    queryFn: () => apiClient.get(`/api/v1/dashboard/recurring${queryParams}`),
    staleTime: 60_000,
  })

  const regions = useQuery<RegionsData>({
    queryKey: ["dashboard-regions", queryParams],
    queryFn: () => apiClient.get(`/api/v1/dashboard/regions${queryParams}`),
    staleTime: 60_000,
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Hero KPI */}
      <HeroKpi
        currentPct={summary.data?.current_availability_pct ?? null}
        deltaPct={summary.data?.delta_vs_prior_pct ?? null}
        sparkline={summary.data?.availability_sparkline ?? []}
        isLoading={summary.isLoading}
        error={summary.isError}
        rangeLabel={RANGE_LABELS[range]}
      />

      {/* Supporting KPI strip */}
      <dl
        style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
        aria-label="Supporting network KPIs"
      >
        <KpiChip
          label="MTTR"
          value={summary.data ? formatMttr(summary.data.mttr_minutes) : null}
          isLoading={summary.isLoading}
        />
        <KpiChip
          label="Cuts 24h"
          value={summary.data ? String(summary.data.cuts_24h) : null}
          isLoading={summary.isLoading}
        />
        <KpiChip
          label="Alarm sample"
          value={summary.data ? summary.data.mttr_sample_size.toLocaleString() : null}
          isLoading={summary.isLoading}
        />
      </dl>

      {/* Alarms over time */}
      <div>
        <SectionHeader title="Alarms over time" />
        <AlarmsOverTime
          data={alarms.data?.rows ?? []}
          isLoading={alarms.isLoading}
          error={alarms.isError}
        />
      </div>

      {/* Top recurring issues */}
      <div>
        <SectionHeader title="Top recurring issues" />
        <TopRecurringIssues
          data={recurring.data?.rows ?? []}
          isLoading={recurring.isLoading}
          error={recurring.isError}
        />
      </div>

      {/* MTTR by region */}
      <div>
        <SectionHeader title="MTTR by region" />
        <MttrByRegion
          data={regions.data?.rows ?? []}
          isLoading={regions.isLoading}
          error={regions.isError}
        />
      </div>
    </div>
  )
}

// ── Alarms sub-tab ────────────────────────────────────────────────────────────

function AlarmsTab({ queryParams }: { queryParams: string }) {
  const alarms = useQuery<AlarmsData>({
    queryKey: ["dashboard-alarms", queryParams],
    queryFn: () => apiClient.get(`/api/v1/dashboard/alarms${queryParams}`),
    staleTime: 60_000,
  })

  const recurring = useQuery<RecurringData>({
    queryKey: ["dashboard-recurring", queryParams],
    queryFn: () => apiClient.get(`/api/v1/dashboard/recurring${queryParams}`),
    staleTime: 60_000,
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <SectionHeader title="Daily alarm volume" />
        <AlarmsOverTime
          data={alarms.data?.rows ?? []}
          isLoading={alarms.isLoading}
          error={alarms.isError}
        />
      </div>
      <div>
        <SectionHeader title="Top recurring issues" />
        <TopRecurringIssues
          data={recurring.data?.rows ?? []}
          isLoading={recurring.isLoading}
          error={recurring.isError}
        />
      </div>
    </div>
  )
}

// ── Regions sub-tab ───────────────────────────────────────────────────────────

function RegionsTab({ queryParams }: { queryParams: string }) {
  const regions = useQuery<RegionsData>({
    queryKey: ["dashboard-regions", queryParams],
    queryFn: () => apiClient.get(`/api/v1/dashboard/regions${queryParams}`),
    staleTime: 60_000,
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <SectionHeader title="MTTR by region" />
        <MttrByRegion
          data={regions.data?.rows ?? []}
          isLoading={regions.isLoading}
          error={regions.isError}
        />
      </div>
      {/* Region detail table */}
      {!regions.isLoading && regions.data && regions.data.rows.length > 0 && (
        <div>
          <SectionHeader title="Region breakdown" />
          <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }} aria-label="Region MTTR breakdown">
              <thead style={{ background: "var(--bg-elevated)" }}>
                <tr>
                  {["Region", "Avg MTTR", "Alarm count"].map((h) => (
                    <th key={h} scope="col" style={{ padding: "8px 12px", textAlign: "left", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regions.data.rows.map((row) => (
                  <tr key={row.region} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--text)" }}>{row.region}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                      {formatMttr(row.mttr_minutes)}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      {row.alarm_count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Fiber sub-tab ─────────────────────────────────────────────────────────────

function FiberTab({ queryParams }: { queryParams: string }) {
  const fiber = useQuery<FiberData>({
    queryKey: ["dashboard-fiber", queryParams],
    queryFn: () => apiClient.get(`/api/v1/dashboard/fiber${queryParams}`),
    staleTime: 60_000,
  })

  return (
    <div>
      <SectionHeader title="Fiber-cut history" />
      <FiberCutHistory
        data={fiber.data?.rows ?? []}
        isLoading={fiber.isLoading}
        error={fiber.isError}
      />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [range, setRange] = useState<RangePreset>("30d")
  const queryParams = rangeToQueryParams(range)
  const location = useLocation()

  return (
    <main
      id="main-content"
      style={{
        flex: 1,
        padding: "32px",
        background: "var(--bg)",
        overflowY: "auto",
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-xl)",
            fontWeight: 600,
            color: "var(--text)",
          }}
        >
          Dashboard
        </h1>
        <RangeSelector value={range} onChange={setRange} />
      </div>

      {/* Sub-tab navigation */}
      <TabNav />

      {/* Tab content */}
      <Routes>
        <Route
          index
          element={<Overview range={range} queryParams={queryParams} />}
        />
        <Route path="alarms" element={<AlarmsTab queryParams={queryParams} />} />
        <Route path="regions" element={<RegionsTab queryParams={queryParams} />} />
        <Route path="fiber" element={<FiberTab queryParams={queryParams} />} />
        <Route path="*" element={<Navigate to={location.pathname.replace(/\/[^/]+$/, "")} replace />} />
      </Routes>
    </main>
  )
}
