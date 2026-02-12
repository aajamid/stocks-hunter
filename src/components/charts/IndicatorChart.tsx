"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card } from "@/components/ui/card"
import { numberFormatter, percentFormatter } from "@/lib/format"
import type { SeriesPoint } from "@/lib/types"

type IndicatorChartProps = {
  data: SeriesPoint[]
  indicator: "daily_return" | "momentum_5d" | "volatility_5d"
}

const labelMap = {
  daily_return: "Daily Return",
  momentum_5d: "Momentum 5D",
  volatility_5d: "Volatility 5D",
}

export function IndicatorChart({ data, indicator }: IndicatorChartProps) {
  return (
    <Card className="h-[260px] w-full border-border/70 bg-card/60 p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Indicator
        </p>
        <h3 className="text-lg font-semibold">{labelMap[indicator]}</h3>
      </div>
      <div className="mt-4 h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="trade_date" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(value) =>
                indicator === "daily_return"
                  ? percentFormatter.format(value)
                  : numberFormatter.format(value)
              }
            />
            <Tooltip
              formatter={(value) => {
                const numeric = Number(value)
                if (!Number.isFinite(numeric)) return "-"
                return indicator === "daily_return"
                  ? percentFormatter.format(numeric)
                  : numberFormatter.format(numeric)
              }}
            />
            <Line
              type="monotone"
              dataKey={indicator}
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
