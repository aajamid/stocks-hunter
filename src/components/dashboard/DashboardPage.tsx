"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { ErrorBanner } from "@/components/common/ErrorBanner"
import { EmptyState } from "@/components/common/EmptyState"
import { LoadingState } from "@/components/common/LoadingState"
import { DashboardScoreLineChart } from "@/components/charts/DashboardScoreLineChart"
import { FiltersSidebar, type FilterState } from "@/components/dashboard/FiltersSidebar"
import { ScenarioPanel } from "@/components/dashboard/ScenarioPanel"
import { ScreenerTable } from "@/components/dashboard/ScreenerTable"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { percentFormatter } from "@/lib/format"
import { defaultScenario } from "@/lib/scoring"
import type { ScreenerResponse, SymbolMeta } from "@/lib/types"

const toDateString = (date: Date) => date.toISOString().slice(0, 10)

const defaultStart = () => {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return toDateString(date)
}

type SymbolsPayload = {
  symbols: SymbolMeta[]
  sectors: string[]
  markets: string[]
  missingColumns: string[]
}

const readApiError = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: string }
    if (payload?.error) return payload.error
  } catch {
    // Ignore JSON parsing errors and use fallback message.
  }
  return fallback
}

export function DashboardPage() {
  const router = useRouter()
  const [filters, setFilters] = useState<FilterState>({
    start: defaultStart(),
    end: toDateString(new Date()),
    name: "",
    symbols: [],
    sectors: [],
    markets: [],
    activeOnly: true,
  })
  const [scenario, setScenario] = useState(defaultScenario)
  const [symbolsData, setSymbolsData] = useState<SymbolsPayload | null>(null)
  const [screenerData, setScreenerData] = useState<ScreenerResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortBy, setSortBy] = useState("score")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const fetchSymbols = useCallback(async () => {
    try {
      const response = await fetch("/api/symbols")
      if (!response.ok) {
        const errorMessage = await readApiError(
          response,
          "Failed to load symbol metadata."
        )
        throw new Error(errorMessage)
      }
      const payload = (await response.json()) as SymbolsPayload
      setSymbolsData(payload)
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load symbol metadata."
      )
    }
  }, [])

  const buildQueryString = useCallback(
    (format?: "csv") => {
      const params = new URLSearchParams()
      params.set("start", filters.start)
      params.set("end", filters.end)
      if (filters.name) params.set("name", filters.name)
      if (filters.symbols.length)
        params.set("symbols", filters.symbols.join(","))
      if (filters.sectors.length)
        params.set("sectors", filters.sectors.join(","))
      if (filters.markets.length)
        params.set("markets", filters.markets.join(","))
      if (filters.activeOnly) params.set("activeOnly", "true")
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))
      params.set("sortBy", sortBy)
      params.set("sortDir", sortDir)
      params.set("weights", JSON.stringify(scenario.weights))
      params.set("thresholds", JSON.stringify(scenario.thresholds))
      if (format) params.set("format", format)
      return params.toString()
    },
    [filters, page, pageSize, scenario, sortBy, sortDir]
  )

  const fetchScreener = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/screener?${buildQueryString()}`)
      if (!response.ok) {
        const errorMessage = await readApiError(
          response,
          "Failed to load screener data."
        )
        throw new Error(errorMessage)
      }
      const payload = (await response.json()) as ScreenerResponse
      setScreenerData(payload)
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Failed to load screener data."
      )
    } finally {
      setLoading(false)
    }
  }, [buildQueryString])

  useEffect(() => {
    fetchSymbols()
  }, [fetchSymbols])

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchScreener()
    }, 300)
    return () => clearTimeout(timeout)
  }, [fetchScreener])

  useEffect(() => {
    setPage(1)
  }, [filters, scenario, sortBy, sortDir, pageSize])

  const onSortChange = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortDir("desc")
    }
  }

  const handleRowClick = (symbol: string) => {
    const params = new URLSearchParams()
    params.set("start", filters.start)
    params.set("end", filters.end)
    if (filters.sectors.length) params.set("sectors", filters.sectors.join(","))
    if (filters.markets.length) params.set("markets", filters.markets.join(","))
    if (filters.activeOnly) params.set("activeOnly", "true")
    params.set("weights", JSON.stringify(scenario.weights))
    params.set("thresholds", JSON.stringify(scenario.thresholds))
    router.push(`/symbol/${symbol}?${params.toString()}`)
  }

  const totalPages = screenerData
    ? Math.ceil(screenerData.total / screenerData.pageSize)
    : 1

  const summaryStats = useMemo(() => {
    if (!screenerData?.summary) return null
    return {
      avgScore: screenerData.summary.avgScore,
      avgReturnValue: screenerData.summary.avgDailyReturn,
    }
  }, [screenerData])

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-4">
        {symbolsData ? (
          <FiltersSidebar
            symbols={symbolsData.symbols}
            sectors={symbolsData.sectors}
            markets={symbolsData.markets}
            filters={filters}
            onChange={setFilters}
          />
        ) : (
          <LoadingState label="Loading filters..." />
        )}
      </aside>
      <main className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="flex flex-col gap-4 border-border/70 bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Screener Snapshot
                </p>
                <h2 className="text-xl font-semibold">Market pulse</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    (window.location.href = `/api/screener?${buildQueryString("csv")}`)
                  }
                >
                  Export CSV
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="border-border/60 bg-muted/40 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Symbols
                </p>
                <p className="text-lg font-semibold">
                  {screenerData?.total ?? 0}
                </p>
              </Card>
              <Card className="border-border/60 bg-muted/40 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Avg Score
                </p>
                <p className="text-lg font-semibold">
                  {summaryStats?.avgScore !== null &&
                  summaryStats?.avgScore !== undefined
                    ? summaryStats.avgScore.toFixed(2)
                    : "-"}
                </p>
              </Card>
              <Card className="border-border/60 bg-muted/40 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Avg Return
                </p>
                <p className="text-lg font-semibold">
                  {summaryStats?.avgReturnValue !== null &&
                  summaryStats?.avgReturnValue !== undefined
                    ? percentFormatter.format(summaryStats.avgReturnValue)
                    : "-"}
                </p>
              </Card>
            </div>
            <DashboardScoreLineChart series={screenerData?.marketSeries ?? []} />
            {screenerData?.missingColumns?.length ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Missing columns: {screenerData.missingColumns.join(", ")}
              </div>
            ) : null}
          </Card>
          <ScenarioPanel scenario={scenario} onChange={setScenario} />
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        {loading && !screenerData ? (
          <LoadingState />
        ) : screenerData && screenerData.rows.length === 0 ? (
          <EmptyState
            title="No symbols found"
            subtitle="Adjust the filters or expand the date range."
          />
        ) : screenerData ? (
          <>
            <ScreenerTable
              rows={screenerData.rows}
              sortBy={sortBy}
              sortDir={sortDir}
              onSortChange={onSortChange}
              onRowClick={handleRowClick}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, screenerData.total)} of{" "}
                {screenerData.total} results
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                >
                  Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                >
                  Next
                </Button>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs text-foreground"
                >
                  {[25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size} rows
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        ) : (
          <LoadingState />
        )}
      </main>
    </div>
  )
}
