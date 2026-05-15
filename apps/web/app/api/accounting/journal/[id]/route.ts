import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch(`/accounting/journal/${id}`, {
    method: 'GET',
    headers: extraHeaders,
  })

  return NextResponse.json(data, { status })
}
