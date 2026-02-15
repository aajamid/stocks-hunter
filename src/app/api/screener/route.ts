import { NextResponse, type NextRequest } from "next/server"

import { toCsv } from "@/lib/csv"
import { ensureRecentBusinessDayCoverage } from "@/lib/data-coverage"
import { fetchMarketPriceSeries, fetchScreenerRows } from "@/lib/queries"
import { scoreRows } from "@/lib/scoring"
import type { ScreenerRowScored } from "@/lib/types"
import {
  parseFormat,
  parsePagination,
  parseRangeDays,
  parseScenarioConfig,
  parseScreenerFilters,
  parseSort,
} from "@/lib/validators"

const sortableFields = new Set([
  "score",
  "latest_close",
  "avg_daily_return",
  "avg_momentum_5d",
  "avg_volatility_5d",
  "avg_volume_spike_ratio",
])

function sortRows(
  rows: ScreenerRowScored[],
  sortBy: string,
  sortDir: "asc" | "desc"
) {
  const field = sortableFields.has(sortBy) ? sortBy : "score"
  const dir = sortDir === "asc" ? 1 : -1

  return [...rows].sort((a, b) => {
    const aValue = (a as Record<string, number | null>)[field] ?? 0
    const bValue = (b as Record<string, number | null>)[field] ?? 0
    return aValue > bValue ? dir : aValue < bValue ? -dir : 0
  })
}

export async function GET(request: NextRequest) {
  try {
    const coverage = await ensureRecentBusinessDayCoverage()
    if (coverage.missingAfterCount > 0) {
      console.warn("data coverage warning", coverage)
    }

    const { searchParams } = new URL(request.url)
    const filters = parseScreenerFilters(searchParams)
    const scenario = parseScenarioConfig(searchParams)
    const rangeDays = parseRangeDays(searchParams)
    const { page, pageSize } = parsePagination(searchParams)
    const { sortBy, sortDir } = parseSort(searchParams)
    const format = parseFormat(searchParams)

    const [screenerRowsResult, marketSeriesResult] = await Promise.all([
      fetchScreenerRows(filters, rangeDays),
      fetchMarketPriceSeries(filters, rangeDays),
    ])
    const {
      rows,
      missingColumns: screenerMissingColumns,
      usedColumns: screenerUsedColumns,
    } = screenerRowsResult

    const scored = scoreRows(rows, scenario, rangeDays)
    const sorted = sortRows(scored, sortBy, sortDir)

    const total = sorted.length
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const pagedRows = format === "csv" ? sorted : sorted.slice(start, end)

    const avgScore =
      sorted.length > 0
        ? sorted.reduce((sum, row) => sum + row.score, 0) / sorted.length
        : null
    const avgDailyReturnValues = sorted
      .map((row) => row.avg_daily_return)
      .filter((value): value is number => typeof value === "number")
    const avgDailyReturn =
      avgDailyReturnValues.length > 0
        ? avgDailyReturnValues.reduce((sum, value) => sum + value, 0) /
          avgDailyReturnValues.length
        : null

    if (format === "csv") {
      const csv = toCsv(pagedRows, [
        { key: "symbol", label: "symbol" },
        { key: "name_en", label: "name_en" },
        { key: "sector", label: "sector" },
        { key: "market", label: "market" },
        { key: "latest_close", label: "latest_close" },
        { key: "avg_daily_return", label: "avg_daily_return" },
        { key: "avg_momentum_5d", label: "avg_momentum_5d" },
        { key: "avg_volatility_5d", label: "avg_volatility_5d" },
        { key: "score", label: "score" },
      ])

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=\"screener.csv\"",
        },
      })
    }

    return NextResponse.json({
      rows: pagedRows,
      marketSeries: marketSeriesResult.series,
      total,
      page,
      pageSize,
      missingColumns: Array.from(
        new Set([...screenerMissingColumns, ...marketSeriesResult.missingColumns])
      ),
      usedColumns: Array.from(
        new Set([...screenerUsedColumns, ...marketSeriesResult.usedColumns])
      ),
      summary: {
        avgScore,
        avgDailyReturn,
      },
    })
  } catch (error) {
    console.error("screener api error", error)
    const detail = error instanceof Error ? error.message : undefined
    return NextResponse.json(
      {
        error: detail
          ? `Failed to load screener data. ${detail}`
          : "Failed to load screener data.",
      },
      { status: 500 }
    )
  }
}
