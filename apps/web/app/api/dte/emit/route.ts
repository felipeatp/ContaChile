import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const idempotencyKey = req.headers.get('idempotency-key')

  const { status, data } = await apiFetch('/dte/emit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: idempotencyKey ? { 'idempotency-key': idempotencyKey } : {},
  })

  return NextResponse.json(data, { status })
}
