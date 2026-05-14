import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import tenantPlugin from './plugins/tenant'
import emitRoute from './routes/dte/emit'
import emitBridgeRoute from './routes/dte/emit-bridge'
import documentsRoute from './routes/dte/documents'

const app = Fastify({ logger: true })

app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => {
    return (req as any).companyId || req.ip
  },
  errorResponseBuilder: (req, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Try again in ${context.after}`,
    retryAfter: context.after,
  }),
})

app.register(tenantPlugin)
app.register(emitRoute)
app.register(emitBridgeRoute)
app.register(documentsRoute)

app.get('/health', async () => ({ status: 'ok' }))

const start = async () => {
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
