import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // Workspace packages read env at import time and some tests touch a real
    // Postgres; isolate per-file to avoid cross-test client/env leakage.
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/lib/email.ts',
        'src/lib/redis.ts',
        'src/lib/payroll-pdf.ts',
        'src/lib/payroll-exports.ts',
        'src/lib/quote-pdf.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
})
