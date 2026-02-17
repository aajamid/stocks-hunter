import { NextResponse, type NextRequest } from "next/server"

import { writeAuditLog } from "@/lib/auth/audit"
import { requireAuth, requirePermission } from "@/lib/auth/guard"
import { setRolePermissions } from "@/lib/auth/service"
import { ensureSameOrigin, getClientIp } from "@/lib/auth/session"
import { rolePermissionPayloadSchema } from "@/lib/auth/validators"

export async function POST(request: NextRequest) {
  const originError = ensureSameOrigin(request)
  if (originError) return originError

  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error
    const permissionError = requirePermission(context, "admin:roles:manage")
    if (permissionError) return permissionError

    const body = await request.json()
    const parsed = rolePermissionPayloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload.", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await setRolePermissions(parsed.data.role_id, parsed.data.permission_ids)

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "ROLE_PERMISSIONS_UPDATED",
      entityType: "role",
      entityId: parsed.data.role_id,
      metadata: {
        permission_count: parsed.data.permission_ids.length,
      },
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("admin role permissions error", error)
    return NextResponse.json(
      { error: "Failed to update role permissions." },
      { status: 500 }
    )
  }
}
