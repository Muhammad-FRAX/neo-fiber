/**
 * EventSource wrapper for SSE streams.
 * - Attaches token as query param (EventSource doesn't support custom headers)
 * - On `event: reauth` from server: clears token and redirects to /login
 * - Exposes connect / disconnect lifecycle
 *
 * T4 (FE half) — §9 SSE resilience baseline A6, auth expiry A4
 */

import { clearToken, getToken } from "./api-client"

export type StreamEventHandler = (data: unknown) => void

export interface StreamHandlers {
  onAlarm?: StreamEventHandler
  onTopology?: StreamEventHandler
  onError?: (error: Event) => void
  onReconnect?: () => void
}

export class EventStream {
  private es: EventSource | null = null
  private url: string
  private handlers: StreamHandlers
  private aborted = false

  constructor(path: string, handlers: StreamHandlers = {}) {
    const token = getToken()
    const url = token ? `${path}?token=${encodeURIComponent(token)}` : path
    this.url = url
    this.handlers = handlers
  }

  connect(): void {
    if (this.aborted) return

    this.es = new EventSource(this.url)

    this.es.addEventListener("alarm", (e: MessageEvent) => {
      try {
        this.handlers.onAlarm?.(JSON.parse(e.data))
      } catch {
        // malformed event — ignore
      }
    })

    this.es.addEventListener("topology", (e: MessageEvent) => {
      try {
        this.handlers.onTopology?.(JSON.parse(e.data))
      } catch {
        // malformed event — ignore
      }
    })

    // Server signals token expiry (§9 SSE auth)
    this.es.addEventListener("reauth", () => {
      this.disconnect()
      clearToken()
      const next = encodeURIComponent(window.location.pathname)
      window.location.href = `/login?next=${next}`
    })

    this.es.onerror = (e) => {
      this.handlers.onError?.(e)
    }
  }

  disconnect(): void {
    this.aborted = true
    this.es?.close()
    this.es = null
  }

  get readyState(): number {
    return this.es?.readyState ?? EventSource.CLOSED
  }
}

export function createAlarmStream(handlers: StreamHandlers): EventStream {
  return new EventStream("/api/v1/stream/alarms", handlers)
}

export function createTopologyStream(handlers: StreamHandlers): EventStream {
  return new EventStream("/api/v1/stream/topology", handlers)
}
