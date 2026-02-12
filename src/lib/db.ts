import { Pool, type QueryResult } from "pg"

const globalForPg = globalThis as unknown as { pgPool?: Pool }

function createPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
  })
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
