import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) extraHeaders['Cookie'] = cookie
  const { status, data } = await apiFetch(`/honorarios/${id}`, {
    method: 'PATCH',
    headers: extraHeaders,
    body: JSON.stringify(body),
  })
  return NextResponse.json(data, { status })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie
  const { status } = await apiFetch(`/honorarios/${id}`, {
    method: 'DELETE',
    headers: extraHeaders,
  })
  return new NextResponse(null, { status })
}
