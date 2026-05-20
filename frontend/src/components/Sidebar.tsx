/**
 * Collapsible sidebar chrome.
 * 64px (icon-only) by default; expands to 240px on click.
 * Persistent on all authenticated routes.
 * Always dark-surfaced (slate-900 in light theme, slate-950 in dark) — §10.
 *
 * A11y: nav aria-label="Primary", each item has aria-label (§11.5).
 */

import { useEffect } from "react"
import { NavLink, useLocation } from "react-router-dom"
import {
  Map,
  LayoutDashboard,
  Settings,
  User,
  LogOut,
  ChevronRight,
  Activity,
} from "lucide-react"
import { useUiStore } from "@/store/ui"
import { clearToken } from "@/lib/api-client"

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  end?: boolean
  requiresAdmin?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: "/map", icon: <Map size={20} />, label: "Map", end: true },
  { to: "/dashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
  { to: "/admin", icon: <Settings size={20} />, label: "Admin", requiresAdmin: true },
  { to: "/profile", icon: <User size={20} />, label: "Profile" },
]

interface SidebarProps {
  isAdmin?: boolean
}

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const { sidebarExpanded, toggleSidebar, setSidebarExpanded } = useUiStore()
  const location = useLocation()

  // Collapse sidebar on route change on narrow viewports
  useEffect(() => {
    if (window.innerWidth < 1440) {
      setSidebarExpanded(false)
    }
  }, [location.pathname, setSidebarExpanded])

  const handleLogout = () => {
    clearToken()
    window.location.href = "/login"
  }

  const width = sidebarExpanded ? 240 : 64

  return (
    <nav
      aria-label="Primary"
      style={{
        width,
        minWidth: width,
        background: "var(--sidebar-bg)",
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        position: "sticky",
        top: 0,
        transition: `width var(--duration-200) var(--ease-default)`,
        overflow: "hidden",
        zIndex: "var(--z-overlay)",
        flexShrink: 0,
      }}
    >
      {/* Logo / brand */}
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "var(--accent-500)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <Activity size={14} color="#fff" />
        </div>
        {sidebarExpanded && (
          <span
            style={{
              color: "var(--sidebar-text)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              whiteSpace: "nowrap",
              opacity: sidebarExpanded ? 1 : 0,
              transition: `opacity var(--duration-150) var(--ease-default)`,
            }}
          >
            Neo-Fiber
          </span>
        )}
      </div>

      {/* Nav items */}
      <ul
        role="list"
        style={{
          flex: 1,
          padding: "8px 0",
          margin: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {NAV_ITEMS.filter((item) => !item.requiresAdmin || isAdmin).map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              aria-label={item.label}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 20px",
                borderRadius: 6,
                margin: "0 8px",
                textDecoration: "none",
                color: isActive ? "#fff" : "var(--sidebar-text)",
                background: isActive
                  ? "color-mix(in srgb, var(--sidebar-active) 20%, transparent)"
                  : "transparent",
                transition: `background var(--duration-75) var(--ease-default), color var(--duration-75) var(--ease-default)`,
                position: "relative",
              })}
            >
              {({ isActive }) => (
                <>
                  {/* Active indicator bar */}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: -8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 3,
                        height: 20,
                        borderRadius: "0 2px 2px 0",
                        background: "var(--sidebar-active)",
                      }}
                    />
                  )}
                  <span
                    style={{
                      color: isActive ? "var(--sidebar-active)" : "var(--sidebar-text)",
                      flexShrink: 0,
                      display: "flex",
                    }}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  {sidebarExpanded && (
                    <span
                      style={{
                        fontSize: "var(--text-sm)",
                        fontWeight: isActive ? 600 : 500,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Bottom: logout + collapse toggle */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "8px 0",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <button
          onClick={handleLogout}
          aria-label="Sign out"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 20px",
            borderRadius: 6,
            margin: "0 8px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--sidebar-text)",
            transition: `color var(--duration-75) var(--ease-default)`,
            width: "calc(100% - 16px)",
            textAlign: "left",
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = "#fff"
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = "var(--sidebar-text)"
          }}
        >
          <LogOut size={20} style={{ flexShrink: 0 }} aria-hidden="true" />
          {sidebarExpanded && (
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 500, whiteSpace: "nowrap" }}>
              Sign out
            </span>
          )}
        </button>

        {/* Expand/collapse toggle */}
        <button
          onClick={toggleSidebar}
          aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={sidebarExpanded}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: sidebarExpanded ? "flex-end" : "center",
            padding: "10px 20px",
            borderRadius: 6,
            margin: "0 8px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--sidebar-text)",
            transition: `color var(--duration-75) var(--ease-default)`,
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = "#fff"
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = "var(--sidebar-text)"
          }}
        >
          <ChevronRight
            size={16}
            aria-hidden="true"
            style={{
              transform: sidebarExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: `transform var(--duration-200) var(--ease-default)`,
            }}
          />
        </button>
      </div>
    </nav>
  )
}
