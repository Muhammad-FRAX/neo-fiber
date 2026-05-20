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
  // maplibre-gl uses workers — exclude from dep optimizer to avoid
  // "cannot use import.meta.url in CJS bundle" errors.
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
