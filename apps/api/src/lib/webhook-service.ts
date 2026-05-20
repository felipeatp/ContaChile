import { prisma } from '@contachile/db'
import crypto from 'crypto'

interface WebhookPayload {
  event: string
  data: unknown
  timestamp: string
}

export async function deliverWebhook(
  companyId: string,
  event: string,
  data: unknown
): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: { companyId, active: true, events: { has: event } },
  })

  if (webhooks.length === 0) return

  const payload: WebhookPayload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  }

  const body = JSON.stringify(payload)

  await Promise.all(
    webhooks.map(async (wh) => {
      const signature = crypto
        .createHmac('sha256', wh.secret)
        .update(body)
        .digest('hex')

      try {
        const res = await fetch(wh.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `sha256=${signature}`,
            'User-Agent': 'ContaChile-Webhook/1.0',
          },
          body,
        })

        if (!res.ok) {
          console.warn(`Webhook delivery failed for ${wh.url}: ${res.status}`)
        }
      } catch (err) {
        console.warn(`Webhook delivery error for ${wh.url}:`, err)
      }
    })
  )
}
