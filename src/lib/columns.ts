import { getCache, setCache } from "@/lib/cache"
import { query } from "@/lib/db"

const COLUMN_TTL_MS = 5 * 60 * 1000

export async function getAvailableColumns(tableName: string) {
  const cacheKey = `columns:${tableName}`
  const cached = getCache<Set<string>>(cacheKey)
  if (cached) return cached

  const result = await query<{ column_name: string }>(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
  `,
    [tableName]
  )

  const columns = new Set(result.rows.map((row) => row.column_name))
  setCache(cacheKey, columns, COLUMN_TTL_MS)
  return columns
}
