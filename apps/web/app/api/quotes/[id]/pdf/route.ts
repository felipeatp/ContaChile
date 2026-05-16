import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookie = req.headers.get('cookie')
  const headers: Record<string, string> = {}
  if (cookie) headers['Cookie'] = cookie

  const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/quotes/${id}/pdf`
  const res = await fetch(url, { method: 'GET', headers })
  if (!res.ok) return new NextResponse(await res.text(), { status: res.status })

  const blob = await res.blob()
  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': res.headers.get('content-disposition') || 'inline',
    },
  })
}
