import { NextResponse, type NextRequest } from "next/server"

import { writeAuditLog } from "@/lib/auth/audit"
import { hashPassword } from "@/lib/auth/crypto"
import { requireAuth, requirePermission } from "@/lib/auth/guard"
import { revokeSessionsForUser, updateUser } from "@/lib/auth/service"
import { ensureSameOrigin, getClientIp } from "@/lib/auth/session"
import { updateUserPayloadSchema, validateStrongPassword } from "@/lib/auth/validators"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const originError = ensureSameOrigin(request)
  if (originError) return originError

  try {
    const { context: auth, error } = await requireAuth(request)
    if (!auth) return error

    const permissionError = requirePermission(auth, "admin:users:manage")
    if (permissionError) return permissionError

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "User id is required." }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateUserPayloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload.", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const payload = parsed.data
    let passwordHash: string | undefined
    if (typeof payload.password === "string" && payload.password.length > 0) {
      if (!validateStrongPassword(payload.password)) {
        return NextResponse.json(
          {
            error:
              "Password must include uppercase, lowercase, number, and special character.",
          },
          { status: 400 }
        )
      }
      passwordHash = await hashPassword(payload.password)
    }

    await updateUser(id, {
      fullName: payload.fullName,
      isActive: payload.isActive,
      passwordHash,
    })

    if (payload.isActive === false || passwordHash) {
      await revokeSessionsForUser(id)
    }

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "USER_UPDATED",
      entityType: "user",
      entityId: id,
      metadata: {
        updatedFields: Object.keys(payload),
        revokedSessions: payload.isActive === false || Boolean(passwordHash),
      },
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("admin users patch error", error)
    return NextResponse.json({ error: "Failed to update user." }, { status: 500 })
  }
}
