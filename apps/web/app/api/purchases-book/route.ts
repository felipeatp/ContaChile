import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.toString()

  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch(`/purchases-book${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: extraHeaders,
  })

  if (status >= 400) return NextResponse.json({ purchases: [], total: 0, page: 1, limit: 1000, summary: { net: 0, tax: 0, total: 0 } }, { status: 200 })
  return NextResponse.json(data, { status })
}
