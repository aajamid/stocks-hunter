import { Pool, type PoolConfig, type QueryResult } from "pg"

const globalForPg = globalThis as unknown as { pgPool?: Pool }

function createPool() {
  const connectionString = process.env.DATABASE_URL?.trim()
  if (connectionString) {
    return new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
    })
  }

  const host = process.env.PGHOST ?? process.env.POSTGRES_HOST
  const portRaw = process.env.PGPORT ?? process.env.POSTGRES_PORT
  const database = process.env.PGDATABASE ?? process.env.POSTGRES_DB
  const user = process.env.PGUSER ?? process.env.POSTGRES_USER
  const password = process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD
  const hasDiscreteConfig = Boolean(host || portRaw || database || user || password)

  if (!hasDiscreteConfig) {
    throw new Error(
      "Database is not configured. Set DATABASE_URL in .env.local (or PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD)."
    )
  }

  const parsedPort = Number(portRaw)
  const port =
    Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort <= 65535
      ? parsedPort
      : 5432

  const poolConfig: PoolConfig = {
    host: host ?? "localhost",
    port,
    database: database ?? "postgres",
    user: user ?? "postgres",
    password,
    max: 10,
    idleTimeoutMillis: 30_000,
  }

  return new Pool(poolConfig)
}

export const pool = globalForPg.pgPool ?? createPool()

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool
}

export async function query<T>(
  text: string,
  params: Array<string | number | boolean | string[] | number[] | null> = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params)
}
