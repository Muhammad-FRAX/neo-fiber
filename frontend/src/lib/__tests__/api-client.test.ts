/**
 * Tests for api-client: token management and 401 redirect behaviour.
 * T4 (FE half) — §9 auth spec, A4 decision.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearToken, getToken, setToken } from "../api-client"

const TOKEN_KEY = "nf_token"

describe("token management", () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it("getToken returns null when not set", () => {
    expect(getToken()).toBeNull()
  })

  it("setToken stores the token in localStorage", () => {
    setToken("abc.123.xyz")
    expect(localStorage.getItem(TOKEN_KEY)).toBe("abc.123.xyz")
  })

  it("getToken retrieves the stored token", () => {
    localStorage.setItem(TOKEN_KEY, "my.token.here")
    expect(getToken()).toBe("my.token.here")
  })

  it("clearToken removes the token", () => {
    setToken("to.be.removed")
    clearToken()
    expect(getToken()).toBeNull()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})

describe("api-client fetch wrapper", () => {
  const originalFetch = globalThis.fetch
  const originalLocation = window.location

  beforeEach(() => {
    localStorage.clear()
    // Mock window.location.href
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "http://localhost:3000/map", pathname: "/map" },
      writable: true,
    })
  })

  afterEach(() => {
    localStorage.clear()
    globalThis.fetch = originalFetch
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    })
  })

  it("attaches Authorization header when token is present", async () => {
    setToken("test.jwt.token")
    let capturedHeaders: Record<string, string> = {}

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: "ok" }),
    })

    const { apiClient } = await import("../api-client")
    await apiClient.get("/api/v1/sites")

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    capturedHeaders = call[1]?.headers as Record<string, string>
    expect(capturedHeaders["Authorization"]).toBe("Bearer test.jwt.token")
  })

  it("does not attach Authorization header when no token", async () => {
    clearToken()

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: "ok" }),
    })

    const { apiClient } = await import("../api-client")
    await apiClient.get("/api/v1/health")

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const headers = call[1]?.headers as Record<string, string>
    expect(headers["Authorization"]).toBeUndefined()
  })

  it("on 401: clears token and redirects to /login?next=<path>", async () => {
    setToken("expired.jwt.token")

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    })

    const { apiClient } = await import("../api-client")

    // The redirect throws because it calls window.location.href = ...
    await expect(apiClient.get("/api/v1/sites")).rejects.toThrow()

    expect(getToken()).toBeNull()
    expect(window.location.href).toContain("/login?next=")
  })
})
