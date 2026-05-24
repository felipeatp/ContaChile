import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-edge"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export async function GET(req: NextRequest) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  // Obtener sesión de Better Auth
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    })

    if (session?.user) {
      headers["x-company-id"] = session.user.id
    } else {
      headers["x-company-id"] = "dev"
    }
  } catch {
    headers["x-company-id"] = "dev"
  }

  // Forward cookie so the backend tenant plugin can validate the session too
  const cookie = req.headers.get("cookie")
  if (cookie) {
    headers["Cookie"] = cookie
  }

  try {
    const upstream = await fetch(`${API_BASE_URL}/ai/insights`, {
      method: "GET",
      headers,
    })

    if (!upstream.ok) return NextResponse.json({ insights: [] })

    const data = await upstream.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ insights: [] })
  }
}
