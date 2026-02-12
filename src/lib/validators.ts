import { z } from "zod"

import { defaultScenario } from "@/lib/scoring"
import type { ScenarioConfig, ScreenerFilters } from "@/lib/types"

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const WeightSchema = z.object({
  momentum: z.number().min(0).max(2),
  direction: z.number().min(0).max(2),
  volatility: z.number().min(0).max(2),
  volumeSpike: z.number().min(0).max(2),
  intraday: z.number().min(0).max(2),
})

const ThresholdSchema = z.object({
  volatilityCap: z.number().min(0.0001).max(10),
})

export function parseDateRange(params: URLSearchParams) {
  const endParam = params.get("end")
  const startParam = params.get("start")

  const today = new Date()
  const endDefault = toDateString(today)
  const startDefault = toDateString(addDays(today, -30))

  const start = DateString.safeParse(startParam ?? startDefault)
  const end = DateString.safeParse(endParam ?? endDefault)

  let startValue = start.success ? start.data : startDefault
  let endValue = end.success ? end.data : endDefault

  if (startValue > endValue) {
    const temp = startValue
    startValue = endValue
    endValue = temp
  }

  return {
    start: startValue,
    end: endValue,
  }
}

export function parseScenarioConfig(params: URLSearchParams): ScenarioConfig {
  const weightsParam = params.get("weights")
  const thresholdsParam = params.get("thresholds")

  let weights = defaultScenario.weights
  let thresholds = defaultScenario.thresholds

  if (weightsParam) {
    const parsed = safeJson(weightsParam)
    if (parsed) {
      const result = WeightSchema.partial().safeParse(parsed)
      if (result.success) {
        weights = { ...weights, ...result.data }
      }
    }
  }

  if (thresholdsParam) {
    const parsed = safeJson(thresholdsParam)
    if (parsed) {
      const result = ThresholdSchema.partial().safeParse(parsed)
      if (result.success) {
        thresholds = { ...thresholds, ...result.data }
      }
    }
  }

  return { weights, thresholds }
}

export function parseScreenerFilters(params: URLSearchParams): ScreenerFilters {
  const { start, end } = parseDateRange(params)
  const symbols = parseList(params.get("symbols"))
  const sectors = parseList(params.get("sectors"))
  const markets = parseList(params.get("markets"))
  const name = params.get("name")?.trim()
  const activeOnly = params.get("activeOnly") === "true"

  return {
    start,
    end,
    symbols: symbols.length ? symbols : undefined,
    sectors: sectors.length ? sectors : undefined,
    markets: markets.length ? markets : undefined,
    name: name || undefined,
    activeOnly,
  }
}

export function parsePagination(params: URLSearchParams) {
  const page = Number(params.get("page") ?? 1)
  const pageSize = Number(params.get("pageSize") ?? 50)
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize:
      Number.isFinite(pageSize) && pageSize > 0
        ? Math.min(pageSize, 200)
        : 50,
  }
}

export function parseSort(params: URLSearchParams) {
  const sortBy = params.get("sortBy") ?? "score"
  const sortDir = params.get("sortDir") === "asc" ? "asc" : "desc"
  return { sortBy, sortDir }
}

export function parseFormat(params: URLSearchParams) {
  const format = params.get("format")
  return format === "csv" ? "csv" : "json"
}

function parseList(value: string | null) {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function safeJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, amount: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}
