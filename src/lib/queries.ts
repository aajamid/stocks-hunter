import { getAvailableColumns } from "@/lib/columns"
import { getCache, setCache } from "@/lib/cache"
import { query } from "@/lib/db"
import type {
  MarketSeriesPoint,
  ScreenerFilters,
  ScreenerRow,
  SeriesPoint,
  SymbolEvent,
  SymbolMeta,
} from "@/lib/types"

const SYMBOLS_TTL_MS = 5 * 60 * 1000

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const toBoolean = (value: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value === "boolean") return value
  if (value === "true") return true
  if (value === "false") return false
  return null
}

type QueryParam = string | string[] | number | boolean

async function applyRollingWindow(
  where: string[],
  params: QueryParam[],
  rangeDays?: 14 | 21 | 28
) {
  if (!rangeDays) {
    return { where, params }
  }

  const dateResult = await query<{ start_date: string | null }>(
    `
    WITH selected_dates AS (
      SELECT DISTINCT g.trade_date
      FROM public.gold_saudi_equity_daily_features g
      LEFT JOIN public.saudi_equity_symbols s
        ON g.symbol = s.symbol
      WHERE ${where.join(" AND ")}
      ORDER BY g.trade_date DESC
      LIMIT $${params.length + 1}
    )
    SELECT to_char(MIN(trade_date), 'YYYY-MM-DD') as start_date
    FROM selected_dates
  `,
    [...params, rangeDays]
  )

  const startDate = dateResult.rows[0]?.start_date
  if (!startDate) {
    return { where, params }
  }

  return {
    where: [...where, `g.trade_date >= $${params.length + 1}`],
    params: [...params, startDate],
  }
}

export async function fetchSymbolsList() {
  const cacheKey = "symbols:list"
  const cached = getCache<{
    symbols: SymbolMeta[]
    sectors: string[]
    markets: string[]
    missingColumns: string[]
  }>(cacheKey)
  if (cached) return cached

  const columns = await getAvailableColumns("saudi_equity_symbols")
  const missingColumns: string[] = []

  const hasNameEn = columns.has("name_en")
  const hasNameAr = columns.has("name_ar")
  const hasSector = columns.has("sector")
  const hasMarket = columns.has("market")
  const hasIsActive = columns.has("is_active")

  if (!hasNameEn) missingColumns.push("name_en")
  if (!hasNameAr) missingColumns.push("name_ar")
  if (!hasSector) missingColumns.push("sector")
  if (!hasMarket) missingColumns.push("market")
  if (!hasIsActive) missingColumns.push("is_active")

  const select = [
    "symbol",
    hasNameEn ? "name_en" : "NULL::text as name_en",
    hasNameAr ? "name_ar" : "NULL::text as name_ar",
    hasSector ? "sector" : "NULL::text as sector",
    hasMarket ? "market" : "NULL::text as market",
    hasIsActive ? "is_active" : "NULL::boolean as is_active",
  ]

  const result = await query<SymbolMeta>(
    `
    SELECT ${select.join(", ")}
    FROM public.saudi_equity_symbols
    ORDER BY symbol
  `,
    []
  )

  const symbols = result.rows.map((row) => ({
    symbol: row.symbol,
    name_en: row.name_en ?? null,
    name_ar: row.name_ar ?? null,
    sector: row.sector ?? null,
    market: row.market ?? null,
    is_active: toBoolean(row.is_active) ?? null,
  }))

  const sectors = Array.from(
    new Set(symbols.map((row) => row.sector).filter(Boolean) as string[])
  ).sort()
  const markets = Array.from(
    new Set(symbols.map((row) => row.market).filter(Boolean) as string[])
  ).sort()

  const payload = { symbols, sectors, markets, missingColumns }
  setCache(cacheKey, payload, SYMBOLS_TTL_MS)
  return payload
}

export async function fetchScreenerRows(
  filters: ScreenerFilters,
  rangeDays?: 14 | 21 | 28
) {
  const featureColumns = await getAvailableColumns(
    "gold_saudi_equity_daily_features"
  )
  const symbolColumns = await getAvailableColumns("saudi_equity_symbols")

  const missingColumns: string[] = []
  const usedColumns: string[] = []

  const priceColumn = featureColumns.has("close")
    ? "close"
    : featureColumns.has("adjusted_close")
    ? "adjusted_close"
    : null
  if (!priceColumn) {
    missingColumns.push("close")
  } else {
    usedColumns.push(priceColumn)
  }

  const volumeColumn = featureColumns.has("volume")
    ? "volume"
    : featureColumns.has("turnover")
    ? "turnover"
    : null
  const avgVolumeColumn = featureColumns.has("volume") ? "volume" : null
  const avgTurnoverColumn = featureColumns.has("turnover") ? "turnover" : null
  if (!volumeColumn) {
    missingColumns.push("volume")
  } else {
    usedColumns.push(volumeColumn)
  }
  if (!avgTurnoverColumn) {
    missingColumns.push("turnover")
  } else {
    usedColumns.push(avgTurnoverColumn)
  }

  const hasDailyReturn = featureColumns.has("daily_return")
  const hasMomentum = featureColumns.has("momentum_5d")
  const hasVolatility = featureColumns.has("volatility_5d")
  const hasVolumeSpike = featureColumns.has("volume_spike_ratio")
  const hasIntraday = featureColumns.has("intraday_strength")
  const hasDirection = featureColumns.has("direction_signal")
  const rsiColumn = featureColumns.has("rsi")
    ? "rsi"
    : featureColumns.has("rsi_14")
    ? "rsi_14"
    : null
  const apxColumn = featureColumns.has("apx")
    ? "apx"
    : featureColumns.has("apx_14")
    ? "apx_14"
    : featureColumns.has("adx")
    ? "adx"
    : featureColumns.has("adx_14")
    ? "adx_14"
    : null

  if (!hasDailyReturn) missingColumns.push("daily_return")
  if (hasDailyReturn) usedColumns.push("daily_return")
  if (!hasMomentum) missingColumns.push("momentum_5d")
  if (hasMomentum) usedColumns.push("momentum_5d")
  if (!hasVolatility) missingColumns.push("volatility_5d")
  if (hasVolatility) usedColumns.push("volatility_5d")
  if (!hasVolumeSpike) missingColumns.push("volume_spike_ratio")
  if (hasVolumeSpike) usedColumns.push("volume_spike_ratio")
  if (!hasIntraday) missingColumns.push("intraday_strength")
  if (hasIntraday) usedColumns.push("intraday_strength")
  if (!hasDirection) missingColumns.push("direction_signal")
  if (hasDirection) usedColumns.push("direction_signal")
  if (!rsiColumn) missingColumns.push("rsi")
  if (rsiColumn) usedColumns.push(rsiColumn)
  if (!apxColumn) missingColumns.push("apx")
  if (apxColumn) usedColumns.push(apxColumn)

  const hasNameEn = symbolColumns.has("name_en")
  const hasNameAr = symbolColumns.has("name_ar")
  const hasSector = symbolColumns.has("sector")
  const hasMarket = symbolColumns.has("market")
  const hasIsActive = symbolColumns.has("is_active")

  if (hasNameEn) usedColumns.push("name_en")
  if (hasNameAr) usedColumns.push("name_ar")
  if (hasSector) usedColumns.push("sector")
  if (hasMarket) usedColumns.push("market")
  if (hasIsActive) usedColumns.push("is_active")

  if (!hasNameEn) missingColumns.push("name_en")
  if (hasNameEn) usedColumns.push("name_en")
  if (!hasNameAr) missingColumns.push("name_ar")
  if (hasNameAr) usedColumns.push("name_ar")
  if (!hasSector) missingColumns.push("sector")
  if (hasSector) usedColumns.push("sector")
  if (!hasMarket) missingColumns.push("market")
  if (hasMarket) usedColumns.push("market")
  if (!hasIsActive) missingColumns.push("is_active")
  if (hasIsActive) usedColumns.push("is_active")

  const select = [
    "g.symbol",
    hasNameEn ? "s.name_en" : "NULL::text as name_en",
    hasNameAr ? "s.name_ar" : "NULL::text as name_ar",
    hasSector ? "s.sector" : "NULL::text as sector",
    hasMarket ? "s.market" : "NULL::text as market",
    hasIsActive ? "s.is_active" : "NULL::boolean as is_active",
    priceColumn
      ? `(ARRAY_AGG(g.${priceColumn} ORDER BY g.trade_date ASC))[1] as first_close`
      : "NULL::double precision as first_close",
    priceColumn
      ? `(ARRAY_AGG(g.${priceColumn} ORDER BY g.trade_date DESC))[1] as latest_close`
      : "NULL::double precision as latest_close",
    hasDailyReturn
      ? "AVG(g.daily_return) as avg_daily_return"
      : "NULL::double precision as avg_daily_return",
    hasMomentum
      ? "AVG(g.momentum_5d) as avg_momentum_5d"
      : "NULL::double precision as avg_momentum_5d",
    hasVolatility
      ? "AVG(g.volatility_5d) as avg_volatility_5d"
      : "NULL::double precision as avg_volatility_5d",
    hasVolumeSpike
      ? "AVG(g.volume_spike_ratio) as avg_volume_spike_ratio"
      : "NULL::double precision as avg_volume_spike_ratio",
    hasIntraday
      ? "AVG(g.intraday_strength) as avg_intraday_strength"
      : "NULL::double precision as avg_intraday_strength",
    avgVolumeColumn
      ? `AVG(g.${avgVolumeColumn})::double precision as avg_volume`
      : "NULL::double precision as avg_volume",
    avgTurnoverColumn
      ? `AVG(g.${avgTurnoverColumn})::double precision as avg_turnover`
      : "NULL::double precision as avg_turnover",
    rsiColumn
      ? `(ARRAY_AGG(g.${rsiColumn} ORDER BY g.trade_date DESC))[1] as latest_rsi`
      : "NULL::double precision as latest_rsi",
    apxColumn
      ? `(ARRAY_AGG(g.${apxColumn} ORDER BY g.trade_date DESC))[1] as latest_apx`
      : "NULL::double precision as latest_apx",
    hasDirection
      ? "AVG(CASE WHEN g.direction_signal = 1 THEN 1 ELSE 0 END) as fraction_up"
      : "NULL::double precision as fraction_up",
  ]

  const where: string[] = rangeDays
    ? ["g.trade_date <= $1"]
    : ["g.trade_date BETWEEN $1 AND $2"]
  const params: QueryParam[] = rangeDays
    ? [filters.end]
    : [filters.start, filters.end]

  if (filters.symbols?.length) {
    params.push(filters.symbols)
    where.push(`g.symbol = ANY($${params.length})`)
  }

  if (filters.sectors?.length) {
    if (hasSector) {
      params.push(filters.sectors)
      where.push(`s.sector = ANY($${params.length})`)
    } else {
      missingColumns.push("sector")
    }
  }

  if (filters.markets?.length) {
    if (hasMarket) {
      params.push(filters.markets)
      where.push(`s.market = ANY($${params.length})`)
    } else {
      missingColumns.push("market")
    }
  }

  if (filters.activeOnly) {
    if (hasIsActive) {
      where.push("s.is_active = true")
    } else {
      missingColumns.push("is_active")
    }
  }

  if (filters.name) {
    const search = `%${filters.name}%`
    params.push(search)
    if (hasNameEn && hasNameAr) {
      where.push(
        `(s.name_en ILIKE $${params.length} OR s.name_ar ILIKE $${params.length} OR g.symbol ILIKE $${params.length})`
      )
    } else if (hasNameEn) {
      where.push(
        `(s.name_en ILIKE $${params.length} OR g.symbol ILIKE $${params.length})`
      )
    } else if (hasNameAr) {
      where.push(
        `(s.name_ar ILIKE $${params.length} OR g.symbol ILIKE $${params.length})`
      )
    } else {
      where.push(`g.symbol ILIKE $${params.length}`)
      missingColumns.push("name_en")
      missingColumns.push("name_ar")
    }
  }

  const {
    where: scopedWhere,
    params: scopedParams,
  } = await applyRollingWindow(where, params, rangeDays)

  const groupBy = ["g.symbol"]
  if (hasNameEn) groupBy.push("s.name_en")
  if (hasNameAr) groupBy.push("s.name_ar")
  if (hasSector) groupBy.push("s.sector")
  if (hasMarket) groupBy.push("s.market")
  if (hasIsActive) groupBy.push("s.is_active")

  const result = await query<ScreenerRow>(
    `
    SELECT ${select.join(", ")}
    FROM public.gold_saudi_equity_daily_features g
    LEFT JOIN public.saudi_equity_symbols s
      ON g.symbol = s.symbol
    WHERE ${scopedWhere.join(" AND ")}
    GROUP BY ${groupBy.join(", ")}
    ORDER BY g.symbol
  `,
    scopedParams
  )

  const movementBySymbol = new Map<
    string,
    {
      upDays: number
      downDays: number
      netDirectionDays: number
      avgDailyReturn: number | null
      rangeVolatility: number | null
    }
  >()

  if (priceColumn) {
    const movementResult = await query<{
      symbol: string
      up_days: number | null
      down_days: number | null
      net_direction_days: number | null
      avg_daily_return_dyn: number | null
      range_volatility_dyn: number | null
    }>(
      `
      WITH priced AS (
        SELECT
          g.symbol,
          g.${priceColumn} as price_value,
          LAG(g.${priceColumn}) OVER (PARTITION BY g.symbol ORDER BY g.trade_date) as prev_price
        FROM public.gold_saudi_equity_daily_features g
        LEFT JOIN public.saudi_equity_symbols s
          ON g.symbol = s.symbol
        WHERE ${scopedWhere.join(" AND ")}
      ),
      returns AS (
        SELECT
          symbol,
          price_value,
          prev_price,
          CASE
            WHEN price_value IS NULL OR prev_price IS NULL OR prev_price = 0 THEN NULL
            ELSE (price_value - prev_price) / prev_price
          END as day_return
        FROM priced
      )
      SELECT
        symbol,
        SUM(
          CASE
            WHEN price_value IS NULL OR prev_price IS NULL THEN 0
            WHEN price_value > prev_price THEN 1
            ELSE 0
          END
        )::int as up_days,
        SUM(
          CASE
            WHEN price_value IS NULL OR prev_price IS NULL THEN 0
            WHEN price_value < prev_price THEN 1
            ELSE 0
          END
        )::int as down_days,
        SUM(
          CASE
            WHEN price_value IS NULL OR prev_price IS NULL THEN 0
            WHEN price_value > prev_price THEN 1
            WHEN price_value < prev_price THEN -1
            ELSE 0
          END
        )::int as net_direction_days
        ,
        AVG(day_return)::double precision as avg_daily_return_dyn,
        STDDEV_SAMP(day_return)::double precision as range_volatility_dyn
      FROM returns
      GROUP BY symbol
    `,
      scopedParams
    )

    movementResult.rows.forEach((row) => {
      movementBySymbol.set(row.symbol, {
        upDays: Number.isFinite(Number(row.up_days)) ? Number(row.up_days) : 0,
        downDays: Number.isFinite(Number(row.down_days))
          ? Number(row.down_days)
          : 0,
        netDirectionDays: Number.isFinite(Number(row.net_direction_days))
          ? Number(row.net_direction_days)
          : 0,
        avgDailyReturn: toNumber(row.avg_daily_return_dyn),
        rangeVolatility: toNumber(row.range_volatility_dyn),
      })
    })
  }

  const rows = result.rows.map((row) => {
    const movement = movementBySymbol.get(row.symbol)
    const firstClose = toNumber(row.first_close)
    const latestClose = toNumber(row.latest_close)
    const rangeMomentum =
      firstClose !== null && latestClose !== null && firstClose !== 0
        ? (latestClose - firstClose) / firstClose
        : null

    return {
      up_days: movement?.upDays ?? 0,
      down_days: movement?.downDays ?? 0,
      net_direction_days: movement?.netDirectionDays ?? 0,
      symbol: row.symbol,
      name_en: row.name_en ?? null,
      name_ar: row.name_ar ?? null,
      sector: row.sector ?? null,
      market: row.market ?? null,
      is_active: toBoolean(row.is_active),
      first_close: firstClose,
      latest_close: latestClose,
      avg_daily_return: movement?.avgDailyReturn ?? toNumber(row.avg_daily_return),
      avg_momentum_5d: rangeMomentum ?? toNumber(row.avg_momentum_5d),
      avg_volatility_5d:
        movement?.rangeVolatility ?? toNumber(row.avg_volatility_5d),
      avg_volume_spike_ratio: toNumber(row.avg_volume_spike_ratio),
      avg_intraday_strength: toNumber(row.avg_intraday_strength),
      avg_volume: toNumber(row.avg_volume),
      avg_turnover: toNumber(row.avg_turnover),
      latest_rsi: toNumber(row.latest_rsi),
      latest_apx: toNumber(row.latest_apx),
      fraction_up: toNumber(row.fraction_up),
    }
  })

  const uniqueMissing = Array.from(new Set(missingColumns))
  const uniqueUsed = Array.from(new Set(usedColumns))
  return {
    rows,
    missingColumns: uniqueMissing,
    usedColumns: uniqueUsed,
  }
}

export async function fetchMarketPriceSeries(
  filters: ScreenerFilters,
  rangeDays?: 14 | 21 | 28
) {
  const featureColumns = await getAvailableColumns(
    "gold_saudi_equity_daily_features"
  )
  const symbolColumns = await getAvailableColumns("saudi_equity_symbols")

  const missingColumns: string[] = []
  const usedColumns: string[] = []

  const priceColumn = featureColumns.has("close")
    ? "close"
    : featureColumns.has("adjusted_close")
    ? "adjusted_close"
    : null
  const openColumn = featureColumns.has("open") ? "open" : null
  const highColumn = featureColumns.has("high") ? "high" : null
  const lowColumn = featureColumns.has("low") ? "low" : null

  if (!priceColumn) {
    missingColumns.push("close")
    return {
      series: [] as MarketSeriesPoint[],
      missingColumns: Array.from(new Set(missingColumns)),
      usedColumns,
    }
  }
  usedColumns.push(priceColumn)
  if (openColumn) usedColumns.push(openColumn)
  if (highColumn) usedColumns.push(highColumn)
  if (lowColumn) usedColumns.push(lowColumn)
  if (!openColumn) missingColumns.push("open")
  if (!highColumn) missingColumns.push("high")
  if (!lowColumn) missingColumns.push("low")

  const hasNameEn = symbolColumns.has("name_en")
  const hasNameAr = symbolColumns.has("name_ar")
  const hasSector = symbolColumns.has("sector")
  const hasMarket = symbolColumns.has("market")
  const hasIsActive = symbolColumns.has("is_active")

  if (!hasNameEn) missingColumns.push("name_en")
  if (!hasNameAr) missingColumns.push("name_ar")
  if (!hasSector) missingColumns.push("sector")
  if (!hasMarket) missingColumns.push("market")
  if (!hasIsActive) missingColumns.push("is_active")
  if (hasNameEn) usedColumns.push("name_en")
  if (hasNameAr) usedColumns.push("name_ar")
  if (hasSector) usedColumns.push("sector")
  if (hasMarket) usedColumns.push("market")
  if (hasIsActive) usedColumns.push("is_active")

  const where: string[] = rangeDays
    ? ["g.trade_date <= $1"]
    : ["g.trade_date BETWEEN $1 AND $2"]
  const params: QueryParam[] = rangeDays
    ? [filters.end]
    : [filters.start, filters.end]

  if (filters.symbols?.length) {
    params.push(filters.symbols)
    where.push(`g.symbol = ANY($${params.length})`)
  }

  if (filters.sectors?.length) {
    if (hasSector) {
      params.push(filters.sectors)
      where.push(`s.sector = ANY($${params.length})`)
    } else {
      missingColumns.push("sector")
    }
  }

  if (filters.markets?.length) {
    if (hasMarket) {
      params.push(filters.markets)
      where.push(`s.market = ANY($${params.length})`)
    } else {
      missingColumns.push("market")
    }
  }

  if (filters.activeOnly) {
    if (hasIsActive) {
      where.push("s.is_active = true")
    } else {
      missingColumns.push("is_active")
    }
  }

  if (filters.name) {
    const search = `%${filters.name}%`
    params.push(search)
    if (hasNameEn && hasNameAr) {
      where.push(
        `(s.name_en ILIKE $${params.length} OR s.name_ar ILIKE $${params.length} OR g.symbol ILIKE $${params.length})`
      )
    } else if (hasNameEn) {
      where.push(
        `(s.name_en ILIKE $${params.length} OR g.symbol ILIKE $${params.length})`
      )
    } else if (hasNameAr) {
      where.push(
        `(s.name_ar ILIKE $${params.length} OR g.symbol ILIKE $${params.length})`
      )
    } else {
      where.push(`g.symbol ILIKE $${params.length}`)
      missingColumns.push("name_en")
      missingColumns.push("name_ar")
    }
  }

  const {
    where: scopedWhere,
    params: scopedParams,
  } = await applyRollingWindow(where, params, rangeDays)

  const result = await query<{
    trade_date: string
    avg_open: number | null
    avg_high: number | null
    avg_low: number | null
    avg_close: number | null
    symbol_count: number
  }>(
    `
    SELECT
      to_char(g.trade_date, 'YYYY-MM-DD') as trade_date,
      ${
        openColumn
          ? `AVG(g.${openColumn})::double precision`
          : "NULL::double precision"
      } as avg_open,
      ${
        highColumn
          ? `AVG(g.${highColumn})::double precision`
          : "NULL::double precision"
      } as avg_high,
      ${
        lowColumn
          ? `AVG(g.${lowColumn})::double precision`
          : "NULL::double precision"
      } as avg_low,
      AVG(g.${priceColumn})::double precision as avg_close,
      COUNT(DISTINCT g.symbol)::int as symbol_count
    FROM public.gold_saudi_equity_daily_features g
    LEFT JOIN public.saudi_equity_symbols s
      ON g.symbol = s.symbol
    WHERE ${scopedWhere.join(" AND ")}
    GROUP BY g.trade_date
    ORDER BY g.trade_date ASC
  `,
    scopedParams
  )

  const series = result.rows.map((row) => ({
    trade_date: row.trade_date,
    avg_open: toNumber(row.avg_open),
    avg_high: toNumber(row.avg_high),
    avg_low: toNumber(row.avg_low),
    avg_close: toNumber(row.avg_close),
    symbol_count:
      Number.isFinite(Number(row.symbol_count)) && Number(row.symbol_count) > 0
        ? Number(row.symbol_count)
        : 0,
  }))

  return {
    series,
    missingColumns: Array.from(new Set(missingColumns)),
    usedColumns: Array.from(new Set(usedColumns)),
  }
}

export async function fetchSymbolSeries(
  symbol: string,
  start: string,
  end: string
) {
  const featureColumns = await getAvailableColumns(
    "gold_saudi_equity_daily_features"
  )
  const symbolColumns = await getAvailableColumns("saudi_equity_symbols")

  const missingColumns: string[] = []
  const usedColumns: string[] = []

  const priceColumn = featureColumns.has("close")
    ? "close"
    : featureColumns.has("adjusted_close")
    ? "adjusted_close"
    : null
  if (!priceColumn) {
    missingColumns.push("close")
  } else {
    usedColumns.push(priceColumn)
  }

  const volumeColumn = featureColumns.has("volume")
    ? "volume"
    : featureColumns.has("turnover")
    ? "turnover"
    : null
  const openColumn = featureColumns.has("open") ? "open" : null
  const highColumn = featureColumns.has("high") ? "high" : null
  const lowColumn = featureColumns.has("low") ? "low" : null
  if (!volumeColumn) {
    missingColumns.push("volume")
  } else {
    usedColumns.push(volumeColumn)
  }
  if (!openColumn) missingColumns.push("open")
  if (openColumn) usedColumns.push("open")
  if (!highColumn) missingColumns.push("high")
  if (highColumn) usedColumns.push("high")
  if (!lowColumn) missingColumns.push("low")
  if (lowColumn) usedColumns.push("low")

  const hasDailyReturn = featureColumns.has("daily_return")
  const hasMomentum = featureColumns.has("momentum_5d")
  const hasVolatility = featureColumns.has("volatility_5d")

  if (!hasDailyReturn) missingColumns.push("daily_return")
  if (hasDailyReturn) usedColumns.push("daily_return")
  if (!hasMomentum) missingColumns.push("momentum_5d")
  if (hasMomentum) usedColumns.push("momentum_5d")
  if (!hasVolatility) missingColumns.push("volatility_5d")
  if (hasVolatility) usedColumns.push("volatility_5d")

  const select = [
    "to_char(g.trade_date, 'YYYY-MM-DD') as trade_date",
    openColumn
      ? `g.${openColumn} as open`
      : "NULL::double precision as open",
    highColumn
      ? `g.${highColumn} as high`
      : "NULL::double precision as high",
    lowColumn
      ? `g.${lowColumn} as low`
      : "NULL::double precision as low",
    priceColumn
      ? `g.${priceColumn} as close`
      : "NULL::double precision as close",
    volumeColumn
      ? `g.${volumeColumn} as volume`
      : "NULL::double precision as volume",
    hasDailyReturn
      ? "g.daily_return"
      : "NULL::double precision as daily_return",
    hasMomentum
      ? "g.momentum_5d"
      : "NULL::double precision as momentum_5d",
    hasVolatility
      ? "g.volatility_5d"
      : "NULL::double precision as volatility_5d",
  ]

  const seriesResult = await query<SeriesPoint>(
    `
    SELECT ${select.join(", ")}
    FROM public.gold_saudi_equity_daily_features g
    WHERE g.symbol = $1
      AND g.trade_date BETWEEN $2 AND $3
    ORDER BY g.trade_date ASC
  `,
    [symbol, start, end]
  )

  const series = seriesResult.rows.map((row) => ({
    trade_date: row.trade_date,
    open: toNumber(row.open),
    high: toNumber(row.high),
    low: toNumber(row.low),
    close: toNumber(row.close),
    volume: toNumber(row.volume),
    daily_return: toNumber(row.daily_return),
    momentum_5d: toNumber(row.momentum_5d),
    volatility_5d: toNumber(row.volatility_5d),
  }))

  const hasNameEn = symbolColumns.has("name_en")
  const hasNameAr = symbolColumns.has("name_ar")
  const hasSector = symbolColumns.has("sector")
  const hasMarket = symbolColumns.has("market")
  const hasIsActive = symbolColumns.has("is_active")

  const metaSelect = [
    "symbol",
    hasNameEn ? "name_en" : "NULL::text as name_en",
    hasNameAr ? "name_ar" : "NULL::text as name_ar",
    hasSector ? "sector" : "NULL::text as sector",
    hasMarket ? "market" : "NULL::text as market",
    hasIsActive ? "is_active" : "NULL::boolean as is_active",
  ]

  const metaResult = await query<SymbolMeta>(
    `
    SELECT ${metaSelect.join(", ")}
    FROM public.saudi_equity_symbols
    WHERE symbol = $1
    LIMIT 1
  `,
    [symbol]
  )

  const meta = metaResult.rows[0]
    ? {
        symbol: metaResult.rows[0].symbol,
        name_en: metaResult.rows[0].name_en ?? null,
        name_ar: metaResult.rows[0].name_ar ?? null,
        sector: metaResult.rows[0].sector ?? null,
        market: metaResult.rows[0].market ?? null,
        is_active: toBoolean(metaResult.rows[0].is_active),
      }
    : null

  const uniqueMissing = Array.from(new Set(missingColumns))
  const uniqueUsed = Array.from(new Set(usedColumns))
  return {
    series,
    meta,
    missingColumns: uniqueMissing,
    usedColumns: uniqueUsed,
  }
}

async function resolveEventsTable() {
  const candidates = ["saudi_equity_events", "saudi_equity_corporate_events"]
  for (const tableName of candidates) {
    const result = await query<{ table_exists: boolean }>(
      `SELECT to_regclass($1) IS NOT NULL as table_exists`,
      [`public.${tableName}`]
    )
    if (result.rows[0]?.table_exists) {
      return tableName
    }
  }
  return null
}

export async function fetchSymbolEvents(symbol: string, start: string, end: string) {
  const tableName = await resolveEventsTable()
  if (!tableName) {
    return {
      events: [] as SymbolEvent[],
      missingColumns: ["saudi_equity_events"],
      usedColumns: [] as string[],
    }
  }

  const columns = await getAvailableColumns(tableName)
  const symbolColumn = columns.has("symbol")
    ? "symbol"
    : columns.has("ticker")
    ? "ticker"
    : null
  const dateColumn = columns.has("event_date")
    ? "event_date"
    : columns.has("trade_date")
    ? "trade_date"
    : columns.has("date")
    ? "date"
    : null
  const typeColumn = columns.has("event_type")
    ? "event_type"
    : columns.has("type")
    ? "type"
    : columns.has("category")
    ? "category"
    : null
  const titleColumn = columns.has("event_title")
    ? "event_title"
    : columns.has("title")
    ? "title"
    : columns.has("event_name")
    ? "event_name"
    : null
  const descriptionColumn = columns.has("description")
    ? "description"
    : columns.has("details")
    ? "details"
    : columns.has("notes")
    ? "notes"
    : null

  const missingColumns: string[] = []
  const usedColumns: string[] = []
  if (!symbolColumn) missingColumns.push("symbol")
  if (!dateColumn) missingColumns.push("event_date")
  if (symbolColumn) usedColumns.push(symbolColumn)
  if (dateColumn) usedColumns.push(dateColumn)
  if (typeColumn) usedColumns.push(typeColumn)
  if (titleColumn) usedColumns.push(titleColumn)
  if (descriptionColumn) usedColumns.push(descriptionColumn)

  if (!symbolColumn || !dateColumn) {
    return {
      events: [] as SymbolEvent[],
      missingColumns,
      usedColumns,
    }
  }

  const result = await query<SymbolEvent>(
    `
    SELECT
      to_char(e.${dateColumn}, 'YYYY-MM-DD') as event_date,
      ${
        typeColumn
          ? `e.${typeColumn}::text`
          : "NULL::text"
      } as event_type,
      ${
        titleColumn
          ? `e.${titleColumn}::text`
          : "NULL::text"
      } as event_title,
      ${
        descriptionColumn
          ? `e.${descriptionColumn}::text`
          : "NULL::text"
      } as description
    FROM public.${tableName} e
    WHERE e.${symbolColumn} = $1
      AND e.${dateColumn} BETWEEN $2 AND $3
    ORDER BY e.${dateColumn} DESC
    LIMIT 50
  `,
    [symbol, start, end]
  )

  return {
    events: result.rows.map((row) => ({
      event_date: row.event_date,
      event_type: row.event_type ?? null,
      event_title: row.event_title ?? null,
      description: row.description ?? null,
    })),
    missingColumns,
    usedColumns,
  }
}
