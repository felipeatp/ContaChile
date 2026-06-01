/**
 * Vitest global setup.
 *
 * Loads the local .env so workspace packages that read process.env at
 * import time (notably @contachile/db, which throws if DATABASE_URL is
 * unset) can be imported even by tests that do not mock them.
 *
 * Tests that mock @contachile/db never touch the real client; this only
 * guards the import-time evaluation of unmocked modules.
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(__dirname, '.env') })

// Fallbacks so the suite runs even without a local .env (e.g. CI).
process.env.DATABASE_URL ??=
  'postgresql://contachile:contachile@localhost:5432/contachile'
process.env.BETTER_AUTH_SECRET ??= 'test-secret-not-used-in-assertions'
