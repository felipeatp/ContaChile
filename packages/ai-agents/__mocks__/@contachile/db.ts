// Stub for @contachile/db — replaced by vi.mock() in tests.
// This file only needs to exist so that Vitest/Vite can resolve the alias.
export const prisma = {
  document: {
    findMany: () => Promise.resolve([]),
    aggregate: () => Promise.resolve({ _sum: { totalAmount: null } }),
  },
  purchase: {
    findMany: () => Promise.resolve([]),
    aggregate: () => Promise.resolve({ _sum: { totalAmount: null } }),
  },
}
