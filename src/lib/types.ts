export type SymbolMeta = {
  symbol: string
  name_en?: string | null
  name_ar?: string | null
  sector?: string | null
  market?: string | null
  is_active?: boolean | null
}

export type ScreenerFilters = {
  start: string
  end: string
  symbols?: string[]
  sectors?: string[]
  markets?: string[]
  name?: string
  activeOnly?: boolean
  scoreMin?: number
  scoreMax?: number
  minPrice?: number
  minAvgVolume?: number
  minAvgTurnover?: number
}

export type ScreenerRow = {
  symbol: string
  name_en?: string | null
  name_ar?: string | null
  sector?: string | null
  market?: string | null
  is_active?: boolean | null
  first_close?: number | null
  latest_close?: number | null
  avg_daily_return?: number | null
  avg_momentum_5d?: number | null
  avg_volatility_5d?: number | null
  avg_volume_spike_ratio?: number | null
  avg_intraday_strength?: number | null
  avg_volume?: number | null
  avg_turnover?: number | null
  high52?: number | null
  low52?: number | null
  latest_rsi?: number | null
  latest_apx?: number | null
  fraction_up?: number | null
  up_days?: number | null
  down_days?: number | null
  net_direction_days?: number | null
}

export type ScoreComponents = {
  pointPerDay: number
  upScore: number
  downScore: number
  netDirectionDays: number
  total: number
}

export type ScoreInputs = {
  rangeDays: number
  upDays: number
  downDays: number
  netDirectionDays: number
}

export type ScreenerRowScored = ScreenerRow & {
  score: number
  score_components: ScoreComponents
  score_inputs: ScoreInputs
}

export type SeriesPoint = {
  trade_date: string
  open?: number | null
  high?: number | null
  low?: number | null
  close?: number | null
  volume?: number | null
  daily_return?: number | null
  momentum_5d?: number | null
  volatility_5d?: number | null
}

export type SymbolEvent = {
  event_date: string
  event_type: string | null
  event_title: string | null
  description: string | null
}

export type MarketSeriesPoint = {
  trade_date: string
  avg_open: number | null
  avg_high: number | null
  avg_low: number | null
  avg_close: number | null
  symbol_count: number
}

export type ScenarioConfig = {
  weights: {
    momentum: number
    direction: number
    volatility: number
    volumeSpike: number
    intraday: number
  }
  thresholds: {
    volatilityCap?: number | null
  }
}

export type ScreenerResponse = {
  rows: ScreenerRowScored[]
  marketSeries: MarketSeriesPoint[]
  total: number
  page: number
  pageSize: number
  missingColumns: string[]
  usedColumns: string[]
  summary?: {
    avgScore: number | null
    avgDailyReturn: number | null
  }
  dataQuality?: {
    latestTradeDate: string | null
    lagDays: number | null
    coverageStart: string | null
    coverageEnd: string | null
    missingSymbols: number
    backfillRowsInserted: number
    status: "fresh" | "stale" | "incomplete"
  }
}
