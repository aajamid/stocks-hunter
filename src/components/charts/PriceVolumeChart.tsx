"use client"

import { useMemo, useState } from "react"
import {
  Bar,
  Cell,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { compactFormatter, numberFormatter } from "@/lib/format"
import type { SeriesPoint, SymbolEvent } from "@/lib/types"

type PriceVolumeChartProps = {
  data: SeriesPoint[]
  events?: SymbolEvent[]
}

type ChartType = "line" | "bar" | "candles"
type Timeframe = "1D" | "1W" | "1M"

type ChartPoint = {
  trade_date: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
  eventCount: number
  eventTitles: string[]
  isBullish: boolean
  wickBase: number
  wickRange: number
}

const toLabelDate = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

const normalizePoint = (point: SeriesPoint) => {
  const close = typeof point.close === "number" ? point.close : null
  const open = typeof point.open === "number" ? point.open : close
  const high = typeof point.high === "number" ? point.high : close
  const low = typeof point.low === "number" ? point.low : close
  return {
    ...point,
    open,
    high,
    low,
    close,
    volume: typeof point.volume === "number" ? point.volume : null,
  }
}

const getWeekBucket = (dateValue: string) => {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return dateValue
  const normalized = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  const day = normalized.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  normalized.setUTCDate(normalized.getUTCDate() + offset)
  return normalized.toISOString().slice(0, 10)
}

const getMonthBucket = (dateValue: string) => {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return dateValue.slice(0, 7)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

const getBucketKey = (tradeDate: string, timeframe: Timeframe) => {
  if (timeframe === "1W") return getWeekBucket(tradeDate)
  if (timeframe === "1M") return getMonthBucket(tradeDate)
  return tradeDate
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
      <line
        x1={wickX}
        y1={y}
        x2={wickX}
        y2={y + height}
        stroke={color}
        strokeWidth={1.2}
      />
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

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartPoint }>
  label?: string
}) {
  if (!active || !payload || !payload.length) return null
  const point = payload[0]?.payload
  if (!point) return null

  return (
    <div className="rounded-lg border border-border/60 bg-card/90 px-3 py-2 text-xs">
      <p className="font-medium text-foreground">{label}</p>
      {point.close !== null ? (
        <p className="text-muted-foreground">
          O: {point.open !== null ? numberFormatter.format(point.open) : "-"} | H: {" "}
          {point.high !== null ? numberFormatter.format(point.high) : "-"} | L: {" "}
          {point.low !== null ? numberFormatter.format(point.low) : "-"} | C: {" "}
          {numberFormatter.format(point.close)}
        </p>
      ) : null}
      {point.volume !== null ? (
        <p className="text-muted-foreground">
          Volume: {compactFormatter.format(point.volume)}
        </p>
      ) : null}
      {point.eventCount > 0 ? (
        <p className="text-amber-500">
          {point.eventCount} event{point.eventCount > 1 ? "s" : ""}: {" "}
          {point.eventTitles.slice(0, 2).join(" | ")}
        </p>
      ) : null}
    </div>
  )
}

export function PriceVolumeChart({ data, events = [] }: PriceVolumeChartProps) {
  const [chartType, setChartType] = useState<ChartType>("line")
  const [timeframe, setTimeframe] = useState<Timeframe>("1D")

  const points = useMemo(() => {
    const normalized = data
      .map(normalizePoint)
      .sort((a, b) => a.trade_date.localeCompare(b.trade_date))

    const eventMap = new Map<string, SymbolEvent[]>()
    for (const event of events) {
      const key = getBucketKey(event.event_date, timeframe)
      const existing = eventMap.get(key) ?? []
      existing.push(event)
      eventMap.set(key, existing)
    }

    const grouped = new Map<
      string,
      {
        trade_date: string
        open: number | null
        high: number | null
        low: number | null
        close: number | null
        volume: number | null
      }
    >()

    for (const point of normalized) {
      const bucket = getBucketKey(point.trade_date, timeframe)
      const existing = grouped.get(bucket)
      if (!existing) {
        grouped.set(bucket, {
          trade_date: point.trade_date,
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close,
          volume: point.volume,
        })
        continue
      }

      existing.close = point.close ?? existing.close
      if (typeof point.high === "number") {
        existing.high =
          typeof existing.high === "number"
            ? Math.max(existing.high, point.high)
            : point.high
      }
      if (typeof point.low === "number") {
        existing.low =
          typeof existing.low === "number"
            ? Math.min(existing.low, point.low)
            : point.low
      }
      if (typeof point.volume === "number") {
        existing.volume =
          typeof existing.volume === "number"
            ? existing.volume + point.volume
            : point.volume
      }
    }

    return Array.from(grouped.entries()).map(([bucket, point]) => {
      const eventRows = eventMap.get(bucket) ?? []
      const open = point.open
      const close = point.close
      const high =
        typeof point.high === "number"
          ? point.high
          : typeof open === "number" && typeof close === "number"
          ? Math.max(open, close)
          : close
      const low =
        typeof point.low === "number"
          ? point.low
          : typeof open === "number" && typeof close === "number"
          ? Math.min(open, close)
          : close

      return {
        trade_date: point.trade_date,
        open: typeof open === "number" ? open : null,
        high: typeof high === "number" ? high : null,
        low: typeof low === "number" ? low : null,
        close: typeof close === "number" ? close : null,
        volume: typeof point.volume === "number" ? point.volume : null,
        eventCount: eventRows.length,
        eventTitles: eventRows.map(
          (item) => item.event_title ?? item.event_type ?? "Event"
        ),
        isBullish:
          typeof open === "number" && typeof close === "number"
            ? close >= open
            : true,
        wickBase: typeof low === "number" ? low : 0,
        wickRange:
          typeof high === "number" && typeof low === "number"
            ? Math.max(high - low, 0)
            : 0,
      } as ChartPoint
    })
  }, [data, events, timeframe])

  if (points.length === 0) {
    return (
      <Card className="h-[280px] w-full border-border/70 bg-card/60 p-3 sm:h-[320px] sm:p-4">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          No price data for selected range.
        </div>
      </Card>
    )
  }

  return (
    <Card className="h-[280px] w-full border-border/70 bg-card/60 p-3 sm:h-[320px] sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Price & Volume
          </p>
          <h3 className="text-lg font-semibold">Closing price trend</h3>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={timeframe}
            onValueChange={(value) => setTimeframe(value as Timeframe)}
          >
            <SelectTrigger className="h-8 w-[90px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1D">1D</SelectItem>
              <SelectItem value="1W">1W</SelectItem>
              <SelectItem value="1M">1M</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={chartType}
            onValueChange={(value) => setChartType(value as ChartType)}
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="line">Line</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
              <SelectItem value="candles">Candles</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-3 h-[200px] sm:mt-4 sm:h-[240px]">
        {chartType === "line" ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points}>
              <XAxis
                dataKey="trade_date"
                tick={{ fontSize: 11 }}
                tickFormatter={toLabelDate}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => numberFormatter.format(Number(value))}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => compactFormatter.format(Number(value))}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                yAxisId="right"
                dataKey="volume"
                barSize={14}
                fill="var(--chart-4)"
                opacity={0.25}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="close"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
              />
              {points
                .filter((point) => point.eventCount > 0 && point.close !== null)
                .map((point) => (
                  <ReferenceDot
                    key={`event-${point.trade_date}`}
                    yAxisId="left"
                    x={point.trade_date}
                    y={point.close as number}
                    r={3}
                    fill="#f59e0b"
                    stroke="none"
                  />
                ))}
            </ComposedChart>
          </ResponsiveContainer>
        ) : null}
        {chartType === "bar" ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points}>
              <XAxis
                dataKey="trade_date"
                tick={{ fontSize: 11 }}
                tickFormatter={toLabelDate}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => numberFormatter.format(Number(value))}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="close">
                {points.map((point) => (
                  <Cell
                    key={point.trade_date}
                    fill={point.isBullish ? "#14b8a6" : "#ef4444"}
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        ) : null}
        {chartType === "candles" ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points}>
              <XAxis
                dataKey="trade_date"
                tick={{ fontSize: 11 }}
                tickFormatter={toLabelDate}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => numberFormatter.format(Number(value))}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="wickBase"
                stackId="candles"
                fill="transparent"
                isAnimationActive={false}
              />
              <Bar
                dataKey="wickRange"
                stackId="candles"
                shape={<CandleShape />}
                isAnimationActive={false}
              />
              {points
                .filter((point) => point.eventCount > 0 && point.close !== null)
                .map((point) => (
                  <ReferenceDot
                    key={`event-candle-${point.trade_date}`}
                    x={point.trade_date}
                    y={point.close as number}
                    r={3}
                    fill="#f59e0b"
                    stroke="none"
                  />
                ))}
            </ComposedChart>
          </ResponsiveContainer>
        ) : null}
      </div>
    </Card>
  )
}
