"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FlaskConical, SlidersHorizontal, X } from "lucide-react"

import { ErrorBanner } from "@/components/common/ErrorBanner"
import { EmptyState } from "@/components/common/EmptyState"
import { LoadingState } from "@/components/common/LoadingState"
import { DashboardScoreLineChart } from "@/components/charts/DashboardScoreLineChart"
import { FiltersSidebar, type FilterState } from "@/components/dashboard/FiltersSidebar"
import { ScenarioPanel } from "@/components/dashboard/ScenarioPanel"
import { ScreenerTable } from "@/components/dashboard/ScreenerTable"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { numberFormatter, percentFormatter } from "@/lib/format"
import { defaultScenario } from "@/lib/scoring"
import type { ScreenerResponse, SymbolMeta } from "@/lib/types"

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

const subtractSaudiBusinessDays = (date: Date, businessDays: number) => {
  const result = new Date(date)
  let remaining = businessDays
  while (remaining > 0) {
    result.setDate(result.getDate() - 1)
    if (isSaudiBusinessDay(result)) {
      remaining -= 1
    }
  }
  return result
}

const resolveRollingDateRange = (rangeDays: 14 | 21 | 28) => {
  const end = moveToPreviousSaudiBusinessDay(new Date())
  const start = subtractSaudiBusinessDays(end, rangeDays - 1)
  return {
    start: toDateString(start),
    end: toDateString(end),
  }
}

type SymbolsPayload = {
  symbols: SymbolMeta[]
  sectors: string[]
  markets: string[]
  missingColumns: string[]
}

type SavedScan = {
  id: string
  name: string
  filters: FilterState
  sortBy: string
  sortDir: "asc" | "desc"
}

const WATCHLIST_KEY = "stocks-hunter:watchlist"
const SAVED_SCANS_KEY = "stocks-hunter:saved-scans"

const cloneFilters = (value: FilterState): FilterState => ({
  rangeMode: "rolling",
  rangeDays: value.rangeDays === 21 || value.rangeDays === 28 ? value.rangeDays : 14,
  name: value.name ?? "",
  scoreRange:
    Array.isArray(value.scoreRange) && value.scoreRange.length === 2
      ? [value.scoreRange[0], value.scoreRange[1]]
      : [0, 100],
  minPrice: value.minPrice ?? "",
  minAvgVolume: value.minAvgVolume ?? "",
  minAvgTurnover: value.minAvgTurnover ?? "",
  symbols: Array.isArray(value.symbols) ? [...value.symbols] : [],
  sectors: Array.isArray(value.sectors) ? [...value.sectors] : [],
  markets: Array.isArray(value.markets) ? [...value.markets] : [],
  activeOnly: value.activeOnly ?? true,
})

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
    rangeMode: "rolling",
    rangeDays: 14,
    name: "",
    scoreRange: [0, 100],
    minPrice: "",
    minAvgVolume: "",
    minAvgTurnover: "",
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [mobileScenarioOpen, setMobileScenarioOpen] = useState(false)
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([])
  const [savedScans, setSavedScans] = useState<SavedScan[]>([])
  const [savedScanName, setSavedScanName] = useState("")
  const [selectedSavedScanId, setSelectedSavedScanId] = useState("")
  const [riskAccountSize, setRiskAccountSize] = useState("100000")
  const [riskPercent, setRiskPercent] = useState("1")
  const [riskEntry, setRiskEntry] = useState("")
  const [riskStop, setRiskStop] = useState("")
  const [alertThreshold, setAlertThreshold] = useState("80")
  const tableSectionRef = useRef<HTMLDivElement | null>(null)

  const dateRange = useMemo(
    () => resolveRollingDateRange(filters.rangeDays),
    [filters.rangeDays]
  )

  const fetchSymbols = useCallback(async () => {
    try {
      const response = await fetch("/api/symbols")
      if (response.status === 401) {
        const nextPath =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/"
        router.replace(`/login?next=${encodeURIComponent(nextPath)}`)
        return
      }
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
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load symbol metadata."
      )
    }
  }, [router])

  const buildQueryString = useCallback(
    (format?: "csv") => {
      const params = new URLSearchParams()
      params.set("start", dateRange.start)
      params.set("end", dateRange.end)
      if (filters.name) params.set("name", filters.name)
      if (filters.symbols.length)
        params.set("symbols", filters.symbols.join(","))
      if (filters.sectors.length)
        params.set("sectors", filters.sectors.join(","))
      if (filters.markets.length)
        params.set("markets", filters.markets.join(","))
      if (filters.activeOnly) params.set("activeOnly", "true")
      const [scoreMin, scoreMax] = filters.scoreRange
      if (scoreMin > 0) params.set("scoreMin", String(scoreMin))
      if (scoreMax < 100) params.set("scoreMax", String(scoreMax))
      const minPrice = Number(filters.minPrice)
      if (filters.minPrice.trim() && Number.isFinite(minPrice) && minPrice >= 0) {
        params.set("minPrice", String(minPrice))
      }
      const minAvgVolume = Number(filters.minAvgVolume)
      if (
        filters.minAvgVolume.trim() &&
        Number.isFinite(minAvgVolume) &&
        minAvgVolume >= 0
      ) {
        params.set("minAvgVolume", String(minAvgVolume))
      }
      const minAvgTurnover = Number(filters.minAvgTurnover)
      if (
        filters.minAvgTurnover.trim() &&
        Number.isFinite(minAvgTurnover) &&
        minAvgTurnover >= 0
      ) {
        params.set("minAvgTurnover", String(minAvgTurnover))
      }
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))
      params.set("sortBy", sortBy)
      params.set("sortDir", sortDir)
      params.set("rangeDays", String(filters.rangeDays))
      params.set("weights", JSON.stringify(scenario.weights))
      params.set("thresholds", JSON.stringify(scenario.thresholds))
      if (format) params.set("format", format)
      return params.toString()
    },
    [dateRange, filters, page, pageSize, scenario, sortBy, sortDir]
  )

  const fetchScreener = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/screener?${buildQueryString()}`)
      if (response.status === 401) {
        const nextPath =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/"
        router.replace(`/login?next=${encodeURIComponent(nextPath)}`)
        return
      }
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
      setError(
        err instanceof Error ? err.message : "Failed to load screener data."
      )
    } finally {
      setLoading(false)
    }
  }, [buildQueryString, router])

  useEffect(() => {
    fetchSymbols()
  }, [fetchSymbols])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const watchlistRaw = window.localStorage.getItem(WATCHLIST_KEY)
      if (watchlistRaw) {
        const parsed = JSON.parse(watchlistRaw) as unknown
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .filter((item): item is string => typeof item === "string" && item.length > 0)
            .map((item) => item.toUpperCase())
          setWatchlistSymbols(Array.from(new Set(cleaned)))
        }
      }
      const scansRaw = window.localStorage.getItem(SAVED_SCANS_KEY)
      if (scansRaw) {
        const parsed = JSON.parse(scansRaw) as unknown
        if (Array.isArray(parsed)) {
          const safeScans = parsed
            .filter(
              (item): item is SavedScan =>
                typeof item === "object" &&
                item !== null &&
                typeof (item as SavedScan).id === "string" &&
                typeof (item as SavedScan).name === "string" &&
                typeof (item as SavedScan).filters === "object" &&
                item !== null
            )
            .slice(0, 20)
          setSavedScans(safeScans)
        }
      }
    } catch {
      // Ignore malformed local storage payloads.
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlistSymbols))
  }, [watchlistSymbols])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(SAVED_SCANS_KEY, JSON.stringify(savedScans))
  }, [savedScans])

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchScreener()
    }, 300)
    return () => clearTimeout(timeout)
  }, [fetchScreener])

  useEffect(() => {
    setPage(1)
  }, [filters, scenario, sortBy, sortDir, pageSize])

  useEffect(() => {
    if (mobileFiltersOpen || mobileScenarioOpen) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }
    document.body.style.overflow = ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileFiltersOpen, mobileScenarioOpen])

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
    params.set("start", dateRange.start)
    params.set("end", dateRange.end)
    if (filters.sectors.length) params.set("sectors", filters.sectors.join(","))
    if (filters.markets.length) params.set("markets", filters.markets.join(","))
    if (filters.activeOnly) params.set("activeOnly", "true")
    params.set("rangeDays", String(filters.rangeDays))
    params.set("weights", JSON.stringify(scenario.weights))
    params.set("thresholds", JSON.stringify(scenario.thresholds))
    router.push(`/symbol/${symbol}?${params.toString()}`)
  }

  const handleToggleSymbolFilter = useCallback(
    (symbol: string, checked: boolean) => {
      setFilters((prev) => {
        if (checked) {
          if (prev.symbols.includes(symbol)) return prev
          return { ...prev, symbols: [...prev.symbols, symbol] }
        }
        return {
          ...prev,
          symbols: prev.symbols.filter((item) => item !== symbol),
        }
      })
    },
    []
  )

  const handleToggleWatchlist = useCallback((symbol: string) => {
    setWatchlistSymbols((prev) => {
      const normalized = symbol.toUpperCase()
      if (prev.includes(normalized)) {
        return prev.filter((item) => item !== normalized)
      }
      return [...prev, normalized]
    })
  }, [])

  const saveCurrentScan = useCallback(() => {
    const name = savedScanName.trim()
    if (!name) return
    const next: SavedScan = {
      id: `scan-${Date.now()}`,
      name,
      filters: cloneFilters(filters),
      sortBy,
      sortDir,
    }
    setSavedScans((prev) => [next, ...prev].slice(0, 20))
    setSavedScanName("")
    setSelectedSavedScanId(next.id)
  }, [filters, savedScanName, sortBy, sortDir])

  const applySavedScan = useCallback(
    (scanId: string) => {
      setSelectedSavedScanId(scanId)
      const selected = savedScans.find((scan) => scan.id === scanId)
      if (!selected) return
      setFilters(cloneFilters(selected.filters))
      setSortBy(selected.sortBy)
      setSortDir(selected.sortDir)
      setPage(1)
    },
    [savedScans]
  )

  const deleteSavedScan = useCallback(
    (scanId: string) => {
      setSavedScans((prev) => prev.filter((scan) => scan.id !== scanId))
      if (selectedSavedScanId === scanId) {
        setSelectedSavedScanId("")
      }
    },
    [selectedSavedScanId]
  )

  const applyTopMoversQuickAction = useCallback(() => {
    setSortBy("avg_daily_return")
    setSortDir("desc")
    setPage(1)
  }, [])

  const applyWatchlistQuickAction = useCallback(() => {
    if (!watchlistSymbols.length) return
    setFilters((prev) => ({ ...prev, symbols: [...watchlistSymbols] }))
    setPage(1)
  }, [watchlistSymbols])

  const applyHighScoreQuickAction = useCallback(() => {
    setFilters((prev) => ({ ...prev, scoreRange: [70, 100] }))
    setSortBy("score")
    setSortDir("desc")
    setPage(1)
  }, [])

  const applyAlertsQuickAction = useCallback(() => {
    const threshold = Number(alertThreshold)
    const safeThreshold =
      Number.isFinite(threshold) && threshold >= 0 && threshold <= 100
        ? threshold
        : 80
    setFilters((prev) => ({
      ...prev,
      symbols: [...watchlistSymbols],
      scoreRange: [safeThreshold, 100],
    }))
    setSortBy("score")
    setSortDir("desc")
    setPage(1)
  }, [alertThreshold, watchlistSymbols])

  const scrollToTable = useCallback(() => {
    tableSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

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

  const companyName = useMemo(() => {
    const nameFilter = filters.name.trim()
    if (nameFilter) return nameFilter
    const firstRow = screenerData?.rows?.[0]
    if (firstRow?.name_en) return firstRow.name_en
    return "All Companies"
  }, [filters.name, screenerData])

  const avgScoreTitle = useMemo(() => {
    return `Universe average score. Score formula per symbol: 100 - (down days x (100 / ${filters.rangeDays})).`
  }, [filters.rangeDays])

  const watchlistRows = useMemo(() => {
    if (!screenerData) return []
    const symbols = new Set(watchlistSymbols)
    return screenerData.rows.filter((row) => symbols.has(row.symbol))
  }, [screenerData, watchlistSymbols])

  const scoreAlerts = useMemo(() => {
    const threshold = Number(alertThreshold)
    const safeThreshold =
      Number.isFinite(threshold) && threshold >= 0 && threshold <= 100
        ? threshold
        : 80
    return watchlistRows.filter((row) => row.score >= safeThreshold)
  }, [alertThreshold, watchlistRows])

  const dataQuality = screenerData?.dataQuality
  const dataQualityClass =
    dataQuality?.status === "fresh"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : dataQuality?.status === "stale"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-destructive/40 bg-destructive/10 text-destructive"

  const riskMetrics = useMemo(() => {
    const account = Number(riskAccountSize)
    const riskPct = Number(riskPercent)
    const entry = Number(riskEntry)
    const stop = Number(riskStop)

    if (
      !Number.isFinite(account) ||
      !Number.isFinite(riskPct) ||
      !Number.isFinite(entry) ||
      !Number.isFinite(stop) ||
      account <= 0 ||
      riskPct <= 0 ||
      entry <= 0 ||
      stop <= 0
    ) {
      return null
    }

    const riskAmount = (account * riskPct) / 100
    const perShareRisk = Math.abs(entry - stop)
    if (perShareRisk <= 0) return null
    const quantity = Math.floor(riskAmount / perShareRisk)
    const positionValue = quantity * entry
    const targetPrice = entry > stop ? entry + 2 * perShareRisk : entry - 2 * perShareRisk

    return {
      riskAmount,
      perShareRisk,
      quantity,
      positionValue,
      targetPrice,
    }
  }, [riskAccountSize, riskPercent, riskEntry, riskStop])

  return (
    <div className="grid gap-4 md:gap-6 lg:h-[calc(100dvh-190px)] lg:grid-cols-[320px_1fr]">
      {mobileFiltersOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 lg:hidden"
          onClick={() => setMobileFiltersOpen(false)}
          aria-hidden="true"
        >
          <aside
            className="absolute left-0 top-0 h-full w-[92vw] max-w-sm overflow-y-auto border-r border-border/60 bg-background p-4"
            aria-label="Dashboard filters"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Filters</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
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
        </div>
      ) : null}

      {mobileScenarioOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 lg:hidden"
          onClick={() => setMobileScenarioOpen(false)}
          aria-hidden="true"
        >
          <aside
            className="absolute right-0 top-0 h-full w-[92vw] max-w-sm overflow-y-auto border-l border-border/60 bg-background p-4"
            aria-label="Scenario settings"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Scenario Weights</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMobileScenarioOpen(false)}
                aria-label="Close scenario settings"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScenarioPanel scenario={scenario} onChange={setScenario} />
          </aside>
        </div>
      ) : null}

      <aside
        className="hidden space-y-4 overflow-y-auto pr-1 lg:block"
        aria-label="Dashboard filters"
      >
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
      <main className="space-y-4 overflow-y-auto pr-1 scroll-smooth md:space-y-6">
        <div className="grid grid-cols-2 gap-2 lg:hidden">
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => setMobileFiltersOpen(true)}
          >
            <SlidersHorizontal className="mr-1 h-4 w-4" />
            Filters
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => setMobileScenarioOpen(true)}
          >
            <FlaskConical className="mr-1 h-4 w-4" />
            Scenario
          </Button>
        </div>
        <Card className="space-y-3 border-border/70 bg-card/60 p-3 lg:hidden">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Quick Actions
            </p>
            <h3 className="text-sm font-semibold">Personalized workflow</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" onClick={applyTopMoversQuickAction}>
              Top movers
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={applyWatchlistQuickAction}
              disabled={watchlistSymbols.length === 0}
            >
              My watchlist
            </Button>
            <Button size="sm" variant="secondary" onClick={applyHighScoreQuickAction}>
              High-score
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={applyAlertsQuickAction}
              disabled={watchlistSymbols.length === 0}
            >
              My alerts
            </Button>
          </div>
        </Card>
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="flex flex-col gap-4 border-border/70 bg-card/60 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Screener Snapshot
                </p>
                <h2 className="text-xl font-semibold">Market pulse</h2>
              </div>
              <div className="flex items-center gap-2">
                {dataQuality ? (
                  <span
                    className={`rounded-md border px-2 py-1 text-[11px] ${dataQualityClass}`}
                    title={`Coverage ${dataQuality.coverageStart ?? "-"} to ${dataQuality.coverageEnd ?? "-"}. Missing symbols: ${dataQuality.missingSymbols}.`}
                  >
                    {dataQuality.status === "fresh"
                      ? "Fresh data"
                      : dataQuality.status === "stale"
                      ? "Stale data"
                      : "Coverage gaps"}
                  </span>
                ) : null}
                <Button variant="secondary" size="sm" onClick={scrollToTable}>
                  Jump to table
                </Button>
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
            <div className="grid gap-3 sm:grid-cols-4">
              <Card className="border-border/60 bg-muted/40 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Company
                </p>
                <p className="truncate text-lg font-semibold">
                  {companyName}
                </p>
              </Card>
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
                <p className="text-lg font-semibold" title={avgScoreTitle}>
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
                <p
                  className="text-lg font-semibold"
                  title="Average of daily returns over selected range."
                >
                  {summaryStats?.avgReturnValue !== null &&
                  summaryStats?.avgReturnValue !== undefined
                    ? percentFormatter.format(summaryStats.avgReturnValue)
                    : "-"}
                </p>
              </Card>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Score model:{" "}
              {`100 - (down days x (100 / ${filters.rangeDays}))`}.{" "}
              {dataQuality?.latestTradeDate
                ? `Latest trade date: ${dataQuality.latestTradeDate}.`
                : null}{" "}
              {dataQuality?.lagDays !== null && dataQuality?.lagDays !== undefined
                ? `Data lag: ${dataQuality.lagDays} day(s).`
                : null}
            </div>
            <DashboardScoreLineChart series={screenerData?.marketSeries ?? []} />
            {screenerData?.missingColumns?.length ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Missing columns: {screenerData.missingColumns.join(", ")}
              </div>
            ) : null}
          </Card>
          <div className="hidden lg:block">
            <ScenarioPanel scenario={scenario} onChange={setScenario} />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="space-y-3 border-border/70 bg-card/60 p-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Workspace
              </p>
              <h3 className="text-base font-semibold">Watchlist & scans</h3>
            </div>
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1">
                Watchlist: {watchlistSymbols.length} symbol(s)
              </div>
              <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1">
                Active alerts: {scoreAlerts.length}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={savedScanName}
                onChange={(event) => setSavedScanName(event.target.value)}
                placeholder="Save current scan name"
              />
              <Button size="sm" onClick={saveCurrentScan} disabled={!savedScanName.trim()}>
                Save
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedSavedScanId || undefined}
                onValueChange={applySavedScan}
              >
                <SelectTrigger
                  aria-label="Saved scans"
                  className="h-9 w-full border-border/60 bg-muted/30"
                >
                  <SelectValue placeholder="Select saved scan" />
                </SelectTrigger>
                <SelectContent>
                  {savedScans.length === 0 ? (
                    <SelectItem value="no-scan" disabled>
                      No saved scans
                    </SelectItem>
                  ) : (
                    savedScans.map((scan) => (
                      <SelectItem key={scan.id} value={scan.id}>
                        {scan.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => selectedSavedScanId && deleteSavedScan(selectedSavedScanId)}
                disabled={!selectedSavedScanId}
              >
                Delete
              </Button>
            </div>
          </Card>

          <Card className="space-y-3 border-border/70 bg-card/60 p-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Risk Module
              </p>
              <h3 className="text-base font-semibold">Position sizing</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={riskAccountSize}
                onChange={(event) => setRiskAccountSize(event.target.value)}
                inputMode="decimal"
                placeholder="Account size"
                aria-label="Account size"
              />
              <Input
                value={riskPercent}
                onChange={(event) => setRiskPercent(event.target.value)}
                inputMode="decimal"
                placeholder="Risk %"
                aria-label="Risk percent"
              />
              <Input
                value={riskEntry}
                onChange={(event) => setRiskEntry(event.target.value)}
                inputMode="decimal"
                placeholder="Entry price"
                aria-label="Entry price"
              />
              <Input
                value={riskStop}
                onChange={(event) => setRiskStop(event.target.value)}
                inputMode="decimal"
                placeholder="Stop loss"
                aria-label="Stop loss"
              />
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1">
                Risk amount:{" "}
                {riskMetrics ? numberFormatter.format(riskMetrics.riskAmount) : "-"}
              </div>
              <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1">
                Per-share risk:{" "}
                {riskMetrics ? numberFormatter.format(riskMetrics.perShareRisk) : "-"}
              </div>
              <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1">
                Qty: {riskMetrics ? numberFormatter.format(riskMetrics.quantity) : "-"}
              </div>
              <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1">
                Position value:{" "}
                {riskMetrics ? numberFormatter.format(riskMetrics.positionValue) : "-"}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              2R target: {riskMetrics ? numberFormatter.format(riskMetrics.targetPrice) : "-"}
            </p>
          </Card>

          <Card className="space-y-3 border-border/70 bg-card/60 p-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Alerts
              </p>
              <h3 className="text-base font-semibold">Watchlist score alerts</h3>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={alertThreshold}
                onChange={(event) => setAlertThreshold(event.target.value)}
                inputMode="decimal"
                placeholder="Alert threshold"
                aria-label="Alert threshold"
              />
              <Button size="sm" variant="secondary" onClick={applyAlertsQuickAction}>
                Apply
              </Button>
            </div>
            <div className="space-y-1 text-xs">
              {scoreAlerts.length === 0 ? (
                <p className="text-muted-foreground">No watchlist symbols above threshold.</p>
              ) : (
                scoreAlerts.slice(0, 6).map((row) => (
                  <div
                    key={row.symbol}
                    className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-2 py-1"
                  >
                    <span>{row.symbol}</span>
                    <span className="font-semibold">{row.score.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div ref={tableSectionRef}>
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
                rangeDays={filters.rangeDays}
                onSortChange={onSortChange}
                onRowClick={handleRowClick}
                selectedSymbols={filters.symbols}
                onToggleSymbolFilter={handleToggleSymbolFilter}
                watchlistSymbols={watchlistSymbols}
                onToggleWatchlist={handleToggleWatchlist}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1}-
                  {Math.min(page * pageSize, screenerData.total)} of{" "}
                  {screenerData.total} results
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 sm:flex-none"
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
                    className="flex-1 sm:flex-none"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                  >
                    Next
                  </Button>
                  <select
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                    aria-label="Rows per page"
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
        </div>
      </main>
    </div>
  )
}
