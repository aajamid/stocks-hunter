"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { ErrorBanner } from "@/components/common/ErrorBanner"
import { LoadingState } from "@/components/common/LoadingState"
import { IndicatorChart } from "@/components/charts/IndicatorChart"
import { PriceVolumeChart } from "@/components/charts/PriceVolumeChart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { compactFormatter, numberFormatter, percentFormatter } from "@/lib/format"
import type { ScreenerRowScored, SeriesPoint, SymbolMeta } from "@/lib/types"

type SymbolDetailResponse = {
  symbol: string
  meta: SymbolMeta | null
  series: SeriesPoint[]
  summary: {
    latestClose: number | null
    firstClose: number | null
    totalReturn: number | null
    avgDailyReturn: number | null
    volatility: number | null
    maxDrawdown: number | null
  }
  score: ScreenerRowScored | null
  missingColumns: string[]
  usedColumns: string[]
}

type SymbolDetailPageProps = {
  symbol: string
  initialParams: string
}

const toDateString = (date: Date) => date.toISOString().slice(0, 10)

export function SymbolDetailPage({ symbol, initialParams }: SymbolDetailPageProps) {
  const initialSearch = useMemo(() => new URLSearchParams(initialParams), [
    initialParams,
  ])
  const [start, setStart] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return initialSearch.get("start") ?? toDateString(date)
  })
  const [end, setEnd] = useState(() => {
    return initialSearch.get("end") ?? toDateString(new Date())
  })
  const [indicator, setIndicator] = useState<
    "daily_return" | "momentum_5d" | "volatility_5d"
  >("daily_return")
  const [data, setData] = useState<SymbolDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const extraParams = useMemo(() => {
    const params = new URLSearchParams(initialParams)
    params.delete("start")
    params.delete("end")
    return params
  }, [initialParams])

  const fetchDetails = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams(extraParams)
      params.set("start", start)
      params.set("end", end)
      const response = await fetch(`/api/symbol/${symbol}?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to load symbol details.")
      const payload = (await response.json()) as SymbolDetailResponse
      setData(payload)
    } catch (err) {
      console.error(err)
      setError("Failed to load symbol details.")
    } finally {
      setLoading(false)
    }
  }, [extraParams, start, end, symbol])

  useEffect(() => {
    fetchDetails()
  }, [fetchDetails])

  const headerTitle = data?.meta?.name_en
    ? `${symbol} · ${data.meta.name_en}`
    : symbol

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Symbol Detail
          </p>
          <h2 className="text-2xl font-semibold">{headerTitle}</h2>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{data?.meta?.sector ?? "Sector n/a"}</span>
            <span>•</span>
            <span>{data?.meta?.market ?? "Market n/a"}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Back to Screener</Link>
          </Button>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2">
            <Input
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
            <Input
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
            <Button size="sm" variant="secondary" onClick={fetchDetails}>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {data?.missingColumns?.length ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Missing columns: {data.missingColumns.join(", ")}
        </div>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}

      {loading && !data ? (
        <LoadingState />
      ) : data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
            <PriceVolumeChart data={data.series} />
            <Card className="flex flex-col gap-4 border-border/70 bg-card/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Summary
                  </p>
                  <h3 className="text-lg font-semibold">Range stats</h3>
                </div>
                {data.score ? (
                  <Badge
                    className={
                      data.score.score < 7
                        ? "bg-destructive/20 text-destructive"
                        : "bg-emerald-500/15 text-emerald-300"
                    }
                  >
                    Score {data.score.score.toFixed(2)}
                  </Badge>
                ) : null}
              </div>
              <div className="grid gap-3">
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Latest Close
                  </p>
                  <p className="text-lg font-semibold">
                    {data.summary.latestClose !== null
                      ? numberFormatter.format(data.summary.latestClose)
                      : "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Total Return
                  </p>
                  <p className="text-lg font-semibold">
                    {data.summary.totalReturn !== null
                      ? percentFormatter.format(data.summary.totalReturn)
                      : "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Avg Daily Return
                  </p>
                  <p className="text-lg font-semibold">
                    {data.summary.avgDailyReturn !== null
                      ? percentFormatter.format(data.summary.avgDailyReturn)
                      : "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Volatility
                  </p>
                  <p className="text-lg font-semibold">
                    {data.summary.volatility !== null
                      ? percentFormatter.format(data.summary.volatility)
                      : "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Max Drawdown
                  </p>
                  <p className="text-lg font-semibold">
                    {data.summary.maxDrawdown !== null
                      ? percentFormatter.format(data.summary.maxDrawdown)
                      : "-"}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <Tabs
            value={indicator}
            onValueChange={(value) =>
              setIndicator(value as "daily_return" | "momentum_5d" | "volatility_5d")
            }
          >
            <TabsList className="bg-muted/40">
              <TabsTrigger value="daily_return">Daily Return</TabsTrigger>
              <TabsTrigger value="momentum_5d">Momentum 5D</TabsTrigger>
              <TabsTrigger value="volatility_5d">Volatility 5D</TabsTrigger>
            </TabsList>
          </Tabs>
          <IndicatorChart data={data.series} indicator={indicator} />

          {data.score ? (
            <Card className="border-border/70 bg-card/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Score explanation
                  </p>
                  <h3 className="text-lg font-semibold">Contribution breakdown</h3>
                </div>
                <Badge className="bg-muted/40 text-muted-foreground">
                  Final score {data.score.score.toFixed(2)}
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["Base", data.score.score_components.base],
                  ["Momentum", data.score.score_components.momentum],
                  ["Direction", data.score.score_components.direction],
                  ["Volatility", data.score.score_components.volatility],
                  ["Volume Spike", data.score.score_components.volumeSpike],
                  ["Intraday", data.score.score_components.intraday],
                  ["Volatility Cap", data.score.score_components.capPenalty],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold">
                      {Number(value).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                Based on averages in the selected range: momentum{" "}
                {data.score.score_inputs.avg_momentum_5d !== null
                  ? compactFormatter.format(
                      data.score.score_inputs.avg_momentum_5d
                    )
                  : "n/a"}
                , volatility{" "}
                {data.score.score_inputs.avg_volatility_5d !== null
                  ? compactFormatter.format(
                      data.score.score_inputs.avg_volatility_5d
                    )
                  : "n/a"}
                , volume spike{" "}
                {data.score.score_inputs.avg_volume_spike_ratio !== null
                  ? compactFormatter.format(
                      data.score.score_inputs.avg_volume_spike_ratio
                    )
                  : "n/a"}
                , intraday{" "}
                {data.score.score_inputs.avg_intraday_strength !== null
                  ? compactFormatter.format(
                      data.score.score_inputs.avg_intraday_strength
                    )
                  : "n/a"}
                , direction{" "}
                {data.score.score_inputs.fraction_up !== null
                  ? percentFormatter.format(
                      data.score.score_inputs.fraction_up
                    )
                  : "n/a"}
                .
              </div>
            </Card>
          ) : null}
        </>
      ) : (
        <LoadingState />
      )}
    </div>
  )
}
