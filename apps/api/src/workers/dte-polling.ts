import { Worker } from 'bullmq'
import Redis from 'ioredis'
import { prisma } from '@contachile/db'
import { SIIClient } from '@contachile/transport-sii'
import { AceptaClient } from '@contachile/transport-acepta'
import { PollJobData } from '../queues/dte'
import { createEmailService } from '../lib/email'

const emailService = createEmailService()

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
}

const siiClient = new SIIClient({
  baseURL: process.env.SII_BASE_URL || 'https://maullin.sii.cl',
  env: (process.env.SII_ENV as 'test' | 'production') || 'test',
})

const aceptaClient = new AceptaClient({
  apiKey: process.env.ACEPTA_API_KEY || 'test-key',
  baseURL: process.env.ACEPTA_BASE_URL,
})

async function initWorker(): Promise<void> {
  const testRedis = new Redis({
    ...redisConnection,
    connectTimeout: 2000,
    lazyConnect: true,
  })

  testRedis.on('error', () => {
    // ignore connection errors during probe
  })

  try {
    await testRedis.connect()
    await testRedis.disconnect()

    new Worker<PollJobData>(
      'dte-polling',
      async (job) => {
        const { documentId, trackId, source } = job.data

        const statusResult =
          source === 'sii'
            ? await siiClient.queryStatus(trackId)
            : await aceptaClient.queryStatus(trackId)

        if (statusResult.status === 'PENDING') {
          throw new Error(`Document ${documentId} still pending`)
        }

        const newStatus = statusResult.status

        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: newStatus,
            ...(newStatus === 'ACCEPTED'
              ? { acceptedAt: new Date() }
              : newStatus === 'REJECTED'
                ? { rejectedAt: new Date(), rejectionReason: statusResult.detail }
                : {}),
          },
        })

        if (newStatus === 'ACCEPTED') {
          const doc = await prisma.document.findUnique({ where: { id: documentId } })
          if (doc?.receiverEmail) {
            await emailService.sendDocumentAccepted({
              documentId: doc.id,
              folio: doc.folio,
              type: doc.type,
              receiverName: doc.receiverName,
              receiverEmail: doc.receiverEmail,
            })
          }
        }

        await prisma.auditLog.create({
          data: {
            documentId,
            action: newStatus,
            payload: { source, detail: statusResult.detail },
          },
        })

        return { documentId, status: newStatus }
      },
      { connection: redisConnection }
    )
  } catch {
    console.warn('[dte-worker] Redis not available, worker not started')
  }
}

void initWorker()
