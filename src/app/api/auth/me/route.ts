import { NextResponse, type NextRequest } from "next/server"

import { requireAuth } from "@/lib/auth/guard"
import { attachSessionCookies, rotateSession } from "@/lib/auth/session"

export async function GET(request: NextRequest) {
  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error

    const rotated = await rotateSession(request, context)
    const response = NextResponse.json({
      user: context.user,
      session: {
        id: rotated.sessionId,
        expiresAt: rotated.expiresAt.toISOString(),
      },
    })
    attachSessionCookies(response, rotated.rawToken, rotated.expiresAt)
    return response
  } catch (error) {
    console.error("me error", error)
    return NextResponse.json({ error: "Failed to fetch current user." }, { status: 500 })
  }
}
