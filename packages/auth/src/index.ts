import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { bearer } from "better-auth/plugins"
import { prisma } from "@contachile/db"

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    ...(process.env.WEB_URL ? [process.env.WEB_URL] : []),
    // Origen LAN explícito vía env (p.ej. http://192.168.1.15:3000)
    ...(process.env.LAN_URL ? [process.env.LAN_URL] : []),
    // Dev-only: permitir IPs privadas de la LAN para probar en otros dispositivos.
    ...(process.env.NODE_ENV !== "production"
      ? [
          "http://192.168.*:3000",
          "http://192.168.*:3001",
          "http://10.*:3000",
          "http://10.*:3001",
          "http://172.*:3000",
          "http://172.*:3001",
        ]
      : []),
  ],
  plugins: [bearer()],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    ...(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
      ? {
          microsoft: {
            clientId: process.env.MICROSOFT_CLIENT_ID,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
          },
        }
      : {}),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 días
    updateAge: 60 * 60 * 24, // 1 día
  },
})

export type Session = typeof auth.$Infer.Session

export { encryptCertPassword, decryptCertPassword } from './cert-cipher'
