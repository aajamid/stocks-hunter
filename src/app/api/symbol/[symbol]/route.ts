import { NextResponse, type NextRequest } from "next/server"

import { computeSummary } from "@/lib/metrics"
import { fetchScreenerRows, fetchSymbolSeries } from "@/lib/queries"
import { scoreRows } from "@/lib/scoring"
import { parseDateRange, parseScenarioConfig, parseScreenerFilters } from "@/lib/validators"

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = params.symbol.toUpperCase()
    const { start, end } = parseDateRange(searchParams)
    const scenario = parseScenarioConfig(searchParams)

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
    const scoredRows = scoreRows(screenerData.rows, scenario)
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
    return NextResponse.json(
      { error: "Failed to load symbol details." },
      { status: 500 }
    )
  }
}
