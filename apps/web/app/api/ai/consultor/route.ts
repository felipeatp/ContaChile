import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-edge"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export async function POST(req: NextRequest) {
  const body = await req.json()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  // Obtener sesión de Better Auth
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    })

    if (session?.user) {
      // Usar el userId como companyId (mismo patrón que Clerk)
      headers["x-company-id"] = session.user.id
    } else {
      headers["x-company-id"] = "dev"
    }
  } catch {
    headers["x-company-id"] = "dev"
  }

  const upstream = await fetch(`${API_BASE_URL}/ai/consultor`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    // @ts-expect-error — Node fetch necesita duplex para streaming
    duplex: "half",
  })

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({ error: "Error del servidor IA" }))
    return NextResponse.json(err, { status: upstream.status })
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
