import { NextRequest, NextResponse } from "next/server"
import { apiFetch } from "@/lib/api-server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.toString()

  const cookie = req.headers.get("cookie")
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders["Cookie"] = cookie

  const { status, data } = await apiFetch(
    `/alerts/history${query ? `?${query}` : ""}`,
    { method: "GET", headers: extraHeaders }
  )

  if (status >= 400) return NextResponse.json({ alerts: [] }, { status: 200 })
  return NextResponse.json(data, { status })
}
