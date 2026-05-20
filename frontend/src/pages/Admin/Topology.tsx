/**
 * /admin/topology — sortable, filterable, inline-editable tables for Sites,
 * Devices, and Links. No graph view (DESIGN.md §10: tables only, graph is v2.0).
 *
 * §10.5 first-run empty state: centered card with [ Import CSV ] + [ Add site ].
 */

import { useState, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Upload, Pencil, Trash2, Check, X } from "lucide-react"
import { apiClient, ApiError, getToken } from "@/lib/api-client"

// ── Types ─────────────────────────────────────────────────────────────────

interface Site {
  id: number
  site_id_external: string | null
  name: string
  region: string | null
  state: string | null
  lat: number | null
  lng: number | null
  is_root: boolean
}

interface Device {
  id: number
  device_id_external: string | null
  site_id: number
  name: string
  type: string | null
  vendor: string | null
}

interface Link {
  id: number
  link_id_external: string | null
  source_device_id: number
  target_device_id: number
  ranking: "MAIN" | "BACKUP" | "AUX"
  capacity_gbps: number | null
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: { page: number; limit: number; total: number }
}

// ── Shared table styles ───────────────────────────────────────────────────

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid var(--border)",
  fontSize: 13,
  color: "var(--text)",
  whiteSpace: "nowrap",
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

// ── CSV Upload button ─────────────────────────────────────────────────────

function CsvUpload({
  type,
  onSuccess,
}: {
  type: "sites" | "devices" | "links"
  onSuccess: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus("Uploading…")
    try {
      const text = await file.text()
      const token = getToken()
      const response = await fetch(`/api/v1/admin/csv?type=${type}`, {
        method: "POST",
        headers: {
          "Content-Type": "text/csv",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: text,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(body.error?.message ?? `Upload failed: ${response.status}`)
      }
      const result = await response.json() as { summary: { [k: string]: { imported: number; errors: string[] } } }
      const s = result.summary[type]
      setStatus(`Imported ${s.imported} rows${s.errors.length ? ` (${s.errors.length} errors)` : ""}`)
      onSuccess()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload failed")
    }
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <span>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={handleFile}
        aria-label={`Import ${type} CSV`}
      />
      <button
        onClick={() => fileRef.current?.click()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          color: "var(--text)",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <Upload size={14} aria-hidden />
        Import CSV
      </button>
      {status && (
        <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>
          {status}
        </span>
      )}
    </span>
  )
}

// ── Sites tab ─────────────────────────────────────────────────────────────

function SitesTab() {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<Site>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [newSite, setNewSite] = useState<Partial<Site>>({})
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "sites"],
    queryFn: () => apiClient.get<PaginatedResponse<Site>>("/api/v1/admin/sites?limit=200"),
  })

  const sites = (data?.data ?? []).filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.region ?? "").toLowerCase().includes(search.toLowerCase()),
  )

  const saveMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Site> }) =>
      apiClient.patch(`/api/v1/admin/sites/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "sites"] }); setEditId(null) },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Save failed"),
  })

  const addMutation = useMutation({
    mutationFn: (body: Partial<Site>) => apiClient.post("/api/v1/admin/sites", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "sites"] }); setShowAdd(false); setNewSite({}) },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Add failed"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/v1/admin/sites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "sites"] }),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Delete failed"),
  })

  const isEmpty = !isLoading && (data?.data ?? []).length === 0 && !showAdd

  if (isEmpty) {
    return (
      <div
        role="main"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 24px",
          gap: 16,
        }}
      >
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "40px 48px",
            textAlign: "center",
            maxWidth: 400,
            background: "var(--bg-elevated)",
          }}
        >
          <p style={{ fontWeight: 600, fontSize: 16, color: "var(--text)", marginBottom: 8 }}>
            No sites yet
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
            Import a CSV to get started, or add one manually.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <CsvUpload type="sites" onSuccess={() => qc.invalidateQueries({ queryKey: ["admin", "sites"] })} />
            <button
              onClick={() => setShowAdd(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 16px",
                borderRadius: 6,
                border: "none",
                background: "var(--accent-500)",
                color: "#fff",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <Plus size={14} aria-hidden />
              Add site
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && (
        <div role="alert" style={{ padding: "8px 12px", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: 13 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, cursor: "pointer", background: "none", border: "none", color: "#dc2626" }} aria-label="Dismiss error">×</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="search"
          placeholder="Search sites…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search sites"
          style={{
            flex: 1,
            maxWidth: 280,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            fontSize: 13,
            background: "var(--bg)",
            color: "var(--text)",
          }}
        />
        <CsvUpload type="sites" onSuccess={() => qc.invalidateQueries({ queryKey: ["admin", "sites"] })} />
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
            background: "var(--accent-500)",
            color: "#fff",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <Plus size={14} aria-hidden />
          Add site
        </button>
      </div>

      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }} aria-label="Sites">
          <thead>
            <tr>
              {["ID", "External ID", "Name", "Region", "State", "Lat", "Lng", "Root", ""].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {showAdd && (
              <tr>
                <td style={tdStyle}>—</td>
                {(["site_id_external", "name", "region", "state", "lat", "lng"] as const).map((f) => (
                  <td key={f} style={tdStyle}>
                    <input
                      type={f === "lat" || f === "lng" ? "number" : "text"}
                      value={String(newSite[f] ?? "")}
                      onChange={(e) => setNewSite((p) => ({ ...p, [f]: e.target.value || null }))}
                      placeholder={f}
                      aria-label={f}
                      style={{ width: "100%", padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }}
                    />
                  </td>
                ))}
                <td style={tdStyle}>
                  <input
                    type="checkbox"
                    checked={!!newSite.is_root}
                    onChange={(e) => setNewSite((p) => ({ ...p, is_root: e.target.checked }))}
                    aria-label="is_root"
                  />
                </td>
                <td style={tdStyle}>
                  <button onClick={() => addMutation.mutate(newSite)} aria-label="Save new site" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--status-up)" }}><Check size={14} /></button>
                  <button onClick={() => setShowAdd(false)} aria-label="Cancel" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)" }}><X size={14} /></button>
                </td>
              </tr>
            )}
            {isLoading ? (
              <tr><td colSpan={9} style={{ ...tdStyle, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>
            ) : sites.map((site) => (
              <tr key={site.id} style={{ background: editId === site.id ? "var(--bg-elevated)" : undefined }}>
                <td style={tdStyle}>{site.id}</td>
                {editId === site.id ? (
                  <>
                    {(["site_id_external", "name", "region", "state", "lat", "lng"] as const).map((f) => (
                      <td key={f} style={tdStyle}>
                        <input
                          type={f === "lat" || f === "lng" ? "number" : "text"}
                          value={String(editDraft[f] ?? site[f] ?? "")}
                          onChange={(e) => setEditDraft((p) => ({ ...p, [f]: e.target.value || null }))}
                          aria-label={f}
                          style={{ width: "100%", padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }}
                        />
                      </td>
                    ))}
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        checked={editDraft.is_root ?? site.is_root}
                        onChange={(e) => setEditDraft((p) => ({ ...p, is_root: e.target.checked }))}
                        aria-label="is_root"
                      />
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => saveMutation.mutate({ id: site.id, body: editDraft })} aria-label="Save" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--status-up)" }}><Check size={14} /></button>
                      <button onClick={() => setEditId(null)} aria-label="Cancel" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)" }}><X size={14} /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={tdStyle}>{site.site_id_external ?? "—"}</td>
                    <td style={tdStyle}>{site.name}</td>
                    <td style={tdStyle}>{site.region ?? "—"}</td>
                    <td style={tdStyle}>{site.state ?? "—"}</td>
                    <td style={tdStyle}>{site.lat ?? "—"}</td>
                    <td style={tdStyle}>{site.lng ?? "—"}</td>
                    <td style={tdStyle}>{site.is_root ? "✓" : "—"}</td>
                    <td style={tdStyle}>
                      <button onClick={() => { setEditId(site.id); setEditDraft({}) }} aria-label={`Edit site ${site.name}`} style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)", marginRight: 4 }}><Pencil size={13} /></button>
                      <button onClick={() => { if (confirm(`Delete site "${site.name}"?`)) deleteMutation.mutate(site.id) }} aria-label={`Delete site ${site.name}`} style={{ cursor: "pointer", background: "none", border: "none", color: "var(--status-down)" }}><Trash2 size={13} /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Devices tab ───────────────────────────────────────────────────────────

function DevicesTab() {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<Device>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [newDevice, setNewDevice] = useState<Partial<Device>>({})
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "devices"],
    queryFn: () => apiClient.get<PaginatedResponse<Device>>("/api/v1/admin/devices?limit=200"),
  })

  const devices = (data?.data ?? []).filter(
    (d) => !search || d.name.toLowerCase().includes(search.toLowerCase()),
  )

  const saveMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Device> }) =>
      apiClient.patch(`/api/v1/admin/devices/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "devices"] }); setEditId(null) },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Save failed"),
  })

  const addMutation = useMutation({
    mutationFn: (body: Partial<Device>) => apiClient.post("/api/v1/admin/devices", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "devices"] }); setShowAdd(false); setNewDevice({}) },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Add failed"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/v1/admin/devices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "devices"] }),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Delete failed"),
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && (
        <div role="alert" style={{ padding: "8px 12px", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: 13 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, cursor: "pointer", background: "none", border: "none", color: "#dc2626" }} aria-label="Dismiss error">×</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="search"
          placeholder="Search devices…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search devices"
          style={{ flex: 1, maxWidth: 280, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13, background: "var(--bg)", color: "var(--text)" }}
        />
        <CsvUpload type="devices" onSuccess={() => qc.invalidateQueries({ queryKey: ["admin", "devices"] })} />
        <button
          onClick={() => setShowAdd(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--accent-500)", color: "#fff", fontSize: 13, cursor: "pointer" }}
        >
          <Plus size={14} aria-hidden /> Add device
        </button>
      </div>

      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }} aria-label="Devices">
          <thead>
            <tr>
              {["ID", "External ID", "Site ID", "Name", "Type", "Vendor", ""].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {showAdd && (
              <tr>
                <td style={tdStyle}>—</td>
                {(["device_id_external", "site_id", "name", "type", "vendor"] as const).map((f) => (
                  <td key={f} style={tdStyle}>
                    <input
                      type={f === "site_id" ? "number" : "text"}
                      value={String(newDevice[f] ?? "")}
                      onChange={(e) => setNewDevice((p) => ({ ...p, [f]: f === "site_id" ? parseInt(e.target.value) : (e.target.value || null) }))}
                      placeholder={f}
                      aria-label={f}
                      style={{ width: "100%", padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }}
                    />
                  </td>
                ))}
                <td style={tdStyle}>
                  <button onClick={() => addMutation.mutate(newDevice)} aria-label="Save" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--status-up)" }}><Check size={14} /></button>
                  <button onClick={() => setShowAdd(false)} aria-label="Cancel" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)" }}><X size={14} /></button>
                </td>
              </tr>
            )}
            {isLoading ? (
              <tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>
            ) : devices.map((d) => (
              <tr key={d.id}>
                <td style={tdStyle}>{d.id}</td>
                {editId === d.id ? (
                  <>
                    {(["device_id_external", "site_id", "name", "type", "vendor"] as const).map((f) => (
                      <td key={f} style={tdStyle}>
                        <input
                          type={f === "site_id" ? "number" : "text"}
                          value={String(editDraft[f] ?? d[f] ?? "")}
                          onChange={(e) => setEditDraft((p) => ({ ...p, [f]: f === "site_id" ? parseInt(e.target.value) : (e.target.value || null) }))}
                          aria-label={f}
                          style={{ width: "100%", padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }}
                        />
                      </td>
                    ))}
                    <td style={tdStyle}>
                      <button onClick={() => saveMutation.mutate({ id: d.id, body: editDraft })} aria-label="Save" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--status-up)" }}><Check size={14} /></button>
                      <button onClick={() => setEditId(null)} aria-label="Cancel" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)" }}><X size={14} /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={tdStyle}>{d.device_id_external ?? "—"}</td>
                    <td style={tdStyle}>{d.site_id}</td>
                    <td style={tdStyle}>{d.name}</td>
                    <td style={tdStyle}>{d.type ?? "—"}</td>
                    <td style={tdStyle}>{d.vendor ?? "—"}</td>
                    <td style={tdStyle}>
                      <button onClick={() => { setEditId(d.id); setEditDraft({}) }} aria-label={`Edit device ${d.name}`} style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)", marginRight: 4 }}><Pencil size={13} /></button>
                      <button onClick={() => { if (confirm(`Delete device "${d.name}"?`)) deleteMutation.mutate(d.id) }} aria-label={`Delete device ${d.name}`} style={{ cursor: "pointer", background: "none", border: "none", color: "var(--status-down)" }}><Trash2 size={13} /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Links tab ─────────────────────────────────────────────────────────────

function LinksTab() {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<Link>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [newLink, setNewLink] = useState<Partial<Link>>({})
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "links"],
    queryFn: () => apiClient.get<PaginatedResponse<Link>>("/api/v1/admin/links?limit=200"),
  })

  const links = (data?.data ?? []).filter(
    (l) =>
      !search ||
      (l.link_id_external ?? "").toLowerCase().includes(search.toLowerCase()) ||
      l.ranking.toLowerCase().includes(search.toLowerCase()),
  )

  const saveMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Link> }) =>
      apiClient.patch(`/api/v1/admin/links/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "links"] }); setEditId(null) },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Save failed"),
  })

  const addMutation = useMutation({
    mutationFn: (body: Partial<Link>) => apiClient.post("/api/v1/admin/links", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "links"] }); setShowAdd(false); setNewLink({}) },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Add failed"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/v1/admin/links/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "links"] }),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Delete failed"),
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && (
        <div role="alert" style={{ padding: "8px 12px", borderRadius: 6, background: "#fef2f2", color: "#dc2626", fontSize: 13 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, cursor: "pointer", background: "none", border: "none", color: "#dc2626" }} aria-label="Dismiss error">×</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="search"
          placeholder="Search links…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search links"
          style={{ flex: 1, maxWidth: 280, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13, background: "var(--bg)", color: "var(--text)" }}
        />
        <CsvUpload type="links" onSuccess={() => qc.invalidateQueries({ queryKey: ["admin", "links"] })} />
        <button
          onClick={() => setShowAdd(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--accent-500)", color: "#fff", fontSize: 13, cursor: "pointer" }}
        >
          <Plus size={14} aria-hidden /> Add link
        </button>
      </div>

      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }} aria-label="Links">
          <thead>
            <tr>
              {["ID", "External ID", "Source Dev", "Target Dev", "Ranking", "Capacity (Gbps)", ""].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {showAdd && (
              <tr>
                <td style={tdStyle}>—</td>
                {(["link_id_external", "source_device_id", "target_device_id"] as const).map((f) => (
                  <td key={f} style={tdStyle}>
                    <input
                      type={f !== "link_id_external" ? "number" : "text"}
                      value={String(newLink[f] ?? "")}
                      onChange={(e) => setNewLink((p) => ({ ...p, [f]: f !== "link_id_external" ? parseInt(e.target.value) : (e.target.value || null) }))}
                      placeholder={f}
                      aria-label={f}
                      style={{ width: "100%", padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }}
                    />
                  </td>
                ))}
                <td style={tdStyle}>
                  <select
                    value={newLink.ranking ?? "MAIN"}
                    onChange={(e) => setNewLink((p) => ({ ...p, ranking: e.target.value as "MAIN" | "BACKUP" | "AUX" }))}
                    aria-label="ranking"
                    style={{ padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }}
                  >
                    <option>MAIN</option><option>BACKUP</option><option>AUX</option>
                  </select>
                </td>
                <td style={tdStyle}>
                  <input
                    type="number"
                    value={String(newLink.capacity_gbps ?? "")}
                    onChange={(e) => setNewLink((p) => ({ ...p, capacity_gbps: e.target.value ? parseFloat(e.target.value) : null }))}
                    placeholder="capacity_gbps"
                    aria-label="capacity_gbps"
                    style={{ width: "100%", padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }}
                  />
                </td>
                <td style={tdStyle}>
                  <button onClick={() => addMutation.mutate(newLink)} aria-label="Save" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--status-up)" }}><Check size={14} /></button>
                  <button onClick={() => setShowAdd(false)} aria-label="Cancel" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)" }}><X size={14} /></button>
                </td>
              </tr>
            )}
            {isLoading ? (
              <tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>
            ) : links.map((l) => (
              <tr key={l.id}>
                <td style={tdStyle}>{l.id}</td>
                {editId === l.id ? (
                  <>
                    <td style={tdStyle}>
                      <input type="text" value={editDraft.link_id_external ?? l.link_id_external ?? ""} onChange={(e) => setEditDraft((p) => ({ ...p, link_id_external: e.target.value || null }))} aria-label="link_id_external" style={{ padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }} />
                    </td>
                    <td style={tdStyle}>
                      <input type="number" value={editDraft.source_device_id ?? l.source_device_id} onChange={(e) => setEditDraft((p) => ({ ...p, source_device_id: parseInt(e.target.value) }))} aria-label="source_device_id" style={{ width: 70, padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }} />
                    </td>
                    <td style={tdStyle}>
                      <input type="number" value={editDraft.target_device_id ?? l.target_device_id} onChange={(e) => setEditDraft((p) => ({ ...p, target_device_id: parseInt(e.target.value) }))} aria-label="target_device_id" style={{ width: 70, padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }} />
                    </td>
                    <td style={tdStyle}>
                      <select value={editDraft.ranking ?? l.ranking} onChange={(e) => setEditDraft((p) => ({ ...p, ranking: e.target.value as "MAIN" | "BACKUP" | "AUX" }))} aria-label="ranking" style={{ padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }}>
                        <option>MAIN</option><option>BACKUP</option><option>AUX</option>
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <input type="number" value={editDraft.capacity_gbps ?? l.capacity_gbps ?? ""} onChange={(e) => setEditDraft((p) => ({ ...p, capacity_gbps: e.target.value ? parseFloat(e.target.value) : null }))} aria-label="capacity_gbps" style={{ width: 80, padding: "3px 6px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", color: "var(--text)" }} />
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => saveMutation.mutate({ id: l.id, body: editDraft })} aria-label="Save" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--status-up)" }}><Check size={14} /></button>
                      <button onClick={() => setEditId(null)} aria-label="Cancel" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)" }}><X size={14} /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={tdStyle}>{l.link_id_external ?? "—"}</td>
                    <td style={tdStyle}>{l.source_device_id}</td>
                    <td style={tdStyle}>{l.target_device_id}</td>
                    <td style={tdStyle}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        background: l.ranking === "MAIN" ? "rgba(16,185,129,0.12)" : l.ranking === "BACKUP" ? "rgba(245,158,11,0.12)" : "rgba(148,163,184,0.15)",
                        color: l.ranking === "MAIN" ? "var(--status-up)" : l.ranking === "BACKUP" ? "var(--status-degraded)" : "var(--text-muted)",
                      }}>
                        {l.ranking}
                      </span>
                    </td>
                    <td style={tdStyle}>{l.capacity_gbps ?? "—"}</td>
                    <td style={tdStyle}>
                      <button onClick={() => { setEditId(l.id); setEditDraft({}) }} aria-label={`Edit link ${l.id}`} style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)", marginRight: 4 }}><Pencil size={13} /></button>
                      <button onClick={() => { if (confirm(`Delete link ${l.id}?`)) deleteMutation.mutate(l.id) }} aria-label={`Delete link ${l.id}`} style={{ cursor: "pointer", background: "none", border: "none", color: "var(--status-down)" }}><Trash2 size={13} /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

type TopologyTab = "sites" | "devices" | "links"

export function TopologyPage() {
  const [tab, setTab] = useState<TopologyTab>("sites")

  const tabStyle = (t: TopologyTab): React.CSSProperties => ({
    padding: "8px 16px",
    border: "none",
    borderBottom: tab === t ? "2px solid var(--accent-500)" : "2px solid transparent",
    background: "none",
    color: tab === t ? "var(--accent-500)" : "var(--text-muted)",
    fontWeight: tab === t ? 600 : 400,
    fontSize: 14,
    cursor: "pointer",
  })

  return (
    <section aria-label="Topology editor" style={{ display: "flex", flexDirection: "column", gap: 16, padding: "24px 32px", flex: 1 }}>
      <div style={{ borderBottom: "1px solid var(--border)", display: "flex", gap: 4 }} role="tablist">
        {(["sites", "devices", "links"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            aria-controls={`tabpanel-${t}`}
            onClick={() => setTab(t)}
            style={tabStyle(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div id={`tabpanel-${tab}`} role="tabpanel" aria-label={tab}>
        {tab === "sites" && <SitesTab />}
        {tab === "devices" && <DevicesTab />}
        {tab === "links" && <LinksTab />}
      </div>
    </section>
  )
}
