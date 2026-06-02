import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 85,
        functions: 90,
        branches: 60,
        statements: 85,
      },
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
})
