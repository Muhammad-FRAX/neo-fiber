import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    testTimeout: 120_000, // generous for testcontainers startup
    hookTimeout: 120_000,
    isolate: true,
  },
});
