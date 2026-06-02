import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
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
