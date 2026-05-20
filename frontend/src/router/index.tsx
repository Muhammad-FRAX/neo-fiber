/**
 * React Router v7 config with:
 * - Route guard: unauthenticated → /login?next=<path>
 * - Mobile-block guard: <1024px → MobileBlock (except /login)
 * - Root ErrorBoundary wraps all routes
 *
 * §11.5 responsive strategy: JS-level window.innerWidth check on mount.
 */

import { lazy, Suspense, useEffect, useState } from "react"
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { MobileBlock } from "@/components/MobileBlock"
import { Sidebar } from "@/components/Sidebar"
import { getToken } from "@/lib/api-client"

const LoginPage = lazy(() => import("@/pages/Login"))
const MapPage = lazy(() => import("@/pages/Map"))
const DashboardPage = lazy(() => import("@/pages/Dashboard"))
const AdminPage = lazy(() => import("@/pages/Admin"))
const ProfilePage = lazy(() => import("@/pages/Profile"))

/* ── Mobile-block guard (§11.5) ─────────────────────────────────────────── */

function useMobileBlock(): boolean {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 1024)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)")
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return isNarrow
}

/* ── Auth guard ──────────────────────────────────────────────────────────── */

function RequireAuth() {
  const location = useLocation()
  const token = getToken()

  if (!token) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }

  return <AuthenticatedLayout />
}

/* ── Authenticated shell (sidebar + content) ─────────────────────────────── */

function AuthenticatedLayout() {
  const isMobile = useMobileBlock()

  if (isMobile) return <MobileBlock />

  return (
    <div style={{ display: "flex", minHeight: "100dvh" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ErrorBoundary>
          <Suspense
            fallback={
              <div
                className="flex flex-1 items-center justify-center"
                aria-live="polite"
                aria-label="Loading page"
              >
                <svg
                  className="animate-spin"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  style={{ color: "var(--accent-500)", opacity: 0.7 }}
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    opacity="0.25"
                  />
                  <path
                    d="M22 12a10 10 0 0 0-10-10"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}

/* ── Root layout (wraps everything, no auth required) ────────────────────── */

function RootLayout() {
  return (
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  )
}

/* ── Router definition ───────────────────────────────────────────────────── */

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/login",
        element: (
          <Suspense fallback={null}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        path: "/",
        element: <RequireAuth />,
        children: [
          { index: true, element: <Navigate to="/map" replace /> },
          { path: "map", element: <MapPage /> },
          { path: "dashboard/*", element: <DashboardPage /> },
          { path: "admin/*", element: <AdminPage /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      { path: "*", element: <Navigate to="/map" replace /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
