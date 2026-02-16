import { getCache, setCache } from "@/lib/cache"
import { getAvailableColumns } from "@/lib/columns"
import { query } from "@/lib/db"

const COVERAGE_TTL_MS = 24 * 60 * 60 * 1000
const COVERAGE_RETRY_TTL_MS = 5 * 60 * 1000
const DEFAULT_TARGET_BUSINESS_DAYS = 28
const COVERAGE_TABLE = "saudi_equity_googlefinance_daily"
const BACKFILL_SOURCE_TABLE = "saudi_equity_ohlcv_daily"

type CoverageIssue = {
  symbol: string
  dayCount: number
}

export type CoverageReport = {
  start: string
  end: string
  targetBusinessDays: 14 | 21 | 28
  missingBeforeCount: number
  missingAfterCount: number
  backfillRowsInserted: number
  checkedAt: string
  backfillError?: string
}

const toDateString = (date: Date) => date.toISOString().slice(0, 10)

const isSaudiBusinessDay = (date: Date) => {
  const day = date.getDay()
  return day !== 5 && day !== 6
}

const moveToPreviousSaudiBusinessDay = (date: Date) => {
  const result = new Date(date)
  while (!isSaudiBusinessDay(result)) {
    result.setDate(result.getDate() - 1)
  }
  return result
}

const lastSaudiBusinessDayWindow = (count: number, endDateInput: Date) => {
  const endDate = moveToPreviousSaudiBusinessDay(endDateInput)
  const dates: Date[] = []
  const cursor = new Date(endDate)

  while (dates.length < count) {
    if (isSaudiBusinessDay(cursor)) {
      dates.push(new Date(cursor))
    }
    cursor.setDate(cursor.getDate() - 1)
  }

  dates.sort((a, b) => a.getTime() - b.getTime())
  return {
    start: toDateString(dates[0]),
    end: toDateString(dates[dates.length - 1]),
  }
}

const normalizeRangeDays = (value: number): 14 | 21 | 28 =>
  value === 14 || value === 21 || value === 28
    ? value
    : DEFAULT_TARGET_BUSINESS_DAYS

async function getLatestAvailableTradeDate() {
  const result = await query<{ latest_trade_date: Date | string | null }>(
    `
    SELECT MAX(trade_date) as latest_trade_date
    FROM public.${COVERAGE_TABLE}
  `,
    []
  )

  const rawValue = result.rows[0]?.latest_trade_date
  if (!rawValue) {
    return moveToPreviousSaudiBusinessDay(new Date())
  }

  const parsed = new Date(rawValue)
  if (Number.isNaN(parsed.getTime())) {
    return moveToPreviousSaudiBusinessDay(new Date())
  }

  return moveToPreviousSaudiBusinessDay(parsed)
}

async function getMissingCoverage(
  start: string,
  end: string,
  targetBusinessDays: number
): Promise<CoverageIssue[]> {
  const result = await query<{ symbol: string; day_count: number }>(
    `
    SELECT
      s.symbol,
      COUNT(DISTINCT g.trade_date)::int as day_count
    FROM public.saudi_equity_symbols s
    LEFT JOIN public.${COVERAGE_TABLE} g
      ON g.symbol = s.symbol
      AND g.trade_date BETWEEN $1 AND $2
    WHERE s.is_active = true
    GROUP BY s.symbol
    HAVING COUNT(DISTINCT g.trade_date) < $3
    ORDER BY s.symbol
  `,
    [start, end, targetBusinessDays]
  )

  return result.rows.map((row) => ({
    symbol: row.symbol,
    dayCount: Number(row.day_count),
  }))
}

async function tryBackfillFromOhlcv(start: string, end: string) {
  const targetColumns = await getAvailableColumns(COVERAGE_TABLE)
  const sourceColumns = await getAvailableColumns(BACKFILL_SOURCE_TABLE)

  if (targetColumns.size === 0 || sourceColumns.size === 0) {
    return 0
  }

  const candidateColumns = [
    "symbol",
    "trade_date",
    "open",
    "high",
    "low",
    "close",
    "adjusted",
    "adjusted_close",
    "volume",
    "turnover",
    "source",
  ]
  const insertColumns = candidateColumns.filter(
    (column) => targetColumns.has(column) && sourceColumns.has(column)
  )

  if (!insertColumns.includes("symbol") || !insertColumns.includes("trade_date")) {
    return 0
  }

  const selectColumns = insertColumns.map((column) => `o.${column}`).join(", ")
  const insertColumnSql = insertColumns.join(", ")

  const result = await query<{ inserted_count: number }>(
    `
    WITH inserted AS (
      INSERT INTO public.${COVERAGE_TABLE} (${insertColumnSql})
      SELECT ${selectColumns}
      FROM public.${BACKFILL_SOURCE_TABLE} o
      INNER JOIN public.saudi_equity_symbols s
        ON s.symbol = o.symbol
        AND s.is_active = true
      LEFT JOIN public.${COVERAGE_TABLE} g
        ON g.symbol = o.symbol
        AND g.trade_date = o.trade_date
      WHERE g.symbol IS NULL
        AND o.trade_date BETWEEN $1 AND $2
      ON CONFLICT DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*)::int as inserted_count
    FROM inserted
  `,
    [start, end]
  )

  return Number(result.rows[0]?.inserted_count ?? 0)
}

export async function ensureRecentBusinessDayCoverage(
  targetBusinessDays: 14 | 21 | 28 = DEFAULT_TARGET_BUSINESS_DAYS
): Promise<CoverageReport> {
  const safeTargetBusinessDays = normalizeRangeDays(targetBusinessDays)
  const cacheKey = `coverage:${safeTargetBusinessDays}bd`
  const cached = getCache<CoverageReport>(cacheKey)
  if (cached) return cached

  const latestTradeDate = await getLatestAvailableTradeDate()
  const { start, end } = lastSaudiBusinessDayWindow(
    safeTargetBusinessDays,
    latestTradeDate
  )

  const missingBefore = await getMissingCoverage(
    start,
    end,
    safeTargetBusinessDays
  )
  let backfillRowsInserted = 0
  let backfillError: string | undefined

  if (missingBefore.length > 0) {
    try {
      backfillRowsInserted = await tryBackfillFromOhlcv(start, end)
    } catch (error) {
      backfillError = error instanceof Error ? error.message : "Backfill failed"
      console.error("coverage backfill error", error)
    }
  }

  const missingAfter = await getMissingCoverage(
    start,
    end,
    safeTargetBusinessDays
  )

  const report: CoverageReport = {
    start,
    end,
    targetBusinessDays: safeTargetBusinessDays,
    missingBeforeCount: missingBefore.length,
    missingAfterCount: missingAfter.length,
    backfillRowsInserted,
    checkedAt: new Date().toISOString(),
    ...(backfillError ? { backfillError } : {}),
  }

  const ttlMs = missingAfter.length === 0 ? COVERAGE_TTL_MS : COVERAGE_RETRY_TTL_MS
  setCache(cacheKey, report, ttlMs)
  return report
}
