export type AuthUser = {
  id: string
  email: string
  fullName: string | null
  isActive: boolean
  roles: string[]
  permissions: string[]
}

export type AuthContext = {
  user: AuthUser
  sessionId: string
  sessionExpiresAt: string
  sessionToken: string
}

export type AuditLogInput = {
  actorUserId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown> | null
  ipAddress?: string | null
}
