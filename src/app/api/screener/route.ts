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
  "avg_volume",
  "avg_turnover",
  "latest_rsi",
  "latest_apx",
])

function sortRows(
  rows: ScreenerRowScored[],
  sortBy: string,
  sortDir: "asc" | "desc"
) {
  const field = sortableFields.has(sortBy) ? sortBy : "score"
  const dir = sortDir === "asc" ? 1 : -1

  return [...rows].sort((a, b) => {
    const aValue = (a as unknown as Record<string, number | null>)[field] ?? 0
    const bValue = (b as unknown as Record<string, number | null>)[field] ?? 0
    return aValue > bValue ? dir : aValue < bValue ? -dir : 0
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rangeDays = parseRangeDays(searchParams)
    const coverage = await ensureRecentBusinessDayCoverage(rangeDays)
    if (coverage.missingAfterCount > 0) {
      console.warn("data coverage warning", coverage)
    }

    const filters = parseScreenerFilters(searchParams)
    const scenario = parseScenarioConfig(searchParams)
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
    const liquidityFiltered = scored.filter((row) => {
      if (
        typeof filters.minPrice === "number" &&
        Number.isFinite(filters.minPrice) &&
        (typeof row.latest_close !== "number" || row.latest_close < filters.minPrice)
      ) {
        return false
      }
      if (
        typeof filters.minAvgVolume === "number" &&
        Number.isFinite(filters.minAvgVolume) &&
        (typeof row.avg_volume !== "number" || row.avg_volume < filters.minAvgVolume)
      ) {
        return false
      }
      if (
        typeof filters.minAvgTurnover === "number" &&
        Number.isFinite(filters.minAvgTurnover) &&
        (typeof row.avg_turnover !== "number" ||
          row.avg_turnover < filters.minAvgTurnover)
      ) {
        return false
      }
      return true
    })
    const scoreFiltered = liquidityFiltered.filter((row) => {
      if (
        typeof filters.scoreMin === "number" &&
        Number.isFinite(filters.scoreMin) &&
        row.score < filters.scoreMin
      ) {
        return false
      }
      if (
        typeof filters.scoreMax === "number" &&
        Number.isFinite(filters.scoreMax) &&
        row.score > filters.scoreMax
      ) {
        return false
      }
      return true
    })
    const sorted = sortRows(scoreFiltered, sortBy, sortDir)

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
      const csv = toCsv(
        pagedRows as unknown as Array<
          Record<string, string | number | boolean | null | undefined>
        >,
        [
        { key: "symbol", label: "symbol" },
        { key: "name_en", label: "name_en" },
        { key: "sector", label: "sector" },
        { key: "market", label: "market" },
        { key: "latest_close", label: "latest_close" },
        { key: "avg_daily_return", label: "avg_daily_return" },
        { key: "avg_momentum_5d", label: "avg_momentum_5d" },
        { key: "avg_volatility_5d", label: "avg_volatility_5d" },
        { key: "avg_volume", label: "avg_volume" },
        { key: "avg_turnover", label: "avg_turnover" },
        { key: "latest_rsi", label: "latest_rsi" },
        { key: "latest_apx", label: "latest_apx" },
        { key: "score", label: "score" },
        ]
      )

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=\"screener.csv\"",
        },
      })
    }

    const latestTradeDate =
      marketSeriesResult.series[marketSeriesResult.series.length - 1]?.trade_date ??
      coverage.end
    const lagDays = (() => {
      if (!latestTradeDate) return null
      const latest = new Date(latestTradeDate)
      if (Number.isNaN(latest.getTime())) return null
      const now = new Date()
      const utcLatest = Date.UTC(
        latest.getUTCFullYear(),
        latest.getUTCMonth(),
        latest.getUTCDate()
      )
      const utcNow = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
      )
      return Math.max(0, Math.floor((utcNow - utcLatest) / (24 * 60 * 60 * 1000)))
    })()
    const freshnessStatus =
      coverage.missingAfterCount > 0 ? "incomplete" : (lagDays ?? 99) <= 2 ? "fresh" : "stale"

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
      dataQuality: {
        latestTradeDate: latestTradeDate ?? null,
        lagDays,
        coverageStart: coverage.start,
        coverageEnd: coverage.end,
        missingSymbols: coverage.missingAfterCount,
        backfillRowsInserted: coverage.backfillRowsInserted,
        status: freshnessStatus,
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
