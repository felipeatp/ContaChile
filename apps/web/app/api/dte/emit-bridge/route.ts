import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const idempotencyKey = req.headers.get('idempotency-key')
  const cookie = req.headers.get('cookie')

  const extraHeaders: Record<string, string> = {}
  if (idempotencyKey) extraHeaders['idempotency-key'] = idempotencyKey
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch('/dte/emit-bridge', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: extraHeaders,
  })

  return NextResponse.json(data, { status })
}
