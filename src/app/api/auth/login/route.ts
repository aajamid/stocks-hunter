import { NextResponse, type NextRequest } from "next/server"

import { writeAuditLog } from "@/lib/auth/audit"
import { authConfig } from "@/lib/auth/config"
import { normalizeEmail, verifyPassword } from "@/lib/auth/crypto"
import { getLoginThrottleState, registerLoginFailure, registerLoginSuccess } from "@/lib/auth/rate-limit"
import { findUserByEmail, updateUserLastLogin } from "@/lib/auth/service"
import {
  attachSessionCookies,
  createSession,
  ensureSameOrigin,
  getClientIp,
  revokeSessionByToken,
} from "@/lib/auth/session"
import { loginPayloadSchema } from "@/lib/auth/validators"

export async function POST(request: NextRequest) {
  const originError = ensureSameOrigin(request)
  if (originError) return originError

  try {
    const body = await request.json()
    const parsed = loginPayloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 400 })
    }

    const email = normalizeEmail(parsed.data.email)
    const ipAddress = getClientIp(request)
    const throttleKey = `${ipAddress ?? "unknown"}:${email}`
    const throttle = getLoginThrottleState(throttleKey)
    if (!throttle.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(throttle.retryAfterSeconds) },
        }
      )
    }

    const user = await findUserByEmail(email)
    const invalidLoginResponse = NextResponse.json(
      { error: "Invalid credentials." },
      { status: 401 }
    )

    if (!user || !user.is_active) {
      registerLoginFailure(throttleKey)
      await writeAuditLog({
        action: "LOGIN_FAILED",
        entityType: "user",
        metadata: { email },
        ipAddress,
      })
      return invalidLoginResponse
    }

    const validPassword = await verifyPassword(parsed.data.password, user.password_hash)
    if (!validPassword) {
      registerLoginFailure(throttleKey)
      await writeAuditLog({
        actorUserId: user.id,
        action: "LOGIN_FAILED",
        entityType: "user",
        entityId: user.id,
        metadata: { email },
        ipAddress,
      })
      return invalidLoginResponse
    }

    registerLoginSuccess(throttleKey)

    const existingSession = request.cookies.get(authConfig.sessionCookieName)?.value
    if (existingSession) {
      await revokeSessionByToken(existingSession)
    }

    const session = await createSession(user.id, request)
    await updateUserLastLogin(user.id)

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      },
    })
    attachSessionCookies(response, session.rawToken, session.expiresAt)

    await writeAuditLog({
      actorUserId: user.id,
      action: "LOGIN_SUCCESS",
      entityType: "user",
      entityId: user.id,
      metadata: { email },
      ipAddress,
    })
    return response
  } catch (error) {
    console.error("login error", error)
    return NextResponse.json({ error: "Failed to sign in." }, { status: 500 })
  }
}
