import { NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { status, data } = await apiFetch(`/documents/${params.id}`, {
    method: 'GET',
  })

  return NextResponse.json(data, { status })
}
