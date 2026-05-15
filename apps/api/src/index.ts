import Fastify, { FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import tenantPlugin from './plugins/tenant'
import emitRoute from './routes/dte/emit'
import emitBridgeRoute from './routes/dte/emit-bridge'
import documentsRoute from './routes/dte/documents'
import pdfRoute from './routes/dte/pdf'
import xmlRoute from './routes/dte/xml'
import consultorRoute from './routes/ai/consultor'
import companyRoute from './routes/company'
import purchasesRoute from './routes/purchases'
import f29Route from './routes/f29'
import salesBookRoute from './routes/sales-book'

const app = Fastify({ logger: true })

// CORS: sólo permite el origen del frontend configurado
app.register(cors, {
  origin: process.env.WEB_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})

// Helmet: headers de seguridad (CSP, HSTS, X-Frame-Options, etc.)
app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
})

// Rate limit global: 100 req/min por tenant o IP
app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req: FastifyRequest) => {
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

// Rate limit estricto para emisión de DTE: 10 req/min por tenant (encapsulado en scope propio)
app.register(async (instance) => {
  await instance.register(rateLimit, {
    max: 10,
    timeWindow: '1 minute',
    keyGenerator: (req: FastifyRequest) => `emit:${(req as any).companyId || req.ip}`,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Límite de emisión DTE alcanzado. Intenta en ${context.after}`,
      retryAfter: context.after,
    }),
  })
  instance.register(emitRoute)
  instance.register(emitBridgeRoute)
})

app.register(documentsRoute)
app.register(pdfRoute)
app.register(xmlRoute)
app.register(companyRoute)
app.register(purchasesRoute)
app.register(f29Route)
app.register(salesBookRoute)

// Rutas de IA streaming — 20 req/min por tenant
app.register(async (instance) => {
  await instance.register(rateLimit, {
    max: 20,
    timeWindow: '1 minute',
    hook: 'preHandler',
    keyGenerator: (req: FastifyRequest) => `ai:stream:${(req as any).companyId || req.ip}`,
    // Solo aplica a peticiones sin useTools (streaming)
    allowList: (req: FastifyRequest) => {
      const body = req.body as { useTools?: boolean } | null
      return body?.useTools === true
    },
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Límite de consultas IA alcanzado. Intenta en ${context.after}`,
      retryAfter: context.after,
    }),
  })

  // Rate limit más estricto para useTools (hace múltiples llamadas LLM + queries DB)
  await instance.register(rateLimit, {
    max: 5,
    timeWindow: '1 minute',
    hook: 'preHandler',
    keyGenerator: (req: FastifyRequest) => `ai:tools:${(req as any).companyId || req.ip}`,
    allowList: (req: FastifyRequest) => {
      const body = req.body as { useTools?: boolean } | null
      return body?.useTools !== true
    },
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Límite de consultas IA con herramientas alcanzado. Intenta en ${context.after}`,
      retryAfter: context.after,
    }),
  })

  instance.register(consultorRoute)
})

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
