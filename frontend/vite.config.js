import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000',
      '/tiles': 'http://localhost:5000',
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  // maplibre-gl v5 is pure ESM — let Vite pre-bundle it normally.
  // The old `exclude` workaround was for v2/v3 CJS interop; v5 breaks with it.
  optimizeDeps: {
    include: ['maplibre-gl'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
