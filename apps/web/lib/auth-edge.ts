import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { bearer } from "better-auth/plugins"
import { neon } from "@neondatabase/serverless"
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http"
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { schema } from "./db-schema"
import { sendPasswordResetEmail } from "./email"

// Auth para web. En producción/edge (Cloudflare Workers) usa Drizzle + Neon HTTP
// (Prisma/pg necesitan TCP, no disponible en CF Workers). En desarrollo local el
// driver Neon HTTP no puede hablar con un Postgres estándar, así que se usa el
// driver pg (node-postgres) contra el Postgres local.
// CF secrets set via wrangler on Windows sometimes carry a UTF-8 BOM prefix
// (U+FEFF). Strip it from every env var we read.
const stripBom = (s: string) =>
  s.charCodeAt(0) === 0xfeff ? s.slice(1) : s

const databaseUrl = stripBom(process.env.DATABASE_URL!)

// Selección de driver por host: Neon cloud → HTTP; cualquier otro (localhost) → pg.
const usesNeon = /neon\.tech/i.test(databaseUrl)
const db = usesNeon
  ? drizzleNeon(neon(databaseUrl), { schema })
  : drizzleNode(new Pool({ connectionString: databaseUrl }), { schema })

// En producción se fija baseURL (dominio de CF). En desarrollo se OMITE para que
// Better Auth lo infiera del host del request (localhost o IP de LAN) — así las
// cookies de OAuth y el redirect_uri quedan consistentes con el host real desde el
// que se navega, evitando "state_security_mismatch" al probar desde la LAN.
const isProd = process.env.NODE_ENV === "production"
const baseURL = isProd
  ? stripBom(process.env.BETTER_AUTH_URL || "http://localhost:3000")
  : undefined

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET ? stripBom(process.env.BETTER_AUTH_SECRET) : undefined,
  ...(baseURL ? { baseURL } : {}),
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    ...(baseURL ? [baseURL] : []),
    ...(process.env.WEB_URL ? [stripBom(process.env.WEB_URL)] : []),
    // Origen LAN explícito vía env (p.ej. http://192.168.1.15:3000)
    ...(process.env.LAN_URL ? [stripBom(process.env.LAN_URL)] : []),
    // Dev-only: permitir cualquier IP privada de la LAN para probar en otros
    // dispositivos. Gated a no-producción (en CF Workers NODE_ENV==="production").
    ...(!isProd
      ? ["http://192.168.*:3000", "http://10.*:3000", "http://172.*:3000"]
      : []),
  ],
  plugins: [bearer()],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 3600, // 1 hora
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ to: user.email, url, userName: user.name })
    },
  },
  socialProviders: {
    google: {
      clientId: stripBom(process.env.GOOGLE_CLIENT_ID!),
      clientSecret: stripBom(process.env.GOOGLE_CLIENT_SECRET!),
    },
    ...(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
      ? {
          microsoft: {
            clientId: stripBom(process.env.MICROSOFT_CLIENT_ID),
            clientSecret: stripBom(process.env.MICROSOFT_CLIENT_SECRET),
          },
        }
      : {}),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
})

export type Session = typeof auth.$Infer.Session
