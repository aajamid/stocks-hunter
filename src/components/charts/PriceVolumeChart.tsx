"use client"

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card } from "@/components/ui/card"
import { compactFormatter, numberFormatter } from "@/lib/format"
import type { SeriesPoint } from "@/lib/types"

type PriceVolumeChartProps = {
  data: SeriesPoint[]
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
  label?: string
}) {
  if (!active || !payload || !payload.length) return null
  const closeRaw = payload.find((item) => item.name === "close")?.value
  const volumeRaw = payload.find((item) => item.name === "volume")?.value
  const close = Number(closeRaw)
  const volume = Number(volumeRaw)
  const hasClose = Number.isFinite(close)
  const hasVolume = Number.isFinite(volume)

  return (
    <div className="rounded-lg border border-border/60 bg-card/90 px-3 py-2 text-xs">
      <p className="font-medium text-foreground">{label}</p>
      {hasClose ? (
        <p className="text-muted-foreground">
          Close: {numberFormatter.format(close)}
        </p>
      ) : null}
      {hasVolume ? (
        <p className="text-muted-foreground">
          Volume: {compactFormatter.format(volume)}
        </p>
      ) : null}
    </div>
  )
}

export function PriceVolumeChart({ data }: PriceVolumeChartProps) {
  return (
    <Card className="h-[280px] w-full border-border/70 bg-card/60 p-3 sm:h-[320px] sm:p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Price & Volume
          </p>
          <h3 className="text-lg font-semibold">Closing price trend</h3>
        </div>
      </div>
      <div className="mt-3 h-[200px] sm:mt-4 sm:h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="trade_date" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => numberFormatter.format(value)}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => compactFormatter.format(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              yAxisId="right"
              dataKey="volume"
              barSize={16}
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
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
