import { NextResponse, type NextRequest } from "next/server"

import { requireAuth } from "@/lib/auth/guard"

export async function GET(request: NextRequest) {
  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error

    return NextResponse.json({
      user: context.user,
      session: {
        id: context.sessionId,
        expiresAt: context.sessionExpiresAt,
      },
    })
  } catch (error) {
    console.error("me error", error)
    return NextResponse.json({ error: "Failed to fetch current user." }, { status: 500 })
  }
}
