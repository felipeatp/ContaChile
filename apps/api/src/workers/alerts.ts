import { Worker, Queue, JobsOptions } from 'bullmq'
import Redis from 'ioredis'
import { prisma } from '@contachile/db'
import { findUpcomingDueDates } from '@contachile/validators'
import { createEmailService } from '../lib/email'

const emailService = createEmailService()

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
}

const ALERT_DAYS_BEFORE = [5, 1]
const QUEUE_NAME = 'alerts-daily'
const JOB_NAME = 'send-due-alerts'

export async function processDailyAlerts(now: Date = new Date()): Promise<{
  companies: number
  emailsSent: number
  alertsRegistered: number
  skipped: number
  errors: number
}> {
  const stats = { companies: 0, emailsSent: 0, alertsRegistered: 0, skipped: 0, errors: 0 }
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, email: true },
  })

  stats.companies = companies.length

  for (const company of companies) {
    const upcoming = findUpcomingDueDates(now)

    for (const alert of upcoming) {
      if (!ALERT_DAYS_BEFORE.includes(alert.daysUntil)) continue

      try {
        const already = await prisma.alertSent.findUnique({
          where: {
            companyId_alertCode_dueDate_daysBefore: {
              companyId: company.id,
              alertCode: alert.code,
              dueDate: alert.dueDate,
              daysBefore: alert.daysUntil,
            },
          },
        })
        if (already) {
          stats.skipped++
          continue
        }

        if (company.email) {
          await emailService.sendDueAlert({
            recipientEmail: company.email,
            recipientName: company.name,
            label: alert.label,
            description: alert.description,
            dueDate: alert.dueDate,
            daysUntil: alert.daysUntil,
            link: alert.link,
          })
          stats.emailsSent++
        }

        await prisma.alertSent.create({
          data: {
            companyId: company.id,
            alertCode: alert.code,
            dueDate: alert.dueDate,
            daysBefore: alert.daysUntil,
          },
        })
        stats.alertsRegistered++
      } catch (err) {
        stats.errors++
        console.error('[alerts-worker] error processing alert', {
          companyId: company.id,
          alertCode: alert.code,
          err: err instanceof Error ? err.message : err,
        })
      }
    }
  }

  return stats
}

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

    new Worker(
      QUEUE_NAME,
      async () => {
        const stats = await processDailyAlerts()
        console.log('[alerts-worker] daily run', stats)
        return stats
      },
      { connection: redisConnection }
    )

    const queue = new Queue(QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 50,
      },
    })

    // Schedule daily at 08:00 local
    const repeatOptions: JobsOptions = {
      repeat: {
        pattern: '0 8 * * *',
        tz: 'America/Santiago',
      },
    }
    await queue.add(JOB_NAME, {}, repeatOptions)

    console.log('[alerts-worker] scheduled daily at 08:00 America/Santiago')
  } catch {
    console.warn('[alerts-worker] Redis not available, daily alerts disabled')
  }
}

void initWorker()
