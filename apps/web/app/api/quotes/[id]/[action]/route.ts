import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await params
  const allowed = ['send', 'accept', 'reject', 'to-invoice']
  if (!allowed.includes(action)) {
    return NextResponse.json({ error: 'acción no soportada' }, { status: 400 })
  }
  const body = await req.json().catch(() => ({}))
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) extraHeaders['Cookie'] = cookie
  const { status, data } = await apiFetch(`/quotes/${id}/${action}`, {
    method: 'POST',
    headers: extraHeaders,
    body: JSON.stringify(body),
  })
  return NextResponse.json(data, { status })
}
