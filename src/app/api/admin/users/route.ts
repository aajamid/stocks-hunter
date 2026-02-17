import { NextResponse, type NextRequest } from "next/server"

import { writeAuditLog } from "@/lib/auth/audit"
import { normalizeEmail, hashPassword } from "@/lib/auth/crypto"
import { requireAuth, requirePermission } from "@/lib/auth/guard"
import { createUser, listUsersWithRoles } from "@/lib/auth/service"
import { ensureSameOrigin, getClientIp } from "@/lib/auth/session"
import {
  createUserPayloadSchema,
  validateStrongPassword,
} from "@/lib/auth/validators"

export async function GET(request: NextRequest) {
  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error

    const permissionError = requirePermission(context, "admin:users:read")
    if (permissionError) return permissionError

    const users = await listUsersWithRoles()
    return NextResponse.json({ users })
  } catch (error) {
    console.error("admin users get error", error)
    return NextResponse.json({ error: "Failed to load users." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const originError = ensureSameOrigin(request)
  if (originError) return originError

  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error

    const permissionError = requirePermission(context, "admin:users:manage")
    if (permissionError) return permissionError

    const body = await request.json()
    const parsed = createUserPayloadSchema.safeParse(body)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      const field =
        firstIssue?.path?.length && typeof firstIssue.path[0] === "string"
          ? firstIssue.path[0]
          : null
      return NextResponse.json(
        {
          error: firstIssue
            ? `${field ? `${field}: ` : ""}${firstIssue.message}`
            : "Invalid payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    if (!validateStrongPassword(parsed.data.password)) {
      return NextResponse.json(
        {
          error:
            "Password must include uppercase, lowercase, number, and special character.",
        },
        { status: 400 }
      )
    }

    const userId = await createUser({
      email: normalizeEmail(parsed.data.email),
      fullName: parsed.data.fullName.trim(),
      passwordHash: await hashPassword(parsed.data.password),
      isActive: parsed.data.isActive ?? true,
    })

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "USER_CREATED",
      entityType: "user",
      entityId: userId,
      metadata: { email: normalizeEmail(parsed.data.email) },
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({ id: userId }, { status: 201 })
  } catch (error) {
    console.error("admin users create error", error)
    const postgresError = error as { code?: string }
    if (postgresError?.code === "23505") {
      return NextResponse.json({ error: "Email already exists." }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 })
  }
}
