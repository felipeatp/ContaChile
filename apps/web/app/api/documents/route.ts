import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.toString()

  const { status, data } = await apiFetch(`/documents${query ? `?${query}` : ''}`, {
    method: 'GET',
  })

  return NextResponse.json(data, { status })
}
