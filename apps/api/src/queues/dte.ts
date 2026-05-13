import { Queue } from 'bullmq'
import Redis from 'ioredis'

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
}

let dteQueue: Queue | null = null

async function initQueue(): Promise<void> {
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

    dteQueue = new Queue('dte-polling', {
      connection: redisConnection,
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
  } catch {
    console.warn('[dte-queue] Redis not available, polling disabled')
  }
}

void initQueue()

export interface PollJobData {
  documentId: string
  trackId: string
  source: 'sii' | 'acepta'
}

export async function enqueuePollJob(data: PollJobData): Promise<void> {
  if (!dteQueue) {
    console.warn('[dte-queue] Skipping poll job (Redis unavailable)', data)
    return
  }
  await dteQueue.add('poll-status', data)
}
