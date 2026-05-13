import { Queue } from 'bullmq'

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
}

export const dteQueue = new Queue('dte-polling', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 24,
    backoff: {
      type: 'fixed',
      delay: 5 * 60 * 1000, // 5 minutes
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
})

export interface PollJobData {
  documentId: string
  trackId: string
  source: 'sii' | 'acepta'
}

export async function enqueuePollJob(data: PollJobData): Promise<void> {
  await dteQueue.add('poll-status', data)
}
