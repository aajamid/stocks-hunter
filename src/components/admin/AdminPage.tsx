"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type AdminUser = {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
  roles: string[] | null
}

type AdminRole = {
  id: string
  name: string
  description: string | null
  created_at: string
  permissions: string[] | null
}

type Permission = {
  id: string
  key: string
  description: string | null
}

type AuditLog = {
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

type MePayload = {
  user: {
    id: string
    roles: string[]
    permissions: string[]
  }
}

function isStrongPassword(value: string) {
  return (
    value.length >= 10 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  )
}

async function readApiError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null
  return payload?.error ?? fallback
}

export function AdminPage() {
  const [me, setMe] = useState<MePayload["user"] | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserName, setNewUserName] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")

  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleDescription, setNewRoleDescription] = useState("")
  const [selectedRoleId, setSelectedRoleId] = useState("")
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([])
  const [assignRoleByUser, setAssignRoleByUser] = useState<Record<string, string>>({})

  const [auditAction, setAuditAction] = useState("")
  const [auditActor, setAuditActor] = useState("")
  const [auditFrom, setAuditFrom] = useState("")
  const [auditTo, setAuditTo] = useState("")

  const canManageAdmin = useMemo(() => {
    if (!me) return false
    const roleSet = new Set(me.roles.map((role) => role.toUpperCase()))
    const permissionSet = new Set(me.permissions)
    return (
      roleSet.has("ADMIN") ||
      permissionSet.has("admin:all") ||
      permissionSet.has("admin:users:read")
    )
  }, [me])

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  )
  const isCreateUserPasswordValid = useMemo(
    () => isStrongPassword(newUserPassword),
    [newUserPassword]
  )
  const canCreateUser = useMemo(
    () =>
      !saving &&
      newUserEmail.trim().length > 0 &&
      newUserName.trim().length > 0 &&
      isCreateUserPasswordValid,
    [isCreateUserPasswordValid, newUserEmail, newUserName, saving]
  )

  const refreshUsers = useCallback(async () => {
    const response = await fetch("/api/admin/users")
    if (!response.ok) {
      throw new Error(await readApiError(response, "Failed to load users."))
    }
    const payload = (await response.json()) as { users: AdminUser[] }
    setUsers(payload.users)
  }, [])

  const refreshRoles = useCallback(async () => {
    const response = await fetch("/api/admin/roles")
    if (!response.ok) {
      throw new Error(await readApiError(response, "Failed to load roles."))
    }
    const payload = (await response.json()) as { roles: AdminRole[] }
    setRoles(payload.roles)
    setSelectedRoleId((prev) => {
      if (prev) return prev
      return payload.roles[0]?.id ?? ""
    })
  }, [])

  const refreshPermissions = useCallback(async () => {
    const response = await fetch("/api/admin/permissions")
    if (!response.ok) {
      throw new Error(await readApiError(response, "Failed to load permissions."))
    }
    const payload = (await response.json()) as { permissions: Permission[] }
    setPermissions(payload.permissions)
  }, [])

  const refreshAuditLogs = useCallback(async () => {
    const params = new URLSearchParams()
    if (auditAction) params.set("action", auditAction)
    if (auditActor) params.set("actor", auditActor)
    if (auditFrom) params.set("from", auditFrom)
    if (auditTo) params.set("to", auditTo)

    const response = await fetch(`/api/admin/audit-logs?${params.toString()}`)
    if (!response.ok) {
      throw new Error(await readApiError(response, "Failed to load audit logs."))
    }
    const payload = (await response.json()) as { logs: AuditLog[] }
    setAuditLogs(payload.logs)
  }, [auditAction, auditActor, auditFrom, auditTo])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const meResponse = await fetch("/api/auth/me")
        if (!meResponse.ok) {
          throw new Error(await readApiError(meResponse, "Authentication required."))
        }
        const mePayload = (await meResponse.json()) as MePayload
        setMe(mePayload.user)

        await Promise.all([
          refreshUsers(),
          refreshRoles(),
          refreshPermissions(),
          refreshAuditLogs(),
        ])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load admin data.")
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [refreshAuditLogs, refreshPermissions, refreshRoles, refreshUsers])

  useEffect(() => {
    if (!selectedRole) return
    const rolePermissionKeys = new Set(selectedRole.permissions ?? [])
    const permissionIds = permissions
      .filter((permission) => rolePermissionKeys.has(permission.key))
      .map((permission) => permission.id)
    setSelectedPermissionIds(permissionIds)
  }, [permissions, selectedRole])

  const createUser = async () => {
    if (!isCreateUserPasswordValid) {
      setError(
        "Password must be at least 10 characters and include uppercase, lowercase, number, and symbol."
      )
      return
    }
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newUserEmail,
          fullName: newUserName,
          password: newUserPassword,
          isActive: true,
        }),
      })
      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to create user."))
      }
      setNewUserEmail("")
      setNewUserName("")
      setNewUserPassword("")
      await Promise.all([refreshUsers(), refreshAuditLogs()])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.")
    } finally {
      setSaving(false)
    }
  }

  const updateUserState = async (user: AdminUser, isActive: boolean) => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      })
      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update user."))
      }
      await Promise.all([refreshUsers(), refreshAuditLogs()])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user.")
    } finally {
      setSaving(false)
    }
  }

  const resetUserPassword = async (user: AdminUser) => {
    const nextPassword = window.prompt(`Set a new password for ${user.email}`)
    if (!nextPassword) return

    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: nextPassword }),
      })
      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to reset password."))
      }
      await refreshAuditLogs()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password.")
    } finally {
      setSaving(false)
    }
  }

  const assignRole = async (userId: string) => {
    const roleId = assignRoleByUser[userId]
    if (!roleId) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/role-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role_id: roleId }),
      })
      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to assign role."))
      }
      await Promise.all([refreshUsers(), refreshAuditLogs()])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign role.")
    } finally {
      setSaving(false)
    }
  }

  const createRole = async () => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName,
          description: newRoleDescription,
        }),
      })
      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to create role."))
      }
      setNewRoleName("")
      setNewRoleDescription("")
      await Promise.all([refreshRoles(), refreshAuditLogs()])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create role.")
    } finally {
      setSaving(false)
    }
  }

  const saveRolePermissions = async () => {
    if (!selectedRoleId) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/role-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: selectedRoleId,
          permission_ids: selectedPermissionIds,
        }),
      })
      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to save role permissions."))
      }
      await Promise.all([refreshRoles(), refreshAuditLogs()])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update role permissions."
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Card className="p-4">Loading admin workspace...</Card>
  }

  if (!canManageAdmin) {
    return (
      <Card className="p-4">
        <p className="text-sm text-destructive">You do not have admin access.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Card className="border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </Card>
      ) : null}

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="audit">Audit logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card className="space-y-3 border-border/70 bg-card/60 p-4">
            <p className="text-sm font-semibold">Create user</p>
            <div className="grid gap-2 md:grid-cols-3">
              <Input
                value={newUserEmail}
                onChange={(event) => setNewUserEmail(event.target.value)}
                placeholder="email@domain.com"
              />
              <Input
                value={newUserName}
                onChange={(event) => setNewUserName(event.target.value)}
                placeholder="Full name"
              />
              <Input
                value={newUserPassword}
                onChange={(event) => setNewUserPassword(event.target.value)}
                placeholder="Temporary password"
                type="password"
                minLength={10}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Password rules: at least 10 chars, with uppercase, lowercase,
              number, and symbol.
            </p>
            <Button
              onClick={createUser}
              disabled={!canCreateUser}
            >
              Create user
            </Button>
          </Card>

          <Card className="overflow-x-auto border-border/70 bg-card/60 p-0">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-left text-xs uppercase tracking-[0.2em]">
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Roles</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Last Login</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-border/40">
                    <td className="px-3 py-2">{user.email}</td>
                    <td className="px-3 py-2">{user.full_name ?? "-"}</td>
                    <td className="px-3 py-2">{(user.roles ?? []).join(", ") || "-"}</td>
                    <td className="px-3 py-2">
                      {user.is_active ? "Active" : "Inactive"}
                    </td>
                    <td className="px-3 py-2">{user.last_login_at ?? "-"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateUserState(user, !user.is_active)}
                          disabled={saving}
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resetUserPassword(user)}
                          disabled={saving}
                        >
                          Reset password
                        </Button>
                        <Select
                          value={assignRoleByUser[user.id] ?? undefined}
                          onValueChange={(value) =>
                            setAssignRoleByUser((prev) => ({ ...prev, [user.id]: value }))
                          }
                        >
                          <SelectTrigger className="h-8 w-[170px]">
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={() => assignRole(user.id)}
                          disabled={saving || !assignRoleByUser[user.id]}
                        >
                          Assign
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card className="space-y-3 border-border/70 bg-card/60 p-4">
            <p className="text-sm font-semibold">Create role</p>
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                value={newRoleName}
                onChange={(event) => setNewRoleName(event.target.value)}
                placeholder="Role name (e.g. RISK_MANAGER)"
              />
              <Input
                value={newRoleDescription}
                onChange={(event) => setNewRoleDescription(event.target.value)}
                placeholder="Description"
              />
            </div>
            <Button onClick={createRole} disabled={saving || !newRoleName.trim()}>
              Create role
            </Button>
          </Card>

          <Card className="space-y-3 border-border/70 bg-card/60 p-4">
            <div className="space-y-2">
              <Label htmlFor="role-permissions-target">Role permissions</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger id="role-permissions-target">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRole?.description ? (
                <p className="text-xs text-muted-foreground">
                  {selectedRole.description}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {permissions.map((permission) => {
                const checked = selectedPermissionIds.includes(permission.id)
                return (
                  <label
                    key={permission.id}
                    className="flex items-start gap-2 rounded-md border border-border/60 px-2 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedPermissionIds((prev) =>
                          checked
                            ? prev.filter((id) => id !== permission.id)
                            : [...prev, permission.id]
                        )
                      }
                    />
                    <span>
                      <span className="block text-sm">{permission.key}</span>
                      <span className="text-xs text-muted-foreground">
                        {permission.description ?? "-"}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>

            <Button onClick={saveRolePermissions} disabled={saving || !selectedRoleId}>
              Save permissions
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card className="space-y-3 border-border/70 bg-card/60 p-4">
            <p className="text-sm font-semibold">Audit filters</p>
            <div className="grid gap-2 md:grid-cols-4">
              <Input
                placeholder="Action"
                value={auditAction}
                onChange={(event) => setAuditAction(event.target.value)}
              />
              <Input
                placeholder="Actor user id"
                value={auditActor}
                onChange={(event) => setAuditActor(event.target.value)}
              />
              <div>
                <Label htmlFor="audit-from">From</Label>
                <Input
                  id="audit-from"
                  type="date"
                  value={auditFrom}
                  onChange={(event) => setAuditFrom(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="audit-to">To</Label>
                <Input
                  id="audit-to"
                  type="date"
                  value={auditTo}
                  onChange={(event) => setAuditTo(event.target.value)}
                />
              </div>
            </div>
            <Button onClick={refreshAuditLogs} disabled={saving}>
              Refresh logs
            </Button>
          </Card>

          <Card className="overflow-x-auto border-border/70 bg-card/60 p-0">
            <table className="min-w-[1000px] w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-left text-xs uppercase tracking-[0.2em]">
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Entity</th>
                  <th className="px-3 py-2">Entity ID</th>
                  <th className="px-3 py-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-t border-border/40">
                    <td className="px-3 py-2">{log.created_at}</td>
                    <td className="px-3 py-2">{log.actor_email ?? log.actor_user_id ?? "-"}</td>
                    <td className="px-3 py-2">{log.action}</td>
                    <td className="px-3 py-2">{log.entity_type}</td>
                    <td className="px-3 py-2">{log.entity_id ?? "-"}</td>
                    <td className="px-3 py-2">{log.ip_address ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
