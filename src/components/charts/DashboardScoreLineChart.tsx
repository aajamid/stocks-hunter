"use client"

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { numberFormatter, percentFormatter } from "@/lib/format"
import type { MarketSeriesPoint } from "@/lib/types"

type DashboardScoreLineChartProps = {
  series: MarketSeriesPoint[]
}

type ChartPoint = {
  tradeDate: string
  avgClose: number | null
  symbolCount: number
  dayChangePct: number | null
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    payload: ChartPoint
  }>
}) {
  if (!active || !payload?.length) return null

  const point = payload[0]?.payload
  if (!point) return null

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/95 px-3 py-2 text-xs shadow-lg shadow-black/30">
      <p className="text-base font-semibold text-white">
        {point.avgClose !== null
          ? numberFormatter.format(point.avgClose)
          : "-"}
      </p>
      <p className="text-muted-foreground">
        {new Date(point.tradeDate).toLocaleDateString("en-US", {
          day: "2-digit",
          month: "short",
          year: "2-digit",
        })}
      </p>
      <p
        className={
          point.dayChangePct !== null && point.dayChangePct < 0
            ? "text-red-300"
            : "text-emerald-300"
        }
      >
        {point.dayChangePct !== null
          ? `${point.dayChangePct >= 0 ? "+" : ""}${percentFormatter.format(point.dayChangePct)}`
          : "-"}
      </p>
      <p className="text-muted-foreground">Symbols: {point.symbolCount}</p>
    </div>
  )
}

const toLabelDate = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function DashboardScoreLineChart({
  series,
}: DashboardScoreLineChartProps) {
  if (series.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-sm text-muted-foreground">
        No chart data for the selected filters.
      </div>
    )
  }

  const points = series.map((point, index) => {
    const prev = index > 0 ? series[index - 1] : null
    const prevClose = prev?.avg_close
    const dayChangePct =
      typeof point.avg_close === "number" &&
      typeof prevClose === "number" &&
      prevClose !== 0
        ? (point.avg_close - prevClose) / prevClose
        : null

    return {
      tradeDate: point.trade_date,
      avgClose: point.avg_close,
      symbolCount: point.symbol_count,
      dayChangePct,
    }
  })

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Line Chart
          </p>
          <h3 className="text-sm font-semibold">Market price trend by date</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {points.length} days
        </p>
      </div>
      <div className="h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="dashboardPriceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.45} />
                <stop offset="65%" stopColor="#14b8a6" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="tradeDate"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={toLabelDate}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => numberFormatter.format(Number(value))}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "rgba(255,255,255,0.35)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="avgClose"
              stroke="#14b8a6"
              fill="url(#dashboardPriceFill)"
              strokeWidth={2}
              dot={false}
              connectNulls
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: "#ffffff",
                fill: "#14b8a6",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
