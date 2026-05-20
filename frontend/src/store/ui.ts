/**
 * Zustand store for ephemeral UI state.
 * Theme + sidebar collapsed state live here (not in URL — they're device preferences).
 * Theme preference persisted in localStorage; dark is default on first run (§11 / P7-3C).
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Theme = "dark" | "light"

interface UiState {
  theme: Theme
  sidebarExpanded: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setSidebarExpanded: (expanded: boolean) => void
  toggleSidebar: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "dark", // dark is default (NOC-friendly, P7-3C)
      sidebarExpanded: false, // collapsed to 64px by default (§10)
      setTheme: (theme) => {
        set({ theme })
        document.documentElement.setAttribute("data-theme", theme)
      },
      toggleTheme: () => {
        const next: Theme = get().theme === "dark" ? "light" : "dark"
        get().setTheme(next)
      },
      setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),
      toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
    }),
    {
      name: "nf_ui",
      onRehydrateStorage: () => (state) => {
        // Apply persisted theme to DOM on hydration
        if (state?.theme) {
          document.documentElement.setAttribute("data-theme", state.theme)
        }
      },
    },
  ),
)
