import { NextResponse, type NextRequest } from "next/server"

import { writeAuditLog } from "@/lib/auth/audit"
import { requireAuth, requirePermission } from "@/lib/auth/guard"
import { updateRole } from "@/lib/auth/service"
import { ensureSameOrigin, getClientIp } from "@/lib/auth/session"
import { updateRolePayloadSchema } from "@/lib/auth/validators"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const originError = ensureSameOrigin(request)
  if (originError) return originError

  try {
    const { context: auth, error } = await requireAuth(request)
    if (!auth) return error
    const permissionError = requirePermission(auth, "admin:roles:manage")
    if (permissionError) return permissionError

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Role id is required." }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateRolePayloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload.", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await updateRole(id, {
      name: parsed.data.name?.trim().toUpperCase(),
      description:
        typeof parsed.data.description === "string"
          ? parsed.data.description.trim()
          : undefined,
    })

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "ROLE_UPDATED",
      entityType: "role",
      entityId: id,
      metadata: { updatedFields: Object.keys(parsed.data) },
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("admin roles patch error", error)
    const postgresError = error as { code?: string }
    if (postgresError?.code === "23505") {
      return NextResponse.json({ error: "Role name already exists." }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to update role." }, { status: 500 })
  }
}
