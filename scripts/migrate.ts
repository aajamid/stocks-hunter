import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { Pool, type PoolConfig } from "pg"

function loadLocalEnv() {
  if (typeof process.loadEnvFile !== "function") return

  const envLocal = path.join(process.cwd(), ".env.local")
  const envFile = path.join(process.cwd(), ".env")

  if (existsSync(envLocal)) process.loadEnvFile(envLocal)
  if (existsSync(envFile)) process.loadEnvFile(envFile)
}

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

async function ensureMigrationsTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.app_migrations (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function migrateUp(pool: Pool, migrationsDir: string) {
  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".up.sql"))
    .sort()

  for (const file of files) {
    const already = await pool.query<{ name: string }>(
      `SELECT name FROM public.app_migrations WHERE name = $1`,
      [file]
    )
    if (already.rows.length > 0) continue

    const sqlPath = path.join(migrationsDir, file)
    const sql = await readFile(sqlPath, "utf8")

    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query(sql)
      await client.query(
        `INSERT INTO public.app_migrations (name) VALUES ($1)`,
        [file]
      )
      await client.query("COMMIT")
      console.log(`Applied migration: ${file}`)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }
}

async function migrateDown(pool: Pool, migrationsDir: string) {
  const latest = await pool.query<{ name: string }>(
    `
    SELECT name
    FROM public.app_migrations
    ORDER BY applied_at DESC, id DESC
    LIMIT 1
    `
  )
  const row = latest.rows[0]
  if (!row) {
    console.log("No applied migrations.")
    return
  }

  const upFile = row.name
  const downFile = upFile.replace(/\.up\.sql$/, ".down.sql")
  const downPath = path.join(migrationsDir, downFile)
  const downSql = await readFile(downPath, "utf8")

  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query(downSql)
    await client.query(`DELETE FROM public.app_migrations WHERE name = $1`, [upFile])
    await client.query("COMMIT")
    console.log(`Rolled back migration: ${upFile}`)
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

async function main() {
  const direction = process.argv[2] === "down" ? "down" : "up"
  const projectRoot = process.cwd()
  const migrationsDir = path.join(projectRoot, "db", "migrations")

  loadLocalEnv()
  const pool = createPool()
  try {
    await ensureMigrationsTable(pool)
    if (direction === "down") {
      await migrateDown(pool, migrationsDir)
    } else {
      await migrateUp(pool, migrationsDir)
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
