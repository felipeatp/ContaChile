import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) extraHeaders['Cookie'] = cookie
  const { status, data } = await apiFetch(`/payroll/item/${id}/approve`, {
    method: 'POST',
    headers: extraHeaders,
  })
  return NextResponse.json(data, { status })
}
