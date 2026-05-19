import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function POST(req: NextRequest) {
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) extraHeaders['Cookie'] = cookie
  const { status, data } = await apiFetch('/bank/link-intents', {
    method: 'POST',
    headers: extraHeaders,
    body: JSON.stringify({}),
  })
  return NextResponse.json(data, { status })
}
