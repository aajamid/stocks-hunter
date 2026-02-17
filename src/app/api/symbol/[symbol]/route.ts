import { NextResponse, type NextRequest } from "next/server"

import { requireAuth, requirePermission } from "@/lib/auth/guard"
import { ensureRecentBusinessDayCoverage } from "@/lib/data-coverage"
import { computeSummary } from "@/lib/metrics"
import { fetchScreenerRows, fetchSymbolEvents, fetchSymbolSeries } from "@/lib/queries"
import { scoreRows } from "@/lib/scoring"
import {
  parseDateRange,
  parseRangeDays,
  parseScreenerFilters,
} from "@/lib/validators"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> }
) {
  try {
    const { context: auth, error } = await requireAuth(request)
    if (!auth) return error
    const permissionError = requirePermission(auth, "investments:read")
    if (permissionError) return permissionError

    const { searchParams } = new URL(request.url)
    const rangeDays = parseRangeDays(searchParams)
    const coverage = await ensureRecentBusinessDayCoverage(rangeDays)
    if (coverage.missingAfterCount > 0) {
      console.warn("data coverage warning", coverage)
    }

    const { symbol: rawSymbol } = await context.params
    const symbol = rawSymbol?.toUpperCase()
    if (!symbol) {
      throw new Error("Symbol parameter is missing")
    }
    const { start, end } = parseDateRange(searchParams)

    const baseFilters = parseScreenerFilters(searchParams)
    const universeFilters = {
      ...baseFilters,
      start,
      end,
      symbols: undefined,
      name: undefined,
    }

    const [seriesData, screenerData] = await Promise.all([
      fetchSymbolSeries(symbol, start, end),
      fetchScreenerRows(universeFilters, rangeDays),
    ])
    const eventsData = await fetchSymbolEvents(symbol, start, end)

    const summary = computeSummary(seriesData.series)
    const scoredRows = scoreRows(screenerData.rows, undefined, rangeDays)
    const scoreRow = scoredRows.find((row) => row.symbol === symbol) ?? null

    return NextResponse.json({
      symbol,
      meta: seriesData.meta,
      series: seriesData.series,
      events: eventsData.events,
      summary,
      score: scoreRow,
      missingColumns: Array.from(
        new Set([
          ...seriesData.missingColumns,
          ...screenerData.missingColumns,
          ...eventsData.missingColumns,
        ])
      ),
      usedColumns: Array.from(
        new Set([
          ...seriesData.usedColumns,
          ...screenerData.usedColumns,
          ...eventsData.usedColumns,
        ])
      ),
      dataQuality: {
        coverageStart: coverage.start,
        coverageEnd: coverage.end,
        missingSymbols: coverage.missingAfterCount,
        backfillRowsInserted: coverage.backfillRowsInserted,
      },
    })
  } catch (error) {
    console.error("symbol api error", error)
    const detail = error instanceof Error ? error.message : undefined
    return NextResponse.json(
      {
        error: detail
          ? `Failed to load symbol details. ${detail}`
          : "Failed to load symbol details.",
      },
      { status: 500 }
    )
  }
}
