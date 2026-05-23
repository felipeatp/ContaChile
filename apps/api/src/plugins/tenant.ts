import fp from 'fastify-plugin'
import { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { auth } from '@contachile/auth'
import { prisma } from '@contachile/db'
import { fromNodeHeaders } from 'better-auth/node'

declare module 'fastify' {
  interface FastifyRequest {
    companyId: string
    userId?: string
  }
}

/**
 * Ensures the user has at least one Company + CompanyMembership.
 * If not, creates them silently using the user's ID as the company ID
 * (preserving backward compatibility with existing data).
 */
async function ensureMembership(userId: string, userEmail: string, userName?: string | null) {
  const memberships = await prisma.companyMembership.findMany({
    where: { userId },
    select: { companyId: true, role: true },
    orderBy: { createdAt: 'asc' },
  })

  if (memberships.length > 0) {
    return memberships
  }

  // Migración silenciosa: crear Company + Membership para usuarios legacy
  const companyId = userId // preserva compatibilidad con datos existentes
  const safeRut = `76.${userId.slice(0, 3)}.${userId.slice(3, 6)}-${userId.slice(6, 7) || 'K'}`
  try {
    await prisma.company.upsert({
      where: { id: companyId },
      update: {},
      create: {
        id: companyId,
        rut: safeRut,
        name: userName || userEmail.split('@')[0] || 'Empresa',
      },
    })
  } catch (err: any) {
    // Si falla por RUT duplicado, buscar la company existente y reusarla
    if (err.code === 'P2002') {
      const existing = await prisma.company.findUnique({ where: { id: companyId } })
      if (!existing) {
        // Buscar por RUT y crear membership ahí
        const byRut = await prisma.company.findFirst({ where: { rut: safeRut } })
        if (byRut) {
          await prisma.companyMembership.create({
            data: { userId, companyId: byRut.id, role: 'owner' },
          })
          return [{ companyId: byRut.id, role: 'owner' }]
        }
      }
    }
    throw err
  }

  await prisma.companyMembership.create({
    data: {
      userId,
      companyId,
      role: 'owner',
    },
  })

  return [{ companyId, role: 'owner' }]
}

const tenantPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request, reply) => {
    // Rutas públicas (API Key) se manejan en su propio plugin
    if (request.url.startsWith('/public')) return
    if (request.url === '/health') return

    // 1. Intentar obtener sesión de Better Auth
    let userId: string | null = null
    let userEmail = ''
    let userName: string | null = null

    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      })
      if (session?.user) {
        userId = session.user.id
        userEmail = session.user.email
        userName = session.user.name
      }
    } catch (err) {
      fastify.log.warn({ err }, 'Better Auth session validation failed')
    }

    // 2. Bypass de desarrollo
    if (!userId && process.env.DEV_BYPASS_AUTH === 'true') {
      request.companyId = 'dev-test-company'
      return
    }

    // 3. Sin sesión → rechazar (o fallback x-company-id en dev)
    if (!userId) {
      if (process.env.NODE_ENV === 'production') {
        return reply.code(401).send({ error: 'Missing authentication' })
      }
      const companyId = request.headers['x-company-id'] as string
      if (!companyId) {
        return reply.code(401).send({ error: 'Missing authentication' })
      }
      request.companyId = companyId
      return
    }

    // 4. Buscar/crear memberships del usuario
    const memberships = await ensureMembership(userId, userEmail, userName)

    // Guardar userId para uso en rutas
    request.userId = userId

    // 5. Un solo membership → usar esa empresa
    if (memberships.length === 1) {
      request.companyId = memberships[0].companyId
      return
    }

    // 6. Múltiples memberships → leer empresa activa del header
    const activeCompanyId = request.headers['x-active-company-id'] as string
    const valid = memberships.find((m) => m.companyId === activeCompanyId)

    if (valid) {
      request.companyId = activeCompanyId
    } else {
      // Fallback a la primera empresa
      request.companyId = memberships[0].companyId
    }
  })
}

export default fp(tenantPlugin)
