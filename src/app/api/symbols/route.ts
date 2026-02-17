import { NextResponse, type NextRequest } from "next/server"

import { requireAuth, requirePermission } from "@/lib/auth/guard"
import { fetchSymbolsList } from "@/lib/queries"

export async function GET(request: NextRequest) {
  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error
    const permissionError = requirePermission(context, "investments:read")
    if (permissionError) return permissionError

    const data = await fetchSymbolsList()
    return NextResponse.json(data)
  } catch (error) {
    console.error("symbols api error", error)
    const detail = error instanceof Error ? error.message : undefined
    return NextResponse.json(
      {
        error: detail
          ? `Failed to load symbols metadata. ${detail}`
          : "Failed to load symbols metadata.",
      },
      { status: 500 }
    )
  }
}
