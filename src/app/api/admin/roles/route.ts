import { NextResponse, type NextRequest } from "next/server"

import { writeAuditLog } from "@/lib/auth/audit"
import { requireAuth, requirePermission } from "@/lib/auth/guard"
import { createRole, listRolesWithPermissions } from "@/lib/auth/service"
import { ensureSameOrigin, getClientIp } from "@/lib/auth/session"
import { createRolePayloadSchema } from "@/lib/auth/validators"

export async function GET(request: NextRequest) {
  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error
    const permissionError = requirePermission(context, "admin:roles:read")
    if (permissionError) return permissionError

    const roles = await listRolesWithPermissions()
    return NextResponse.json({ roles })
  } catch (error) {
    console.error("admin roles get error", error)
    return NextResponse.json({ error: "Failed to load roles." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const originError = ensureSameOrigin(request)
  if (originError) return originError

  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error
    const permissionError = requirePermission(context, "admin:roles:manage")
    if (permissionError) return permissionError

    const body = await request.json()
    const parsed = createRolePayloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload.", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const roleId = await createRole({
      name: parsed.data.name.trim().toUpperCase(),
      description: parsed.data.description?.trim() ?? null,
    })

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "ROLE_CREATED",
      entityType: "role",
      entityId: roleId,
      metadata: { roleName: parsed.data.name.trim().toUpperCase() },
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({ id: roleId }, { status: 201 })
  } catch (error) {
    console.error("admin roles create error", error)
    const postgresError = error as { code?: string }
    if (postgresError?.code === "23505") {
      return NextResponse.json({ error: "Role already exists." }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to create role." }, { status: 500 })
  }
}
