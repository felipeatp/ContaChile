import { FastifyInstance } from 'fastify'
import { createHmac, randomBytes } from 'crypto'
import { prisma } from '@contachile/db'

const SECRET = process.env.BETTER_AUTH_SECRET || process.env.INVITATION_SECRET || 'fallback-secret-change-me'
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 días

function createToken(companyId: string, inviterId: string): string {
  const nonce = randomBytes(8).toString('hex')
  const payload = JSON.stringify({ companyId, inviterId, nonce, exp: Date.now() + EXPIRY_MS })
  const signature = createHmac('sha256', SECRET).update(payload).digest('hex')
  return `${Buffer.from(payload).toString('base64url')}.${signature}`
}

function verifyToken(token: string): { companyId: string; inviterId: string } | null {
  const dot = token.indexOf('.')
  if (dot === -1) return null
  const payloadB64 = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  const payload = Buffer.from(payloadB64, 'base64url').toString()
  const expectedSig = createHmac('sha256', SECRET).update(payload).digest('hex')
  if (signature !== expectedSig) return null
  try {
    const data = JSON.parse(payload)
    if (data.exp < Date.now()) return null
    return { companyId: data.companyId, inviterId: data.inviterId }
  } catch {
    return null
  }
}

export default async function (fastify: FastifyInstance) {
  // POST /invitations — genera un link de invitación
  fastify.post('/invitations', async (request, reply) => {
    const userId = request.userId
    const companyId = request.companyId
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' })

    const body = request.body as { email?: string }

    // Verificar que el usuario es owner de la empresa
    const membership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId, companyId } },
    })
    if (!membership || membership.role !== 'owner') {
      return reply.code(403).send({ error: 'Solo el owner puede invitar' })
    }

    const token = createToken(companyId, userId)
    const inviteUrl = `${process.env.WEB_URL || 'http://localhost:3000'}/invitacion/${token}`

    return reply.send({ token, inviteUrl, companyId })
  })

  // GET /invitations/:token — verifica un token (preview)
  fastify.get('/invitations/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    const data = verifyToken(token)
    if (!data) return reply.code(400).send({ error: 'Invitación inválida o expirada' })

    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
      select: { id: true, name: true, rut: true },
    })
    if (!company) return reply.code(404).send({ error: 'Empresa no encontrada' })

    return reply.send({ valid: true, company, expiresIn: '7 días' })
  })

  // POST /invitations/:token/accept — acepta la invitación
  fastify.post('/invitations/:token/accept', async (request, reply) => {
    const { token } = request.params as { token: string }
    const userId = request.userId
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' })

    const data = verifyToken(token)
    if (!data) return reply.code(400).send({ error: 'Invitación inválida o expirada' })

    // Verificar que la empresa existe
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
    })
    if (!company) return reply.code(404).send({ error: 'Empresa no encontrada' })

    // Verificar que el usuario no sea ya miembro
    const existing = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId, companyId: data.companyId } },
    })
    if (existing) {
      return reply.code(409).send({ error: 'Ya eres miembro de esta empresa' })
    }

    // Crear membership como ACCOUNTANT
    await prisma.companyMembership.create({
      data: {
        userId,
        companyId: data.companyId,
        role: 'ACCOUNTANT',
      },
    })

    return reply.send({ success: true, companyId: data.companyId, role: 'ACCOUNTANT' })
  })
}
