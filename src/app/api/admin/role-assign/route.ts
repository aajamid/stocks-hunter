import { NextResponse, type NextRequest } from "next/server"

import { writeAuditLog } from "@/lib/auth/audit"
import { requireAuth, requirePermission } from "@/lib/auth/guard"
import { assignRoleToUser } from "@/lib/auth/service"
import { ensureSameOrigin, getClientIp } from "@/lib/auth/session"
import { assignRolePayloadSchema } from "@/lib/auth/validators"

export async function POST(request: NextRequest) {
  const originError = ensureSameOrigin(request)
  if (originError) return originError

  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error
    const permissionError = requirePermission(context, "admin:users:manage")
    if (permissionError) return permissionError

    const body = await request.json()
    const parsed = assignRolePayloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload.", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await assignRoleToUser({
      userId: parsed.data.user_id,
      roleId: parsed.data.role_id,
      assignedBy: context.user.id,
    })

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "ROLE_ASSIGNED",
      entityType: "user_role",
      entityId: parsed.data.user_id,
      metadata: {
        user_id: parsed.data.user_id,
        role_id: parsed.data.role_id,
      },
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("admin role assign error", error)
    return NextResponse.json({ error: "Failed to assign role." }, { status: 500 })
  }
}
