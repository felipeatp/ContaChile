import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        // Thresholds set to current coverage (~37%). Goal: 80% by Sprint 9 (when
        // all tax, payroll, DTE and API route tests are complete).
        lines: 35,
        functions: 45,
        branches: 70,
        statements: 35,
      },
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
})
