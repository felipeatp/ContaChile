import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { z } from 'zod'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const AGENT_TYPES = ['consultor', 'f22', 'clasificador'] as const

const MessagePayloadSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string(),
})

const ListQuerySchema = z.object({
  agentType: z.enum(AGENT_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

const CreateBodySchema = z.object({
  agentType: z.enum(AGENT_TYPES),
  title: z.string().max(120).optional(),
  messages: z.array(MessagePayloadSchema).min(1).max(200),
})

const PatchBodySchema = z.object({
  messages: z.array(MessagePayloadSchema).min(1).max(200),
  title: z.string().max(120).optional(),
})

// ─── Helper ──────────────────────────────────────────────────────────────────

function deriveTitleFromMessages(messages: z.infer<typeof MessagePayloadSchema>[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) return 'Conversación'
  const words = firstUser.content.trim().split(/\s+/).slice(0, 8)
  const truncated = words.join(' ')
  return truncated.length > 80 ? truncated.slice(0, 80) + '…' : truncated
}

// ─── Route ───────────────────────────────────────────────────────────────────

export default async function conversationsRoute(fastify: FastifyInstance) {
  // GET /ai/conversations — listar conversaciones del usuario en esta empresa
  fastify.get('/ai/conversations', async (request, reply) => {
    const companyId = request.companyId
    const userId = request.userId

    if (!userId) {
      return reply.code(401).send({ error: 'Usuario no autenticado' })
    }

    const parsed = ListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const { agentType, limit, offset } = parsed.data

    const where: Record<string, unknown> = { companyId, userId }
    if (agentType) where.agentType = agentType

    const conversations = await prisma.agentConversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        agentType: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        // No incluir messages en el listado para mantener la respuesta ligera
      },
    })

    const total = await prisma.agentConversation.count({ where })

    return reply.send({ conversations, total, limit, offset })
  })

  // POST /ai/conversations — crear nueva conversación
  fastify.post('/ai/conversations', async (request, reply) => {
    const companyId = request.companyId
    const userId = request.userId

    if (!userId) {
      return reply.code(401).send({ error: 'Usuario no autenticado' })
    }

    const parsed = CreateBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }
    const { agentType, messages } = parsed.data

    const title = parsed.data.title ?? deriveTitleFromMessages(messages)

    const conversation = await prisma.agentConversation.create({
      data: {
        companyId,
        userId,
        agentType,
        title,
        messages,
      },
    })

    return reply.code(201).send(conversation)
  })

  // GET /ai/conversations/:id — obtener conversación con todos los mensajes
  fastify.get('/ai/conversations/:id', async (request, reply) => {
    const companyId = request.companyId
    const userId = request.userId
    const { id } = request.params as { id: string }

    if (!userId) {
      return reply.code(401).send({ error: 'Usuario no autenticado' })
    }

    const conversation = await prisma.agentConversation.findFirst({
      where: { id, companyId, userId },
    })

    if (!conversation) {
      return reply.code(404).send({ error: 'Conversación no encontrada' })
    }

    return reply.send(conversation)
  })

  // PATCH /ai/conversations/:id — actualizar mensajes (append) de una conversación propia
  fastify.patch('/ai/conversations/:id', async (request, reply) => {
    const companyId = request.companyId
    const userId = request.userId
    const { id } = request.params as { id: string }

    if (!userId) {
      return reply.code(401).send({ error: 'Usuario no autenticado' })
    }

    const parsed = PatchBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }

    const existing = await prisma.agentConversation.findFirst({
      where: { id, companyId, userId },
    })

    if (!existing) {
      return reply.code(404).send({ error: 'Conversación no encontrada' })
    }

    const updateData: Record<string, unknown> = {
      messages: parsed.data.messages,
    }
    if (parsed.data.title !== undefined) {
      updateData.title = parsed.data.title
    }

    const updated = await prisma.agentConversation.update({
      where: { id },
      data: updateData,
    })

    return reply.send(updated)
  })

  // DELETE /ai/conversations/:id — eliminar conversación propia
  fastify.delete('/ai/conversations/:id', async (request, reply) => {
    const companyId = request.companyId
    const userId = request.userId
    const { id } = request.params as { id: string }

    if (!userId) {
      return reply.code(401).send({ error: 'Usuario no autenticado' })
    }

    const existing = await prisma.agentConversation.findFirst({
      where: { id, companyId, userId },
    })

    if (!existing) {
      return reply.code(404).send({ error: 'Conversación no encontrada' })
    }

    await prisma.agentConversation.delete({ where: { id } })

    return reply.code(204).send()
  })
}
