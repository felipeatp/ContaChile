import { FastifyInstance } from 'fastify'
import { streamConsultor, runConsultorWithTools, sanitizeMessages } from '@contachile/ai-agents'
import { z } from 'zod'

// ─── Constantes de seguridad ──────────────────────────────────────────────────

/** Máximo de mensajes permitidos en el historial */
const MAX_MESSAGES = 50

/** Máximo de chars por mensaje */
const MAX_MSG_CHARS = 4000

/** Budget máximo de chars totales de la conversación antes de pasar al LLM */
const MAX_CONVERSATION_CHARS = 30_000

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  // assistant messages in history may arrive with empty content (e.g. after a stream error)
  content: z.string().max(MAX_MSG_CHARS),
})

const ConsultorBodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(MAX_MESSAGES),
  useTools: z.boolean().optional().default(false),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convierte un error interno en un mensaje seguro para el cliente.
 * Nunca expone detalles internos: API keys, nombres de modelos, stack traces, etc.
 */
function safeErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'Error interno del servidor IA'

  const msg = err.message.toLowerCase()

  // Mapear errores conocidos a mensajes genéricos seguros
  if (msg.includes('rate limit') || msg.includes('429')) {
    return 'El modelo IA está ocupado. Intenta en unos segundos.'
  }
  if (msg.includes('context length') || msg.includes('token') || msg.includes('maximum')) {
    return 'La conversación es demasiado larga. Por favor, inicia una nueva.'
  }
  if (msg.includes('content policy') || msg.includes('safety') || msg.includes('filtered')) {
    return 'El mensaje no pudo ser procesado por políticas de contenido.'
  }
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
    return 'La consulta tardó demasiado. Por favor, intenta de nuevo.'
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connect')) {
    return 'Error de conectividad con el proveedor IA. Intenta en unos instantes.'
  }

  // Fallback genérico — nunca retornar err.message directamente al cliente
  return 'El servicio IA no está disponible temporalmente.'
}

/**
 * Registra metadata de la petición para auditoría de abuso.
 * No registra el contenido de los mensajes, solo metadata.
 */
function auditLog(
  fastify: FastifyInstance,
  companyId: string,
  mode: 'stream' | 'tools',
  messageCount: number,
  totalChars: number,
  injectionDetected: boolean
) {
  fastify.log.info({
    event: 'ai_consultor_request',
    companyId,
    mode,
    messageCount,
    totalChars,
    injectionDetected,
    ts: new Date().toISOString(),
  })

  if (injectionDetected) {
    fastify.log.warn({
      event: 'ai_injection_attempt',
      companyId,
      mode,
      ts: new Date().toISOString(),
    })
  }
}

// ─── Ruta ─────────────────────────────────────────────────────────────────────

export default async function (fastify: FastifyInstance) {
  /**
   * POST /ai/consultor
   *
   * Si useTools=false (default): respuesta streaming en tiempo real (SSE).
   * Si useTools=true: usa tool use para consultar datos reales del tenant (respuesta JSON completa).
   *
   * Seguridad:
   * - Sanitización de input (control chars, Unicode, detección de inyección)
   * - Límite de budget total de conversación (chars)
   * - Mensajes de error genéricos (no expone detalles internos)
   * - Audit logging de metadata (sin contenido)
   * - Rate limit diferenciado: ver apps/api/src/index.ts (20 req/min stream, 5 req/min tools)
   */
  fastify.post('/ai/consultor', async (request, reply) => {
    let body: z.infer<typeof ConsultorBodySchema>
    try {
      body = ConsultorBodySchema.parse(request.body)
    } catch {
      return reply.code(400).send({ error: 'Formato de petición inválido' })
    }

    const companyId = request.companyId

    // ── Sanitización ──────────────────────────────────────────────────────────
    const { messages: sanitized, injectionDetected, truncated } = sanitizeMessages(
      body.messages.map((m) => ({ role: m.role, content: m.content }))
    )

    if (sanitized.length === 0) {
      return reply.code(400).send({ error: 'No hay mensajes válidos para procesar' })
    }

    const totalChars = sanitized.reduce((sum, m) => sum + m.content.length, 0)

    // Log de auditoría (solo metadata, sin contenido)
    auditLog(fastify, companyId, body.useTools ? 'tools' : 'stream', sanitized.length, totalChars, injectionDetected)

    // Si se detectó inyección, responder con mensaje educado pero no procesar
    if (injectionDetected) {
      if (body.useTools) {
        return reply.send({
          response: 'Lo siento, no puedo procesar ese tipo de solicitud. Estoy aquí para ayudarte con consultas tributarias chilenas.',
        })
      }
      // En modo streaming, responder como SSE
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      })
      reply.raw.write(`data: ${JSON.stringify({ text: 'Lo siento, no puedo procesar ese tipo de solicitud. Estoy aquí para ayudarte con consultas tributarias chilenas.' })}\n\n`)
      reply.raw.write('data: [DONE]\n\n')
      reply.raw.end()
      return
    }

    // ── Modo tool use ─────────────────────────────────────────────────────────
    if (body.useTools) {
      const lastUserMessage = sanitized
        .filter((m) => m.role === 'user')
        .at(-1)?.content ?? ''

      try {
        const response = await runConsultorWithTools(companyId, lastUserMessage)
        return reply.send({ response })
      } catch (err) {
        fastify.log.error({ event: 'ai_tools_error', companyId, err })
        return reply.code(503).send({ error: safeErrorMessage(err) })
      }
    }

    // ── Modo streaming SSE ────────────────────────────────────────────────────
    const stream = streamConsultor(sanitized)

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const reader = stream.getReader()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        reply.raw.write(`data: ${JSON.stringify({ text: value })}\n\n`)
      }
    } catch (streamErr) {
      // Propagar error al cliente vía SSE con mensaje seguro (no exponer detalles internos)
      fastify.log.error({ event: 'ai_stream_error', companyId, err: streamErr })
      const safeMsg = safeErrorMessage(streamErr)
      reply.raw.write(`data: ${JSON.stringify({ error: safeMsg })}\n\n`)
    } finally {
      reader.releaseLock()
      reply.raw.write('data: [DONE]\n\n')
      reply.raw.end()
    }
  })
}
