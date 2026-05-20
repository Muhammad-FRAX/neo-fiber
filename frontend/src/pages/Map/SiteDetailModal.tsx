/**
 * Site detail modal — 480px right sidesheet.
 * §10: slides in from right, stays open while user pans/zooms.
 * §10.5: role="dialog" aria-modal="true"
 * §11.5: ESC closes, focus trap, visible focus rings
 */

import { useEffect, useRef } from "react"
import { X, CheckCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { AlarmItem } from "./AlarmsTicker"

export interface SiteDetail {
  id: number
  name: string
  region: string | null
  state: string | null
  effective_status: "UP" | "DEGRADED" | "DOWN" | "UNKNOWN"
  updated_at?: string | null
  downstream_affected_sites: number
  downstream_affected_links: { main_down: number; backup_up: number }
  related_alarms: AlarmItem[]
}

interface SiteDetailModalProps {
  site: SiteDetail | null
  isOpen: boolean
  onClose: () => void
  onAck?: (alarmSerial: string) => void
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  UP: { label: "Up", color: "var(--status-up)", bg: "rgba(16,185,129,0.12)" },
  DEGRADED: {
    label: "Degraded — on backup",
    color: "var(--status-degraded)",
    bg: "rgba(245,158,11,0.12)",
  },
  DOWN: { label: "Down", color: "var(--status-down)", bg: "rgba(244,63,94,0.12)" },
  UNKNOWN: { label: "Unknown", color: "var(--status-unknown)", bg: "rgba(148,163,184,0.12)" },
}

const SEV_COLOR: Record<string, string> = {
  Critical: "var(--sev-critical)",
  Major: "var(--sev-major)",
  Minor: "var(--sev-minor)",
  Info: "var(--sev-info)",
}

export function SiteDetailModal({ site, isOpen, onClose, onAck }: SiteDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Focus management: trap focus inside modal
  useEffect(() => {
    if (!isOpen) return
    closeBtnRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
      // Basic focus trap: keep Tab within the modal
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const status = site ? (STATUS_CONFIG[site.effective_status] ?? STATUS_CONFIG["UNKNOWN"]) : null

  return (
    <>
      {/* Backdrop — click to close */}
      {isOpen && (
        <div
          aria-hidden="true"
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: "calc(var(--z-modal) - 1)" as React.CSSProperties["zIndex"],
            background: "transparent",
            cursor: "default",
          }}
        />
      )}

      {/* Sidesheet */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-modal-title"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 480,
          maxWidth: "100%",
          zIndex: "var(--z-modal)" as React.CSSProperties["zIndex"],
          background: "var(--bg-elevated)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: `transform var(--duration-200) var(--ease-out-quart)`,
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
            position: "sticky",
            top: 0,
            background: "var(--bg-elevated)",
            zIndex: 1,
          }}
        >
          <h2
            id="site-modal-title"
            style={{
              margin: 0,
              fontSize: "var(--text-md)",
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            {site?.name ?? "Site details"}
          </h2>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close site details"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: "var(--radius)",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        {site && (
          <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Status badge */}
            {status && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: "var(--radius-md)",
                  background: status.bg,
                  border: `1px solid ${status.color}30`,
                  alignSelf: "flex-start",
                }}
                role="status"
                aria-label={`Site status: ${status.label}`}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: status.color,
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
                <span
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    color: status.color,
                  }}
                >
                  {status.label}
                </span>
              </div>
            )}

            {/* Site meta */}
            <dl
              style={{
                margin: 0,
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "6px 16px",
              }}
            >
              {site.region && (
                <>
                  <dt style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 500 }}>
                    Region
                  </dt>
                  <dd style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text)" }}>
                    {site.region}
                  </dd>
                </>
              )}
              {site.state && (
                <>
                  <dt style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 500 }}>
                    State
                  </dt>
                  <dd style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text)" }}>
                    {site.state}
                  </dd>
                </>
              )}
              {site.updated_at && (
                <>
                  <dt style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 500 }}>
                    Updated
                  </dt>
                  <dd style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {formatDistanceToNow(new Date(site.updated_at), { addSuffix: true })}
                  </dd>
                </>
              )}
            </dl>

            {/* Downstream impact */}
            <section aria-labelledby="downstream-heading">
              <h3
                id="downstream-heading"
                style={{
                  margin: "0 0 10px",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                }}
              >
                Downstream impact
              </h3>
              <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px" }}>
                <dt style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 500 }}>
                  Affected sites
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    color:
                      site.downstream_affected_sites > 0 ? "var(--status-down)" : "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {site.downstream_affected_sites}
                </dd>
                <dt style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 500 }}>
                  Main links down
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    color:
                      site.downstream_affected_links.main_down > 0
                        ? "var(--status-down)"
                        : "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {site.downstream_affected_links.main_down}
                </dd>
                <dt style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 500 }}>
                  Backup links active
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    color:
                      site.downstream_affected_links.backup_up > 0
                        ? "var(--status-degraded)"
                        : "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {site.downstream_affected_links.backup_up}
                </dd>
              </dl>
            </section>

            {/* Related alarms */}
            {site.related_alarms.length > 0 && (
              <section aria-labelledby="alarms-heading">
                <h3
                  id="alarms-heading"
                  style={{
                    margin: "0 0 10px",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-muted)",
                  }}
                >
                  Related alarms
                </h3>
                <ul
                  role="list"
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {site.related_alarms.map((alarm) => (
                    <li
                      key={alarm.log_serial_number}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: "var(--radius)",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: SEV_COLOR[alarm.alarm_severity ?? ""] ?? "var(--text-muted)",
                          flexShrink: 0,
                        }}
                        aria-hidden="true"
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "var(--text-xs)",
                            fontWeight: 600,
                            color: "var(--text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {alarm.alarm_name ?? "Unknown alarm"}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "var(--text-xs)",
                            color: "var(--text-muted)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {new Date(alarm.occurrence_time).toLocaleString()}
                        </p>
                      </div>
                      {alarm.status === "Not Clear" && onAck && (
                        <button
                          onClick={() => onAck(alarm.log_serial_number)}
                          aria-label={`Acknowledge alarm ${alarm.log_serial_number}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 8px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border)",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: "var(--text-xs)",
                            fontWeight: 500,
                            color: "var(--text-muted)",
                            flexShrink: 0,
                          }}
                        >
                          <CheckCircle size={12} aria-hidden="true" />
                          Ack
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Actions */}
            <div
              style={{
                display: "flex",
                gap: 8,
                paddingTop: 4,
                borderTop: "1px solid var(--border)",
                marginTop: "auto",
              }}
            >
              <button
                onClick={() => {
                  const url = window.location.href
                  navigator.clipboard?.writeText(url).catch(() => {})
                }}
                aria-label="Share this site view — copies link to clipboard"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "var(--text-sm)",
                  fontWeight: 500,
                  color: "var(--text)",
                }}
              >
                Share view
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
