import { NextRequest, NextResponse } from "next/server"
import { apiFetch } from "@/lib/api-server"

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const { status, data } = await apiFetch(`/invitations/${params.token}`, {
    method: "GET",
  })

  return NextResponse.json(data, { status })
}
