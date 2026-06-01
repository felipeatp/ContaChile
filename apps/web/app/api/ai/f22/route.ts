import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-edge"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null)
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await req.json()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    cookie: req.headers.get("cookie") ?? "",
  }

  const activeCompanyId = req.headers.get("x-active-company-id")
  if (activeCompanyId) headers["x-active-company-id"] = activeCompanyId

  const upstream = await fetch(`${API_BASE_URL}/ai/f22`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    // @ts-expect-error — Node fetch necesita duplex para streaming
    duplex: "half",
  })

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({ error: "Error del análisis F22" }))
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
