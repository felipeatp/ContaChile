import { NextRequest, NextResponse } from "next/server"
import { apiFetch } from "@/lib/api-server"

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const cookie = req.headers.get("cookie")
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders["Cookie"] = cookie

  const { status, data } = await apiFetch(`/invitations/${params.token}/accept`, {
    method: "POST",
    headers: extraHeaders,
    body: JSON.stringify({}),
  })

  return NextResponse.json(data, { status })
}
