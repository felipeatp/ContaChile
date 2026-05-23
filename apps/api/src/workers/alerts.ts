import { Worker, Queue, JobsOptions } from 'bullmq'
import { prisma } from '@contachile/db'
import { findUpcomingDueDates } from '@contachile/validators'
import { createEmailService } from '../lib/email'
import { createRedisClient, probeRedis } from '../lib/redis'

const emailService = createEmailService()

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
      } catch {
        stats.errors++
      }
    }
  }

  return stats
}

async function initWorker(): Promise<void> {
  if (!(await probeRedis())) return

  new Worker(
    QUEUE_NAME,
    async () => {
      const stats = await processDailyAlerts()
      return stats
    },
    { connection: createRedisClient() }
  )

  const queue = new Queue(QUEUE_NAME, {
    connection: createRedisClient(),
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 50,
    },
  })

  const repeatOptions: JobsOptions = {
    repeat: {
      pattern: '0 8 * * *',
      tz: 'America/Santiago',
    },
  }
  await queue.add(JOB_NAME, {}, repeatOptions)
}

void initWorker()
