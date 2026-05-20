/**
 * /profile — theme toggle + saved views (Phase 11).
 * For now: shows theme switcher using the UI store.
 */

import { User, Sun, Moon } from "lucide-react"
import { useUiStore } from "@/store/ui"

export default function ProfilePage() {
  const { theme, toggleTheme } = useUiStore()

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col p-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="flex items-center gap-3 mb-8">
        <User size={24} aria-hidden="true" />
        <h1 className="text-lg font-semibold">Profile</h1>
      </div>

      <section>
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-muted)" }}>
          Appearance
        </h2>
        <div
          className="flex items-center justify-between rounded-md p-4"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            maxWidth: 400,
          }}
        >
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {theme === "dark" ? "Dark" : "Light"} mode active
            </p>
          </div>
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </section>
    </main>
  )
}
