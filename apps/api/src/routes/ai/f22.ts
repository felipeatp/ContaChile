import { FastifyInstance } from 'fastify'
import { streamF22Assistant, type AgentEvent } from '@contachile/ai-agents'
import { z } from 'zod'

const BodySchema = z.object({
  year: z.number().int().min(2020).max(new Date().getFullYear() + 1).optional(),
  message: z.string().max(500).optional(),
})

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

    const send = (event: string, data: string) => {
      reply.raw.write(`event: ${event}\ndata: ${data}\n\n`)
    }

    try {
      for await (const event of streamF22Assistant(companyId, userMessage, year)) {
        const e = event as AgentEvent
        if (e.type === 'text_delta') {
          send('delta', JSON.stringify({ text: e.text }))
        } else if (e.type === 'tool_start') {
          send('tool_start', JSON.stringify({ tool: e.toolName }))
        } else if (e.type === 'tool_result') {
          send('tool_result', JSON.stringify({ tool: e.toolName }))
        } else if (e.type === 'done') {
          send('done', JSON.stringify({ text: e.fullText }))
        }
      }
    } catch (err) {
      fastify.log.error(err, 'F22 assistant error')
      send('error', JSON.stringify({ error: 'Error al procesar el análisis F22' }))
    } finally {
      reply.raw.end()
    }
  })
}
