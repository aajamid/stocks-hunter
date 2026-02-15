"use client"

import { ArrowDown, ArrowUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { compactFormatter, numberFormatter, percentFormatter } from "@/lib/format"
import type { ScreenerRowScored } from "@/lib/types"

type ScreenerTableProps = {
  rows: ScreenerRowScored[]
  sortBy: string
  sortDir: "asc" | "desc"
  rangeDays: 14 | 21 | 28
  onSortChange: (field: string) => void
  onRowClick: (symbol: string) => void
  selectedSymbols: string[]
  onToggleSymbolFilter: (symbol: string, checked: boolean) => void
}

const getScoreBadgeClass = (score: number) => {
  if (score >= 70) {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
  }
  if (score >= 50) {
    return "bg-amber-500/20 text-amber-700 dark:text-amber-300"
  }
  return "bg-destructive/20 text-destructive"
}

const getHeaderTooltip = (key: string, rangeDays: 14 | 21 | 28) => {
  if (key === "avg_daily_return") {
    return "Average of daily returns over selected range: AVG((close_t - close_t-1) / close_t-1)."
  }
  if (key === "avg_momentum_5d") {
    return `Momentum ${rangeDays}D formula: (latest close - first close) / first close over selected range.`
  }
  if (key === "avg_volatility_5d") {
    return `Volatility ${rangeDays}D formula: sample standard deviation of daily returns over selected range.`
  }
  if (key === "latest_rsi") {
    return "Latest RSI value as of the most recent trade date in the selected range."
  }
  if (key === "latest_apx") {
    return "Latest APX value as of the most recent trade date in the selected range (uses ADX if APX is unavailable)."
  }
  if (key === "score") {
    return `Score formula: 100 - (down days x (100 / ${rangeDays})). Color bands: 70-100 green, 50-69 yellow, below 50 red.`
  }
  return undefined
}

export function ScreenerTable({
  rows,
  sortBy,
  sortDir,
  rangeDays,
  onSortChange,
  onRowClick,
  selectedSymbols,
  onToggleSymbolFilter,
}: ScreenerTableProps) {
  const headers: Array<{ key: string; label: string; align?: "right" | "left" }> =
    [
      { key: "symbol", label: "Symbol" },
      { key: "name_en", label: "Company" },
      { key: "sector", label: "Sector" },
      { key: "latest_close", label: "Latest Close", align: "right" },
      { key: "avg_daily_return", label: "Avg Return", align: "right" },
      { key: "avg_momentum_5d", label: `Momentum ${rangeDays}D`, align: "right" },
      {
        key: "avg_volatility_5d",
        label: `Volatility ${rangeDays}D`,
        align: "right",
      },
      { key: "latest_rsi", label: "RSI", align: "right" },
      { key: "latest_apx", label: "APX", align: "right" },
      { key: "score", label: "Score", align: "right" },
    ]

  const renderSortIcon = (key: string) => {
    if (sortBy !== key) return null
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    )
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60">
      <div className="space-y-3 p-3 md:hidden">
        {rows.map((row) => {
          const scoreBadge = getScoreBadgeClass(row.score)
          return (
            <div
              key={row.symbol}
              className="rounded-xl border border-border/60 bg-muted/20 p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedSymbols.includes(row.symbol)}
                    onCheckedChange={(checked) =>
                      onToggleSymbolFilter(row.symbol, checked === true)
                    }
                    aria-label={`Filter by ${row.symbol}`}
                  />
                  <div>
                    <p className="text-sm font-semibold">{row.symbol}</p>
                    <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                      {row.name_en ?? "-"}
                    </p>
                  </div>
                </div>
                <Badge
                  className={scoreBadge}
                  title={`Score = 100 - (down days x (100 / ${rangeDays})). Color bands: 70-100 green, 50-69 yellow, below 50 red.`}
                >
                  {row.score.toFixed(2)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div className="text-muted-foreground">Sector</div>
                <div className="truncate text-right">{row.sector ?? "-"}</div>
                <div className="text-muted-foreground">Latest close</div>
                <div className="text-right">
                  {row.latest_close !== null && row.latest_close !== undefined
                    ? numberFormatter.format(row.latest_close)
                    : "-"}
                </div>
                <div className="text-muted-foreground">Avg return</div>
                <div className="text-right">
                  {row.avg_daily_return !== null &&
                  row.avg_daily_return !== undefined
                    ? percentFormatter.format(row.avg_daily_return)
                    : "-"}
                </div>
                <div className="text-muted-foreground">{`Momentum ${rangeDays}D`}</div>
                <div className="text-right">
                  {row.avg_momentum_5d !== null &&
                  row.avg_momentum_5d !== undefined
                    ? compactFormatter.format(row.avg_momentum_5d)
                    : "-"}
                </div>
                <div className="text-muted-foreground">{`Volatility ${rangeDays}D`}</div>
                <div className="text-right">
                  {row.avg_volatility_5d !== null &&
                  row.avg_volatility_5d !== undefined
                    ? compactFormatter.format(row.avg_volatility_5d)
                    : "-"}
                </div>
                <div className="text-muted-foreground">RSI</div>
                <div className="text-right">
                  {row.latest_rsi !== null && row.latest_rsi !== undefined
                    ? numberFormatter.format(row.latest_rsi)
                    : "-"}
                </div>
                <div className="text-muted-foreground">APX</div>
                <div className="text-right">
                  {row.latest_apx !== null && row.latest_apx !== undefined
                    ? numberFormatter.format(row.latest_apx)
                    : "-"}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 w-full"
                onClick={() => onRowClick(row.symbol)}
              >
                Open details
              </Button>
            </div>
          )
        })}
      </div>
      <div className="hidden md:block">
        <div className="px-3 pt-2 text-[11px] text-muted-foreground lg:hidden">
          Swipe horizontally to view all columns.
        </div>
        <Table className="min-w-[1180px]" aria-label="Screener results table">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-10 text-xs uppercase tracking-[0.2em]">
                Filter
              </TableHead>
              {headers.map((header) => (
                <TableHead
                  key={header.key}
                  className={
                    header.align === "right"
                      ? "text-right text-xs uppercase tracking-[0.2em]"
                      : "text-xs uppercase tracking-[0.2em]"
                  }
                >
                  {header.key === "symbol" ||
                  header.key.startsWith("latest_") ||
                  header.key.includes("avg") ||
                  header.key === "score" ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="h-8 gap-1 px-2 text-xs uppercase tracking-[0.2em]"
                      title={getHeaderTooltip(header.key, rangeDays)}
                      onClick={() => onSortChange(header.key)}
                    >
                      {header.label}
                      {renderSortIcon(header.key)}
                    </Button>
                  ) : (
                    header.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const scoreBadge = getScoreBadgeClass(row.score)
              return (
                <TableRow
                  key={row.symbol}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => onRowClick(row.symbol)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onRowClick(row.symbol)
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Open ${row.symbol} details`}
                >
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selectedSymbols.includes(row.symbol)}
                      onCheckedChange={(checked) =>
                        onToggleSymbolFilter(row.symbol, checked === true)
                      }
                      aria-label={`Filter by ${row.symbol}`}
                    />
                  </TableCell>
                  <TableCell className="font-semibold">{row.symbol}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground">
                    {row.name_en ?? "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.sector ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.latest_close !== null && row.latest_close !== undefined
                      ? numberFormatter.format(row.latest_close)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.avg_daily_return !== null &&
                    row.avg_daily_return !== undefined
                      ? (
                          <span title="Average of daily returns over selected range.">
                            {percentFormatter.format(row.avg_daily_return)}
                          </span>
                        )
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.avg_momentum_5d !== null &&
                    row.avg_momentum_5d !== undefined
                      ? (
                          <span
                            title={`(latest close - first close) / first close over ${rangeDays} business days.`}
                          >
                            {compactFormatter.format(row.avg_momentum_5d)}
                          </span>
                        )
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.avg_volatility_5d !== null &&
                    row.avg_volatility_5d !== undefined
                      ? (
                          <span
                            title={`Sample standard deviation of daily returns over ${rangeDays} business days.`}
                          >
                            {compactFormatter.format(row.avg_volatility_5d)}
                          </span>
                        )
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.latest_rsi !== null && row.latest_rsi !== undefined
                      ? (
                          <span title="Latest RSI value in selected range.">
                            {numberFormatter.format(row.latest_rsi)}
                          </span>
                        )
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.latest_apx !== null && row.latest_apx !== undefined
                      ? (
                          <span title="Latest APX value in selected range (or ADX fallback).">
                            {numberFormatter.format(row.latest_apx)}
                          </span>
                        )
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      className={scoreBadge}
                      title={`Score = 100 - (down days x (100 / ${rangeDays})). Color bands: 70-100 green, 50-69 yellow, below 50 red.`}
                    >
                      {row.score.toFixed(2)}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
