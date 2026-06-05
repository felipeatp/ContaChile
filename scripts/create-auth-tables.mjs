// Crea las tablas de Better Auth (web/drizzle): user, session, account, verification.
// Selecciona el driver por host: Neon cloud → HTTP; cualquier otro (localhost) → pg.
// DATABASE_URL se toma de env; si no está, se lee de apps/web/.dev.vars.
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

// Resolver drivers desde apps/web/node_modules (pg / @neondatabase/serverless
// viven ahí, no en la raíz del monorepo).
const webRequire = createRequire(pathToFileURL(resolve("apps/web/package.json")).href)

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  for (const p of ["apps/web/.dev.vars", "apps/api/.env"]) {
    try {
      const m = readFileSync(p, "utf8").match(/^DATABASE_URL=(.*)$/m)
      if (m) return m[1].trim()
    } catch {
      // siguiente
    }
  }
  throw new Error("DATABASE_URL no definido (env ni .dev.vars)")
}

const databaseUrl = resolveDatabaseUrl()
const usesNeon = /neon\.tech/i.test(databaseUrl)

const STATEMENTS = [
  [
    "user",
    `CREATE TABLE IF NOT EXISTS "user" (
      "id"            text PRIMARY KEY,
      "name"          text NOT NULL,
      "email"         text NOT NULL UNIQUE,
      "emailVerified" boolean NOT NULL DEFAULT false,
      "image"         text,
      "createdAt"     timestamp NOT NULL DEFAULT now(),
      "updatedAt"     timestamp NOT NULL DEFAULT now()
    )`,
  ],
  [
    "session",
    `CREATE TABLE IF NOT EXISTS "session" (
      "id"         text PRIMARY KEY,
      "expiresAt"  timestamp NOT NULL,
      "token"      text NOT NULL UNIQUE,
      "createdAt"  timestamp NOT NULL DEFAULT now(),
      "updatedAt"  timestamp NOT NULL DEFAULT now(),
      "ipAddress"  text,
      "userAgent"  text,
      "userId"     text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
    )`,
  ],
  [
    "account",
    `CREATE TABLE IF NOT EXISTS "account" (
      "id"                     text PRIMARY KEY,
      "accountId"              text NOT NULL,
      "providerId"             text NOT NULL,
      "userId"                 text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "accessToken"            text,
      "refreshToken"           text,
      "idToken"                text,
      "accessTokenExpiresAt"   timestamp,
      "refreshTokenExpiresAt"  timestamp,
      "scope"                  text,
      "password"               text,
      "createdAt"              timestamp NOT NULL DEFAULT now(),
      "updatedAt"              timestamp NOT NULL DEFAULT now()
    )`,
  ],
  [
    "verification",
    `CREATE TABLE IF NOT EXISTS "verification" (
      "id"         text PRIMARY KEY,
      "identifier" text NOT NULL,
      "value"      text NOT NULL,
      "expiresAt"  timestamp NOT NULL,
      "createdAt"  timestamp,
      "updatedAt"  timestamp
    )`,
  ],
]

if (usesNeon) {
  const { neon } = webRequire("@neondatabase/serverless")
  const sql = neon(databaseUrl)
  for (const [name, ddl] of STATEMENTS) {
    await sql(ddl)
    console.log(`✓ ${name}`)
  }
} else {
  const pg = webRequire("pg")
  const pool = new pg.Pool({ connectionString: databaseUrl })
  for (const [name, ddl] of STATEMENTS) {
    await pool.query(ddl)
    console.log(`✓ ${name}`)
  }
  await pool.end()
}

console.log("\nAll Better Auth tables created successfully.")
