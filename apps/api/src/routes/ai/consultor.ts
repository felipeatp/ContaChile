import { FastifyInstance } from 'fastify'
import {
  streamConsultorWithContext,
  sanitizeMessages,
  type AgentEvent,
} from '@contachile/ai-agents'
import { z } from 'zod'

// ─── Constantes de seguridad ──────────────────────────────────────────────────

const MAX_MESSAGES = 50
const MAX_MSG_CHARS = 4000

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(MAX_MSG_CHARS),
})

const ConsultorBodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(MAX_MESSAGES),
  // useTools queda como flag legacy ignorado; ahora siempre streaming-con-tools.
  useTools: z.boolean().optional(),
})

function safeErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'Error interno del servidor IA'
  const msg = err.message.toLowerCase()
  if (msg.includes('rate limit') || msg.includes('429')) return 'El modelo IA está ocupado. Intenta en unos segundos.'
  if (msg.includes('context length') || msg.includes('token') || msg.includes('maximum')) return 'La conversación es demasiado larga. Por favor, inicia una nueva.'
  if (msg.includes('content policy') || msg.includes('safety') || msg.includes('filtered')) return 'El mensaje no pudo ser procesado por políticas de contenido.'
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) return 'La consulta tardó demasiado. Por favor, intenta de nuevo.'
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connect')) return 'Error de conectividad con el proveedor IA. Intenta en unos instantes.'
  return 'El servicio IA no está disponible temporalmente.'
}

function auditLog(
  fastify: FastifyInstance,
  companyId: string,
  messageCount: number,
  totalChars: number,
  injectionDetected: boolean
) {
  fastify.log.info({
    event: 'ai_consultor_request',
    companyId,
    messageCount,
    totalChars,
    injectionDetected,
    ts: new Date().toISOString(),
  })
  if (injectionDetected) {
    fastify.log.warn({
      event: 'ai_injection_attempt',
      companyId,
      ts: new Date().toISOString(),
    })
  }
}

export default async function (fastify: FastifyInstance) {
  fastify.post('/ai/consultor', async (request, reply) => {
    let body: z.infer<typeof ConsultorBodySchema>
    try {
      body = ConsultorBodySchema.parse(request.body)
    } catch {
      return reply.code(400).send({ error: 'Formato de petición inválido' })
    }

    const companyId = request.companyId

    const { messages: sanitized, injectionDetected } = sanitizeMessages(
      body.messages.map(m => ({ role: m.role, content: m.content }))
    )

    if (sanitized.length === 0) {
      return reply.code(400).send({ error: 'No hay mensajes válidos para procesar' })
    }

    const totalChars = sanitized.reduce((sum, m) => sum + m.content.length, 0)
    auditLog(fastify, companyId, sanitized.length, totalChars, injectionDetected)

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    // Heartbeat para forzar flush de headers antes del snapshot (que puede
    // tomar 50-200ms de queries). Algunos proxies cierran conexiones sin
    // primer byte rápido. Comment-only SSE (:) — el cliente lo ignora.
    reply.raw.write(': ok\n\n')

    if (injectionDetected) {
      reply.raw.write(`data: ${JSON.stringify({ text: 'Lo siento, no puedo procesar ese tipo de solicitud. Estoy aquí para ayudarte con consultas tributarias chilenas.' })}\n\n`)
      reply.raw.write('data: [DONE]\n\n')
      reply.raw.end()
      return
    }

    let stream: ReadableStream<AgentEvent>
    try {
      stream = await streamConsultorWithContext(companyId, sanitized)
    } catch (err) {
      fastify.log.error({ event: 'ai_stream_init_error', companyId, err })
      reply.raw.write(`data: ${JSON.stringify({ error: safeErrorMessage(err) })}\n\n`)
      reply.raw.write('data: [DONE]\n\n')
      reply.raw.end()
      return
    }

    const reader = stream.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value.kind === 'text') {
          reply.raw.write(`data: ${JSON.stringify({ text: value.value })}\n\n`)
        } else if (value.kind === 'tool') {
          reply.raw.write(`data: ${JSON.stringify({ tool: value.name, status: value.status })}\n\n`)
        }
      }
    } catch (streamErr) {
      fastify.log.error({ event: 'ai_stream_error', companyId, err: streamErr })
      reply.raw.write(`data: ${JSON.stringify({ error: safeErrorMessage(streamErr) })}\n\n`)
    } finally {
      reader.releaseLock()
      reply.raw.write('data: [DONE]\n\n')
      reply.raw.end()
    }
  })
}
