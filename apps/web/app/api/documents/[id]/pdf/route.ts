import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { status, data } = await apiFetch(`/documents/${id}/pdf`, {
    method: 'GET',
  })

  if (status !== 200 || !data) {
    return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
  }

  // data is a Buffer from the backend PDF
  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="dte-${id}.pdf"`,
    },
  })
}
