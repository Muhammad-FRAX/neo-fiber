/**
 * /login — LDAP login form.
 * Centered 360px card, no marketing copy, single purpose.
 * §10 login layout, §11 tokens.
 *
 * After successful login: redirect to ?next= param or /map.
 */

import { type FormEvent, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Eye, EyeOff, Activity } from "lucide-react"
import { apiClient, setToken } from "@/lib/api-client"

interface LoginResponse {
  token: string
}

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await apiClient.post<LoginResponse>("/api/v1/auth/login", {
        username: username.trim(),
        password,
      })
      setToken(res.token)
      const next = searchParams.get("next") ?? "/map"
      navigate(next, { replace: true })
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "An unexpected error occurred"
      if (msg.includes("UNAUTHENTICATED") || msg.toLowerCase().includes("invalid")) {
        setError("Invalid credentials. Please check your username and password.")
      } else if (msg.includes("LDAP") || msg.toLowerCase().includes("ldap")) {
        setError("LDAP is unreachable. Contact your system administrator.")
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="main"
      className="flex min-h-screen flex-col items-center justify-center p-6"
      style={{ background: "var(--bg)" }}
    >
      {/* Skip link target */}
      <a href="#login-form" className="skip-link">
        Skip to login form
      </a>

      <div
        id="login-form"
        className="fade-slide-in"
        style={{
          width: "100%",
          maxWidth: 360,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "32px 28px",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Logo + product name */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "var(--accent-500)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-hidden="true"
          >
            <Activity size={20} color="#fff" />
          </div>
          <div className="text-center">
            <h1
              className="text-md font-semibold"
              style={{ color: "var(--text)" }}
            >
              Neo-Fiber
            </h1>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
              Network Operations Dashboard
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-4">
            {/* Username field */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="username"
                className="text-sm font-medium"
                style={{ color: "var(--text)" }}
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="jdoe@sd.zain.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                aria-describedby={error ? "login-error" : undefined}
                className="input-field"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "var(--bg)",
                  color: "var(--text)",
                  fontSize: "var(--text-base)",
                }}
              />
            </div>

            {/* Password field */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium"
                style={{ color: "var(--text)" }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  aria-describedby={error ? "login-error" : undefined}
                  className="input-field"
                  style={{
                    width: "100%",
                    padding: "8px 40px 8px 12px",
                    borderRadius: 6,
                    background: "var(--bg)",
                    color: "var(--text)",
                    fontSize: "var(--text-base)",
                  }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    padding: 0,
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <p
                id="login-error"
                role="alert"
                className="rounded-md px-3 py-2 text-sm"
                style={{
                  background: "color-mix(in srgb, var(--status-down) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--status-down) 25%, transparent)",
                  color: "var(--status-down)",
                }}
              >
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="flex w-full items-center justify-center gap-2 rounded px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: "var(--accent-500)",
                color: "#fff",
                border: "none",
                cursor: loading ? "wait" : "pointer",
                marginTop: 4,
              }}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray="31.4"
                      strokeDashoffset="10"
                    />
                  </svg>
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs" style={{ color: "var(--text-muted)" }}>
        v1.0 · Zain Sudan internal
      </p>
    </div>
  )
}
