import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(req: NextRequest) {
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch('/api-keys', {
    method: 'GET',
    headers: extraHeaders,
  })

  return NextResponse.json(data, { status })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch('/api-keys', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: extraHeaders,
  })

  return NextResponse.json(data, { status })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch(`/api-keys/${id}`, {
    method: 'DELETE',
    headers: extraHeaders,
  })

  return NextResponse.json(data, { status })
}
