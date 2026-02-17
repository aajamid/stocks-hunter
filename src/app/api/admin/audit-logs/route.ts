import { NextResponse, type NextRequest } from "next/server"

import { requireAuth, requirePermission } from "@/lib/auth/guard"
import { listAuditLogs } from "@/lib/auth/service"

export async function GET(request: NextRequest) {
  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error
    const permissionError = requirePermission(context, "admin:audit:read")
    if (permissionError) return permissionError

    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from") ?? undefined
    const to = searchParams.get("to") ?? undefined
    const actor = searchParams.get("actor") ?? undefined
    const action = searchParams.get("action") ?? undefined

    const logs = await listAuditLogs({ from, to, actor, action })
    return NextResponse.json({ logs })
  } catch (error) {
    console.error("admin audit logs error", error)
    return NextResponse.json(
      { error: "Failed to load audit logs." },
      { status: 500 }
    )
  }
}
