import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Intentar obtener el token de Clerk para autenticar en Fastify
  try {
    const { getToken, orgId, userId } = await auth()
    const token = await getToken()

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    } else if (userId || orgId) {
      // Fallback dev: usar orgId o userId como companyId
      headers['x-company-id'] = orgId ?? userId ?? 'dev'
    } else {
      // Sin sesión: usar companyId de dev para pruebas locales
      headers['x-company-id'] = 'dev'
    }
  } catch {
    // En dev sin Clerk configurado, usar fallback
    headers['x-company-id'] = 'dev'
  }

  const upstream = await fetch(`${API_BASE_URL}/ai/consultor`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    // @ts-expect-error — Node fetch necesita duplex para streaming
    duplex: 'half',
  })

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({ error: 'Error del servidor IA' }))
    return NextResponse.json(err, { status: upstream.status })
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
