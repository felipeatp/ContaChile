import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(req: NextRequest) {
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch('/documents/stats', {
    method: 'GET',
    headers: extraHeaders,
  })

  if (status >= 400 || !data) {
    return NextResponse.json(
      {
        total: 0,
        emittedToday: 0,
        byStatus: { pending: 0, accepted: 0, rejected: 0, failed: 0 },
        monthly: [],
        yoy: { current: 0, previous: 0, deltaPct: 0 },
      },
      { status: 200 }
    )
  }
  return NextResponse.json(data, { status })
}
