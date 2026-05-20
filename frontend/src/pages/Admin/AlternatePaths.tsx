/**
 * /admin/alternate-paths — manage alternate path declarations for devices.
 * Engineers declare which link IDs can serve as alternate routes for a device,
 * enabling backup-aware reachability (DESIGN.md §9).
 */

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Pencil, Trash2, Check, X } from "lucide-react"
import { apiClient, ApiError } from "@/lib/api-client"
import { format } from "date-fns"

interface AlternatePath {
  id: number
  device_id: number
  alternate_link_ids: number[]
  declared_by: number | null
  declared_at: string
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: { page: number; limit: number; total: number }
}

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid var(--border)",
  fontSize: 13,
  color: "var(--text)",
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

function linkIdsToString(ids: number[]): string {
  return ids.join(", ")
}

function parseIds(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n) && n > 0)
}

export function AlternatePathsPage() {
  const qc = useQueryClient()
  const [editId, setEditId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<{ device_id: string; alternate_link_ids: string }>({ device_id: "", alternate_link_ids: "" })
  const [showAdd, setShowAdd] = useState(false)
  const [newPath, setNewPath] = useState({ device_id: "", alternate_link_ids: "" })
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "alternate-paths"],
    queryFn: () => apiClient.get<PaginatedResponse<AlternatePath>>("/api/v1/admin/alternate-paths?limit=200"),
  })

  const paths = data?.data ?? []

  const saveMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { device_id?: number; alternate_link_ids?: number[] } }) =>
      apiClient.patch(`/api/v1/admin/alternate-paths/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "alternate-paths"] }); setEditId(null) },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Save failed"),
  })

  const addMutation = useMutation({
    mutationFn: (body: { device_id: number; alternate_link_ids: number[] }) =>
      apiClient.post("/api/v1/admin/alternate-paths", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "alternate-paths"] }); setShowAdd(false); setNewPath({ device_id: "", alternate_link_ids: "" }) },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Add failed"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/v1/admin/alternate-paths/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "alternate-paths"] }),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Delete failed"),
  })

  const isEmpty = !isLoading && paths.length === 0 && !showAdd

  return (
    <section aria-label="Alternate paths" style={{ display: "flex", flexDirection: "column", gap: 16, padding: "24px 32px", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>Alternate Paths</h2>
        <button
          onClick={() => setShowAdd(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--accent-500)", color: "#fff", fontSize: 13, cursor: "pointer", marginLeft: "auto" }}
        >
          <Plus size={14} aria-hidden /> Declare alternate path
        </button>
      </div>

      {error && (
        <div role="alert" style={{ padding: "8px 12px", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: 13 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, cursor: "pointer", background: "none", border: "none", color: "#dc2626" }} aria-label="Dismiss">×</button>
        </div>
      )}

      {isEmpty ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 24px", gap: 16 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "40px 48px", textAlign: "center", maxWidth: 400, background: "var(--bg-elevated)" }}>
            <p style={{ fontWeight: 600, fontSize: 16, color: "var(--text)", marginBottom: 8 }}>No alternate paths yet</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
              Declare alternate links for devices to enable DEGRADED (amber) status when MAIN is down but a backup path exists.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: 6, border: "none", background: "var(--accent-500)", color: "#fff", fontSize: 13, cursor: "pointer" }}
            >
              <Plus size={14} aria-hidden /> Declare alternate path
            </button>
          </div>
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }} aria-label="Alternate paths">
            <thead>
              <tr>
                {["ID", "Device ID", "Alternate Link IDs", "Declared by", "Declared at", ""].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {showAdd && (
                <tr>
                  <td style={tdStyle}>—</td>
                  <td style={tdStyle}>
                    <input
                      type="number"
                      value={newPath.device_id}
                      onChange={(e) => setNewPath((p) => ({ ...p, device_id: e.target.value }))}
                      placeholder="device_id"
                      aria-label="device_id"
                      style={{ width: 80, padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="text"
                      value={newPath.alternate_link_ids}
                      onChange={(e) => setNewPath((p) => ({ ...p, alternate_link_ids: e.target.value }))}
                      placeholder="e.g. 3, 7, 12"
                      aria-label="alternate_link_ids"
                      style={{ width: 160, padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }}
                    />
                  </td>
                  <td style={tdStyle}>—</td>
                  <td style={tdStyle}>—</td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => {
                        const deviceId = parseInt(newPath.device_id)
                        if (isNaN(deviceId)) { setError("device_id must be a number"); return }
                        addMutation.mutate({ device_id: deviceId, alternate_link_ids: parseIds(newPath.alternate_link_ids) })
                      }}
                      aria-label="Save"
                      style={{ cursor: "pointer", background: "none", border: "none", color: "var(--status-up)" }}
                    >
                      <Check size={14} />
                    </button>
                    <button onClick={() => setShowAdd(false)} aria-label="Cancel" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)" }}><X size={14} /></button>
                  </td>
                </tr>
              )}
              {isLoading ? (
                <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>
              ) : paths.map((p) => (
                <tr key={p.id}>
                  <td style={tdStyle}>{p.id}</td>
                  {editId === p.id ? (
                    <>
                      <td style={tdStyle}>
                        <input type="number" value={editDraft.device_id} onChange={(e) => setEditDraft((d) => ({ ...d, device_id: e.target.value }))} aria-label="device_id" style={{ width: 80, padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }} />
                      </td>
                      <td style={tdStyle}>
                        <input type="text" value={editDraft.alternate_link_ids} onChange={(e) => setEditDraft((d) => ({ ...d, alternate_link_ids: e.target.value }))} placeholder="3, 7, 12" aria-label="alternate_link_ids" style={{ width: 160, padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }} />
                      </td>
                      <td style={tdStyle}>{p.declared_by ?? "—"}</td>
                      <td style={tdStyle}>{format(new Date(p.declared_at), "yyyy-MM-dd HH:mm")}</td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => {
                            const deviceId = editDraft.device_id ? parseInt(editDraft.device_id) : undefined
                            saveMutation.mutate({
                              id: p.id,
                              body: {
                                ...(deviceId !== undefined && !isNaN(deviceId) ? { device_id: deviceId } : {}),
                                alternate_link_ids: parseIds(editDraft.alternate_link_ids),
                              },
                            })
                          }}
                          aria-label="Save"
                          style={{ cursor: "pointer", background: "none", border: "none", color: "var(--status-up)" }}
                        >
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditId(null)} aria-label="Cancel" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)" }}><X size={14} /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={tdStyle}>{p.device_id}</td>
                      <td style={tdStyle}>
                        <code style={{ fontSize: 12, background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4 }}>
                          [{p.alternate_link_ids.join(", ")}]
                        </code>
                      </td>
                      <td style={tdStyle}>{p.declared_by ?? "—"}</td>
                      <td style={tdStyle}>{format(new Date(p.declared_at), "yyyy-MM-dd HH:mm")}</td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => { setEditId(p.id); setEditDraft({ device_id: String(p.device_id), alternate_link_ids: linkIdsToString(p.alternate_link_ids) }) }}
                          aria-label={`Edit path ${p.id}`}
                          style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)", marginRight: 4 }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete alternate path ${p.id}?`)) deleteMutation.mutate(p.id) }}
                          aria-label={`Delete path ${p.id}`}
                          style={{ cursor: "pointer", background: "none", border: "none", color: "var(--status-down)" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
