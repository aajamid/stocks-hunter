import { NextResponse, type NextRequest } from "next/server"

import { ensureRecentBusinessDayCoverage } from "@/lib/data-coverage"
import { computeSummary } from "@/lib/metrics"
import { fetchScreenerRows, fetchSymbolSeries } from "@/lib/queries"
import { scoreRows } from "@/lib/scoring"
import {
  parseDateRange,
  parseRangeDays,
  parseScenarioConfig,
  parseScreenerFilters,
} from "@/lib/validators"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> }
) {
  try {
    const coverage = await ensureRecentBusinessDayCoverage()
    if (coverage.missingAfterCount > 0) {
      console.warn("data coverage warning", coverage)
    }

    const { searchParams } = new URL(request.url)
    const { symbol: rawSymbol } = await context.params
    const symbol = rawSymbol?.toUpperCase()
    if (!symbol) {
      throw new Error("Symbol parameter is missing")
    }
    const { start, end } = parseDateRange(searchParams)
    const scenario = parseScenarioConfig(searchParams)
    const rangeDays = parseRangeDays(searchParams)

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
      fetchScreenerRows(universeFilters),
    ])

    const summary = computeSummary(seriesData.series)
    const scoredRows = scoreRows(screenerData.rows, scenario, rangeDays)
    const scoreRow = scoredRows.find((row) => row.symbol === symbol) ?? null

    return NextResponse.json({
      symbol,
      meta: seriesData.meta,
      series: seriesData.series,
      summary,
      score: scoreRow,
      missingColumns: Array.from(
        new Set([...seriesData.missingColumns, ...screenerData.missingColumns])
      ),
      usedColumns: Array.from(
        new Set([...seriesData.usedColumns, ...screenerData.usedColumns])
      ),
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
