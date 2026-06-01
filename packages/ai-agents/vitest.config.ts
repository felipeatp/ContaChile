import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      // Alias workspace packages to their source or a stub so Vitest can resolve
      // them when they are not built yet. The actual implementations are replaced
      // by vi.mock() in each test file — these aliases only need to exist on disk.
      '@contachile/db': resolve(__dirname, './__mocks__/@contachile/db.ts'),
      '@contachile/validators': resolve(__dirname, './__mocks__/@contachile/validators.ts'),
    },
  },
})
