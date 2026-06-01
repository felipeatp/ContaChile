import { Worker } from 'bullmq'
import { prisma } from '@contachile/db'
import { SIIClient } from '@contachile/transport-sii'
import { AceptaClient } from '@contachile/transport-acepta'
import { PollJobData } from '../queues/dte'
import { createEmailService } from '../lib/email'
import { createRedisClient, probeRedis } from '../lib/redis'

const emailService = createEmailService()

const SIMULATE_DTE_STATUS = process.env.SIMULATE_DTE_STATUS === 'true'
const SIMULATED_ATTEMPTS = parseInt(process.env.SIMULATED_ATTEMPTS || '3', 10)

const siiClient = new SIIClient({
  baseURL: process.env.SII_BASE_URL || 'https://maullin.sii.cl',
  env: (process.env.SII_ENV as 'test' | 'production') || 'test',
})

const aceptaClient = new AceptaClient({
  apiKey: process.env.ACEPTA_API_KEY || 'test-key',
  baseURL: process.env.ACEPTA_BASE_URL,
})

async function initWorker(): Promise<void> {
  if (!(await probeRedis())) return

  const worker = new Worker<PollJobData>(
    'dte-polling',
    async (job) => {
      const { documentId, trackId, source } = job.data
      const attempt = job.attemptsMade + 1

      if (SIMULATE_DTE_STATUS) {
        if (attempt < SIMULATED_ATTEMPTS) {
          if (process.env.NODE_ENV !== 'production') console.log(`[dte-worker] Simulating PENDING for ${documentId} (attempt ${attempt}/${SIMULATED_ATTEMPTS})`)
          throw new Error(`Simulated PENDING for ${documentId}`)
        }

        if (process.env.NODE_ENV !== 'production') console.log(`[dte-worker] Simulating ACCEPTED for ${documentId} (attempt ${attempt}/${SIMULATED_ATTEMPTS})`)

        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'ACCEPTED', acceptedAt: new Date() },
        })

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

        await prisma.auditLog.create({
          data: { documentId, action: 'ACCEPTED', payload: { source, simulated: true } },
        })

        return { documentId, status: 'ACCEPTED', simulated: true }
      }

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
        data: { documentId, action: newStatus, payload: { source, detail: statusResult.detail } },
      })

      return { documentId, status: newStatus }
    },
    { connection: createRedisClient() }
  )

  worker.on('failed', (job, err) => {
    console.error(JSON.stringify({ level: 'error', context: 'dte-polling', documentId: job?.data?.documentId, err: err.message, msg: 'Error en worker de polling DTE' }))
  })
}

void initWorker()
