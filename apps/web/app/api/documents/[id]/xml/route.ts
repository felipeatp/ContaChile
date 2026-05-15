import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch(`/documents/${id}/xml`, {
    method: 'GET',
    headers: extraHeaders,
  })

  if (status !== 200 || !data) {
    return NextResponse.json({ error: 'XML not found' }, { status: 404 })
  }

  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=ISO-8859-1',
      'Content-Disposition': `attachment; filename="DTE-${id}.xml"`,
    },
  })
}
