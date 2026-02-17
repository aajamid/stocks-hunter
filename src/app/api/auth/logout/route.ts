import { NextResponse, type NextRequest } from "next/server"

import { writeAuditLog } from "@/lib/auth/audit"
import { authConfig } from "@/lib/auth/config"
import { getAuthContextFromRequest } from "@/lib/auth/session"
import {
  clearSessionCookies,
  ensureSameOrigin,
  getClientIp,
  revokeSessionByToken,
} from "@/lib/auth/session"

export async function POST(request: NextRequest) {
  const originError = ensureSameOrigin(request)
  if (originError) return originError

  try {
    const auth = await getAuthContextFromRequest(request)
    const rawToken = request.cookies.get(authConfig.sessionCookieName)?.value
    if (rawToken) {
      await revokeSessionByToken(rawToken)
    }

    const response = NextResponse.json({ ok: true })
    clearSessionCookies(response)

    await writeAuditLog({
      actorUserId: auth?.user.id ?? null,
      action: "LOGOUT",
      entityType: "session",
      entityId: auth?.sessionId ?? null,
      ipAddress: getClientIp(request),
    })

    return response
  } catch (error) {
    console.error("logout error", error)
    const response = NextResponse.json({ error: "Failed to sign out." }, { status: 500 })
    clearSessionCookies(response)
    return response
  }
}
