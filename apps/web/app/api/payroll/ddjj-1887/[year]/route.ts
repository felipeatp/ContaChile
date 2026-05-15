import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  const { year } = await params
  const cookie = req.headers.get('cookie')
  const headers: Record<string, string> = {}
  if (cookie) headers['Cookie'] = cookie

  const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/payroll/ddjj-1887/${year}`
  const res = await fetch(url, { method: 'GET', headers })

  if (!res.ok) {
    return new NextResponse(await res.text(), { status: res.status })
  }

  const text = await res.text()
  return new NextResponse(text, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': res.headers.get('content-disposition') || 'attachment',
    },
  })
}
