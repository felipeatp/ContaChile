import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // Workspace packages read env at import time and some tests touch a real
    // Postgres; isolate per-file to avoid cross-test client/env leakage.
    environment: 'node',
  },
})
