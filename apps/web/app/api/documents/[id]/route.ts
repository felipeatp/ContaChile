import { NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { status, data } = await apiFetch(`/documents/${id}`, {
    method: 'GET',
  })

  return NextResponse.json(data, { status })
}
