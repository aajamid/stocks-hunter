import { Pool, type PoolConfig } from "pg"

import { hashPassword, normalizeEmail } from "../src/lib/auth/crypto"
import {
  defaultPermissions,
  defaultRolePermissions,
  defaultRoles,
} from "../src/lib/auth/rbac"

function createPool() {
  const connectionString = process.env.DATABASE_URL?.trim()
  if (connectionString) {
    return new Pool({ connectionString, max: 4, idleTimeoutMillis: 30_000 })
  }

  const host = process.env.PGHOST ?? process.env.POSTGRES_HOST
  const portRaw = process.env.PGPORT ?? process.env.POSTGRES_PORT
  const database = process.env.PGDATABASE ?? process.env.POSTGRES_DB
  const user = process.env.PGUSER ?? process.env.POSTGRES_USER
  const password = process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD
  if (!host && !database && !user && !password && !portRaw) {
    throw new Error("Database is not configured. Set DATABASE_URL or PG* vars.")
  }

  const parsedPort = Number(portRaw)
  const port =
    Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort <= 65535
      ? parsedPort
      : 5432

  const config: PoolConfig = {
    host: host ?? "localhost",
    port,
    database: database ?? "postgres",
    user: user ?? "postgres",
    password,
    max: 4,
    idleTimeoutMillis: 30_000,
  }
  return new Pool(config)
}

async function main() {
  const adminEmailRaw = process.env.ADMIN_EMAIL?.trim()
  const adminPassword = process.env.ADMIN_PASSWORD?.trim()
  const adminName = process.env.ADMIN_NAME?.trim() || "Admin User"

  if (!adminEmailRaw || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for auth seeding.")
  }

  const adminEmail = normalizeEmail(adminEmailRaw)
  const passwordHash = await hashPassword(adminPassword)

  const pool = createPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    for (const permission of defaultPermissions) {
      await client.query(
        `
        INSERT INTO public.permissions (key, description)
        VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE
        SET description = EXCLUDED.description
        `,
        [permission.key, permission.description]
      )
    }

    for (const role of defaultRoles) {
      await client.query(
        `
        INSERT INTO public.roles (name, description)
        VALUES ($1, $2)
        ON CONFLICT (name) DO UPDATE
        SET description = EXCLUDED.description
        `,
        [role.name, role.description]
      )
    }

    const rolesResult = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM public.roles`
    )
    const permissionsResult = await client.query<{ id: string; key: string }>(
      `SELECT id, key FROM public.permissions`
    )
    const roleByName = new Map(rolesResult.rows.map((row) => [row.name, row.id]))
    const permissionByKey = new Map(
      permissionsResult.rows.map((row) => [row.key, row.id])
    )

    for (const [roleName, permissionKeys] of Object.entries(defaultRolePermissions)) {
      const roleId = roleByName.get(roleName)
      if (!roleId) continue
      for (const permissionKey of permissionKeys) {
        const permissionId = permissionByKey.get(permissionKey)
        if (!permissionId) continue
        await client.query(
          `
          INSERT INTO public.role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, permission_id) DO NOTHING
          `,
          [roleId, permissionId]
        )
      }
    }

    const upsertAdmin = await client.query<{ id: string }>(
      `
      INSERT INTO public.users (email, password_hash, full_name, is_active)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          full_name = EXCLUDED.full_name,
          is_active = TRUE,
          updated_at = NOW()
      RETURNING id
      `,
      [adminEmail, passwordHash, adminName]
    )
    const adminId = upsertAdmin.rows[0]?.id
    if (!adminId) {
      throw new Error("Failed to create or update admin user.")
    }

    const adminRoleId = roleByName.get("ADMIN")
    if (!adminRoleId) {
      throw new Error("ADMIN role not found after seeding.")
    }

    await client.query(
      `
      INSERT INTO public.user_roles (user_id, role_id, assigned_by)
      VALUES ($1, $2, $1)
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      [adminId, adminRoleId]
    )

    await client.query("COMMIT")
    console.log(`Auth seed complete. Admin user: ${adminEmail}`)
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
