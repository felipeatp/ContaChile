import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params
  const { searchParams } = new URL(req.url)
  const query = searchParams.toString()

  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch(
    `/accounting/ledger/${accountId}${query ? `?${query}` : ''}`,
    { method: 'GET', headers: extraHeaders }
  )

  return NextResponse.json(data, { status })
}
