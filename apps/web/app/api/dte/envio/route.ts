import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch('/dte/envio', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: extraHeaders,
  })

  if (status !== 200 || !data) {
    return NextResponse.json(data || { error: 'Error al generar EnvioDTE' }, { status: status || 500 })
  }

  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=ISO-8859-1',
      'Content-Disposition': `attachment; filename="EnvioDTE.xml"`,
    },
  })
}
