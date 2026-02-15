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
  onSortChange: (field: string) => void
  onRowClick: (symbol: string) => void
  selectedSymbols: string[]
  onToggleSymbolFilter: (symbol: string, checked: boolean) => void
}

const headers: Array<{ key: string; label: string; align?: "right" | "left" }> =
  [
    { key: "symbol", label: "Symbol" },
    { key: "name_en", label: "Company" },
    { key: "sector", label: "Sector" },
    { key: "latest_close", label: "Latest Close", align: "right" },
    { key: "avg_daily_return", label: "Avg Return", align: "right" },
    { key: "avg_momentum_5d", label: "Momentum 5D", align: "right" },
    { key: "avg_volatility_5d", label: "Volatility 5D", align: "right" },
    { key: "score", label: "Score", align: "right" },
  ]

export function ScreenerTable({
  rows,
  sortBy,
  sortDir,
  onSortChange,
  onRowClick,
  selectedSymbols,
  onToggleSymbolFilter,
}: ScreenerTableProps) {
  const renderSortIcon = (key: string) => {
    if (sortBy !== key) return null
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60">
      <Table>
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
                header.key === "latest_close" ||
                header.key.includes("avg") ||
                header.key === "score" ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-7 gap-1 px-2 text-xs uppercase tracking-[0.2em]"
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
            const scoreBadge =
              row.score < 0
                ? "bg-destructive/20 text-destructive"
                : "bg-emerald-500/15 text-emerald-300"
            return (
              <TableRow
                key={row.symbol}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => onRowClick(row.symbol)}
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
                    ? percentFormatter.format(row.avg_daily_return)
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {row.avg_momentum_5d !== null &&
                  row.avg_momentum_5d !== undefined
                    ? compactFormatter.format(row.avg_momentum_5d)
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {row.avg_volatility_5d !== null &&
                  row.avg_volatility_5d !== undefined
                    ? compactFormatter.format(row.avg_volatility_5d)
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <Badge className={scoreBadge}>{row.score.toFixed(2)}</Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
