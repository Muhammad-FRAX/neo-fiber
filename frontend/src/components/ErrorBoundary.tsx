/**
 * React error boundary.
 * Root boundary in App.jsx catches all render crashes → full-page fallback.
 * Per-route boundaries in /map, /dashboard, /admin so a crash in one tab
 * doesn't blank the whole app.
 *
 * T7 (FE half) — §9 frontend error handling B1
 */

import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface Props {
  children: ReactNode
  /** Render this instead of the default fallback (for per-route boundaries) */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In production this would go to a logging service; for now just console
    console.error("[ErrorBoundary]", error, info.componentStack)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return <ErrorFallback error={this.state.error} onReset={this.handleReset} />
  }
}

interface ErrorFallbackProps {
  error: Error | null
  onReset: () => void
  inline?: boolean
}

export function ErrorFallback({ error, onReset, inline = false }: ErrorFallbackProps) {
  if (inline) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-md border p-3 text-sm"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-muted)",
        }}
      >
        <AlertTriangle size={14} style={{ color: "var(--status-down)", flexShrink: 0 }} />
        <span>Something went wrong.</span>
        <button
          onClick={onReset}
          className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors hover:opacity-80"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        >
          <AlertTriangle size={32} style={{ color: "var(--status-down)" }} />
        </div>
        <div>
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--text)" }}
          >
            Something went wrong
          </h1>
          <p className="mt-2 max-w-sm text-sm" style={{ color: "var(--text-muted)" }}>
            An unexpected error occurred. Reloading the page will usually fix it.
          </p>
          {error?.message && (
            <p
              className="mt-3 rounded-md px-3 py-2 font-mono text-xs"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
            >
              {error.message}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            style={{
              background: "var(--accent-500)",
              color: "#fff",
            }}
          >
            <RefreshCw size={14} />
            Reload page
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-2 rounded px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
