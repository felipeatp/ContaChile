import Fastify from 'fastify'
import tenantPlugin from './plugins/tenant'
import emitRoute from './routes/dte/emit'
import emitBridgeRoute from './routes/dte/emit-bridge'

const app = Fastify({ logger: true })

app.register(tenantPlugin)
app.register(emitRoute)
app.register(emitBridgeRoute)

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
