import { FastifyInstance } from 'fastify'
import { streamF22Assistant, type AgentEvent } from '@contachile/ai-agents'
import { z } from 'zod'

const BodySchema = z.object({
  year: z.number().int().min(2020).max(new Date().getFullYear() + 1).optional(),
  message: z.string().max(500).optional(),
})

function safeErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'Error interno del análisis F22'
  const msg = err.message.toLowerCase()
  if (msg.includes('rate limit') || msg.includes('429')) return 'El modelo IA está ocupado. Intenta en unos segundos.'
  if (msg.includes('context length') || msg.includes('token') || msg.includes('maximum')) return 'La consulta es demasiado larga. Intenta con un período más corto.'
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) return 'La consulta tardó demasiado. Por favor, intenta de nuevo.'
  return 'El análisis F22 no está disponible temporalmente.'
}

export default async function (fastify: FastifyInstance) {
  fastify.post('/ai/f22', async (request, reply) => {
    let body: z.infer<typeof BodySchema>
    try {
      body = BodySchema.parse(request.body)
    } catch {
      return reply.code(400).send({ error: 'Formato de petición inválido' })
    }

    const companyId = request.companyId
    const year = body.year ?? new Date().getFullYear()
    const userMessage = body.message ?? 'Dame un análisis completo de mi F22.'

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    // Heartbeat para forzar flush de headers antes de iniciar el stream.
    reply.raw.write(': ok\n\n')

    let stream: ReadableStream<AgentEvent>
    try {
      stream = streamF22Assistant(companyId, userMessage, year)
    } catch (err) {
      fastify.log.error({ event: 'f22_stream_init_error', companyId, err })
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
        // Todos los eventos usan `kind` (contrato AgentEvent de base-agent.ts).
        // El frontend parsea { text } para texto y { tool, status } para tools.
        if (value.kind === 'text') {
          reply.raw.write(`data: ${JSON.stringify({ text: value.value })}\n\n`)
        } else if (value.kind === 'tool') {
          reply.raw.write(`data: ${JSON.stringify({ tool: value.name, status: value.status })}\n\n`)
        }
      }
    } catch (streamErr) {
      fastify.log.error({ event: 'f22_stream_error', companyId, err: streamErr })
      reply.raw.write(`data: ${JSON.stringify({ error: safeErrorMessage(streamErr) })}\n\n`)
    } finally {
      reader.releaseLock()
      reply.raw.write('data: [DONE]\n\n')
      reply.raw.end()
    }
  })
}
