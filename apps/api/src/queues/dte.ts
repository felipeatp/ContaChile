import { Queue } from 'bullmq'
import { createRedisClient, probeRedis } from '../lib/redis'

let dteQueue: Queue | null = null

async function initQueue(): Promise<void> {
  if (!(await probeRedis())) return

  dteQueue = new Queue('dte-polling', {
    connection: createRedisClient(),
    defaultJobOptions: {
      attempts: 24,
      backoff: {
        type: 'fixed',
        delay: 5 * 60 * 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  })
}

void initQueue()

export interface PollJobData {
  documentId: string
  trackId: string
  source: 'sii' | 'acepta'
}

export async function enqueuePollJob(data: PollJobData): Promise<void> {
  if (!dteQueue) {
    return
  }
  await dteQueue.add('poll-status', data)
}
