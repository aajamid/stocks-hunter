import "server-only"

import { NextResponse, type NextRequest } from "next/server"

import { getAuthContextFromRequest } from "@/lib/auth/session"
import type { AuthContext } from "@/lib/auth/types"

export function hasRole(context: AuthContext, ...roles: string[]) {
  const roleSet = new Set(context.user.roles.map((role) => role.toUpperCase()))
  return roles.some((role) => roleSet.has(role.toUpperCase()))
}

export function hasPermission(context: AuthContext, ...permissions: string[]) {
  const permissionSet = new Set(context.user.permissions)
  return permissions.some((permission) => permissionSet.has(permission))
}

export function isAdmin(context: AuthContext) {
  return hasRole(context, "ADMIN") || hasPermission(context, "admin:all")
}

export async function requireAuth(request: NextRequest) {
  const context = await getAuthContextFromRequest(request)
  if (!context) {
    return {
      context: null,
      error: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    }
  }
  return { context, error: null as NextResponse<unknown> | null }
}

export function requirePermission(
  context: AuthContext,
  ...permissions: string[]
): NextResponse<unknown> | null {
  if (isAdmin(context)) return null
  if (hasPermission(context, ...permissions)) return null
  return NextResponse.json({ error: "Forbidden." }, { status: 403 })
}

export function requireRole(
  context: AuthContext,
  ...roles: string[]
): NextResponse<unknown> | null {
  if (hasRole(context, ...roles)) return null
  return NextResponse.json({ error: "Forbidden." }, { status: 403 })
}
