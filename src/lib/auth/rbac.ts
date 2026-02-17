export const defaultPermissions = [
  { key: "investments:read", description: "Read screener and symbol investment data." },
  { key: "investments:write", description: "Create and update user investment artifacts." },
  { key: "admin:users:read", description: "View users in the admin panel." },
  { key: "admin:users:manage", description: "Create/update/deactivate users." },
  { key: "admin:roles:read", description: "View roles in the admin panel." },
  { key: "admin:roles:manage", description: "Create/update roles and mappings." },
  { key: "admin:permissions:read", description: "View permissions list." },
  { key: "admin:audit:read", description: "View security and admin audit logs." },
  { key: "admin:all", description: "Platform super admin access." },
] as const

export const defaultRoles = [
  { name: "ADMIN", description: "Full access to all resources and admin controls." },
  { name: "MANAGER", description: "Manage investments and team workflows." },
  { name: "ANALYST", description: "Analyze and save investment scenarios." },
  { name: "VIEWER", description: "Read-only access to investment data." },
] as const

export const defaultRolePermissions: Record<string, string[]> = {
  ADMIN: defaultPermissions.map((permission) => permission.key),
  MANAGER: [
    "investments:read",
    "investments:write",
  ],
  ANALYST: [
    "investments:read",
    "investments:write",
  ],
  VIEWER: ["investments:read"],
}
