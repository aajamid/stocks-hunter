import type { SeriesPoint } from "@/lib/types"

const average = (values: number[]) =>
  values.length === 0
    ? 0
    : values.reduce((sum, v) => sum + v, 0) / values.length

const stdDev = (values: number[]) => {
  if (values.length === 0) return 0
  const avg = average(values)
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
  return Math.sqrt(variance)
}

export function computeSummary(series: SeriesPoint[]) {
  const closes = series
    .map((point) => point.close)
    .filter((v): v is number => typeof v === "number")

  const returns = series
    .map((point) => point.daily_return)
    .filter((v): v is number => typeof v === "number")

  const computedReturns =
    returns.length > 0
      ? returns
      : closes.length > 1
      ? closes.slice(1).map((close, index) => {
          const prev = closes[index]
          return prev === 0 ? 0 : (close - prev) / prev
        })
      : []

  const latestClose = closes.length ? closes[closes.length - 1] : null
  const firstClose = closes.length ? closes[0] : null
  const totalReturn =
    latestClose && firstClose ? latestClose / firstClose - 1 : null

  const avgDailyReturn = computedReturns.length
    ? average(computedReturns)
    : null
  const volatility = computedReturns.length ? stdDev(computedReturns) : null

  let maxDrawdown = 0
  if (closes.length) {
    let peak = closes[0]
    for (const close of closes) {
      if (close > peak) peak = close
      const drawdown = peak === 0 ? 0 : (close - peak) / peak
      if (drawdown < maxDrawdown) maxDrawdown = drawdown
    }
  }

  return {
    latestClose,
    firstClose,
    totalReturn,
    avgDailyReturn,
    volatility,
    maxDrawdown: closes.length ? maxDrawdown : null,
  }
}
