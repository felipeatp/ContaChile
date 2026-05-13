import { headers } from 'next/headers'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function getForwardedHeaders(): Record<string, string> {
  const h = headers()
  const forwarded: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const auth = h.get('authorization')
  if (auth) forwarded['Authorization'] = auth

  const companyId = h.get('x-company-id')
  if (companyId) forwarded['x-company-id'] = companyId

  const idempotencyKey = h.get('idempotency-key')
  if (idempotencyKey) forwarded['idempotency-key'] = idempotencyKey

  // Forward cookie so Clerk session works through the proxy
  const cookie = h.get('cookie')
  if (cookie) forwarded['Cookie'] = cookie

  return forwarded
}

export async function apiFetch(path: string, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...getForwardedHeaders(),
        ...(init?.headers || {}),
      },
    })

    const data = await res.json().catch(() => null)
    return { status: res.status, data }
  } finally {
    clearTimeout(timeout)
  }
}
