import { NextResponse, type NextRequest } from "next/server"

import { requireAuth, requirePermission } from "@/lib/auth/guard"
import { listPermissions } from "@/lib/auth/service"

export async function GET(request: NextRequest) {
  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error
    const permissionError = requirePermission(context, "admin:permissions:read")
    if (permissionError) return permissionError

    const permissions = await listPermissions()
    return NextResponse.json({ permissions })
  } catch (error) {
    console.error("admin permissions get error", error)
    return NextResponse.json(
      { error: "Failed to load permissions." },
      { status: 500 }
    )
  }
}
