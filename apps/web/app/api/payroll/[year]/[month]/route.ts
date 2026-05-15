import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const { year, month } = await params
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie
  const { status, data } = await apiFetch(`/payroll/${year}/${month}`, {
    method: 'GET',
    headers: extraHeaders,
  })
  return NextResponse.json(data, { status })
}
