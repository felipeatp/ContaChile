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

  const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/payroll/item/${id}/pdf`
  const res = await fetch(url, {
    method: 'GET',
    headers: extraHeaders,
  })

  if (!res.ok) {
    const text = await res.text()
    return new NextResponse(text, { status: res.status })
  }

  const blob = await res.blob()
  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': res.headers.get('content-disposition') || 'inline',
    },
  })
}
