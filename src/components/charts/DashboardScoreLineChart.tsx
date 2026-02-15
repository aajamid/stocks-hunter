"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { numberFormatter, percentFormatter } from "@/lib/format"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MarketSeriesPoint } from "@/lib/types"
import { useMemo, useState } from "react"

type DashboardScoreLineChartProps = {
  series: MarketSeriesPoint[]
}

type ChartType = "line" | "bar" | "candles"

type ChartPoint = {
  tradeDate: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  symbolCount: number
  dayChangePct: number | null
  bodyBase: number
  bodyRange: number
  wickBase: number
  wickRange: number
  isBullish: boolean
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
    <div className="rounded-lg border border-border/80 bg-popover/95 px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <p className="text-base font-semibold">
        {point.close !== null
          ? numberFormatter.format(point.close)
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
            ? "text-red-500"
            : "text-emerald-500"
        }
      >
        {point.dayChangePct !== null
          ? `${point.dayChangePct >= 0 ? "+" : ""}${percentFormatter.format(point.dayChangePct)}`
          : "-"}
      </p>
      <p className="text-muted-foreground">
        O: {point.open !== null ? numberFormatter.format(point.open) : "-"} | H:{" "}
        {point.high !== null ? numberFormatter.format(point.high) : "-"} | L:{" "}
        {point.low !== null ? numberFormatter.format(point.low) : "-"}
      </p>
      <p className="text-muted-foreground">Symbols: {point.symbolCount}</p>
    </div>
  )
}

function CandleShape(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: ChartPoint
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props
  if (!payload) return null

  const high = payload.high
  const low = payload.low
  const open = payload.open
  const close = payload.close
  if (
    typeof high !== "number" ||
    typeof low !== "number" ||
    typeof open !== "number" ||
    typeof close !== "number"
  ) {
    return null
  }

  const color = payload.isBullish ? "#22c55e" : "#ef4444"
  const candleRange = high - low
  if (candleRange <= 0) {
    const midY = y + height / 2
    return (
      <line
        x1={x + width / 2}
        y1={midY}
        x2={x + width / 2}
        y2={midY}
        stroke={color}
        strokeWidth={1.4}
      />
    )
  }

  const openY = y + ((high - open) / candleRange) * height
  const closeY = y + ((high - close) / candleRange) * height
  const bodyTop = Math.min(openY, closeY)
  const bodyHeight = Math.max(Math.abs(openY - closeY), 1.2)
  const bodyWidth = Math.max(width * 0.56, 4)
  const bodyX = x + (width - bodyWidth) / 2
  const wickX = x + width / 2

  return (
    <g>
      <line x1={wickX} y1={y} x2={wickX} y2={y + height} stroke={color} strokeWidth={1.2} />
      <rect
        x={bodyX}
        y={bodyTop}
        width={bodyWidth}
        height={bodyHeight}
        fill={color}
        opacity={0.95}
        rx={0.5}
      />
    </g>
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
  const [chartType, setChartType] = useState<ChartType>("line")

  const points = useMemo(() => {
    return series.map((point, index) => {
      const prev = index > 0 ? series[index - 1] : null
      const prevClose = prev?.avg_close
      const close = point.avg_close
      const open = point.avg_open ?? prevClose ?? close

      const fallbackHigh =
        typeof open === "number" && typeof close === "number"
          ? Math.max(open, close)
          : close
      const fallbackLow =
        typeof open === "number" && typeof close === "number"
          ? Math.min(open, close)
          : close

      const high = point.avg_high ?? fallbackHigh
      const low = point.avg_low ?? fallbackLow

      const normalizedHigh =
        typeof high === "number" &&
        typeof open === "number" &&
        typeof close === "number"
          ? Math.max(high, open, close)
          : high
      const normalizedLow =
        typeof low === "number" &&
        typeof open === "number" &&
        typeof close === "number"
          ? Math.min(low, open, close)
          : low

      const dayChangePct =
        typeof close === "number" &&
        typeof prevClose === "number" &&
        prevClose !== 0
          ? (close - prevClose) / prevClose
          : null

      return {
        tradeDate: point.trade_date,
        open: typeof open === "number" ? open : null,
        high: typeof normalizedHigh === "number" ? normalizedHigh : null,
        low: typeof normalizedLow === "number" ? normalizedLow : null,
        close: typeof close === "number" ? close : null,
        symbolCount: point.symbol_count,
        dayChangePct,
        bodyBase:
          typeof open === "number" && typeof close === "number"
            ? Math.min(open, close)
            : 0,
        bodyRange:
          typeof open === "number" && typeof close === "number"
            ? Math.abs(close - open)
            : 0,
        wickBase: typeof normalizedLow === "number" ? normalizedLow : 0,
        wickRange:
          typeof normalizedHigh === "number" && typeof normalizedLow === "number"
            ? Math.max(normalizedHigh - normalizedLow, 0)
            : 0,
        isBullish:
          typeof open === "number" && typeof close === "number"
            ? close >= open
            : true,
      }
    })
  }, [series])

  if (series.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-sm text-muted-foreground">
        No chart data for the selected filters.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Line Chart
          </p>
          <h3 className="text-sm font-semibold">Market price trend by date</h3>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">{points.length} days</p>
          <Select
            value={chartType}
            onValueChange={(value) => setChartType(value as ChartType)}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="line">Line chart</SelectItem>
              <SelectItem value="bar">Bar chart</SelectItem>
              <SelectItem value="candles">Candles</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="h-[170px]">
        {chartType === "line" ? (
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
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke="#14b8a6"
                fill="url(#dashboardPriceFill)"
                strokeWidth={2}
                dot={false}
                connectNulls
                activeDot={{
                  r: 4,
                  strokeWidth: 2,
                  stroke: "var(--background)",
                  fill: "#14b8a6",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
        {chartType === "bar" ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
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
                cursor={{ fill: "var(--muted)" }}
              />
              <Bar dataKey="close" radius={[4, 4, 0, 0]}>
                {points.map((point) => (
                  <Cell
                    key={point.tradeDate}
                    fill={point.dayChangePct !== null && point.dayChangePct < 0 ? "#ef4444" : "#14b8a6"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : null}
        {chartType === "candles" ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
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
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              />
              <Bar dataKey="wickBase" stackId="candles" fill="transparent" isAnimationActive={false} />
              <Bar
                dataKey="wickRange"
                stackId="candles"
                shape={<CandleShape />}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : null}
      </div>
    </div>
  )
}
