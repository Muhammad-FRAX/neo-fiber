/**
 * /admin/audit — paginated read-only log of topology changes.
 */

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { format } from "date-fns"

interface AuditEntry {
  id: number
  user_id: number | null
  action: string
  before_state: unknown
  after_state: unknown
  at: string
  username: string | null
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: { page: number; limit: number; total: number }
}

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--border)",
  fontSize: 13,
  color: "var(--text)",
  verticalAlign: "top",
}

const thStyle: React.CSSProperties = {
  ...tdStyle,
  fontWeight: 600,
  fontSize: 12,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  background: "var(--bg-elevated)",
  position: "sticky",
  top: 0,
}

function ActionBadge({ action }: { action: string }) {
  const isCreate = action.includes(".create") || action.includes(".import")
  const isDelete = action.includes(".delete")
  const isUpdate = action.includes(".update")
  const bg = isCreate ? "rgba(16,185,129,0.12)" : isDelete ? "rgba(244,63,94,0.12)" : isUpdate ? "rgba(99,102,241,0.12)" : "rgba(148,163,184,0.12)"
  const color = isCreate ? "var(--status-up)" : isDelete ? "var(--status-down)" : isUpdate ? "var(--accent-500)" : "var(--text-muted)"
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: bg, color }}>
      {action}
    </span>
  )
}

function JsonPreview({ value }: { value: unknown }) {
  if (value == null) return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
  const text = JSON.stringify(value, null, 2)
  return (
    <pre style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "4px 8px", borderRadius: 4, maxWidth: 280, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
      {text.length > 200 ? text.slice(0, 200) + "…" : text}
    </pre>
  )
}

const PAGE_SIZE = 25

export function AuditPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "audit", page],
    queryFn: () =>
      apiClient.get<PaginatedResponse<AuditEntry>>(
        `/api/v1/admin/audit?page=${page}&limit=${PAGE_SIZE}`,
      ),
  })

  const entries = data?.data ?? []
  const total = data?.pagination.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <section aria-label="Audit log" style={{ display: "flex", flexDirection: "column", gap: 16, padding: "24px 32px", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>Audit Log</h2>
        <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: "auto" }}>
          {total} entries
        </span>
      </div>

      {isError && (
        <div role="alert" style={{ padding: "8px 12px", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: 13 }}>
          Failed to load audit log
        </div>
      )}

      {!isError && total === 0 && !isLoading && (
        <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          No audit entries yet. Admin actions on topology data will appear here.
        </div>
      )}

      {(isLoading || entries.length > 0) && (
        <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }} aria-label="Audit entries">
            <thead>
              <tr>
                {["ID", "User", "Action", "Before", "After", "Time"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "var(--text-muted)" }}>
                    Loading…
                  </td>
                </tr>
              ) : entries.map((e) => (
                <tr key={e.id}>
                  <td style={tdStyle}>{e.id}</td>
                  <td style={tdStyle}>{e.username ?? (e.user_id ? `#${e.user_id}` : "—")}</td>
                  <td style={tdStyle}><ActionBadge action={e.action} /></td>
                  <td style={tdStyle}><JsonPreview value={e.before_state} /></td>
                  <td style={tdStyle}><JsonPreview value={e.after_state} /></td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    {format(new Date(e.at), "yyyy-MM-dd HH:mm:ss")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
            style={{ display: "inline-flex", alignItems: "center", padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: page === 1 ? "var(--text-muted)" : "var(--text)", cursor: page === 1 ? "default" : "pointer" }}
          >
            <ChevronLeft size={14} aria-hidden />
          </button>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
            style={{ display: "inline-flex", alignItems: "center", padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: page === totalPages ? "var(--text-muted)" : "var(--text)", cursor: page === totalPages ? "default" : "pointer" }}
          >
            <ChevronRight size={14} aria-hidden />
          </button>
        </div>
      )}
    </section>
  )
}
