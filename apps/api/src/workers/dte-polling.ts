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

async function notifyDocumentStuck(documentId: string, attempts: number, lastError: string): Promise<void> {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { companyId: true, folio: true, type: true },
    })
    if (!doc?.companyId) return

    const owner = await (prisma as any).companyMembership.findFirst({
      where: { companyId: doc.companyId, role: 'owner' },
      select: { userId: true },
    })
    if (!owner) return

    const user = await (prisma as any).user.findUnique({
      where: { id: owner.userId },
      select: { email: true, name: true },
    })
    if (!user?.email) return

    await emailService.sendDocumentStuck({
      documentId,
      folio: doc.folio,
      type: doc.type,
      attempts,
      lastError,
      userEmail: user.email,
      userName: user.name || user.email,
    })
  } catch (notifyErr: unknown) {
    const msg = notifyErr instanceof Error ? notifyErr.message : String(notifyErr)
    if (process.env.NODE_ENV !== 'production') console.error(`[dte-worker] notifyDocumentStuck failed: ${msg}`)
  }
}

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

  // Dead Letter Queue: mark document FAILED and notify owner after all retries exhausted
  worker.on('failed', async (job, err) => {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(JSON.stringify({ level: 'error', context: 'dte-polling', documentId: job?.data?.documentId, err: errorMsg, msg: 'Error en worker de polling DTE' }))

    if (!job) return
    const maxAttempts = (job.opts.attempts as number | undefined) ?? 24
    if (job.attemptsMade < maxAttempts) return

    const { documentId } = job.data

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        rejectionReason: `SII no respondió después de ${job.attemptsMade} intentos: ${errorMsg}`,
      },
    }).catch(() => {})

    await notifyDocumentStuck(documentId, job.attemptsMade, errorMsg)
  })
}

void initWorker()
