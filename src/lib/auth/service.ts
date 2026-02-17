import "server-only"

import { query } from "@/lib/db"

type LoginUserRow = {
  id: string
  email: string
  password_hash: string
  full_name: string | null
  is_active: boolean
}

export type AdminUserRow = {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
  roles: string[] | null
}

export type AdminRoleRow = {
  id: string
  name: string
  description: string | null
  created_at: string
  permissions: string[] | null
}

export type PermissionRow = {
  id: string
  key: string
  description: string | null
}

export type AuditRow = {
  id: string
  actor_user_id: string | null
  actor_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  ip_address: string | null
}

export async function findUserByEmail(email: string) {
  const result = await query<LoginUserRow>(
    `
    SELECT id, email, password_hash, full_name, is_active
    FROM public.users
    WHERE email = $1
    LIMIT 1
    `,
    [email]
  )
  return result.rows[0] ?? null
}

export async function updateUserLastLogin(userId: string) {
  await query(
    `
    UPDATE public.users
    SET last_login_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    `,
    [userId]
  )
}

export async function listUsersWithRoles() {
  const result = await query<AdminUserRow>(
    `
    SELECT
      u.id,
      u.email,
      u.full_name,
      u.is_active,
      to_char(u.last_login_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_login_at,
      to_char(u.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
      to_char(u.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT r.name), NULL) as roles
    FROM public.users u
    LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    LEFT JOIN public.roles r ON r.id = ur.role_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
    `
  )
  return result.rows
}

export async function createUser(input: {
  email: string
  fullName: string
  passwordHash: string
  isActive: boolean
}) {
  const result = await query<{ id: string }>(
    `
    INSERT INTO public.users (email, password_hash, full_name, is_active)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    `,
    [input.email, input.passwordHash, input.fullName, input.isActive]
  )
  return result.rows[0]?.id ?? null
}

export async function updateUser(
  userId: string,
  updates: {
    fullName?: string
    isActive?: boolean
    passwordHash?: string
  }
) {
  const sets: string[] = ["updated_at = NOW()"]
  const params: Array<string | boolean> = []

  if (typeof updates.fullName === "string") {
    params.push(updates.fullName)
    sets.push(`full_name = $${params.length}`)
  }
  if (typeof updates.isActive === "boolean") {
    params.push(updates.isActive)
    sets.push(`is_active = $${params.length}`)
  }
  if (typeof updates.passwordHash === "string") {
    params.push(updates.passwordHash)
    sets.push(`password_hash = $${params.length}`)
  }
  if (sets.length === 1) return

  params.push(userId)
  await query(
    `
    UPDATE public.users
    SET ${sets.join(", ")}
    WHERE id = $${params.length}
    `,
    params
  )
}

export async function revokeSessionsForUser(userId: string) {
  await query(
    `
    UPDATE public.sessions
    SET revoked_at = NOW()
    WHERE user_id = $1
      AND revoked_at IS NULL
    `,
    [userId]
  )
}

export async function listRolesWithPermissions() {
  const result = await query<AdminRoleRow>(
    `
    SELECT
      r.id,
      r.name,
      r.description,
      to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.key), NULL) as permissions
    FROM public.roles r
    LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
    LEFT JOIN public.permissions p ON p.id = rp.permission_id
    GROUP BY r.id
    ORDER BY r.name ASC
    `
  )
  return result.rows
}

export async function createRole(input: { name: string; description: string | null }) {
  const result = await query<{ id: string }>(
    `
    INSERT INTO public.roles (name, description)
    VALUES ($1, $2)
    RETURNING id
    `,
    [input.name, input.description]
  )
  return result.rows[0]?.id ?? null
}

export async function updateRole(
  roleId: string,
  updates: { name?: string; description?: string | null }
) {
  const sets: string[] = []
  const params: Array<string | null> = []
  if (typeof updates.name === "string") {
    params.push(updates.name)
    sets.push(`name = $${params.length}`)
  }
  if (typeof updates.description === "string" || updates.description === null) {
    params.push(updates.description ?? null)
    sets.push(`description = $${params.length}`)
  }
  if (sets.length === 0) return

  params.push(roleId)
  await query(
    `
    UPDATE public.roles
    SET ${sets.join(", ")}
    WHERE id = $${params.length}
    `,
    params
  )
}

export async function listPermissions() {
  const result = await query<PermissionRow>(
    `
    SELECT id, key, description
    FROM public.permissions
    ORDER BY key ASC
    `
  )
  return result.rows
}

export async function assignRoleToUser(input: {
  userId: string
  roleId: string
  assignedBy: string | null
}) {
  await query(
    `
    INSERT INTO public.user_roles (user_id, role_id, assigned_by)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, role_id) DO NOTHING
    `,
    [input.userId, input.roleId, input.assignedBy]
  )
}

export async function setRolePermissions(roleId: string, permissionIds: string[]) {
  const clientDelete = query(
    `
    DELETE FROM public.role_permissions
    WHERE role_id = $1
    `,
    [roleId]
  )
  await clientDelete

  for (const permissionId of permissionIds) {
    await query(
      `
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES ($1, $2)
      ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [roleId, permissionId]
    )
  }
}

export async function listAuditLogs(filters: {
  from?: string
  to?: string
  actor?: string
  action?: string
}) {
  const where: string[] = []
  const params: string[] = []

  if (filters.from) {
    params.push(filters.from)
    where.push(`a.created_at >= $${params.length}::timestamptz`)
  }
  if (filters.to) {
    params.push(filters.to)
    where.push(`a.created_at <= $${params.length}::timestamptz`)
  }
  if (filters.actor) {
    params.push(filters.actor)
    where.push(`a.actor_user_id = $${params.length}::uuid`)
  }
  if (filters.action) {
    params.push(filters.action)
    where.push(`a.action = $${params.length}`)
  }

  const result = await query<AuditRow>(
    `
    SELECT
      a.id,
      a.actor_user_id,
      u.email as actor_email,
      a.action,
      a.entity_type,
      a.entity_id,
      a.metadata,
      to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
      a.ip_address
    FROM public.audit_logs a
    LEFT JOIN public.users u ON u.id = a.actor_user_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY a.created_at DESC
    LIMIT 500
    `,
    params
  )
  return result.rows
}
