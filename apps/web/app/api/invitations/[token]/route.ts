import { NextRequest, NextResponse } from "next/server"
import { apiFetch } from "@/lib/api-server"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { status, data } = await apiFetch(`/invitations/${token}`, {
    method: "GET",
  })

  return NextResponse.json(data, { status })
}
