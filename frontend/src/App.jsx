/**
 * App root — wires React Query, nuqs URL state adapter, and the router.
 * Theme is applied to document root by the UI store on hydration.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react-router/v7"
import { useEffect } from "react"
import { AppRouter } from "./router/index.tsx"
import { useUiStore } from "./store/ui.ts"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Don't retry on auth errors
        if (error?.status === 401 || error?.status === 403) return false
        return failureCount < 2
      },
    },
  },
})

function ThemeProvider({ children }) {
  const theme = useUiStore((s) => s.theme)
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
  }, [theme])
  return children
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <ThemeProvider>
          <AppRouter />
        </ThemeProvider>
      </NuqsAdapter>
    </QueryClientProvider>
  )
}
