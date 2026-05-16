import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) extraHeaders['Cookie'] = cookie
  const { status, data } = await apiFetch('/inventory/movements', {
    method: 'POST',
    headers: extraHeaders,
    body: JSON.stringify(body),
  })
  return NextResponse.json(data, { status })
}
