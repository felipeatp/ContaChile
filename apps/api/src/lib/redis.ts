import Redis from 'ioredis'

const BULLMQ_OPTS = { maxRetriesPerRequest: null, enableReadyCheck: false } as const

export function createRedisClient(): Redis {
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, BULLMQ_OPTS)
  }
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    ...BULLMQ_OPTS,
  })
}

export async function probeRedis(): Promise<boolean> {
  const probe = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { connectTimeout: 2000, lazyConnect: true })
    : new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        connectTimeout: 2000,
        lazyConnect: true,
      })
  probe.on('error', () => {})
  try {
    await probe.connect()
    await probe.disconnect()
    return true
  } catch {
    return false
  }
}
