import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { bearer } from "better-auth/plugins"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { schema } from "./db-schema"

// Edge-compatible auth for Cloudflare Workers.
// Uses Drizzle + Neon HTTP instead of Prisma+pg (Prisma needs TCP, not available in CF Workers).
const stripBom = (s: string) => s.replace(/^﻿/, "")

const sql = neon(stripBom(process.env.DATABASE_URL!))
const db = drizzle(sql, { schema })

const baseURL = stripBom(process.env.BETTER_AUTH_URL || "http://localhost:3000")

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET ? stripBom(process.env.BETTER_AUTH_SECRET) : undefined,
  baseURL,
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    ...(baseURL !== "http://localhost:3000" ? [baseURL] : []),
    ...(process.env.WEB_URL ? [stripBom(process.env.WEB_URL)] : []),
  ],
  plugins: [bearer()],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
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
